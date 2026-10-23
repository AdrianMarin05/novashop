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


## Accounts and address verification

The account page supports passwordless one-time codes. Email OTP requires Supabase Auth email configuration and the Magic Link/OTP template to use `{{ .Token }}`; a production SMTP sender is recommended. SMS OTP requires enabling Phone Auth and configuring a supported SMS provider in Supabase. SMS providers may charge per message.

The signup form collects first/last name, phone, email, a written delivery address and a map pin. For guest checkouts, physical delivery forms also include a map pin; coordinates are sent with the order when selected. The pin is a supplement, not a replacement for street address, neighborhood, city and department.

## Administrator product catalog

- Admin UI: `admin.html`
- Admin browser script: `admin.js`
- Edge Function: `supabase/functions/admin-products/index.ts`
- Media bucket: `products-media` (public-read media; uploads require admin authorization)
- Schema additions: `supabase/schema.sql`

### Grant the first admin

Security by design: the first account is **not** automatically made an administrator. After creating and verifying your own account in `cuenta.html`, open Supabase > Authentication > Users and copy your user UUID. Then run in SQL Editor:

```sql
insert into public.store_admins (user_id)
values ('PASTE-YOUR-USER-UUID-HERE')
on conflict (user_id) do nothing;
```

Replace the example text with your own verified account UUID. Never give this role to customer accounts. Then open `admin.html`; the server checks this allowlist before listing, editing, hiding, or uploading product media.

## Current payment status

Orders are persisted in Supabase and start as `pending_payment`. The store currently continues to WhatsApp after creating the order. It does **not** yet create a Mercado Pago checkout or mark payments approved automatically. Confirm payment independently before fulfilling an order until a payment-provider webhook has been implemented and tested.


## Admin panel de productos

- Panel: `admin.html`
- Función segura: `supabase/functions/admin-products/index.ts`
- El servidor comprueba que el usuario autenticado esté en `public.store_admins`.
- Para conceder acceso, crea primero la cuenta de usuario y ejecuta un `INSERT INTO public.store_admins (user_id)` usando el UUID de esa cuenta desde el SQL Editor privado de Supabase. No abras permisos de escritura directos en la tabla a usuarios normales.
- El panel permite cargar hasta 8 fotos (12 MB cada una) y un video (máximo 50 MB) al bucket `products-media`, editar nombre, descripción, categoría, precio y ocultar productos.


## Registro y acceso v16

- `cuenta.html`: registro en dos pasos; contacto/contraseña y después dirección/mapa.
- `verificar.html`: una única pantalla para introducir el código enviado por Supabase Auth.
- `verify.js`: valida el OTP y guarda el perfil/dirección sin almacenar la contraseña en sessionStorage.
- `auth-login`: Edge Function permite iniciar sesión con correo o teléfono y contraseña. Supabase Auth valida la contraseña y la función solo devuelve tokens con credenciales correctas.
- `profiles.marketing_opt_in`: consentimiento opcional independiente para recibir ofertas por correo.
- El envío por correo utiliza el proveedor de correo de Supabase. El envío por SMS necesita proveedor de SMS; WhatsApp requiere configurar Twilio/Twilio Verify con canal WhatsApp y credenciales. No se simula un envío WhatsApp mientras no esté configurado.


## Administración de stock y ventas

- El panel privado calcula ingresos y porcentajes solo a partir de pedidos con pago confirmado.
- `products.stock_quantity`: entero no negativo; `NULL` significa inventario aún no configurado y `0` significa agotado.
- Los productos existentes quedan con stock sin configurar porque no se proporcionó una cantidad real para ellos.
- Los pedidos pendientes por WhatsApp no se consideran ventas pagadas. Hace falta integrar una pasarela con webhook de pago para registrar las ventas automáticamente.
- El acceso a métricas y administración se comprueba en la Edge Function `admin-products` contra `public.store_admins`.
