/* NovaShop Supabase client for static HTML pages. No private keys belong here. */
(() => {
  const cfg = window.NOVASHOP_SUPABASE_CONFIG || {};
  const key = cfg.publishableKey || cfg.anonKey || "";
  const configured = /^https:\/\//.test(cfg.url || "") && key.length > 20 &&
    !String(cfg.url).includes("TU-PROYECTO") && !key.includes("TU_SUPABASE");
  let client = null;
  if (configured && window.supabase?.createClient) {
    client = window.supabase.createClient(cfg.url, key, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
  }
  async function createOrder(customer, items) {
    if (!configured || !client) throw new Error("La base de datos aún no está conectada.");
    const { data: { session } } = await client.auth.getSession();
    const token = session?.access_token || key;
    const response = await fetch(cfg.url.replace(/\/$/, "") + (cfg.functionsPath || "/functions/v1/create-order"), {
      method: "POST",
      headers: { "Content-Type": "application/json", "apikey": key, "Authorization": "Bearer " + token },
      body: JSON.stringify({ customer, items })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.ok) throw new Error(result.error || "No se pudo registrar el pedido.");
    return result.order;
  }
  window.NovaShopDB = {
    isConfigured: () => configured && !!client,
    client,
    getSession: async () => client ? (await client.auth.getSession()).data.session : null,
    createOrder
  };
})();
