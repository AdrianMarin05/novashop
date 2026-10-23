/* NovaShop: single-OTP signup verification. */
(() => {
 const $=s=>document.querySelector(s), db=window.NovaShopDB, client=db?.client;
 const KEY="novashop-pending-signup";
 const status=(text,kind="info")=>{const el=$("#verifyStatus");el.textContent=text;el.className="verify-status "+kind;el.hidden=!text;};
 const e164=value=>{let n=String(value||"").replace(/[^0-9+]/g,"");if(n.startsWith("+"))return n;if(n.startsWith("00"))return "+"+n.slice(2);n=n.replace(/\D/g,"");if(n.startsWith("57")&&n.length>=12)return "+"+n;return "+57"+n;};
 let pending=null,busy=false;
 function sameIdentity(user,p){
  if(!user||!p)return false;
  return p.channel==="email"
   ? String(user.email||"").toLowerCase()===String(p.identity||"").toLowerCase()
   : e164(user.phone||"")===e164(p.identity||"");
 }
 async function saveProfile(user,values,channel){
  const now=new Date().toISOString();
  const profile={
   id:user.id,full_name:values.fullName||[values.firstName,values.lastName].filter(Boolean).join(" "),
   phone:e164(values.phone),email:String(values.email||"").trim().toLowerCase(),
   address:values.address,neighborhood:values.neighborhood,city:values.city,department:values.department,
   postal_code:values.postalCode||"",delivery_reference:values.deliveryReference||"",
   latitude:Number(values.latitude),longitude:Number(values.longitude),
   marketing_opt_in:!!values.marketingOptIn,verified_channel:channel,
   email_verified_at:channel==="email"?now:null,phone_verified_at:channel==="sms"?now:null,updated_at:now
  };
  const {error}=await client.from("profiles").upsert(profile,{onConflict:"id"});if(error)throw error;
 }
 async function finish(user){
  if(!pending?.values)throw new Error("Los datos del registro no están disponibles; vuelve a registrarte.");
  if(!sameIdentity(user,pending))throw new Error("La cuenta activa no coincide con el correo o teléfono que se está verificando.");
  await saveProfile(user,pending.values,pending.channel);
  sessionStorage.removeItem(KEY);$("#verifyCodeForm").hidden=true;
  status("¡Cuenta verificada! Abriendo tu perfil…","success");
  setTimeout(()=>location.replace("cuenta.html?registered=1"),450);
 }
 async function init(){
  if(!db?.isConfigured?.()||!client){status("No logramos conectar con Supabase. Recarga la página o vuelve al registro.","error");return;}
  try{pending=JSON.parse(sessionStorage.getItem(KEY)||"null");}catch{pending=null;}
  // A session from a different account must never be attached to this pending registration.
  const {data:{session}}=await client.auth.getSession();
  if(pending&&session?.user&&sameIdentity(session.user,pending)){
   $("#verifyDestination").textContent="Contacto confirmado: "+pending.identity;
   try{await finish(session.user);}catch(e){status(e.message||"No pudimos guardar los datos del perfil.","error");}
   return;
  }
  if(!pending?.channel||!pending?.identity||!pending?.values){
   $("#verifyDestination").textContent="No hay un registro pendiente";
   status("Vuelve al registro y solicita un código. Para evitar el error localhost, la URL de Supabase debe apuntar a GitHub Pages.","error");
   $("#verifyCodeForm").hidden=true;return;
  }
  $("#verifyDestination").textContent=(pending.channel==="email"?"📧 Código enviado a: ":"📱 Código enviado al teléfono: ")+pending.identity;
  $("#verifyCodeForm").addEventListener("submit",async event=>{
   event.preventDefault();if(busy)return;const form=event.currentTarget;
   if(!form.checkValidity()){form.reportValidity();return;}
   const token=form.elements.token.value.trim();if(!/^[0-9]{6,8}$/.test(token)){status("Introduce todos los dígitos del código recibido.","error");return;}
   busy=true;const button=$("#verifyButton");button.disabled=true;button.textContent="Verificando…";
   try{
    const args=pending.channel==="email"
      ? {email:pending.identity,token,type:"signup"}
      : {phone:e164(pending.identity),token,type:"sms"};
    const {data,error}=await client.auth.verifyOtp(args);if(error)throw error;
    if(!data?.user)throw new Error("Supabase no devolvió una sesión verificada.");
    await finish(data.user);
   }catch(err){
    status(/expired|invalid|token|otp/i.test(err?.message||"")?"El código es incorrecto o ha caducado. Revisa el último correo recibido e inténtalo de nuevo.":(err?.message||"No pudimos verificar el código."),"error");
   }finally{busy=false;button.disabled=false;button.textContent="Verificar y crear mi cuenta";}
  });
 }
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})();
