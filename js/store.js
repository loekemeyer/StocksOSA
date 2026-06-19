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
        periodoMeses: 17, // meses que abarca el "total histórico" (para el promedio por quincena)
        creado: Date.now()
      },
      articulos: [], // {id,codigo,nombre,descripcion,foto,precio,stockInicial,stockMaximo,puntoPedido,totalHistorico,activo}
      movimientos: [], // {id,articuloId,tipo,cantidad,fecha,nota}
      pedidos: [] // {id,fecha,estado,nota,items:[{articuloId,codigo,nombre,cantidad}]}
    };
  }

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return seedReal(); // primera vez: catálogo real precargado
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
      totalHistorico: Math.max(0, Math.round(num(data.totalHistorico, 0))),
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
    if (data.totalHistorico !== undefined) a.totalHistorico = Math.max(0, Math.round(num(data.totalHistorico, 0)));
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
  // 'config' (sin stock máximo definido) | 'sin' | 'bajo' | 'ok'
  function estado(a, stock) {
    if (!a.stockMaximo || a.stockMaximo <= 0) return 'config';
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
    if (!a.stockMaximo || a.stockMaximo <= 0) return false; // sin máximo definido, no aplica
    if (stock === undefined) stock = stockActual(a.id);
    // Pedido = stock máximo - stock real. Genera pedido siempre que falte (incluido stock 0 o negativo).
    return sugerido(a, stock) > 0;
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

  /* ---------- Promedio de compra por quincena ---------- */
  // El cliente compra "totalHistorico" en "periodoMeses" meses. 1 mes = 2 quincenas.
  function quincenasPeriodo() { return Math.max(1, (state.meta.periodoMeses || 17) * 2); }
  function promedioQuincena(a) { return (a.totalHistorico || 0) / quincenasPeriodo(); }
  function promedioMes(a) { return (a.totalHistorico || 0) / Math.max(1, state.meta.periodoMeses || 17); }
  // Ranking de artículos por compra promedio por quincena (mayor a menor)
  function rankingCompras() {
    return state.articulos.slice()
      .sort(function (a, b) {
        var d = (b.totalHistorico || 0) - (a.totalHistorico || 0);
        return d !== 0 ? d : (a.nombre || '').localeCompare(b.nombre || '', 'es');
      })
      .map(function (a) {
        return { articulo: a, total: a.totalHistorico || 0, promQuincena: promedioQuincena(a), promMes: promedioMes(a) };
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

  /* ---------- Catálogo real (Loekemeyer · cliente Osa Distribuidora SRL) ----------
     [codigo, nombre, totalHistorico]  ·  ordenado por total (mayor a menor).
     El total abarca ~periodoMeses meses (ver meta.periodoMeses). */
  var CATALOGO = [
    ['505', 'Pelador mango plástico', 6365],
    ['513', 'Pelador mango metálico', 4075],
    ['506', 'Abrelatas uña rojo', 3627],
    ['504', 'Afila cuchillos', 2190],
    ['501', 'Abrelatas a manija', 2184],
    ['502', 'Abrelatas mariposa cromado', 1404],
    ['546', 'Corta queso blandos mango Loeke', 760],
    ['031', 'Filtro de café 10cm', 745],
    ['544', 'Batidor pera alambre', 605],
    ['520', 'Sacacorcho tipo mozo cromado', 397],
    ['512', 'Abrelatas mariposa capuchón rojo', 390],
    ['523', 'Sacacorcho doble aleta', 380],
    ['529E', 'Sacacorcho doble impulso acero', 319],
    ['315', 'Pisa papas acero inox', 307],
    ['530', 'Sacacorcho tipo mozo color', 284],
    ['521', 'Sacacorcho combinado cromado', 278],
    ['519', 'Cuchillo untar mango madera x2', 266],
    ['508', 'Sacafuentes articulado', 246],
    ['579', 'Tapón de vino/cerveza x1 color', 239],
    ['507', 'Rompenueces', 212],
    ['587', 'Pelador metálico corte láser', 210],
    ['562', 'Corta pizza 6cm mango Loeke', 194],
    ['395', 'Descorazonador de manzana', 193],
    ['577', 'Tapón de vino/cerveza x1 premium', 179],
    ['559', 'Corta ravioles c/mango Loeke', 176],
    ['531', 'Sacacorcho combinado color', 166],
    ['057', 'Destapa corona x1 cromado', 160],
    ['518', 'Sacafuente pizzero', 159],
    ['575', 'Tapón de vino/cerveza x1 negro', 158],
    ['510', 'Abrelata uña cromado', 150],
    ['551', 'Cuchillo de untar mango plástico x2', 110],
    ['560', 'Pinza corta alambre 21cm', 106],
    ['589E', 'Pelador mango acrílico', 100],
    ['598E', 'Pelador negro dentado', 100],
    ['388E', 'Máquina corta papa', 96],
    ['246', 'Prensa matambre', 81],
    ['511', 'Abrelatas uña 3 en 1', 80],
    ['564', 'Corta pizza 8cm mango madera', 78],
    ['525E', 'Sacacorcho cabo de madera', 75],
    ['542', 'Ahueca papas', 69],
    ['580E', 'Batidor mini', 68],
    ['580', 'Batidor mini', 63],
    ['280', 'Manga repostera + 4 boquillas', 60],
    ['525', 'Sacacorcho cabo madera', 55],
    ['811E', 'Corta pizza mango ergonómico Ø9cm', 50],
    ['543', 'Ahueca frutas', 42],
    ['935E', 'Espátula calada nylon mango madera', 40],
    ['538E', 'Sacacorcho azul', 40],
    ['509', 'Pala batidora', 38],
    ['515', 'Batidor resorte', 38],
    ['934E', 'Cuchara fideos nylon mango madera', 35],
    ['548', 'Pincel pastelero', 34],
    ['361E', 'Rallador 4 lados acero inox', 31],
    ['566E', 'Aceitera 100 ml', 30],
    ['937E', 'Batidor pera nylon mango madera', 30],
    ['583E', 'Especiero tapa bamboo', 30],
    ['396', 'Enrulador de manteca', 25],
    ['478E', 'Sacacorcho doble impulso', 25],
    ['570', 'Pala de canelones', 23],
    ['561', 'Pinza grande alambre', 22],
    ['596', 'Pinza de ensalada mango plástico 23cm', 22],
    ['229', 'Ñoquera madera', 20],
    ['581', 'Sacacorcho mango ergonómico', 20],
    ['931E', 'Espátula lisa nylon mango madera', 20],
    ['936E', 'Espumadera nylon mango madera', 20],
    ['932E', 'Cuchara nylon mango madera', 20],
    ['540E', 'Sacacorcho premium', 20],
    ['539E', 'Sacacorcho negro', 20],
    ['536E', 'Sacacorcho full black', 20],
    ['222', 'Bate bife madera', 16],
    ['595', 'Pinza de fiambre mango plástico 23cm', 16],
    ['948E', 'Espumadera acero inox', 16],
    ['325', 'Espátula repostera plástico 1 pza', 15],
    ['522E', 'Sacacorcho doble aleta premium', 15],
    ['943E', 'Cucharón acero inox', 15],
    ['574E', 'Artículo 574E', 15],
    ['585E', 'Sacacorcho doble aleta fundición', 15],
    ['809E', 'Corta pizza mango ergonómico 6cm', 15],
    ['569', 'Pelanaranjas x1 display', 14],
    ['554', 'Cucharita matera', 13],
    ['945E', 'Espátula calada acero inox', 11],
    ['563', 'Pinza hamburguesa', 10],
    ['586', 'Pelapapas mango ergonómico', 10],
    ['591', 'Despolvillador de yerba', 10],
    ['933E', 'Cucharón nylon mango madera', 10],
    ['941E', 'Espátula lisa acero inox', 10],
    ['942E', 'Cuchara acero inox', 10],
    ['944E', 'Cuchara fideos acero inox', 10],
    ['817E', 'Rallador c/mango ergonómico', 10],
    ['364E', 'Rallador gourmet grano medio', 10],
    ['328E', 'Rallador plano 3 usos acero inox', 8],
    ['360E', 'Rallador 4 lados a/l mango plástico', 6],
    ['594', 'Pinza de fideos mango plástico 25cm', 3],
    ['355', 'Pisa papas nylon con mango', 2],
    ['524', 'Sacacorcho de espumantes', 2]
  ];

  // Ventas informadas por el cliente · 1ª quincena de junio 2026.
  // [codigoDelCatalogo, cajasVendidas] (mapeo desde los códigos "L" del informe).
  var VENTAS_JUNIO = [
    ['031', 12], ['057', 4], ['222', 8], ['315', 6], ['395', 1], ['396', 3],
    ['501', 29], ['502', 17], ['504', 28], ['505', 82], ['506', 36], ['507', 1],
    ['508', 1], ['510', 48], ['512', 3], ['513', 32], ['518', 4], ['519', 5],
    ['520', 5], ['521', 3], ['523', 5], ['525', 3], ['529E', 211], ['530', 2],
    ['531', 1], ['539E', 12], ['540E', 3], ['542', 1], ['543', 3], ['544', 7],
    ['546', 23], ['548', 3], ['551', 5], ['559', 5], ['560', 3], ['561', 1],
    ['562', 9], ['564', 2], ['566E', 6], ['575', 1], ['577', 3], ['579', 2],
    ['583E', 7], ['587', 1], ['589E', 7], ['598E', 6], ['932E', 3], ['934E', 2],
    ['935E', 4], ['936E', 2], ['937E', 2], ['942E', 2]
  ];

  // Construye el estado inicial con el catálogo real precargado.
  function seedReal() {
    var st = blank();
    st.meta.empresa = 'Loekemeyer';
    st.meta.cliente = 'Osa Distribuidora SRL';
    st.meta.moneda = 'ARS';
    st.meta.periodoMeses = 17;
    var meses = st.meta.periodoMeses || 17;
    CATALOGO.forEach(function (row) {
      var codigo = row[0], nombre = row[1], total = row[2];
      var promMes = total / meses;            // promedio de compra por mes
      var max = Math.round(1.5 * promMes);    // stock máximo = 1.5 meses de demanda
      st.articulos.push({
        id: 'a_' + codigo, codigo: codigo, nombre: nombre, descripcion: '',
        foto: placeholder(nombre), precio: 0,
        stockInicial: max,                    // arranca "lleno" (= máximo)
        stockMaximo: max,
        puntoPedido: Math.round(promMes / 2), // repone al bajar de ~media quincena
        totalHistorico: total, activo: true
      });
    });
    // Carga las ventas de la 1ª quincena de junio como movimientos de venta.
    VENTAS_JUNIO.forEach(function (v) {
      var codigo = v[0], qty = v[1];
      if (qty <= 0) return;
      var art = null;
      for (var i = 0; i < st.articulos.length; i++) {
        if (st.articulos[i].codigo === codigo) { art = st.articulos[i]; break; }
      }
      if (art) st.movimientos.push({
        id: 'mv_' + codigo, articuloId: art.id, tipo: 'venta', cantidad: qty,
        fecha: '2026-06-15', nota: 'Ventas 1ª quincena de junio'
      });
    });
    return st;
  }

  // Botón "Cargar datos de ejemplo" = restaurar el catálogo real.
  function loadDemo() { state = seedReal(); save(); }

  /* ---------- Utilidades ---------- */
  function hoyISO() {
    var d = new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  // Imagen placeholder (SVG data-uri) con iniciales y color por nombre
  function placeholder(nombre, color) {
    var palette = ['#6366f1', '#8b5cf6', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#14b8a6'];
    nombre = nombre || '?';
    var initials = nombre.split(/\s+/).slice(0, 2).map(function (w) { return w.charAt(0); }).join('').toUpperCase();
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

  // Inicializa el estado (luego de definir catálogo, ventas y seed)
  var state = load();

  /* ---------- API pública ---------- */
  window.Store = {
    getMeta: getMeta, setMeta: setMeta,
    getArticulos: getArticulos, getArticulo: getArticulo,
    addArticulo: addArticulo, updateArticulo: updateArticulo, removeArticulo: removeArticulo,
    addMovimiento: addMovimiento, addMovimientosBatch: addMovimientosBatch,
    getMovimientos: getMovimientos, removeMovimiento: removeMovimiento,
    computeStocks: computeStocks, stockActual: stockActual, totales: totales,
    estado: estado, sugerido: sugerido, necesitaPedido: necesitaPedido, pedidoSugerido: pedidoSugerido,
    promedioQuincena: promedioQuincena, promedioMes: promedioMes, rankingCompras: rankingCompras, quincenasPeriodo: quincenasPeriodo,
    crearPedido: crearPedido, getPedidos: getPedidos, getPedido: getPedido,
    marcarPedidoEntregado: marcarPedidoEntregado, eliminarPedido: eliminarPedido,
    exportData: exportData, importData: importData, resetAll: resetAll, loadDemo: loadDemo,
    placeholder: placeholder, hoyISO: hoyISO
  };
})();
