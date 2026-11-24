// =====================================================================
//  UI: formatos (hora de Monterrey), íconos y piezas reutilizables
// =====================================================================
(function () {
  'use strict';

  var ZONA = (window.QUINIELA_CONFIG && window.QUINIELA_CONFIG.ZONA) || 'America/Monterrey';
  var fDia = new Intl.DateTimeFormat('es-MX', { timeZone: ZONA, weekday: 'short', day: 'numeric', month: 'short' });
  var fHora = new Intl.DateTimeFormat('es-MX', { timeZone: ZONA, hour: 'numeric', minute: '2-digit', hour12: true });
  var fPartes = new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  });

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

  function partes(fmt, d) {
    var o = {};
    fmt.formatToParts(d).forEach(function (p) { o[p.type] = p.value; });
    return o;
  }
  function claveDia(d) { var p = partes(fPartes, d); return p.year + '-' + p.month + '-' + p.day; }

  // "Sáb 29 nov"
  function dia(iso) {
    var p = partes(fDia, new Date(iso));
    return cap(String(p.weekday || '').replace(/\./g, '')) + ' ' + p.day + ' ' + String(p.month || '').replace(/\./g, '');
  }
  // "7:00 p.m."
  function hora(iso) { return fHora.format(new Date(iso)).replace(/\s/g, ' '); }
  // "Hoy" / "Mañana" / "Ayer" / "Sáb 29 nov"
  function diaRelativo(iso) {
    var d = new Date(iso), ahora = Date.now();
    var k = claveDia(d);
    if (k === claveDia(new Date(ahora))) return 'Hoy';
    if (k === claveDia(new Date(ahora + 864e5))) return 'Mañana';
    if (k === claveDia(new Date(ahora - 864e5))) return 'Ayer';
    return dia(iso);
  }
  function fecha(iso) { return diaRelativo(iso) + ' · ' + hora(iso); }

  // "en 2 h 15 min"
  function cuenta(iso) {
    var ms = new Date(iso).getTime() - Date.now();
    if (ms <= 0) return 'ya empezó';
    var min = Math.ceil(ms / 60000);
    if (min < 60) return 'en ' + min + ' min';
    var h = Math.floor(min / 60), m = min % 60;
    if (h < 24) return 'en ' + h + ' h' + (m ? ' ' + m + ' min' : '');
    var d = Math.floor(h / 24), hh = h % 24;
    return 'en ' + d + (d === 1 ? ' día' : ' días') + (hh && d < 3 ? ' ' + hh + ' h' : '');
  }

  // UTC → "AAAA-MM-DDTHH:MM" en hora de Monterrey (para <input type="datetime-local">)
  function aLocalInput(iso) {
    var p = partes(fPartes, new Date(iso));
    return p.year + '-' + p.month + '-' + p.day + 'T' + (p.hour === '24' ? '00' : p.hour) + ':' + p.minute;
  }

  function dinero(n) {
    var v = Number(n) || 0;
    var entero = Math.abs(v - Math.round(v)) < 0.005;
    return new Intl.NumberFormat('es-MX', {
      style: 'currency', currency: 'MXN',
      minimumFractionDigits: entero ? 0 : 2, maximumFractionDigits: entero ? 0 : 2
    }).format(v);
  }

  function puntos(pl, pv, rl, rv) {
    if (pl == null || pv == null || rl == null || rv == null) return null;
    if (pl === rl && pv === rv) return 4;
    return Math.sign(pl - pv) === Math.sign(rl - rv) ? 3 : 0;
  }

  function telBonito(t) {
    var d = String(t || '').replace(/\D/g, '');
    return d.length === 10 ? d.slice(0, 2) + ' ' + d.slice(2, 6) + ' ' + d.slice(6) : d;
  }

  function esUUID(s) { return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(s || '')); }

  var FASE = { cuartos: 'Cuartos de final', semis: 'Semifinales', final: 'Final' };
  var FASE_CORTA = { cuartos: 'Cuartos', semis: 'Semis', final: 'Final' };
  var IV = { ida: 'Ida', vuelta: 'Vuelta' };

  // ---------- Íconos (trazos simples, 24×24) ----------
  var ICONOS = {
    casa: '<path d="M3.5 10.5 12 3.5l8.5 7V20a1 1 0 0 1-1 1h-5v-6h-5v6h-5a1 1 0 0 1-1-1z"/>',
    balon: '<circle cx="12" cy="12" r="9"/><path d="m12 7.2 3.9 2.8-1.5 4.6H9.6L8.1 10z"/><path d="M12 3v4.2M15.9 10l4.3-1.4M14.4 14.6l2.7 3.7M9.6 14.6l-2.7 3.7M8.1 10 3.8 8.6"/>',
    trofeo: '<path d="M7.5 4h9v5a4.5 4.5 0 0 1-9 0z"/><path d="M7.5 6H4.5a3 3 0 0 0 3 4M16.5 6h3a3 3 0 0 1-3 4M12 13.5V17M8 21h8M9.5 17h5"/>',
    podio: '<path d="M3 20h18M4.5 20v-8h5v8M9.5 20V6h5v14M14.5 20v-5.5h5V20"/>',
    puntos: '<circle cx="5" cy="12" r="1.7" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.7" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.7" fill="currentColor" stroke="none"/>',
    candado: '<rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8.5 10.5V7.8a3.5 3.5 0 0 1 7 0v2.7"/>',
    reloj: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    mas: '<path d="M12 5v14M5 12h14"/>',
    historial: '<path d="M4 12a8 8 0 1 0 2.4-5.7M4 4.5V8h3.5"/><path d="M12 8v4.5l3 1.8"/>',
    usuario: '<circle cx="12" cy="8.5" r="4"/><path d="M4.5 20.5a7.5 7.5 0 0 1 15 0"/>',
    ajustes: '<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2.2"/><circle cx="10" cy="17" r="2.2"/>',
    salir: '<path d="M14 4.5h4.5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H14M10 16l-4-4 4-4M6 12h10"/>',
    compartir: '<path d="M12 15V3.5M7.5 8 12 3.5 16.5 8"/><path d="M5 12.5V19a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 19v-6.5"/>',
    copiar: '<rect x="8.5" y="8.5" width="11" height="11" rx="2"/><path d="M15.5 8.5V6a1.5 1.5 0 0 0-1.5-1.5H6A1.5 1.5 0 0 0 4.5 6v8A1.5 1.5 0 0 0 6 15.5h2.5"/>',
    whatsapp: '<path d="M4 20l1.3-4.2A8.5 8.5 0 1 1 8.6 19z"/><path d="M9.2 8.4c.3 2.6 2.4 4.8 5 5.4l1.1-1.2 1.6.9c-.3 1.1-1.3 1.8-2.4 1.6-3.4-.6-6-3.2-6.6-6.6-.2-1.1.5-2.1 1.6-2.4l.9 1.6z" fill="currentColor" stroke="none"/>',
    celular: '<rect x="7" y="3" width="10" height="18" rx="2.2"/><path d="M11 17.5h2"/>',
    calendario: '<rect x="4" y="5.5" width="16" height="15" rx="2.5"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/>',
    atras: '<path d="m14.5 5.5-6.5 6.5 6.5 6.5"/>',
    estrella: '<path d="m12 4 2.4 5 5.4.6-4 3.7 1.1 5.3L12 16l-4.9 2.6 1.1-5.3-4-3.7 5.4-.6z"/>'
  };
  function icono(nombre) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      (ICONOS[nombre] || '') + '</svg>';
  }
  function logo(cls) {
    return '<svg class="' + (cls || '') + '" viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" rx="16" fill="#0f2a1b"/>' +
      '<rect x="8" y="8" width="48" height="48" rx="10" fill="none" stroke="#2bd96b" stroke-width="3.5"/>' +
      '<path d="M32 8v48" stroke="#2bd96b" stroke-width="3.5"/><circle cx="32" cy="32" r="10" fill="none" stroke="#2bd96b" stroke-width="3.5"/>' +
      '<circle cx="32" cy="32" r="3" fill="#f6c544"/></svg>';
  }

  // ---------- Piezas ----------
  function escudo(eq, tam) {
    if (!eq) return '<span class="escudo ' + (tam || '') + '">?</span>';
    return '<span class="escudo ' + (tam || '') + '" style="--c:' + esc(eq.color) + ';--t:' + esc(eq.texto) +
      '" title="' + esc(eq.nombre) + '" aria-hidden="true">' + esc(eq.id) + '</span>';
  }

  var PALETA = ['#2bd96b', '#5aa9ff', '#f6c544', '#ff8a5b', '#c58cff', '#3fd1c7', '#ff6b9a', '#a3d65c'];
  function hash(s) { var h = 0; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); }
  function avatar(apodo, cls) {
    var a = String(apodo || '?').replace(/\s*\(demo\)\s*$/i, '').trim();
    var ini = (Array.from(a)[0] || '?').toUpperCase();
    return '<span class="avatar ' + (cls || '') + '" style="--a:' + PALETA[hash(a) % PALETA.length] + '" aria-hidden="true">' + esc(ini) + '</span>';
  }

  function chipPuntos(p) {
    if (p === null || p === undefined) return '';
    if (p === 4) return '<span class="chip chip-oro">+4 · exacto</span>';
    if (p === 3) return '<span class="chip chip-verde">+3 · resultado</span>';
    return '<span class="chip chip-gris">0 pts</span>';
  }

  function vacio(titulo, texto, ico) {
    return '<div class="vacio">' + icono(ico || 'balon') + '<b>' + esc(titulo) + '</b>' + (texto ? esc(texto) : '') + '</div>';
  }
  function cargando() {
    return '<div class="esqueleto corto"></div><div class="esqueleto"></div><div class="esqueleto"></div><div class="esqueleto"></div>';
  }
  function errorVista(e) {
    return '<div class="card mt">' + vacio('No se pudo cargar', (e && e.message) || 'Intenta otra vez.', 'reloj') +
      '<button class="btn btn-bloque" type="button" onclick="App.render()">Reintentar</button></div>';
  }
  function sinTorneo() {
    var admin = window.App && App.yo && App.yo.es_admin;
    return '<h1 class="h1">Quiniela</h1>' +
      '<div class="card mt">' + vacio('Todavía no hay torneo activo', admin ? 'Créalo en Admin › Grupo.' : 'Quien organiza lo va a crear pronto.', 'calendario') +
      (admin ? '<a class="btn btn-bloque" href="#/admin/grupo">Ir a Admin</a>' : '') + '</div>';
  }

  var tTimer;
  function toast(msg, tipo) {
    var el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.className = 'toast ver' + (tipo === 'error' ? ' error' : '');
    clearTimeout(tTimer);
    tTimer = setTimeout(function () { el.className = 'toast' + (tipo === 'error' ? ' error' : ''); }, tipo === 'error' ? 4500 : 2400);
  }

  // Botón en estado "cargando"
  function ocupado(btn, si, texto) {
    if (!btn) return;
    if (si) {
      btn.dataset.txt = btn.innerHTML;
      btn.disabled = true;
      if (texto) btn.textContent = texto;
    } else {
      btn.disabled = false;
      if (btn.dataset.txt) btn.innerHTML = btn.dataset.txt;
    }
  }

  window.UI = {
    esc: esc, fecha: fecha, dia: dia, hora: hora, diaRelativo: diaRelativo, cuenta: cuenta, aLocalInput: aLocalInput,
    dinero: dinero, puntos: puntos, telBonito: telBonito, esUUID: esUUID,
    FASE: FASE, FASE_CORTA: FASE_CORTA, IV: IV,
    icono: icono, logo: logo, escudo: escudo, avatar: avatar, chipPuntos: chipPuntos,
    vacio: vacio, cargando: cargando, errorVista: errorVista, sinTorneo: sinTorneo,
    toast: toast, ocupado: ocupado
  };
})();
