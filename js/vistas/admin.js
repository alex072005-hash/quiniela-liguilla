// Admin: partidos, resultados, pagos, bolsas, jugadores, invitación y torneos
(function () {
  'use strict';
  window.Vistas = window.Vistas || {};

  var TABS = [
    ['partidos', 'Partidos'], ['resultados', 'Resultados'], ['pagos', 'Pagos'],
    ['bolsas', 'Bolsas'], ['jugadores', 'Jugadores'], ['grupo', 'Grupo']
  ];
  var esc = function (s) { return UI.esc(s); };

  function linkInvitacion(codigo) {
    var base = location.href.split('#')[0].split('?')[0];
    return base + '#/registro/' + encodeURIComponent(codigo);
  }

  function copiar(texto) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(texto);
    return new Promise(function (ok, mal) {
      var ta = document.createElement('textarea');
      ta.value = texto; ta.setAttribute('readonly', '');
      ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { if (document.execCommand('copy')) ok(); else mal(); } catch (e) { mal(e); }
      finally { document.body.removeChild(ta); }
    });
  }

  Vistas.admin = async function (cont, params, n) {
    var tab = TABS.some(function (x) { return x[0] === params[0]; }) ? params[0] : 'partidos';
    var S = { editando: null, jugAbierto: null };

    async function cargar() {
      var t = App.torneo;
      var r = await Promise.all([
        API.admin.datos(),
        t ? API.partidos(t.id) : [],
        t ? API.bolsas(t.id) : [],
        t ? API.tabla(t.id) : [],
        API.equipos()
      ]);
      S.datos = r[0]; S.partidos = r[1]; S.bolsas = r[2]; S.tabla = r[3]; S.equipos = r[4];
      App.equipos = {};
      S.equipos.forEach(function (e) { App.equipos[e.id] = e; });
      S.pagos = t && S.bolsas.length ? await API.pagos(S.bolsas.map(function (b) { return b.id; })) : [];
    }

    await cargar();
    if (!App.vigente(n)) return;

    // ---------- Pintado ----------
    function pintar() {
      var t = App.torneo;
      cont.innerHTML = '<div class="cabeza-vista"><h1 class="h1">Admin</h1><p class="sub">' +
        (t ? 'Torneo activo: <b>' + esc(t.nombre) + '</b>' : 'No hay torneo activo') + '</p></div>' +
        '<div class="seg" role="tablist">' + TABS.map(function (x) {
          var act = x[0] === tab;
          return '<a role="tab" href="#/admin/' + x[0] + '" aria-selected="' + act + '" class="' + (act ? 'activo' : '') + '">' + x[1] + '</a>';
        }).join('') + '</div>' +
        '<div id="adminCuerpo">' + cuerpo() + '</div>';
    }
    function repintarCuerpo() {
      var el = document.getElementById('adminCuerpo');
      if (el) el.innerHTML = cuerpo();
    }
    function cuerpo() {
      if (tab === 'resultados') return tabResultados();
      if (tab === 'pagos') return tabPagos();
      if (tab === 'bolsas') return tabBolsas();
      if (tab === 'jugadores') return tabJugadores();
      if (tab === 'grupo') return tabGrupo();
      return tabPartidos();
    }
    function sinTorneo() {
      return '<div class="card mt">' + UI.vacio('No hay torneo activo', 'Crea uno en la pestaña Grupo.', 'calendario') +
        '<a class="btn btn-bloque" href="#/admin/grupo">Ir a Grupo</a></div>';
    }
    function eqs(p) {
      var L = App.equipo(p.local), V = App.equipo(p.visitante);
      return '<div class="fila-admin-eqs">' + UI.escudo(L, 'ch') + esc(L.nombre) + ' <span class="vs">vs</span> ' +
        UI.escudo(V, 'ch') + esc(V.nombre) + '</div>';
    }
    function bolsaCerradaPara(p) {
      return S.bolsas.some(function (b) {
        return b.cerrada_en && (b.fase == null || b.fase === p.fase) && (b.ida_vuelta == null || b.ida_vuelta === p.ida_vuelta);
      });
    }

    // ---------- Partidos ----------
    function opcionesEquipos(sel) {
      return '<option value="">Elige equipo</option>' + S.equipos.map(function (e) {
        return '<option value="' + esc(e.id) + '"' + (e.id === sel ? ' selected' : '') + '>' + esc(e.nombre) + '</option>';
      }).join('');
    }
    function formPartido(p) {
      return '<form class="card form" id="fPartido" novalidate><h3 class="h3">' + (p.id ? 'Editar partido' : 'Nuevo partido') + '</h3>' +
        '<div class="dos"><div class="campo"><label for="pFase">Fase</label><select class="input" id="pFase">' +
          ['cuartos', 'semis', 'final'].map(function (f) {
            return '<option value="' + f + '"' + (f === p.fase ? ' selected' : '') + '>' + UI.FASE_CORTA[f] + '</option>';
          }).join('') + '</select></div>' +
        '<div class="campo"><label for="pIv">Juego</label><select class="input" id="pIv">' +
          ['ida', 'vuelta'].map(function (x) {
            return '<option value="' + x + '"' + (x === p.ida_vuelta ? ' selected' : '') + '>' + UI.IV[x] + '</option>';
          }).join('') + '</select></div></div>' +
        '<div class="campo"><label for="pLocal">Local (juega en casa)</label><select class="input" id="pLocal">' + opcionesEquipos(p.local) + '</select></div>' +
        '<div class="campo"><label for="pVisita">Visitante</label><select class="input" id="pVisita">' + opcionesEquipos(p.visitante) + '</select></div>' +
        '<div class="campo"><label for="pInicio">Día y hora de inicio</label>' +
          '<input class="input" id="pInicio" type="datetime-local" value="' + (p.inicio ? UI.aLocalInput(p.inicio) : '') + '">' +
          '<span class="ayuda">Hora de Monterrey. A esa hora se cierran los pronósticos.</span></div>' +
        '<p class="error-form" role="alert"></p>' +
        '<div class="acciones"><button type="button" class="btn btn-2" data-acc="cancelar-partido">Cancelar</button>' +
        '<button type="submit" class="btn">Guardar partido</button></div></form>';
    }
    function tabPartidos() {
      if (!App.torneo) return sinTorneo();
      var html = S.editando ? formPartido(S.editando)
        : '<button type="button" class="btn btn-bloque" data-acc="nuevo-partido">' + UI.icono('mas') + 'Agregar partido</button>';
      var grupos = '';
      ['cuartos', 'semis', 'final'].forEach(function (f) {
        ['ida', 'vuelta'].forEach(function (iv) {
          var ps = S.partidos.filter(function (p) { return p.fase === f && p.ida_vuelta === iv; });
          if (!ps.length) return;
          grupos += '<h2 class="h2">' + UI.FASE_CORTA[f] + ' · ' + UI.IV[iv] + '</h2><div class="lista">' +
            ps.map(function (p) {
              var res = p.goles_local != null;
              var acciones = bolsaCerradaPara(p)
                ? '<span class="chip chip-gris">' + UI.icono('candado') + 'Bolsa cerrada</span>'
                : '<button type="button" class="btn btn-sm btn-2" data-acc="editar-partido" data-id="' + p.id + '">Editar</button>' +
                  '<button type="button" class="btn btn-sm btn-peligro" data-acc="borrar-partido" data-id="' + p.id + '">Borrar</button>';
              return '<div class="card fila-admin">' + eqs(p) +
                '<div class="sub">' + UI.fecha(p.inicio) + (res ? ' · Final ' + p.goles_local + '–' + p.goles_visitante : '') + '</div>' +
                '<div class="fila-admin-acc">' + acciones + '</div></div>';
            }).join('') + '</div>';
        });
      });
      html += grupos || '<div class="card mt">' + UI.vacio('Todavía no hay partidos',
        'Agrega los partidos de ida de cuartos cuando se conozcan los cruces.', 'calendario') + '</div>';
      html += '<details class="card mt" id="detEquipos"><summary>Equipos (' + S.equipos.length + ')</summary>' +
        '<p class="sub mt">Toca un equipo para editarlo, o agrega uno que falte.</p>' +
        '<div class="equipos-lista">' + S.equipos.map(function (e) {
          return '<button type="button" class="equipo-chip" data-acc="editar-equipo" data-id="' + esc(e.id) + '">' + UI.escudo(e, 'ch') + esc(e.nombre) + '</button>';
        }).join('') + '</div>' +
        '<form class="form" id="fEquipo" novalidate>' +
          '<div class="dos"><div class="campo"><label for="eId">Abreviatura</label><input class="input" id="eId" maxlength="4" placeholder="Ej. CEL" autocapitalize="characters"></div>' +
          '<div class="campo"><label for="eNombre">Nombre</label><input class="input" id="eNombre" maxlength="30" placeholder="Ej. Celaya"></div></div>' +
          '<div class="colores"><label>Color<input type="color" id="eColor" value="#1f6f43"></label><label>Letra<input type="color" id="eTexto" value="#ffffff"></label></div>' +
          '<p class="error-form mt" role="alert"></p>' +
          '<button type="submit" class="btn btn-sm btn-2 mt">Guardar equipo</button></form></details>';
      return html;
    }

    // ---------- Resultados ----------
    function formResultado(p) {
      var L = App.equipo(p.local), V = App.equipo(p.visitante);
      var cerrada = bolsaCerradaPara(p), res = p.goles_local != null;
      if (cerrada && res) {
        // Bolsa cerrada: solo se muestra el resultado (para corregir hay que reabrirla)
        return '<div class="card fila-admin">' +
          '<div class="res-meta">' + UI.FASE_CORTA[p.fase] + ' ' + UI.IV[p.ida_vuelta].toLowerCase() + ' · ' + UI.fecha(p.inicio) + '</div>' +
          '<div class="fila-admin-eqs">' + UI.escudo(L, 'ch') + esc(L.nombre) + ' <b class="num">' + p.goles_local + '–' + p.goles_visitante + '</b> ' +
          esc(V.nombre) + UI.escudo(V, 'ch') + '</div>' +
          '<div class="fila-admin-acc"><span class="chip chip-gris">' + UI.icono('candado') + 'Bolsa cerrada</span></div></div>';
      }
      var dis = cerrada ? ' disabled' : '';
      function fila(eq, nombre, valor) {
        return '<div class="res-fila">' + UI.escudo(eq, 'ch') + '<span class="res-nom">' + esc(eq.nombre) + '</span>' +
          '<input class="input res-in" name="' + nombre + '" type="number" inputmode="numeric" min="0" max="30" value="' + (res ? valor : '') +
          '" aria-label="Goles de ' + esc(eq.nombre) + '"' + dis + '></div>';
      }
      return '<form class="card res-form" data-id="' + p.id + '" novalidate>' +
        '<div class="res-meta">' + UI.FASE_CORTA[p.fase] + ' ' + UI.IV[p.ida_vuelta].toLowerCase() + ' · ' + UI.fecha(p.inicio) + '</div>' +
        fila(L, 'gl', p.goles_local) + fila(V, 'gv', p.goles_visitante) +
        (cerrada ? '<p class="ayuda">Su bolsa está cerrada. Para corregir, reábrela en la pestaña Bolsas.</p>'
          : '<div class="acciones">' + (res ? '<button type="button" class="btn btn-sm btn-borde" data-acc="quitar-resultado" data-id="' + p.id + '">Quitar resultado</button>' : '') +
            '<button type="submit" class="btn btn-sm">' + (res ? 'Corregir' : 'Guardar resultado') + '</button></div>') +
        '</form>';
    }
    function tabResultados() {
      if (!App.torneo) return sinTorneo();
      var ahora = Date.now();
      var empezados = S.partidos.filter(function (p) { return new Date(p.inicio).getTime() <= ahora; });
      var pend = empezados.filter(function (p) { return p.goles_local == null; });
      var hechos = empezados.filter(function (p) { return p.goles_local != null; }).reverse();
      var futuros = S.partidos.filter(function (p) { return new Date(p.inicio).getTime() > ahora; });
      var html = '<p class="sub mt">Captura el marcador al minuto 90, sin tiempo extra ni penales. Los puntos se calculan solos y se recalculan si corriges. ' +
        'Si su bolsa ya está cerrada, primero reábrela en la pestaña Bolsas.</p>';
      if (pend.length) html += '<h2 class="h2">Por capturar</h2><div class="lista">' + pend.map(formResultado).join('') + '</div>';
      if (hechos.length) html += '<h2 class="h2">Ya capturados</h2><div class="lista">' + hechos.map(formResultado).join('') + '</div>';
      if (futuros.length) {
        html += '<h2 class="h2">Todavía no empiezan</h2><div class="lista">' + futuros.map(function (p) {
          return '<div class="card fila-admin">' + eqs(p) + '<div class="sub">' + UI.fecha(p.inicio) + ' · se habilita al empezar</div></div>';
        }).join('') + '</div>';
      }
      if (!S.partidos.length) html += '<div class="card mt">' + UI.vacio('Todavía no hay partidos', 'Agrégalos en la pestaña Partidos.', 'calendario') + '</div>';
      return html;
    }

    // ---------- Pagos ----------
    function tabPagos() {
      if (!App.torneo) return sinTorneo();
      var pagado = {};
      S.pagos.forEach(function (x) { pagado[x.bolsa_id + '|' + x.jugador_id] = true; });
      var jugadores = S.datos.jugadores.filter(function (j) {
        return j.activo || S.pagos.some(function (x) { return x.jugador_id === j.id; });
      });
      if (!jugadores.length) return '<div class="card mt">' + UI.vacio('Todavía no hay jugadores', 'Invítalos desde la pestaña Grupo.', 'usuario') + '</div>';
      var head = '<tr><th>Jugador</th>' + S.bolsas.map(function (b) {
        return '<th>' + esc(b.corto) + (b.cerrada_en ? ' 🔒' : '') + '<small>' + UI.dinero(b.monto) + '</small></th>';
      }).join('') + '</tr>';
      var filas = jugadores.map(function (j) {
        return '<tr><td title="' + esc(j.apodo) + '">' + esc(j.apodo) + '</td>' + S.bolsas.map(function (b) {
          var si = !!pagado[b.id + '|' + j.id];
          return '<td><button type="button" class="check' + (si ? ' si' : '') + '" data-acc="pago" data-b="' + b.id + '" data-j="' + j.id +
            '" aria-pressed="' + si + '" aria-label="' + esc(j.apodo) + ' pagó ' + esc(b.nombre) + '"' + (b.cerrada_en ? ' disabled' : '') + '>' +
            (si ? UI.icono('check') : '') + '</button></td>';
        }).join('') + '</tr>';
      }).join('');
      var pie = '<tr><td>Pagaron</td>' + S.bolsas.map(function (b) { return '<td>' + b.pagados + '</td>'; }).join('') + '</tr>' +
        '<tr><td>Bolsa</td>' + S.bolsas.map(function (b) { return '<td>' + UI.dinero(b.total) + '</td>'; }).join('') + '</tr>';
      return '<p class="sub mt">Toca la casilla cuando alguien te pague. Solo compite por una bolsa quien la pagó. La app no cobra: solo lleva la cuenta.</p>' +
        '<section class="card mt"><div class="matriz-wrap"><table class="matriz"><thead>' + head + '</thead><tbody>' + filas +
        '</tbody><tfoot>' + pie + '</tfoot></table></div></section>';
    }

    // ---------- Bolsas ----------
    function tabBolsas() {
      if (!App.torneo) return sinTorneo();
      return '<p class="sub mt">Cierra cada bolsa cuando tenga todos sus resultados: así queda guardada en el Historial con su ganador.</p>' +
        '<div class="lista mt">' + S.bolsas.map(function (b) {
          var filas = S.tabla.filter(function (r) { return r.bolsa_id === b.id; });
          var lideres = b.partidos_jugados ? filas.filter(function (r) { return r.pagado && r.posicion === 1; }) : [];
          var completa = b.partidos_total > 0 && b.partidos_jugados === b.partidos_total;
          var dis = b.cerrada_en ? ' disabled' : '';
          return '<form class="card form" data-bolsa="' + b.id + '" novalidate>' +
            '<div class="bolsa-cab"><div class="bolsa-nom">' + esc(b.nombre) + '</div>' +
            (b.cerrada_en ? '<span class="chip chip-oro">' + UI.icono('candado') + 'Cerrada</span>' : '<span class="chip chip-verde">Abierta</span>') + '</div>' +
            '<div class="campo-linea"><label class="etq" for="m' + b.id + '">Monto</label>' +
            '<input class="input input-sm" id="m' + b.id + '" name="monto" type="number" inputmode="decimal" min="0" step="1" value="' + Number(b.monto) + '"' + dis + '>' +
            '<button type="button" class="btn btn-sm btn-2" data-acc="monto"' + dis + '>Guardar</button></div>' +
            '<p class="sub">' + b.pagados + ' pagaron · bolsa de ' + UI.dinero(b.total) + ' · ' + b.partidos_jugados + ' de ' + b.partidos_total + ' partidos con resultado</p>' +
            (lideres.length ? '<p class="mt">' + (b.cerrada_en ? 'Ganó' : 'Va ganando') + ': <b>' +
              lideres.map(function (r) { return esc(r.apodo); }).join(', ') + '</b> · ' + UI.dinero(lideres[0].premio) + (lideres.length > 1 ? ' c/u' : '') + '</p>' : '') +
            '<div class="acciones">' + (b.cerrada_en
              ? '<button type="button" class="btn btn-sm btn-borde" data-acc="reabrir">Reabrir bolsa</button>'
              : '<button type="button" class="btn btn-sm" data-acc="cerrar"' + (completa ? '' : ' disabled') + '>Cerrar y guardar en historial</button>') +
            '</div>' + (!b.cerrada_en && !completa ? '<p class="ayuda">Se puede cerrar cuando todos sus partidos tengan resultado.</p>' : '') +
            '</form>';
        }).join('') + '</div>';
    }

    // ---------- Jugadores ----------
    function tabJugadores() {
      var js = S.datos.jugadores;
      return '<p class="sub mt">' + js.length + (js.length === 1 ? ' jugador' : ' jugadores') + '. Toca uno para cambiar su nombre, su teléfono o ponerle un NIP nuevo.</p>' +
        '<div class="lista mt">' + js.map(function (j) {
          var abierto = S.jugAbierto === j.id, esYo = j.id === App.yo.id;
          var tags = (j.es_admin ? '<span class="chip chip-verde">Admin</span>' : '') +
            (j.es_prueba ? '<span class="chip chip-gris">Prueba</span>' : '') +
            (!j.activo ? '<span class="chip chip-rojo">Inactivo</span>' : '');
          var form = !abierto ? '' : '<form class="jug-form" data-id="' + j.id + '" novalidate>' +
            '<div class="campo"><label for="ja' + j.id + '">Nombre</label><input class="input" id="ja' + j.id + '" name="apodo" maxlength="20" value="' + esc(j.apodo) + '"></div>' +
            (j.telefono != null ? '<div class="campo"><label for="jt' + j.id + '">Teléfono</label><input class="input" id="jt' + j.id + '" name="tel" type="tel" inputmode="numeric" value="' + esc(j.telefono) + '"></div>' : '') +
            '<label class="switch mt"><input type="checkbox" name="activo"' + (j.activo ? ' checked' : '') + (esYo ? ' disabled' : '') + '> Activo (puede entrar y sale en las tablas)</label>' +
            '<label class="switch"><input type="checkbox" name="admin"' + (j.es_admin ? ' checked' : '') + (esYo ? ' disabled' : '') + '> Es admin</label>' +
            '<p class="error-form" role="alert"></p>' +
            '<button type="submit" class="btn btn-sm">Guardar cambios</button>' +
            (j.telefono != null ? '<div class="campo-linea mt"><input class="input input-sm" name="nip" type="tel" inputmode="numeric" maxlength="4" placeholder="NIP nuevo (4 números)" aria-label="NIP nuevo">' +
              '<button type="button" class="btn btn-sm btn-2" data-acc="nip" data-id="' + j.id + '">Cambiar NIP</button></div>' +
              '<p class="ayuda">Si alguien olvidó su NIP, ponle uno nuevo aquí y díselo.</p>' : '') +
            '</form>';
          return '<div class="card jug">' +
            '<button type="button" class="jug-cab" data-acc="abrir-jug" data-id="' + j.id + '" aria-expanded="' + abierto + '">' + UI.avatar(j.apodo) +
            '<span class="jug-nom">' + esc(j.apodo) + (esYo ? ' (tú)' : '') + '<small>' + (j.telefono ? UI.telBonito(j.telefono) : 'Sin teléfono (jugador de prueba)') + '</small></span>' + tags + '</button>' +
            form + '</div>';
        }).join('') + '</div>';
    }

    // ---------- Grupo ----------
    function tabGrupo() {
      var g = S.datos.grupo, p = S.datos.prueba;
      var link = linkInvitacion(g.codigo);
      var msg = '¡Únete a la quiniela de la Liguilla! ⚽🏆\nEntra aquí, crea tu cuenta con tu número de celular y un NIP de 4 números, y pon tus pronósticos:\n' + link;
      var html = '<section class="card mt"><h3 class="h3">Invitar a la familia</h3>' +
        '<p class="sub">Manda este link por WhatsApp. Al abrirlo, cada quien crea su cuenta con su celular y un NIP.</p>' +
        '<div class="link-caja">' + esc(link) + '</div>' +
        (location.protocol === 'file:' ? '<p class="ayuda aviso mt">Estás abriendo la app desde tu computadora: este link funcionará cuando la subas a Hostinger.</p>' : '') +
        '<div class="acciones"><button type="button" class="btn btn-2" data-acc="copiar">' + UI.icono('copiar') + 'Copiar link</button>' +
        '<a class="btn" target="_blank" rel="noopener" href="https://wa.me/?text=' + encodeURIComponent(msg) + '">' + UI.icono('whatsapp') + 'WhatsApp</a></div>' +
        '<form class="form mt" id="fGrupo" novalidate>' +
          '<div class="campo"><label for="gNombre">Nombre del grupo</label><input class="input" id="gNombre" maxlength="40" value="' + esc(g.nombre) + '"></div>' +
          '<div class="campo"><label for="gCodigo">Código del grupo</label><input class="input" id="gCodigo" maxlength="20" value="' + esc(g.codigo) + '" autocapitalize="characters">' +
          '<span class="ayuda">Va dentro del link. Si lo cambias, el link anterior ya no sirve para registrarse.</span></div>' +
          '<p class="error-form" role="alert"></p><button type="submit" class="btn btn-sm btn-2">Guardar</button></form></section>';

      if (p.jugadores || p.torneos) {
        html += '<section class="card mt aviso-card"><h3 class="h3">Datos de prueba</h3>' +
          '<p class="sub">Hay ' + p.jugadores + ' jugadores y ' + p.torneos + ' torneo de prueba para que veas cómo funciona. ' +
          'Cuando quieras empezar en serio, bórralos y se crea el torneo de verdad con sus 5 bolsas.</p>' +
          '<form class="form mt" id="fPrueba" novalidate><div class="campo"><label for="tReal">Nombre del torneo</label>' +
          '<input class="input" id="tReal" maxlength="60" value="Liguilla Apertura 2026"></div>' +
          '<button type="submit" class="btn btn-peligro btn-bloque">Borrar datos de prueba y empezar</button></form></section>';
      }

      html += '<section class="card mt"><h3 class="h3">Torneos</h3>' + S.datos.torneos.map(function (t) {
        return '<div class="fila-torneo"><span>' + esc(t.nombre) + (t.es_prueba ? ' <small class="muted">(prueba)</small>' : '') + '</span>' +
          (t.activo ? '<span class="chip chip-verde">Activo</span>' : '<button type="button" class="btn btn-sm btn-2" data-acc="activar" data-id="' + t.id + '">Activar</button>') + '</div>';
      }).join('') +
        '<form class="form mt" id="fTorneo" novalidate><div class="campo"><label for="tNuevo">Nuevo torneo</label>' +
        '<input class="input" id="tNuevo" maxlength="60" placeholder="Ej. Liguilla Clausura 2027"></div>' +
        '<p class="error-form" role="alert"></p>' +
        '<button type="submit" class="btn btn-sm btn-2">Crear y activar</button>' +
        '<p class="ayuda mt">Se crea con sus 5 bolsas. Los torneos anteriores quedan en el Historial.</p></form></section>';
      return html;
    }

    // ---------- Acciones ----------
    async function accion(btn, fn, okMsg, recargarBase) {
      UI.ocupado(btn, true, 'Un momento…');
      try {
        await fn();
        if (recargarBase) await App.cargarBase();
        await cargar();
        if (!App.vigente(n)) return true;
        pintar();
        if (okMsg) UI.toast(okMsg);
        return true;
      } catch (e) {
        if (App.manejarError(e)) return false;
        UI.ocupado(btn, false);
        var err = btn && btn.form ? btn.form.querySelector('.error-form') : null;
        if (err) err.textContent = e.message; else UI.toast(e.message, 'error');
        return false;
      }
    }

    async function togglePago(btn) {
      var b = btn.dataset.b, j = btn.dataset.j, si = !btn.classList.contains('si');
      btn.disabled = true;
      try {
        await API.admin.pago(b, j, si);
        if (si) S.pagos.push({ bolsa_id: b, jugador_id: j });
        else S.pagos = S.pagos.filter(function (x) { return !(x.bolsa_id === b && x.jugador_id === j); });
        S.bolsas.forEach(function (x) {
          if (x.id !== b) return;
          x.pagados += si ? 1 : -1;
          x.total = x.pagados * Number(x.monto);
        });
        var w = cont.querySelector('.matriz-wrap'), sl = w ? w.scrollLeft : 0;
        repintarCuerpo();
        var w2 = cont.querySelector('.matriz-wrap');
        if (w2) w2.scrollLeft = sl;
      } catch (e) {
        if (App.manejarError(e)) return;
        btn.disabled = false;
        UI.toast(e.message, 'error');
      }
    }

    function partidoPorId(id) { return S.partidos.filter(function (p) { return p.id === id; })[0]; }
    function bolsaPorId(id) { return S.bolsas.filter(function (b) { return b.id === id; })[0]; }

    cont.onclick = function (ev) {
      var b = ev.target.closest('button[data-acc]');
      if (!b || !cont.contains(b)) return;
      var acc = b.dataset.acc, id = b.dataset.id;
      var formBolsa = b.closest('[data-bolsa]');
      var bolsa = formBolsa ? bolsaPorId(formBolsa.dataset.bolsa) : null;

      if (acc === 'nuevo-partido') {
        var ult = S.partidos[S.partidos.length - 1];
        S.editando = { fase: ult ? ult.fase : 'cuartos', ida_vuelta: ult ? ult.ida_vuelta : 'ida' };
        repintarCuerpo();
        document.getElementById('pLocal').focus();
      } else if (acc === 'editar-partido') {
        var p = partidoPorId(id);
        if (!p) return;
        S.editando = { id: p.id, fase: p.fase, ida_vuelta: p.ida_vuelta, local: p.local, visitante: p.visitante, inicio: p.inicio };
        repintarCuerpo();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else if (acc === 'cancelar-partido') {
        S.editando = null;
        repintarCuerpo();
      } else if (acc === 'borrar-partido') {
        var pb = partidoPorId(id);
        if (pb && window.confirm('¿Borrar ' + App.equipo(pb.local).nombre + ' vs ' + App.equipo(pb.visitante).nombre + '? También se borran sus pronósticos.')) {
          accion(b, function () { return API.admin.borrarPartido(id); }, 'Partido borrado');
        }
      } else if (acc === 'editar-equipo') {
        var e = App.equipos[id];
        if (!e) return;
        document.getElementById('eId').value = e.id;
        document.getElementById('eNombre').value = e.nombre;
        document.getElementById('eColor').value = e.color.toLowerCase();
        document.getElementById('eTexto').value = e.texto.toLowerCase();
        document.getElementById('eNombre').focus();
      } else if (acc === 'quitar-resultado') {
        if (window.confirm('¿Quitar el resultado de este partido? Sus puntos se borran hasta que lo vuelvas a capturar.')) {
          accion(b, function () { return API.admin.resultado(id, null, null); }, 'Resultado quitado');
        }
      } else if (acc === 'pago') {
        togglePago(b);
      } else if (acc === 'monto' && bolsa) {
        var v = Number(formBolsa.querySelector('[name=monto]').value);
        if (!(v >= 0)) { UI.toast(API.mensaje('MONTO_INVALIDO'), 'error'); return; }
        accion(b, function () { return API.admin.monto(bolsa.id, v); }, 'Monto actualizado');
      } else if (acc === 'cerrar' && bolsa) {
        var filas = S.tabla.filter(function (r) { return r.bolsa_id === bolsa.id && r.pagado && r.posicion === 1; });
        var quien = filas.length ? '\n\nGana' + (filas.length > 1 ? 'n' : '') + ': ' + filas.map(function (r) { return r.apodo; }).join(', ') +
          ' — ' + UI.dinero(filas[0].premio) + (filas.length > 1 ? ' cada quien' : '') : '';
        if (window.confirm('¿Cerrar "' + bolsa.nombre + '"?' + quien + '\n\nQuedará guardada en el Historial.')) {
          accion(b, function () { return API.admin.cerrarBolsa(bolsa.id); }, 'Bolsa cerrada y guardada en el historial');
        }
      } else if (acc === 'reabrir' && bolsa) {
        if (window.confirm('¿Reabrir "' + bolsa.nombre + '"? Se quita del Historial hasta que la vuelvas a cerrar.')) {
          accion(b, function () { return API.admin.reabrirBolsa(bolsa.id); }, 'Bolsa reabierta');
        }
      } else if (acc === 'abrir-jug') {
        S.jugAbierto = S.jugAbierto === id ? null : id;
        repintarCuerpo();
      } else if (acc === 'nip') {
        var f = b.closest('form');
        var nip = f.querySelector('[name=nip]').value.trim();
        if (!/^\d{4}$/.test(nip)) { f.querySelector('.error-form').textContent = API.mensaje('NIP_INVALIDO'); return; }
        accion(b, function () { return API.admin.nip(id, nip); }, 'NIP cambiado. Díselo a la persona.');
      } else if (acc === 'copiar') {
        copiar(linkInvitacion(S.datos.grupo.codigo)).then(function () { UI.toast('Link copiado'); }, function () { UI.toast('No se pudo copiar; selecciónalo y cópialo a mano', 'error'); });
      } else if (acc === 'activar') {
        accion(b, function () { return API.admin.activarTorneo(id); }, 'Torneo activado', true);
      }
    };

    cont.onsubmit = function (ev) {
      ev.preventDefault();
      var f = ev.target, btn = f.querySelector('[type=submit]');
      var err = f.querySelector('.error-form');
      if (err) err.textContent = '';

      if (f.id === 'fPartido') {
        var datos = {
          id: S.editando && S.editando.id,
          fase: f.querySelector('#pFase').value,
          ida_vuelta: f.querySelector('#pIv').value,
          local: f.querySelector('#pLocal').value,
          visitante: f.querySelector('#pVisita').value,
          inicio: f.querySelector('#pInicio').value
        };
        if (!datos.local || !datos.visitante) { err.textContent = API.mensaje('EQUIPO_INVALIDO'); return; }
        if (datos.local === datos.visitante) { err.textContent = API.mensaje('EQUIPOS_IGUALES'); return; }
        if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(datos.inicio)) { err.textContent = API.mensaje('FECHA_INVALIDA'); return; }
        accion(btn, async function () { await API.admin.guardarPartido(datos); S.editando = null; }, 'Partido guardado');
      } else if (f.classList.contains('res-form')) {
        var gl = f.querySelector('[name=gl]').value, gv = f.querySelector('[name=gv]').value;
        if (!/^\d{1,2}$/.test(gl) || !/^\d{1,2}$/.test(gv) || Number(gl) > 30 || Number(gv) > 30) {
          UI.toast('Escribe los goles de los dos equipos', 'error');
          return;
        }
        accion(btn, function () { return API.admin.resultado(f.dataset.id, Number(gl), Number(gv)); }, 'Resultado guardado. Puntos calculados.');
      } else if (f.id === 'fEquipo') {
        var eq = {
          id: f.querySelector('#eId').value.trim().toUpperCase(),
          nombre: f.querySelector('#eNombre').value.trim(),
          color: f.querySelector('#eColor').value,
          texto: f.querySelector('#eTexto').value
        };
        accion(btn, function () { return API.admin.equipo(eq); }, 'Equipo guardado').then(function (ok) {
          if (ok) { var d = document.getElementById('detEquipos'); if (d) d.open = true; }
        });
      } else if (f.classList.contains('jug-form')) {
        var j = S.datos.jugadores.filter(function (x) { return x.id === f.dataset.id; })[0];
        if (!j) return;
        var nuevo = {
          id: j.id,
          apodo: f.querySelector('[name=apodo]').value.trim(),
          telefono: f.querySelector('[name=tel]') ? f.querySelector('[name=tel]').value : '',
          activo: f.querySelector('[name=activo]').checked,
          es_admin: f.querySelector('[name=admin]').checked
        };
        accion(btn, async function () {
          await API.admin.jugador(nuevo);
          if (j.id === App.yo.id) { App.yo.apodo = nuevo.apodo; document.getElementById('topYo').innerHTML = UI.avatar(nuevo.apodo); }
        }, 'Cambios guardados');
      } else if (f.id === 'fGrupo') {
        var nombre = f.querySelector('#gNombre').value, codigo = f.querySelector('#gCodigo').value;
        accion(btn, function () { return API.admin.grupo(nombre, codigo); }, 'Grupo actualizado');
      } else if (f.id === 'fPrueba') {
        var real = f.querySelector('#tReal').value.trim();
        if (window.confirm('¿Borrar todos los datos de prueba y empezar "' + (real || 'el torneo') + '"? Esto no se puede deshacer.')) {
          accion(btn, function () { return API.admin.borrarPrueba(real); }, 'Listo: datos de prueba borrados', true);
        }
      } else if (f.id === 'fTorneo') {
        var nt = f.querySelector('#tNuevo').value.trim();
        if (nt.length < 2) { err.textContent = API.mensaje('NOMBRE_INVALIDO'); return; }
        if (window.confirm('¿Crear "' + nt + '" y dejarlo como torneo activo?')) {
          accion(btn, function () { return API.admin.nuevoTorneo(nt); }, 'Torneo creado', true);
        }
      }
    };

    pintar();
  };
})();
