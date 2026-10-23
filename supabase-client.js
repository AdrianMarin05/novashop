/* Supabase client shared by static pages. Browser only receives a publishable key. */
(() => {
 const cfg=window.NOVASHOP_SUPABASE_CONFIG||{},key=cfg.publishableKey||"";
 const configured=/^https:\/\//.test(cfg.url||"")&&key.startsWith("sb_publishable_");
 let client=null;
 if(configured&&window.supabase?.createClient)client=window.supabase.createClient(cfg.url,key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
 async function createOrder(customer,items){
  if(!client)throw new Error("La base de datos no está conectada.");
  const {data:{session}}=await client.auth.getSession(),token=session?.access_token||key;
  const response=await fetch(cfg.url.replace(/\/$/,"")+(cfg.functionsPath||"/functions/v1/create-order"),{
   method:"POST",headers:{"Content-Type":"application/json","apikey":key,"Authorization":"Bearer "+token},
   body:JSON.stringify({customer,items})
  });
  const result=await response.json().catch(()=>({}));
  if(!response.ok||!result.ok)throw new Error(result.error||"No se pudo registrar el pedido.");
  return result.order;
 }
 async function syncCatalog(localProducts){
  if(!client||!Array.isArray(localProducts))return localProducts;
  const {data,error}=await client.from("products").select("*").eq("is_active",true).order("sort_order");
  if(error||!data)return localProducts;
  for(const row of data){
   let local=localProducts.find(p=>Number(p.id)===Number(row.id));
   const images=(row.images||[]).filter(Boolean);
   if(local){
    local.name=row.name;local.category=row.category;local.price=Number(row.price_cop);local.deliveryType=row.delivery_type;
    if(images.length){local.images=images;local.description=row.description||local.description;local.features=row.features||local.features;local.shipping=row.shipping||local.shipping;local.videoUrl=row.video_url||null;}
    if(row.old_price_cop!=null)local.oldPrice=Number(row.old_price_cop);
    else if(row.category==="Streaming")local.oldPrice=null;
    local.tag=row.category==="Streaming"?"DIGITAL":(row.old_price_cop!=null?(row.tag||"OFERTA"):(row.tag||local.tag||"DESTACADO"));
    local.sortOrder=row.sort_order;
   }else{
    localProducts.push({id:Number(row.id),name:row.name,category:row.category,price:Number(row.price_cop),
     oldPrice:row.old_price_cop==null?null:Number(row.old_price_cop),rating:row.rating==null?null:Number(row.rating),
     reviews:Number(row.reviews)||0,tag:row.category==="Streaming"?"DIGITAL":(row.old_price_cop!=null?(row.tag||"OFERTA"):(row.tag||"NUEVO")),
     images:images.length?images:["images/streaming-placeholder.svg"],description:row.description||"",
     features:row.features||[],shipping:row.shipping||"",videoUrl:row.video_url||null,
     deliveryType:row.delivery_type,sortOrder:row.sort_order});
   }
  }
  return localProducts;
 }
 async function prefillCheckout(form){
  if(!client||!form)return;
  const {data:{session}}=await client.auth.getSession();if(!session?.user)return;
  const {data:p}=await client.from("profiles").select("*").eq("id",session.user.id).maybeSingle();if(!p)return;
  const put=(name,value)=>{const el=form.elements[name];if(el&&value!=null&&value!==""&&!el.value)el.value=value;};
  const names=String(p.full_name||"").trim().split(/\s+/);put("firstName",names.shift()||"");put("lastName",names.join(" "));put("fullName",p.full_name);
  for(const [name,value] of [["phone",p.phone],["email",p.email||session.user.email],["address",p.address],["neighborhood",p.neighborhood],
   ["city",p.city],["department",p.department],["postalCode",p.postal_code],["reference",p.delivery_reference],["deliveryReference",p.delivery_reference],
   ["latitude",p.latitude],["longitude",p.longitude]])put(name,value);
  form.dispatchEvent(new Event("novashop:profile-prefilled"));
 }
 async function adminCall(body){
  if(!client)throw new Error("Supabase no está conectado.");
  const {data:{session}}=await client.auth.getSession();if(!session)throw new Error("Inicia sesión con tu cuenta administrativa.");
  const {data,error}=await client.functions.invoke("admin-products",{body,headers:{Authorization:"Bearer "+session.access_token}});
  if(error)throw error;if(data?.error)throw new Error(data.error);return data;
 }
 window.NovaShopDB={isConfigured:()=>configured&&!!client,client,getSession:async()=>client?(await client.auth.getSession()).data.session:null,createOrder,syncCatalog,prefillCheckout,adminCall};
})();
