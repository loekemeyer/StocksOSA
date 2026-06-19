/* ============================================================
   StockRotativo · Interfaz y navegación
   ============================================================ */
(function () {
  'use strict';

  var S = window.Store;
  var APP_VERSION = '1.0.4';

  /* ---------- Estado de UI ---------- */
  var ui = {
    view: 'panel',
    busqueda: '',
    filtro: 'todos' // todos | bajo | ok
  };

  var VIEWS = {
    panel: { title: 'Panel', sub: 'Resumen general de tu stock rotativo' },
    compras: { title: 'Compra por quincena', sub: 'Promedio que te compra el cliente, de mayor a menor' },
    articulos: { title: 'Artículos', sub: 'Catálogo de productos en consignación' },
    ventas: { title: 'Cargar ventas', sub: 'Informe quincenal de ventas del cliente' },
    entregas: { title: 'Cargar entregas', sub: 'Mercadería que entregaste al cliente' },
    pedido: { title: 'Pedido sugerido', sub: 'Reposición automática según el stock' },
    movimientos: { title: 'Movimientos', sub: 'Historial de entregas, ventas y ajustes' },
    config: { title: 'Configuración', sub: 'Datos, respaldo y preferencias' }
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
  // Sin separadores de miles ni comas (números "planos"). Sin decimales (redondeado).
  function fmtInt(n) { return String(Math.round(n || 0)); }
  function fmtDec(n) { return String(Math.round(n || 0)); }
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
  function fotoDe(a) { return a.foto || S.placeholder(a.nombre); }

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
    if (!VIEWS[v]) v = 'panel';
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
    if (ui.view === 'articulos') actions = btn('nuevo-art', 'primary', iconPlus(), 'Nuevo artículo');
    else if (ui.view === 'ventas') actions = btn('guardar-ventas', 'primary', iconSave(), 'Guardar informe');
    else if (ui.view === 'entregas') actions = btn('guardar-entregas', 'primary', iconSave(), 'Registrar entregas');
    else if (ui.view === 'pedido') actions = btn('print-sugerido', 'ghost', iconPrint(), 'Imprimir');
    $('#topbarActions').innerHTML = actions;

    var fn = ({
      panel: renderPanel, compras: renderCompras, articulos: renderArticulos, ventas: renderVentas,
      entregas: renderEntregas, pedido: renderPedido, movimientos: renderMovimientos, config: renderConfig
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

  /* ============================================================
     PANEL
     ============================================================ */
  function renderPanel() {
    var arts = S.getArticulos({ soloActivos: true });
    var stocks = S.computeStocks();
    if (!arts.length) return emptyApp();

    var unidades = 0, valor = 0, alertas = 0, sinStock = 0;
    arts.forEach(function (a) {
      var s = stocks[a.id];
      unidades += Math.max(0, s);
      valor += Math.max(0, s) * (a.precio || 0);
      var e = S.estado(a, s);
      if (e === 'bajo' || e === 'sin') alertas++;
      if (e === 'sin') sinStock++;
    });
    var sug = S.pedidoSugerido();
    var unidadesPedido = sug.reduce(function (acc, x) { return acc + x.sugerido; }, 0);

    var html = '';
    html += '<div class="stats">';
    html += stat('primary', iconBox(), 'Artículos activos', fmtInt(arts.length), 'en consignación');
    html += stat('ok', iconLayers(), 'Cajas en stock', fmtInt(unidades), valor > 0 ? fmtMoney(valor) + ' en mercadería' : 'en el cliente');
    html += stat(alertas ? 'warn' : 'ok', iconBell(), 'Para reponer', fmtInt(alertas), alertas ? 'artículos bajo el punto' : 'todo en nivel');
    html += stat(sinStock ? 'danger' : 'primary', iconCart(), 'Pedido sugerido', fmtInt(unidadesPedido), sinStock ? sinStock + ' sin stock' : 'cajas a reponer');
    html += '</div>';

    html += '<div class="grid-2">';
    // Alertas
    html += '<div class="card"><div class="card__head"><h2>Necesita reposición</h2><div class="spacer"></div>';
    if (sug.length) html += btn('ir-pedido', 'ghost btn--sm', '', 'Ver pedido');
    html += '</div><div class="card__body">';
    if (!sug.length) {
      html += '<div class="callout"><svg viewBox="0 0 24 24"><path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z"/></svg>' +
        '<div>Todos los artículos están por encima de su punto de pedido. ¡No hay nada que reponer por ahora!</div></div>';
    } else {
      html += '<ul class="list-reset">';
      sug.slice(0, 6).forEach(function (x) {
        var a = x.articulo;
        html += '<li class="timeline-item">' +
          '<img class="cell-art-img" src="' + fotoDe(a) + '" alt="" style="width:40px;height:40px;border-radius:9px;object-fit:cover;flex:none;">' +
          '<div class="timeline-main"><div class="ttl">' + esc(a.nombre) + '</div>' +
          '<div class="sub">Stock: <strong>' + fmtInt(x.stock) + '</strong> · Punto: ' + fmtInt(a.puntoPedido) + ' · Máx: ' + fmtInt(a.stockMaximo) + '</div></div>' +
          '<div class="timeline-qty badge badge--warn">+' + fmtInt(x.sugerido) + '</div></li>';
      });
      html += '</ul>';
    }
    html += '</div></div>';

    // Actividad reciente
    var movs = S.getMovimientos().slice(0, 7);
    html += '<div class="card"><div class="card__head"><h2>Actividad reciente</h2><div class="spacer"></div>';
    if (movs.length) html += btn('ir-movimientos', 'ghost btn--sm', '', 'Ver todo');
    html += '</div><div class="card__body">';
    if (!movs.length) html += '<p class="muted text-c" style="padding:18px 0;">Todavía no hay movimientos registrados.</p>';
    else { html += '<ul class="list-reset">'; movs.forEach(function (m) { html += movItem(m); }); html += '</ul>'; }
    html += '</div></div>';
    html += '</div>';
    return html;
  }
  afterRender.panel = function () {
    bindAction('ir-pedido', function () { location.hash = '#/pedido'; });
    bindAction('ir-movimientos', function () { location.hash = '#/movimientos'; });
  };

  function stat(tone, icon, label, value, hint) {
    return '<div class="stat tone-' + tone + '"><div class="stat__ic">' + icon + '</div>' +
      '<div class="stat__label">' + esc(label) + '</div>' +
      '<div class="stat__value">' + value + '</div>' +
      '<div class="stat__hint">' + esc(hint) + '</div></div>';
  }
  function iconBox() { return '<svg viewBox="0 0 24 24"><path d="M12 2 3 7v10l9 5 9-5V7l-9-5zm0 2.3L18.5 8 12 11.7 5.5 8 12 4.3z"/></svg>'; }
  function iconLayers() { return '<svg viewBox="0 0 24 24"><path d="M12 2 2 7l10 5 10-5-10-5zm0 9L4.2 7 12 4.3 19.8 7 12 11zM2 12l10 5 10-5 2 1-12 6L0 13l2-1zm0 5 10 5 10-5 2 1-12 6L0 18l2-1z"/></svg>'; }
  function iconBell() { return '<svg viewBox="0 0 24 24"><path d="M12 22a2.5 2.5 0 0 0 2.45-2h-4.9A2.5 2.5 0 0 0 12 22zm6-6V11a6 6 0 0 0-5-5.9V4a1 1 0 1 0-2 0v1.1A6 6 0 0 0 6 11v5l-2 2v1h16v-1l-2-2z"/></svg>'; }
  function iconCart() { return '<svg viewBox="0 0 24 24"><path d="M7 18a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm10 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM6.2 4l.9 2H20a1 1 0 0 1 1 1.3l-2.4 8.3A2 2 0 0 1 16.6 17H8.5a2 2 0 0 1-1.9-1.5L4.3 6.5 3.6 4z"/></svg>'; }

  function movItem(m) {
    var a = S.getArticulo(m.articuloId);
    var nombre = a ? a.nombre : '(artículo eliminado)';
    var t = m.tipo;
    var cls = t === 'entrega' ? 't-entrega' : (t === 'venta' ? 't-venta' : 't-ajuste');
    var ic = t === 'entrega'
      ? '<svg viewBox="0 0 24 24"><path d="M12 4v10l4-4 1.4 1.4L12 17 5.6 11.4 7 10l4 4V4z" transform="rotate(180 12 12)"/></svg>'
      : (t === 'venta'
        ? '<svg viewBox="0 0 24 24"><path d="M12 4v10l4-4 1.4 1.4L12 17 5.6 11.4 7 10l4 4V4z"/></svg>'
        : '<svg viewBox="0 0 24 24"><path d="M3 17v2h6v-2H3zM3 5v2h10V5H3zm10 16v-2h8v-2h-8v-2h-2v6h2zM7 9v2H3v2h4v2h2V9H7zm14 4v-2H11v2h10zm-6-4h2V7h4V5h-4V3h-2v6z"/></svg>');
    var signo = t === 'venta' ? '−' : (t === 'ajuste' && m.cantidad < 0 ? '−' : '+');
    var color = t === 'entrega' ? 'badge--ok' : (t === 'venta' ? 'badge--primary' : 'badge--warn');
    var label = t === 'entrega' ? 'Entrega' : (t === 'venta' ? 'Venta' : 'Ajuste');
    return '<li class="timeline-item"><div class="timeline-dot ' + cls + '">' + ic + '</div>' +
      '<div class="timeline-main"><div class="ttl">' + esc(nombre) + '</div>' +
      '<div class="sub">' + label + ' · ' + fmtFecha(m.fecha) + (m.nota ? ' · ' + esc(m.nota) : '') + '</div></div>' +
      '<div class="timeline-qty badge ' + color + '">' + signo + fmtInt(Math.abs(m.cantidad)) + '</div></li>';
  }

  function emptyApp() {
    return '<div class="card"><div class="card__body"><div class="empty">' +
      '<div class="empty__ic">' + iconBox() + '</div>' +
      '<h3>Empecemos a cargar tu stock</h3>' +
      '<p>Todavía no cargaste artículos. Creá tu primer producto con foto y stock, o cargá datos de ejemplo para ver cómo funciona.</p>' +
      '<div class="row" style="justify-content:center;">' +
      btn('nuevo-art', 'primary', iconPlus(), 'Crear artículo') +
      btn('demo', 'ghost', '', 'Cargar datos de ejemplo') +
      '</div></div></div></div>';
  }

  /* ============================================================
     ARTÍCULOS
     ============================================================ */
  function renderArticulos() {
    var arts = S.getArticulos();
    if (!arts.length) return emptyApp();
    var stocks = S.computeStocks();

    var html = '<div class="toolbar">' +
      '<div class="search"><svg viewBox="0 0 24 24"><path d="M21 20l-5.6-5.6a7 7 0 1 0-1.4 1.4L20 21zM4 10a5 5 0 1 1 10 0 5 5 0 0 1-10 0z"/></svg>' +
      '<input id="buscar" type="text" placeholder="Buscar por nombre o código…" value="' + esc(ui.busqueda) + '"></div>' +
      '<div class="chips">' +
      chip('todos', 'Todos') + chip('bajo', 'Para reponer') + chip('ok', 'En nivel') +
      '</div></div>';

    var filtrados = arts.filter(function (a) {
      var q = ui.busqueda.toLowerCase();
      var match = !q || (a.nombre + ' ' + a.codigo).toLowerCase().indexOf(q) >= 0;
      if (!match) return false;
      if (ui.filtro === 'todos') return true;
      var e = S.estado(a, stocks[a.id]);
      if (ui.filtro === 'bajo') return e === 'bajo' || e === 'sin';
      if (ui.filtro === 'ok') return e === 'ok';
      return true;
    });

    if (!filtrados.length) {
      html += '<div class="card"><div class="card__body"><p class="muted text-c" style="padding:30px 0;">No se encontraron artículos con ese filtro.</p></div></div>';
      return html;
    }

    html += '<div class="grid">';
    filtrados.forEach(function (a) { html += articleCard(a, stocks[a.id]); });
    html += '</div>';
    return html;
  }
  function chip(val, label) {
    return '<button class="chip ' + (ui.filtro === val ? 'is-active' : '') + '" data-chip="' + val + '">' + esc(label) + '</button>';
  }
  function articleCard(a, stock) {
    var e = S.estado(a, stock);
    var isConfig = e === 'config';
    var pct = (!isConfig && a.stockMaximo > 0) ? Math.min(100, Math.max(0, (stock / a.stockMaximo) * 100)) : 0;
    var fill = e === 'sin' ? 'fill-danger' : (e === 'bajo' ? 'fill-warn' : 'fill-ok');
    var flag = isConfig ? '<span class="article-card__flag" style="background:rgba(107,115,144,.92);color:#fff;">A configurar</span>'
      : (e === 'sin' ? '<span class="article-card__flag flag-danger">Sin stock</span>'
        : (e === 'bajo' ? '<span class="article-card__flag flag-warn">Reponer</span>'
          : '<span class="article-card__flag flag-ok">En nivel</span>'));
    var stockLine = isConfig
      ? '<div class="stock-row"><span class="now" style="color:var(--muted-2);">—</span>' +
        '<span class="max">≈ ' + fmtDec(S.promedioQuincena(a)) + ' cajas/quincena</span></div>' +
        '<div class="bar"><div class="bar__fill" style="width:0%"></div></div>'
      : '<div class="stock-row"><span class="now">' + fmtInt(stock) + ' <span class="max">cajas</span></span>' +
        '<span class="max">máx ' + fmtInt(a.stockMaximo) + ' · pto ' + fmtInt(a.puntoPedido) + '</span></div>' +
        '<div class="bar"><div class="bar__fill ' + fill + '" style="width:' + pct + '%"></div></div>';
    return '<div class="article-card">' +
      '<div class="article-card__media">' + flag +
      '<img src="' + fotoDe(a) + '" alt="' + esc(a.nombre) + '" loading="lazy"></div>' +
      '<div class="article-card__body">' +
      (a.codigo ? '<div class="article-card__code">' + esc(a.codigo) + '</div>' : '') +
      '<div class="article-card__name">' + esc(a.nombre) + '</div>' +
      (a.descripcion ? '<div class="article-card__desc">' + esc(a.descripcion) + '</div>' : '') +
      stockLine +
      '<div class="article-card__foot">' +
      '<button class="btn btn--ghost btn--sm" data-edit="' + a.id + '">Editar</button>' +
      '<button class="btn btn--ghost btn--sm" data-ver="' + a.id + '">Detalle</button>' +
      '</div></div></div>';
  }
  afterRender.articulos = function () {
    var inp = $('#buscar');
    if (inp) inp.addEventListener('input', function () { ui.busqueda = inp.value; var pos = inp.selectionStart; render(); var ni = $('#buscar'); if (ni) { ni.focus(); ni.setSelectionRange(pos, pos); } });
    $$('[data-chip]').forEach(function (c) { c.addEventListener('click', function () { ui.filtro = c.getAttribute('data-chip'); render(); }); });
    $$('[data-edit]').forEach(function (b) { b.addEventListener('click', function () { openArticuloForm(b.getAttribute('data-edit')); }); });
    $$('[data-ver]').forEach(function (b) { b.addEventListener('click', function () { openArticuloDetalle(b.getAttribute('data-ver')); }); });
  };

  /* ============================================================
     COMPRA POR QUINCENA (ranking)
     ============================================================ */
  var comprasBusqueda = '';
  function renderCompras() {
    var rank = S.rankingCompras();
    if (!rank.length) return emptyApp();
    var meta = S.getMeta();
    var q = S.quincenasPeriodo();
    var qq = comprasBusqueda.toLowerCase();
    var filt = rank.filter(function (x) {
      return !qq || (x.articulo.nombre + ' ' + x.articulo.codigo).toLowerCase().indexOf(qq) >= 0;
    });

    var html = '<div class="ranking">';
    html += '<div class="callout"><svg viewBox="0 0 24 24"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>' +
      '<div>Cantidades expresadas en <strong>cajas</strong>. Promedio calculado sobre <strong>' + meta.periodoMeses + ' meses</strong> de historial (' + q + ' quincenas). ' +
      'Si el período real es otro, cambialo en <strong>Configuración</strong> y se recalcula todo.</div></div>';

    html += '<div class="toolbar" style="margin-top:18px;">' +
      '<div class="search"><svg viewBox="0 0 24 24"><path d="M21 20l-5.6-5.6a7 7 0 1 0-1.4 1.4L20 21zM4 10a5 5 0 1 1 10 0 5 5 0 0 1-10 0z"/></svg>' +
      '<input id="buscarC" type="text" placeholder="Buscar artículo…" value="' + esc(comprasBusqueda) + '"></div>' +
      '<span class="muted nowrap">' + rank.length + ' artículos · promedio de los últimos ' + meta.periodoMeses + ' meses</span></div>';

    html += '<div class="card"><div class="table-wrap"><table class="table"><thead><tr>' +
      '<th style="width:40px;">#</th><th>Artículo</th>' +
      '<th class="num" style="width:118px;">Cajas/mes</th><th class="num" style="width:140px;">Cajas/quincena</th>' +
      '</tr></thead><tbody>';
    filt.forEach(function (x) {
      var a = x.articulo;
      var pos = rank.indexOf(x) + 1;
      html += '<tr data-ver="' + a.id + '" style="cursor:pointer;">' +
        '<td class="num muted">' + pos + '</td>' +
        '<td><div class="cell-art"><img src="' + fotoDe(a) + '" alt=""><div><div class="nm">' + esc(a.nombre) + '</div><div class="cd">' + esc(a.codigo || '') + '</div></div></div></td>' +
        '<td class="num muted">' + fmtDec(x.promMes) + '</td>' +
        '<td class="num"><strong style="font-size:15px;">' + fmtDec(x.promQuincena) + '</strong></td>' +
        '</tr>';
    });
    html += '</tbody></table></div></div>';
    html += '</div>';
    return html;
  }
  afterRender.compras = function () {
    var inp = $('#buscarC');
    if (inp) inp.addEventListener('input', function () {
      comprasBusqueda = inp.value; var p = inp.selectionStart; render();
      var ni = $('#buscarC'); if (ni) { ni.focus(); ni.setSelectionRange(p, p); }
    });
    $$('[data-ver]').forEach(function (b) { b.addEventListener('click', function () { openArticuloDetalle(b.getAttribute('data-ver')); }); });
  };

  /* ---------- Formulario de artículo ---------- */
  function openArticuloForm(id) {
    var a = id ? S.getArticulo(id) : null;
    var foto = a ? a.foto : '';
    var body = '' +
      '<form class="form" id="artForm">' +
      '<div class="imgdrop" id="imgdrop">' +
      '<img class="imgdrop__preview" id="imgPreview" src="' + (foto || S.placeholder(a ? a.nombre : 'Nuevo')) + '" alt="">' +
      '<div class="imgdrop__text"><strong>Foto del artículo</strong><span>Tocá para subir una imagen (JPG/PNG). Se optimiza sola.</span></div>' +
      '<input type="file" id="imgInput" accept="image/*" hidden>' +
      '</div>' +
      '<input type="hidden" id="fFoto" value="' + esc(foto) + '">' +
      '<div class="form-grid">' +
      field('Nombre', '<input class="input" id="fNombre" value="' + esc(a ? a.nombre : '') + '" placeholder="Ej: Alfajor Triple" required>', true) +
      field('Código / SKU <span class="opt">(opcional)</span>', '<input class="input" id="fCodigo" value="' + esc(a ? a.codigo : '') + '" placeholder="Ej: GOL-007">') +
      field('Descripción <span class="opt">(opcional)</span>', '<textarea class="textarea" id="fDesc" placeholder="Detalle visible en el catálogo…">' + esc(a ? a.descripcion : '') + '</textarea>', true) +
      field('Stock inicial', '<input class="input" id="fInicial" type="number" min="0" step="1" value="' + (a ? a.stockInicial : 0) + '">') +
      field('Stock máximo', '<input class="input" id="fMax" type="number" min="0" step="1" value="' + (a ? a.stockMaximo : 0) + '" placeholder="Tope a reponer">') +
      field('Punto de pedido', '<input class="input" id="fPunto" type="number" min="0" step="1" value="' + (a ? a.puntoPedido : 0) + '">') +
      field('Precio unitario <span class="opt">(opcional)</span>', '<div class="input-prefix"><span>$</span><input class="input" id="fPrecio" type="number" min="0" step="0.01" value="' + (a ? a.precio : 0) + '"></div>') +
      '</div>' +
      '<div class="hint">El <strong>punto de pedido</strong> es el nivel que dispara la reposición: cuando el stock baja hasta ese valor, el sistema sugiere un pedido para volver al <strong>stock máximo</strong>.</div>' +
      '<div class="form-actions">' +
      (a ? '<button type="button" class="btn btn--danger" id="fEliminar">Eliminar</button>' : '') +
      '<div style="flex:1"></div>' +
      '<button type="button" class="btn btn--ghost" data-close>Cancelar</button>' +
      '<button type="submit" class="btn btn--primary">' + iconSave() + '<span>Guardar</span></button>' +
      '</div></form>';
    openModal(a ? 'Editar artículo' : 'Nuevo artículo', body);

    var preview = $('#imgPreview'), fFoto = $('#fFoto'), fNombre = $('#fNombre');
    $('#imgdrop').addEventListener('click', function () { $('#imgInput').click(); });
    $('#imgInput').addEventListener('change', function (e) {
      var file = e.target.files[0];
      if (!file) return;
      comprimirImagen(file, function (dataUrl) {
        fFoto.value = dataUrl; preview.src = dataUrl;
      });
    });
    // Autocompletar punto de pedido al tipear máximo (si está en 0)
    $('#fMax').addEventListener('change', function () {
      var pt = $('#fPunto');
      if (!parseInt(pt.value, 10)) pt.value = Math.round(parseFloat($('#fMax').value || 0) * 0.4);
    });
    if (!foto) fNombre.addEventListener('input', function () { if (!fFoto.value) preview.src = S.placeholder(fNombre.value || 'Nuevo'); });

    if (a) $('#fEliminar').addEventListener('click', function () {
      confirmar('Eliminar artículo', '¿Eliminar «' + esc(a.nombre) + '» y todos sus movimientos? Esta acción no se puede deshacer.', function () {
        S.removeArticulo(a.id); closeModal(); toast('Artículo eliminado', 'ok'); render();
      });
    });

    $('#artForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var data = {
        nombre: fNombre.value, codigo: $('#fCodigo').value, descripcion: $('#fDesc').value,
        foto: fFoto.value, precio: $('#fPrecio').value,
        stockInicial: $('#fInicial').value, stockMaximo: $('#fMax').value, puntoPedido: $('#fPunto').value
      };
      if (!data.nombre.trim()) { toast('Poné un nombre al artículo', 'warn'); return; }
      if (a) { S.updateArticulo(a.id, data); toast('Artículo actualizado', 'ok'); }
      else { S.addArticulo(data); toast('Artículo creado', 'ok'); }
      closeModal(); render();
    });
  }

  function openArticuloDetalle(id) {
    var a = S.getArticulo(id); if (!a) return;
    var stock = S.stockActual(id), t = S.totales(id), e = S.estado(a, stock);
    var meta = S.getMeta();
    var badge = e === 'config' ? '<span class="badge badge--muted"><span class="dot"></span>A configurar</span>'
      : (e === 'sin' ? '<span class="badge badge--danger"><span class="dot"></span>Sin stock</span>'
        : (e === 'bajo' ? '<span class="badge badge--warn"><span class="dot"></span>Para reponer</span>'
          : '<span class="badge badge--ok"><span class="dot"></span>En nivel</span>'));
    var movs = S.getMovimientos({ articuloId: id }).slice(0, 8);
    var body = '<img src="' + fotoDe(a) + '" alt="" style="width:100%;height:190px;object-fit:cover;border-radius:13px;margin-bottom:16px;">' +
      '<div class="row" style="justify-content:space-between;margin-bottom:6px;">' +
      '<div><div class="article-card__code">' + esc(a.codigo || '') + '</div><h2 style="font-size:20px;">' + esc(a.nombre) + '</h2></div>' + badge + '</div>' +
      (a.descripcion ? '<p class="muted" style="margin-bottom:16px;line-height:1.5;">' + esc(a.descripcion) + '</p>' : '') +
      '<div class="callout" style="margin-bottom:14px;"><svg viewBox="0 0 24 24"><path d="M3 13h2v7H3zM10 8h2v12h-2zM17 4h2v16h-2z"/></svg>' +
      '<div>El cliente te compra en promedio <strong>' + fmtDec(S.promedioQuincena(a)) + ' cajas/quincena</strong> ' +
      '(' + fmtDec(S.promedioMes(a)) + ' cajas/mes, últimos ' + meta.periodoMeses + ' meses).</div></div>' +
      '<div class="stats" style="margin-bottom:8px;">' +
      miniStat('Stock actual', e === 'config' ? '—' : fmtInt(stock)) +
      miniStat('Stock máximo', a.stockMaximo ? fmtInt(a.stockMaximo) : '—') +
      miniStat('Punto de pedido', a.stockMaximo ? fmtInt(a.puntoPedido) : '—') +
      miniStat('A reponer', e === 'config' ? '—' : fmtInt(S.sugerido(a, stock))) +
      '</div>' +
      '<div class="row" style="gap:18px;margin:10px 2px 4px;font-size:13px;">' +
      '<span class="muted">Inicial: <strong>' + fmtInt(a.stockInicial) + '</strong></span>' +
      '<span class="muted">Entregas: <strong style="color:var(--ok)">+' + fmtInt(t.entregas) + '</strong></span>' +
      '<span class="muted">Ventas: <strong style="color:var(--primary)">−' + fmtInt(t.ventas) + '</strong></span>' +
      (t.ajustes ? '<span class="muted">Ajustes: <strong>' + (t.ajustes > 0 ? '+' : '') + fmtInt(t.ajustes) + '</strong></span>' : '') +
      '</div>' +
      '<div class="section-title">Últimos movimientos</div>' +
      (movs.length ? '<ul class="list-reset">' + movs.map(movItem).join('') + '</ul>' : '<p class="muted">Sin movimientos.</p>') +
      '<div class="form-actions" style="margin-top:18px;">' +
      '<button class="btn btn--ghost" data-close>Cerrar</button>' +
      '<button class="btn btn--primary" id="dEditar">Editar artículo</button></div>';
    openModal('Detalle del artículo', body);
    $('#dEditar').addEventListener('click', function () { openArticuloForm(id); });
  }
  function miniStat(label, value) {
    return '<div class="stat tone-primary" style="padding:14px;"><div class="stat__label">' + esc(label) + '</div><div class="stat__value" style="font-size:22px;">' + value + '</div></div>';
  }

  /* ============================================================
     CARGAR VENTAS  /  ENTREGAS  (tabla de carga rápida)
     ============================================================ */
  function renderCarga(tipo) {
    var arts = S.getArticulos({ soloActivos: true });
    if (!arts.length) return emptyApp();
    var stocks = S.computeStocks();
    var esVenta = tipo === 'venta';
    var titulo = esVenta ? 'Ventas informadas por el cliente' : 'Entregas que hiciste al cliente';
    var explica = esVenta
      ? 'Cargá las cajas que el cliente <strong>vendió</strong> en el período (informe quincenal). Se descuentan del stock.'
      : 'Cargá las cajas que <strong>entregaste</strong> para reponer. Se suman al stock del cliente.';

    var html = '<div class="callout' + (esVenta ? '' : '') + '"><svg viewBox="0 0 24 24"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg><div>' + explica + '</div></div>';
    html += '<div class="card" style="margin-top:18px;">';
    html += '<div class="card__head"><h2>' + titulo + '</h2><div class="spacer"></div>' +
      '<label class="label" style="margin:0;display:flex;align-items:center;gap:8px;">Fecha' +
      '<input class="input" id="cargaFecha" type="date" value="' + S.hoyISO() + '" style="width:auto;padding:8px 10px;"></label></div>';
    html += '<div class="table-wrap"><table class="table"><thead><tr>' +
      '<th>Artículo</th><th class="num">Stock actual</th>' +
      (esVenta ? '<th class="num">Vendidas</th><th class="num">Quedaría</th>' : '<th class="num">Entregadas</th><th class="num">Quedaría</th>') +
      '</tr></thead><tbody>';
    arts.forEach(function (a) {
      var s = stocks[a.id];
      html += '<tr data-row="' + a.id + '">' +
        '<td><div class="cell-art"><img src="' + fotoDe(a) + '" alt=""><div><div class="nm">' + esc(a.nombre) + '</div><div class="cd">' + esc(a.codigo || '') + '</div></div></div></td>' +
        '<td class="num">' + fmtInt(s) + '</td>' +
        '<td class="num"><input class="qty-input" type="number" min="0" step="1" value="" placeholder="0" data-qty="' + a.id + '" data-stock="' + s + '"></td>' +
        '<td class="num" data-result="' + a.id + '">' + fmtInt(s) + '</td>' +
        '</tr>';
    });
    html += '</tbody></table></div>';
    html += '<div class="card__body" style="border-top:1px solid var(--line);"><div class="row" style="justify-content:flex-end;gap:10px;">' +
      '<span class="muted" id="cargaResumen" style="margin-right:auto;">0 artículos cargados</span>' +
      btn(esVenta ? 'guardar-ventas' : 'guardar-entregas', 'primary', iconSave(), esVenta ? 'Guardar informe' : 'Registrar entregas') +
      '</div></div>';
    html += '</div>';
    return html;
  }
  function renderVentas() { return renderCarga('venta'); }
  function renderEntregas() { return renderCarga('entrega'); }

  function bindCarga(esVenta) {
    $$('[data-qty]').forEach(function (inp) {
      inp.addEventListener('input', function () {
        var id = inp.getAttribute('data-qty');
        var s = parseFloat(inp.getAttribute('data-stock')) || 0;
        var q = parseFloat(inp.value) || 0;
        var res = esVenta ? s - q : s + q;
        var cell = $('[data-result="' + id + '"]');
        cell.textContent = fmtInt(res);
        cell.style.color = res < 0 ? 'var(--danger)' : (res <= (S.getArticulo(id).puntoPedido || 0) ? 'var(--warn)' : '');
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
      if (q > 0) batch.push({ articuloId: inp.getAttribute('data-qty'), tipo: esVenta ? 'venta' : 'entrega', cantidad: q, fecha: fecha, nota: esVenta ? 'Informe del cliente' : 'Entrega de reposición' });
    });
    if (!batch.length) { toast('Cargá al menos una cantidad', 'warn'); return; }
    S.addMovimientosBatch(batch);
    var n = batch.length;
    if (esVenta) {
      var pend = S.pedidoSugerido().length;
      toast('Informe guardado: ' + n + ' artículo(s)', 'ok');
      render();
      if (pend) setTimeout(function () { toast(pend + ' artículo(s) necesitan reposición', 'warn'); }, 600);
    } else {
      toast('Entregas registradas: ' + n + ' artículo(s)', 'ok');
      render();
    }
  }

  /* ============================================================
     PEDIDO SUGERIDO
     ============================================================ */
  function renderPedido() {
    var sug = S.pedidoSugerido();
    var pedidos = S.getPedidos();
    var html = '';

    if (!sug.length) {
      html += '<div class="card"><div class="card__body"><div class="empty">' +
        '<div class="empty__ic" style="background:var(--ok-bg);color:var(--ok);"><svg viewBox="0 0 24 24"><path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z"/></svg></div>' +
        '<h3>No hay nada para reponer</h3>' +
        '<p>Todos los artículos están por encima de su punto de pedido. Cuando cargues nuevas ventas y el stock baje, acá aparecerá el pedido sugerido automáticamente.</p>' +
        btn('ir-ventas', 'primary', '', 'Cargar ventas') +
        '</div></div></div>';
    } else {
      var totalU = sug.reduce(function (a, x) { return a + x.sugerido; }, 0);
      var totalV = sug.reduce(function (a, x) { return a + x.sugerido * (x.articulo.precio || 0); }, 0);
      html += '<div class="callout"><svg viewBox="0 0 24 24"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>' +
        '<div>Estos artículos están en o por debajo de su punto de pedido. Las cantidades sugeridas reponen hasta el stock máximo. Podés ajustarlas antes de generar el pedido.</div></div>';
      html += '<div class="card" style="margin-top:18px;">';
      html += '<div class="card__head"><h2>Reposición sugerida</h2><div class="spacer"></div><span class="badge badge--primary">' + sug.length + ' artículos · ' + fmtInt(totalU) + ' cajas</span></div>';
      html += '<div class="table-wrap"><table class="table"><thead><tr>' +
        '<th>Artículo</th><th class="num">Stock</th><th class="num">Punto</th><th class="num">Máximo</th><th class="num">A pedir</th>' +
        (totalV ? '<th class="num">Subtotal</th>' : '') + '</tr></thead><tbody>';
      sug.forEach(function (x) {
        var a = x.articulo;
        html += '<tr>' +
          '<td><div class="cell-art"><img src="' + fotoDe(a) + '" alt=""><div><div class="nm">' + esc(a.nombre) + '</div><div class="cd">' + esc(a.codigo || '') + '</div></div></div></td>' +
          '<td class="num" style="color:var(--warn);font-weight:700;">' + fmtInt(x.stock) + '</td>' +
          '<td class="num">' + fmtInt(a.puntoPedido) + '</td>' +
          '<td class="num">' + fmtInt(a.stockMaximo) + '</td>' +
          '<td class="num"><input class="qty-input" type="number" min="0" step="1" value="' + x.sugerido + '" data-pedido="' + a.id + '" data-precio="' + (a.precio || 0) + '"></td>' +
          (totalV ? '<td class="num" data-sub="' + a.id + '">' + fmtMoney(x.sugerido * (a.precio || 0)) + '</td>' : '') +
          '</tr>';
      });
      html += '</tbody></table></div>';
      html += '<div class="card__body" style="border-top:1px solid var(--line);"><div class="row" style="justify-content:flex-end;gap:10px;">' +
        (totalV ? '<span class="muted" style="margin-right:auto;">Total estimado: <strong id="pedTotal" style="color:var(--text)">' + fmtMoney(totalV) + '</strong></span>' : '<span style="margin-right:auto;"></span>') +
        btn('print-sugerido', 'ghost', iconPrint(), 'Imprimir') +
        btn('generar-pedido', 'primary', '<svg viewBox="0 0 24 24"><path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z"/></svg>', 'Confirmar pedido') +
        '</div></div>';
      html += '</div>';
    }

    // Historial de pedidos
    html += '<div class="section-title">Pedidos registrados</div>';
    if (!pedidos.length) {
      html += '<div class="card"><div class="card__body"><p class="muted text-c" style="padding:16px 0;">Todavía no generaste pedidos. Cuando confirmes uno, quedará acá para imprimir o marcar como entregado.</p></div></div>';
    } else {
      html += '<div class="card"><div class="table-wrap"><table class="table"><thead><tr><th>Pedido</th><th>Fecha</th><th class="num">Ítems</th><th class="num">Cajas</th><th>Estado</th><th class="right">Acciones</th></tr></thead><tbody>';
      pedidos.forEach(function (p) {
        var u = p.items.reduce(function (a, it) { return a + it.cantidad; }, 0);
        var est = p.estado === 'entregado' ? '<span class="badge badge--ok"><span class="dot"></span>Entregado</span>' : '<span class="badge badge--warn"><span class="dot"></span>Pendiente</span>';
        html += '<tr>' +
          '<td><strong>#' + p.id.slice(-5).toUpperCase() + '</strong></td>' +
          '<td>' + fmtFecha(p.fecha) + '</td>' +
          '<td class="num">' + p.items.length + '</td>' +
          '<td class="num">' + fmtInt(u) + '</td>' +
          '<td>' + est + '</td>' +
          '<td class="right nowrap">' +
          '<button class="btn btn--ghost btn--sm" data-pimprimir="' + p.id + '">Imprimir</button> ' +
          (p.estado !== 'entregado' ? '<button class="btn btn--primary btn--sm" data-pentregar="' + p.id + '">Marcar entregado</button> ' : '') +
          '<button class="iconbtn" data-peliminar="' + p.id + '" title="Eliminar"><svg viewBox="0 0 24 24" width="18" height="18"><path d="M6 7h12l-1 14H7L6 7zm3-3h6l1 2h4v2H2V6h4l1-2z"/></svg></button>' +
          '</td></tr>';
      });
      html += '</tbody></table></div></div>';
    }
    return html;
  }
  afterRender.pedido = function () {
    bindAction('ir-ventas', function () { location.hash = '#/ventas'; });
    bindAction('generar-pedido', generarPedido);
    // 'print-sugerido' lo maneja la delegación global (topbar + botón de la vista)
    // recalcular subtotal/total al editar cantidades
    $$('[data-pedido]').forEach(function (inp) {
      inp.addEventListener('input', function () {
        var id = inp.getAttribute('data-pedido');
        var precio = parseFloat(inp.getAttribute('data-precio')) || 0;
        var q = parseFloat(inp.value) || 0;
        var sub = $('[data-sub="' + id + '"]');
        if (sub) sub.textContent = fmtMoney(q * precio);
        var total = 0;
        $$('[data-pedido]').forEach(function (i) { total += (parseFloat(i.value) || 0) * (parseFloat(i.getAttribute('data-precio')) || 0); });
        var tEl = $('#pedTotal'); if (tEl) tEl.textContent = fmtMoney(total);
      });
    });
    $$('[data-pimprimir]').forEach(function (b) { b.addEventListener('click', function () { imprimirPedido(b.getAttribute('data-pimprimir')); }); });
    $$('[data-pentregar]').forEach(function (b) { b.addEventListener('click', function () {
      var id = b.getAttribute('data-pentregar');
      confirmar('Marcar como entregado', 'Esto registra las entregas y repone el stock del cliente con las cantidades del pedido. ¿Confirmás?', function () {
        S.marcarPedidoEntregado(id); toast('Pedido entregado y stock repuesto', 'ok'); render();
      });
    }); });
    $$('[data-peliminar]').forEach(function (b) { b.addEventListener('click', function () {
      var id = b.getAttribute('data-peliminar');
      confirmar('Eliminar pedido', '¿Eliminar este pedido del historial? No afecta el stock ya registrado.', function () {
        S.eliminarPedido(id); toast('Pedido eliminado', 'ok'); render();
      });
    }); });
  };
  function generarPedido() {
    var items = $$('[data-pedido]').map(function (inp) {
      return { articuloId: inp.getAttribute('data-pedido'), cantidad: parseFloat(inp.value) || 0 };
    });
    var p = S.crearPedido(items);
    if (!p) { toast('No hay cantidades para pedir', 'warn'); return; }
    toast('Pedido #' + p.id.slice(-5).toUpperCase() + ' generado', 'ok');
    render();
  }

  /* ---------- Impresión de pedido ---------- */
  function ordenHTML(titulo, items, fecha, idTxt) {
    var meta = S.getMeta();
    var totalU = items.reduce(function (a, it) { return a + it.cantidad; }, 0);
    var hayPrecio = items.some(function (it) { return (it.precio || 0) > 0; });
    var totalV = items.reduce(function (a, it) { return a + it.cantidad * (it.precio || 0); }, 0);
    var rows = items.map(function (it) {
      return '<tr><td>' + esc(it.codigo || '') + '</td><td>' + esc(it.nombre) + '</td><td style="text-align:right">' + fmtInt(it.cantidad) + '</td>' +
        (hayPrecio ? '<td style="text-align:right">' + fmtMoney(it.precio || 0) + '</td><td style="text-align:right">' + fmtMoney(it.cantidad * (it.precio || 0)) + '</td>' : '') + '</tr>';
    }).join('');
    return '<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>' + esc(titulo) + '</title>' +
      '<style>body{font-family:Inter,Arial,sans-serif;color:#1c2233;margin:40px;}h1{font-size:22px;margin:0 0 2px;}' +
      '.muted{color:#6b7390;}table{width:100%;border-collapse:collapse;margin-top:18px;}' +
      'th,td{padding:9px 10px;border-bottom:1px solid #e3e6f0;font-size:13px;text-align:left;}' +
      'th{background:#f5f6fb;text-transform:uppercase;font-size:11px;letter-spacing:.04em;color:#6b7390;}' +
      '.head{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #4f46e5;padding-bottom:14px;}' +
      '.tot{margin-top:14px;text-align:right;font-size:15px;font-weight:700;}.brand{font-size:13px;color:#4f46e5;font-weight:700;}</style></head><body>' +
      '<div class="head"><div><div class="brand">PEDIDO DE REPOSICIÓN</div><h1>' + esc(meta.empresa || 'Mi Empresa') + '</h1>' +
      (meta.cliente ? '<div class="muted">Cliente: ' + esc(meta.cliente) + '</div>' : '') + '</div>' +
      '<div class="muted" style="text-align:right">' + (idTxt ? 'N° ' + esc(idTxt) + '<br>' : '') + 'Fecha: ' + fmtFecha(fecha) + '</div></div>' +
      '<table><thead><tr><th>Código</th><th>Artículo</th><th style="text-align:right">Cantidad</th>' +
      (hayPrecio ? '<th style="text-align:right">Precio</th><th style="text-align:right">Subtotal</th>' : '') +
      '</tr></thead><tbody>' + rows + '</tbody></table>' +
      '<div class="tot">Total cajas: ' + fmtInt(totalU) + (hayPrecio ? ' &nbsp;·&nbsp; Total: ' + fmtMoney(totalV) : '') + '</div>' +
      '<p class="muted" style="margin-top:40px;font-size:12px;">Generado con StockRotativo · ' + fmtFecha(S.hoyISO()) + '</p>' +
      '</body></html>';
  }
  function abrirImpresion(html) {
    var w = window.open('', '_blank');
    if (!w) { toast('Permití las ventanas emergentes para imprimir', 'warn'); return; }
    w.document.write(html); w.document.close();
    setTimeout(function () { w.focus(); w.print(); }, 350);
  }
  function imprimirSugerido() {
    var items = $$('[data-pedido]').map(function (inp) {
      var a = S.getArticulo(inp.getAttribute('data-pedido'));
      return { codigo: a.codigo, nombre: a.nombre, cantidad: parseFloat(inp.value) || 0, precio: a.precio || 0 };
    }).filter(function (it) { return it.cantidad > 0; });
    if (!items.length) { toast('No hay artículos para imprimir', 'warn'); return; }
    abrirImpresion(ordenHTML('Pedido de reposición', items, S.hoyISO(), null));
  }
  function imprimirPedido(id) {
    var p = S.getPedido(id); if (!p) return;
    var items = p.items.map(function (it) {
      var a = S.getArticulo(it.articuloId);
      return { codigo: it.codigo, nombre: it.nombre, cantidad: it.cantidad, precio: a ? a.precio || 0 : 0 };
    });
    abrirImpresion(ordenHTML('Pedido #' + p.id.slice(-5).toUpperCase(), items, p.fecha, '#' + p.id.slice(-5).toUpperCase()));
  }

  /* ============================================================
     MOVIMIENTOS
     ============================================================ */
  var movFiltro = 'todos';
  function renderMovimientos() {
    var movs = S.getMovimientos();
    if (!movs.length) {
      return '<div class="card"><div class="card__body"><div class="empty">' +
        '<div class="empty__ic"><svg viewBox="0 0 24 24"><path d="M13 3a9 9 0 0 0-9 9H1l4 4 4-4H6a7 7 0 1 1 2 4.9l-1.4 1.5A9 9 0 1 0 13 3z"/></svg></div>' +
        '<h3>Sin movimientos todavía</h3><p>Cuando cargues ventas o entregas, el historial completo aparecerá acá.</p></div></div></div>';
    }
    if (movFiltro !== 'todos') movs = movs.filter(function (m) { return m.tipo === movFiltro; });
    var html = '<div class="toolbar"><div class="chips">' +
      mChip('todos', 'Todos') + mChip('entrega', 'Entregas') + mChip('venta', 'Ventas') + mChip('ajuste', 'Ajustes') +
      '</div><div style="flex:1"></div>' + btn('nuevo-ajuste', 'ghost', iconPlus(), 'Ajuste manual') + '</div>';
    html += '<div class="card"><div class="card__body"><ul class="list-reset">';
    movs.forEach(function (m) {
      html += '<li class="timeline-item">' + movItemInner(m) +
        '<button class="iconbtn" data-delmov="' + m.id + '" title="Eliminar"><svg viewBox="0 0 24 24" width="17" height="17"><path d="M6 7h12l-1 14H7L6 7zm3-3h6l1 2h4v2H2V6h4l1-2z"/></svg></button></li>';
    });
    html += '</ul></div></div>';
    return html;
  }
  function mChip(val, label) { return '<button class="chip ' + (movFiltro === val ? 'is-active' : '') + '" data-mchip="' + val + '">' + esc(label) + '</button>'; }
  function movItemInner(m) {
    // mismo contenido que movItem pero sin el <li> contenedor
    var tmp = document.createElement('div'); tmp.innerHTML = movItem(m);
    return tmp.firstChild.innerHTML;
  }
  afterRender.movimientos = function () {
    $$('[data-mchip]').forEach(function (c) { c.addEventListener('click', function () { movFiltro = c.getAttribute('data-mchip'); render(); }); });
    bindAction('nuevo-ajuste', openAjuste);
    $$('[data-delmov]').forEach(function (b) { b.addEventListener('click', function () {
      var id = b.getAttribute('data-delmov');
      confirmar('Eliminar movimiento', 'El stock se recalcula sin este movimiento. ¿Continuar?', function () {
        S.removeMovimiento(id); toast('Movimiento eliminado', 'ok'); render();
      });
    }); });
  };
  function openAjuste() {
    var arts = S.getArticulos({ soloActivos: true });
    if (!arts.length) { toast('Primero creá un artículo', 'warn'); return; }
    var opts = arts.map(function (a) { return '<option value="' + a.id + '">' + esc(a.nombre) + (a.codigo ? ' (' + esc(a.codigo) + ')' : '') + '</option>'; }).join('');
    var body = '<form class="form" id="ajForm">' +
      field('Artículo', '<select class="select" id="ajArt">' + opts + '</select>', true) +
      '<div class="form-grid">' +
      field('Cantidad', '<input class="input" id="ajCant" type="number" step="1" value="0" placeholder="Use negativo para descontar">') +
      field('Fecha', '<input class="input" id="ajFecha" type="date" value="' + S.hoyISO() + '">') +
      '</div>' +
      field('Nota <span class="opt">(opcional)</span>', '<input class="input" id="ajNota" placeholder="Ej: rotura, faltante, corrección de inventario">', true) +
      '<div class="hint">Un ajuste suma o resta cajas directamente (por roturas, vencimientos, recuentos). Usá número negativo para descontar.</div>' +
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
     CONFIGURACIÓN
     ============================================================ */
  function renderConfig() {
    var m = S.getMeta();
    var html = '<div class="grid-2">';
    // Datos del negocio
    html += '<div class="card"><div class="card__head"><h2>Datos del negocio</h2></div><div class="card__body">' +
      '<form class="form" id="cfgForm">' +
      field('Nombre de tu empresa', '<input class="input" id="cEmpresa" value="' + esc(m.empresa) + '">', true) +
      field('Cliente (consignatario)', '<input class="input" id="cCliente" value="' + esc(m.cliente) + '" placeholder="Ej: Osa Distribuidora SRL">', true) +
      '<div class="form-grid">' +
      field('Moneda', '<select class="select" id="cMoneda">' +
        ['ARS', 'USD', 'EUR', 'CLP', 'MXN', 'UYU', 'COP', 'PEN', 'BRL'].map(function (x) {
          return '<option value="' + x + '"' + (m.moneda === x ? ' selected' : '') + '>' + x + '</option>';
        }).join('') + '</select>') +
      field('Meses del historial', '<input class="input" id="cPeriodo" type="number" min="1" step="1" value="' + (m.periodoMeses || 17) + '">') +
      '</div>' +
      '<div class="hint">«Meses del historial» es el período que abarca el total de compras de cada artículo. Se usa para calcular el promedio por quincena.</div>' +
      '<div class="form-actions"><button type="submit" class="btn btn--primary">Guardar cambios</button></div>' +
      '</form></div></div>';
    // Datos / respaldo
    html += '<div class="card"><div class="card__head"><h2>Datos y respaldo</h2></div><div class="card__body">' +
      '<p class="muted" style="margin-bottom:14px;line-height:1.5;">Tus datos se guardan en este navegador. Descargá un respaldo periódicamente o pasalo a otra computadora.</p>' +
      '<div class="row" style="gap:10px;">' +
      btn('export', 'ghost', '<svg viewBox="0 0 24 24"><path d="M12 16 7 11l1.4-1.4L11 12.2V4h2v8.2l2.6-2.6L17 11l-5 5zm-7 2h14v2H5z"/></svg>', 'Descargar respaldo') +
      btn('import', 'ghost', '<svg viewBox="0 0 24 24"><path d="M12 4l5 5-1.4 1.4L13 7.8V16h-2V7.8L8.4 10.4 7 9l5-5zM5 18h14v2H5z"/></svg>', 'Importar respaldo') +
      '<input type="file" id="importFile" accept="application/json,.json" hidden>' +
      '</div>' +
      '<div style="height:1px;background:var(--line);margin:18px 0;"></div>' +
      '<div class="row" style="gap:10px;">' +
      btn('demo', 'ghost', '', 'Cargar datos de ejemplo') +
      btn('reset', 'danger', '', 'Borrar todo') +
      '</div></div></div>';
    html += '</div>';

    html += '<div class="card" style="margin-top:18px;"><div class="card__head"><h2>¿Cómo funciona?</h2></div><div class="card__body">' +
      '<ol style="margin:0;padding-left:20px;line-height:1.9;color:var(--muted);">' +
      '<li><strong style="color:var(--text)">Cargá tus artículos</strong> con foto, stock inicial, stock máximo y punto de pedido.</li>' +
      '<li>Cada 15 días, en <strong style="color:var(--text)">Cargar ventas</strong>, ingresá lo que vendió el cliente. El stock baja solo.</li>' +
      '<li>Cuando un artículo llega al punto de pedido, aparece en <strong style="color:var(--text)">Pedido sugerido</strong>.</li>' +
      '<li>Confirmás el pedido, lo imprimís y, al entregar, lo marcás como <strong style="color:var(--text)">entregado</strong>: el stock se repone automáticamente.</li>' +
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
    // 'demo' lo maneja la delegación global
    bindAction('reset', function () {
      confirmar('Borrar todo', 'Se eliminarán TODOS los artículos, movimientos y pedidos de este navegador. ¿Seguro?', function () {
        S.resetAll(); toast('Datos borrados', 'ok'); location.hash = '#/panel'; setView('panel');
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
    confirmar('Cargar ejemplo', 'Esto reemplaza los datos actuales con un set de ejemplo para probar la app. ¿Continuar?', function () {
      S.loadDemo(); toast('Datos de ejemplo cargados', 'ok'); updateBrand(); location.hash = '#/panel'; setView('panel');
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
    var body = '<p style="line-height:1.55;color:var(--muted);margin-bottom:20px;">' + mensaje + '</p>' +
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
    if (act === 'nuevo-art') openArticuloForm(null);
    else if (act === 'guardar-ventas') guardarCarga(true);
    else if (act === 'guardar-entregas') guardarCarga(false);
    else if (act === 'demo') cargarDemo();
    else if (act === 'print-sugerido') imprimirSugerido();
  });

  /* ---------- Init ---------- */
  function init() {
    var vEl = $('#appVersion');
    if (vEl) vEl.textContent = 'v' + APP_VERSION;
    var v = (location.hash || '').replace('#/', '');
    setView(v || 'panel');
  }
  init();
})();
