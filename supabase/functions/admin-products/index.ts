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
    const {data:grant,error:grantError} = await admin.from("store_admins").select("user_id").eq("user_id",user.id).maybeSingle();
    if (grantError) throw grantError;
    if (!grant) return json({error:"Esta cuenta todavía no tiene permisos de administración."},403,origin);

    const raw = await req.text();
    if (raw.length > 1_500_000) return json({error:"La solicitud excede el tamaño permitido."},413,origin);
    let body: any;
    try { body = JSON.parse(raw); } catch { return json({error:"Solicitud JSON no válida."},400,origin); }
    const action = String(body?.action || "");

    if (action === "whoami") return json({ok:true,isAdmin:true,userId:user.id,email:user.email || null},200,origin);

    if (action === "list") {
      const {data,error} = await admin.from("products").select("*").order("sort_order",{ascending:true}).order("id",{ascending:true});
      if (error) throw error;
      return json({ok:true,products:data || []},200,origin);
    }

    if (action === "upload-url") {
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
      if (!name || !category || !description) return json({error:"Completa nombre, categoría y descripción."},400,origin);
      if (!Number.isSafeInteger(price) || price <= 0 || price > 100_000_000) return json({error:"El precio no es válido."},400,origin);
      if (oldPrice !== null && (!Number.isSafeInteger(oldPrice) || oldPrice < price || oldPrice > 100_000_000)) return json({error:"El precio anterior debe ser mayor o igual al precio actual."},400,origin);
      if (!["physical","digital"].includes(delivery)) return json({error:"El tipo de entrega no es válido."},400,origin);
      if (images.length < 1 || images.some((v: string)=>!safeMediaUrl(v,supabaseUrl,true))) return json({error:"Añade al menos una imagen válida de Supabase Storage o Unsplash."},400,origin);
      if (video && !safeMediaUrl(video,supabaseUrl,false)) return json({error:"El video debe estar alojado en el bucket de medios de NovaShop."},400,origin);
      if (id !== null && (!Number.isInteger(id) || id <= 0)) return json({error:"Identificador de producto no válido."},400,origin);

      const payload = {
        name,category,delivery_type:delivery,price_cop:price,old_price_cop:oldPrice,
        description,features,images,video_url:video,tag,shipping,is_active:active,sort_order:sortOrder,updated_at:new Date().toISOString()
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
