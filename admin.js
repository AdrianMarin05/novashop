/* Admin catalog UI. Every privileged action is checked again in the server Edge Function. */
(() => {
const $=s=>document.querySelector(s), db=window.NovaShopDB;
const money=n=>new Intl.NumberFormat("es-CO",{style:"currency",currency:"COP",maximumFractionDigits:0}).format(Number(n)||0);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
let products=[], editingImages=[], editingVideo=null, metrics=null, currentRole=null, adminUsers=[], adminOrders=[], ordersOffset=0, ordersHasMore=false, ordersLoading=false, productEditorReturnFocus=null;
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
 const users=$("#adminUsersWrap"),ordersWrap=$("#adminOrdersWrap"),editor=document.querySelector(".admin-grid > section:first-of-type"),catalog=document.querySelector(".admin-grid > section:nth-of-type(2)"),metricsWrap=document.querySelector(".admin-metrics-wrap");
 const canManage=["owner","admin"].includes(currentRole),canEdit=["owner","admin","catalog_manager"].includes(currentRole),canAnalyze=["owner","admin","analyst"].includes(currentRole);
 if(users)users.hidden=!canManage;
 if(ordersWrap)ordersWrap.hidden=!canManage;
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
const ORDER_STATES=[
 ["pending_payment","Pendiente de pago"],["paid","Pago confirmado"],["preparing","En preparación"],
 ["shipped","Enviado"],["delivered","Entregado"],["cancelled","Cancelado"],
 ["payment_failed","Pago rechazado"],["refunded","Reembolsado"]
];
const orderStateLabel=value=>(ORDER_STATES.find(([key])=>key===value)||[value||"","Sin estado"])[1];
const paymentLabel=value=>({pending:"Pendiente",approved:"Aprobado",rejected:"Rechazado",cancelled:"Cancelado",refunded:"Reembolsado"})[value]||value||"Sin estado";
function orderStatusNotice(message,kind="info"){
 const el=$("#adminOrdersStatus");if(!el)return;
 el.textContent=message;el.className="admin-status "+kind;
}
function formatDate(value){
 const date=new Date(value);
 return Number.isNaN(date.getTime())?"Fecha no disponible":date.toLocaleString("es-CO",{dateStyle:"medium",timeStyle:"short"});
}
function whatsappHref(phone){
 let digits=String(phone||"").replace(/\D/g,"");
 if(digits.startsWith("00"))digits=digits.slice(2);
 if(digits.length===10)digits="57"+digits;
 if(digits.length<10||digits.length>15)return "";
 return "https://wa.me/"+digits;
}
function orderMatchesSearch(order,query){
 if(!query)return true;
 const customer=[order.customer_first_name,order.customer_last_name,order.customer_email,order.customer_phone,order.order_number,order.address,order.city].join(" ").toLocaleLowerCase("es");
 return customer.includes(query);
}
async function loadAdminOrders(reset=false){
 if(!["owner","admin"].includes(currentRole))return;
 if(ordersLoading)return;
 if(reset){adminOrders=[];ordersOffset=0;ordersHasMore=true;}
 if(!ordersHasMore&&!reset)return;
 ordersLoading=true;
 const refresh=$("#refreshAdminOrders"),more=$("#loadMoreOrders");
 if(refresh){refresh.disabled=true;refresh.textContent="Cargando…";}
 if(more&&!reset){more.disabled=true;more.textContent="Cargando…";}
 orderStatusNotice("Consultando pedidos de forma segura…");
 try{
  const state=$("#adminOrderStatusFilter")?.value||"all";
  const result=await call({action:"list-orders",status:state,limit:40,offset:ordersOffset});
  const rows=Array.isArray(result.orders)?result.orders:[];
  adminOrders=reset?rows:adminOrders.concat(rows);
  ordersOffset=Number(result.offset||0)+rows.length;
  ordersHasMore=!!result.hasMore;
  renderAdminOrders();
  orderStatusNotice("Se cargaron "+adminOrders.length+" pedidos. Los pedidos gestionados por WhatsApp siguen pendientes hasta que confirmes su estado.","success");
 }catch(error){
  orderStatusNotice(error.message||"No pudimos consultar los pedidos. Vuelve a intentarlo.","error");
  if(reset)adminOrders=[];
  renderAdminOrders();
 }finally{
  ordersLoading=false;
  if(refresh){refresh.disabled=false;refresh.textContent="Actualizar pedidos";}
  if(more){more.disabled=false;more.textContent="Cargar más pedidos";}
 }
}
function renderAdminOrders(){
 const box=$("#adminOrdersList");if(!box)return;
 const query=String($("#adminOrderSearch")?.value||"").trim().toLocaleLowerCase("es");
 const shown=adminOrders.filter(order=>orderMatchesSearch(order,query));
 if(!shown.length){
  box.innerHTML='<div class="admin-orders-empty">'+(query?'No encontramos pedidos cargados que coincidan con esa búsqueda.':'No hay pedidos para el estado seleccionado todavía. Cuando un cliente termine una compra, aparecerá aquí.')+'</div>';
 }else{
  box.innerHTML=shown.map(order=>{
   const customer=[order.customer_first_name,order.customer_last_name].filter(Boolean).join(" ")||"Cliente sin nombre";
   const address=[order.address,order.neighborhood,order.city,order.department,order.postal_code].filter(Boolean).join(", ");
   const items=Array.isArray(order.order_items)?order.order_items:[];
   const itemRows=items.map(item=>'<li><span>'+esc(item.product_name||"Producto")+' ×'+Number(item.quantity||0)+'</span><strong>'+money(item.line_total_cop??(Number(item.unit_price_cop||0)*Number(item.quantity||0)))+'</strong></li>').join("");
   const wa=whatsappHref(order.customer_phone);
   const validCoords=order.latitude!==null&&order.latitude!==undefined&&order.longitude!==null&&order.longitude!==undefined&&Number.isFinite(Number(order.latitude))&&Number.isFinite(Number(order.longitude));
   const mapUrl=validCoords
    ? 'https://www.google.com/maps?q='+Number(order.latitude)+','+Number(order.longitude)
    : (address?'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(address):"");
   const coords=mapUrl?'<a target="_blank" rel="noopener noreferrer" href="'+mapUrl+'">Abrir mapa para entrega ↗</a>':"";
   const badges='<span class="admin-order-badge '+(order.status==="pending_payment"?"pending":(["paid","preparing","shipped","delivered"].includes(order.status)?"paid":(["cancelled","payment_failed","refunded"].includes(order.status)?"cancelled":"")))+'">'+esc(orderStateLabel(order.status))+'</span><span class="admin-order-badge">Pago: '+esc(paymentLabel(order.payment_status))+'</span>';
   const options=ORDER_STATES.map(([value,label])=>'<option value="'+value+'" '+(order.status===value?"selected":"")+'>'+label+'</option>').join("");
   const email=order.customer_email?'<div>Correo: <a href="mailto:'+esc(order.customer_email)+'">'+esc(order.customer_email)+'</a></div>':"";
   const phone=order.customer_phone?'<div>Teléfono: <a href="tel:'+esc(String(order.customer_phone).replace(/[^+\d]/g,""))+'">'+esc(order.customer_phone)+'</a> '+(wa?'<a target="_blank" rel="noopener noreferrer" href="'+wa+'">WhatsApp ↗</a>':"")+'</div>':"";
   return '<article class="admin-order-card" data-order-card="'+esc(order.id)+'"><div class="admin-order-top"><div><div class="admin-order-id">'+esc(order.order_number||order.id)+'</div><div class="admin-order-date">'+esc(formatDate(order.created_at))+'</div></div><div class="admin-order-badges">'+badges+'</div></div><div class="admin-order-grid"><section><div class="admin-order-label">Datos del comprador</div><div class="admin-order-customer">'+esc(customer)+'</div><div class="admin-order-meta">'+email+phone+(address?'<div>Dirección: '+esc(address)+'</div>':'<div>Dirección: No indicada</div>')+(order.delivery_reference?'<div>Referencia: '+esc(order.delivery_reference)+'</div>':"")+(order.preferred_payment_method?'<div>Pago elegido: '+esc(order.preferred_payment_method)+'</div>':"")+(coords?'<div>'+coords+'</div>':"")+(order.customer_note?'<div>Nota: '+esc(order.customer_note)+'</div>':"")+'</div></section><section><div class="admin-order-label">Resumen del pedido · '+esc(order.delivery_type||"")+'</div><ul class="admin-order-lines">'+(itemRows||'<li>Detalle de productos no disponible.</li>')+'</ul><div class="admin-order-total"><span>Total del pedido</span><strong>'+money(order.subtotal_cop)+'</strong></div></section></div><div class="admin-order-foot"><div class="admin-order-meta">Última actualización: '+esc(formatDate(order.updated_at||order.created_at))+'</div><div class="admin-order-update"><label>Actualizar estado<select data-order-status="'+esc(order.id)+'">'+options+'</select></label><button type="button" data-order-update="'+esc(order.id)+'">Guardar estado</button></div></div></article>';
  }).join("");
 }
 const more=$("#loadMoreOrders");if(more){more.hidden=!ordersHasMore;more.disabled=ordersLoading;}
 box.querySelectorAll("[data-order-update]").forEach(button=>button.addEventListener("click",()=>updateOrderStatus(button.dataset.orderUpdate,button)));
}
async function updateOrderStatus(orderId,button){
 if(!["owner","admin"].includes(currentRole)){orderStatusNotice("No tienes permiso para actualizar pedidos.","error");return;}
 const select=document.querySelector('[data-order-status="'+CSS.escape(orderId)+'"]');
 if(!select)return;
 const order=adminOrders.find(item=>item.id===orderId);if(!order)return;
 const next=select.value;
 if(next===order.status){orderStatusNotice("El pedido ya tiene ese estado.");return;}
 if(["paid","preparing","shipped","delivered"].includes(next)){
  const accepted=confirm("Vas a marcar "+(order.order_number||"este pedido")+" como «"+orderStateLabel(next)+"». Esto registrará el pago como aprobado. Confirma solo si verificaste el pago.");
  if(!accepted){select.value=order.status;return;}
 }else if(next==="refunded"&&!confirm("¿Confirmas que el reembolso de este pedido ya se realizó?")){select.value=order.status;return;}
 else if(next==="cancelled"&&!confirm("¿Deseas cancelar este pedido?")){select.value=order.status;return;}
 button.disabled=true;button.textContent="Guardando…";
 try{
  await call({action:"update-order-status",order_id:orderId,status:next});
  orderStatusNotice("Estado actualizado para "+(order.order_number||"el pedido")+".","success");
  await Promise.all([loadAdminOrders(true),loadProducts()]);
 }catch(error){
  orderStatusNotice(error.message||"No se pudo actualizar el pedido.","error");select.value=order.status;
 }finally{button.disabled=false;button.textContent="Guardar estado";}
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
 const alertBox=$("#adminInventoryAlerts");
 if(alertBox){
  const out=Array.isArray(inv.outOfStockProducts)?inv.outOfStockProducts:[];
  const low=Array.isArray(inv.lowStockProducts)?inv.lowStockProducts:[];
  const canEditStock=["owner","admin","catalog_manager"].includes(currentRole);
  const listItems=items=>items.slice(0,5).map(p=>'<div class="admin-stock-alert-item"><span>'+esc(p.name)+' · '+Number(p.stock_quantity||0)+' unidades</span>'+(canEditStock?'<button type="button" data-stock-edit="'+Number(p.id)+'">Editar stock</button>':"")+'</div>').join("")+(items.length>5?'<div>Y '+(items.length-5)+' productos más.</div>':"");
  let alertHtml="";
  if(out.length)alertHtml+='<div class="admin-stock-alert critical"><div><strong>Agotados ('+out.length+')</strong>'+listItems(out)+'</div></div>';
  if(low.length)alertHtml+='<div class="admin-stock-alert"><div><strong>Stock bajo ('+low.length+')</strong>'+listItems(low)+'</div></div>';
  if(Number(inv.untrackedProducts||0)>0)alertHtml+='<div class="admin-stock-alert neutral"><div><strong>Inventario sin configurar</strong>'+Number(inv.untrackedProducts)+' productos no tienen cantidad registrada. Introduce las existencias reales desde Catálogo.</div>'+(canEditStock?'<button type="button" data-stock-goto>Ir al catálogo</button>':"")+'</div>';
  if(!alertHtml)alertHtml='<div class="admin-stock-alert neutral"><div><strong>Inventario al día</strong>No hay alertas de stock bajo o agotado en los productos controlados.</div></div>';
  alertBox.innerHTML=alertHtml;
  alertBox.querySelectorAll("[data-stock-edit]").forEach(button=>button.addEventListener("click",()=>{
   const product=products.find(p=>Number(p.id)===Number(button.dataset.stockEdit));
   if(product){editProduct(product.id);const input=$("#adminProductForm").elements.stock_quantity;input.focus();input.scrollIntoView({behavior:"smooth",block:"center"});}
  }));
  alertBox.querySelector("[data-stock-goto]")?.addEventListener("click",()=>{$(".admin-grid")?.scrollIntoView({behavior:"smooth",block:"start"});});
 }
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
function renderCurrentMedia(){
 const form=$("#adminProductForm");
 const imageBox=$("#adminCurrentImages");
 const videoBox=$("#adminCurrentVideo");
 if(imageBox){
  imageBox.hidden=!editingImages.length;
  imageBox.innerHTML=editingImages.map((url,index)=>'<div class="admin-current-image"><img src="'+esc(url)+'" alt="Imagen actual '+(index+1)+'" loading="lazy"><small>Imagen '+(index+1)+' de '+editingImages.length+'</small><button type="button" data-remove-current-image="'+index+'" aria-label="Quitar imagen '+(index+1)+'">Quitar</button></div>').join("");
  imageBox.querySelectorAll("[data-remove-current-image]").forEach(button=>button.addEventListener("click",()=>{
   const index=Number(button.dataset.removeCurrentImage);
   if(!Number.isInteger(index)||index<0||index>=editingImages.length)return;
   editingImages.splice(index,1);
   if(form)form.dataset.dirty="1";
   renderCurrentMedia();
  }));
 }
 if(videoBox){
  const picked=form?.elements.video?.files?.[0]||null;
  const current=editingVideo?'<video controls preload="metadata" src="'+esc(editingVideo)+'"></video><div class="admin-current-video-meta"><span>Video guardado en el producto</span><button type="button" id="removeCurrentVideo">Quitar video actual</button></div>':"";
  const pending=picked?'<div class="admin-current-video-meta"><span>Nuevo video seleccionado: '+esc(picked.name)+' ('+(picked.size/1024/1024).toFixed(1)+' MB). Reemplazará el video actual al guardar.</span><button type="button" id="clearSelectedVideo">Deshacer selección</button></div>':"";
  videoBox.innerHTML=current+pending;
  videoBox.hidden=!current&&!pending;
  $("#removeCurrentVideo")?.addEventListener("click",()=>{
   editingVideo=null;
   if(form)form.dataset.dirty="1";
   renderCurrentMedia();
  });
  $("#clearSelectedVideo")?.addEventListener("click",()=>{
   if(form?.elements.video)form.elements.video.value="";
   if(form)form.dataset.dirty="1";
   renderCurrentMedia();
  });
 }
}
function openProductEditor(productId){
 const modal=$("#productEditorModal"),slot=$("#productEditorModalSlot");
 const editor=$("#adminFormTitle")?.closest(".admin-card");
 const placeholder=$("#productEditorPlaceholder");
 if(!modal||!slot||!editor||!placeholder){status("No pudimos abrir el editor. Recarga el panel e inténtalo otra vez.","error");return;}
 productEditorReturnFocus=document.activeElement;
 if(editor.parentNode!==slot){
  if(placeholder.parentNode!==editor.parentNode)editor.parentNode.insertBefore(placeholder,editor);
  slot.appendChild(editor);
 }
 $("#productEditorModalTitle").textContent="Editar producto #"+productId;
 modal.hidden=false;modal.setAttribute("aria-hidden","false");
 document.body.classList.add("product-editor-open");
 $("#closeProductEditor")?.focus();
}
function closeProductEditor(force=false){
 const modal=$("#productEditorModal");
 if(!modal||modal.hidden)return;
 const form=$("#adminProductForm");
 if(!force&&form?.dataset.dirty==="1"&&!confirm("Tienes cambios sin guardar. ¿Cerrar el editor sin guardarlos?"))return;
 const editor=$("#adminFormTitle")?.closest(".admin-card");
 const placeholder=$("#productEditorPlaceholder");
 if(editor&&placeholder?.parentNode){
  placeholder.parentNode.insertBefore(editor,placeholder.nextSibling);
 }
 modal.hidden=true;modal.setAttribute("aria-hidden","true");
 document.body.classList.remove("product-editor-open");
 if(productEditorReturnFocus?.isConnected)productEditorReturnFocus.focus();
 else $("#adminProductList")?.focus?.();
 productEditorReturnFocus=null;
 resetForm();
}
function editProduct(id){
 const p=products.find(x=>x.id===id);if(!p)return;const f=$("#adminProductForm");
 const categorySelect=f.elements.category;
 if(!Array.from(categorySelect.options).some(option=>option.value===p.category)){
  const option=document.createElement("option");option.value=p.category;option.textContent=p.category;categorySelect.add(option);
 }
 f.elements.id.value=p.id;f.elements.name.value=p.name;f.elements.category.value=p.category;f.elements.delivery_type.value=p.delivery_type;
 f.elements.price_cop.value=p.price_cop;f.elements.old_price_cop.value=p.old_price_cop??"";f.elements.stock_quantity.value=p.stock_quantity==null?"":p.stock_quantity;f.elements.sort_order.value=p.sort_order??100;
 f.elements.description.value=p.description||"";f.elements.features.value=(p.features||[]).join("\n");
 f.elements.tag.value=p.tag||"";f.elements.shipping.value=p.shipping||"";f.elements.is_active.checked=!!p.is_active;
 editingImages=(p.images||[]).filter(Boolean).slice();editingVideo=p.video_url||null;f.elements.images.value="";f.elements.video.value="";
 f.dataset.dirty="0";
 $("#adminFormTitle").textContent="Editar producto #"+p.id;
 $("#resetAdminForm").textContent="Cancelar edición";
 renderCurrentMedia();
 openProductEditor(p.id);
}
function resetForm(){
 const form=$("#adminProductForm");
 form.reset();form.elements.id.value="";form.elements.stock_quantity.value="";form.elements.sort_order.value="100";form.elements.is_active.checked=true;
 form.dataset.dirty="0";editingImages=[];editingVideo=null;
 $("#adminFormTitle").textContent="Añadir nuevo producto";
 $("#resetAdminForm").textContent="Limpiar";
 renderCurrentMedia();
}
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
  const wasEditing=!!f.elements.id.value;
  resetForm();
  if(wasEditing)closeProductEditor(true);
  await loadProducts();
 }catch(err){status(err.message||"No se pudo guardar el producto.","error");}
 finally{submit.disabled=false;submit.textContent="Guardar producto";}
}
async function deactivate(id){if(!confirm("¿Ocultar este producto de la tienda? El historial de pedidos se conservará."))return;try{await call({action:"deactivate",id});status("Producto ocultado de la tienda.","success");await loadProducts();}catch(e){status(e.message||"No se pudo ocultar el producto.","error");}}
async function init(){
 const productForm=$("#adminProductForm");
 productForm.addEventListener("submit",save);
 productForm.addEventListener("input",()=>{if(productForm.elements.id.value)productForm.dataset.dirty="1";});
 productForm.addEventListener("change",event=>{
  if(productForm.elements.id.value)productForm.dataset.dirty="1";
  if(event.target===productForm.elements.video)renderCurrentMedia();
 });
 $("#closeProductEditor")?.addEventListener("click",()=>closeProductEditor());
 $("#productEditorModal")?.addEventListener("click",event=>{if(event.target.id==="productEditorModal")closeProductEditor();});
 document.addEventListener("keydown",event=>{if(event.key==="Escape")closeProductEditor();});$("#resetAdminForm").addEventListener("click",resetForm);$("#refreshAdminProducts").addEventListener("click",loadProducts);$("#refreshAdminMetrics")?.addEventListener("click",loadProducts);
 $("#refreshAdminOrders")?.addEventListener("click",()=>loadAdminOrders(true));
 $("#filterAdminOrders")?.addEventListener("click",()=>loadAdminOrders(true));
 $("#adminOrderStatusFilter")?.addEventListener("change",()=>loadAdminOrders(true));
 $("#adminOrderSearch")?.addEventListener("input",renderAdminOrders);
 $("#loadMoreOrders")?.addEventListener("click",()=>loadAdminOrders(false));
 $("#adminInviteForm")?.addEventListener("submit",inviteUser);$("#refreshAdminUsers")?.addEventListener("click",loadAdminUsers);
 if(!db?.isConfigured?.()){status("Supabase no está conectado.","error");return;}
 const {data}=await db.client.auth.getSession();
 if(!data.session){status("Inicia sesión con una cuenta autorizada para administrar NovaShop.","error");return;}
 try{const me=await call({action:"whoami"});currentRole=me.role;configureRolePanels();}
 catch(e){status(e.message||"Tu cuenta no tiene permisos de administración.","error");return;}
 await loadProducts();
 if(["owner","admin"].includes(currentRole)){await Promise.all([loadAdminUsers(),loadAdminOrders(true)]);}
 db.client.auth.onAuthStateChange((_event,s)=>{if(!s){products=[];adminUsers=[];renderProducts();status("Sesión cerrada.","error");location.href="cuenta.html?tab=login";}});
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})();