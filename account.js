/* NovaShop account flow:
   - registration step 1: contact and password
   - registration step 2: delivery address and exact map pin
   - one OTP in verificar.html
   - email or phone + password login
*/
(() => {
const $=s=>document.querySelector(s), db=window.NovaShopDB, client=db?.client;
const money=v=>new Intl.NumberFormat("es-CO",{style:"currency",currency:"COP",maximumFractionDigits:0}).format(Number(v)||0);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const msg=(txt,kind="info")=>{const n=$("#message");if(!n)return;n.textContent=txt;n.className="account-message "+kind;n.hidden=!txt;};
let mapState={},session=null;
const signupKey="novashop-pending-signup";
function e164(value){let n=String(value||"").replace(/[^0-9+]/g,"");if(n.startsWith("+"))return n;if(n.startsWith("00"))return "+"+n.slice(2);n=n.replace(/\D/g,"");if(n.startsWith("57")&&n.length>=12)return "+"+n;return "+57"+n;}
function setVisible(which){
 const register=["register","registerAddress"].includes(which);
 $("#authPanel").hidden=which==="dashboard";
 $("#registerForm").hidden=!register;
 $("#loginForm").hidden=which!=="login";
 $("#dashboard").hidden=which!=="dashboard";
 $("#registerContactStep").hidden=which!=="register";
 $("#registerAddressStep").hidden=which!=="registerAddress";
 $("#registerProgress1").classList.toggle("active",which==="register");
 $("#registerProgress1").classList.toggle("done",which==="registerAddress");
 $("#registerProgress2").classList.toggle("active",which==="registerAddress");
 $("#guestHint").hidden=which==="dashboard";
 document.querySelectorAll("[data-tab]").forEach(b=>b.classList.toggle("active",b.dataset.tab===(which==="login"?"login":"register")));
 if(which==="registerAddress")setTimeout(()=>mapState.registerMap?.map.invalidateSize(),140);
 if(which==="dashboard")setTimeout(()=>mapState.profileMap?.map.invalidateSize(),140);
}
function validateStep(root){
 const controls=[...root.querySelectorAll("input,select,textarea")].filter(el=>!el.disabled&&el.type!=="hidden");
 for(const el of controls){if(!el.checkValidity()){el.reportValidity();return false;}}
 return true;
}
function createMap(id,latName,lngName,statusId,coordsId,useButtonId){
 if(!window.L||!$("#"+id))return;
 const map=L.map(id,{scrollWheelZoom:false}).setView([4.5709,-74.2973],5);
 L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>'}).addTo(map);
 let marker=null;
 function put(lat,lng,zoom=16){
  lat=Number(lat);lng=Number(lng);if(!Number.isFinite(lat)||!Number.isFinite(lng)||Math.abs(lat)>90||Math.abs(lng)>180)return;
  $("#"+latName).value=lat.toFixed(7);$("#"+lngName).value=lng.toFixed(7);
  if(!marker)marker=L.marker([lat,lng],{draggable:true}).addTo(map);else marker.setLatLng([lat,lng]);
  marker.off("dragend").on("dragend",()=>{const p=marker.getLatLng();put(p.lat,p.lng,16);});
  map.setView([lat,lng],zoom);
  $("#"+statusId).textContent="Pin seleccionado. Arrástralo hasta la entrada correcta.";
  $("#"+coordsId).textContent=lat.toFixed(6)+", "+lng.toFixed(6);
  mapState[id]={map,put,marker:()=>marker};
 }
 map.on("click",e=>put(e.latlng.lat,e.latlng.lng));
 $("#"+useButtonId)?.addEventListener("click",()=>{
  if(!navigator.geolocation){msg("Tu navegador no permite obtener la ubicación. Puedes marcar el mapa manualmente.","error");return;}
  $("#"+statusId).textContent="Solicitando permiso de ubicación…";
  navigator.geolocation.getCurrentPosition(pos=>put(pos.coords.latitude,pos.coords.longitude,17),()=>{
   $("#"+statusId).textContent="No se obtuvo la ubicación; toca el mapa para colocar el pin.";
   msg("No pudimos obtener tu ubicación. Revisa los permisos o marca el mapa manualmente.","error");
  },{enableHighAccuracy:true,timeout:12000,maximumAge:0});
 });
 mapState[id]={map,put,marker:()=>marker};
 return mapState[id];
}
function formObj(form){
 const f=new FormData(form);
 return {
  firstName:String(f.get("firstName")||"").trim(),
  lastName:String(f.get("lastName")||"").trim(),
  phone:e164(f.get("phone")),
  email:String(f.get("email")||"").trim().toLowerCase(),
  address:String(f.get("address")||"").trim(),
  neighborhood:String(f.get("neighborhood")||"").trim(),
  city:String(f.get("city")||"").trim(),
  department:String(f.get("department")||"").trim(),
  postalCode:String(f.get("postalCode")||"").trim(),
  deliveryReference:String(f.get("deliveryReference")||"").trim(),
  latitude:String(f.get("latitude")||"").trim(),
  longitude:String(f.get("longitude")||"").trim(),
  marketingOptIn:f.get("marketingOptIn")==="on"
 };
}
function profilePayload(user,values){
 const data={id:user.id,full_name:values.fullName||[values.firstName,values.lastName].filter(Boolean).join(" "),
  phone:values.phone||"",email:String(values.email||user.email||"").trim().toLowerCase(),
  address:values.address||"",neighborhood:values.neighborhood||"",city:values.city||"",
  department:values.department||"",postal_code:values.postalCode||"",delivery_reference:values.deliveryReference||"",
  latitude:values.latitude?Number(values.latitude):null,longitude:values.longitude?Number(values.longitude):null,updated_at:new Date().toISOString()};
 if(Object.prototype.hasOwnProperty.call(values,"marketingOptIn"))data.marketing_opt_in=!!values.marketingOptIn;
 return data;
}
async function saveProfile(user,values){
 const {error}=await client.from("profiles").upsert(profilePayload(user,values),{onConflict:"id"});
 if(error)throw error;
}
async function continueToAddress(){
 const step=$("#registerContactStep");
 if(!validateStep(step))return;
 const form=$("#registerForm"),pass=form.elements.password.value,confirm=form.elements.confirmPassword.value;
 if(pass.length<8){msg("La contraseña debe tener al menos 8 caracteres.","error");return;}
 if(pass!==confirm){msg("Las contraseñas no coinciden. Revísalas antes de continuar.","error");form.elements.confirmPassword.focus();return;}
 const phone=e164(form.elements.phone.value);
 if(!/^\+[1-9]\d{7,14}$/.test(phone)){msg("Escribe un teléfono válido con prefijo de país, por ejemplo +57 300 123 4567.","error");return;}
 if(!client||!db?.isConfigured?.()){msg("Supabase no está conectado. Inténtalo más tarde.","error");return;}
 $("#registerForm").dataset.passwordReady="true";
 msg("");
 setVisible("registerAddress");
}
async function submitSignup(event){
 event.preventDefault();
 if(!validateStep($("#registerAddressStep")))return;
 const form=$("#registerForm");
 const values=formObj(form);
 values.fullName=[values.firstName,values.lastName].filter(Boolean).join(" ");
 const lat=Number(values.latitude),lng=Number(values.longitude);
 if(!values.latitude||!values.longitude||!Number.isFinite(lat)||!Number.isFinite(lng)||Math.abs(lat)>90||Math.abs(lng)>180){
  msg("Marca el punto exacto de entrega en el mapa antes de continuar.","error");return;
 }
 values.latitude=String(lat);values.longitude=String(lng);
 const channel=new FormData(form).get("verifyVia")||"email";
 const password=form.elements.password.value;
 const button=$("#registerSubmit");button.disabled=true;button.textContent="Enviando código…";
 try{
  const metadata={full_name:values.fullName,phone:values.phone,email:values.email,marketing_opt_in:values.marketingOptIn};
  const redirectTo=new URL("verificar.html",location.href).href;
  const result=channel==="email"
   ? await client.auth.signUp({email:values.email,password,options:{data:metadata,emailRedirectTo:redirectTo}})
   : await client.auth.signUp({phone:values.phone,password,options:{data:metadata}});
  if(result.error)throw result.error;
  if(!result.data?.user)throw new Error("Supabase no devolvió una cuenta. Verifica la configuración de Auth.");
  // Never keep the password in browser storage. The Auth server already holds the hashed credential.
  const pendingValues={...values};
  pendingSignupStorage({channel,identity:channel==="email"?values.email:values.phone,values:pendingValues});
  if(result.data.session){
    await saveProfile(result.data.user,values);
    sessionStorage.removeItem(signupKey);
    form.reset();
    setVisible("dashboard");
    await showDashboard(result.data.user);
    msg("Cuenta creada. El proyecto no solicitó otro código porque su configuración permitió el acceso inmediato.","success");
  }else{
    location.href="verificar.html";
  }
 }catch(e){
  const text=String(e?.message||"");
  msg(/already registered|already been registered|user already/i.test(text)?"Ese correo o teléfono ya tiene una cuenta. Inicia sesión o revisa que no haya un registro pendiente.":text||"No pudimos iniciar el registro. Inténtalo de nuevo.","error");
 }finally{button.disabled=false;button.textContent="Enviar código y continuar";}
}
function pendingSignupStorage(value){sessionStorage.setItem(signupKey,JSON.stringify(value));}
async function showDashboard(user){
 session={user};setVisible("dashboard");
 $("#welcome").textContent="Hola, "+(user.user_metadata?.full_name||user.email?.split("@")[0]||user.phone||"cliente");
 $("#userEmail").textContent=user.email||user.phone||"Cuenta verificada";
 const {data:profile,error}=await client.from("profiles").select("*").eq("id",user.id).maybeSingle();
 if(!error&&profile){
  const form=$("#profileForm");
  for(const [key,name] of [["full_name","fullName"],["phone","phone"],["email","email"],["address","address"],["neighborhood","neighborhood"],["city","city"],["department","department"],["postal_code","postalCode"],["delivery_reference","deliveryReference"],["latitude","latitude"],["longitude","longitude"]])if(form.elements[name])form.elements[name].value=profile[key]??"";
  if(profile.latitude!=null&&profile.longitude!=null)mapState.profileMap?.put(profile.latitude,profile.longitude,16);
  $("#userEmail").textContent=profile.email||user.email||user.phone||"Cuenta verificada";
 }
 await loadOrders();
 const adminLink=$("#adminAccessLink");
 if(adminLink){adminLink.hidden=true;try{await db.adminCall({action:"whoami"});adminLink.hidden=false;}catch(_){adminLink.hidden=true;}}
 if(new URLSearchParams(location.search).get("registered")==="1")msg("¡Tu cuenta ya está verificada! Guarda tus datos y consulta aquí tus pedidos.","success");
}
async function loadOrders(){
 if(!client||!session?.user)return;
 $("#ordersList").innerHTML='<p class="account-help">Cargando pedidos…</p>';
 const {data,error}=await client.from("orders").select("id,order_number,status,subtotal_cop,created_at,order_items(product_name,quantity,unit_price_cop,line_total_cop)").order("created_at",{ascending:false}).limit(50);
 if(error){$("#ordersList").innerHTML='<p class="account-help">No pudimos cargar el historial. Comprueba la conexión y las políticas RLS.</p>';return;}
 if(!data?.length){$("#ordersList").innerHTML='<div class="account-order"><strong>Aún no tienes pedidos vinculados</strong><p class="account-help">Cuando compres con tu sesión iniciada, el historial aparecerá aquí.</p><a href="index.html#productos">Explorar productos →</a></div>';return;}
 const labels={pending_payment:"Pendiente de pago",paid:"Pagado",preparing:"En preparación",shipped:"Enviado",delivered:"Entregado",cancelled:"Cancelado",payment_failed:"Pago rechazado",refunded:"Reembolsado"};
 $("#ordersList").innerHTML=data.map(o=>'<article class="account-order"><div class="account-order-head"><div><h3>'+esc(o.order_number)+'</h3><small>'+esc(new Date(o.created_at).toLocaleString("es-CO"))+'</small></div><span class="account-status">'+(labels[o.status]||"En revisión")+'</span></div><ul>'+(o.order_items||[]).map(i=>'<li>'+esc(i.product_name)+' ×'+Number(i.quantity)+' — '+money(i.line_total_cop??i.unit_price_cop*i.quantity)+'</li>').join("")+'</ul><div class="account-order-total"><span>Subtotal</span><strong>'+money(o.subtotal_cop)+'</strong></div></article>').join("");
}
async function saveProfileHandler(event){
 event.preventDefault();if(!session?.user)return;const f=event.currentTarget;if(!f.reportValidity())return;
 if(!f.elements.latitude.value||!f.elements.longitude.value){msg("Marca la ubicación en el mapa para tener coordenadas precisas.","error");return;}
 const values={fullName:f.elements.fullName.value.trim(),phone:e164(f.elements.phone.value),email:f.elements.email.value.trim().toLowerCase(),address:f.elements.address.value.trim(),neighborhood:f.elements.neighborhood.value.trim(),city:f.elements.city.value.trim(),department:f.elements.department.value.trim(),postalCode:f.elements.postalCode.value.trim(),deliveryReference:f.elements.deliveryReference.value.trim(),latitude:f.elements.latitude.value,longitude:f.elements.longitude.value};
 try{await saveProfile(session.user,values);msg("Tus datos de entrega se guardaron correctamente.","success");}catch(e){msg("No pudimos guardar el perfil: "+e.message,"error");}
}
function init(){
 createMap("registerMap","registerLat","registerLng","registerMapStatus","registerCoords","useLocationRegister");
 createMap("profileMap","profileLat","profileLng","profileMapStatus","profileCoords","useLocationProfile");
 const params=new URLSearchParams(location.search);
 setVisible(params.get("tab")==="login"?"login":"register");
 if(params.get("registered")==="1")msg("Tu cuenta se creó correctamente.","success");
 document.querySelectorAll("[data-tab]").forEach(b=>b.addEventListener("click",()=>{setVisible(b.dataset.tab);msg("");}));
 $("#registerNext").addEventListener("click",continueToAddress);
 $("#registerBack").addEventListener("click",()=>{setVisible("register");msg("");});
 $("#registerForm").addEventListener("submit",submitSignup);
 $("#loginForm").addEventListener("submit",async e=>{
  e.preventDefault();const f=e.currentTarget;if(!f.reportValidity())return;
  if(!db?.isConfigured?.()){msg("Supabase no está conectado.","error");return;}
  const btn=f.querySelector('[type="submit"]');btn.disabled=true;btn.textContent="Iniciando sesión…";
  try{
   await db.loginWithIdentifier(f.elements.identity.value.trim(),f.elements.password.value);
   f.reset();const {data}=await client.auth.getSession();
   if(data.session?.user)await showDashboard(data.session.user);
   msg("Sesión iniciada correctamente.","success");
  }catch(err){msg(/invalid|incorrect|credentials|not found|contraseña/i.test(err?.message||"")?"Correo/teléfono o contraseña incorrectos.":err?.message||"No pudimos iniciar sesión.","error");}
  finally{btn.disabled=false;btn.textContent="Iniciar sesión";}
 });
 $("#profileForm").addEventListener("submit",saveProfileHandler);
 $("#refreshOrders").addEventListener("click",loadOrders);
 $("#signOut").addEventListener("click",async()=>{await client.auth.signOut();session=null;setVisible("login");msg("Has cerrado sesión.","success");});
 if(!client||!db?.isConfigured?.()){msg("Supabase no está conectado. Revisa la URL y la clave publicable.","error");return;}
 client.auth.onAuthStateChange((_event,s)=>{if(s?.user){session={user:s.user};showDashboard(s.user);}else{session=null;}});
 client.auth.getSession().then(({data})=>{if(data.session?.user)showDashboard(data.session.user);});
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})();
