# NovaShop — arreglar el código de confirmación de correo

## 1. Corregir el error de localhost
En Supabase abre **Authentication → URL Configuration**.

Configura:
- **Site URL:** `https://adrianmarin05.github.io/novashop`
- **Redirect URLs:**
  - `https://adrianmarin05.github.io/novashop/verificar.html`
  - `https://adrianmarin05.github.io/novashop/cuenta.html`
  - `https://adrianmarin05.github.io/novashop/restablecer.html`

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


## Por qué no llega otro correo al mismo usuario
Los registros de Auth mostraron `user_repeated_signup` para el correo que ya estaba verificado. Supabase no genera un segundo código al intentar registrar otra vez un correo ya existente/confirmado. Para probar un registro nuevo, usa un correo nuevo; para esa cuenta, inicia sesión o usa la recuperación de contraseña.

La solicitud anterior se inició desde `http://localhost:3000`. El código actual ahora fija la redirección a la página publicada de GitHub Pages, pero el correo solo se convertirá en código numérico después de guardar la plantilla de **Confirm signup** con `{{ .Token }}`.


## Página separada de recuperación de contraseña
La recuperación y el formulario de contraseña nueva están en `restablecer.html`, separado de la página de cuenta. En URL Configuration asegúrate de permitir también `https://adrianmarin05.github.io/novashop/restablecer.html`. La nueva página envía el enlace de recuperación con esa redirección.
