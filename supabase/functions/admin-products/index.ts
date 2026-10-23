import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const BUCKET = "products-media";
const MIME_EXT: Record<string, string> = {
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp",
  "image/avif": "avif", "image/gif": "gif", "video/mp4": "mp4",
  "video/webm": "webm", "video/quicktime": "mov"
};
const IMAGE_TYPES = new Set(["image/jpeg","image/png","image/webp","image/avif","image/gif"]);
const VIDEO_TYPES = new Set(["video/mp4","video/webm","video/quicktime"]);
const json = (body: unknown, status = 200, origin = "*") =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": origin,
      "Vary": "Origin",
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-api-version",
      "Access-Control-Allow-Methods": "POST, OPTIONS"
    }
  });
const clean = (v: unknown, max = 3000) => String(v ?? "").trim().slice(0,max);
function parseKey(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  try { const x = JSON.parse(raw); return typeof x.default === "string" ? x.default : undefined; }
  catch { return undefined; }
}
function safeMediaUrl(value: unknown, supabaseUrl: string, allowExternalImage = false): boolean {
  try {
    const u = new URL(String(value));
    if (u.protocol !== "https:") return false;
    const local = u.origin === supabaseUrl && u.pathname.startsWith("/storage/v1/object/public/" + BUCKET + "/");
    const unsplash = allowExternalImage && u.hostname === "images.unsplash.com";
    return local || unsplash;
  } catch { return false; }
}
function slug(name: string) {
  return name.normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLowerCase()
    .replace(/[^a-z0-9._-]+/g,"-").replace(/^-+|-+$/g,"").slice(0,90) || "media";
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("Origin") || "*";
  if (req.method === "OPTIONS") return new Response("ok", {
    headers: {
      "Access-Control-Allow-Origin": origin, "Vary": "Origin",
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-api-version",
      "Access-Control-Allow-Methods": "POST, OPTIONS"
    }
  });
  if (req.method !== "POST") return json({error:"Método no permitido."},405,origin);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const publishable = parseKey(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS")) || Deno.env.get("SUPABASE_ANON_KEY");
    const secret = parseKey(Deno.env.get("SUPABASE_SECRET_KEYS")) || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !publishable || !secret) {
      console.error("admin-products: required Supabase environment variables are missing");
      return json({error:"El servidor administrativo no está configurado."},500,origin);
    }
    const auth = req.headers.get("Authorization") || "";
    const token = auth.replace(/^Bearer\s+/i,"");
    if (!token || token === publishable || token.split(".").length !== 3) {
      return json({error:"Inicia sesión para acceder al panel de administración."},401,origin);
    }
    const admin = createClient(supabaseUrl, secret, {auth:{persistSession:false,autoRefreshToken:false}});
    const {data:userResult,error:userError} = await admin.auth.getUser(token);
    if (userError || !userResult.user) return json({error:"Tu sesión no es válida. Inicia sesión de nuevo."},401,origin);
    const user = userResult.user;
    const {data:roleRecord,error:roleError} = await admin.from("store_user_roles").select("role").eq("user_id",user.id).maybeSingle();
    if (roleError) throw roleError;
    const {data:legacyGrant,error:grantError} = await admin.from("store_admins").select("user_id").eq("user_id",user.id).maybeSingle();
    if (grantError) throw grantError;
    const role = roleRecord?.role || (legacyGrant ? "owner" : null);
    if (!role || role === "customer") return json({error:"Esta cuenta no tiene permisos para el panel administrativo."},403,origin);
    const isOwner = role === "owner";
    const canManageUsers = isOwner || role === "admin";
    const canEditCatalog = isOwner || role === "admin" || role === "catalog_manager";
    const canSeeMetrics = isOwner || role === "admin" || role === "analyst";

    const raw = await req.text();
    if (raw.length > 1_500_000) return json({error:"La solicitud excede el tamaño permitido."},413,origin);
    let body: any;
    try { body = JSON.parse(raw); } catch { return json({error:"Solicitud JSON no válida."},400,origin); }
    const action = String(body?.action || "");

    if (action === "whoami") return json({ok:true,isAdmin:true,userId:user.id,email:user.email || null,role},200,origin);

    if (action === "list-users") {
      if (!canManageUsers) return json({error:"Solo owner/admin pueden administrar usuarios y roles."},403,origin);
      const allUsers:any[] = [];
      for (let page = 1; page <= 10; page++) {
        const {data,error} = await admin.auth.admin.listUsers({page,perPage:200});
        if (error) throw error;
        const batch = data?.users || [];
        allUsers.push(...batch);
        if (batch.length < 200) break;
      }
      const ids = allUsers.map((u:any)=>u.id);
      if (!ids.length) return json({ok:true,users:[]},200,origin);
      const [rolesResult,profilesResult,legacyResult] = await Promise.all([
        admin.from("store_user_roles").select("user_id,role,created_at").in("user_id",ids),
        admin.from("profiles").select("id,full_name,username,phone").in("id",ids),
        admin.from("store_admins").select("user_id").in("user_id",ids)
      ]);
      if (rolesResult.error) throw rolesResult.error;
      if (profilesResult.error) throw profilesResult.error;
      if (legacyResult.error) throw legacyResult.error;
      const roleMap = new Map((rolesResult.data||[]).map((x:any)=>[x.user_id,x.role]));
      const profileMap = new Map((profilesResult.data||[]).map((x:any)=>[x.id,x]));
      const legacy = new Set((legacyResult.data||[]).map((x:any)=>x.user_id));
      const users = allUsers.map((u:any)=>{
        const p:any = profileMap.get(u.id) || {};
        return {id:u.id,email:u.email || null,phone:u.phone || p.phone || null,
          full_name:p.full_name || u.user_metadata?.full_name || "",
          username:p.username || "",role:roleMap.get(u.id) || (legacy.has(u.id)?"owner":"customer"),
          created_at:u.created_at,last_sign_in_at:u.last_sign_in_at || null,
          email_confirmed:!!u.email_confirmed_at,phone_confirmed:!!u.phone_confirmed_at};
      });
      return json({ok:true,users},200,origin);
    }

    if (action === "invite-user") {
      if (!canManageUsers) return json({error:"Solo owner/admin pueden crear usuarios."},403,origin);
      const email = clean(body.email,120).toLowerCase();
      const fullName = clean(body.full_name,100);
      const wantedRole = clean(body.role,30);
      if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)) return json({error:"Introduce un correo válido."},400,origin);
      if (!fullName) return json({error:"Introduce el nombre del usuario."},400,origin);
      if (!["admin","catalog_manager","analyst","customer"].includes(wantedRole)) return json({error:"Selecciona un rol válido."},400,origin);
      if (wantedRole === "admin" && !isOwner) return json({error:"Solo el propietario puede conceder el rol admin."},403,origin);
      const {data:inviteData,error:inviteError} = await admin.auth.admin.inviteUserByEmail(email,{
        data:{full_name:fullName},
        redirectTo:"https://adrianmarin05.github.io/novashop/cuenta.html"
      });
      if (inviteError) throw inviteError;
      const newUser = inviteData?.user;
      if (!newUser?.id) return json({error:"Supabase no devolvió el usuario invitado."},500,origin);
      const {error:profileError} = await admin.from("profiles").upsert({
        id:newUser.id,full_name:fullName,email,username:null,updated_at:new Date().toISOString()
      },{onConflict:"id"});
      if (profileError) throw profileError;
      const {error:roleSaveError} = await admin.from("store_user_roles").upsert({
        user_id:newUser.id,role:wantedRole,granted_by:user.id,updated_at:new Date().toISOString()
      },{onConflict:"user_id"});
      if (roleSaveError) throw roleSaveError;
      if (wantedRole === "customer") await admin.from("store_admins").delete().eq("user_id",newUser.id);
      else {
        const {error:legacySaveError} = await admin.from("store_admins").upsert({user_id:newUser.id,granted_by:user.id},{onConflict:"user_id"});
        if (legacySaveError) throw legacySaveError;
      }
      return json({ok:true,user:{id:newUser.id,email:newUser.email,full_name:fullName,role:wantedRole},message:"Invitación creada. El usuario deberá abrir el correo y completar el acceso."},201,origin);
    }

    if (action === "set-role") {
      if (!canManageUsers) return json({error:"Solo owner/admin pueden asignar roles."},403,origin);
      const targetId = clean(body.user_id,50);
      const wantedRole = clean(body.role,30);
      if (!/^[0-9a-f-]{36}$/i.test(targetId)) return json({error:"Identificador de usuario no válido."},400,origin);
      if (!["admin","catalog_manager","analyst","customer"].includes(wantedRole)) return json({error:"Selecciona un rol válido."},400,origin);
      if (wantedRole === "admin" && !isOwner) return json({error:"Solo el propietario puede conceder el rol admin."},403,origin);
      if (targetId === user.id) return json({error:"No puedes cambiar tu propio rol desde esta pantalla."},409,origin);
      const {data:targetRole,error:targetRoleError} = await admin.from("store_user_roles").select("role").eq("user_id",targetId).maybeSingle();
      if (targetRoleError) throw targetRoleError;
      const {data:targetLegacy,error:targetLegacyError} = await admin.from("store_admins").select("user_id").eq("user_id",targetId).maybeSingle();
      if (targetLegacyError) throw targetLegacyError;
      const oldRole = targetRole?.role || (targetLegacy ? "owner" : "customer");
      if (oldRole === "owner") return json({error:"El propietario está protegido; no se puede cambiar su rol desde el panel."},409,origin);
      const {error:saveError} = await admin.from("store_user_roles").upsert({
        user_id:targetId,role:wantedRole,granted_by:user.id,updated_at:new Date().toISOString()
      },{onConflict:"user_id"});
      if (saveError) throw saveError;
      if (wantedRole === "customer") {
        const {error:deleteError} = await admin.from("store_admins").delete().eq("user_id",targetId);
        if (deleteError) throw deleteError;
      } else {
        const {error:grantSaveError} = await admin.from("store_admins").upsert({user_id:targetId,granted_by:user.id},{onConflict:"user_id"});
        if (grantSaveError) throw grantSaveError;
      }
      return json({ok:true,user_id:targetId,role:wantedRole},200,origin);
    }

    if (action === "set-user-password") {
      if (!isOwner) return json({error:"Solo el propietario puede establecer contraseñas de usuarios."},403,origin);
      const targetId = clean(body.user_id,50);
      const password = typeof body.password === "string" ? body.password : "";
      if (!/^[0-9a-f-]{36}$/i.test(targetId)) return json({error:"Identificador de usuario no válido."},400,origin);
      if (targetId === user.id) return json({error:"Por seguridad, esta herramienta es solo para restablecer la contraseña de otro usuario."},409,origin);
      if (password.length < 12 || password.length > 128 || !password.trim()) return json({error:"La contraseña temporal debe tener entre 12 y 128 caracteres."},400,origin);
      const [targetRoleResult,targetLegacyResult] = await Promise.all([
        admin.from("store_user_roles").select("role").eq("user_id",targetId).maybeSingle(),
        admin.from("store_admins").select("user_id").eq("user_id",targetId).maybeSingle()
      ]);
      if (targetRoleResult.error) throw targetRoleResult.error;
      if (targetLegacyResult.error) throw targetLegacyResult.error;
      const targetRole = targetRoleResult.data?.role || (targetLegacyResult.data ? "owner" : "customer");
      if (targetRole === "owner") return json({error:"La cuenta propietaria está protegida y no se puede restablecer desde esta herramienta."},409,origin);
      const {data:updatedUser,error:updateError} = await admin.auth.admin.updateUserById(targetId,{password});
      if (updateError) throw updateError;
      if (!updatedUser?.user?.id) return json({error:"Supabase no confirmó la actualización de la contraseña."},500,origin);
      return json({ok:true,user_id:targetId,message:"Contraseña temporal actualizada."},200,origin);
    }

    if (action === "list") {
      if (!canEditCatalog && role !== "analyst") return json({error:"No tienes permiso para ver el catálogo administrativo."},403,origin);
      const {data,error} = await admin.from("products").select("*").order("sort_order",{ascending:true}).order("id",{ascending:true});
      if (error) throw error;
      return json({ok:true,products:data || []},200,origin);
    }

    if (action === "metrics") {
      if (!canSeeMetrics) return json({error:"No tienes permiso para consultar métricas de ventas."},403,origin);
      const [ordersResult, itemsResult, productsResult] = await Promise.all([
        admin.from("orders").select("id,status,payment_status,subtotal_cop,created_at").order("created_at",{ascending:false}).limit(10000),
        admin.from("order_items").select("order_id,product_id,product_name,quantity,unit_price_cop,line_total_cop").limit(50000),
        admin.from("products").select("id,name,category,stock_quantity,is_active,price_cop").order("id",{ascending:true}).limit(10000)
      ]);
      if (ordersResult.error) throw ordersResult.error;
      if (itemsResult.error) throw itemsResult.error;
      if (productsResult.error) throw productsResult.error;
      const orders = ordersResult.data || [];
      const items = itemsResult.data || [];
      const products = productsResult.data || [];
      const paidStatuses = new Set(["paid","preparing","shipped","delivered"]);
      const paidOrders = orders.filter((o: any) => o.payment_status === "approved" || paidStatuses.has(o.status));
      const paidOrderIds = new Set(paidOrders.map((o: any) => o.id));
      const revenueCop = paidOrders.reduce((n: number, o: any) => n + Number(o.subtotal_cop || 0), 0);
      const confirmedItems = items.filter((it: any) => paidOrderIds.has(it.order_id));
      const unitsSold = confirmedItems.reduce((n: number, it: any) => n + Number(it.quantity || 0), 0);
      const productById = new Map(products.map((p: any) => [Number(p.id), p]));
      const mix = new Map();
      for (const it of confirmedItems) {
        const id = Number(it.product_id);
        const p: any = productById.get(id);
        const key = String(id);
        const row: any = mix.get(key) || {productId:id,name:it.product_name || p?.name || "Producto",category:p?.category || "Otra",units:0,revenueCop:0};
        row.units += Number(it.quantity || 0);
        row.revenueCop += Number(it.line_total_cop ?? (Number(it.unit_price_cop || 0) * Number(it.quantity || 0)));
        mix.set(key,row);
      }
      const salesMix = Array.from(mix.values())
        .map((p: any) => ({...p,percentage:unitsSold ? Math.round((p.units / unitsSold) * 1000) / 10 : 0}))
        .sort((a: any,b: any) => b.units-a.units)
        .slice(0,15);
      const active = products.filter((p: any) => p.is_active);
      const tracked = active.filter((p: any) => p.stock_quantity !== null && p.stock_quantity !== undefined);
      const outOfStock = tracked.filter((p: any) => Number(p.stock_quantity) === 0);
      const lowStock = tracked.filter((p: any) => Number(p.stock_quantity) > 0 && Number(p.stock_quantity) <= 5);
      const untracked = active.filter((p: any) => p.stock_quantity === null || p.stock_quantity === undefined);
      const pendingOrders = orders.filter((o: any) => o.status === "pending_payment" || o.payment_status === "pending").length;
      return json({ok:true,metrics:{
        revenueCop,paidOrders:paidOrders.length,unitsSold,pendingOrders,
        inventory:{activeProducts:active.length,trackedProducts:tracked.length,untrackedProducts:untracked.length,
          trackedUnits:tracked.reduce((n: number,p: any)=>n+Number(p.stock_quantity||0),0),
          lowStockProducts:lowStock.map((p: any)=>({id:p.id,name:p.name,stock_quantity:p.stock_quantity})),
          outOfStockProducts:outOfStock.map((p: any)=>({id:p.id,name:p.name,stock_quantity:p.stock_quantity}))},
        salesMix
      }},200,origin);
    }

    if (action === "upload-url") {
      if (!canEditCatalog) return json({error:"No tienes permiso para subir medios de productos."},403,origin);
      const filename = clean(body.filename,180);
      const type = clean(body.contentType,100).toLowerCase();
      const size = Number(body.size);
      if (!MIME_EXT[type]) return json({error:"Tipo de archivo no permitido."},400,origin);
      if (!Number.isFinite(size) || size <= 0 || size > 50*1024*1024) return json({error:"El archivo no puede superar 50 MB."},413,origin);
      if (IMAGE_TYPES.has(type) && size > 12*1024*1024) return json({error:"Las imágenes no pueden superar 12 MB."},413,origin);
      if (VIDEO_TYPES.has(type) && size > 50*1024*1024) return json({error:"El video no puede superar 50 MB."},413,origin);
      const path = user.id + "/" + Date.now() + "-" + crypto.randomUUID() + "-" + slug(filename) + "." + MIME_EXT[type];
      const {data,error} = await admin.storage.from(BUCKET).createSignedUploadUrl(path,{upsert:false});
      if (error) throw error;
      const publicUrl = admin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
      return json({ok:true,path:data.path || path,token:data.token,publicUrl},200,origin);
    }

    if (action === "save") {
      if (!canEditCatalog) return json({error:"No tienes permiso para editar productos."},403,origin);
      const id = body.id == null || body.id === "" ? null : Number(body.id);
      const name = clean(body.name,140);
      const category = clean(body.category,80);
      const delivery = clean(body.delivery_type,20);
      const price = Number(body.price_cop);
      const oldPrice = body.old_price_cop == null || body.old_price_cop === "" ? null : Number(body.old_price_cop);
      const description = clean(body.description,4000);
      const features = Array.isArray(body.features) ? body.features.map((v: unknown)=>clean(v,180)).filter(Boolean).slice(0,30) : [];
      const images = Array.isArray(body.images) ? body.images.map((v: unknown)=>clean(v,1000)).filter(Boolean).slice(0,8) : [];
      const video = body.video_url == null || body.video_url === "" ? null : clean(body.video_url,1000);
      const tag = clean(body.tag,30);
      const shipping = clean(body.shipping,500);
      const active = body.is_active !== false;
      const sortOrder = Number.isFinite(Number(body.sort_order)) ? Math.trunc(Number(body.sort_order)) : 100;
      const stockRaw = body.stock_quantity;
      const stock = stockRaw === null || stockRaw === undefined || stockRaw === "" ? null : Number(stockRaw);
      if (!name || !category || !description) return json({error:"Completa nombre, categoría y descripción."},400,origin);
      if (!Number.isSafeInteger(price) || price <= 0 || price > 100_000_000) return json({error:"El precio no es válido."},400,origin);
      if (oldPrice !== null && (!Number.isSafeInteger(oldPrice) || oldPrice < price || oldPrice > 100_000_000)) return json({error:"El precio anterior debe ser mayor o igual al precio actual."},400,origin);
      if (stock !== null && (!Number.isSafeInteger(stock) || stock < 0 || stock > 10000000)) return json({error:"El stock debe ser un número entero entre 0 y 10.000.000, o dejarse vacío para no controlarlo."},400,origin);
      if (!["physical","digital"].includes(delivery)) return json({error:"El tipo de entrega no es válido."},400,origin);
      if (images.length < 1 || images.some((v: string)=>!safeMediaUrl(v,supabaseUrl,true))) return json({error:"Añade al menos una imagen válida de Supabase Storage o Unsplash."},400,origin);
      if (video && !safeMediaUrl(video,supabaseUrl,false)) return json({error:"El video debe estar alojado en el bucket de medios de NovaShop."},400,origin);
      if (id !== null && (!Number.isInteger(id) || id <= 0)) return json({error:"Identificador de producto no válido."},400,origin);

      const payload = {
        name,category,delivery_type:delivery,price_cop:price,old_price_cop:oldPrice,
        description,features,images,video_url:video,tag,shipping,is_active:active,sort_order:sortOrder,
        stock_quantity:stock,updated_at:new Date().toISOString()
      };
      const query = id === null
        ? admin.from("products").insert(payload).select("*").single()
        : admin.from("products").update(payload).eq("id",id).select("*").single();
      const {data,error} = await query;
      if (error) throw error;
      if (!data) return json({error:"No encontramos el producto que intentabas editar."},404,origin);
      return json({ok:true,product:data},200,origin);
    }

    if (action === "deactivate") {
      if (!canEditCatalog) return json({error:"No tienes permiso para ocultar productos."},403,origin);
      const id = Number(body.id);
      if (!Number.isInteger(id) || id <= 0) return json({error:"Identificador de producto no válido."},400,origin);
      const {data,error} = await admin.from("products").update({is_active:false,updated_at:new Date().toISOString()}).eq("id",id).select("id,name,is_active").maybeSingle();
      if (error) throw error;
      if (!data) return json({error:"No encontramos ese producto."},404,origin);
      return json({ok:true,product:data},200,origin);
    }

    return json({error:"Acción no reconocida."},400,origin);
  } catch (e) {
    console.error("admin-products error:",e);
    return json({error:"No pudimos completar la operación administrativa. Revisa la configuración y vuelve a intentarlo."},500,origin);
  }
});
