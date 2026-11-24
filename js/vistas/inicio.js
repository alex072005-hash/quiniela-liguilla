// Inicio: lo que me falta pronosticar, próximos partidos, resultados y mi lugar
(function () {
  'use strict';
  window.Vistas = window.Vistas || {};

  // Fila compacta de partido (se usa en Inicio)
  function filaPartido(p, mio) {
    var L = App.equipo(p.local), V = App.equipo(p.visitante);
    var ahora = Date.now(), ini = new Date(p.inicio).getTime();
    var res = p.goles_local != null;
    var gl, gv, clase, chip;
    if (res) {
      gl = p.goles_local; gv = p.goles_visitante; clase = '';
      chip = mio ? UI.chipPuntos(UI.puntos(mio.goles_local, mio.goles_visitante, p.goles_local, p.goles_visitante))
                 : '<span class="chip chip-gris">No pronosticaste</span>';
    } else if (ini <= ahora) {
      gl = mio ? mio.goles_local : '–'; gv = mio ? mio.goles_visitante : '–'; clase = mio ? 'pred' : 'nada';
      chip = '<span class="chip chip-rojo"><span class="punto-vivo"></span>En juego</span>';
    } else if (mio) {
      gl = mio.goles_local; gv = mio.goles_visitante; clase = 'pred';
      chip = '<span class="chip chip-verde">' + UI.icono('check') + 'Tu pronóstico</span>';
    } else {
      gl = '–'; gv = '–'; clase = 'nada';
      chip = '<span class="chip chip-oro">Te falta</span>';
    }
    var cuando = ini > ahora
      ? UI.fecha(p.inicio) + ' · <span data-cuenta="' + p.inicio + '">' + UI.cuenta(p.inicio) + '</span>'
      : UI.fecha(p.inicio);
    return '<a class="card fila-p" href="#/partido/' + p.id + '">' +
      '<div class="fila-p-eq">' + UI.escudo(L, 'ch') + '<span class="fila-p-nom">' + UI.esc(L.nombre) + '</span><b class="fila-p-gol ' + clase + '">' + gl + '</b></div>' +
      '<div class="fila-p-eq">' + UI.escudo(V, 'ch') + '<span class="fila-p-nom">' + UI.esc(V.nombre) + '</span><b class="fila-p-gol ' + clase + '">' + gv + '</b></div>' +
      '<div class="fila-p-pie"><span>' + UI.FASE_CORTA[p.fase] + ' ' + UI.IV[p.ida_vuelta].toLowerCase() + ' · ' + cuando + '</span>' + chip + '</div>' +
      '</a>';
  }
  Vistas.filaPartido = filaPartido;

  Vistas.inicio = async function (cont, params, n) {
    var t = App.torneo;
    if (!t) { cont.innerHTML = UI.sinTorneo(); return; }

    var d = await Promise.all([API.partidos(t.id), API.misPronosticos(t.id), API.bolsas(t.id), API.tabla(t.id)]);
    if (!App.vigente(n)) return;
    var partidos = d[0], bolsas = d[2], tabla = d[3];
    var mios = {};
    (d[1] || []).forEach(function (m) { mios[m.partido_id] = m; });

    var ahora = Date.now();
    var futuros = partidos.filter(function (p) { return new Date(p.inicio).getTime() > ahora; });
    var faltan = futuros.filter(function (p) { return !mios[p.id]; });
    var enJuego = partidos.filter(function (p) { return new Date(p.inicio).getTime() <= ahora && p.goles_local == null; });
    var jugados = partidos.filter(function (p) { return p.goles_local != null; })
      .sort(function (a, b) { return new Date(b.inicio) - new Date(a.inicio); }).slice(0, 3);

    var html = '<div class="cabeza-vista"><h1 class="h1">Hola, ' + UI.esc(App.yo.apodo) + '</h1>' +
      '<p class="sub">' + UI.esc(t.nombre) + '</p></div>';

    // Aviso principal
    if (faltan.length) {
      var prox = faltan[0];
      html += '<section class="banner">' +
        '<div class="banner-etq">Te falta' + (faltan.length > 1 ? 'n' : '') + '</div>' +
        '<div class="banner-titulo">' + faltan.length + (faltan.length > 1 ? ' pronósticos' : ' pronóstico') + '</div>' +
        '<p class="banner-txt">El próximo cierra <b data-cuenta="' + prox.inicio + '">' + UI.cuenta(prox.inicio) + '</b> · ' + UI.fecha(prox.inicio) + '</p>' +
        '<a class="btn btn-claro" href="#/pronosticos/' + prox.fase + '">Pronosticar ahora</a>' +
        '</section>';
    } else if (futuros.length) {
      html += '<section class="banner banner-ok">' + UI.icono('check') +
        '<div><b>Ya tienes todos tus pronósticos.</b><div class="sub">Puedes cambiarlos hasta que empiece cada partido.</div></div></section>';
    }

    if (!partidos.length) {
      html += '<div class="card mt">' + UI.vacio('Todavía no hay partidos', App.yo.es_admin
        ? 'Agrega los cruces en Admin › Partidos.' : 'Quien organiza los cargará cuando se conozcan los cruces.', 'calendario') +
        (App.yo.es_admin ? '<a class="btn btn-bloque" href="#/admin/partidos">Agregar partidos</a>' : '') + '</div>';
    }

    if (enJuego.length) {
      html += '<h2 class="h2">En juego</h2><div class="lista">' + enJuego.map(function (p) { return filaPartido(p, mios[p.id]); }).join('') + '</div>';
      if (App.yo.es_admin) html += '<a class="btn btn-borde btn-bloque mt" href="#/admin/resultados">Capturar resultado</a>';
    }
    if (futuros.length) {
      html += '<h2 class="h2">Próximos partidos</h2><div class="lista">' +
        futuros.slice(0, 4).map(function (p) { return filaPartido(p, mios[p.id]); }).join('') + '</div>';
    }
    if (jugados.length) {
      html += '<h2 class="h2">Últimos resultados</h2><div class="lista">' +
        jugados.map(function (p) { return filaPartido(p, mios[p.id]); }).join('') + '</div>';
    }

    // Mi lugar en la tabla general
    var gen = bolsas.filter(function (b) { return b.fase == null && b.ida_vuelta == null; })[0];
    if (gen && partidos.length) {
      var filas = tabla.filter(function (r) { return r.bolsa_id === gen.id; });
      var compiten = filas.filter(function (r) { return r.pagado; }).length;
      var soloPuntos = compiten === 0;               // nadie pagó: tabla solo de puntos
      if (soloPuntos) { filas = Vistas.rankear(filas); compiten = filas.length; }
      var mia = filas.filter(function (r) { return r.jugador_id === App.yo.id; })[0];
      if (mia) {
        var pos = mia.pagado && gen.partidos_jugados ? mia.posicion + '°' : '–';
        var detalle = !gen.partidos_jugados ? 'La tabla arranca con el primer resultado.'
          : mia.pagado ? mia.puntos + ' pts · ' + mia.exactos + (mia.exactos === 1 ? ' exacto' : ' exactos') + ' · de ' + compiten + (soloPuntos ? ' jugadores' : ' en la bolsa')
          : mia.puntos + ' pts · no estás inscrito en la bolsa general';
        html += '<h2 class="h2">Tu lugar</h2><a class="card lugar" href="#/general">' +
          '<div class="lugar-pos">' + pos + '</div><div class="lugar-txt"><b>Tabla general</b><span>' + detalle + '</span></div>' +
          '<span class="flecha" aria-hidden="true">›</span></a>';
      }
    }

    cont.innerHTML = html;
  };
})();
