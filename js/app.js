// =====================================================================
//  App: arranque, sesión guardada, rutas (#/...) y navegación
// =====================================================================
(function () {
  'use strict';

  window.Vistas = window.Vistas || {};
  var App = window.App = {
    yo: null,          // { id, apodo, es_admin }
    torneo: null,      // torneo activo
    equipos: {},       // id → equipo
    codigo: null,      // código de invitación que llegó en el link
    n: 0,              // número de render (para ignorar respuestas viejas)
    salirGuard: null,  // función: true si hay cambios sin guardar
    alTick: null       // función que corre cada 30 s en la vista actual
  };

  var NAV = [
    { ruta: 'inicio', txt: 'Inicio', ico: 'casa' },
    { ruta: 'pronosticos', txt: 'Pronósticos', ico: 'balon' },
    { ruta: 'bolsas', txt: 'Bolsas', ico: 'trofeo' },
    { ruta: 'general', txt: 'General', ico: 'podio' },
    { ruta: 'mas', txt: 'Más', ico: 'puntos' }
  ];
  var PESTANA_DE = { partido: 'pronosticos', historial: 'mas', perfil: 'mas', admin: 'mas' };

  App.vigente = function (n) { return n === App.n; };
  App.equipo = function (id) {
    return App.equipos[id] || { id: id, nombre: id, color: '#26352d', texto: '#ffffff' };
  };

  function ruta() {
    var h = (location.hash || '').replace(/^#\/?/, '');
    var partes = h.split('/').filter(Boolean).map(function (x) {
      try { return decodeURIComponent(x); } catch (_) { return x; }
    });
    return { nombre: partes[0] || 'inicio', params: partes.slice(1) };
  }

  function guardarLocal(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (_) { /* nada */ } }
  function leerLocal(k) { try { return localStorage.getItem(k); } catch (_) { return null; } }

  function capturarCodigo() {
    var r = ruta();
    var c = r.nombre === 'registro' && r.params[0] ? r.params[0] : null;
    var m = /[?&]c=([^&#]+)/.exec(location.search);
    if (!c && m) { try { c = decodeURIComponent(m[1]); } catch (_) { c = m[1]; } }
    if (c) { App.codigo = String(c).toUpperCase(); guardarLocal('quiniela.codigo', App.codigo); }
    else App.codigo = leerLocal('quiniela.codigo');
  }

  function vista() { return document.getElementById('vista'); }

  function pintarNav(actual) {
    var tab = PESTANA_DE[actual] || actual;
    document.getElementById('nav').innerHTML = NAV.map(function (it) {
      var act = it.ruta === tab;
      return '<a href="#/' + it.ruta + '"' + (act ? ' class="activo" aria-current="page"' : '') + '>' +
        UI.icono(it.ico) + '<span>' + it.txt + '</span></a>';
    }).join('');
  }

  function pintarTop() {
    var t = App.torneo;
    document.getElementById('topSub').textContent = t ? t.nombre : 'Sin torneo activo';
    document.getElementById('topYo').innerHTML = App.yo ? UI.avatar(App.yo.apodo) : '';
  }

  App.cargarBase = async function () {
    var r = await Promise.all([API.torneoActivo(), API.equipos()]);
    App.torneo = r[0];
    App.equipos = {};
    r[1].forEach(function (e) { App.equipos[e.id] = e; });
    pintarTop();
  };

  App.render = async function () {
    var r = ruta();
    var n = ++App.n;
    var cont = vista();
    App.alTick = null;
    App.salirGuard = null;
    cont.onclick = cont.onsubmit = cont.onchange = cont.oninput = null;

    if (!App.yo) {
      capturarCodigo();
      document.body.classList.add('sin-sesion');
      try { await Vistas.entrar(cont, { modo: r.nombre === 'registro' ? 'registro' : 'entrar' }, n); }
      catch (e) { if (App.vigente(n)) cont.innerHTML = UI.errorVista(e); }
      return;
    }
    document.body.classList.remove('sin-sesion');
    if (r.nombre === 'registro' || r.nombre === 'entrar') { location.replace('#/inicio'); return; }
    var fn = Vistas[r.nombre];
    if (!fn || r.nombre === 'entrar' || (r.nombre === 'admin' && !App.yo.es_admin)) { location.replace('#/inicio'); return; }

    pintarNav(r.nombre);
    cont.innerHTML = UI.cargando();
    window.scrollTo(0, 0);
    try { await fn(cont, r.params, n); }
    catch (e) {
      if (App.manejarError(e)) return;
      if (App.vigente(n)) cont.innerHTML = UI.errorVista(e);
    }
  };

  // Si el servidor dice que la sesión ya no sirve, regresa a la pantalla de entrar
  App.manejarError = function (e) {
    if (e && e.codigo === 'SESION_INVALIDA') {
      API.borrarToken();
      App.yo = null;
      UI.toast(API.mensaje('SESION_INVALIDA'), 'error');
      App.reemplazar('#/entrar');
      return true;
    }
    return false;
  };

  App.ir = function (h) { if (location.hash === h) App.render(); else location.hash = h; };
  App.reemplazar = function (h) {
    if (location.hash === h) { App.render(); return; }
    ignorarSiguiente = true;
    location.replace(h);
    hashPrevio = location.hash;
    App.render();
  };

  App.iniciarSesion = async function (res) {
    API.guardarToken(res.token);
    App.yo = res.jugador;
    guardarLocal('quiniela.codigo', null);
    App.codigo = null;
    await App.cargarBase();
    App.reemplazar('#/inicio');
  };

  App.cerrarSesion = async function () {
    try { await API.salir(); } catch (_) { /* aunque falle, se cierra aquí */ }
    API.borrarToken();
    App.yo = null;
    App.reemplazar('#/entrar');
  };

  // ---------- Cambios de pantalla (con aviso si hay pronósticos sin guardar) ----------
  var hashPrevio = location.hash;
  var ignorarSiguiente = false;
  function alCambiarHash() {
    if (ignorarSiguiente) { ignorarSiguiente = false; return; }
    if (App.salirGuard && App.salirGuard() &&
        !window.confirm('Tienes pronósticos sin guardar. ¿Salir sin guardarlos?')) {
      ignorarSiguiente = true;
      location.hash = hashPrevio;
      return;
    }
    hashPrevio = location.hash;
    App.render();
  }

  // Avisar también si cierran la pestaña con cambios sin guardar
  window.addEventListener('beforeunload', function (ev) {
    if (App.salirGuard && App.salirGuard()) { ev.preventDefault(); ev.returnValue = ''; }
  });

  // Al volver a la app (después de un rato), refrescar los datos
  var ocultoDesde = 0;
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { ocultoDesde = Date.now(); return; }
    if (App.yo && ocultoDesde && Date.now() - ocultoDesde > 60000 && !(App.salirGuard && App.salirGuard())) {
      App.cargarBase().then(App.render).catch(function () { /* sin red: se queda como está */ });
    }
  });

  // Cuentas regresivas
  setInterval(function () {
    var els = document.querySelectorAll('[data-cuenta]');
    for (var i = 0; i < els.length; i++) els[i].textContent = UI.cuenta(els[i].getAttribute('data-cuenta'));
    if (typeof App.alTick === 'function') App.alTick();
  }, 30000);

  function pantallaSimple(html) {
    document.body.classList.add('sin-sesion');
    vista().innerHTML = '<section class="entrar"><div class="entrar-hero">' + UI.logo('entrar-logo') +
      '<h1 class="entrar-titulo">Quiniela<br><span>Liguilla</span></h1></div>' + html + '</section>';
  }

  async function arrancar() {
    capturarCodigo();
    if (!API.configurado()) {
      pantallaSimple('<div class="card"><b>Falta conectar la base de datos.</b><p class="sub mt">Abre <code>js/config.js</code> y pega la URL y la llave pública de tu proyecto de Supabase (el README explica dónde encontrarlas).</p></div>');
      return;
    }
    if (API.token()) {
      try {
        var yo = await API.yo();
        if (yo) App.yo = yo; else API.borrarToken();
      } catch (e) {
        pantallaSimple('<div class="card centro"><b>No hay conexión</b><p class="sub mt">Revisa tu internet e intenta otra vez.</p>' +
          '<button class="btn btn-bloque mt" type="button" onclick="location.reload()">Reintentar</button></div>');
        return;
      }
    }
    if (App.yo) {
      try { await App.cargarBase(); }
      catch (e) {
        pantallaSimple('<div class="card centro"><b>No se pudo cargar</b><p class="sub mt">' + UI.esc(e.message) + '</p>' +
          '<button class="btn btn-bloque mt" type="button" onclick="location.reload()">Reintentar</button></div>');
        return;
      }
    }
    window.addEventListener('hashchange', alCambiarHash);
    App.render();
  }

  arrancar();
})();
