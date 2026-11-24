// Partido: resultado real y lo que puso cada quien (visible al empezar el partido)
(function () {
  'use strict';
  window.Vistas = window.Vistas || {};

  Vistas.partido = async function (cont, params, n) {
    var id = params[0];
    var volver = '<button class="volver" type="button" id="btnVolver">' + UI.icono('atras').replace('<svg', '<svg width="20" height="20"') + 'Volver</button>';
    if (!UI.esUUID(id)) { cont.innerHTML = volver + '<div class="card">' + UI.vacio('No encontramos ese partido') + '</div>'; enlazarVolver(); return; }

    var p = await API.partido(id);
    if (!App.vigente(n)) return;
    if (!p) { cont.innerHTML = volver + '<div class="card">' + UI.vacio('No encontramos ese partido') + '</div>'; enlazarVolver(); return; }

    var L = App.equipo(p.local), V = App.equipo(p.visitante);
    var iniciado = new Date(p.inicio).getTime() <= Date.now();
    var res = p.goles_local != null;

    var estado;
    if (res) estado = '<span class="chip chip-verde">Final · 90 minutos</span>';
    else if (iniciado) estado = '<span class="chip chip-rojo"><span class="punto-vivo"></span>En juego · esperando resultado</span>';
    else estado = '<span>' + UI.fecha(p.inicio) + '</span><span class="chip chip-tiempo">' + UI.icono('reloj') + 'Cierra&nbsp;<span data-cuenta="' + p.inicio + '">' + UI.cuenta(p.inicio) + '</span></span>';

    var html = volver +
      '<section class="card tablero">' +
        '<div class="tablero-meta">' + UI.FASE[p.fase] + ' · ' + UI.IV[p.ida_vuelta] + '</div>' +
        '<div class="tablero-fila">' +
          '<div class="tablero-eq">' + UI.escudo(L, 'g') + '<span class="tablero-nom">' + UI.esc(L.nombre) + '</span></div>' +
          '<div class="tablero-marcador">' + (res ? p.goles_local + '<i>–</i>' + p.goles_visitante : '<span class="vs">VS</span>') + '</div>' +
          '<div class="tablero-eq">' + UI.escudo(V, 'g') + '<span class="tablero-nom">' + UI.esc(V.nombre) + '</span></div>' +
        '</div>' +
        '<div class="tablero-estado">' + estado + '</div>' +
      '</section>';

    if (!iniciado) {
      // Antes del inicio: mi pronóstico y quién ya pronosticó (sin marcadores)
      var d = await Promise.all([API.misPronosticos(p.torneo_id), API.quienPronostico(id)]);
      if (!App.vigente(n)) return;
      var mio = (d[0] || []).filter(function (m) { return m.partido_id === id; })[0];
      var quien = d[1] || [];
      var ya = quien.filter(function (q) { return q.ya; }).length;
      html += '<section class="card mi-pron mt">' +
        (mio ? '<div><div class="sub">Tu pronóstico</div><div class="marcador-mini">' + mio.goles_local + '–' + mio.goles_visitante + '</div></div>'
             : '<div><b>Todavía no pronosticas</b><div class="sub">Tienes hasta que empiece el partido.</div></div>') +
        '<a class="btn btn-sm" href="#/pronosticos/' + p.fase + '">' + (mio ? 'Cambiar' : 'Pronosticar') + '</a></section>';
      html += '<h2 class="h2">Ya pronosticaron ' + ya + ' de ' + quien.length + '</h2>' +
        '<p class="sub" style="margin:-4px 2px 12px">Los marcadores de todos se ven en cuanto empiece el partido.</p>' +
        '<div class="chips-jug">' + quien.map(function (q) {
          return '<span class="chip-jug' + (q.ya ? ' ya' : '') + '">' + UI.avatar(q.apodo, 'mini') + UI.esc(q.apodo) + (q.ya ? UI.icono('check') : '') + '</span>';
        }).join('') + '</div>';
      cont.innerHTML = html;
      enlazarVolver();
      return;
    }

    // Ya empezó: todos ven lo que puso cada quien
    var r = await Promise.all([API.pronosticosPartido(id), API.jugadores()]);
    if (!App.vigente(n)) return;
    var pros = r[0], jugadores = r[1];
    var con = {};
    pros.forEach(function (x) { con[x.jugador_id] = true; });
    var sinPron = jugadores.filter(function (j) { return j.activo && !con[j.id]; });

    if (pros.length) {
      var l = 0, e = 0, v = 0;
      pros.forEach(function (x) {
        var s = Math.sign(x.goles_local - x.goles_visitante);
        if (s > 0) l++; else if (s < 0) v++; else e++;
      });
      var tot = pros.length;
      var pct = function (k) { return Math.round(100 * k / tot); };
      html += '<h2 class="h2">¿A quién le fueron?</h2><section class="card">' +
        '<div class="dist" role="img" aria-label="' + l + ' a ' + UI.esc(L.nombre) + ', ' + e + ' al empate, ' + v + ' a ' + UI.esc(V.nombre) + '">' +
        '<span class="l" style="width:' + pct(l) + '%"></span><span class="e" style="width:' + pct(e) + '%"></span><span class="v" style="width:' + pct(v) + '%"></span></div>' +
        '<div class="dist-ley"><span><i style="background:var(--green)"></i>' + UI.esc(L.nombre) + ' ' + l + '</span>' +
        '<span><i style="background:#9fb3a8"></i>Empate ' + e + '</span>' +
        '<span><i style="background:var(--blue)"></i>' + UI.esc(V.nombre) + ' ' + v + '</span></div></section>';
    }

    if (res && pros.length) {
      var ex = pros.filter(function (x) { return x.puntos === 4; }).length;
      var ac = pros.filter(function (x) { return x.puntos === 3; }).length;
      html += '<div class="resumen-res mt"><span class="chip chip-oro">' + ex + (ex === 1 ? ' exacto' : ' exactos') + '</span>' +
        '<span class="chip chip-verde">' + ac + ' atinaron el resultado</span>' +
        '<span class="chip chip-gris">' + (tot - ex - ac) + ' fallaron</span></div>';
    }

    pros.sort(function (a, b) {
      return (res ? (b.puntos - a.puntos) : 0) || a.apodo.localeCompare(b.apodo, 'es');
    });
    html += '<h2 class="h2">Pronósticos (' + pros.length + ')</h2><section class="card">' +
      (pros.length ? pros.map(function (x) {
        var yo = x.jugador_id === App.yo.id;
        return '<div class="fila-pron' + (yo ? ' yo' : '') + '">' + UI.avatar(x.apodo, 'mini') +
          '<span class="nom">' + UI.esc(x.apodo) + (yo ? ' <em>(tú)</em>' : '') + '</span>' +
          '<span class="marc">' + x.goles_local + '–' + x.goles_visitante + '</span>' +
          (res ? UI.chipPuntos(x.puntos) : '') + '</div>';
      }).join('') : UI.vacio('Nadie pronosticó este partido')) +
      '</section>';
    if (sinPron.length) {
      html += '<p class="sub mt">Sin pronóstico: ' + sinPron.map(function (j) { return UI.esc(j.apodo); }).join(', ') + '</p>';
    }
    cont.innerHTML = html;
    enlazarVolver();

    function enlazarVolver() {
      var b = document.getElementById('btnVolver');
      if (b) b.onclick = function () {
        if (window.history.length > 1) history.back(); else location.hash = '#/inicio';
      };
    }
  };
})();
