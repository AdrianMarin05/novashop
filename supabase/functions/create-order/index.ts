import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: corsHeaders });
const clean = (value: unknown, max = 180) =>
  String(value ?? "").trim().replace(/\s+/g, " ").slice(0, max);
const emailOk = (value: string) => !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

function defaultKey(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed.default === "string" ? parsed.default : undefined;
  } catch {
    return undefined;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método no permitido." }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const publicKey =
      defaultKey(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS")) ||
      Deno.env.get("SUPABASE_ANON_KEY");
    const secretKey =
      defaultKey(Deno.env.get("SUPABASE_SECRET_KEYS")) ||
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !publicKey || !secretKey) {
      console.error("Supabase Edge Function missing required environment variables.");
      return json({ error: "La función de pedidos no está configurada correctamente en Supabase." }, 500);
    }

    const rawBody = await req.text();
    if (rawBody.length > 24000) return json({ error: "El pedido es demasiado grande." }, 413);
    let body: any;
    try { body = JSON.parse(rawBody); } catch { return json({ error: "El formato del pedido no es válido." }, 400); }

    const c = body?.customer ?? {};
    const firstName = clean(c.firstName, 60);
    const lastName = clean(c.lastName, 60);
    const email = clean(c.email, 120).toLowerCase();
    const phone = clean(c.phone, 24);
    const address = clean(c.address, 160);
    const neighborhood = clean(c.neighborhood, 80);
    const city = clean(c.city, 80);
    const department = clean(c.department, 80);
    const postalCode = clean(c.postalCode, 16);
    const reference = clean(c.reference, 220);
    const paymentMethod = clean(c.paymentMethod, 80);
    const latitude = c.latitude == null || c.latitude === "" ? null : Number(c.latitude);
    const longitude = c.longitude == null || c.longitude === "" ? null : Number(c.longitude);
    const coordsProvided = latitude !== null || longitude !== null;
    if (coordsProvided && (latitude === null || longitude === null || !Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180)) {
      return json({ error: "Las coordenadas de entrega no son válidas. Selecciona de nuevo el punto en el mapa." }, 400);
    }
    const itemsInput = body?.items;

    if (!firstName || !lastName || phone.length < 7 || !emailOk(email)) {
      return json({ error: "Revisa nombres, apellidos, teléfono y correo." }, 400);
    }
    if (!Array.isArray(itemsInput) || itemsInput.length < 1 || itemsInput.length > 25) {
      return json({ error: "El pedido debe contener entre 1 y 25 productos distintos." }, 400);
    }
    const items = itemsInput.map((x: any) => ({
      product_id: Number(x?.product_id),
      quantity: Number(x?.quantity),
    }));
    if (items.some((x: any) => !Number.isInteger(x.product_id) || !Number.isInteger(x.quantity) || x.quantity < 1 || x.quantity > 10)) {
      return json({ error: "Hay productos o cantidades no válidos." }, 400);
    }
    if (new Set(items.map((x: any) => x.product_id)).size !== items.length) {
      return json({ error: "Hay productos duplicados en el pedido." }, 400);
    }
    if (items.reduce((n: number, x: any) => n + x.quantity, 0) > 50) {
      return json({ error: "La cantidad total excede el límite por pedido." }, 400);
    }

    // A guest may use the public key. If a customer sends a JWT, verify it with Auth.
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    let userId: string | null = null;
    if (token && token !== publicKey && token !== Deno.env.get("SUPABASE_ANON_KEY")) {
      if (token.split(".").length !== 3) return json({ error: "La autorización enviada no es válida." }, 401);
      const authClient = createClient(supabaseUrl, publicKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data: userData, error: userError } = await authClient.auth.getUser(token);
      if (userError || !userData.user) {
        return json({ error: "Tu sesión no es válida. Inicia sesión de nuevo o continúa como invitado." }, 401);
      }
      userId = userData.user.id;
    }

    const admin = createClient(supabaseUrl, secretKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Mild anti-duplicate protection per email. It does not replace payment-provider fraud controls.
    if (email) {
      const since = new Date(Date.now() - 60_000).toISOString();
      const { count, error: recentError } = await admin
        .from("orders").select("id", { count: "exact", head: true })
        .eq("customer_email", email).gt("created_at", since);
      if (recentError) throw recentError;
      if ((count ?? 0) >= 5) return json({ error: "Recibimos varios pedidos seguidos con ese correo. Espera un minuto y vuelve a intentarlo." }, 429);
    }

    const ids = items.map((x: any) => x.product_id);
    const { data: catalog, error: catalogError } = await admin
      .from("products").select("id,name,price_cop,delivery_type,is_active")
      .in("id", ids).eq("is_active", true);
    if (catalogError) throw catalogError;
    if (!catalog || catalog.length !== ids.length) {
      return json({ error: "Uno de los productos ya no está disponible." }, 409);
    }

    const catalogById = new Map(catalog.map((p: any) => [p.id, p]));
    let subtotal = 0;
    const lines = items.map((item: any) => {
      const p: any = catalogById.get(item.product_id);
      subtotal += Number(p.price_cop) * item.quantity;
      return {
        product_id: p.id, product_name: p.name, unit_price_cop: p.price_cop,
        quantity: item.quantity, delivery_type: p.delivery_type,
      };
    });
    if (!Number.isSafeInteger(subtotal) || subtotal <= 0 || subtotal > 100_000_000) {
      return json({ error: "No se pudo validar el total del pedido." }, 400);
    }
    const types = new Set(lines.map((l: any) => l.delivery_type));
    const deliveryType = types.size > 1 ? "mixed" : lines[0].delivery_type;
    if (types.has("physical") && (!address || !neighborhood || !city || !department)) {
      return json({ error: "Completa la dirección, barrio, ciudad y departamento para productos físicos." }, 400);
    }

    const { data: order, error: orderError } = await admin.from("orders").insert({
      user_id: userId,
      status: "pending_payment",
      payment_status: "pending",
      currency: "COP",
      subtotal_cop: subtotal,
      delivery_type: deliveryType,
      customer_first_name: firstName,
      customer_last_name: lastName,
      customer_email: email || null,
      customer_phone: phone,
      latitude,
      longitude,
      address: address || null,
      neighborhood: neighborhood || null,
      city: city || null,
      department: department || null,
      postal_code: postalCode || null,
      delivery_reference: reference || null,
      preferred_payment_method: paymentMethod || null,
    }).select("id,order_number,status,payment_status,subtotal_cop,created_at").single();
    if (orderError) throw orderError;

    const orderLines = lines.map((line: any) => ({ ...line, order_id: order.id }));
    const { error: linesError } = await admin.from("order_items").insert(orderLines);
    if (linesError) {
      await admin.from("orders").delete().eq("id", order.id);
      throw linesError;
    }

    return json({
      ok: true,
      order: {
        id: order.id, order_number: order.order_number, status: order.status,
        payment_status: order.payment_status, subtotal_cop: order.subtotal_cop,
        created_at: order.created_at,
      },
      message: "Pedido guardado con estado pendiente de pago. El pedido no se considera pagado hasta integrar y verificar el proveedor de pagos.",
    }, 201);
  } catch (error) {
    console.error("create-order error:", error);
    return json({ error: "No pudimos registrar el pedido en la base de datos. Inténtalo de nuevo o contacta a soporte." }, 500);
  }
});
