/* NovaShop account page: Supabase Auth, profile and personal order history. */
(() => {
  const $ = (s) => document.querySelector(s);
  const db = window.NovaShopDB;
  const client = db?.client;
  const money = (v) => new Intl.NumberFormat("es-CO",{style:"currency",currency:"COP",maximumFractionDigits:0}).format(Number(v)||0);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const message = (txt,kind="info") => {const el=$("#message");if(el){el.textContent=txt;el.className="account-message "+kind;el.hidden=!txt;}};
  let session=null;
  function tab(name){document.querySelectorAll("[data-tab]").forEach(b=>b.classList.toggle("active",b.dataset.tab===name));$("#registerForm").hidden=name!=="register";$("#loginForm").hidden=name!=="login";$("#resetForm").hidden=true;}
  function renderOrders(orders){
    const box=$("#ordersList");if(!box)return;
    if(!orders?.length){box.innerHTML='<div class="account-order"><strong>Aún no tienes pedidos vinculados</strong><p class="account-help">Cuando compres con tu sesión iniciada, verás el historial aquí. Las compras de invitado siguen estando disponibles.</p><a href="index.html#productos">Explorar productos →</a></div>';return;}
    const labels={pending_payment:["Pendiente de pago"],paid:["Pagado"],preparing:["En preparación"],shipped:["Enviado"],delivered:["Entregado"],cancelled:["Cancelado"],payment_failed:["Pago rechazado"],refunded:["Reembolsado"]};
    box.innerHTML=orders.map(o=>{
      const label=labels[o.status]?.[0]||"En revisión";
      const lines=(o.order_items||[]).map(i=>'<li>'+esc(i.product_name)+' ×'+Number(i.quantity)+' — '+money(i.line_total_cop??i.unit_price_cop*i.quantity)+'</li>').join("");
      return '<article class="account-order"><div class="account-order-head"><div><h3>'+esc(o.order_number)+'</h3><small>'+esc(new Date(o.created_at).toLocaleString("es-CO"))+'</small></div><span class="account-status">'+label+'</span></div><ul>'+lines+'</ul><div class="account-order-total"><span>Total de productos</span><strong>'+money(o.subtotal_cop)+'</strong></div></article>';
    }).join("");
  }
  async function loadOrders(){if(!client||!session?.user)return;$("#ordersList").innerHTML='<p class="account-help">Cargando pedidos…</p>';
    const {data,error}=await client.from("orders").select("id,order_number,status,payment_status,subtotal_cop,created_at,order_items(product_name,quantity,unit_price_cop,line_total_cop)").order("created_at",{ascending:false}).limit(50);
    if(error){$("#ordersList").innerHTML='<p class="account-help">No pudimos cargar el historial. Comprueba las políticas de seguridad RLS.</p>';return;}renderOrders(data);}
  function setSignedIn(user){
    session=user?{user}:null;$("#authPanel").hidden=!!user;$("#dashboard").hidden=!user;
    if(user){$("#welcome").textContent="Hola, "+(user.user_metadata?.full_name||user.email?.split("@")[0]||"cliente");$("#userEmail").textContent=user.email||"";const form=$("#profileForm");form.elements.fullName.value=user.user_metadata?.full_name||"";client.from("profiles").select("full_name,phone").eq("id",user.id).maybeSingle().then(({data})=>{if(data){form.elements.fullName.value=data.full_name||form.elements.fullName.value;form.elements.phone.value=data.phone||"";}});loadOrders();}
  }
  if(!db?.isConfigured?.()||!client){message("Supabase no se ha podido inicializar. Revisa la configuración pública y la conexión de red.","error");document.querySelectorAll("#registerForm input,#registerForm button,#loginForm input,#loginForm button").forEach(e=>e.disabled=true);return;}
  document.querySelectorAll("[data-tab]").forEach(b=>b.addEventListener("click",()=>{tab(b.dataset.tab);message("");}));
  $("#registerForm").addEventListener("submit",async e=>{e.preventDefault();const f=e.currentTarget;if(!f.reportValidity())return;const btn=f.querySelector('[type="submit"]');btn.disabled=true;btn.textContent="Creando cuenta…";const fullName=f.elements.fullName.value.trim(),email=f.elements.email.value.trim().toLowerCase(),password=f.elements.password.value;const {data,error}=await client.auth.signUp({email,password,options:{data:{full_name:fullName},emailRedirectTo:location.origin+location.pathname}});btn.disabled=false;btn.textContent="Crear mi cuenta gratis";if(error){message(/already registered/i.test(error.message)?"Ese correo ya tiene cuenta. Prueba iniciar sesión.":error.message,"error");return;}f.reset();if(data.session){setSignedIn(data.user);message("¡Cuenta creada! Ya puedes consultar tus pedidos.","success");}else{tab("login");message("Revisa tu correo y confirma la cuenta antes de iniciar sesión.","success");}});
  $("#loginForm").addEventListener("submit",async e=>{e.preventDefault();const f=e.currentTarget;if(!f.reportValidity())return;const {data,error}=await client.auth.signInWithPassword({email:f.elements.email.value.trim().toLowerCase(),password:f.elements.password.value});if(error){message(/invalid login credentials/i.test(error.message)?"Correo o contraseña incorrectos.":error.message,"error");return;}f.reset();setSignedIn(data.user);message("Sesión iniciada correctamente.","success");});
  $("#forgotPassword").addEventListener("click",async()=>{const email=$("#loginForm").elements.email.value.trim().toLowerCase();if(!email){message("Escribe primero tu correo y vuelve a pulsar el enlace.","error");return;}const {error}=await client.auth.resetPasswordForEmail(email,{redirectTo:location.origin+location.pathname});message(error?error.message:"Si el correo está registrado, recibirás instrucciones para recuperar el acceso.",error?"error":"success");});
  $("#resetForm").addEventListener("submit",async e=>{e.preventDefault();const f=e.currentTarget;if(f.elements.password.value!==f.elements.confirm.value){message("Las contraseñas no coinciden.","error");return;}const {error}=await client.auth.updateUser({password:f.elements.password.value});if(error){message(error.message,"error");return;}f.reset();tab("login");message("Contraseña actualizada. Inicia sesión.","success");});
  $("#profileForm").addEventListener("submit",async e=>{e.preventDefault();if(!session?.user)return;const f=e.currentTarget;const {error}=await client.from("profiles").update({full_name:f.elements.fullName.value.trim(),phone:f.elements.phone.value.trim(),updated_at:new Date().toISOString()}).eq("id",session.user.id);if(error){message("No pudimos guardar tu perfil. Inténtalo de nuevo.","error");return;}message("Datos actualizados correctamente.","success");});
  $("#refreshOrders").addEventListener("click",loadOrders);
  $("#signOut").addEventListener("click",async()=>{await client.auth.signOut();session=null;$("#dashboard").hidden=true;$("#authPanel").hidden=false;tab("login");message("Has cerrado sesión.","success");});
  client.auth.onAuthStateChange((event,s)=>{session=s;if(event==="PASSWORD_RECOVERY"){tab("login");$("#resetForm").hidden=false;$("#loginForm").hidden=true;$("#registerForm").hidden=true;message("Define una contraseña nueva.","success");return;}setSignedIn(s?.user||null);});
  client.auth.getSession().then(({data})=>setSignedIn(data.session?.user||null));
})();
