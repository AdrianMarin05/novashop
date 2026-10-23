/* NovaShop: password reset through an email OTP. Password form stays locked until Auth verifies the recovery code. */
(() => {
 const $=selector=>document.querySelector(selector);
 const db=window.NovaShopDB,client=db?.client;
 const requestForm=$("#requestResetForm"),codeForm=$("#verifyCodeForm"),changeForm=$("#changePasswordForm");
 const status=(message,kind="info")=>{
  const node=$("#resetMessage");
  node.textContent=message;
  node.className="reset-message "+kind;
  node.hidden=!message;
 };
 let pendingEmail="";
 let recoveryVerified=false;
 let sending=false;

 function setStage(stage){
  document.querySelectorAll("[data-step]").forEach(node=>{
   const step=Number(node.dataset.step);
   node.classList.toggle("active",step===stage);
   node.classList.toggle("completed",step<stage);
   const number=node.querySelector(".reset-step-number");
   if(number)number.textContent=step<stage?"✓":String(step);
  });
 }
 function showRequest(){
  requestForm.hidden=false;codeForm.hidden=true;changeForm.hidden=true;
  $("#resetTitle").textContent="Recuperar contraseña";
  $("#resetIntro").textContent="Escribe el correo con el que te registraste. Te enviaremos un código de seis dígitos para verificar que la cuenta sea tuya.";
  $("#resetEmail").value=pendingEmail;
  setStage(1);
 }
 function showCode(){
  requestForm.hidden=true;codeForm.hidden=false;changeForm.hidden=true;
  $("#resetTitle").textContent="Revisa tu correo";
  $("#resetIntro").textContent="Introduce el código de seis dígitos para comprobar que tienes acceso al correo de tu cuenta.";
  $("#codeEmailDisplay").textContent=pendingEmail;
  $("#resetToken").value="";
  setStage(2);
 }
 function showNewPassword(){
  recoveryVerified=true;
  requestForm.hidden=true;codeForm.hidden=true;changeForm.hidden=false;
  $("#resetTitle").textContent="Crea una contraseña nueva";
  $("#resetIntro").textContent="Código verificado. Elige tu nueva contraseña para volver a entrar en NovaShop.";
  $("#resetHint")?.remove();
  setStage(3);
  status("Correo verificado. Ya puedes guardar tu nueva contraseña.","success");
 }
 async function sendRecoveryCode(email,button){
  if(sending)return;
  if(!client)throw new Error("No se pudo conectar con el servicio de cuentas. Inténtalo de nuevo más tarde.");
  sending=true;
  if(button){button.disabled=true;button.textContent="Enviando código…";}
  try{
   const {error}=await client.auth.resetPasswordForEmail(email);
   if(error)throw error;
   pendingEmail=email.toLowerCase();
   showCode();
   status("Si ese correo está registrado en NovaShop, recibirás un código de recuperación. Revisa la bandeja de entrada y el correo no deseado.","success");
  }finally{
   sending=false;
   if(button){button.disabled=false;button.textContent="Enviar código de verificación";}
  }
 }
 async function init(){
  if(!db?.isConfigured?.()||!client){
   status("No se pudo conectar con el servicio de cuentas. Inténtalo de nuevo más tarde.","error");
   return;
  }
  document.querySelectorAll("[data-password-toggle]").forEach(button=>button.addEventListener("click",()=>{
   const input=button.parentElement.querySelector("input");
   if(!input)return;
   const reveal=input.type==="password";
   input.type=reveal?"text":"password";
   button.setAttribute("aria-label",reveal?"Ocultar contraseña":"Mostrar contraseña");
   button.setAttribute("aria-pressed",String(reveal));
   button.innerHTML=reveal
    ?'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3l18 18"/><path d="M10.6 10.6a2 2 0 0 0 2.8 2.8"/><path d="M9.9 5.3A10.8 10.8 0 0 1 12 5c6.5 0 10 7 10 7a18 18 0 0 1-3.1 3.9"/><path d="M6.2 6.2C3.5 8 2 12 2 12s3.5 7 10 7a10.7 10.7 0 0 0 4-.8"/></svg>'
    :'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z"/><circle cx="12" cy="12" r="2.5"/></svg>';
  }));

  requestForm.addEventListener("submit",async event=>{
   event.preventDefault();
   const input=requestForm.elements.email;
   const email=String(input.value||"").trim().toLowerCase();
   if(!input.reportValidity())return;
   if(!email){status("Escribe el correo con el que te registraste.","error");return;}
   status("");
   const button=$("#requestResetButton");
   try{
    await sendRecoveryCode(email,button);
   }catch(error){
    status(error?.message||"No pudimos enviar el código. Inténtalo otra vez en un momento.","error");
   }
  });

  codeForm.addEventListener("submit",async event=>{
   event.preventDefault();
   const input=codeForm.elements.token;
   const token=String(input.value||"").replace(/\s/g,"");
   if(!/^\d{6}$/.test(token)){status("Escribe el código completo de seis dígitos.","error");input.focus();return;}
   if(!pendingEmail){status("Vuelve a introducir el correo de tu cuenta para solicitar un código nuevo.","error");showRequest();return;}
   const button=$("#verifyCodeButton");button.disabled=true;button.textContent="Verificando…";status("");
   try{
    const {data,error}=await client.auth.verifyOtp({email:pendingEmail,token,type:"recovery"});
    if(error)throw error;
    const verifiedEmail=String(data?.user?.email||data?.session?.user?.email||"").toLowerCase();
    if(!data?.session||!verifiedEmail||verifiedEmail!==pendingEmail.toLowerCase()){
     await client.auth.signOut().catch(()=>{});
     throw new Error("No se pudo confirmar ese código para esta cuenta. Solicita uno nuevo e inténtalo otra vez.");
    }
    showNewPassword();
   }catch(error){
    status(error?.message||"El código no es válido o ha caducado. Revisa los seis dígitos o solicita uno nuevo.","error");
   }finally{
    button.disabled=false;button.textContent="Verificar código";
   }
  });

  $("#changeEmailButton").addEventListener("click",()=>{
   status("");recoveryVerified=false;showRequest();
  });
  $("#resendCodeButton").addEventListener("click",async()=>{
   if(!pendingEmail)return;
   const button=$("#resendCodeButton");
   button.disabled=true;button.textContent="Solicitando…";status("");
   try{
    const {error}=await client.auth.resetPasswordForEmail(pendingEmail);
    if(error)throw error;
    $("#resetToken").value="";
    status("Si el correo está registrado, enviamos otro código. Revisa tu bandeja de entrada y correo no deseado.","success");
   }catch(error){
    status(error?.message||"No pudimos reenviar el código. Espera un momento e inténtalo de nuevo.","error");
   }finally{
    button.disabled=false;button.textContent="Reenviar código";
   }
  });

  changeForm.addEventListener("submit",async event=>{
   event.preventDefault();
   if(!recoveryVerified){status("Primero debes verificar el código que llegó a tu correo.","error");showRequest();return;}
   if(!changeForm.reportValidity())return;
   const password=String(changeForm.elements.password.value||"");
   const confirm=String(changeForm.elements.confirmPassword.value||"");
   if(password.length<8){status("La contraseña debe tener al menos 8 caracteres.","error");return;}
   if(password!==confirm){status("Las contraseñas no coinciden. Revísalas e inténtalo de nuevo.","error");return;}
   const button=$("#changePasswordButton");button.disabled=true;button.textContent="Guardando…";status("");
   try{
    const {error}=await client.auth.updateUser({password});
    if(error)throw error;
    recoveryVerified=false;
    changeForm.hidden=true;
    $("#resetTitle").textContent="Contraseña actualizada";
    $("#resetIntro").textContent="Tu contraseña se cambió correctamente. Ya puedes iniciar sesión con ella.";
    document.querySelector(".reset-steps").hidden=true;
    status("La contraseña se guardó correctamente. Por seguridad, hemos cerrado tu sesión.","success");
    changeForm.reset();
    await client.auth.signOut().catch(()=>{});
   }catch(error){
    status(error?.message||"No pudimos actualizar la contraseña. Verifica los datos e inténtalo otra vez.","error");
   }finally{
    button.disabled=false;button.textContent="Guardar nueva contraseña";
   }
  });
  showRequest();
 }
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);
 else init();
})();