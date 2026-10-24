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
const isUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

function defaultKey(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed.default === "string" ? parsed.default : undefined;
  } catch {
    return undefined;
  }
}
function sha256Hex(input: string): Promise<string> {
  return crypto.subtle.digest("SHA-256", new TextEncoder().encode(input)).then((digest) =>
    Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")
  );
}
function statusFromOrder(order: any): string {
  if (order?.payment_status === "approved" || ["paid", "preparing", "shipped", "delivered"].includes(order?.status)) return "approved";
  if (order?.payment_status === "rejected" || order?.status === "payment_failed") return "rejected";
  if (order?.payment_status === "refunded" || order?.status === "refunded") return "refunded";
  if (order?.payment_status === "cancelled" || order?.status === "cancelled") return "cancelled";
  return "pending";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método no permitido." }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const publicKey = defaultKey(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS")) || Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = defaultKey(Deno.env.get("SUPABASE_SECRET_KEYS")) || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const boldApiKey = Deno.env.get("BOLD_API_KEY") || "";
    const boldSecretKey = Deno.env.get("BOLD_SECRET_KEY") || "";
    const siteUrl = (Deno.env.get("NOVASHOP_SITE_URL") || "https://adrianmarin05.github.io/novashop").replace(/\/+$/, "");

    if (!supabaseUrl || !publicKey || !serviceKey) {
      console.error("bold-payments: faltan variables de entorno de Supabase.");
      return json({ error: "La integración de pagos no está configurada correctamente en Supabase." }, 500);
    }
    const site = new URL(siteUrl);
    if (site.protocol !== "https:") return json({ error: "La URL pública de NovaShop debe usar HTTPS." }, 500);
    const rawBody = await req.text();
    if (rawBody.length > 12000) return json({ error: "La solicitud es demasiado grande." }, 413);
    let body: any;
    try { body = JSON.parse(rawBody); } catch { return json({ error: "El formato de la solicitud no es válido." }, 400); }
    const action = clean(body.action, 40);
    // This public preflight reveals only whether configuration exists; it never returns credentials.
    if (action === "status") return json({ ok: true, configured: Boolean(boldApiKey && boldSecretKey) });
    if (!boldApiKey || !boldSecretKey) {
      return json({ error: "Faltan las llaves de integración de Bold en Supabase. Configura BOLD_API_KEY y BOLD_SECRET_KEY en los secretos de la función." }, 503);
    }

    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    let requester: any = null;
    if (token && token !== publicKey && token !== Deno.env.get("SUPABASE_ANON_KEY")) {
      if (token.split(".").length !== 3) return json({ error: "La sesión enviada no es válida." }, 401);
      const authClient = createClient(supabaseUrl, publicKey, { auth: { persistSession: false, autoRefreshToken: false } });
      const { data, error } = await authClient.auth.getUser(token);
      if (error || !data.user) return json({ error: "Tu sesión no es válida. Inicia sesión de nuevo." }, 401);
      requester = data.user;
    }

    if (action === "create-checkout") {
      const orderId = clean(body.order_id, 50);
      if (!isUuid(orderId)) return json({ error: "Identificador de pedido no válido." }, 400);

      const { data: order, error: orderError } = await admin.from("orders")
        .select("id,order_number,user_id,status,payment_status,payment_provider,payment_reference,currency,total_cop,customer_first_name,customer_last_name,customer_email,customer_phone")
        .eq("id", orderId).maybeSingle();
      if (orderError) throw orderError;
      if (!order) return json({ error: "No encontramos ese pedido." }, 404);
      if (order.user_id && (!requester || requester.id !== order.user_id)) {
        return json({ error: "Inicia sesión con la cuenta que realizó este pedido para pagar en línea." }, 403);
      }
      if (order.payment_provider !== "bold") {
        return json({ error: "Este pedido se registró para contraentrega y no puede convertirse a pago Bold. Si quieres pagar en línea, crea un nuevo pedido y elige Bold." }, 409);
      }
      if (order.status !== "pending_payment" || !["pending", "rejected"].includes(order.payment_status)) {
        return json({ error: "Este pedido ya no está pendiente de pago. Consulta su estado antes de crear otro pago." }, 409);
      }
      const amount = Number(order.total_cop);
      if (!Number.isSafeInteger(amount) || amount < 1000 || amount > 100000000) {
        return json({ error: "El total de este pedido no está dentro del rango válido para pagos en línea de Bold." }, 400);
      }
      if (order.currency !== "COP") return json({ error: "Solo se admiten pedidos en pesos colombianos (COP)." }, 400);

      const orderReference = String(order.id);
      const integritySignature = await sha256Hex(orderReference + String(amount) + "COP" + boldSecretKey);
      const description = ("NovaShop pedido " + clean(order.order_number, 40)).slice(0, 120);
      const redirectionUrl = siteUrl + "/pago.html";

      const { data: payableOrder, error: updateError } = await admin.from("orders").update({
        payment_provider: "bold",
        payment_reference: orderReference,
        preferred_payment_method: "Pago en línea con Bold",
        updated_at: new Date().toISOString(),
      }).eq("id", order.id).eq("status", "pending_payment").select("id").maybeSingle();
      if (updateError) throw updateError;
      if (!payableOrder) return json({ error: "El pedido ya no está pendiente de pago. Actualiza la tienda y revisa su estado." }, 409);

      const customerData: Record<string, string> = {};
      const fullName = clean([order.customer_first_name, order.customer_last_name].filter(Boolean).join(" "), 100);
      if (fullName) customerData.fullName = fullName;
      if (order.customer_email) customerData.email = clean(order.customer_email, 120);
      if (order.customer_phone) {
        customerData.phone = clean(order.customer_phone.replace(/^\+?57/, ""), 20);
        customerData.dialCode = "+57";
      }

      return json({
        ok: true,
        order: { id: order.id, order_number: order.order_number, total_cop: amount },
        config: {
          orderId: orderReference,
          currency: "COP",
          amount: String(amount),
          apiKey: boldApiKey,
          integritySignature,
          description,
          redirectionUrl,
          ...(Object.keys(customerData).length ? { customerData: JSON.stringify(customerData) } : {}),
        },
      }, 200);
    }

    if (action === "verify-checkout") {
      const orderId = clean(body.order_id, 50);
      if (!isUuid(orderId)) return json({ error: "La referencia recibida de Bold no es válida." }, 400);

      const { data: order, error: orderError } = await admin.from("orders")
        .select("id,order_number,user_id,status,payment_status,payment_provider,payment_reference,currency,total_cop")
        .eq("id", orderId).maybeSingle();
      if (orderError) throw orderError;
      if (!order) return json({ error: "No encontramos el pedido asociado a esta transacción." }, 404);
      if (order.payment_provider !== "bold") return json({ error: "Este pedido no tiene un intento de pago Bold registrado." }, 409);
      const localStatus = statusFromOrder(order);
      if (localStatus === "approved" || localStatus === "refunded" || localStatus === "cancelled") {
        return json({ ok: true, status: localStatus, order_number: order.order_number, message: localStatus === "approved" ? "El pedido figura con pago aprobado." : "El pedido está cerrado; consulta con NovaShop si necesitas ayuda." });
      }

      const boldResponse = await fetch("https://payments.api.bold.co/v2/payment-voucher/" + encodeURIComponent(orderId), {
        method: "GET",
        headers: { "Authorization": "x-api-key " + boldApiKey, "Accept": "application/json" },
      });
      const remote = await boldResponse.json().catch(() => ({}));
      if (!boldResponse.ok) {
        console.error("bold-payments: Bold devolvió HTTP " + boldResponse.status + " al consultar una transacción.");
        return json({ error: "Bold aún no permite consultar esta transacción. Vuelve a intentarlo en unos minutos.", status: "pending", order_number: order.order_number }, 502);
      }

      const transaction = remote?.payload ?? remote;
      const providerStatus = clean(transaction?.payment_status, 40).toUpperCase();
      if (!providerStatus || providerStatus === "NO_TRANSACTION_FOUND" || providerStatus === "PROCESSING" || providerStatus === "PENDING") {
        return json({ ok: true, status: "pending", order_number: order.order_number, provider_status: providerStatus || "PENDING", message: "Bold todavía no confirma un resultado definitivo. El pedido sigue pendiente." });
      }
      if (String(transaction?.reference_id ?? "") !== orderId) {
        console.error("bold-payments: referencia del proveedor distinta de la referencia del pedido.");
        return json({ error: "La referencia consultada no coincide con el pedido. No hemos cambiado su estado." }, 409);
      }
      if (Number(transaction?.total) !== Number(order.total_cop) || String(order.currency) !== "COP") {
        console.error("bold-payments: el monto o la moneda consultados no coinciden con el pedido.");
        return json({ error: "El monto confirmado por Bold no coincide con el pedido. No hemos cambiado su estado; contacta a soporte." }, 409);
      }

      let nextStatus: string | null = null;
      let nextPaymentStatus: string | null = null;
      if (providerStatus === "APPROVED") {
        nextStatus = "paid";
        nextPaymentStatus = "approved";
      } else if (["REJECTED", "FAILED"].includes(providerStatus)) {
        nextStatus = "payment_failed";
        nextPaymentStatus = "rejected";
      } else if (providerStatus === "VOIDED") {
        nextStatus = "cancelled";
        nextPaymentStatus = "cancelled";
      } else {
        return json({ ok: true, status: "pending", order_number: order.order_number, provider_status: providerStatus, message: "Bold aún no devuelve un estado final de la transacción." });
      }

      const patch: Record<string, unknown> = {
        status: nextStatus,
        payment_status: nextPaymentStatus,
        payment_provider: "bold",
        payment_reference: clean(transaction?.transaction_id || orderId, 100),
        updated_at: new Date().toISOString(),
      };
      const { error: updateError } = await admin.from("orders").update(patch)
        .eq("id", order.id).eq("status", "pending_payment").neq("payment_status", "approved").select("id").maybeSingle();
      if (updateError) throw updateError;

      const { data: latest, error: latestError } = await admin.from("orders")
        .select("id,order_number,status,payment_status").eq("id", order.id).single();
      if (latestError) throw latestError;
      const finalStatus = statusFromOrder(latest);
      return json({
        ok: true,
        status: finalStatus,
        order_number: latest.order_number,
        provider_status: providerStatus,
        message: finalStatus === "approved" ? "Pago verificado y pedido actualizado." : finalStatus === "rejected" ? "Bold informa que el pago fue rechazado." : "No se pudo confirmar el pago.",
      });
    }

    return json({ error: "Acción no reconocida." }, 400);
  } catch (error) {
    console.error("bold-payments error:", error);
    return json({ error: "No pudimos procesar la solicitud de pago. Inténtalo de nuevo o contacta a NovaShop." }, 500);
  }
});