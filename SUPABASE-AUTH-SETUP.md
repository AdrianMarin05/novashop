# NovaShop — arreglar el código de confirmación de correo

## 1. Corregir el error de localhost
En Supabase abre **Authentication → URL Configuration**.

Configura:
- **Site URL:** `https://adrianmarin05.github.io/novashop`
- **Redirect URLs:**
  - `https://adrianmarin05.github.io/novashop/verificar.html`
  - `https://adrianmarin05.github.io/novashop/cuenta.html`

Guarda los cambios. No uses localhost para el sitio publicado.

## 2. Cambiar el mensaje de confirmación a un código
En Supabase abre **Authentication → Email Templates → Confirm signup**. Ahora el template predeterminado puede enviar un enlace mediante `{{ .ConfirmationURL }}`. Para enviar un código numérico, reemplaza el contenido por:

```html
<h2>Confirma tu cuenta NovaShop</h2>
<p>Tu código de verificación de un solo uso es:</p>
<p style="font-size:28px;font-weight:bold;letter-spacing:6px">{{ .Token }}</p>
<p>Introduce este código en la página de verificación de NovaShop. Si no solicitaste esta cuenta, ignora este mensaje.</p>
```

Guarda la plantilla y vuelve a intentar con un correo que no esté registrado previamente. El código lo genera Supabase Auth; NovaShop no debe generarlo ni inventar uno manualmente.

## 3. WhatsApp
La opción de verificación por WhatsApp está inactiva hasta conectar Twilio/Twilio Verify con canal WhatsApp. La autenticación por correo no necesita esa integración. No actives el canal WhatsApp hasta que las credenciales del proveedor estén configuradas.
