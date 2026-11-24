// =====================================================================
//  API: habla con Supabase (PostgREST) usando fetch, sin librerías.
// =====================================================================
(function () {
  'use strict';

  var C = window.QUINIELA_CONFIG || {};
  var BASE = String(C.SUPABASE_URL || '').replace(/\/+$/, '') + '/rest/v1';
  var CLAVE_TOKEN = 'quiniela.token';
  var tokenMemoria = null;

  var MENSAJES = {
    SIN_CONEXION: 'No hay conexión. Revisa tu internet e intenta otra vez.',
    CODIGO_INVALIDO: 'Ese código de grupo no es válido. Pídele el link a quien organiza.',
    TELEFONO_INVALIDO: 'Escribe tu número de celular a 10 dígitos.',
    NIP_INVALIDO: 'El NIP debe ser de 4 números.',
    APODO_INVALIDO: 'Tu nombre debe tener entre 2 y 20 letras.',
    TELEFONO_YA_REGISTRADO: 'Ese número ya tiene cuenta. Entra con tu NIP en "Ya tengo cuenta".',
    APODO_OCUPADO: 'Ese nombre ya lo usa alguien del grupo. Prueba con otro.',
    TELEFONO_NO_REGISTRADO: 'No hay ninguna cuenta con ese número. ¿Ya te registraste?',
    NIP_INCORRECTO: 'NIP incorrecto. Revisa e intenta de nuevo.',
    NIP_ACTUAL_INCORRECTO: 'Tu NIP actual no es correcto.',
    DEMASIADOS_INTENTOS: 'Demasiados intentos. Espera 5 minutos o pide a quien organiza que te ponga un NIP nuevo.',
    CUENTA_DESACTIVADA: 'Tu cuenta está desactivada. Habla con quien organiza.',
    SESION_INVALIDA: 'Tu sesión se cerró. Vuelve a entrar.',
    PARTIDO_CERRADO: 'Este partido ya empezó: ya no se puede cambiar el pronóstico.',
    PARTIDO_NO_EXISTE: 'Ese partido ya no existe.',
    MARCADOR_INVALIDO: 'Ese marcador no es válido.',
    NO_AUTORIZADO: 'Solo el admin puede hacer esto.',
    PARTIDO_NO_HA_EMPEZADO: 'El resultado se captura cuando el partido ya empezó.',
    BOLSA_CERRADA: 'Esa bolsa ya está cerrada. Reábrela en Admin › Bolsas para hacer cambios.',
    BOLSA_NO_EXISTE: 'Esa bolsa no existe.',
    FALTAN_RESULTADOS: 'Todavía faltan resultados de partidos de esta bolsa.',
    BOLSA_SIN_PARTIDOS: 'Esta bolsa todavía no tiene partidos.',
    SIN_TORNEO: 'No hay torneo activo. Crea uno en Admin › Grupo.',
    DATOS_INVALIDOS: 'Revisa los datos del partido.',
    EQUIPO_INVALIDO: 'Elige los dos equipos.',
    EQUIPOS_IGUALES: 'Elige dos equipos distintos.',
    FECHA_INVALIDA: 'Revisa la fecha y la hora.',
    RESULTADO_FUTURO: 'Ese partido ya tiene resultado: no lo puedes mover al futuro.',
    MONTO_INVALIDO: 'Escribe un monto válido.',
    JUGADOR_NO_EXISTE: 'Ese jugador ya no existe.',
    NO_PUEDES_QUITARTE: 'No puedes quitarte el admin ni desactivarte a ti mismo.',
    SIN_CREDENCIALES: 'Ese jugador es de prueba y no tiene NIP.',
    NOMBRE_INVALIDO: 'Escribe un nombre más largo.',
    CODIGO_FORMATO: 'El código debe tener de 4 a 20 letras o números (sin acentos).',
    TORNEO_NO_EXISTE: 'Ese torneo ya no existe.',
    EQUIPO_CLAVE: 'La abreviatura debe tener de 2 a 4 letras o números.',
    COLOR_INVALIDO: 'Elige colores válidos.',
    EQUIPO_NOMBRE_OCUPADO: 'Ya hay un equipo con ese nombre.',
    DUPLICADO: 'Eso ya existe.'
  };

  function mensaje(codigo) { return MENSAJES[codigo] || 'Algo salió mal. Intenta otra vez.'; }

  function configurado() {
    return /^https?:\/\/[^\s]+$/.test(C.SUPABASE_URL || '') &&
      !!C.SUPABASE_KEY && String(C.SUPABASE_KEY).indexOf('PEGA_AQUI') === -1;
  }

  function encabezados() {
    var h = { 'apikey': C.SUPABASE_KEY, 'Content-Type': 'application/json', 'Accept': 'application/json' };
    // Las llaves antiguas (anon, tipo JWT) también van en Authorization
    if (String(C.SUPABASE_KEY).indexOf('eyJ') === 0) h['Authorization'] = 'Bearer ' + C.SUPABASE_KEY;
    return h;
  }

  function errorRed() {
    var e = new Error(MENSAJES.SIN_CONEXION);
    e.codigo = 'SIN_CONEXION';
    return e;
  }

  async function aError(r) {
    var cuerpo = null;
    try { cuerpo = await r.json(); } catch (_) { /* sin cuerpo */ }
    var codigo = (cuerpo && cuerpo.message) || ('HTTP_' + r.status);
    if (cuerpo && cuerpo.code === '23505') codigo = 'DUPLICADO';
    var e = new Error(mensaje(codigo));
    e.codigo = codigo;
    e.status = r.status;
    return e;
  }

  async function leer(ruta) {
    var r;
    try { r = await fetch(BASE + '/' + ruta, { headers: encabezados(), cache: 'no-store' }); }
    catch (_) { throw errorRed(); }
    if (!r.ok) throw await aError(r);
    return r.json();
  }

  async function rpc(fn, args) {
    var r;
    try {
      r = await fetch(BASE + '/rpc/' + fn, {
        method: 'POST', headers: encabezados(), body: JSON.stringify(args || {}), cache: 'no-store'
      });
    } catch (_) { throw errorRed(); }
    if (!r.ok) throw await aError(r);
    var txt = await r.text();
    return txt ? JSON.parse(txt) : null;
  }

  // ---------- Sesión (se guarda en el celular) ----------
  function token() {
    try { return localStorage.getItem(CLAVE_TOKEN) || tokenMemoria; } catch (_) { return tokenMemoria; }
  }
  function guardarToken(t) {
    tokenMemoria = t;
    try { localStorage.setItem(CLAVE_TOKEN, t); } catch (_) { /* modo privado */ }
  }
  function borrarToken() {
    tokenMemoria = null;
    try { localStorage.removeItem(CLAVE_TOKEN); } catch (_) { /* modo privado */ }
  }

  function id(x) { return encodeURIComponent(x); }

  window.API = {
    mensaje: mensaje,
    configurado: configurado,
    token: token,
    guardarToken: guardarToken,
    borrarToken: borrarToken,

    // Acceso
    infoGrupo: function () { return rpc('info_grupo'); },
    registrar: function (codigo, telefono, nip, apodo) {
      return rpc('registrar', { p_codigo: codigo || '', p_telefono: telefono, p_nip: nip, p_apodo: apodo });
    },
    entrar: function (telefono, nip) { return rpc('entrar', { p_telefono: telefono, p_nip: nip }); },
    salir: function () { return rpc('salir', { p_token: token() }); },
    yo: function () { return rpc('yo', { p_token: token() }); },
    cambiarApodo: function (apodo) { return rpc('cambiar_apodo', { p_token: token(), p_apodo: apodo }); },
    cambiarNip: function (actual, nuevo) { return rpc('cambiar_nip', { p_token: token(), p_actual: actual, p_nuevo: nuevo }); },

    // Lectura
    torneoActivo: function () {
      return leer('torneos?select=id,nombre,es_prueba&activo=is.true&limit=1').then(function (r) { return r[0] || null; });
    },
    torneos: function () { return leer('torneos?select=id,nombre,activo,es_prueba,creado_en&order=creado_en.desc'); },
    equipos: function () { return leer('equipos?select=id,nombre,color,texto&order=nombre.asc'); },
    jugadores: function () { return leer('jugadores?select=id,apodo,es_admin,activo,es_prueba&order=apodo.asc'); },
    partidos: function (torneoId) { return leer('partidos?select=*&torneo_id=eq.' + id(torneoId) + '&order=inicio.asc'); },
    partido: function (partidoId) {
      return leer('partidos?select=*&id=eq.' + id(partidoId)).then(function (r) { return r[0] || null; });
    },
    misPronosticos: function (torneoId) { return rpc('mis_pronosticos', { p_token: token(), p_torneo: torneoId }); },
    guardarPronostico: function (partidoId, gl, gv) {
      return rpc('guardar_pronostico', { p_token: token(), p_partido: partidoId, p_local: gl, p_visitante: gv });
    },
    pronosticosPartido: function (partidoId) { return leer('v_pronosticos?select=*&partido_id=eq.' + id(partidoId)); },
    quienPronostico: function (partidoId) { return rpc('quien_pronostico', { p_partido: partidoId }); },
    bolsas: function (torneoId) { return leer('v_bolsas?select=*&torneo_id=eq.' + id(torneoId) + '&order=orden.asc'); },
    tabla: function (torneoId) { return leer('v_tabla?select=*&torneo_id=eq.' + id(torneoId)); },
    historial: function (torneoId) {
      return leer('v_historial?select=*&torneo_id=eq.' + id(torneoId) + '&order=orden.asc,posicion.asc.nullslast,puntos.desc');
    },
    pagos: function (bolsaIds) {
      if (!bolsaIds.length) return Promise.resolve([]);
      return leer('pagos?select=bolsa_id,jugador_id&bolsa_id=in.(' + bolsaIds.map(id).join(',') + ')');
    },

    // Admin
    admin: {
      datos: function () { return rpc('admin_datos', { p_token: token() }); },
      guardarPartido: function (p) {
        return rpc('admin_guardar_partido', {
          p_token: token(), p_id: p.id || null, p_fase: p.fase, p_ida_vuelta: p.ida_vuelta,
          p_local: p.local, p_visitante: p.visitante, p_inicio: p.inicio
        });
      },
      borrarPartido: function (partidoId) { return rpc('admin_borrar_partido', { p_token: token(), p_id: partidoId }); },
      resultado: function (partidoId, gl, gv) {
        return rpc('admin_resultado', { p_token: token(), p_partido: partidoId, p_local: gl, p_visitante: gv });
      },
      pago: function (bolsaId, jugadorId, pagado) {
        return rpc('admin_pago', { p_token: token(), p_bolsa: bolsaId, p_jugador: jugadorId, p_pagado: pagado });
      },
      monto: function (bolsaId, monto) { return rpc('admin_monto', { p_token: token(), p_bolsa: bolsaId, p_monto: monto }); },
      cerrarBolsa: function (bolsaId) { return rpc('admin_cerrar_bolsa', { p_token: token(), p_bolsa: bolsaId }); },
      reabrirBolsa: function (bolsaId) { return rpc('admin_reabrir_bolsa', { p_token: token(), p_bolsa: bolsaId }); },
      jugador: function (j) {
        return rpc('admin_jugador', {
          p_token: token(), p_jugador: j.id, p_apodo: j.apodo, p_telefono: j.telefono || '',
          p_activo: j.activo, p_es_admin: j.es_admin
        });
      },
      nip: function (jugadorId, nip) { return rpc('admin_nip', { p_token: token(), p_jugador: jugadorId, p_nip: nip }); },
      grupo: function (nombre, codigo) { return rpc('admin_grupo', { p_token: token(), p_nombre: nombre, p_codigo: codigo }); },
      nuevoTorneo: function (nombre) { return rpc('admin_nuevo_torneo', { p_token: token(), p_nombre: nombre }); },
      activarTorneo: function (torneoId) { return rpc('admin_activar_torneo', { p_token: token(), p_torneo: torneoId }); },
      equipo: function (e) {
        return rpc('admin_equipo', { p_token: token(), p_id: e.id, p_nombre: e.nombre, p_color: e.color, p_texto: e.texto });
      },
      borrarPrueba: function (nuevoTorneo) {
        return rpc('admin_borrar_prueba', { p_token: token(), p_nuevo_torneo: nuevoTorneo || '' });
      }
    }
  };
})();
