/**
 * StockRotativo (OSA)  ->  Google Sheet "Pedidos Web", pestaña "Pedidos LK".
 *
 * Recibe por POST el pedido de reposición de OSA y agrega UNA FILA POR ARTÍCULO,
 * asignando automáticamente el N° Pedido = (máximo N° Pedido de la planilla) + 1
 * (con LockService para que nunca se pise con otro envío).
 *
 * Columnas que escribe (A..I); J..P quedan vacías:
 *   A Fecha · B N° Pedido · C Cliente · D Vend · E Cod Art · F Cajas ·
 *   G Uni Pedidas · H Sucursal de Entrega · I Condición de Pago
 *
 * --------------------------- CÓMO DEPLOYARLO ---------------------------
 * IMPORTANTE: NO lo pegues en el Apps Script del propio Sheet (eso pisaría la
 * automatización actual de la planilla). Creá un proyecto SEPARADO. Este script
 * abre el Sheet por ID, así que funciona standalone y NO toca nada de lo existente:
 * lo único que hace es AGREGAR filas al final de la pestaña "Pedidos LK"
 * (nunca borra ni edita filas ni otras pestañas).
 *
 * 1) Andá a https://script.google.com  ->  Nuevo proyecto (standalone).
 * 2) Pegá este archivo y guardá.
 * 3) Implementar -> Nueva implementación -> tipo "Aplicación web".
 *      - Ejecutar como: Yo (tu cuenta)
 *      - Quién tiene acceso: Cualquier usuario   (o "Cualquiera con el vínculo")
 *      - Autorizá los permisos que pida.
 * 4) Copiá la URL que termina en /exec.
 * 5) Pegala en StockRotativo -> Configuración -> "Integración Loekemeyer".
 * -----------------------------------------------------------------------
 */

var SPREADSHEET_ID = '1YLjfYjuq2l5FN0xXZ1b_1aCOQ8mFAS7hLeYpFtzcW6s';
var TAB_DESTINO = 'Pedidos LK';
// Pestañas de donde se calcula el máximo N° Pedido (para que máx+1 no choque con
// NINGUNA via: la web escribe en "Pedidos CH", OSA en "Pedidos LK", y "Definidos"
// es el consolidado. Se recalcula en cada envio -> el numero se autocorrige.
var TABS_NUMERACION = ['Pedidos LK', 'Pedidos CH', 'Definidos'];
var COL_NUMERO = 2; // columna B = N° Pedido

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000); // serializa la asignación del número
  try {
    var pedido = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var hoja = ss.getSheetByName(TAB_DESTINO);
    if (!hoja) throw new Error('No existe la pestaña "' + TAB_DESTINO + '"');

    var items = pedido.items || [];
    if (!items.length) throw new Error('Pedido sin artículos');

    var numero = siguienteNumero(ss);
    var fecha = pedido.fecha ||
      Utilities.formatDate(new Date(), ss.getSpreadsheetTimeZone(), 'dd/MM/yyyy');

    var filas = items.map(function (it) {
      var codArt = "'" + String(it.cod || '').trim(); // apostrofe = forzar texto (igual que la via web)
      // A          B       C               D            E       F         G             H                 I                    J..P
      return [fecha, numero, pedido.cliente, pedido.vend, codArt, it.cajas, it.unidades, pedido.sucursal, pedido.condicionPago, '', '', '', '', '', '', ''];
    });

    hoja.getRange(hoja.getLastRow() + 1, 1, filas.length, filas[0].length).setValues(filas);
    SpreadsheetApp.flush();

    return json({ ok: true, numeroPedido: numero, filas: filas.length });
  } catch (err) {
    return json({ ok: false, error: String(err && err.message ? err.message : err) });
  } finally {
    lock.releaseLock();
  }
}

// Máximo N° Pedido existente en la planilla + 1.
function siguienteNumero(ss) {
  var max = 0;
  TABS_NUMERACION.forEach(function (nombre) {
    var h = ss.getSheetByName(nombre);
    if (!h || h.getLastRow() < 2) return;
    var valores = h.getRange(2, COL_NUMERO, h.getLastRow() - 1, 1).getValues();
    for (var i = 0; i < valores.length; i++) {
      var n = parseInt(valores[i][0], 10);
      if (!isNaN(n) && n > max) max = n;
    }
  });
  return max + 1;
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// Permite verificar en el navegador que el endpoint está vivo (GET).
function doGet() {
  return json({ ok: true, msg: 'Endpoint StockRotativo activo. Enviá el pedido por POST.' });
}
