# StocksOSA — notas para el agente

App de stock de OSA (cliente de Loekemeyer). Sitio **estático** (sin build), JS plano.

## Sitio en vivo
- **https://stocksosalk.netlify.app/**  ← URL real (Netlify, auto-deploy desde `main`).
- Cada push a `main` se publica solo en ~1 min. (GitHub Pages es alternativa secundaria.)
- Tras deployar, avisar al usuario que haga **Ctrl+F5** (Netlify/el navegador cachean el JS).

## Estructura
- `index.html`, `css/styles.css`, `js/app.js` (UI), `js/store.js` (estado + lógica, localStorage).
- `apps-script/PedidosLK.gs` — Apps Script (referencia; deployado aparte en Google, ver abajo).
- Versión visible en `APP_VERSION` (js/app.js), se muestra en el sidebar.
- Unidad canónica = **unidades**; se muestran en cajas/unidades con el toggle (`uxc` = uni por caja).

## Reglas de negocio clave
- **Pedido sugerido** = máximo objetivo − stock, redondeado **a cajas cerradas** (`ceil(faltante/uxc)*uxc`),
  así cajas × factor = unidades. Sin máximo definido ⇒ no repone.

## Integración "Enviar a Loekemeyer" (botón en Stocks)
Manda el pedido sugerido a un Google Sheet + copia en Supabase. **Sin WhatsApp.**
- **Supabase** proyecto `loekemeyer's web` (ref `kwkclwhmoygunqmlegrg`, org "Pagina Web LK"). Es la base de
  PRODUCCIÓN del e-commerce LK — NO tocar tablas reales (`orders`, `order_items`, `customers`, bot, etc.).
  - Tabla aislada `osa_reposicion` (insert-only para anon; copia/histórico).
  - RPC `osa_next_pedido_number()` ⇒ `nextval('orders_id_seq')`: el N° de pedido sale del **mismo
    contador que usa la web** (la web numera con `orders.id`), así nunca colisiona.
- **Google Sheet** "Pedidos Web" (id `1YLjfYjuq2l5FN0xXZ1b_1aCOQ8mFAS7hLeYpFtzcW6s`, dueño
  loekemeyer.n8n@gmail.com). OSA escribe en la pestaña **"Pedidos LK"** (la web usa "Pedidos CH").
- **Apps Script** standalone "PedidosOSA" (NO el del Sheet) → recibe el pedido por POST y agrega filas.
  Su URL `/exec` está precargada en `APPS_SCRIPT_URL` (js/app.js).
- Cabecera fija OSA: cliente `2533`, vend `7`, condición de pago `18`. Sucursales (selector en Stocks):
  Villa Lugano (default), Ezeiza, Retira. Columnas Sheet A-I; J-P vacías.

## Git / deploy
- Branch de desarrollo: `claude/sleepy-dijkstra-u908ua`.
- Para publicar: commit en la branch → push → fast-forward `main` → push `main` (dispara Netlify).
