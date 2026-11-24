// Mis pronósticos: marcador con botones +/−, se guarda por partido, candado al iniciar
(function () {
  'use strict';
  window.Vistas = window.Vistas || {};

  var FASES = ['cuartos', 'semis', 'final'];

  Vistas.pronosticos = async function (cont, params, n) {
    var t = App.torneo;
    if (!t) { cont.innerHTML = UI.sinTorneo(); return; }

    var d = await Promise.all([API.partidos(t.id), API.misPronosticos(t.id)]);
    if (!App.vigente(n)) return;
    var partidos = d[0];
    var mapa = {}, est = {}, cerradoServidor = {}, cerradoPintado = {};
    partidos.forEach(function (p) { mapa[p.id] = p; est[p.id] = { gl: 0, gv: 0, g: null, tocado: false, guardando: false }; });
    (d[1] || []).forEach(function (m) {
      if (!est[m.partido_id]) return;
      est[m.partido_id].gl = m.goles_local;
      est[m.partido_id].gv = m.goles_visitante;
      est[m.partido_id].g = { gl: m.goles_local, gv: m.goles_visitante };
    });

    function cerrado(p) { return !!cerradoServidor[p.id] || new Date(p.inicio).getTime() <= Date.now(); }
    function sucio(id) { var e = est[id]; return !e.g || e.gl !== e.g.gl || e.gv !== e.g.gv; }
    function pendientes() {
      return partidos.filter(function (p) { return !cerrado(p) && est[p.id].tocado && sucio(p.id); });
    }

    var fase = FASES.indexOf(params[0]) >= 0 ? params[0] : (function () {
      var prox = partidos.filter(function (p) { return !cerrado(p); })[0];
      if (prox) return prox.fase;
      var ult = partidos[partidos.length - 1];
      return ult ? ult.fase : 'cuartos';
    })();

    function filaEquipo(p, eq, lado, c) {
      var e = est[p.id];
      var valor = lado === 'l' ? e.gl : e.gv;
      var control;
      if (c) {
        control = '<span class="pron-gol">' + (e.g ? (lado === 'l' ? e.g.gl : e.g.gv) : '–') + '</span>';
      } else {
        control = '<div class="stepper">' +
          '<button type="button" data-acc="menos" data-lado="' + lado + '" aria-label="Quitar un gol a ' + UI.esc(eq.nombre) + '"' + (valor <= 0 ? ' disabled' : '') + '>−</button>' +
          '<output aria-label="Goles de ' + UI.esc(eq.nombre) + '">' + valor + '</output>' +
          '<button type="button" data-acc="mas" data-lado="' + lado + '" aria-label="Sumar un gol a ' + UI.esc(eq.nombre) + '"' + (valor >= 20 ? ' disabled' : '') + '>+</button>' +
          '</div>';
      }
      return '<div class="pron-eq">' + UI.escudo(eq) + '<span class="pron-nombre">' + UI.esc(eq.nombre) + '</span>' + control + '</div>';
    }

    function tarjeta(p) {
      var e = est[p.id];
      var c = cerrado(p);
      cerradoPintado[p.id] = c;
      var L = App.equipo(p.local), V = App.equipo(p.visitante);
      var res = p.goles_local != null;
      var top = '<div class="pron-top"><span>' + UI.IV[p.ida_vuelta] + ' · ' + UI.fecha(p.inicio) + '</span>' +
        (c ? '<span class="chip chip-gris">' + UI.icono('candado') + 'Cerrado</span>'
           : '<span class="chip chip-tiempo">' + UI.icono('reloj') + 'Cierra&nbsp;<span data-cuenta="' + p.inicio + '">' + UI.cuenta(p.inicio) + '</span></span>') +
        '</div>';
      var pie;
      if (c) {
        var pts = res && e.g ? UI.puntos(e.g.gl, e.g.gv, p.goles_local, p.goles_visitante) : null;
        pie = '<div class="pron-pie">' +
          (res ? '<span>Final <b class="num">' + p.goles_local + '–' + p.goles_visitante + '</b></span>' +
                 (e.g ? UI.chipPuntos(pts) : '<span class="chip chip-gris">No pronosticaste</span>')
               : '<span class="muted">' + (e.g ? 'Esperando resultado' : 'No pronosticaste') + '</span>') +
          '<a class="link" href="#/partido/' + p.id + '">Ver todos ›</a></div>';
      } else {
        var s = sucio(p.id);
        var txt = !e.g ? (e.tocado ? 'Sin guardar' : 'Sin pronóstico') : (s ? 'Sin guardar' : 'Guardado');
        pie = '<div class="pron-pie"><span class="pron-estado ' + (s ? 'pend' : 'ok') + '">' + (s ? '' : UI.icono('check')) + txt + '</span>' +
          '<button type="button" class="btn btn-sm" data-acc="guardar"' + (!s || e.guardando ? ' disabled' : '') + '>' +
          (e.guardando ? 'Guardando…' : (s ? 'Guardar' : 'Guardado')) + '</button></div>';
      }
      var cls = 'pron card' + (c ? ' cerrado' : '') + (!e.g && !e.tocado && !c ? ' sin' : '');
      return '<article class="' + cls + '" data-id="' + p.id + '">' + top +
        filaEquipo(p, L, 'l', c) + filaEquipo(p, V, 'v', c) + pie + '</article>';
    }

    function repintar(id, foco) {
      var el = cont.querySelector('.pron[data-id="' + id + '"]');
      if (!el) return;
      el.outerHTML = tarjeta(mapa[id]);
      if (foco) {
        var nuevo = cont.querySelector('.pron[data-id="' + id + '"] ' + foco);
        if (nuevo && !nuevo.disabled) nuevo.focus({ preventScroll: true });
      }
    }

    function pintarTabs() {
      var el = document.getElementById('tabsFase');
      if (!el) return;
      el.innerHTML = FASES.map(function (f) {
        var falt = partidos.filter(function (p) { return p.fase === f && !cerrado(p) && !est[p.id].g; }).length;
        return '<button type="button" role="tab" data-fase="' + f + '" aria-selected="' + (f === fase) + '" class="' + (f === fase ? 'activo' : '') + '">' +
          UI.FASE_CORTA[f] + (falt ? '<span class="badge" aria-label="' + falt + ' sin pronóstico">' + falt + '</span>' : '') + '</button>';
      }).join('');
    }

    function pintarBarra() {
      var el = document.getElementById('barraGuardar');
      if (!el) return;
      var k = pendientes().length;
      el.innerHTML = k < 2 ? '' : '<div class="card"><span>' + k + ' cambios sin guardar</span>' +
        '<button type="button" class="btn btn-sm" id="guardarTodo">Guardar todos</button></div>';
    }

    function pintar() {
      var lista = partidos.filter(function (p) { return p.fase === fase; });
      var cuerpo;
      if (!lista.length) {
        cuerpo = '<div class="card mt">' + UI.vacio('Todavía no hay partidos de ' + UI.FASE[fase].toLowerCase(),
          'Se cargan cuando se conozcan los cruces.', 'calendario') + '</div>';
      } else {
        cuerpo = ['ida', 'vuelta'].map(function (iv) {
          var ps = lista.filter(function (p) { return p.ida_vuelta === iv; });
          if (!ps.length) return '';
          return '<h2 class="h2">Partidos de ' + iv + '</h2><div class="lista">' + ps.map(tarjeta).join('') + '</div>';
        }).join('');
      }
      cont.innerHTML = '<div class="cabeza-vista"><h1 class="h1">Mis pronósticos</h1>' +
        '<p class="sub">Marcador a 90 minutos · exacto = 4 pts · solo resultado = 3 pts</p></div>' +
        '<div class="seg" role="tablist" id="tabsFase"></div>' +
        '<div class="barra-guardar" id="barraGuardar"></div>' + cuerpo;
      pintarTabs();
      pintarBarra();
    }

    async function guardar(id) {
      var e = est[id];
      if (e.guardando) return;
      e.guardando = true;
      repintar(id);
      try {
        await API.guardarPronostico(id, e.gl, e.gv);
        e.g = { gl: e.gl, gv: e.gv };
        e.tocado = false;
        UI.toast('¡Pronóstico guardado!');
      } catch (err) {
        if (App.manejarError(err)) return;
        if (err.codigo === 'PARTIDO_CERRADO') cerradoServidor[id] = true;
        UI.toast(err.message, 'error');
      } finally {
        e.guardando = false;
        if (App.vigente(n)) { repintar(id); pintarTabs(); pintarBarra(); }
      }
    }

    async function guardarTodos() {
      var lista = pendientes();
      var btn = document.getElementById('guardarTodo');
      UI.ocupado(btn, true, 'Guardando…');
      var ok = 0;
      for (var i = 0; i < lista.length; i++) {
        var p = lista[i], e = est[p.id];
        try {
          await API.guardarPronostico(p.id, e.gl, e.gv);
          e.g = { gl: e.gl, gv: e.gv };
          e.tocado = false;
          ok++;
        } catch (err) {
          if (App.manejarError(err)) return;
          if (err.codigo === 'PARTIDO_CERRADO') cerradoServidor[p.id] = true;
          UI.toast(err.message, 'error');
        }
        if (App.vigente(n)) repintar(p.id);
      }
      if (!App.vigente(n)) return;
      pintarTabs();
      pintarBarra();
      if (ok) UI.toast(ok === 1 ? '¡Pronóstico guardado!' : '¡' + ok + ' pronósticos guardados!');
    }

    cont.onclick = function (ev) {
      var b = ev.target.closest('button');
      if (!b || !cont.contains(b)) return;
      if (b.dataset.fase) {
        if (b.dataset.fase === fase) return;
        fase = b.dataset.fase;
        try { history.replaceState(null, '', '#/pronosticos/' + fase); } catch (_) { /* nada */ }
        pintar();
        return;
      }
      if (b.id === 'guardarTodo') { guardarTodos(); return; }
      var card = b.closest('.pron');
      if (!card) return;
      var id = card.dataset.id, p = mapa[id], e = est[id];
      if (!p || cerrado(p)) { repintar(id); return; }
      var acc = b.dataset.acc;
      if (acc === 'mas' || acc === 'menos') {
        var k = b.dataset.lado === 'l' ? 'gl' : 'gv';
        e[k] = Math.max(0, Math.min(20, e[k] + (acc === 'mas' ? 1 : -1)));
        e.tocado = true;
        repintar(id, '[data-acc="' + acc + '"][data-lado="' + b.dataset.lado + '"]');
        pintarBarra();
        if (navigator.vibrate) { try { navigator.vibrate(8); } catch (_) { /* nada */ } }
      } else if (acc === 'guardar') {
        guardar(id);
      }
    };

    // Avisar si se va con cambios sin guardar
    App.salirGuard = function () { return pendientes().length > 0; };
    // Cuando llega la hora de un partido, su tarjeta se cierra sola
    App.alTick = function () {
      partidos.forEach(function (p) {
        if (cerradoPintado[p.id] !== undefined && cerradoPintado[p.id] !== cerrado(p)) repintar(p.id);
      });
      pintarTabs();
      pintarBarra();
    };

    pintar();
  };
})();
