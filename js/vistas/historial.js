// Historial: la tabla final de cada bolsa cerrada (podio + tabla completa)
(function () {
  'use strict';
  window.Vistas = window.Vistas || {};

  function podio(filas) {
    var g = { 1: [], 2: [], 3: [] };
    filas.forEach(function (r) { if (r.posicion >= 1 && r.posicion <= 3) g[r.posicion].push(r); });
    function col(pos) {
      var rs = g[pos];
      return '<div class="podio-col podio-' + pos + (rs.length ? '' : ' podio-vacio') + '">' +
        '<div class="podio-nom">' + (rs.length ? rs.map(function (r) { return UI.esc(r.apodo); }).join('<br>') : '—') + '</div>' +
        (rs.length ? '<div class="podio-pts">' + rs[0].puntos + ' pts' + (Number(rs[0].premio) > 0 ? ' · ' + UI.dinero(rs[0].premio) : '') + '</div>' : '') +
        '<div class="podio-base">' + pos + '°</div></div>';
    }
    return '<div class="podio">' + col(2) + col(1) + col(3) + '</div>';
  }

  function tabla(filas) {
    return '<table class="tabla"><thead><tr><th>#</th><th>Jugador</th><th>Pts</th><th>Exac</th><th>Premio</th></tr></thead><tbody>' +
      filas.map(function (r) {
        var yo = r.jugador_id === App.yo.id;
        return '<tr class="' + (yo ? 'yo ' : '') + (r.posicion === 1 ? 'lider ' : '') + (r.posicion == null ? 'nopago' : '') + '">' +
          '<td class="t-pos">' + (r.posicion == null ? '–' : r.posicion) + '</td>' +
          '<td class="t-nom"><div class="t-nom-in">' + UI.avatar(r.apodo, 'mini') + '<span>' + UI.esc(r.apodo) + (yo ? ' <em>(tú)</em>' : '') + '</span></div></td>' +
          '<td class="t-pts">' + r.puntos + '</td><td>' + r.exactos + '</td>' +
          '<td>' + (Number(r.premio) > 0 ? UI.dinero(r.premio) : (r.posicion == null ? 'no pagó' : '—')) + '</td></tr>';
      }).join('') + '</tbody></table>';
  }

  Vistas.historial = async function (cont, params, n) {
    var torneos = await API.torneos();
    if (!App.vigente(n)) return;
    if (!torneos.length) { cont.innerHTML = '<h1 class="h1">Historial</h1><div class="card mt">' + UI.vacio('Todavía no hay torneos', '', 'historial') + '</div>'; return; }
    var sel = torneos.filter(function (t) { return t.id === params[0]; })[0] ||
      torneos.filter(function (t) { return App.torneo && t.id === App.torneo.id; })[0] || torneos[0];

    var filas = await API.historial(sel.id);
    if (!App.vigente(n)) return;

    var grupos = [], porBolsa = {};
    filas.forEach(function (r) {
      if (!porBolsa[r.bolsa_id]) { porBolsa[r.bolsa_id] = { info: r, filas: [] }; grupos.push(porBolsa[r.bolsa_id]); }
      porBolsa[r.bolsa_id].filas.push(r);
    });

    var html = '<div class="cabeza-vista"><h1 class="h1">Historial</h1>' +
      '<p class="sub">El resultado final de cada bolsa queda guardado aquí cuando el admin la cierra.</p></div>';
    if (torneos.length > 1) {
      html += '<div class="seg" role="tablist">' + torneos.map(function (t) {
        var act = t.id === sel.id;
        return '<a href="#/historial/' + t.id + '" role="tab" aria-selected="' + act + '" class="' + (act ? 'activo' : '') + '">' + UI.esc(t.nombre) + '</a>';
      }).join('') + '</div>';
    }
    if (!grupos.length) {
      html += '<div class="card mt">' + UI.vacio('Todavía no hay bolsas cerradas en ' + sel.nombre,
        'Cuando termine cada fase y se cierre su bolsa, aquí verás el podio y la tabla final.', 'historial') + '</div>';
    }
    grupos.forEach(function (g) {
      var b = g.info;
      var total = g.filas.filter(function (r) { return r.pagado; }).length * Number(b.monto);
      html += '<section class="card mt">' +
        '<div class="bolsa-cab"><div><div class="bolsa-nom">' + UI.esc(b.bolsa) + '</div>' +
        '<div class="sub">Cerrada el ' + UI.dia(b.cerrada_en) + ' · bolsa de ' + UI.dinero(total) + '</div></div>' +
        '<span class="chip chip-oro">' + UI.icono('trofeo') + 'Final</span></div>' +
        podio(g.filas) + tabla(g.filas) + '</section>';
    });
    cont.innerHTML = html;
  };
})();
