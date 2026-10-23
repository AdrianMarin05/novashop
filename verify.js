/* NovaShop: one OTP verification screen for account registration. */
(() => {
  const $=s=>document.querySelector(s);
  const db=window.NovaShopDB, client=db?.client;
  const KEY="novashop-pending-signup";
  const status=(text,kind="info")=>{const n=$("#verifyStatus");n.textContent=text;n.className="verify-status "+kind;n.hidden=!text;};
  const normalizePhone=value=>{let n=String(value||"").replace(/[^0-9+]/g,"");if(n.startsWith("+"))return n;if(n.startsWith("00"))return "+"+n.slice(2);n=n.replace(/\D/g,"");if(n.startsWith("57")&&n.length>=12)return "+"+n;return "+57"+n;};
  let pending=null, busy=false;
  async function saveProfile(user,values,channel){
    const profile={
      id:user.id,
      full_name:values.fullName,
      phone:normalizePhone(values.phone),
      email:String(values.email||"").trim().toLowerCase(),
      address:values.address,
      neighborhood:values.neighborhood,
      city:values.city,
      department:values.department,
      postal_code:values.postalCode||"",
      delivery_reference:values.deliveryReference||"",
      latitude:Number(values.latitude),
      longitude:Number(values.longitude),
      marketing_opt_in:!!values.marketingOptIn,
      updated_at:new Date().toISOString()
    };
    const {error}=await client.from("profiles").upsert(profile,{onConflict:"id"});
    if(error)throw error;
  }
  async function finishWithSession(user,channel){
    await saveProfile(user,pending.values,channel);
    sessionStorage.removeItem(KEY);
    status("¡Cuenta verificada! Te llevaremos a tu perfil…","success");
    $("#verifyCodeForm").hidden=true;
    setTimeout(()=>location.replace("cuenta.html?registered=1"),500);
  }
  async function init(){
    if(!db?.isConfigured?.()||!client){status("No logramos conectarnos a Supabase. Recarga la página o vuelve al registro.","error");return;}
    try{pending=JSON.parse(sessionStorage.getItem(KEY)||"null");}catch{pending=null;}
    if(!pending?.channel||!pending?.identity||!pending?.values){
      $("#verifyDestination").textContent="No hay un registro pendiente";
      status("Vuelve a crear tu cuenta. El proceso de verificación debe comenzar desde el formulario de registro.","error");
      $("#verifyCodeForm").hidden=true;
      return;
    }
    $("#verifyDestination").textContent=(pending.channel==="email"?"📧 Código enviado a: ":"📱 Código enviado al teléfono: ")+pending.identity;
    // If Supabase is configured for confirmation links instead of numeric OTPs, handle the returned session too.
    const {data:{session}}=await client.auth.getSession();
    if(session?.user){
      $("#verifyDestination").textContent="Contacto confirmado";
      try{await finishWithSession(session.user,pending.channel);}catch(e){status("La cuenta se verificó, pero no pudimos guardar los datos del perfil. "+(e.message||""),"error");}
    }
    $("#verifyCodeForm").addEventListener("submit",async e=>{
      e.preventDefault();if(busy)return;const form=e.currentTarget;if(!form.checkValidity()){form.reportValidity();return;}
      const token=form.elements.token.value.trim();if(!/^[0-9]{6}$/.test(token)){status("Escribe los seis dígitos del código.","error");return;}
      busy=true;const button=$("#verifyButton");button.disabled=true;button.textContent="Verificando…";
      try{
        const args=pending.channel==="email"
          ? {email:pending.identity,token,type:"signup"}
          : {phone:pending.identity,token,type:"sms"};
        const {data,error}=await client.auth.verifyOtp(args);if(error)throw error;
        if(!data?.user)throw new Error("El código no pudo crear una sesión. Comprueba que sea el más reciente.");
        await finishWithSession(data.user,pending.channel);
      }catch(err){status(/expired|invalid|token/i.test(err?.message||"")?"El código no es válido o ha caducado. Comprueba los seis dígitos y vuelve a intentarlo.":(err?.message||"No pudimos verificar el código."),"error");}
      finally{busy=false;button.disabled=false;button.textContent="Verificar y crear mi cuenta";}
    });
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})();
