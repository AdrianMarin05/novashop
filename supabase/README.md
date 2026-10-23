# NovaShop + Supabase

La base de datos ya fue creada en el proyecto Supabase `fbcffmhcypsprvgdbtas`.

- Tablas: `profiles`, `products`, `orders`, `order_items`.
- RLS habilitado y políticas para que cada usuario consulte su propio perfil e historial.
- Edge Function desplegada: `create-order`. Guarda pedidos como `pending_payment`; no realiza cobros.
- La clave publicable puede estar en `supabase-config.js`; no publiques jamás una `service_role`/secret key.

## Configurar Auth
En Supabase > Authentication > URL Configuration, añade a Redirect URLs la URL de publicación de esta tienda, incluidas las rutas de `cuenta.html`. Revisa SMTP si deseas correos de confirmación más confiables.

## Importante
Checkout actual guarda el pedido en la base y abre WhatsApp. Aún no integra pagos online. Antes de despachar, verifica el pago manualmente hasta conectar una pasarela con webhook/Edge Function verificada.
