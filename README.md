# NovaShop

Tienda estática con catálogo, carrito, una página de Streaming, cuentas opcionales y pedidos registrados en Supabase.

## Tecnologías

- HTML, CSS y JavaScript estáticos.
- GitHub para guardar el código.
- Supabase Auth + Postgres para cuentas, perfiles y el historial de pedidos.
- Supabase Edge Function `create-order` para guardar pedidos y calcular importes desde el catálogo del servidor.
- Los clientes pueden comprar como invitados; las cuentas son opcionales.

## Archivos principales

- `index.html`: catálogo general.
- `streaming.html`: catálogo de servicios digitales.
- `producto.html?id=<id>`: detalles individuales.
- `cuenta.html`: registro, inicio de sesión, perfil e historial.
- `products.js`: catálogo visible del sitio.
- `supabase-config.js`: solo URL y clave publicable del proyecto.
- `supabase-client.js`: cliente público e integración con la función de pedidos.
- `supabase/`: configuración documentada.

## Seguridad

No se debe publicar ninguna clave secreta ni `service_role`. La clave publishable está diseñada para usarse desde el navegador; las tablas públicas tienen RLS. La función `create-order` valida productos y precios en el servidor. Las compras de invitados se guardan sin asociarse a una cuenta y no se vinculan automáticamente después.

## Estado de pagos

El registro de pedidos funciona, pero el checkout de esta versión aún abre WhatsApp y deja los pedidos en estado `pending_payment`. No existe una pasarela de pago online ni confirmación automática de pago integrada. No despaches pedidos basándote solo en el registro; confirma el pago hasta que se añada un proveedor de pagos con notificaciones verificadas.

## Supabase Auth

En el panel de Supabase, configura Site URL y Redirect URLs con el dominio publicado del sitio, incluyendo `cuenta.html`, para que funcionen confirmación de correo y recuperación de contraseña.
