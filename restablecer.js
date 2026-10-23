/* Separate NovaShop password recovery page. */
(() => {
 const $=s=>document.querySelector(s),db=window.NovaShopDB,client=db?.client;
 const status=(message,kind="info")=>{const el=$("#resetMessage");el.textContent=message;el.className="reset-message "+kind;el.hidden=!message;};
 const requestForm=$("#requestResetForm"),changeForm=$("#changePasswordForm");
 const redirectUrl="https://adrianmarin05.github.io/novashop/restablecer.html";
 let recoveryReady=false;
 function showChangePassword(){
   if(!client)return;
   recoveryReady=true;
   requestForm.hidden=true;changeForm.hidden=false;
   $("#resetTitle").textContent="Crear una contraseña nueva";
   $("#resetIntro").textContent="El enlace de recuperación es válido. Elige una contraseña segura para volver a entrar en NovaShop.";
   $("#resetHint").hidden=true;
   status("Ya puedes establecer tu contraseña nueva.","success");
 }
 function showRequest(){
   requestForm.hidden=false;changeForm.hidden=true;
   $("#resetTitle").textContent="Recuperar contraseña";
   $("#resetIntro").textContent="Introduce el correo de tu cuenta. Te enviaremos un enlace seguro para crear una contraseña nueva en esta página.";
 }
 function hasRecoveryMarker(){
   const hash=new URLSearchParams(location.hash.replace(/^#/,""));
   const query=new URLSearchParams(location.search);
   return hash.get("type")==="recovery"||query.get("type")==="recovery"||query.has("code");
 }
 async function init(){
   if(!db?.isConfigured?.()||!client){status("No se pudo conectar con Supabase. Inténtalo de nuevo más tarde.","error");return;}
   document.querySelectorAll("[data-password-toggle]").forEach(button=>button.addEventListener("click",()=>{
     const input=button.parentElement.querySelector("input");if(!input)return;
     const show=input.type==="password";input.type=show?"text":"password";
     button.textContent=show?"🙈":"👁";button.setAttribute("aria-label",show?"Ocultar contraseña":"Mostrar contraseña");button.setAttribute("aria-pressed",String(show));
   }));
   client.auth.onAuthStateChange((event,session)=>{
     if(event==="PASSWORD_RECOVERY"||(session&&hasRecoveryMarker()))showChangePassword();
   });
   const {data:{session}}=await client.auth.getSession();
   if(session&&hasRecoveryMarker())showChangePassword();
   requestForm.addEventListener("submit",async event=>{
     event.preventDefault();if(!requestForm.reportValidity())return;
     const email=String(requestForm.elements.email.value||"").trim().toLowerCase();
     const button=$("#requestResetButton");button.disabled=true;button.textContent="Enviando enlace…";
     try{
       const {error}=await client.auth.resetPasswordForEmail(email,{redirectTo:redirectUrl});
       if(error)throw error;
       status("Si el correo está registrado, recibirás un enlace de recuperación. Revisa la bandeja de entrada y spam.","success");
     }catch(error){status(error?.message||"No pudimos solicitar el enlace. Inténtalo de nuevo.","error");}
     finally{button.disabled=false;button.textContent="Enviar enlace de recuperación";}
   });
   changeForm.addEventListener("submit",async event=>{
     event.preventDefault();if(!changeForm.reportValidity())return;
     if(!recoveryReady){status("Abre primero el enlace de recuperación enviado por correo.","error");return;}
     const password=changeForm.elements.password.value,confirm=changeForm.elements.confirmPassword.value;
     if(password.length<8){status("La contraseña debe tener al menos 8 caracteres.","error");return;}
     if(password!==confirm){status("Las contraseñas no coinciden.","error");return;}
     const button=$("#changePasswordButton");button.disabled=true;button.textContent="Guardando…";
     try{
       const {error}=await client.auth.updateUser({password});if(error)throw error;
       status("Contraseña actualizada. Ya puedes iniciar sesión con tu nueva contraseña.","success");
       changeForm.hidden=true;$("#resetIntro").textContent="La contraseña se ha cambiado correctamente.";
       $("#resetHint").hidden=true;
       await client.auth.signOut();
     }catch(error){status(error?.message||"No pudimos actualizar la contraseña. Solicita un enlace nuevo e inténtalo otra vez.","error");}
     finally{button.disabled=false;button.textContent="Guardar nueva contraseña";}
   });
   if(!hasRecoveryMarker())showRequest();
 }
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})();
