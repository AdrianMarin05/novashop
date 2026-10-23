/* Admin catalog UI. Every privileged action is checked again in the server Edge Function. */
(() => {
const $=s=>document.querySelector(s), db=window.NovaShopDB;
const money=n=>new Intl.NumberFormat("es-CO",{style:"currency",currency:"COP",maximumFractionDigits:0}).format(Number(n)||0);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
let products=[], editingImages=[], editingVideo=null, metrics=null, currentRole=null, adminUsers=[];
function status(text,kind="info"){const el=$("#adminStatus");el.textContent=text;el.className="admin-status "+kind;}
function formData(){const f=$("#adminProductForm"),v=new FormData(f);return {id:v.get("id")?Number(v.get("id")):null,name:String(v.get("name")||"").trim(),category:String(v.get("category")||""),delivery_type:v.get("delivery_type"),price_cop:Number(v.get("price_cop")),old_price_cop:v.get("old_price_cop")?Number(v.get("old_price_cop")):null,stock_quantity:v.get("stock_quantity")===""?null:Number(v.get("stock_quantity")),description:String(v.get("description")||"").trim(),features:String(v.get("features")||"").split("\n").map(s=>s.trim()).filter(Boolean),images:editingImages.slice(),video_url:editingVideo,tag:String(v.get("tag")||"").trim(),shipping:String(v.get("shipping")||"").trim(),is_active:!!f.elements.is_active.checked,sort_order:v.get("sort_order")?Number(v.get("sort_order")):(v.get("id")?Number(v.get("id")):100)};}
async function call(body){if(!db?.isConfigured?.())throw new Error("Supabase no está conectado.");return db.adminCall(body);}
async function upload(file){const signed=await call({action:"upload-url",filename:file.name,contentType:file.type,size:file.size});const {error}=await db.client.storage.from("products-media").uploadToSignedUrl(signed.path,signed.token,file,{contentType:file.type,upsert:false});if(error)throw error;return signed.publicUrl;}

function roleLabel(role){return ({owner:"Propietario",admin:"Administrador",catalog_manager:"Gestor de catálogo",analyst:"Analista",customer:"Cliente"})[role]||role||"Cliente";}
function userStatus(text,kind="info"){const el=$("#adminUsersStatus");if(el){el.textContent=text;el.className="admin-status "+kind;}}
async function loadAdminUsers(){
 if(!["owner","admin"].includes(currentRole))return;
 try{
  const result=await call({action:"list-users"});adminUsers=result.users||[];renderAdminUsers();
  userStatus("Usuarios cargados. Los cambios de rol se validan en el servidor.","success");
 }catch(e){userStatus(e.message||"No pudimos cargar los usuarios.","error");}
}
function renderAdminUsers(){
 const box=$("#adminUsersList");if(!box)return;
 $("#adminUsersCount").textContent=String(adminUsers.length);
 if(!adminUsers.length){box.innerHTML='<p class="admin-help">Todavía no hay usuarios registrados.</p>';return;}
 box.innerHTML=adminUsers.map(u=>{
  const id=esc(u.id);
  const options=[["customer","Cliente"],["catalog_manager","Gestor de catálogo"],["analyst","Analista"],["admin","Administrador"]];
  const safeOptions=options.filter(([value])=>value!=="admin"||currentRole==="owner"||u.role==="admin");
  const select=safeOptions.map(([value,label])=>'<option value="'+value+'" '+(u.role===value?'selected':'')+'>'+label+'</option>').join("");
  const reset=currentRole==="owner"&&u.role!=="owner"
   ? '<div class="admin-password-reset"><button type="button" class="admin-password-toggle" data-password-panel-toggle="'+id+'">Establecer contraseña temporal</button><form class="admin-password-form" data-password-reset-form="'+id+'" hidden><p class="admin-help">Para '+esc(u.email||u.full_name||"este usuario")+'. Solo el propietario puede realizar este cambio.</p><label>Contraseña temporal<input name="password" type="password" required minlength="12" maxlength="128" autocomplete="new-password" placeholder="Mínimo 12 caracteres"></label><label>Confirmar contraseña<input name="confirmPassword" type="password" required minlength="12" maxlength="128" autocomplete="new-password" placeholder="Escríbela otra vez"></label><div class="admin-password-actions"><button type="button" data-password-generate="'+id+'">Generar segura</button><button type="button" data-password-reveal="'+id+'">Mostrar</button><button type="submit">Guardar contraseña</button></div><p class="admin-help">Después de guardar, podrás copiar la contraseña temporal del formulario y enviarla en un chat privado.</p></form></div>'
   : "";
  return '<article class="admin-user" data-user-row="'+id+'"><div class="admin-user-top"><div><div class="admin-user-name">'+esc(u.full_name||u.username||"Usuario")+'</div><div class="admin-user-email">'+esc(u.email||u.phone||"Sin correo")+'</div></div><span class="admin-pill '+(u.role==="customer"?"off":"")+'">'+esc(roleLabel(u.role))+'</span></div><div class="admin-user-meta"><span>'+(u.email_confirmed?"Correo confirmado":"Correo pendiente")+'</span><span>·</span><span>Alta: '+esc(new Date(u.created_at).toLocaleDateString("es-CO"))+'</span>'+(u.last_sign_in_at?'<span>·</span><span>Último acceso: '+esc(new Date(u.last_sign_in_at).toLocaleDateString("es-CO"))+'</span>':'')+'</div><div class="admin-user-controls"><label>Asignar rol<select data-role-select="'+id+'" '+(u.role==="owner"?"disabled":"")+'>'+select+'</select></label><button type="button" data-role-save="'+id+'" '+(u.role==="owner"?"disabled":"")+'>Guardar rol</button></div>'+reset+'</article>';
 }).join("");
 box.querySelectorAll("[data-role-save]").forEach(button=>button.addEventListener("click",()=>saveUserRole(button.dataset.roleSave)));
 box.querySelectorAll("[data-password-panel-toggle]").forEach(button=>button.addEventListener("click",()=>{
  const form=box.querySelector('[data-password-reset-form="'+CSS.escape(button.dataset.passwordPanelToggle)+'"]');
  if(!form)return;form.hidden=!form.hidden;
  button.textContent=form.hidden?"Establecer contraseña temporal":"Cerrar formulario";
  if(!form.hidden)form.querySelector('input[name="password"]').focus();
 }));
 box.querySelectorAll("[data-password-generate]").forEach(button=>button.addEventListener("click",()=>{
  const form=box.querySelector('[data-password-reset-form="'+CSS.escape(button.dataset.passwordGenerate)+'"]');
  if(!form)return;
  const chars="ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%*-_";
  const random=new Uint32Array(20);crypto.getRandomValues(random);
  const value=Array.from(random,n=>chars[n%chars.length]).join("");
  form.elements.password.value=value;form.elements.confirmPassword.value=value;
  form.elements.password.type="text";form.elements.confirmPassword.type="text";
 }));
 box.querySelectorAll("[data-password-reveal]").forEach(button=>button.addEventListener("click",()=>{
  const form=box.querySelector('[data-password-reset-form="'+CSS.escape(button.dataset.passwordReveal)+'"]');
  if(!form)return;
  const show=form.elements.password.type==="password";
  form.elements.password.type=show?"text":"password";form.elements.confirmPassword.type=show?"text":"password";
  button.textContent=show?"Ocultar":"Mostrar";
 }));
 box.querySelectorAll("[data-password-reset-form]").forEach(form=>form.addEventListener("submit",event=>setUserPassword(event,form)));
}
async function setUserPassword(event,form){
 event.preventDefault();
 if(currentRole!=="owner"){userStatus("Solo el propietario puede cambiar contraseñas desde el panel.","error");return;}
 if(!form.reportValidity())return;
 const userId=form.dataset.passwordResetForm;
 const password=String(form.elements.password.value||""),confirmation=String(form.elements.confirmPassword.value||"");
 if(password.length<12){userStatus("La contraseña debe tener al menos 12 caracteres.","error");return;}
 if(password!==confirmation){userStatus("Las contraseñas no coinciden.","error");return;}
 const button=form.querySelector('[type="submit"]');button.disabled=true;button.textContent="Guardando…";
 try{
  await call({action:"set-user-password",user_id:userId,password});
  form.elements.password.type="text";form.elements.confirmPassword.type="text";
  button.textContent="Contraseña guardada";
  const target=adminUsers.find(u=>u.id===userId);
  userStatus("Contraseña temporal actualizada para "+(target?.email||target?.full_name||"el usuario")+". Copia la clave y compártela solo por un chat privado.","success");
 }catch(error){userStatus(error.message||"No se pudo cambiar la contraseña. Inténtalo otra vez.","error");button.textContent="Guardar contraseña";}
 finally{button.disabled=false;}
}
async function saveUserRole(userId){
 const select=$('[data-role-select="'+CSS.escape(userId)+'"]');if(!select)return;
 const button=$('[data-role-save="'+CSS.escape(userId)+'"]');if(button){button.disabled=true;button.textContent="Guardando…";}
 try{await call({action:"set-role",user_id:userId,role:select.value});userStatus("Rol actualizado correctamente.","success");await loadAdminUsers();}
 catch(e){userStatus(e.message||"No se pudo cambiar el rol.","error");}
 finally{if(button){button.disabled=false;button.textContent="Guardar rol";}}
}
async function inviteUser(event){
 event.preventDefault();const form=event.currentTarget;if(!form.reportValidity())return;
 const button=form.querySelector('[type="submit"]');button.disabled=true;button.textContent="Enviando invitación…";
 try{
  const data=new FormData(form);
  const result=await call({action:"invite-user",full_name:String(data.get("full_name")||"").trim(),email:String(data.get("email")||"").trim().toLowerCase(),role:String(data.get("role")||"customer")});
  userStatus("Invitación creada para "+result.user.email+". Si no llega, revisa la configuración de correo de Supabase.","success");
  form.reset();await loadAdminUsers();
 }catch(e){userStatus(e.message||"No pudimos invitar al usuario.","error");}
 finally{button.disabled=false;button.textContent="Enviar invitación por correo";}
}
function configureRolePanels(){
 document.body.classList.add("admin-authorized");
 const users=$("#adminUsersWrap"),editor=document.querySelector(".admin-grid > section:first-child"),catalog=document.querySelector(".admin-grid > section:nth-child(2)"),metricsWrap=document.querySelector(".admin-metrics-wrap");
 const canManage=["owner","admin"].includes(currentRole),canEdit=["owner","admin","catalog_manager"].includes(currentRole),canAnalyze=["owner","admin","analyst"].includes(currentRole);
 if(users)users.hidden=!canManage;
 if(editor)editor.hidden=!canEdit;
 if(catalog)catalog.hidden=!canEdit&&currentRole!=="analyst";
 if(metricsWrap)metricsWrap.hidden=!canAnalyze;
}
async function loadProducts(){
 try{
  const r=await call({action:"list"});products=r.products||[];renderProducts();
  if(["owner","admin","analyst"].includes(currentRole)){
   try{const m=await call({action:"metrics"});metrics=m.metrics||null;renderMetrics(metrics);}
   catch(e){status("Catálogo cargado, pero las métricas no están disponibles: "+(e.message||""),"error");}
  }else{metrics=null;renderMetrics(null);}
  if(!["owner","admin","catalog_manager","analyst"].includes(currentRole))status("Permiso insuficiente.","error");
  else status("Sesión lista. El servidor confirmó el rol: "+roleLabel(currentRole)+".","success");
  configureRolePanels();
 }catch(e){products=[];renderProducts();renderMetrics(null);status(e.message||"No se pudo cargar el catálogo.","error");}
}
function renderMetrics(m){
 const box=$("#adminMetrics");if(!box)return;
 if(!m){box.innerHTML='<div class="admin-metric"><span>Ventas confirmadas</span><strong>—</strong></div><div class="admin-metric"><span>Pedidos pagados</span><strong>—</strong></div><div class="admin-metric"><span>Unidades vendidas</span><strong>—</strong></div><div class="admin-metric"><span>Pedidos pendientes</span><strong>—</strong></div>';$("#adminInventoryMetrics").textContent="No se pudieron cargar las métricas.";$("#adminSalesMix").textContent="No se pudieron cargar las ventas.";return;}
 box.innerHTML='<div class="admin-metric"><span>Ventas confirmadas</span><strong>'+money(m.revenueCop)+'</strong></div><div class="admin-metric"><span>Pedidos pagados</span><strong>'+Number(m.paidOrders||0)+'</strong></div><div class="admin-metric"><span>Unidades vendidas</span><strong>'+Number(m.unitsSold||0)+'</strong></div><div class="admin-metric"><span>Pedidos pendientes</span><strong>'+Number(m.pendingOrders||0)+'</strong></div>';
 const inv=m.inventory||{};
 $("#adminInventoryMetrics").innerHTML=[
  ["Productos activos",inv.activeProducts||0],
  ["Stock configurado",inv.trackedProducts||0],
  ["Unidades en stock",inv.trackedUnits||0],
  ["Sin inventario configurado",inv.untrackedProducts||0],
  ["Stock bajo (≤ 5)",(inv.lowStockProducts||[]).length],
  ["Agotados",(inv.outOfStockProducts||[]).length]
 ].map(([label,value])=>'<div class="admin-inventory-stat"><span>'+esc(label)+'</span><strong>'+Number(value)+'</strong></div>').join("");
 const mix=Array.isArray(m.salesMix)?m.salesMix:[];
 $("#adminSalesMix").innerHTML=mix.length?mix.map(p=>'<div class="admin-sales-row"><span class="name" title="'+esc(p.name)+'">'+esc(p.name)+'</span><div class="admin-sales-bar"><span style="width:'+Math.min(100,Math.max(0,Number(p.percentage)||0))+'%"></span></div><span class="admin-sales-pct">'+(Number(p.percentage)||0).toLocaleString("es-CO",{maximumFractionDigits:1})+'%</span></div>').join(""):'<p class="admin-help">Todavía no hay ventas con pago confirmado. Los pedidos pendientes por WhatsApp no cuentan como ventas pagadas.</p>';
}
function renderProducts(){
 const box=$("#adminProductList");if(!products.length){box.innerHTML='<p class="admin-help">No hay productos o tu cuenta no está autorizada. Inicia sesión y solicita el permiso de administrador al propietario de la tienda.</p>';return;}
 const canEdit=["owner","admin","catalog_manager"].includes(currentRole);
 box.innerHTML=products.map(p=>'<article class="admin-product"><img src="'+esc((p.images||[])[0]||"images/streaming-placeholder.svg")+'" alt=""><div><h3>'+esc(p.name)+'</h3><p>'+money(p.price_cop)+' · '+esc(p.category)+'</p><small>#'+p.id+' · '+(p.is_active?'Visible':'Oculto')+(p.video_url?' · tiene video':'')+' · '+(p.stock_quantity==null?'Stock sin configurar':(Number(p.stock_quantity)===0?'Agotado':'Stock: '+Number(p.stock_quantity)))+'</small></div>'+(canEdit?'<div class="admin-actions"><button type="button" data-edit="'+p.id+'">Editar</button>'+(p.is_active?'<button type="button" data-off="'+p.id+'">Ocultar</button>':'')+'</div>':'')+'</article>').join("");
 box.querySelectorAll("[data-edit]").forEach(b=>b.addEventListener("click",()=>editProduct(Number(b.dataset.edit))));
 box.querySelectorAll("[data-off]").forEach(b=>b.addEventListener("click",()=>deactivate(Number(b.dataset.off))));
}
function editProduct(id){
 const p=products.find(x=>x.id===id);if(!p)return;const f=$("#adminProductForm");
 f.elements.id.value=p.id;f.elements.name.value=p.name;f.elements.category.value=p.category;f.elements.delivery_type.value=p.delivery_type;
 f.elements.price_cop.value=p.price_cop;f.elements.old_price_cop.value=p.old_price_cop||"";f.elements.stock_quantity.value=p.stock_quantity==null?"":p.stock_quantity;f.elements.sort_order.value=p.sort_order??100;
 f.elements.description.value=p.description||"";f.elements.features.value=(p.features||[]).join("\n");
 f.elements.tag.value=p.tag||"";f.elements.shipping.value=p.shipping||"";f.elements.is_active.checked=!!p.is_active;
 editingImages=(p.images||[]).slice();editingVideo=p.video_url||null;f.elements.images.value="";f.elements.video.value="";
 $("#adminFormTitle").textContent="Editar producto #"+p.id;window.scrollTo({top:0,behavior:"smooth"});
}
function resetForm(){ $("#adminProductForm").reset();$("#adminProductForm").elements.id.value="";$("#adminProductForm").elements.stock_quantity.value="";$("#adminProductForm").elements.sort_order.value="100";$("#adminProductForm").elements.is_active.checked=true;editingImages=[];editingVideo=null;$("#adminFormTitle").textContent="Añadir nuevo producto";}
async function save(e){
 e.preventDefault();const f=e.currentTarget;if(!f.reportValidity())return;
 const submit=f.querySelector('[type="submit"]');submit.disabled=true;submit.textContent="Subiendo y guardando…";
 try{
  const imageFiles=Array.from(f.elements.images.files||[]),videoFile=f.elements.video.files?.[0]||null;
  if(!editingImages.length&&!imageFiles.length)throw new Error("Sube al menos una foto del producto.");
  if(imageFiles.length+editingImages.length>8)throw new Error("Un producto admite máximo 8 imágenes; quita algunas fotos anteriores o selecciona menos.");
  for(const file of imageFiles){if(file.size>12*1024*1024)throw new Error("La imagen "+file.name+" supera 12 MB.");}
  if(videoFile&&videoFile.size>50*1024*1024)throw new Error("El video supera 50 MB.");
  for(const file of imageFiles)editingImages.push(await upload(file));
  if(videoFile)editingVideo=await upload(videoFile);
  const payload=formData();payload.images=editingImages;payload.video_url=editingVideo;
  const result=await call({action:"save",...payload});
  if(result.product){status("Producto guardado: "+result.product.name+". El catálogo de la tienda se actualizará al recargar.", "success");}
  resetForm();await loadProducts();
 }catch(err){status(err.message||"No se pudo guardar el producto.","error");}
 finally{submit.disabled=false;submit.textContent="Guardar producto";}
}
async function deactivate(id){if(!confirm("¿Ocultar este producto de la tienda? El historial de pedidos se conservará."))return;try{await call({action:"deactivate",id});status("Producto ocultado de la tienda.","success");await loadProducts();}catch(e){status(e.message||"No se pudo ocultar el producto.","error");}}
async function init(){
 $("#adminProductForm").addEventListener("submit",save);$("#resetAdminForm").addEventListener("click",resetForm);$("#refreshAdminProducts").addEventListener("click",loadProducts);$("#refreshAdminMetrics")?.addEventListener("click",loadProducts);
 $("#adminInviteForm")?.addEventListener("submit",inviteUser);$("#refreshAdminUsers")?.addEventListener("click",loadAdminUsers);
 if(!db?.isConfigured?.()){status("Supabase no está conectado.","error");return;}
 const {data}=await db.client.auth.getSession();
 if(!data.session){status("Inicia sesión con una cuenta autorizada para administrar NovaShop.","error");return;}
 try{const me=await call({action:"whoami"});currentRole=me.role;configureRolePanels();}
 catch(e){status(e.message||"Tu cuenta no tiene permisos de administración.","error");return;}
 await loadProducts();
 if(["owner","admin"].includes(currentRole))await loadAdminUsers();
 db.client.auth.onAuthStateChange((_event,s)=>{if(!s){products=[];adminUsers=[];renderProducts();status("Sesión cerrada.","error");location.href="cuenta.html?tab=login";}});
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})();