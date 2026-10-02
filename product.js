const money = (n) => new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: CONFIG.currency,
  maximumFractionDigits: 0
}).format(n);

const params = new URLSearchParams(window.location.search);
const productId = Number(params.get('id'));
const currentProduct = products.find(p => p.id === productId) || products[0];

const $ = (selector) => document.querySelector(selector);
let quantity = 1;

function cartData() {
  return JSON.parse(localStorage.getItem('novashop-cart') || '[]');
}

function saveCart(cart) {
  localStorage.setItem('novashop-cart', JSON.stringify(cart));
}

function updateCartCount() {
  const count = cartData().reduce((sum, item) => sum + item.qty, 0);
  $('#productCartCount').textContent = count;
}

function showToast(message) {
  const toast = $('#productToast');
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(window.__productToast);
  window.__productToast = setTimeout(() => toast.classList.remove('show'), 1800);
}

function addCurrentProduct(amount = quantity) {
  const cart = cartData();
  const existing = cart.find(item => item.id === currentProduct.id);

  if (existing) {
    existing.qty += amount;
  } else {
    cart.push({
      id: currentProduct.id,
      name: currentProduct.name,
      price: currentProduct.price,
      image: currentProduct.images[0],
      qty: amount
    });
  }

  saveCart(cart);
  updateCartCount();
  showToast(`${currentProduct.name} añadido al carrito`);
}

function cleanField(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function renderProductCheckoutSummary() {
  const total = currentProduct.price * quantity;
  const summary = $('#productCheckoutSummary');
  if (!summary) return;
  summary.innerHTML = `
    <div class="checkout-summary-title"><strong>🛍️ Tu compra</strong><span>${quantity} ${quantity === 1 ? 'unidad' : 'unidades'}</span></div>
    <ul class="checkout-summary-list">
      <li>${currentProduct.name} ×${quantity} — <strong>${money(total)}</strong></li>
    </ul>
    <div class="checkout-summary-total"><span>Subtotal de productos</span><strong>${money(total)}</strong></div>
  `;
}

function openProductCheckout() {
  renderProductCheckoutSummary();
  const modal = $('#productCheckoutModal');
  modal.classList.add('show');
  modal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  window.setTimeout(() => $('#productCheckoutForm input[name="firstName"]')?.focus(), 50);
}

function closeProductCheckout() {
  const modal = $('#productCheckoutModal');
  modal.classList.remove('show');
  modal.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}

function buildProductWhatsAppMessage(data) {
  const subtotal = currentProduct.price * quantity;

  const I = {
    wave: '\u{1F44B}',
    bag: '\u{1F6CD}',
    package: '\u{1F4E6}',
    user: '\u{1F464}',
    phone: '\u{1F4F1}',
    email: '\u{1F4E7}',
    pin: '\u{1F4CD}',
    house: '\u{1F3E0}',
    note: '\u{1F4DD}',
    card: '\u{1F4B3}',
    check: '\u{2705}',
    pray: '\u{1F64F}'
  };

  return [
    `${I.wave} Hola, ${data.firstName}! Quiero comprar este producto en ${CONFIG.storeName}.`,
    '',
    '━━━━━━━━━━━━━━━━━━━━',
    `${I.bag} *MI COMPRA*`,
    '━━━━━━━━━━━━━━━━━━━━',
    `1. ${currentProduct.name}`,
    `   Cantidad: ${quantity}`,
    `   Precio: ${money(currentProduct.price)} c/u`,
    `   Total: ${money(subtotal)}`,
    '',
    `${I.package} *Subtotal:* ${money(subtotal)}`,
    '',
    '━━━━━━━━━━━━━━━━━━━━',
    `${I.user} *DATOS DEL CLIENTE*`,
    '━━━━━━━━━━━━━━━━━━━━',
    `Nombre: ${data.firstName} ${data.lastName}`,
    `${I.phone} Teléfono / WhatsApp: ${data.phone}`,
    data.email ? `${I.email} Correo: ${data.email}` : null,
    '',
    '━━━━━━━━━━━━━━━━━━━━',
    `${I.pin} *DIRECCIÓN DE ENTREGA*`,
    '━━━━━━━━━━━━━━━━━━━━',
    `${I.house} Dirección: ${data.address}`,
    `Barrio: ${data.neighborhood}`,
    `Ciudad / Municipio: ${data.city}`,
    `Departamento: ${data.department}`,
    data.postalCode ? `Código postal: ${data.postalCode}` : null,
    data.reference ? `${I.note} Referencia: ${data.reference}` : null,
    '',
    '━━━━━━━━━━━━━━━━━━━━',
    `${I.card} *MÉTODO DE PAGO*`,
    '━━━━━━━━━━━━━━━━━━━━',
    `${data.paymentMethod}`,
    '',
    '━━━━━━━━━━━━━━━━━━━━',
    `${I.check} *POR FAVOR, CONFIRMAR*`,
    '━━━━━━━━━━━━━━━━━━━━',
    '• Disponibilidad del producto',
    '• Costo de envío',
    '• Tiempo estimado de entrega',
    '',
    `${I.pray} ¡Muchas gracias! Quedo atento a su confirmación.`
  ].filter(Boolean).join('\n');
}

function submitProductCheckout(event) {
  event.preventDefault();
  const form = event.currentTarget;
  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }

  const raw = new FormData(form);
  const data = {
    firstName: cleanField(raw.get('firstName')),
    lastName: cleanField(raw.get('lastName')),
    phone: cleanField(raw.get('phone')),
    email: cleanField(raw.get('email')),
    address: cleanField(raw.get('address')),
    neighborhood: cleanField(raw.get('neighborhood')),
    city: cleanField(raw.get('city')),
    department: cleanField(raw.get('department')),
    postalCode: cleanField(raw.get('postalCode')),
    reference: cleanField(raw.get('reference')),
    paymentMethod: cleanField(raw.get('paymentMethod'))
  };

  const text = buildProductWhatsAppMessage(data);
  const url = `https://wa.me/${CONFIG.whatsapp}?text=${encodeURIComponent(text)}`;
  closeProductCheckout();
  window.open(url, '_blank', 'noopener,noreferrer');
}

function renderProduct() {
  document.title = `${currentProduct.name} — ${CONFIG.storeName}`;

  $('#breadcrumbCategory').textContent = currentProduct.category;
  $('#breadcrumbProduct').textContent = currentProduct.name;
  $('#breadcrumbCategory').href = 'index.html#productos';

  $('#productCategory').textContent = currentProduct.category.toUpperCase();
  $('#productName').textContent = currentProduct.name;
  $('#productRating').textContent = currentProduct.rating.toFixed(1);
  $('#productReviews').textContent = `(${currentProduct.reviews} reseñas)`;
  $('#productPrice').textContent = money(currentProduct.price);
  $('#productOldPrice').textContent = currentProduct.oldPrice ? money(currentProduct.oldPrice) : '';
  $('#productDiscount').textContent = currentProduct.oldPrice ? currentProduct.tag : '';
  $('#productDescription').textContent = currentProduct.description;
  $('#longDescription').textContent = currentProduct.description;
  $('#productShipping').textContent = currentProduct.shipping;
  $('#productTag').textContent = currentProduct.tag;

  const stars = '★'.repeat(Math.round(currentProduct.rating)) + '☆'.repeat(5 - Math.round(currentProduct.rating));
  $('#productRatingStars').textContent = stars;

  $('#productMainImage').src = currentProduct.images[0];
  $('#productMainImage').alt = currentProduct.name;

  $('#productThumbnails').innerHTML = currentProduct.images.map((image, index) => `
    <button class="thumbnail ${index === 0 ? 'active' : ''}" type="button" data-index="${index}" aria-label="Ver imagen ${index + 1}">
      <img src="${image}" alt="${currentProduct.name} imagen ${index + 1}">
    </button>
  `).join('');

  document.querySelectorAll('.thumbnail').forEach(button => {
    button.addEventListener('click', () => {
      const index = Number(button.dataset.index);
      $('#productMainImage').src = currentProduct.images[index];
      document.querySelectorAll('.thumbnail').forEach(item => item.classList.remove('active'));
      button.classList.add('active');
    });
  });

  $('#productFeatures').innerHTML = currentProduct.features.map(item => `<li>✓ ${item}</li>`).join('');
}

$('#qtyMinus').addEventListener('click', () => {
  quantity = Math.max(1, quantity - 1);
  $('#quantityValue').textContent = quantity;
});

$('#qtyPlus').addEventListener('click', () => {
  quantity += 1;
  $('#quantityValue').textContent = quantity;
});

$('#addProductToCart').addEventListener('click', () => addCurrentProduct());
$('#buyNow').addEventListener('click', openProductCheckout);
$('#productCheckoutClose').addEventListener('click', closeProductCheckout);
$('#productCheckoutModal').addEventListener('click', (event) => {
  if (event.target.id === 'productCheckoutModal') closeProductCheckout();
});
$('#productCheckoutForm').addEventListener('submit', submitProductCheckout);

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeProductCheckout();
});

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') updateCartCount();
});

renderProduct();
updateCartCount();
