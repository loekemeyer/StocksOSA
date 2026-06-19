/* ============================================================
   StockRotativo · Capa de datos y lógica de negocio
   Persistencia local (localStorage) con respaldo exportable.
   ============================================================ */
(function () {
  'use strict';

  var KEY = 'stockrotativo.v1';

  /* ---------- Estado base ---------- */
  function blank() {
    return {
      meta: {
        empresa: 'Mi Empresa',
        cliente: '',
        moneda: 'ARS',
        creado: Date.now()
      },
      articulos: [], // {id,codigo,nombre,descripcion,foto,precio,stockInicial,stockMaximo,puntoPedido,activo}
      movimientos: [], // {id,articuloId,tipo,cantidad,fecha,nota}
      pedidos: [] // {id,fecha,estado,nota,items:[{articuloId,codigo,nombre,cantidad}]}
    };
  }

  var state = load();

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return blank();
      var p = JSON.parse(raw);
      var base = blank();
      base.meta = Object.assign(base.meta, p.meta || {});
      base.articulos = Array.isArray(p.articulos) ? p.articulos : [];
      base.movimientos = Array.isArray(p.movimientos) ? p.movimientos : [];
      base.pedidos = Array.isArray(p.pedidos) ? p.pedidos : [];
      return base;
    } catch (e) {
      console.error('No se pudo leer el almacenamiento:', e);
      return blank();
    }
  }

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
      return true;
    } catch (e) {
      console.error('No se pudo guardar:', e);
      return false;
    }
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function num(v, def) {
    var n = parseFloat(v);
    if (isNaN(n)) return def === undefined ? 0 : def;
    return n;
  }

  /* ---------- Meta ---------- */
  function getMeta() { return Object.assign({}, state.meta); }
  function setMeta(patch) { state.meta = Object.assign(state.meta, patch); save(); }

  /* ---------- Artículos ---------- */
  function getArticulos(opts) {
    opts = opts || {};
    var list = state.articulos.slice();
    if (opts.soloActivos) list = list.filter(function (a) { return a.activo !== false; });
    list.sort(function (a, b) { return (a.nombre || '').localeCompare(b.nombre || '', 'es'); });
    return list;
  }
  function getArticulo(id) {
    for (var i = 0; i < state.articulos.length; i++) {
      if (state.articulos[i].id === id) return state.articulos[i];
    }
    return null;
  }
  function addArticulo(data) {
    var a = {
      id: uid(),
      codigo: (data.codigo || '').trim(),
      nombre: (data.nombre || '').trim() || 'Sin nombre',
      descripcion: (data.descripcion || '').trim(),
      foto: data.foto || '',
      precio: num(data.precio, 0),
      stockInicial: Math.max(0, Math.round(num(data.stockInicial, 0))),
      stockMaximo: Math.max(0, Math.round(num(data.stockMaximo, 0))),
      puntoPedido: Math.max(0, Math.round(num(data.puntoPedido, 0))),
      activo: data.activo !== false
    };
    state.articulos.push(a);
    save();
    return a;
  }
  function updateArticulo(id, data) {
    var a = getArticulo(id);
    if (!a) return null;
    if (data.codigo !== undefined) a.codigo = (data.codigo || '').trim();
    if (data.nombre !== undefined) a.nombre = (data.nombre || '').trim() || 'Sin nombre';
    if (data.descripcion !== undefined) a.descripcion = (data.descripcion || '').trim();
    if (data.foto !== undefined) a.foto = data.foto;
    if (data.precio !== undefined) a.precio = num(data.precio, 0);
    if (data.stockInicial !== undefined) a.stockInicial = Math.max(0, Math.round(num(data.stockInicial, 0)));
    if (data.stockMaximo !== undefined) a.stockMaximo = Math.max(0, Math.round(num(data.stockMaximo, 0)));
    if (data.puntoPedido !== undefined) a.puntoPedido = Math.max(0, Math.round(num(data.puntoPedido, 0)));
    if (data.activo !== undefined) a.activo = !!data.activo;
    save();
    return a;
  }
  function removeArticulo(id) {
    state.articulos = state.articulos.filter(function (a) { return a.id !== id; });
    state.movimientos = state.movimientos.filter(function (m) { return m.articuloId !== id; });
    save();
  }

  /* ---------- Movimientos ---------- */
  // tipo: 'entrega' (suma) | 'venta' (resta) | 'ajuste' (suma, puede ser negativo)
  function addMovimiento(m) {
    var mov = {
      id: uid(),
      articuloId: m.articuloId,
      tipo: m.tipo,
      cantidad: Math.round(num(m.cantidad, 0)),
      fecha: m.fecha || hoyISO(),
      nota: (m.nota || '').trim()
    };
    state.movimientos.push(mov);
    save();
    return mov;
  }
  function addMovimientosBatch(arr) {
    var creados = [];
    for (var i = 0; i < arr.length; i++) {
      var c = Math.round(num(arr[i].cantidad, 0));
      if (c === 0) continue;
      creados.push(addMovimiento(arr[i]));
    }
    return creados;
  }
  function getMovimientos(filter) {
    filter = filter || {};
    var list = state.movimientos.slice();
    if (filter.articuloId) list = list.filter(function (m) { return m.articuloId === filter.articuloId; });
    if (filter.tipo) list = list.filter(function (m) { return m.tipo === filter.tipo; });
    list.sort(function (a, b) {
      if (a.fecha === b.fecha) return b.id < a.id ? -1 : 1;
      return a.fecha < b.fecha ? 1 : -1;
    });
    return list;
  }
  function removeMovimiento(id) {
    state.movimientos = state.movimientos.filter(function (m) { return m.id !== id; });
    save();
  }

  /* ---------- Lógica de stock ---------- */
  function computeStocks() {
    var map = {};
    state.articulos.forEach(function (a) { map[a.id] = a.stockInicial || 0; });
    state.movimientos.forEach(function (m) {
      if (!(m.articuloId in map)) return;
      if (m.tipo === 'venta') map[m.articuloId] -= m.cantidad;
      else map[m.articuloId] += m.cantidad; // entrega o ajuste
    });
    return map;
  }
  function stockActual(id) {
    var s = computeStocks();
    return s[id] || 0;
  }
  function totales(id) {
    var t = { entregas: 0, ventas: 0, ajustes: 0 };
    state.movimientos.forEach(function (m) {
      if (m.articuloId !== id) return;
      if (m.tipo === 'entrega') t.entregas += m.cantidad;
      else if (m.tipo === 'venta') t.ventas += m.cantidad;
      else t.ajustes += m.cantidad;
    });
    return t;
  }
  // 'sin' (sin stock) | 'bajo' (en/abajo del punto de pedido) | 'ok'
  function estado(a, stock) {
    if (stock === undefined) stock = stockActual(a.id);
    if (stock <= 0) return 'sin';
    if (stock <= (a.puntoPedido || 0)) return 'bajo';
    return 'ok';
  }
  function sugerido(a, stock) {
    if (stock === undefined) stock = stockActual(a.id);
    return Math.max(0, (a.stockMaximo || 0) - stock);
  }
  function necesitaPedido(a, stock) {
    if (stock === undefined) stock = stockActual(a.id);
    return stock <= (a.puntoPedido || 0) && sugerido(a, stock) > 0;
  }
  // Lista de reposición sugerida (artículos activos que necesitan pedido)
  function pedidoSugerido() {
    var stocks = computeStocks();
    return getArticulos({ soloActivos: true })
      .filter(function (a) { return necesitaPedido(a, stocks[a.id]); })
      .map(function (a) {
        return { articulo: a, stock: stocks[a.id], sugerido: sugerido(a, stocks[a.id]) };
      });
  }

  /* ---------- Pedidos ---------- */
  function crearPedido(items, nota) {
    var clean = items
      .map(function (it) {
        var a = getArticulo(it.articuloId);
        return {
          articuloId: it.articuloId,
          codigo: a ? a.codigo : '',
          nombre: a ? a.nombre : '(artículo)',
          cantidad: Math.round(num(it.cantidad, 0))
        };
      })
      .filter(function (it) { return it.cantidad > 0; });
    if (!clean.length) return null;
    var p = { id: uid(), fecha: hoyISO(), estado: 'pendiente', nota: (nota || '').trim(), items: clean };
    state.pedidos.unshift(p);
    save();
    return p;
  }
  function getPedidos() { return state.pedidos.slice(); }
  function getPedido(id) {
    for (var i = 0; i < state.pedidos.length; i++) if (state.pedidos[i].id === id) return state.pedidos[i];
    return null;
  }
  // Marcar entregado: genera movimientos de 'entrega' (repone stock en el cliente)
  function marcarPedidoEntregado(id) {
    var p = getPedido(id);
    if (!p || p.estado === 'entregado') return null;
    p.items.forEach(function (it) {
      if (getArticulo(it.articuloId)) {
        addMovimiento({
          articuloId: it.articuloId,
          tipo: 'entrega',
          cantidad: it.cantidad,
          fecha: hoyISO(),
          nota: 'Reposición pedido #' + p.id.slice(-5).toUpperCase()
        });
      }
    });
    p.estado = 'entregado';
    p.entregadoEl = hoyISO();
    save();
    return p;
  }
  function eliminarPedido(id) {
    state.pedidos = state.pedidos.filter(function (p) { return p.id !== id; });
    save();
  }

  /* ---------- Respaldo / datos ---------- */
  function exportData() { return JSON.stringify(state, null, 2); }
  function importData(json) {
    var p = typeof json === 'string' ? JSON.parse(json) : json;
    var base = blank();
    base.meta = Object.assign(base.meta, p.meta || {});
    base.articulos = Array.isArray(p.articulos) ? p.articulos : [];
    base.movimientos = Array.isArray(p.movimientos) ? p.movimientos : [];
    base.pedidos = Array.isArray(p.pedidos) ? p.pedidos : [];
    state = base;
    save();
  }
  function resetAll() { state = blank(); save(); }

  /* ---------- Datos de ejemplo ---------- */
  function loadDemo() {
    state = blank();
    state.meta.empresa = 'Distribuidora Aurora';
    state.meta.cliente = 'Kiosco El Sol';
    var demo = [
      { codigo: 'BEB-001', nombre: 'Agua Mineral 500ml', descripcion: 'Botella de agua sin gas, pack individual.', precio: 700, stockInicial: 48, stockMaximo: 60, puntoPedido: 24, color: '#3b82f6' },
      { codigo: 'BEB-014', nombre: 'Gaseosa Cola 2,25L', descripcion: 'Bebida cola retornable familiar.', precio: 2200, stockInicial: 30, stockMaximo: 36, puntoPedido: 14, color: '#ef4444' },
      { codigo: 'GOL-007', nombre: 'Alfajor Triple', descripcion: 'Alfajor de chocolate relleno con dulce de leche.', precio: 950, stockInicial: 80, stockMaximo: 120, puntoPedido: 45, color: '#a16207' },
      { codigo: 'SNK-022', nombre: 'Papas Fritas 120g', descripcion: 'Snack clásico, bolsa familiar.', precio: 1800, stockInicial: 40, stockMaximo: 50, puntoPedido: 20, color: '#f59e0b' },
      { codigo: 'GAL-003', nombre: 'Galletitas Surtidas', descripcion: 'Paquete de galletitas dulces variadas.', precio: 1500, stockInicial: 35, stockMaximo: 48, puntoPedido: 18, color: '#10b981' },
      { codigo: 'LAC-009', nombre: 'Yogur Bebible 1L', descripcion: 'Yogur sabor frutilla, botella de 1 litro.', precio: 2600, stockInicial: 20, stockMaximo: 30, puntoPedido: 12, color: '#ec4899' }
    ];
    demo.forEach(function (d) {
      addArticulo({
        codigo: d.codigo, nombre: d.nombre, descripcion: d.descripcion, precio: d.precio,
        stockInicial: d.stockInicial, stockMaximo: d.stockMaximo, puntoPedido: d.puntoPedido,
        foto: placeholder(d.nombre, d.color)
      });
    });
    // Simular una informe de ventas (últimos 15 días) para que dispare pedidos
    var arts = state.articulos;
    var ventas = [30, 22, 50, 28, 24, 14];
    arts.forEach(function (a, i) {
      addMovimiento({ articuloId: a.id, tipo: 'venta', cantidad: ventas[i] || 0, fecha: hoyMenos(15), nota: 'Informe quincenal del cliente' });
    });
    save();
  }

  /* ---------- Utilidades ---------- */
  function hoyISO() {
    var d = new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  function hoyMenos(dias) {
    var d = new Date();
    d.setDate(d.getDate() - dias);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  // Imagen placeholder (SVG data-uri) con iniciales y color por nombre
  function placeholder(nombre, color) {
    var palette = ['#6366f1', '#8b5cf6', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#14b8a6'];
    var initials = (nombre || '?')
      .split(/\s+/).slice(0, 2).map(function (w) { return w.charAt(0); }).join('').toUpperCase();
    var c = color;
    if (!c) {
      var h = 0;
      for (var i = 0; i < nombre.length; i++) h = (h * 31 + nombre.charCodeAt(i)) % palette.length;
      c = palette[h];
    }
    var svg =
      '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="260">' +
      '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0" stop-color="' + c + '"/>' +
      '<stop offset="1" stop-color="' + shade(c, -28) + '"/></linearGradient></defs>' +
      '<rect width="400" height="260" fill="url(#g)"/>' +
      '<text x="200" y="148" font-family="Inter,Arial,sans-serif" font-size="92" font-weight="800" ' +
      'fill="#ffffff" fill-opacity="0.92" text-anchor="middle">' + initials + '</text></svg>';
    return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
  }
  function shade(hex, amt) {
    var c = hex.replace('#', '');
    if (c.length === 3) c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
    var r = clamp(parseInt(c.slice(0, 2), 16) + amt);
    var g = clamp(parseInt(c.slice(2, 4), 16) + amt);
    var b = clamp(parseInt(c.slice(4, 6), 16) + amt);
    return '#' + hx(r) + hx(g) + hx(b);
  }
  function clamp(v) { return Math.max(0, Math.min(255, v)); }
  function hx(v) { var s = v.toString(16); return s.length === 1 ? '0' + s : s; }

  /* ---------- API pública ---------- */
  window.Store = {
    getMeta: getMeta, setMeta: setMeta,
    getArticulos: getArticulos, getArticulo: getArticulo,
    addArticulo: addArticulo, updateArticulo: updateArticulo, removeArticulo: removeArticulo,
    addMovimiento: addMovimiento, addMovimientosBatch: addMovimientosBatch,
    getMovimientos: getMovimientos, removeMovimiento: removeMovimiento,
    computeStocks: computeStocks, stockActual: stockActual, totales: totales,
    estado: estado, sugerido: sugerido, necesitaPedido: necesitaPedido, pedidoSugerido: pedidoSugerido,
    crearPedido: crearPedido, getPedidos: getPedidos, getPedido: getPedido,
    marcarPedidoEntregado: marcarPedidoEntregado, eliminarPedido: eliminarPedido,
    exportData: exportData, importData: importData, resetAll: resetAll, loadDemo: loadDemo,
    placeholder: placeholder, hoyISO: hoyISO
  };
})();
