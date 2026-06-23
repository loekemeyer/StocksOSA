# 📦 StockRotativo

Aplicación web simple y visual para gestionar **stock rotativo / mercadería en consignación**.

Pensada para cuando dejás productos en un cliente y necesitás controlar cuánto queda,
cuánto se vendió y cuándo conviene reponer — todo automático.

## ✨ ¿Cómo funciona?

```
Stock hoy = Stock inicial + Entregas de Loeke − Ventas de OSA
```

La app está organizada en **5 módulos**:

1. **Stocks** — el stock de hoy, el *punto de pedido* y el *pedido sugerido* de cada artículo.
2. **Movimientos** — `inicial + entregas − ventas = stock hoy`. Tocás un artículo y ves cada
   movimiento con el **saldo** resultante (filtrable por período).
3. **Punto de pedido** — `promedio de ventas × meses de cobertura`. El promedio es automático
   (o lo sobrescribís) y los meses son globales (o por artículo).
4. **Entregas Loeke** — lo que Loeke entrega a OSA (entra al stock). Se carga
   **importando el Excel de facturación** (.xls/.xlsx) con revisión previa, o a mano.
5. **Ventas OSA** — lo que OSA vende a sus clientes (sale del stock). Se carga
   **importando el informe** (PDF con texto, o pegando el texto) con revisión previa,
   o a mano. Cruza por código (`L031` = `031`, `L529` = `529E`).

El **pedido sugerido** es `punto de pedido − stock hoy`, cuando da positivo.

## 🖥️ Usarla

### Online (GitHub Pages)
Se publica gratis desde este repositorio. **Activación única** (una sola vez):

1. Entrá a **Settings → Pages** del repositorio.
2. En **Build and deployment → Source**, elegí **Deploy from a branch**.
3. **Branch:** `main`, **carpeta:** `/ (root)` → **Save**.

En 1–2 minutos queda online en:

> **https://loekemeyer.github.io/StocksOSA/**

A partir de ahí, cada push a `main` se publica solo.

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
