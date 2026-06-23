/* ============================================================
   StockRotativo · Interfaz y navegación (5 módulos)
   1 Stocks · 2 Movimientos · 3 Punto de pedido · 4 Entregas Loeke · 5 Ventas OSA
   ============================================================ */
(function () {
  'use strict';

  var S = window.Store;
  var APP_VERSION = '1.1.0';

  /* ---------- Estado de UI ---------- */
  var ui = {
    view: 'stocks',
    busqueda: '',   // buscador de Stocks
    filtro: 'todos', // todos | reponer | ok
    qPunto: '',     // buscador de Punto de pedido
    expanded: {},   // artículos expandidos en Movimientos
    movDesde: '',   // filtro de período (detalle de Movimientos)
    movHasta: ''
  };
  var pendingExpand = null; // artículo a expandir al entrar a Movimientos

  var VIEWS = {
    stocks:      { title: 'Stocks', sub: 'Stock de hoy y pedido sugerido por artículo' },
    movimientos: { title: 'Movimientos', sub: 'Inicial + entregas − ventas = stock hoy. Tocá un artículo para ver el detalle.' },
    puntopedido: { title: 'Punto de pedido', sub: 'Promedio de ventas × meses de cobertura = punto de pedido' },
    entregas:    { title: 'Entregas Loeke', sub: 'Mercadería que Loeke entrega a OSA (entra al stock)' },
    ventas:      { title: 'Ventas OSA', sub: 'Ventas de OSA a sus clientes (salen del stock)' },
    config:      { title: 'Configuración', sub: 'Datos, respaldo y preferencias' }
  };

  /* ---------- Atajos DOM ---------- */
  var $ = function (s, ctx) { return (ctx || document).querySelector(s); };
  var $$ = function (s, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(s)); };
  var viewEl = $('#view');
  var app = $('#app');

  /* ---------- Formato ---------- */
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  // Números "planos", sin separadores ni decimales (redondeado).
  function fmtInt(n) { return String(Math.round(n || 0)); }
  function fmtMoney(n) {
    var m = S.getMeta().moneda || 'ARS';
    try { return new Intl.NumberFormat('es-AR', { style: 'currency', currency: m, maximumFractionDigits: 0 }).format(n || 0); }
    catch (e) { return '$' + fmtInt(n); }
  }
  function fmtFecha(iso) {
    if (!iso) return '';
    var p = iso.split('-');
    if (p.length !== 3) return iso;
    return p[2] + '/' + p[1] + '/' + p[0];
  }
  // La foto se escapa: puede venir de un respaldo importado y se interpola en src="...".
  function fotoDe(a) { return esc(a.foto || S.placeholder(a.nombre)); }

  /* ---------- Toast ---------- */
  var ICON = {
    ok: '<svg viewBox="0 0 24 24"><path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z"/></svg>',
    warn: '<svg viewBox="0 0 24 24"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/></svg>',
    danger: '<svg viewBox="0 0 24 24"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>',
    info: '<svg viewBox="0 0 24 24"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>'
  };
  function toast(msg, type) {
    type = type || 'info';
    var box = $('#toasts');
    var t = document.createElement('div');
    t.className = 'toast toast--' + type;
    t.innerHTML = (ICON[type] || ICON.info) + '<span>' + esc(msg) + '</span>';
    box.appendChild(t);
    setTimeout(function () {
      t.style.transition = 'opacity .3s, transform .3s';
      t.style.opacity = '0'; t.style.transform = 'translateX(24px)';
      setTimeout(function () { t.remove(); }, 320);
    }, 2800);
  }

  /* ---------- Modal ---------- */
  function openModal(title, bodyHTML) {
    $('#modalTitle').textContent = title;
    $('#modalBody').innerHTML = bodyHTML;
    $('#modal').hidden = false;
    document.body.style.overflow = 'hidden';
  }
  function closeModal() {
    $('#modal').hidden = true;
    $('#modalBody').innerHTML = '';
    document.body.style.overflow = '';
  }
  $('#modal').addEventListener('click', function (e) {
    if (e.target.hasAttribute('data-close')) closeModal();
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeModal(); });

  /* ---------- Navegación ---------- */
  function setView(v) {
    if (!VIEWS[v]) v = 'stocks';
    ui.view = v;
    $$('.nav__item').forEach(function (el) {
      el.classList.toggle('is-active', el.getAttribute('data-view') === v);
    });
    $('#viewTitle').textContent = VIEWS[v].title;
    $('#viewSubtitle').textContent = VIEWS[v].sub;
    app.classList.remove('menu-open');
    render();
    window.scrollTo(0, 0);
  }
  window.addEventListener('hashchange', function () {
    var v = (location.hash || '').replace('#/', '');
    if (v && v !== ui.view) setView(v);
  });
  $('#menuBtn').addEventListener('click', function () { app.classList.toggle('menu-open'); });
  $('#scrim').addEventListener('click', function () { app.classList.remove('menu-open'); });

  function updateBadge() {
    var n = S.pedidoSugerido().length;
    var b = $('#navBadge');
    b.textContent = n;
    b.hidden = n === 0;
  }
  function updateBrand() { $('#brandEmpresa').textContent = S.getMeta().empresa || 'Mi Empresa'; }

  /* ---------- Render principal ---------- */
  function render() {
    updateBadge();
    updateBrand();
    var actions = '';
    if (ui.view === 'stocks') actions = btn('nuevo-art', 'primary', iconPlus(), 'Nuevo artículo') + btn('print-sugerido', 'ghost', iconPrint(), 'Imprimir sugerido');
    else if (ui.view === 'movimientos') actions = btn('nuevo-ajuste', 'ghost', iconPlus(), 'Ajuste manual');
    else if (ui.view === 'puntopedido') actions = btn('guardar-punto', 'primary', iconSave(), 'Guardar');
    else if (ui.view === 'entregas') actions = btn('guardar-entregas', 'primary', iconSave(), 'Registrar entregas');
    else if (ui.view === 'ventas') actions = btn('guardar-ventas', 'primary', iconSave(), 'Guardar ventas');
    $('#topbarActions').innerHTML = actions;

    var fn = ({
      stocks: renderStocks, movimientos: renderMovimientos, puntopedido: renderPunto,
      entregas: renderEntregas, ventas: renderVentas, config: renderConfig
    })[ui.view];
    viewEl.innerHTML = fn ? fn() : '';
    if (afterRender[ui.view]) afterRender[ui.view]();
  }
  var afterRender = {};

  function btn(action, variant, icon, label, extra) {
    return '<button class="btn btn--' + variant + '" data-action="' + action + '" ' + (extra || '') + '>' +
      icon + '<span class="lbl">' + esc(label) + '</span></button>';
  }
  function iconPlus() { return '<svg viewBox="0 0 24 24"><path d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z"/></svg>'; }
  function iconSave() { return '<svg viewBox="0 0 24 24"><path d="M17 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V7l-4-4zm-5 16a3 3 0 1 1 0-6 3 3 0 0 1 0 6zm3-10H5V5h10v4z"/></svg>'; }
  function iconPrint() { return '<svg viewBox="0 0 24 24"><path d="M19 8H5a3 3 0 0 0-3 3v6h4v4h12v-4h4v-6a3 3 0 0 0-3-3zm-3 11H8v-5h8v5zm3-7a1 1 0 1 1 0-2 1 1 0 0 1 0 2zM18 3H6v4h12V3z"/></svg>'; }
  function iconBox() { return '<svg viewBox="0 0 24 24"><path d="M12 2 3 7v10l9 5 9-5V7l-9-5zm0 2.3L18.5 8 12 11.7 5.5 8 12 4.3z"/></svg>'; }
  function iconLayers() { return '<svg viewBox="0 0 24 24"><path d="M12 2 2 7l10 5 10-5-10-5zm0 9L4.2 7 12 4.3 19.8 7 12 11zM2 12l10 5 10-5 2 1-12 6L0 13l2-1z"/></svg>'; }
  function iconBell() { return '<svg viewBox="0 0 24 24"><path d="M12 22a2.5 2.5 0 0 0 2.45-2h-4.9A2.5 2.5 0 0 0 12 22zm6-6V11a6 6 0 0 0-5-5.9V4a1 1 0 1 0-2 0v1.1A6 6 0 0 0 6 11v5l-2 2v1h16v-1l-2-2z"/></svg>'; }
  function iconCart() { return '<svg viewBox="0 0 24 24"><path d="M7 18a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm10 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM6.2 4l.9 2H20a1 1 0 0 1 1 1.3l-2.4 8.3A2 2 0 0 1 16.6 17H8.5a2 2 0 0 1-1.9-1.5L4.3 6.5 3.6 4z"/></svg>'; }

  function badgeEstado(e) {
    if (e === 'sin') return '<span class="badge badge--danger"><span class="dot"></span>Sin stock</span>';
    if (e === 'bajo') return '<span class="badge badge--warn"><span class="dot"></span>Para reponer</span>';
    return '<span class="badge badge--ok"><span class="dot"></span>En nivel</span>';
  }

  function emptyApp() {
    return '<div class="card"><div class="card__body"><div class="empty">' +
      '<div class="empty__ic">' + iconBox() + '</div>' +
      '<h3>No hay artículos cargados</h3>' +
      '<p>Creá tu primer artículo o cargá el catálogo de ejemplo (Loekemeyer · OSA) para empezar.</p>' +
      '<div class="row" style="justify-content:center;">' +
      btn('nuevo-art', 'primary', iconPlus(), 'Crear artículo') +
      btn('demo', 'ghost', '', 'Cargar catálogo de ejemplo') +
      '</div></div></div></div>';
  }

  function stat(tone, icon, label, value, hint) {
    return '<div class="stat tone-' + tone + '"><div class="stat__ic">' + icon + '</div>' +
      '<div class="stat__label">' + esc(label) + '</div>' +
      '<div class="stat__value">' + value + '</div>' +
      '<div class="stat__hint">' + esc(hint) + '</div></div>';
  }

  /* ============================================================
     MÓDULO 1 · STOCKS
     ============================================================ */
  function renderStocks() {
    var arts = S.getArticulos({ soloActivos: true });
    if (!arts.length) return emptyApp();
    var stocks = S.computeStocks();

    var unidades = 0, valor = 0, sug = S.pedidoSugerido();
    var cajasPedido = sug.reduce(function (acc, x) { return acc + x.sugerido; }, 0);
    arts.forEach(function (a) {
      var s = Math.max(0, stocks[a.id]);
      unidades += s; valor += s * (a.precio || 0);
    });

    var html = '<div class="stats">';
    html += stat('primary', iconBox(), 'Artículos', fmtInt(arts.length), 'activos');
    html += stat('ok', iconLayers(), 'Cajas en stock', fmtInt(unidades), valor > 0 ? fmtMoney(valor) : 'en el cliente');
    html += stat(sug.length ? 'warn' : 'ok', iconBell(), 'Para reponer', fmtInt(sug.length), sug.length ? 'artículos' : 'todo en nivel');
    html += stat(cajasPedido ? 'danger' : 'primary', iconCart(), 'Cajas a pedir', fmtInt(cajasPedido), 'pedido sugerido');
    html += '</div>';

    html += '<div class="toolbar">' +
      '<div class="search"><svg viewBox="0 0 24 24"><path d="M21 20l-5.6-5.6a7 7 0 1 0-1.4 1.4L20 21zM4 10a5 5 0 1 1 10 0 5 5 0 0 1-10 0z"/></svg>' +
      '<input id="buscar" type="text" placeholder="Buscar por nombre o código…" value="' + esc(ui.busqueda) + '"></div>' +
      '<div class="chips">' +
      chip('todos', 'Todos') + chip('reponer', 'Para reponer') + chip('ok', 'En nivel') +
      '</div></div>';

    html += '<div class="card"><div class="table-wrap"><table class="table"><thead><tr>' +
      '<th>Artículo</th><th class="num">Stock hoy</th><th class="num">Punto de pedido</th>' +
      '<th class="num">Sugerido</th><th>Estado</th></tr></thead><tbody>';
    arts.forEach(function (a) {
      var s = stocks[a.id];
      var pp = S.puntoPedido(a);
      var sg = S.sugerido(a, s);
      var e = S.estado(a, s);
      var clase = sg > 0 ? 'reponer' : 'ok';
      html += '<tr data-art="' + a.id + '" data-clase="' + clase + '" ' +
        'data-search="' + esc((a.nombre + ' ' + (a.codigo || '')).toLowerCase()) + '" style="cursor:pointer;">' +
        '<td><div class="cell-art"><img src="' + fotoDe(a) + '" alt=""><div><div class="nm">' + esc(a.nombre) + '</div><div class="cd">' + esc(a.codigo || '') + '</div></div></div></td>' +
        '<td class="num"><strong>' + fmtInt(s) + '</strong></td>' +
        '<td class="num muted">' + fmtInt(pp) + '</td>' +
        '<td class="num">' + (sg > 0 ? '<span class="badge badge--warn">+' + fmtInt(sg) + '</span>' : '—') + '</td>' +
        '<td>' + badgeEstado(e) + '</td>' +
        '</tr>';
    });
    html += '</tbody></table></div></div>';
    return html;
  }
  function chip(val, label) {
    return '<button class="chip ' + (ui.filtro === val ? 'is-active' : '') + '" data-chip="' + val + '">' + esc(label) + '</button>';
  }
  function aplicarFiltroStocks() {
    var q = (ui.busqueda || '').toLowerCase();
    $$('[data-art]').forEach(function (tr) {
      var okq = !q || tr.getAttribute('data-search').indexOf(q) >= 0;
      var okf = ui.filtro === 'todos' || tr.getAttribute('data-clase') === ui.filtro;
      tr.style.display = (okq && okf) ? '' : 'none';
    });
  }
  afterRender.stocks = function () {
    var inp = $('#buscar');
    if (inp) inp.addEventListener('input', function () { ui.busqueda = inp.value; aplicarFiltroStocks(); });
    $$('[data-chip]').forEach(function (c) {
      c.addEventListener('click', function () {
        ui.filtro = c.getAttribute('data-chip');
        $$('[data-chip]').forEach(function (x) { x.classList.toggle('is-active', x === c); });
        aplicarFiltroStocks();
      });
    });
    $$('[data-art]').forEach(function (tr) {
      tr.addEventListener('click', function () { openArticulo(tr.getAttribute('data-art')); });
    });
    aplicarFiltroStocks();
  };

  /* ============================================================
     MÓDULO 2 · MOVIMIENTOS  (inicial + entregas − ventas = stock hoy)
     ============================================================ */
  function tipoLabel(t) {
    return t === 'entrega' ? 'Entrega a depósito' : (t === 'venta' ? 'Venta a cliente' : 'Ajuste');
  }
  function renderMovimientos() {
    var arts = S.getArticulos({ soloActivos: true });
    if (!arts.length) return emptyApp();
    var stocks = S.computeStocks();

    var html = '<div class="callout"><svg viewBox="0 0 24 24"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>' +
      '<div><strong>Stock hoy</strong> = stock inicial + entregas de Loeke − ventas de OSA. ' +
      'Tocá <strong>Ver</strong> en un artículo para ver sus movimientos y el saldo después de cada uno. ' +
      'El período de abajo filtra ese detalle.</div></div>';

    html += '<div class="toolbar" style="margin-top:18px;">' +
      '<label class="label" style="margin:0;display:flex;align-items:center;gap:8px;">Desde' +
      '<input class="input" id="movDesde" type="date" value="' + esc(ui.movDesde) + '" style="width:auto;padding:8px 10px;"></label>' +
      '<label class="label" style="margin:0;display:flex;align-items:center;gap:8px;">Hasta' +
      '<input class="input" id="movHasta" type="date" value="' + esc(ui.movHasta) + '" style="width:auto;padding:8px 10px;"></label>' +
      (ui.movDesde || ui.movHasta ? btn('mov-limpiar', 'ghost btn--sm', '', 'Limpiar período') : '') +
      '</div>';

    html += '<div class="card"><div class="table-wrap"><table class="table"><thead><tr>' +
      '<th>Artículo</th><th class="num">Inicial</th><th class="num">Entregas</th><th class="num">Ventas</th>' +
      '<th class="num">Stock hoy</th><th class="right">Detalle</th></tr></thead><tbody>';
    arts.forEach(function (a) {
      var t = S.totales(a.id);
      var abierto = !!ui.expanded[a.id];
      html += '<tr data-artrow="' + a.id + '">' +
        '<td><div class="cell-art"><img src="' + fotoDe(a) + '" alt=""><div><div class="nm">' + esc(a.nombre) + '</div><div class="cd">' + esc(a.codigo || '') + '</div></div></div></td>' +
        '<td class="num muted">' + fmtInt(a.stockInicial) + '</td>' +
        '<td class="num" style="color:var(--ok);">+' + fmtInt(t.entregas) + '</td>' +
        '<td class="num" style="color:var(--primary);">−' + fmtInt(t.ventas) + '</td>' +
        '<td class="num"><strong>' + fmtInt(stocks[a.id]) + '</strong></td>' +
        '<td class="right"><button class="btn btn--ghost btn--sm" data-vermov="' + a.id + '">' + (abierto ? 'Ocultar' : 'Ver') + '</button></td>' +
        '</tr>';
      html += '<tr class="mov-detail" data-detail="' + a.id + '"' + (abierto ? '' : ' hidden') + '>' +
        '<td colspan="6" style="background:var(--surface-2);">' + ledgerHTML(a.id) + '</td></tr>';
    });
    html += '</tbody></table></div></div>';
    return html;
  }
  function ledgerHTML(id) {
    var filas = S.movimientosConSaldo(id, { desde: ui.movDesde, hasta: ui.movHasta });
    if (!filas.length) {
      return '<p class="muted" style="padding:12px 4px;">Sin movimientos' + (ui.movDesde || ui.movHasta ? ' en el período' : '') + '. El saldo se mantiene en el stock inicial.</p>';
    }
    var html = '<table class="table" style="margin:4px 0;"><thead><tr>' +
      '<th>Fecha</th><th>Tipo</th><th class="num">Cantidad</th><th class="num">Saldo</th><th class="right"></th>' +
      '</tr></thead><tbody>';
    // Más reciente primero para leer cómodo
    filas.slice().reverse().forEach(function (f) {
      var m = f.mov;
      var signo = m.tipo === 'venta' ? '−' : (m.tipo === 'ajuste' && m.cantidad < 0 ? '−' : '+');
      var color = m.tipo === 'entrega' ? 'var(--ok)' : (m.tipo === 'venta' ? 'var(--primary)' : 'var(--warn)');
      html += '<tr>' +
        '<td>' + fmtFecha(m.fecha) + '</td>' +
        '<td>' + tipoLabel(m.tipo) + (m.nota ? ' <span class="muted">· ' + esc(m.nota) + '</span>' : '') + '</td>' +
        '<td class="num" style="color:' + color + ';font-weight:700;">' + signo + fmtInt(Math.abs(m.cantidad)) + '</td>' +
        '<td class="num"><strong>' + fmtInt(f.saldo) + '</strong></td>' +
        '<td class="right"><button class="iconbtn" data-delmov="' + m.id + '" title="Eliminar"><svg viewBox="0 0 24 24" width="16" height="16"><path d="M6 7h12l-1 14H7L6 7zm3-3h6l1 2h4v2H2V6h4l1-2z"/></svg></button></td>' +
        '</tr>';
    });
    html += '</tbody></table>';
    return html;
  }
  afterRender.movimientos = function () {
    var d = $('#movDesde'), h = $('#movHasta');
    if (d) d.addEventListener('change', function () { ui.movDesde = d.value; render(); });
    if (h) h.addEventListener('change', function () { ui.movHasta = h.value; render(); });
    bindAction('mov-limpiar', function () { ui.movDesde = ''; ui.movHasta = ''; render(); });
    $$('[data-vermov]').forEach(function (b) {
      b.addEventListener('click', function () {
        var id = b.getAttribute('data-vermov');
        var det = $('[data-detail="' + id + '"]');
        var abrir = det.hidden;
        det.hidden = !abrir;
        ui.expanded[id] = abrir;
        b.textContent = abrir ? 'Ocultar' : 'Ver';
      });
    });
    $$('[data-delmov]').forEach(function (b) {
      b.addEventListener('click', function () {
        var id = b.getAttribute('data-delmov');
        confirmar('Eliminar movimiento', 'El stock se recalcula sin este movimiento. ¿Continuar?', function () {
          S.removeMovimiento(id); toast('Movimiento eliminado', 'ok'); render();
        });
      });
    });
    // Si venimos de "Ver movimientos" de un artículo, abrir y centrar
    if (pendingExpand) {
      var row = $('[data-detail="' + pendingExpand + '"]');
      var arow = $('[data-artrow="' + pendingExpand + '"]');
      pendingExpand = null;
      if (row && arow) { arow.scrollIntoView({ block: 'center' }); }
    }
  };

  /* ============================================================
     MÓDULO 3 · PUNTO DE PEDIDO
     ============================================================ */
  function renderPunto() {
    var arts = S.getArticulos({ soloActivos: true });
    if (!arts.length) return emptyApp();
    var m = S.getMeta();

    var html = '<div class="grid-2">';
    html += '<div class="card"><div class="card__head"><h2>Parámetros globales</h2></div><div class="card__body">' +
      '<div class="form-grid">' +
      field('Meses de cobertura por defecto', '<input class="input" id="pMeses" type="number" min="0" step="0.5" value="' + esc(m.mesesPedidoDefault) + '">') +
      field('Meses del historial de ventas', '<input class="input" id="pPeriodo" type="number" min="1" step="1" value="' + esc(m.periodoMeses) + '">') +
      '</div>' +
      '<div class="hint"><strong>Punto de pedido</strong> = promedio de ventas mensual × meses de cobertura. ' +
      'El promedio automático es <em>ventas conocidas ÷ meses del historial</em>. Podés sobrescribir el promedio o los meses por artículo en la tabla.</div>' +
      '</div></div>';
    html += '<div class="card"><div class="card__body" style="display:flex;align-items:center;">' +
      '<div class="callout" style="margin:0;"><svg viewBox="0 0 24 24"><path d="M3 13h2v7H3zM10 8h2v12h-2zM17 4h2v16h-2z"/></svg>' +
      '<div>Dejá un campo <strong>en blanco</strong> para usar el valor automático (promedio) o el global (meses). ' +
      'Tocá <strong>Guardar</strong> arriba para aplicar los cambios.</div></div>' +
      '</div></div>';
    html += '</div>';

    html += '<div class="toolbar" style="margin-top:18px;">' +
      '<div class="search"><svg viewBox="0 0 24 24"><path d="M21 20l-5.6-5.6a7 7 0 1 0-1.4 1.4L20 21zM4 10a5 5 0 1 1 10 0 5 5 0 0 1-10 0z"/></svg>' +
      '<input id="buscarP" type="text" placeholder="Buscar artículo…" value="' + esc(ui.qPunto) + '"></div>' +
      '<span class="muted nowrap">' + arts.length + ' artículos</span></div>';

    html += '<div class="card"><div class="table-wrap"><table class="table"><thead><tr>' +
      '<th>Artículo</th><th class="num">Prom. auto</th><th class="num">Promedio usado</th>' +
      '<th class="num">Meses</th><th class="num">Punto de pedido</th></tr></thead><tbody>';
    arts.forEach(function (a) {
      var auto = S.promedioMensualAuto(a);
      html += '<tr data-rowp="' + a.id + '" data-search="' + esc((a.nombre + ' ' + (a.codigo || '')).toLowerCase()) + '">' +
        '<td><div class="cell-art"><img src="' + fotoDe(a) + '" alt=""><div><div class="nm">' + esc(a.nombre) + '</div><div class="cd">' + esc(a.codigo || '') + '</div></div></div></td>' +
        '<td class="num muted">' + fmtInt(auto) + '</td>' +
        '<td class="num"><input class="qty-input" type="number" min="0" step="0.5" value="' + (a.promedioManual != null ? a.promedioManual : '') + '" placeholder="' + fmtInt(auto) + '" data-prom="' + a.id + '"></td>' +
        '<td class="num"><input class="qty-input" type="number" min="0" step="0.5" value="' + (a.mesesPedido != null ? a.mesesPedido : '') + '" placeholder="' + esc(m.mesesPedidoDefault) + '" data-meses="' + a.id + '"></td>' +
        '<td class="num" data-pp="' + a.id + '"><strong>' + fmtInt(S.puntoPedido(a)) + '</strong></td>' +
        '</tr>';
    });
    html += '</tbody></table></div></div>';
    return html;
  }
  afterRender.puntopedido = function () {
    var b = $('#buscarP');
    if (b) b.addEventListener('input', function () {
      ui.qPunto = b.value; var q = b.value.toLowerCase();
      $$('[data-rowp]').forEach(function (tr) {
        tr.style.display = (!q || tr.getAttribute('data-search').indexOf(q) >= 0) ? '' : 'none';
      });
    });
    // Vista previa del punto de pedido al editar (sin guardar)
    function preview(id) {
      var a = S.getArticulo(id); if (!a) return;
      var promI = $('[data-prom="' + id + '"]'), mesI = $('[data-meses="' + id + '"]');
      var meta = S.getMeta();
      var prom = promI.value === '' ? S.promedioMensualAuto(a) : (parseFloat(promI.value) || 0);
      var mes = mesI.value === '' ? (meta.mesesPedidoDefault || 0) : (parseFloat(mesI.value) || 0);
      var cell = $('[data-pp="' + id + '"]');
      if (cell) cell.innerHTML = '<strong>' + fmtInt(prom * mes) + '</strong>';
    }
    $$('[data-prom]').forEach(function (i) { i.addEventListener('input', function () { preview(i.getAttribute('data-prom')); }); });
    $$('[data-meses]').forEach(function (i) { i.addEventListener('input', function () { preview(i.getAttribute('data-meses')); }); });
    var gM = $('#pMeses'), gP = $('#pPeriodo');
    if (gM) gM.addEventListener('input', function () { $$('[data-prom]').forEach(function (i) { preview(i.getAttribute('data-prom')); }); });
    if (gP) gP.addEventListener('input', function () { $$('[data-prom]').forEach(function (i) { preview(i.getAttribute('data-prom')); }); });
  };
  function guardarPunto() {
    var gM = $('#pMeses'), gP = $('#pPeriodo');
    if (gM || gP) {
      S.setMeta({
        mesesPedidoDefault: Math.max(0, parseFloat(gM.value) || 0),
        periodoMeses: Math.max(1, Math.round(parseFloat(gP.value) || 1))
      });
    }
    var n = 0;
    $$('[data-prom]').forEach(function (i) {
      var id = i.getAttribute('data-prom');
      var mesI = $('[data-meses="' + id + '"]');
      S.updateArticulo(id, {
        promedioManual: i.value === '' ? null : i.value,
        mesesPedido: mesI && mesI.value === '' ? null : (mesI ? mesI.value : null)
      });
      n++;
    });
    toast('Punto de pedido actualizado', 'ok');
    render();
  }

  /* ============================================================
     MÓDULO 4 / 5 · ENTREGAS LOEKE  /  VENTAS OSA  (carga rápida)
     ============================================================ */
  function renderCarga(tipo) {
    var arts = S.getArticulos({ soloActivos: true });
    if (!arts.length) return emptyApp();
    var stocks = S.computeStocks();
    var esVenta = tipo === 'venta';
    var titulo = esVenta ? 'Ventas de OSA a sus clientes' : 'Entregas de Loeke a OSA';
    var explica = esVenta
      ? 'Cargá las cajas que OSA <strong>vendió</strong> a sus clientes. Salen del stock.'
      : 'Cargá las cajas que <strong>Loeke entregó</strong> a OSA. Entran al stock.';
    var fmtFut = esVenta ? 'Importación desde <strong>PDF</strong> (ventas totales por artículo): próximamente.' : 'Importación desde <strong>Excel</strong>: próximamente.';

    var html = '<div class="callout"><svg viewBox="0 0 24 24"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg><div>' + explica + ' <span class="muted">' + fmtFut + '</span></div></div>';
    html += '<div class="card" style="margin-top:18px;">';
    html += '<div class="card__head"><h2>' + titulo + '</h2><div class="spacer"></div>' +
      '<label class="label" style="margin:0;display:flex;align-items:center;gap:8px;">Fecha' +
      '<input class="input" id="cargaFecha" type="date" value="' + S.hoyISO() + '" style="width:auto;padding:8px 10px;"></label></div>';
    html += '<div class="search" style="margin:0 18px 4px;flex:none;"><svg viewBox="0 0 24 24"><path d="M21 20l-5.6-5.6a7 7 0 1 0-1.4 1.4L20 21zM4 10a5 5 0 1 1 10 0 5 5 0 0 1-10 0z"/></svg>' +
      '<input id="buscarCarga" type="text" placeholder="Buscar artículo…"></div>';
    html += '<div class="table-wrap"><table class="table"><thead><tr>' +
      '<th>Artículo</th><th class="num">Stock actual</th>' +
      (esVenta ? '<th class="num">Vendidas</th>' : '<th class="num">Entregadas</th>') + '<th class="num">Quedaría</th>' +
      '</tr></thead><tbody>';
    arts.forEach(function (a) {
      var s = stocks[a.id];
      html += '<tr data-rowc data-search="' + esc((a.nombre + ' ' + (a.codigo || '')).toLowerCase()) + '">' +
        '<td><div class="cell-art"><img src="' + fotoDe(a) + '" alt=""><div><div class="nm">' + esc(a.nombre) + '</div><div class="cd">' + esc(a.codigo || '') + '</div></div></div></td>' +
        '<td class="num">' + fmtInt(s) + '</td>' +
        '<td class="num"><input class="qty-input" type="number" min="0" step="1" value="" placeholder="0" data-qty="' + a.id + '" data-stock="' + s + '"></td>' +
        '<td class="num" data-result="' + a.id + '">' + fmtInt(s) + '</td>' +
        '</tr>';
    });
    html += '</tbody></table></div>';
    html += '<div class="card__body" style="border-top:1px solid var(--line);"><div class="row" style="justify-content:flex-end;gap:10px;">' +
      '<span class="muted" id="cargaResumen" style="margin-right:auto;">0 artículos cargados</span>' +
      btn(esVenta ? 'guardar-ventas' : 'guardar-entregas', 'primary', iconSave(), esVenta ? 'Guardar ventas' : 'Registrar entregas') +
      '</div></div>';
    html += '</div>';
    return html;
  }
  function renderVentas() { return renderCarga('venta'); }
  function renderEntregas() { return renderCarga('entrega'); }

  function bindCarga(esVenta) {
    var bc = $('#buscarCarga');
    if (bc) bc.addEventListener('input', function () {
      var q = bc.value.toLowerCase();
      $$('[data-rowc]').forEach(function (tr) {
        tr.style.display = (!q || tr.getAttribute('data-search').indexOf(q) >= 0) ? '' : 'none';
      });
    });
    $$('[data-qty]').forEach(function (inp) {
      inp.addEventListener('input', function () {
        var id = inp.getAttribute('data-qty');
        var s = parseFloat(inp.getAttribute('data-stock')) || 0;
        var q = parseFloat(inp.value) || 0;
        var res = esVenta ? s - q : s + q;
        var cell = $('[data-result="' + id + '"]');
        var a = S.getArticulo(id);
        cell.textContent = fmtInt(res);
        cell.style.color = res < 0 ? 'var(--danger)' : (res < S.puntoPedido(a) ? 'var(--warn)' : '');
        cell.style.fontWeight = '700';
        var n = $$('[data-qty]').filter(function (i) { return (parseFloat(i.value) || 0) > 0; }).length;
        $('#cargaResumen').textContent = n + (n === 1 ? ' artículo cargado' : ' artículos cargados');
      });
    });
  }
  afterRender.ventas = function () { bindCarga(true); };
  afterRender.entregas = function () { bindCarga(false); };

  function guardarCarga(esVenta) {
    var fecha = $('#cargaFecha') ? $('#cargaFecha').value : S.hoyISO();
    var batch = [];
    $$('[data-qty]').forEach(function (inp) {
      var q = Math.round(parseFloat(inp.value) || 0);
      if (q > 0) batch.push({ articuloId: inp.getAttribute('data-qty'), tipo: esVenta ? 'venta' : 'entrega', cantidad: q, fecha: fecha, nota: esVenta ? 'Venta OSA' : 'Entrega Loeke' });
    });
    if (!batch.length) { toast('Cargá al menos una cantidad', 'warn'); return; }
    S.addMovimientosBatch(batch);
    var n = batch.length;
    if (esVenta) {
      var pend = S.pedidoSugerido().length;
      toast('Ventas guardadas: ' + n + ' artículo(s)', 'ok');
      render();
      if (pend) setTimeout(function () { toast(pend + ' artículo(s) necesitan reposición', 'warn'); }, 600);
    } else {
      toast('Entregas registradas: ' + n + ' artículo(s)', 'ok');
      render();
    }
  }

  function openAjuste() {
    var arts = S.getArticulos({ soloActivos: true });
    if (!arts.length) { toast('Primero creá un artículo', 'warn'); return; }
    var opts = arts.map(function (a) { return '<option value="' + a.id + '">' + esc(a.nombre) + (a.codigo ? ' (' + esc(a.codigo) + ')' : '') + '</option>'; }).join('');
    var body = '<form class="form" id="ajForm">' +
      field('Artículo', '<select class="select" id="ajArt">' + opts + '</select>', true) +
      '<div class="form-grid">' +
      field('Cantidad', '<input class="input" id="ajCant" type="number" step="1" value="0" placeholder="Negativo para descontar">') +
      field('Fecha', '<input class="input" id="ajFecha" type="date" value="' + S.hoyISO() + '">') +
      '</div>' +
      field('Nota <span class="opt">(opcional)</span>', '<input class="input" id="ajNota" placeholder="Ej: rotura, faltante, recuento">', true) +
      '<div class="hint">Un ajuste suma o resta cajas directamente (roturas, vencimientos, recuentos). Usá número negativo para descontar.</div>' +
      '<div class="form-actions"><button type="button" class="btn btn--ghost" data-close>Cancelar</button>' +
      '<button type="submit" class="btn btn--primary">Guardar ajuste</button></div></form>';
    openModal('Ajuste manual de stock', body);
    $('#ajForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var c = Math.round(parseFloat($('#ajCant').value) || 0);
      if (!c) { toast('Ingresá una cantidad distinta de 0', 'warn'); return; }
      S.addMovimiento({ articuloId: $('#ajArt').value, tipo: 'ajuste', cantidad: c, fecha: $('#ajFecha').value, nota: $('#ajNota').value });
      closeModal(); toast('Ajuste registrado', 'ok'); render();
    });
  }

  /* ============================================================
     ARTÍCULO · detalle + edición (desde Stocks)
     ============================================================ */
  function openArticulo(id) {
    var a = id ? S.getArticulo(id) : null;
    var foto = a ? a.foto : '';
    var stock = a ? S.stockActual(id) : 0;
    var resumen = '';
    if (a) {
      var e = S.estado(a, stock);
      resumen = '<div class="stats" style="margin-bottom:16px;">' +
        miniStat('Stock hoy', e === 'sin' ? '0' : fmtInt(stock)) +
        miniStat('Punto de pedido', fmtInt(S.puntoPedido(a))) +
        miniStat('Sugerido', fmtInt(S.sugerido(a, stock))) +
        miniStat('Prom. mensual', fmtInt(S.promedioMensual(a))) +
        '</div>';
    }
    var body = '' +
      (a ? resumen : '') +
      '<form class="form" id="artForm">' +
      '<div class="imgdrop" id="imgdrop">' +
      '<img class="imgdrop__preview" id="imgPreview" src="' + esc(foto || S.placeholder(a ? a.nombre : 'Nuevo')) + '" alt="">' +
      '<div class="imgdrop__text"><strong>Foto del artículo</strong><span>Tocá para subir una imagen (JPG/PNG). Se optimiza sola.</span></div>' +
      '<input type="file" id="imgInput" accept="image/*" hidden>' +
      '</div>' +
      '<input type="hidden" id="fFoto" value="' + esc(foto) + '">' +
      '<div class="form-grid">' +
      field('Nombre', '<input class="input" id="fNombre" value="' + esc(a ? a.nombre : '') + '" placeholder="Ej: Pelador mango plástico" required>', true) +
      field('Código / SKU <span class="opt">(opcional)</span>', '<input class="input" id="fCodigo" value="' + esc(a ? a.codigo : '') + '" placeholder="Ej: 505">') +
      field('Stock inicial', '<input class="input" id="fInicial" type="number" min="0" step="1" value="' + (a ? a.stockInicial : 0) + '">') +
      field('Descripción <span class="opt">(opcional)</span>', '<textarea class="textarea" id="fDesc" placeholder="Detalle…">' + esc(a ? a.descripcion : '') + '</textarea>', true) +
      field('Promedio mensual <span class="opt">(en blanco = auto)</span>', '<input class="input" id="fProm" type="number" min="0" step="0.5" value="' + (a && a.promedioManual != null ? a.promedioManual : '') + '" placeholder="' + (a ? fmtInt(S.promedioMensualAuto(a)) : '0') + '">') +
      field('Meses de cobertura <span class="opt">(en blanco = global)</span>', '<input class="input" id="fMeses" type="number" min="0" step="0.5" value="' + (a && a.mesesPedido != null ? a.mesesPedido : '') + '" placeholder="' + esc(S.getMeta().mesesPedidoDefault) + '">') +
      field('Precio unitario <span class="opt">(opcional)</span>', '<div class="input-prefix"><span>$</span><input class="input" id="fPrecio" type="number" min="0" step="0.01" value="' + (a ? a.precio : 0) + '"></div>') +
      '</div>' +
      '<div class="hint">El <strong>punto de pedido</strong> se calcula como promedio mensual × meses de cobertura. Dejá los campos en blanco para usar el promedio automático y los meses globales.</div>' +
      '<div class="form-actions">' +
      (a ? '<button type="button" class="btn btn--ghost" id="fVerMov">Ver movimientos</button>' : '') +
      (a ? '<button type="button" class="btn btn--danger" id="fEliminar">Eliminar</button>' : '') +
      '<div style="flex:1"></div>' +
      '<button type="button" class="btn btn--ghost" data-close>Cancelar</button>' +
      '<button type="submit" class="btn btn--primary">' + iconSave() + '<span>Guardar</span></button>' +
      '</div></form>';
    openModal(a ? 'Artículo' : 'Nuevo artículo', body);

    var preview = $('#imgPreview'), fFoto = $('#fFoto'), fNombre = $('#fNombre');
    $('#imgdrop').addEventListener('click', function () { $('#imgInput').click(); });
    $('#imgInput').addEventListener('change', function (e) {
      var file = e.target.files[0];
      if (!file) return;
      comprimirImagen(file, function (dataUrl) { fFoto.value = dataUrl; preview.src = dataUrl; });
    });
    if (!foto) fNombre.addEventListener('input', function () { if (!fFoto.value) preview.src = S.placeholder(fNombre.value || 'Nuevo'); });

    if (a) $('#fVerMov').addEventListener('click', function () {
      closeModal(); ui.expanded[a.id] = true; pendingExpand = a.id; location.hash = '#/movimientos'; setView('movimientos');
    });
    if (a) $('#fEliminar').addEventListener('click', function () {
      confirmar('Eliminar artículo', '¿Eliminar «' + a.nombre + '» y todos sus movimientos? Esta acción no se puede deshacer.', function () {
        S.removeArticulo(a.id); closeModal(); toast('Artículo eliminado', 'ok'); render();
      });
    });
    $('#artForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var data = {
        nombre: fNombre.value, codigo: $('#fCodigo').value, descripcion: $('#fDesc').value,
        foto: fFoto.value, precio: $('#fPrecio').value, stockInicial: $('#fInicial').value,
        promedioManual: $('#fProm').value === '' ? null : $('#fProm').value,
        mesesPedido: $('#fMeses').value === '' ? null : $('#fMeses').value
      };
      if (!data.nombre.trim()) { toast('Poné un nombre al artículo', 'warn'); return; }
      if (a) { S.updateArticulo(a.id, data); toast('Artículo actualizado', 'ok'); }
      else { S.addArticulo(data); toast('Artículo creado', 'ok'); }
      closeModal(); render();
    });
  }
  function miniStat(label, value) {
    return '<div class="stat tone-primary" style="padding:14px;"><div class="stat__label">' + esc(label) + '</div><div class="stat__value" style="font-size:22px;">' + value + '</div></div>';
  }

  /* ---------- Impresión del pedido sugerido ---------- */
  function imprimirSugerido() {
    var sug = S.pedidoSugerido();
    if (!sug.length) { toast('No hay nada para reponer', 'info'); return; }
    var meta = S.getMeta();
    var totalU = sug.reduce(function (acc, x) { return acc + x.sugerido; }, 0);
    var rows = sug.map(function (x) {
      var a = x.articulo;
      return '<tr><td>' + esc(a.codigo || '') + '</td><td>' + esc(a.nombre) + '</td>' +
        '<td style="text-align:right">' + fmtInt(x.stock) + '</td>' +
        '<td style="text-align:right">' + fmtInt(x.punto) + '</td>' +
        '<td style="text-align:right"><strong>' + fmtInt(x.sugerido) + '</strong></td></tr>';
    }).join('');
    var html = '<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>Pedido sugerido</title>' +
      '<style>body{font-family:Inter,Arial,sans-serif;color:#1c2233;margin:40px;}h1{font-size:22px;margin:0 0 2px;}' +
      '.muted{color:#6b7390;}table{width:100%;border-collapse:collapse;margin-top:18px;}' +
      'th,td{padding:9px 10px;border-bottom:1px solid #e3e6f0;font-size:13px;text-align:left;}' +
      'th{background:#f5f6fb;text-transform:uppercase;font-size:11px;letter-spacing:.04em;color:#6b7390;}' +
      '.head{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #4f46e5;padding-bottom:14px;}' +
      '.tot{margin-top:14px;text-align:right;font-size:15px;font-weight:700;}.brand{font-size:13px;color:#4f46e5;font-weight:700;}</style></head><body>' +
      '<div class="head"><div><div class="brand">PEDIDO SUGERIDO</div><h1>' + esc(meta.empresa || 'Mi Empresa') + '</h1>' +
      (meta.cliente ? '<div class="muted">Cliente: ' + esc(meta.cliente) + '</div>' : '') + '</div>' +
      '<div class="muted" style="text-align:right">Fecha: ' + fmtFecha(S.hoyISO()) + '</div></div>' +
      '<table><thead><tr><th>Código</th><th>Artículo</th><th style="text-align:right">Stock hoy</th>' +
      '<th style="text-align:right">Punto</th><th style="text-align:right">A pedir</th></tr></thead>' +
      '<tbody>' + rows + '</tbody></table>' +
      '<div class="tot">Total cajas a pedir: ' + fmtInt(totalU) + '</div>' +
      '<p class="muted" style="margin-top:40px;font-size:12px;">Generado con StockRotativo · ' + fmtFecha(S.hoyISO()) + '</p>' +
      '</body></html>';
    var w = window.open('', '_blank');
    if (!w) { toast('Permití las ventanas emergentes para imprimir', 'warn'); return; }
    w.document.write(html); w.document.close();
    setTimeout(function () { w.focus(); w.print(); }, 350);
  }

  /* ============================================================
     MÓDULO · CONFIGURACIÓN
     ============================================================ */
  function renderConfig() {
    var m = S.getMeta();
    var html = '<div class="grid-2">';
    html += '<div class="card"><div class="card__head"><h2>Datos del negocio</h2></div><div class="card__body">' +
      '<form class="form" id="cfgForm">' +
      field('Nombre de tu empresa', '<input class="input" id="cEmpresa" value="' + esc(m.empresa) + '">', true) +
      field('Cliente (consignatario)', '<input class="input" id="cCliente" value="' + esc(m.cliente) + '" placeholder="Ej: Osa Distribuidora SRL">', true) +
      '<div class="form-grid">' +
      field('Moneda', '<select class="select" id="cMoneda">' +
        ['ARS', 'USD', 'EUR', 'CLP', 'MXN', 'UYU', 'COP', 'PEN', 'BRL'].map(function (x) {
          return '<option value="' + x + '"' + (m.moneda === x ? ' selected' : '') + '>' + x + '</option>';
        }).join('') + '</select>') +
      field('Meses del historial de ventas', '<input class="input" id="cPeriodo" type="number" min="1" step="1" value="' + esc(m.periodoMeses) + '">') +
      '</div>' +
      '<div class="hint">«Meses del historial» es el período que abarcan las ventas conocidas de cada artículo; se usa para el promedio mensual automático.</div>' +
      '<div class="form-actions"><button type="submit" class="btn btn--primary">Guardar cambios</button></div>' +
      '</form></div></div>';
    html += '<div class="card"><div class="card__head"><h2>Datos y respaldo</h2></div><div class="card__body">' +
      '<p class="muted" style="margin-bottom:14px;line-height:1.5;">Tus datos se guardan en este navegador. Descargá un respaldo periódicamente o pasalo a otra computadora.</p>' +
      '<div class="row" style="gap:10px;">' +
      btn('export', 'ghost', '<svg viewBox="0 0 24 24"><path d="M12 16 7 11l1.4-1.4L11 12.2V4h2v8.2l2.6-2.6L17 11l-5 5zm-7 2h14v2H5z"/></svg>', 'Descargar respaldo') +
      btn('import', 'ghost', '<svg viewBox="0 0 24 24"><path d="M12 4l5 5-1.4 1.4L13 7.8V16h-2V7.8L8.4 10.4 7 9l5-5zM5 18h14v2H5z"/></svg>', 'Importar respaldo') +
      '<input type="file" id="importFile" accept="application/json,.json" hidden>' +
      '</div>' +
      '<div style="height:1px;background:var(--line);margin:18px 0;"></div>' +
      '<div class="row" style="gap:10px;">' +
      btn('demo', 'ghost', '', 'Cargar catálogo de ejemplo') +
      btn('reset', 'danger', '', 'Borrar todo') +
      '</div></div></div>';
    html += '</div>';

    html += '<div class="card" style="margin-top:18px;"><div class="card__head"><h2>¿Cómo funciona?</h2></div><div class="card__body">' +
      '<ol style="margin:0;padding-left:20px;line-height:1.9;color:var(--muted);">' +
      '<li><strong style="color:var(--text)">Stocks</strong>: ves el stock de hoy, el punto de pedido y el pedido sugerido de cada artículo.</li>' +
      '<li><strong style="color:var(--text)">Movimientos</strong>: inicial + entregas de Loeke − ventas de OSA = stock hoy. Tocá un artículo para ver su saldo.</li>' +
      '<li><strong style="color:var(--text)">Punto de pedido</strong>: promedio de ventas × meses de cobertura. Lo ajustás global o por artículo.</li>' +
      '<li><strong style="color:var(--text)">Entregas Loeke</strong> y <strong style="color:var(--text)">Ventas OSA</strong>: cargás el movimiento y el stock se actualiza solo.</li>' +
      '</ol></div></div>';

    html += '<p class="muted text-c" style="margin-top:20px;font-size:12px;">StockRotativo · versión ' + APP_VERSION + '</p>';
    return html;
  }
  afterRender.config = function () {
    $('#cfgForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var meses = Math.max(1, Math.round(parseFloat($('#cPeriodo').value) || 17));
      S.setMeta({ empresa: $('#cEmpresa').value, cliente: $('#cCliente').value, moneda: $('#cMoneda').value, periodoMeses: meses });
      toast('Configuración guardada', 'ok'); updateBrand(); render();
    });
    bindAction('export', exportar);
    bindAction('import', function () { $('#importFile').click(); });
    $('#importFile').addEventListener('change', importar);
    bindAction('reset', function () {
      confirmar('Borrar todo', 'Se eliminarán TODOS los artículos, movimientos y pedidos de este navegador. ¿Seguro?', function () {
        S.resetAll(); toast('Datos borrados', 'ok'); location.hash = '#/stocks'; setView('stocks');
      });
    });
  };
  function exportar() {
    var blob = new Blob([S.exportData()], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = 'stockrotativo-respaldo-' + S.hoyISO() + '.json';
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    toast('Respaldo descargado', 'ok');
  }
  function importar(e) {
    var file = e.target.files[0]; if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      try { S.importData(reader.result); toast('Respaldo importado', 'ok'); render(); }
      catch (err) { toast('El archivo no es válido', 'danger'); }
    };
    reader.readAsText(file);
  }
  function cargarDemo() {
    confirmar('Cargar ejemplo', 'Esto reemplaza los datos actuales con el catálogo de ejemplo (Loekemeyer · OSA). ¿Continuar?', function () {
      S.loadDemo(); toast('Catálogo de ejemplo cargado', 'ok'); updateBrand(); location.hash = '#/stocks'; setView('stocks');
    });
  }

  /* ============================================================
     Helpers compartidos
     ============================================================ */
  function field(label, control, full) {
    return '<div class="field' + (full ? ' field--full' : '') + '"><label class="label">' + label + '</label>' + control + '</div>';
  }
  function bindAction(action, fn) {
    $$('[data-action="' + action + '"]').forEach(function (b) { b.addEventListener('click', fn); });
  }
  function confirmar(titulo, mensaje, onYes) {
    var body = '<p style="line-height:1.55;color:var(--muted);margin-bottom:20px;">' + esc(mensaje) + '</p>' +
      '<div class="form-actions"><button class="btn btn--ghost" data-close>Cancelar</button>' +
      '<button class="btn btn--primary" id="confirmYes">Confirmar</button></div>';
    openModal(titulo, body);
    $('#confirmYes').addEventListener('click', function () { closeModal(); onYes(); });
  }
  // Compresión de imagen en el navegador (redimensiona a máx 760px y exporta JPEG)
  function comprimirImagen(file, cb) {
    var reader = new FileReader();
    reader.onload = function () {
      var img = new Image();
      img.onload = function () {
        var max = 760;
        var w = img.width, h = img.height;
        if (w > h && w > max) { h = Math.round(h * max / w); w = max; }
        else if (h > max) { w = Math.round(w * max / h); h = max; }
        var canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        try { cb(canvas.toDataURL('image/jpeg', 0.8)); }
        catch (e) { cb(reader.result); }
      };
      img.onerror = function () { cb(reader.result); };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  }

  /* ---------- Delegación global para acciones de topbar / vacíos ---------- */
  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-action]');
    if (!t) return;
    var act = t.getAttribute('data-action');
    if (act === 'nuevo-art') openArticulo(null);
    else if (act === 'print-sugerido') imprimirSugerido();
    else if (act === 'guardar-punto') guardarPunto();
    else if (act === 'guardar-ventas') guardarCarga(true);
    else if (act === 'guardar-entregas') guardarCarga(false);
    else if (act === 'nuevo-ajuste') openAjuste();
    else if (act === 'demo') cargarDemo();
  });

  /* ---------- Init ---------- */
  function init() {
    var vEl = $('#appVersion');
    if (vEl) vEl.textContent = 'v' + APP_VERSION;
    // Aviso si falla un guardado (p. ej. localStorage lleno). Con throttle para
    // no apilar toasts si fallan varios guardados seguidos.
    var ultErr = 0;
    S.setSaveErrorHandler(function () {
      var ahora = Date.now();
      if (ahora - ultErr < 3000) return;
      ultErr = ahora;
      toast('No se pudo guardar: el almacenamiento del navegador está lleno. Descargá un respaldo y quitá fotos pesadas.', 'danger');
    });
    var v = (location.hash || '').replace('#/', '');
    setView(v || 'stocks');
  }
  init();
})();
