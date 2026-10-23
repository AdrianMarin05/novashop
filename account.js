/* NovaShop accounts: optional registration, email/SMS OTP, address map, profile and history. */
(() => {
const $=s=>document.querySelector(s), db=window.NovaShopDB, client=db?.client;
const money=v=>new Intl.NumberFormat("es-CO",{style:"currency",currency:"COP",maximumFractionDigits:0}).format(Number(v)||0);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const msg=(txt,kind="info")=>{const n=$("#message");n.textContent=txt;n.className="account-message "+kind;n.hidden=!txt;};
let mapState={}, pendingSignup=null, pendingLogin=null, session=null;
const signupKey="novashop-pending-signup", loginKey="novashop-pending-login";
function e164(value){let n=String(value||"").replace(/[^0-9+]/g,"");if(n.startsWith("+"))return n;if(n.startsWith("00"))return "+"+n.slice(2);n=n.replace(/\D/g,"");if(n.startsWith("57")&&n.length>=12)return "+"+n;return "+57"+n;}
function setVisible(which){
 $("#registerForm").hidden=which!=="register";$("#verifySignupForm").hidden=which!=="verifySignup";$("#loginForm").hidden=which!=="login";$("#verifyLoginForm").hidden=which!=="verifyLogin";$("#dashboard").hidden=which!=="dashboard";
 document.querySelectorAll("[data-tab]").forEach(b=>b.classList.toggle("active",b.dataset.tab===(which==="login"||which==="verifyLogin"?"login":"register")));
 $("#authPanel").hidden=which==="dashboard";$("#guestHint").hidden=which==="dashboard";
 if(which==="register")setTimeout(()=>mapState.registerMap?.map.invalidateSize(),120);
 if(which==="dashboard")setTimeout(()=>mapState.profileMap?.map.invalidateSize(),120);
}
function currentChannel(form,name){return new FormData(form).get(name)||"email";}
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
   map.setView([lat,lng],zoom);$("#"+statusId).textContent="Pin seleccionado. Arrástralo hasta la entrada correcta.";$("#"+coordsId).textContent=lat.toFixed(6)+", "+lng.toFixed(6);
   mapState[id]={map,put,marker:()=>marker};
 }
 map.on("click",e=>put(e.latlng.lat,e.latlng.lng));
 $("#"+useButtonId)?.addEventListener("click",()=>{
   if(!navigator.geolocation){msg("Tu navegador no permite obtener la ubicación. Puedes marcar el punto manualmente.","error");return;}
   $("#"+statusId).textContent="Solicitando permiso de ubicación…";
   navigator.geolocation.getCurrentPosition(pos=>put(pos.coords.latitude,pos.coords.longitude,17),()=>{
     $("#"+statusId).textContent="No se obtuvo la ubicación; toca el mapa para colocar el pin.";
     msg("No pudimos obtener tu ubicación. Revisa los permisos del navegador o marca el mapa manualmente.","error");
   },{enableHighAccuracy:true,timeout:12000,maximumAge:0});
 });
 mapState[id]={map,put,marker:()=>marker};
 return mapState[id];
}
function profilePayload(user,values){
 return {id:user.id,full_name:values.fullName||[values.firstName,values.lastName].filter(Boolean).join(" "),phone:values.phone||"",email:values.email||user.email||"",address:values.address||"",neighborhood:values.neighborhood||"",city:values.city||"",department:values.department||"",postal_code:values.postalCode||"",delivery_reference:values.deliveryReference||"",latitude:values.latitude?Number(values.latitude):null,longitude:values.longitude?Number(values.longitude):null,updated_at:new Date().toISOString()};
}
async function saveProfile(user,values){const {error}=await client.from("profiles").upsert(profilePayload(user,values),{onConflict:"id"});if(error)throw error;}
function formObj(form){const f=new FormData(form);return Object.fromEntries(["firstName","lastName","phone","email","address","neighborhood","city","department","postalCode","deliveryReference","latitude","longitude"].map(k=>[k,String(f.get(k)||"").trim()]));}
function channelInfo(channel,values){return channel==="email"?{email:String(values.email||"").trim().toLowerCase(),phone:null,identity:String(values.email||"").trim().toLowerCase()}:{email:null,phone:e164(values.phone||values.identity),identity:e164(values.phone||values.identity)};}
async function sendOtp(channel,values,shouldCreateUser){
 const id=channelInfo(channel,values);
 const metadata={full_name:values.fullName||[values.firstName,values.lastName].filter(Boolean).join(" "),phone:values.phone||"",email:values.email||""};
 const opts={shouldCreateUser:!!shouldCreateUser,data:metadata,emailRedirectTo:location.origin+location.pathname};
 const input=id.email?{email:id.email,options:opts}:{phone:id.phone,options:{shouldCreateUser:!!shouldCreateUser,data:metadata}};
 const {error}=await client.auth.signInWithOtp(input);if(error)throw error;return {...id,channel,values};
}
function bestAuthError(err,channel){
 const t=String(err?.message||"");
 if(channel==="sms"&&/phone|sms|provider|twilio|send|disabled|not configured/i.test(t))return "No se pudo enviar el SMS. Supabase necesita Phone Auth habilitado y un proveedor SMS configurado; puede haber costo por mensaje.";
 if(channel==="email"&&/email|smtp|rate limit|sending|send/i.test(t))return "No se pudo enviar el código por correo. Revisa Email Auth, la plantilla OTP y el servicio de correo de Supabase.";
 return t||"Ocurrió un error. Inténtalo de nuevo.";
}
async function sendSignupCode(){
 const form=$("#registerForm");if(!form.reportValidity())return;
 const values=formObj(form),channel=currentChannel(form,"verifyVia");
 values.fullName=[values.firstName,values.lastName].filter(Boolean).join(" ");
 values.phone=e164(values.phone);
 if(!values.latitude||!values.longitude){msg("Marca en el mapa el punto exacto de entrega o usa el botón de ubicación.","error");return;}
 if(channel==="sms"&&!values.phone){msg("Escribe un teléfono válido con prefijo de país.","error");return;}
 const btn=form.querySelector('[type=submit]');btn.disabled=true;btn.textContent="Enviando código…";
 try{
  pendingSignup=await sendOtp(channel,values,true);sessionStorage.setItem(signupKey,JSON.stringify(pendingSignup));
  $("#verifySignupInfo").textContent="Enviamos un código de seis dígitos a "+(channel==="email"?values.email:e164(values.phone))+".";
  setVisible("verifySignup");msg("Revisa tu "+(channel==="email"?"correo (incluida la carpeta de spam).":"teléfono.")+" y escribe el código.","success");
 }catch(e){msg(bestAuthError(e,channel),"error");}
 finally{btn.disabled=false;btn.textContent="Enviar código de verificación";}
}
async function verifySignup(event){
 event.preventDefault();const f=event.currentTarget;if(!f.reportValidity())return;
 const token=f.elements.token.value.trim();const p=pendingSignup||JSON.parse(sessionStorage.getItem(signupKey)||"null");
 if(!p){setVisible("register");msg("Vuelve a solicitar un código de verificación.","error");return;}
 const btn=f.querySelector('[type=submit]');btn.disabled=true;btn.textContent="Verificando…";
 try{
  const args=p.channel==="email"?{email:p.identity,token,type:"email"}:{phone:p.identity,token,type:"sms"};
  const {data,error}=await client.auth.verifyOtp(args);if(error)throw error;
  await saveProfile(data.user,p.values);
  sessionStorage.removeItem(signupKey);pendingSignup=null;f.reset();setVisible("dashboard");await showDashboard(data.user);
  msg("¡Cuenta verificada y creada! Guardamos tu dirección y ubicación.","success");
 }catch(e){msg(bestAuthError(e,p.channel),"error");}
 finally{btn.disabled=false;btn.textContent="Verificar y crear cuenta";}
}
async function sendLoginCode(){
 const form=$("#loginForm");if(!form.reportValidity())return;
 const channel=currentChannel(form,"loginVia"),identity=form.elements.identity.value.trim();
 const values=channel==="email"?{email:identity.toLowerCase()}:{phone:e164(identity)};
 const btn=form.querySelector('[type=submit]');btn.disabled=true;btn.textContent="Enviando código…";
 try{
  pendingLogin=await sendOtp(channel,values,false);sessionStorage.setItem(loginKey,JSON.stringify(pendingLogin));
  $("#verifyLoginInfo").textContent="Enviamos un código a "+pendingLogin.identity+".";
  setVisible("verifyLogin");msg("Revisa el código y escríbelo aquí.","success");
 }catch(e){msg(bestAuthError(e,channel),"error");}
 finally{btn.disabled=false;btn.textContent="Enviar código";}
}
async function verifyLogin(event){
 event.preventDefault();const f=event.currentTarget;if(!f.reportValidity())return;
 const p=pendingLogin||JSON.parse(sessionStorage.getItem(loginKey)||"null");if(!p){setVisible("login");msg("Solicita otro código para iniciar sesión.","error");return;}
 const btn=f.querySelector('[type=submit]');btn.disabled=true;btn.textContent="Verificando…";
 try{
  const args=p.channel==="email"?{email:p.identity,token:f.elements.token.value.trim(),type:"email"}:{phone:p.identity,token:f.elements.token.value.trim(),type:"sms"};
  const {data,error}=await client.auth.verifyOtp(args);if(error)throw error;
  sessionStorage.removeItem(loginKey);pendingLogin=null;f.reset();setVisible("dashboard");await showDashboard(data.user);msg("Sesión iniciada correctamente.","success");
 }catch(e){msg(bestAuthError(e,p.channel),"error");}
 finally{btn.disabled=false;btn.textContent="Verificar e iniciar sesión";}
}
async function resendSignup(){const p=pendingSignup||JSON.parse(sessionStorage.getItem(signupKey)||"null");if(!p)return setVisible("register");try{pendingSignup=await sendOtp(p.channel,p.values,true);sessionStorage.setItem(signupKey,JSON.stringify(pendingSignup));msg("Enviamos un nuevo código.","success");}catch(e){msg(bestAuthError(e,p.channel),"error");}}
async function resendLogin(){const p=pendingLogin||JSON.parse(sessionStorage.getItem(loginKey)||"null");if(!p)return setVisible("login");try{pendingLogin=await sendOtp(p.channel,p.values,false);sessionStorage.setItem(loginKey,JSON.stringify(pendingLogin));msg("Enviamos un nuevo código.","success");}catch(e){msg(bestAuthError(e,p.channel),"error");}}
function showTab(which){setVisible(which);msg("");if(which==="register")setTimeout(()=>mapState.registerMap?.map.invalidateSize(),100);}
async function showDashboard(user){
 session={user};setVisible("dashboard");$("#welcome").textContent="Hola, "+(user.user_metadata?.full_name||user.email?.split("@")[0]||user.phone||"cliente");$("#userEmail").textContent=user.email||user.phone||"Cuenta verificada";
 const {data:profile,error}=await client.from("profiles").select("*").eq("id",user.id).maybeSingle();
 if(!error&&profile){
  const form=$("#profileForm");for(const [key,name] of [["full_name","fullName"],["phone","phone"],["email","email"],["address","address"],["neighborhood","neighborhood"],["city","city"],["department","department"],["postal_code","postalCode"],["delivery_reference","deliveryReference"],["latitude","latitude"],["longitude","longitude"]])form.elements[name].value=profile[key]??"";
  if(profile.latitude!=null&&profile.longitude!=null)mapState.profileMap?.put(profile.latitude,profile.longitude,16);
  $("#userEmail").textContent=profile.email||user.email||user.phone||"Cuenta verificada";
 }
 await loadOrders();
}
async function loadOrders(){
 if(!client||!session?.user)return;$("#ordersList").innerHTML='<p class="account-help">Cargando pedidos…</p>';
 const {data,error}=await client.from("orders").select("id,order_number,status,subtotal_cop,created_at,order_items(product_name,quantity,unit_price_cop,line_total_cop)").order("created_at",{ascending:false}).limit(50);
 if(error){$("#ordersList").innerHTML='<p class="account-help">No pudimos cargar el historial. Comprueba la conexión y las políticas RLS.</p>';return;}
 if(!data?.length){$("#ordersList").innerHTML='<div class="account-order"><strong>Aún no tienes pedidos vinculados</strong><p class="account-help">Cuando compres con tu sesión iniciada, el historial aparecerá aquí.</p><a href="index.html#productos">Explorar productos →</a></div>';return;}
 const labels={pending_payment:"Pendiente de pago",paid:"Pagado",preparing:"En preparación",shipped:"Enviado",delivered:"Entregado",cancelled:"Cancelado",payment_failed:"Pago rechazado",refunded:"Reembolsado"};
 $("#ordersList").innerHTML=data.map(o=>'<article class="account-order"><div class="account-order-head"><div><h3>'+esc(o.order_number)+'</h3><small>'+esc(new Date(o.created_at).toLocaleString("es-CO"))+'</small></div><span class="account-status">'+(labels[o.status]||"En revisión")+'</span></div><ul>'+(o.order_items||[]).map(i=>'<li>'+esc(i.product_name)+' ×'+Number(i.quantity)+' — '+money(i.line_total_cop??i.unit_price_cop*i.quantity)+'</li>').join("")+'</ul><div class="account-order-total"><span>Subtotal</span><strong>'+money(o.subtotal_cop)+'</strong></div></article>').join("");
}
async function saveProfileHandler(event){
 event.preventDefault();if(!session?.user)return;const f=event.currentTarget;if(!f.reportValidity())return;
 if(!f.elements.latitude.value||!f.elements.longitude.value){msg("Marca la ubicación en el mapa para tener coordenadas precisas.","error");return;}
 const values={fullName:f.elements.fullName.value.trim(),phone:f.elements.phone.value.trim(),email:f.elements.email.value.trim(),address:f.elements.address.value.trim(),neighborhood:f.elements.neighborhood.value.trim(),city:f.elements.city.value.trim(),department:f.elements.department.value.trim(),postalCode:f.elements.postalCode.value.trim(),deliveryReference:f.elements.deliveryReference.value.trim(),latitude:f.elements.latitude.value,longitude:f.elements.longitude.value};
 try{await saveProfile(session.user,values);msg("Tus datos de entrega se guardaron correctamente.","success");}catch(e){msg("No pudimos guardar el perfil: "+e.message,"error");}
}
function init(){
 createMap("registerMap","registerLat","registerLng","registerMapStatus","registerCoords","useLocationRegister");
 createMap("profileMap","profileLat","profileLng","profileMapStatus","profileCoords","useLocationProfile");
 const params=new URLSearchParams(location.search);setVisible(params.get("tab")==="login"?"login":"register");
 document.querySelectorAll("[data-tab]").forEach(b=>b.addEventListener("click",()=>showTab(b.dataset.tab)));
 document.querySelectorAll("[data-back-register]").forEach(b=>b.addEventListener("click",()=>showTab("register")));
 document.querySelectorAll("[data-back-login]").forEach(b=>b.addEventListener("click",()=>showTab("login")));
 const viaSelect=()=>{const via=currentChannel($("#loginForm"),"loginVia"),input=$("#loginForm").elements.identity;$("#loginIdentityLabel").textContent=via==="email"?"Correo electrónico":"Teléfono móvil con prefijo de país";input.type=via==="email"?"email":"tel";input.autocomplete=via==="email"?"email":"tel";input.placeholder=via==="email"?"tu@correo.com":"+57 300 123 4567";input.value="";};
 document.querySelectorAll('input[name="loginVia"]').forEach(r=>r.addEventListener("change",viaSelect));
 $("#registerForm").addEventListener("submit",e=>{e.preventDefault();sendSignupCode();});
 $("#verifySignupForm").addEventListener("submit",verifySignup);
 $("#loginForm").addEventListener("submit",e=>{e.preventDefault();sendLoginCode();});
 $("#verifyLoginForm").addEventListener("submit",verifyLogin);
 $("#resendSignupCode").addEventListener("click",resendSignup);$("#resendLoginCode").addEventListener("click",resendLogin);
 $("#profileForm").addEventListener("submit",saveProfileHandler);$("#refreshOrders").addEventListener("click",loadOrders);
 $("#signOut").addEventListener("click",async()=>{await client.auth.signOut();session=null;setVisible("login");msg("Has cerrado sesión.","success");});
 if(!client||!db?.isConfigured?.()){msg("Supabase no está conectado. Revisa la URL y la clave publicable.","error");return;}
 client.auth.onAuthStateChange((_event,s)=>{if(s?.user){session={user:s.user};setVisible("dashboard");showDashboard(s.user);}else{session=null;}});
 client.auth.getSession().then(({data})=>{if(data.session?.user)showDashboard(data.session.user);});
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})();