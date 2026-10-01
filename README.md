# NovaShop — tienda estática para GitHub Pages

Plantilla de tienda online creada con HTML, CSS y JavaScript puro.

## Incluye
- Catálogo con búsqueda, filtros y ordenamiento.
- Carrito con `localStorage`.
- Página individual de producto con URL dinámica: `producto.html?id=1`.
- Galería de imágenes, descripción, características, cantidad y botón "Añadir al carrito".
- Botón de compra directa por WhatsApp.
- Diseño responsive.
- Sin backend ni base de datos.

## Estructura
- `index.html` — portada y catálogo.
- `producto.html` — plantilla de detalle de producto.
- `products.js` — productos, imágenes, descripciones y configuración.
- `script.js` — catálogo y carrito.
- `product.js` — lógica de la página individual.
- `styles.css` — estilos.

## Personalización rápida
En `products.js` puedes cambiar nombre, precio, imágenes, descripción, características y categoría de cada producto.

Cambia también `CONFIG.whatsapp` por el número real de la tienda usando código de país y sin el signo `+`.

## Publicación gratis
Sube estos archivos a un repositorio de GitHub y activa GitHub Pages desde **Settings → Pages**.
