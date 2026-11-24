// Bolsas (4 de fase) y Tabla general (bolsa de toda la liguilla)
(function () {
  'use strict';
  window.Vistas = window.Vistas || {};

  function esGeneral(b) { return b.fase == null && b.ida_vuelta == null; }

  function ordenar(a, b) {
    var pa = a.posicion == null ? 999 : a.posicion, pb = b.posicion == null ? 999 : b.posicion;
    return (pa - pb) || (b.puntos - a.puntos) || (b.exactos - a.exactos) ||
      String(a.apodo).localeCompare(String(b.apodo), 'es');
  }

  // Posiciones con empate (1, 1, 3…) para cuando nadie pagó: tabla solo de puntos
  function rankear(lista) {
    var ord = lista.slice().sort(function (a, b) {
      return (b.puntos - a.puntos) || (b.exactos - a.exactos) || String(a.apodo).localeCompare(String(b.apodo), 'es');
    });
    var pos = 0, previo = null;
    return ord.map(function (r, i) {
      if (previo === null || r.puntos !== previo) { pos = i + 1; previo = r.puntos; }
      var c = {};
      Object.keys(r).forEach(function (k) { c[k] = r[k]; });
      c.posicion = pos;
      c.pagado = true;
      return c;
    });
  }

  function fila(r, hayRes, desglose) {
    var yo = r.jugador_id === App.yo.id;
    var cls = (yo ? 'yo ' : '') + (r.pagado && r.posicion === 1 && hayRes ? 'lider ' : '') + (!r.pagado ? 'nopago' : '');
    return '<tr class="' + cls + '">' +
      '<td class="t-pos">' + (r.pagado ? r.posicion : '–') + '</td>' +
      '<td class="t-nom"><div class="t-nom-in">' + UI.avatar(r.apodo, 'mini') + '<span>' + UI.esc(r.apodo) + (yo ? ' <em>(tú)</em>' : '') + '</span></div>' +
        (desglose ? '<small>' + desglose(r) + '</small>' : '') + '</td>' +
      '<td class="t-pts">' + r.puntos + '</td><td>' + r.exactos + '</td><td>' + r.aciertos + '</td></tr>';
  }

  // Bloque completo de una bolsa: resumen, ganador(es) y tabla
  function bloqueBolsa(b, filas, desglose) {
    var hayRes = b.partidos_jugados > 0;
    var soloPuntos = !filas.some(function (r) { return r.pagado; });
    var compiten = soloPuntos ? rankear(filas) : filas.filter(function (r) { return r.pagado; }).sort(ordenar);
    var noPagaron = soloPuntos ? [] : filas.filter(function (r) { return !r.pagado && (r.pronosticados > 0 || r.puntos > 0); }).sort(ordenar);
    var lideres = hayRes ? compiten.filter(function (r) { return r.posicion === 1; }) : [];
    var prog = b.partidos_total ? Math.round(100 * b.partidos_jugados / b.partidos_total) : 0;

    var html = '<section class="card mt">' +
      '<div class="bolsa-cab"><div><div class="bolsa-nom">' + UI.esc(b.nombre) + '</div>' +
      '<div class="sub">' + UI.dinero(b.monto) + ' por jugador · ' + b.pagados + (b.pagados === 1 ? ' pagó' : ' pagaron') + '</div></div>' +
      (b.cerrada_en ? '<span class="chip chip-oro">' + UI.icono('candado') + 'Cerrada</span>' : '<span class="chip chip-verde">En juego</span>') +
      '</div>' +
      '<div class="bolsa-total"><span>Bolsa</span><b>' + UI.dinero(b.total) + '</b></div>' +
      '<div class="progreso"><span style="width:' + prog + '%"></span></div>' +
      '<div class="sub">' + (b.partidos_total
        ? b.partidos_jugados + ' de ' + b.partidos_total + ' partidos con resultado'
        : 'Aún no hay partidos en esta bolsa') + '</div>' +
      '</section>';

    if (soloPuntos) {
      html += '<p class="sub mt">Nadie ha pagado esta bolsa: la tabla es solo de puntos. Cuando el admin marque pagos, compiten solo quienes pagaron.</p>';
    }
    if (lideres.length) {
      var varios = lideres.length > 1;
      var etq = b.cerrada_en ? (varios ? 'Ganadores' : 'Ganador') : (varios ? 'Van ganando' : 'Va ganando');
      html += '<section class="card ganador">' + UI.icono('trofeo') + '<div>' +
        '<div class="ganador-etq">' + etq + (varios ? ' · empate' : '') + '</div>' +
        '<div class="ganador-nom">' + lideres.map(function (r) { return UI.esc(r.apodo); }).join(', ') + '</div>' +
        '<div class="ganador-premio">' + (soloPuntos ? '' : UI.dinero(lideres[0].premio) + (varios ? ' para cada quien' : '') + ' · ') +
        lideres[0].puntos + ' pts</div></div></section>';
    } else if (!hayRes) {
      html += '<p class="sub mt">La tabla arranca con el primer resultado.</p>';
    }

    var filasHtml = compiten.map(function (r) { return fila(r, hayRes, desglose); }).join('');
    if (noPagaron.length) {
      filasHtml += '<tr class="separador"><td colspan="5">No pagaron esta bolsa · no compiten</td></tr>' +
        noPagaron.map(function (r) { return fila(r, hayRes, desglose); }).join('');
    }
    if (filasHtml) {
      html += '<section class="card tabla-card"><table class="tabla">' +
        '<thead><tr><th scope="col">#</th><th scope="col">Jugador</th><th scope="col">Pts</th>' +
        '<th scope="col" title="Marcadores exactos (4 pts)">Exac</th><th scope="col" title="Solo resultado (3 pts)">Res</th></tr></thead>' +
        '<tbody>' + filasHtml + '</tbody></table></section>' +
        '<p class="leyenda">Exac = marcador exacto (4 pts) · Res = solo resultado (3 pts) · Empate en puntos = se reparte la bolsa.</p>';
    }
    return html;
  }

  function bolsaPorDefecto(bolsas) {
    return bolsas.filter(function (b) { return !b.cerrada_en && b.partidos_total > 0 && b.partidos_jugados < b.partidos_total; })[0] ||
      bolsas.filter(function (b) { return !b.cerrada_en && b.partidos_total > 0; })[0] ||
      bolsas.filter(function (b) { return !b.cerrada_en; })[0] ||
      bolsas[bolsas.length - 1];
  }

  Vistas.bolsas = async function (cont, params, n) {
    var t = App.torneo;
    if (!t) { cont.innerHTML = UI.sinTorneo(); return; }
    var d = await Promise.all([API.bolsas(t.id), API.tabla(t.id)]);
    if (!App.vigente(n)) return;
    var bolsas = d[0].filter(function (b) { return !esGeneral(b); });
    var tabla = d[1];
    if (!bolsas.length) { cont.innerHTML = '<h1 class="h1">Bolsas</h1>' + UI.vacio('Este torneo no tiene bolsas'); return; }
    var sel = bolsas.filter(function (b) { return b.id === params[0]; })[0] || bolsaPorDefecto(bolsas);

    function pintar() {
      cont.innerHTML = '<div class="cabeza-vista"><h1 class="h1">Bolsas</h1>' +
        '<p class="sub">Cada bolsa se gana por separado. Si hay empate, se reparte.</p></div>' +
        '<div class="seg" role="tablist">' + bolsas.map(function (b) {
          var act = b.id === sel.id;
          return '<button type="button" role="tab" aria-selected="' + act + '" data-bolsa="' + b.id + '" class="' + (act ? 'activo' : '') + '">' +
            UI.esc(b.corto) + (b.cerrada_en ? UI.icono('candado') : '') + '</button>';
        }).join('') + '</div>' +
        bloqueBolsa(sel, tabla.filter(function (r) { return r.bolsa_id === sel.id; }));
    }

    cont.onclick = function (ev) {
      var b = ev.target.closest('[data-bolsa]');
      if (!b) return;
      sel = bolsas.filter(function (x) { return x.id === b.dataset.bolsa; })[0] || sel;
      try { history.replaceState(null, '', '#/bolsas/' + sel.id); } catch (_) { /* nada */ }
      pintar();
    };
    pintar();
  };

  Vistas.general = async function (cont, params, n) {
    var t = App.torneo;
    if (!t) { cont.innerHTML = UI.sinTorneo(); return; }
    var d = await Promise.all([API.bolsas(t.id), API.tabla(t.id)]);
    if (!App.vigente(n)) return;
    var bolsas = d[0], tabla = d[1];
    var gen = bolsas.filter(esGeneral)[0];
    if (!gen) { cont.innerHTML = '<h1 class="h1">Tabla general</h1>' + UI.vacio('Este torneo no tiene bolsa general'); return; }
    var deFase = bolsas.filter(function (b) { return !esGeneral(b); });
    var porJugador = {};
    tabla.forEach(function (r) {
      if (r.bolsa_id === gen.id) return;
      (porJugador[r.jugador_id] = porJugador[r.jugador_id] || {})[r.bolsa_id] = r.puntos;
    });
    function desglose(r) {
      var m = porJugador[r.jugador_id] || {};
      return deFase.map(function (b) { return UI.esc(b.corto) + ' ' + (m[b.id] || 0); }).join(' · ');
    }
    cont.innerHTML = '<div class="cabeza-vista"><h1 class="h1">Tabla general</h1>' +
      '<p class="sub">Puntos de toda la liguilla · bolsa de ' + UI.dinero(gen.monto) + ' por jugador</p></div>' +
      bloqueBolsa(gen, tabla.filter(function (r) { return r.bolsa_id === gen.id; }), desglose);
  };

  Vistas.bloqueBolsa = bloqueBolsa;
  Vistas.rankear = rankear;
})();
