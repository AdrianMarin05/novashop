(() => {
  const $ = (selector) => document.querySelector(selector);
  const params = new URLSearchParams(window.location.search);
  // Bold returns bold-order-id. Never trust bold-tx-status alone.
  const orderId = params.get("bold-order-id") || params.get("bold_order_id") || "";
  const title = $("#paymentTitle");
  const message = $("#paymentMessage");
  const orderBox = $("#paymentOrder");
  const retry = $("#verifyPaymentAgain");

  function setView(kind, orderNumber, detail) {
    const views = {
      approved: ["¡Pago aprobado!", "Bold confirmó el pago. Tu pedido quedó registrado como pagado."],
      rejected: ["Pago no aprobado", "Bold informó que el intento de pago fue rechazado o falló. El pedido no se considera pagado."],
      cancelled: ["Pago anulado", "La transacción figura como anulada. El pedido no se considera pagado."],
      refunded: ["Pago reembolsado", "La transacción figura como reembolsada."],
      test: ["Prueba de Bold verificada", "Bold confirmó una transacción de prueba. No se cobró dinero real y NovaShop no marcó este pedido como pagado ni modificó el inventario. Cambia a las llaves de producción solo cuando termines las pruebas."],
      pending: ["Pago pendiente de confirmación", "Todavía no tenemos una confirmación definitiva de Bold. No repitas el pago inmediatamente; vuelve a consultar más tarde. La actualización puede tardar unos minutos."],
      error: ["No pudimos verificar el pago", "No conseguimos consultar el estado con Bold. El pedido no se marcará como pagado sin una verificación válida."]
    };
    const view = views[kind] || views.error;
    title.textContent = view[0];
    message.textContent = detail || view[1];
    if (orderNumber) {
      orderBox.hidden = false;
      orderBox.replaceChildren();
      const row = document.createElement("div");
      row.className = "checkout-summary-title";
      const label = document.createElement("span");
      label.textContent = "Número de pedido";
      const value = document.createElement("strong");
      value.textContent = orderNumber;
      row.append(label, value);
      orderBox.appendChild(row);
    }
    retry.hidden = ["approved", "refunded", "cancelled"].includes(kind);
  }

  async function verify() {
    if (!orderId) {
      setView("error", "", "No encontramos la referencia de la venta en la URL. Revisa Mi cuenta o contacta con NovaShop antes de realizar otro pago.");
      retry.hidden = true;
      return;
    }
    if (!window.NovaShopDB?.verifyBoldPayment) {
      setView("error", "", "No pudimos inicializar la conexión con NovaShop. Recarga la página o inténtalo más tarde.");
      return;
    }
    retry.disabled = true;
    retry.textContent = "Consultando a Bold…";
    try {
      const result = await window.NovaShopDB.verifyBoldPayment(orderId);
      const status = ["approved", "rejected", "cancelled", "refunded", "test"].includes(result.status) ? result.status : "pending";
      setView(status, result.order_number || "", result.message || "");
    } catch (error) {
      setView("error", "", error?.message || "No pudimos consultar a Bold. El pedido se mantendrá pendiente hasta recibir una confirmación válida.");
    } finally {
      retry.disabled = false;
      retry.textContent = "Verificar de nuevo";
    }
  }

  retry.addEventListener("click", verify);
  verify();
})();