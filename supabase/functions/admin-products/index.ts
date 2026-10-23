import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
};
const respond = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers });
const clean = (v: unknown, max = 300) => String(v ?? "").trim().slice(0, max);
const defaultKey = (raw: string | undefined) => {
  if (!raw) return undefined;
  try { const x = JSON.parse(raw); return typeof x.default === "string" ? x.default : undefined; }
  catch { return undefined; }
};
const allowedMedia = new Set(["image/jpeg","image/png","image/webp","image/avif","image/gif","video/mp4","video/webm","video/quicktime"]);
const validPublicMedia = (u: unknown) => {
  if (!u) return true;
  try {
    const url = new URL(String(u));
    return url.protocol === "https:" && (
      url.hostname.endsWith(".supabase.co") && url.pathname.includes("/storage/v1/object/public/products-media/")
      || url.hostname === "images.unsplash.com"
    );
  } catch { return false; }
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return respond({ error: "Método no permitido." }, 405);
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const publishable = defaultKey(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS")) || Deno.env.get("SUPABASE_ANON_KEY");
    const secret = defaultKey(Deno.env.get("SUPABASE_SECRET_KEYS")) || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !publishable || !secret) return respond({ error: "La función administrativa no está configurada." }, 500);
    const bearer = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    if (!bearer || bearer === publishable || bearer === Deno.env.get("SUPABASE_ANON_KEY")) {
      return respond({ error: "Inicia sesión con tu cuenta administrativa." }, 401);
    }
    const authClient = createClient(url, publishable, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: authData, error: authError } = await authClient.auth.getUser(bearer);
    if (authError || !authData.user) return respond({ error: "La sesión no es válida." }, 401);

    const admin = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: adminRow, error: adminError } = await admin.from("store_admins")
      .select("user_id").eq("user_id", authData.user.id).maybeSingle();
    if (adminError) throw adminError;
    if (!adminRow) return respond({ error: "Tu cuenta aún no tiene permisos de administrador. El propietario de NovaShop debe asignarlos desde Supabase." }, 403);

    const raw = await req.text();
    if (raw.length > 150000) return respond({ error: "La solicitud excede el tamaño permitido." }, 413);
    let body: any;
    try { body = JSON.parse(raw); } catch { return respond({ error: "El formato de la solicitud no es válido." }, 400); }
    const action = clean(body.action, 40);

    if (action === "list") {
      const { data, error } = await admin.from("products").select("*").order("sort_order").order("id");
      if (error) throw error;
      return respond({ ok: true, products: data || [] });
    }

    if (action === "upload-url") {
      const filename = clean(body.filename, 130).replace(/[^a-zA-Z0-9._-]/g, "_");
      const contentType = clean(body.contentType, 80);
      const size = Number(body.size);
      if (!filename || !allowedMedia.has(contentType)) return respond({ error: "Tipo de archivo no permitido. Usa JPG, PNG, WEBP, GIF, AVIF, MP4, WEBM o MOV." }, 400);
      const limit = contentType.startsWith("video/") ? 50 * 1024 * 1024 : 12 * 1024 * 1024;
      if (!Number.isFinite(size) || size <= 0 || size > limit) return respond({ error: contentType.startsWith("video/") ? "Cada video debe pesar máximo 50 MB." : "Cada imagen debe pesar máximo 12 MB." }, 400);
      const ext = filename.includes(".") ? filename.split(".").pop() : "bin";
      const path = "products/" + authData.user.id + "/" + crypto.randomUUID() + "." + ext;
      const { data, error } = await admin.storage.from("products-media").createSignedUploadUrl(path);
      if (error) throw error;
      const publicUrl = admin.storage.from("products-media").getPublicUrl(path).data.publicUrl;
      return respond({ ok: true, path, token: data.token, publicUrl });
    }

    if (action === "save") {
      const id = body.id ? Number(body.id) : null;
      const name = clean(body.name, 140);
      const category = clean(body.category, 70);
      const price = Number(body.price_cop);
      const oldPrice = body.old_price_cop === "" || body.old_price_cop == null ? null : Number(body.old_price_cop);
      const delivery = body.delivery_type === "digital" ? "digital" : "physical";
      const description = clean(body.description, 4000);
      const features = Array.isArray(body.features) ? body.features.map((v: unknown) => clean(v, 160)).filter(Boolean).slice(0, 20) : [];
      const images = Array.isArray(body.images) ? body.images.map((v: unknown) => clean(v, 700)).filter(validPublicMedia).slice(0, 8) : [];
      const video = clean(body.video_url, 700) || null;
      const active = body.is_active !== false;
      if (id !== null && (!Number.isSafeInteger(id) || id < 1)) return respond({ error: "El ID del producto no es válido." }, 400);
      if (name.length < 2 || !category || !Number.isSafeInteger(price) || price < 1 || price > 100000000) return respond({ error: "Revisa nombre, categoría y precio del producto." }, 400);
      if (oldPrice !== null && (!Number.isSafeInteger(oldPrice) || oldPrice <= price || oldPrice > 100000000)) return respond({ error: "El precio anterior debe ser mayor que el precio actual." }, 400);
      if (images.length < 1) return respond({ error: "Sube al menos una imagen para el producto." }, 400);
      if (images.some(u => !validPublicMedia(u)) || (video && !validPublicMedia(video))) return respond({ error: "Las fotos y videos deben proceder del almacenamiento aprobado de NovaShop." }, 400);
      const row = {
        name, category, price_cop: price, old_price_cop: category === "Streaming" ? null : oldPrice,
        delivery_type: delivery, description, features, images, video_url: video,
        rating: body.rating == null || body.rating === "" ? null : Math.min(5, Math.max(0, Number(body.rating))),
        reviews: Math.min(1000000, Math.max(0, Math.trunc(Number(body.reviews) || 0))),
        tag: category === "Streaming" ? "DIGITAL" : (oldPrice ? clean(body.tag || "OFERTA", 30) : clean(body.tag || "NUEVO", 30)),
        shipping: clean(body.shipping, 500), sort_order: Math.trunc(Number(body.sort_order) || 100),
        is_active: active, updated_at: new Date().toISOString()
      };
      const query = id !== null
        ? admin.from("products").update(row).eq("id", id).select("*").single()
        : admin.from("products").insert(row).select("*").single();
      const { data, error } = await query;
      if (error) throw error;
      return respond({ ok: true, product: data }, 200);
    }

    if (action === "deactivate") {
      const id = Number(body.id);
      if (!Number.isSafeInteger(id) || id < 1) return respond({ error: "ID no válido." }, 400);
      const { data, error } = await admin.from("products").update({ is_active: false, updated_at: new Date().toISOString() }).eq("id", id).select("id,name,is_active").single();
      if (error) throw error;
      return respond({ ok: true, product: data });
    }
    return respond({ error: "Acción no reconocida." }, 400);
  } catch (error) {
    console.error("admin-products error:", error);
    return respond({ error: "No se pudo completar la operación administrativa." }, 500);
  }
});