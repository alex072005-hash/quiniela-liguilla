// Entrar / Crear cuenta (celular + NIP de 4 dígitos)
(function () {
  'use strict';
  window.Vistas = window.Vistas || {};

  function soloDigitos(s) { return String(s || '').replace(/\D/g, ''); }

  function campoNip(id, etiqueta, ayuda, auto) {
    return '<div class="campo"><label for="' + id + '">' + etiqueta + '</label>' +
      '<div class="input-nip"><input class="input" id="' + id + '" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="4" autocomplete="' + auto + '" placeholder="••••" required>' +
      '<button type="button" class="ver-nip" data-ver="' + id + '">Ver</button></div>' +
      (ayuda ? '<span class="ayuda">' + ayuda + '</span>' : '') + '</div>';
  }

  function campoTel(ayuda) {
    return '<div class="campo"><label for="tel">Tu número de celular</label>' +
      '<input class="input" id="tel" type="tel" inputmode="numeric" autocomplete="tel-national" placeholder="81 1234 5678" maxlength="16" required>' +
      (ayuda ? '<span class="ayuda">' + ayuda + '</span>' : '') + '</div>';
  }

  Vistas.entrar = async function (cont, opts, n) {
    var modo = opts.modo;
    var info = null;

    function formEntrar() {
      return '<form class="card form" id="fEntrar" novalidate>' +
        campoTel('') +
        campoNip('nip', 'Tu NIP (4 números)', '', 'current-password') +
        '<p class="error-form" role="alert"></p>' +
        '<button class="btn btn-bloque" type="submit">Entrar</button>' +
        '<p class="ayuda centro mt">¿Olvidaste tu NIP? Pídele a quien organiza que te ponga uno nuevo.</p>' +
        '</form>';
    }

    function formRegistro() {
      var primero = info && info.hay_admin === false;
      var codigoCampo;
      if (primero) codigoCampo = '<p class="ok-codigo">' + UI.icono('estrella') + 'Eres el primero: tu cuenta será la del admin.</p>';
      else if (App.codigo) codigoCampo = '<p class="ok-codigo">' + UI.icono('check') + 'Te invitaron al grupo</p>';
      else codigoCampo = '<div class="campo"><label for="codigo">Código del grupo</label>' +
        '<input class="input" id="codigo" autocapitalize="characters" autocomplete="off" placeholder="Te lo pasa quien organiza" required></div>';
      return '<form class="card form" id="fRegistro" novalidate>' +
        codigoCampo +
        '<div class="campo"><label for="apodo">¿Cómo te van a ver los demás?</label>' +
        '<input class="input" id="apodo" maxlength="20" autocomplete="nickname" placeholder="Ej. Papá, Tía Lupe, Memo" required>' +
        '<span class="ayuda">Tu nombre o apodo. No se puede repetir en el grupo.</span></div>' +
        campoTel('Con este número vas a entrar. Solo lo ve quien organiza.') +
        campoNip('nip', 'Inventa un NIP de 4 números', 'Como el de tu tarjeta. Si lo olvidas, quien organiza te pone uno nuevo.', 'new-password') +
        '<p class="error-form" role="alert"></p>' +
        '<button class="btn btn-bloque" type="submit">Crear mi cuenta</button>' +
        '</form>';
    }

    function pintar() {
      if (info && info.hay_admin === false) modo = 'registro';
      cont.innerHTML =
        '<section class="entrar">' +
          '<div class="entrar-hero">' + UI.logo('entrar-logo') +
            '<h1 class="entrar-titulo">Quiniela<br><span>Liguilla</span></h1>' +
            '<p class="sub">' + UI.esc((info && info.nombre) || 'Liga MX') + '</p>' +
          '</div>' +
          (info && info.hay_admin === false ? '' :
            '<div class="seg seg-full" role="tablist">' +
              '<button type="button" role="tab" data-modo="entrar" aria-selected="' + (modo === 'entrar') + '" class="' + (modo === 'entrar' ? 'activo' : '') + '">Ya tengo cuenta</button>' +
              '<button type="button" role="tab" data-modo="registro" aria-selected="' + (modo === 'registro') + '" class="' + (modo === 'registro' ? 'activo' : '') + '">Soy nuevo</button>' +
            '</div>') +
          (modo === 'registro' ? formRegistro() : formEntrar()) +
          '<p class="ayuda centro">Tu sesión se queda guardada en este celular: no tendrás que volver a entrar.</p>' +
        '</section>';
    }

    // Repinta sin perder lo que la persona ya escribió
    function repintar() {
      var v = {};
      Array.prototype.forEach.call(cont.querySelectorAll('input'), function (i) { v[i.id] = i.value; });
      pintar();
      Object.keys(v).forEach(function (k) { var i = document.getElementById(k); if (i && v[k]) i.value = v[k]; });
    }

    cont.onclick = function (ev) {
      var b = ev.target.closest('button');
      if (!b) return;
      if (b.dataset.modo && b.dataset.modo !== modo) { modo = b.dataset.modo; repintar(); return; }
      if (b.dataset.ver) {
        var inp = document.getElementById(b.dataset.ver);
        var ver = inp.type === 'password';
        inp.type = ver ? 'text' : 'password';
        b.textContent = ver ? 'Ocultar' : 'Ver';
      }
    };

    cont.onsubmit = async function (ev) {
      ev.preventDefault();
      var f = ev.target;
      var err = f.querySelector('.error-form');
      var btn = f.querySelector('[type=submit]');
      var tel = f.querySelector('#tel').value;
      var nip = f.querySelector('#nip').value.trim();
      err.textContent = '';
      if (soloDigitos(tel).length < 10) { err.textContent = API.mensaje('TELEFONO_INVALIDO'); return; }
      if (!/^\d{4}$/.test(nip)) { err.textContent = API.mensaje('NIP_INVALIDO'); return; }

      if (f.id === 'fEntrar') {
        UI.ocupado(btn, true, 'Entrando…');
        try {
          var res = await API.entrar(tel, nip);
          if (res && res.error) { err.textContent = API.mensaje(res.error); UI.ocupado(btn, false); return; }
          await App.iniciarSesion(res);
          UI.toast('¡Bienvenido, ' + res.jugador.apodo + '!');
        } catch (e) { err.textContent = e.message; UI.ocupado(btn, false); }
        return;
      }

      var apodo = f.querySelector('#apodo').value.trim();
      var campoCodigo = f.querySelector('#codigo');
      var codigo = campoCodigo ? campoCodigo.value.trim() : (App.codigo || '');
      if (apodo.length < 2) { err.textContent = API.mensaje('APODO_INVALIDO'); return; }
      if (campoCodigo && !codigo) { err.textContent = 'Escribe el código del grupo.'; return; }
      UI.ocupado(btn, true, 'Creando tu cuenta…');
      try {
        var r = await API.registrar(codigo, tel, nip, apodo);
        await App.iniciarSesion(r);
        UI.toast('¡Listo, ' + r.jugador.apodo + '! Ya estás en la quiniela.');
      } catch (e) {
        UI.ocupado(btn, false);
        if (e.codigo === 'CODIGO_INVALIDO' && !campoCodigo) {
          // El código del link ya no sirve: mostrar el campo para escribirlo
          App.codigo = null;
          try { localStorage.removeItem('quiniela.codigo'); } catch (_) { /* nada */ }
          repintar();
          cont.querySelector('.error-form').textContent = e.message;
          return;
        }
        err.textContent = e.message;
      }
    };

    pintar();
    try {
      info = await API.infoGrupo();
      if (App.vigente(n)) repintar();
    } catch (_) { /* si falla, la pantalla ya está pintada */ }
  };
})();
