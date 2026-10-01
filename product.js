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

function buyNow() {
  const subtotal = currentProduct.price * quantity;
  const text = `Hola, quiero comprar este producto en ${CONFIG.storeName}:\n\n• ${currentProduct.name} x${quantity} — ${money(subtotal)}\n\n¿Me confirman disponibilidad, envío y formas de pago?`;
  window.open(`https://wa.me/${CONFIG.whatsapp}?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
}

function renderProduct() {
  document.title = `${currentProduct.name} — ${CONFIG.storeName}`;

  $('#breadcrumbCategory').textContent = currentProduct.category;
  $('#breadcrumbProduct').textContent = currentProduct.name;
  $('#breadcrumbCategory').href = `index.html#productos`;

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
$('#buyNow').addEventListener('click', buyNow);

renderProduct();
updateCartCount();
