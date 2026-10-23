/* Admin catalog UI. Every privileged action is checked again in the server Edge Function. */
(() => {
const $=s=>document.querySelector(s), db=window.NovaShopDB;
const money=n=>new Intl.NumberFormat("es-CO",{style:"currency",currency:"COP",maximumFractionDigits:0}).format(Number(n)||0);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
let products=[], editingImages=[], editingVideo=null;
function status(text,kind="info"){const el=$("#adminStatus");el.textContent=text;el.className="admin-status "+kind;}
function formData(){const f=$("#adminProductForm"),v=new FormData(f);return {id:v.get("id")?Number(v.get("id")):null,name:String(v.get("name")||"").trim(),category:String(v.get("category")||""),delivery_type:v.get("delivery_type"),price_cop:Number(v.get("price_cop")),old_price_cop:v.get("old_price_cop")?Number(v.get("old_price_cop")):null,description:String(v.get("description")||"").trim(),features:String(v.get("features")||"").split("\n").map(s=>s.trim()).filter(Boolean),images:editingImages.slice(),video_url:editingVideo,tag:String(v.get("tag")||"").trim(),shipping:String(v.get("shipping")||"").trim(),is_active:!!f.elements.is_active.checked,sort_order:v.get("id")?Number(v.get("id")):100};}
async function call(body){if(!db?.isConfigured?.())throw new Error("Supabase no está conectado.");return db.adminCall(body);}
async function upload(file){const signed=await call({action:"upload-url",filename:file.name,contentType:file.type,size:file.size});const {error}=await db.client.storage.from("products-media").uploadToSignedUrl(signed.path,signed.token,file,{contentType:file.type,upsert:false});if(error)throw error;return signed.publicUrl;}
async function loadProducts(){
 try{const r=await call({action:"list"});products=r.products||[];renderProducts();status("Sesión lista. El servidor confirmó permisos administrativos.","success");}
 catch(e){products=[];renderProducts();status(e.message||"No se pudo cargar el catálogo.", "error");}
}
function renderProducts(){
 const box=$("#adminProductList");if(!products.length){box.innerHTML='<p class="admin-help">No hay productos o tu cuenta no está autorizada. Inicia sesión y solicita el permiso de administrador al propietario de la tienda.</p>';return;}
 box.innerHTML=products.map(p=>'<article class="admin-product"><img src="'+esc((p.images||[])[0]||"images/streaming-placeholder.svg")+'" alt=""><div><h3>'+esc(p.name)+'</h3><p>'+money(p.price_cop)+' · '+esc(p.category)+'</p><small>#'+p.id+' · '+(p.is_active?'Visible':'Oculto')+(p.video_url?' · tiene video':'')+'</small></div><div class="admin-actions"><button type="button" data-edit="'+p.id+'">Editar</button>'+(p.is_active?'<button type="button" data-off="'+p.id+'">Ocultar</button>':'')+'</div></article>').join("");
 box.querySelectorAll("[data-edit]").forEach(b=>b.addEventListener("click",()=>editProduct(Number(b.dataset.edit))));
 box.querySelectorAll("[data-off]").forEach(b=>b.addEventListener("click",()=>deactivate(Number(b.dataset.off))));
}
function editProduct(id){
 const p=products.find(x=>x.id===id);if(!p)return;const f=$("#adminProductForm");
 f.elements.id.value=p.id;f.elements.name.value=p.name;f.elements.category.value=p.category;f.elements.delivery_type.value=p.delivery_type;
 f.elements.price_cop.value=p.price_cop;f.elements.old_price_cop.value=p.old_price_cop||"";
 f.elements.description.value=p.description||"";f.elements.features.value=(p.features||[]).join("\n");
 f.elements.tag.value=p.tag||"";f.elements.shipping.value=p.shipping||"";f.elements.is_active.checked=!!p.is_active;
 editingImages=(p.images||[]).slice();editingVideo=p.video_url||null;f.elements.images.value="";f.elements.video.value="";
 $("#adminFormTitle").textContent="Editar producto #"+p.id;window.scrollTo({top:0,behavior:"smooth"});
}
function resetForm(){ $("#adminProductForm").reset();$("#adminProductForm").elements.id.value="";$("#adminProductForm").elements.is_active.checked=true;editingImages=[];editingVideo=null;$("#adminFormTitle").textContent="Añadir nuevo producto";}
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
 $("#adminProductForm").addEventListener("submit",save);$("#resetAdminForm").addEventListener("click",resetForm);$("#refreshAdminProducts").addEventListener("click",loadProducts);
 if(!db?.isConfigured?.()){status("Supabase no está conectado.","error");return;}
 const {data}=await db.client.auth.getSession();
 if(!data.session){status("Inicia sesión con tu cuenta y verifica que el propietario la haya habilitado como administradora.","error");return;}
 await loadProducts();
 db.client.auth.onAuthStateChange((_event,s)=>{if(!s){products=[];renderProducts();status("Sesión cerrada.","error");}});
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})();