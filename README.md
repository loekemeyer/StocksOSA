# 📦 StockRotativo

Aplicación web simple y visual para gestionar **stock rotativo / mercadería en consignación**.

Pensada para cuando dejás productos en un cliente y necesitás controlar cuánto queda,
cuánto se vendió y cuándo conviene reponer — todo automático.

## ✨ ¿Cómo funciona?

La lógica es la que pediste:

```
Stock actual = Stock inicial + Entregas (las cargás vos) − Ventas (las informa el cliente)
```

1. **Cargás tus artículos** con foto, descripción, *stock inicial*, *stock máximo* y *punto de pedido*.
2. **Cada 15 días** ingresás en **Cargar ventas** lo que el cliente vendió. El stock baja solo.
3. Cuando un artículo llega a su **punto de pedido**, aparece en **Pedido sugerido**, con la
   cantidad exacta para volver al **stock máximo**.
4. Confirmás el pedido, lo **imprimís** y, al entregarlo, lo marcás como *entregado*:
   el stock se repone automáticamente.

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
