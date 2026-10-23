/* NovaShop: one-time email verification and resend handling. */
(() => {
 const $=s=>document.querySelector(s),db=window.NovaShopDB,client=db?.client;
 const KEY="novashop-pending-signup",PROD="https://adrianmarin05.github.io/novashop/";
 const status=(text,kind="info")=>{const n=$("#verifyStatus");n.textContent=text;n.className="verify-status "+kind;n.hidden=!text;};
 const e164=value=>{let n=String(value||"").replace(/[^0-9+]/g,"");if(n.startsWith("+"))return n;if(n.startsWith("00"))return "+"+n.slice(2);n=n.replace(/\D/g,"");if(n.startsWith("57")&&n.length>=12)return "+"+n;return "+57"+n;};
 let pending=null,busy=false;
 function sameIdentity(user,p){return !!user&&!!p&&(p.channel==="email"?String(user.email||"").toLowerCase()===String(p.identity||"").toLowerCase():e164(user.phone||"")===e164(p.identity||""));}
 async function saveProfile(user,values,channel){
  const now=new Date().toISOString();
  const profile={id:user.id,full_name:values.fullName||[values.firstName,values.lastName].filter(Boolean).join(" "),phone:e164(values.phone),
   email:String(values.email||"").trim().toLowerCase(),address:values.address,neighborhood:values.neighborhood,city:values.city,department:values.department,
   postal_code:values.postalCode||"",delivery_reference:values.deliveryReference||"",latitude:Number(values.latitude),longitude:Number(values.longitude),
   marketing_opt_in:!!values.marketingOptIn,verified_channel:channel,email_verified_at:channel==="email"?now:null,phone_verified_at:null,updated_at:now};
  const {error}=await client.from("profiles").upsert(profile,{onConflict:"id"});if(error)throw error;
 }
 async function finish(user){
  if(!pending?.values)throw new Error("No se encontraron los datos del registro en este navegador. Vuelve a iniciar el registro.");
  if(!sameIdentity(user,pending))throw new Error("La cuenta verificada no coincide con el correo del registro pendiente.");
  await saveProfile(user,pending.values,pending.channel);
  sessionStorage.removeItem(KEY);$("#verifyCodeForm").hidden=true;$("#resendCode").hidden=true;
  status("¡Cuenta verificada! Abriendo tu perfil…","success");setTimeout(()=>location.replace(PROD+"cuenta.html?registered=1"),500);
 }
 async function init(){
  if(!db?.isConfigured?.()||!client){status("No se pudo conectar con Supabase. Inténtalo de nuevo más tarde.","error");return;}
  try{pending=JSON.parse(sessionStorage.getItem(KEY)||"null");}catch{pending=null;}
  const {data:{session}}=await client.auth.getSession();
  if(pending&&session?.user&&sameIdentity(session.user,pending)){try{await finish(session.user);}catch(e){status(e.message||"No pudimos guardar el perfil.","error");}return;}
  if(!pending?.channel||!pending?.identity||!pending?.values){
   $("#verifyDestination").textContent="No hay un registro pendiente";
   status("Vuelve a Crear cuenta. Si utilizaste un correo ya registrado, no se enviará otro código: inicia sesión o recupera tu contraseña.","error");
   $("#verifyCodeForm").hidden=true;$("#resendCode").hidden=true;return;
  }
  $("#verifyDestination").textContent="📧 Código enviado a: "+pending.identity;
  $("#verifyCodeForm").addEventListener("submit",async event=>{
   event.preventDefault();if(busy)return;const form=event.currentTarget;if(!form.checkValidity()){form.reportValidity();return;}
   const token=form.elements.token.value.trim();if(!/^[0-9]{6,8}$/.test(token)){status("Introduce el código de 6 a 8 dígitos recibido por correo.","error");return;}
   busy=true;const button=$("#verifyButton");button.disabled=true;button.textContent="Verificando…";
   try{
    const {data,error}=await client.auth.verifyOtp({email:pending.identity,token,type:"signup"});
    if(error)throw error;if(!data?.user)throw new Error("Supabase no devolvió una sesión verificada.");
    await finish(data.user);
   }catch(err){status(/expired|invalid|token|otp/i.test(err?.message||"")?"El código no es válido o ha caducado. Revisa el último correo enviado e inténtalo de nuevo.":(err?.message||"No pudimos verificar el código."),"error");}
   finally{busy=false;button.disabled=false;button.textContent="Verificar y crear mi cuenta";}
  });
  $("#resendCode").addEventListener("click",async()=>{
   if(busy)return;busy=true;const b=$("#resendCode");b.disabled=true;b.textContent="Solicitando nuevo código…";
   try{
    const {error}=await client.auth.resend({type:"signup",email:pending.identity,options:{emailRedirectTo:PROD+"verificar.html"}});
    if(error)throw error;status("Si el correo puede registrarse y no está ya confirmado, Supabase enviará un nuevo mensaje. Revisa la bandeja y spam.","success");
   }catch(e){status(/rate limit|too many/i.test(e.message||"")?"Espera un momento antes de pedir otro correo.":e.message||"No pudimos reenviar el código.","error");}
   finally{busy=false;b.disabled=false;b.textContent="Reenviar código al correo";}
  });
 }
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})();
