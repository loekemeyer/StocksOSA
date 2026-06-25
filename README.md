# 📦 StockRotativo

Aplicación web simple y visual para gestionar **stock rotativo / mercadería en consignación**.

Pensada para cuando dejás productos en un cliente y necesitás controlar cuánto queda,
cuánto se vendió y cuándo conviene reponer — todo automático.

## ✨ ¿Cómo funciona?

```
Stock hoy = Stock inicial + Entregas de Loeke − Ventas de OSA
```

La app está organizada en **6 módulos**:

1. **Stocks** — el stock de hoy, el *punto de pedido* y el *pedido sugerido* de cada artículo.
2. **Movimientos** — `inicial + entregas − ventas = stock hoy`. Tocás un artículo y ves cada
   movimiento con el **saldo** resultante (filtrable por período).
3. **Punto de pedido** — `promedio de ventas × meses de cobertura`. El promedio es automático
   (o lo sobrescribís) y los meses son globales (o por artículo).
4. **Entregas Loeke** — lo que Loeke entrega a OSA (entra al stock). Se carga
   **importando el Excel de facturación** (.xls/.xlsx); detecta solo si viene en cajas o unidades.
5. **Ventas OSA** — lo que OSA vende a sus clientes (sale del stock). Se carga
   **importando el informe** (PDF con texto, o pegando el texto). Viene en **unidades**:
   se pasa a cajas con las *Uni×Caja*. Cruza por código (`L031` = `031`, `L529` = `529E`).
6. **Control de cargas** — las ventas se cargan **por quincena** (1–15 y 16–fin de mes).
   El módulo muestra **qué quincenas ya se cargaron y cuáles faltan**, y al importar te
   avisa si esa quincena ya estaba cargada (para no duplicar).

El **pedido sugerido** es `punto de pedido − stock hoy`, cuando da positivo. La carga es
siempre **por importación** (no se tipea a mano); al importar ventas elegís a qué quincena imputarlas.

### Cajas / Unidades

El stock se guarda siempre en **unidades** (el stock inicial, las entregas y las ventas
vienen en unidades). Arriba de todo hay un **toggle Cajas ⇄ Unidades** que cambia cómo se
*muestran* las cantidades en toda la app: en cajas se divide por las **unidades por caja**
de cada artículo.

El Excel de entregas puede venir **en unidades o en cajas**, y la app lo **detecta sola**:
si `Cantidad × Precio = Importe` está en unidades; si no, está en cajas y de ahí saca las
unidades por caja. En cualquier caso el stock se registra correctamente en unidades.

## 🖥️ Usarla

### Online (Netlify)
La app está publicada en **Netlify**, conectada a este repositorio: **cada push a `main` se publica solo** en ~1 minuto.

> **https://stocksosalk.netlify.app/**

> _Alternativa:_ también puede servirse por GitHub Pages (Settings → Pages → Deploy from a branch → `main` / `root`), quedando en https://loekemeyer.github.io/StocksOSA/.

### En tu computadora
No necesita instalación. Opciones:

- **Doble clic** en `index.html`, o
- Servirla localmente:
  ```bash
  python3 -m http.server 8000
  # luego abrí http://localhost:8000
  ```

## 💾 Datos

- Todo se guarda en el **navegador** (no se sube a ningún servidor).
- En **Configuración** podés **descargar un respaldo** (.json) e **importarlo** en otra
  computadora o navegador.
- El botón **"Cargar datos de ejemplo"** llena la app con productos de muestra para probarla.

## 🗂️ Estructura

```
index.html        Estructura de la página
css/styles.css    Diseño e interfaz
js/store.js       Datos y lógica (stock, pedidos, respaldo)
js/app.js         Interfaz, navegación y formularios
```

## 🧱 Tecnología

HTML, CSS y JavaScript puro (sin dependencias ni build). Funciona en cualquier navegador moderno.
