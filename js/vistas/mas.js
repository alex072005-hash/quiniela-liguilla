// Más (menú) y Mi perfil
(function () {
  'use strict';
  window.Vistas = window.Vistas || {};

  function item(href, ico, titulo, sub, extra) {
    return '<a class="menu-item' + (extra || '') + '" href="' + href + '">' + UI.icono(ico) +
      '<span class="menu-txt">' + titulo + (sub ? '<small>' + sub + '</small>' : '') + '</span><span class="flecha" aria-hidden="true">›</span></a>';
  }

  Vistas.mas = async function (cont) {
    cont.innerHTML = '<div class="cabeza-vista"><h1 class="h1">Más</h1></div>' +
      '<nav class="card menu">' +
        item('#/historial', 'historial', 'Historial', 'Resultado final de cada fase') +
        item('#/perfil', 'usuario', 'Mi perfil', 'Cambiar mi nombre o mi NIP') +
        (App.yo.es_admin ? item('#/admin', 'ajustes', 'Admin', 'Partidos, resultados, pagos e invitaciones') : '') +
        (App.yo.es_admin ? item('#/admin/grupo', 'whatsapp', 'Invitar a la familia', 'Link para mandar por WhatsApp') : '') +
      '</nav>' +
      '<h2 class="h2">Cómo se juega</h2>' +
      '<section class="card"><ul class="pasos">' +
        '<li>Pronostica el <b>marcador a 90 minutos</b> de cada partido.</li>' +
        '<li>Puedes cambiarlo hasta que empiece el partido; luego se cierra con candado.</li>' +
        '<li><b>4 puntos</b> si atinas el marcador exacto; <b>3 puntos</b> si solo atinas quién gana (o el empate).</li>' +
        '<li>Hay 5 bolsas: cuartos ida, cuartos vuelta, semis, final y la general. Solo compites en las que pagaste.</li>' +
        '<li>Si hay empate en puntos, la bolsa se reparte en partes iguales.</li>' +
        '<li>Todos ven lo que puso cada quien en cuanto empieza el partido.</li>' +
      '</ul></section>' +
      '<details class="card mt"><summary>Ponerla en la pantalla de tu celular</summary>' +
        '<ul class="pasos">' +
          '<li><b>iPhone:</b> abre el link en Safari › botón Compartir (cuadro con flecha) › “Agregar a pantalla de inicio”.</li>' +
          '<li><b>Android:</b> abre el link en Chrome › menú ⋮ › “Agregar a la pantalla principal” o “Instalar app”.</li>' +
          '<li>La primera vez que la abras desde el ícono, entra con tu número y NIP. Después ya se queda guardada.</li>' +
        '</ul></details>' +
      '<nav class="card menu mt"><button type="button" class="menu-item peligro" id="btnSalir">' + UI.icono('salir') +
        '<span class="menu-txt">Cerrar sesión<small>Solo en este celular</small></span></button></nav>';
    document.getElementById('btnSalir').onclick = function () {
      if (window.confirm('¿Cerrar sesión en este celular? Para volver a entrar necesitas tu número y tu NIP.')) App.cerrarSesion();
    };
  };

  Vistas.perfil = async function (cont) {
    cont.innerHTML = '<div class="cabeza-vista"><h1 class="h1">Mi perfil</h1>' +
      '<p class="sub">Tu sesión se queda guardada en este celular.</p></div>' +
      '<form class="card form mt" id="fApodo" novalidate><h3 class="h3">Mi nombre</h3>' +
        '<div class="campo"><label for="apodo">Así te ven los demás</label>' +
        '<input class="input" id="apodo" maxlength="20" value="' + UI.esc(App.yo.apodo) + '"></div>' +
        '<p class="error-form" role="alert"></p><button class="btn btn-bloque" type="submit">Guardar nombre</button></form>' +
      '<form class="card form mt" id="fNip" novalidate><h3 class="h3">Cambiar NIP</h3>' +
        '<div class="dos"><div class="campo"><label for="nipActual">NIP actual</label>' +
        '<input class="input" id="nipActual" type="password" inputmode="numeric" maxlength="4" autocomplete="current-password"></div>' +
        '<div class="campo"><label for="nipNuevo">NIP nuevo</label>' +
        '<input class="input" id="nipNuevo" type="password" inputmode="numeric" maxlength="4" autocomplete="new-password"></div></div>' +
        '<p class="error-form" role="alert"></p><button class="btn btn-2 btn-bloque" type="submit">Cambiar NIP</button></form>' +
      '<nav class="card menu mt"><button type="button" class="menu-item peligro" id="btnSalir">' + UI.icono('salir') +
        '<span class="menu-txt">Cerrar sesión<small>Solo en este celular</small></span></button></nav>';

    document.getElementById('btnSalir').onclick = function () {
      if (window.confirm('¿Cerrar sesión en este celular? Para volver a entrar necesitas tu número y tu NIP.')) App.cerrarSesion();
    };

    cont.onsubmit = async function (ev) {
      ev.preventDefault();
      var f = ev.target, err = f.querySelector('.error-form'), btn = f.querySelector('[type=submit]');
      err.textContent = '';
      if (f.id === 'fApodo') {
        var apodo = f.querySelector('#apodo').value.trim();
        if (apodo.length < 2) { err.textContent = API.mensaje('APODO_INVALIDO'); return; }
        UI.ocupado(btn, true, 'Guardando…');
        try {
          var r = await API.cambiarApodo(apodo);
          App.yo.apodo = r.apodo;
          document.getElementById('topYo').innerHTML = UI.avatar(r.apodo);
          UI.toast('Nombre actualizado');
        } catch (e) { if (App.manejarError(e)) return; err.textContent = e.message; }
        UI.ocupado(btn, false);
      } else {
        var actual = f.querySelector('#nipActual').value.trim(), nuevo = f.querySelector('#nipNuevo').value.trim();
        if (!/^\d{4}$/.test(actual) || !/^\d{4}$/.test(nuevo)) { err.textContent = API.mensaje('NIP_INVALIDO'); return; }
        UI.ocupado(btn, true, 'Guardando…');
        try {
          await API.cambiarNip(actual, nuevo);
          f.reset();
          UI.toast('NIP cambiado');
        } catch (e) { if (App.manejarError(e)) return; err.textContent = e.message; }
        UI.ocupado(btn, false);
      }
    };
  };
})();
