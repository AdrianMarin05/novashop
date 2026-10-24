(() => {
  const $ = (selector) => document.querySelector(selector);
  const statusBox = $("#boldStatus");
  const variables = $("#boldVariables");
  const environment = $("#boldEnvironment");
  const button = $("#boldRefresh");
  const labels = {
    BOLD_API_KEY: "BOLD_API_KEY — llave de identidad de Bold",
    BOLD_SECRET_KEY: "BOLD_SECRET_KEY — llave secreta de Bold",
    BOLD_ENVIRONMENT: "BOLD_ENVIRONMENT — test o live"
  };

  async function check() {
    const cfg = window.NOVASHOP_SUPABASE_CONFIG || {};
    const apiKey = cfg.publishableKey || "";
    const baseUrl = String(cfg.url || "").replace(/\/+$/, "");
    button.disabled = true;
    button.textContent = "Comprobando…";
    statusBox.className = "bold-status";
    statusBox.textContent = "Consultando la función segura de Supabase…";
    variables.hidden = true;
    environment.textContent = "";
    try {
      if (!/^https:\/\//.test(baseUrl) || !apiKey) {
        throw new Error("No se encontró la configuración pública de Supabase en esta página.");
      }
      const response = await fetch(baseUrl + "/functions/v1/bold-payments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": apiKey,
          "Authorization": "Bearer " + apiKey
        },
        body: JSON.stringify({ action: "status" })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.ok !== true || !Array.isArray(data.missing)) {
        throw new Error(data.error || "La función de diagnóstico no respondió con el formato esperado.");
      }
      variables.replaceChildren();
      const allNames = ["BOLD_API_KEY", "BOLD_SECRET_KEY", "BOLD_ENVIRONMENT"];
      for (const name of allNames) {
        const missing = data.missing.includes(name);
        const li = document.createElement("li");
        const label = document.createElement("span");
        label.textContent = labels[name];
        const badge = document.createElement("span");
        badge.className = "bold-pill " + (missing ? "bad" : "ok");
        badge.textContent = missing ? "Falta" : "Detectada";
        li.append(label, badge);
        variables.appendChild(li);
      }
      variables.hidden = false;
      if (data.configured === true) {
        statusBox.className = "bold-status ok";
        statusBox.textContent = "Supabase detecta las tres variables de configuración de Bold.";
      } else {
        statusBox.className = "bold-status bad";
        statusBox.textContent = "La configuración está incompleta. Agrega las variables que aparecen como «Falta» en Supabase → Edge Functions → Secrets.";
      }
      environment.textContent = "Ambiente detectado: " + (data.environment || "no válido o no configurado") + ".";
    } catch (error) {
      statusBox.className = "bold-status error";
      statusBox.textContent = error?.message || "No pudimos consultar la configuración. Vuelve a intentarlo.";
    } finally {
      button.disabled = false;
      button.textContent = "Comprobar de nuevo";
    }
  }
  button.addEventListener("click", check);
  check();
})();