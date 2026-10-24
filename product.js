const money = (n) => new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: CONFIG.currency,
  maximumFractionDigits: 0
}).format(n);

const params = new URLSearchParams(window.location.search);
const productId = Number(params.get('id'));
let currentProduct = products.find(p => p.id === productId) || products[0];

const $ = (selector) => document.querySelector(selector);
let quantity = 1;
let productFavoriteIds = new Set();

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
  if(currentProduct.stockQuantity!=null&&Number(currentProduct.stockQuantity)<=0){showToast('Este producto está agotado');return;}
  if(existing&&currentProduct.stockQuantity!=null&&existing.qty+amount>Number(currentProduct.stockQuantity)){showToast('No hay más unidades disponibles');return;}
  if(existing) {
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


function escProduct(value){return String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
async function refreshProductFavorite(){
 const button=$("#toggleProductFavorite");if(!button)return;
 try{const ids=await window.NovaShopDB?.getFavoriteIds?.();if(Array.isArray(ids))productFavoriteIds=new Set(ids.map(Number));}
 catch(e){console.warn("Favoritos:",e);}
 const saved=productFavoriteIds.has(Number(currentProduct.id));button.textContent=saved?"♥ Guardado en favoritos":"♡ Guardar en favoritos";button.classList.toggle("is-favorite",saved);button.setAttribute("aria-pressed",String(saved));
}
async function toggleCurrentProductFavorite(){
 const button=$("#toggleProductFavorite");if(!button)return;
 try{
  let ids=await window.NovaShopDB?.toggleFavorite?.(Number(currentProduct.id));
  if(!Array.isArray(ids)){const next=new Set(productFavoriteIds);next.has(Number(currentProduct.id))?next.delete(Number(currentProduct.id)):next.add(Number(currentProduct.id));productFavoriteIds=next;localStorage.setItem("novashop-favorites-v1",JSON.stringify([...next]));}
  else productFavoriteIds=new Set(ids.map(Number));
  refreshProductFavorite();showToast(productFavoriteIds.has(Number(currentProduct.id))?"Añadido a favoritos":"Quitado de favoritos");
 }catch(e){showToast(e.message||"No pudimos actualizar favoritos.");}
}
function reviewHint(text,kind="info"){const el=$("#productReviewHint");if(!el)return;el.textContent=text;el.className="account-message "+kind;el.hidden=!text;}
async function loadProductReviews(){
 const client=window.NovaShopDB?.client,box=$("#productReviewsList"),form=$("#productReviewForm"),summary=$("#productReviewSummary");
 if(!box)return;
 let session=null;
 try{session=await window.NovaShopDB?.getSession?.();}catch(_){}
 let reviews=[];
 if(client){
  const {data,error}=await client.from("product_reviews").select("id,user_id,rating,title,body,is_approved,created_at").eq("product_id",Number(currentProduct.id)).order("created_at",{ascending:false}).limit(100);
  if(error){box.innerHTML='<div class="favorites-empty">No pudimos cargar las reseñas. Inténtalo de nuevo más tarde.</div>';console.warn("Reseñas:",error.message);}
  else reviews=data||[];
 }
 const published=reviews.filter(r=>r.is_approved);
 const own=session?.user?reviews.find(r=>r.user_id===session.user.id):null;
 const mean=published.length?published.reduce((sum,r)=>sum+Number(r.rating||0),0)/published.length:0;
 const ratingRow=document.querySelector(".rating-row");
 if(ratingRow){
  ratingRow.hidden=!published.length;
  $("#productRating").textContent=published.length?mean.toFixed(1):"";
  $("#productReviews").textContent=published.length?"("+published.length+" reseñas)":"";
  $("#productRatingStars").textContent=published.length?("★".repeat(Math.round(mean))+"☆".repeat(5-Math.round(mean))):"";
 }
 if(summary)summary.textContent=published.length?published.length+" reseñas publicadas · Promedio "+mean.toFixed(1)+" de 5 estrellas.":"Todavía no hay reseñas publicadas de este producto.";
 box.innerHTML=reviews.length?reviews.filter(r=>r.is_approved||(session?.user&&r.user_id===session.user.id)).map(r=>'<article class="product-review-card"><div class="product-review-card-head"><div><strong>'+escProduct(r.title||"Opinión de comprador")+'</strong><div class="product-review-meta">'+escProduct(r.user_id===session?.user?.id?"Tu reseña":"Comprador verificado")+' · '+escProduct(new Date(r.created_at).toLocaleDateString("es-CO"))+'</div></div><span class="product-review-stars">'+("★".repeat(Number(r.rating)||0))+("☆".repeat(5-(Number(r.rating)||0)))+'</span></div><p>'+escProduct(r.body)+'</p>'+(r.user_id===session?.user?.id&&!r.is_approved?'<small class="admin-help">Pendiente de revisión antes de publicarse.</small>':"")+'</article>').join(""):'<div class="favorites-empty"><h2>Tu opinión puede ser la primera</h2><p>Cuando haya reseñas aprobadas aparecerán aquí.</p></div>';
 if(!form)return;
 if(!session?.user){form.hidden=true;reviewHint("Inicia sesión con tu cuenta para escribir una reseña. Solo se aceptan reseñas de pedidos entregados.");return;}
 if(own){form.hidden=true;reviewHint(own.is_approved?"Ya publicaste una reseña de este producto.":"Ya recibimos tu reseña; está pendiente de revisión.","success");return;}
 let eligible=false;
 try{
  const {data:orders}=await client.from("orders").select("id").eq("user_id",session.user.id).eq("status","delivered").limit(100);
  const orderIds=(orders||[]).map(o=>o.id);
  if(orderIds.length){
   const {data:items}=await client.from("order_items").select("product_id").eq("product_id",Number(currentProduct.id)).in("order_id",orderIds).limit(1);
   eligible=!!items?.length;
  }
 }catch(e){console.warn("No se pudo comprobar la entrega para reseñas:",e.message);}
 form.hidden=!eligible;
 reviewHint(eligible?"Tu pedido fue entregado. Deja una reseña; se publicará tras la revisión de NovaShop.":"Podrás escribir una reseña cuando una compra de este producto figure como entregada.","info");
}
async function submitProductReview(event){
 event.preventDefault();
 const form=event.currentTarget;if(!form.reportValidity())return;
 const session=await window.NovaShopDB?.getSession?.(),client=window.NovaShopDB?.client;
 if(!session?.user||!client){reviewHint("Inicia sesión para dejar una reseña.","error");return;}
 const raw=new FormData(form),button=form.querySelector('[type="submit"]');
 button.disabled=true;button.textContent="Enviando…";
 try{
  const {error}=await client.from("product_reviews").insert({product_id:Number(currentProduct.id),user_id:session.user.id,rating:Number(raw.get("rating")),title:cleanField(raw.get("title")),body:cleanField(raw.get("body"))});
  if(error){if(error.code==="23505")throw new Error("Ya enviaste una reseña para este producto.");throw error;}
  form.reset();reviewHint("Gracias. Tu reseña quedó pendiente de revisión y se mostrará cuando sea aprobada.","success");await loadProductReviews();
 }catch(e){reviewHint(e.message||"No se pudo enviar la reseña. Verifica que el pedido esté entregado.","error");}
 finally{button.disabled=false;button.textContent="Enviar reseña";}
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
  const deliveryFields=$('#productDeliveryFields');if(deliveryFields)deliveryFields.hidden=currentProduct.deliveryType==='digital';
  window.NovaShopDB?.prefillCheckout?.($('#productCheckoutForm')).catch(err=>console.warn('Perfil no precargado:',err));
  window.NovaShopDeliveryMaps?.invalidate('productCheckoutMap');
  window.setTimeout(() => $('#productCheckoutForm input[name="firstName"]')?.focus(), 50);
}

function closeProductCheckout() {
  const modal = $('#productCheckoutModal');
  modal.classList.remove('show');
  modal.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}

function buildProductWhatsAppMessage(data, orderInfo={}) {
  const order=typeof orderInfo==='string'?{order_number:orderInfo}:(orderInfo||{});
  const orderNumber=order.order_number||'';
  const subtotal = currentProduct.price * quantity;
  const discount=Math.max(0,Number(order.discount_cop)||0);
  const finalTotal=order.total_cop!=null?Number(order.total_cop):Math.max(0,subtotal-discount);

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
    orderNumber ? `🧾 Número de pedido: ${orderNumber} (pendiente de pago)` : null,
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
    order.coupon_code ? `🎟️ Cupón aplicado: ${order.coupon_code}` : null,
    discount>0 ? `Descuento: -${money(discount)}` : null,
    `*Total tras descuento:* ${money(finalTotal)}`,
    '',
    '━━━━━━━━━━━━━━━━━━━━',
    `${I.user} *DATOS DEL CLIENTE*`,
    '━━━━━━━━━━━━━━━━━━━━',
    `Nombre: ${data.firstName} ${data.lastName}`,
    `${I.phone} Teléfono / WhatsApp: ${data.phone}`,
    data.email ? `${I.email} Correo: ${data.email}` : null,
    ...(currentProduct.deliveryType==='digital'
      ? ['', '━━━━━━━━━━━━━━━━━━━━', '📩 *ENTREGA DIGITAL*', 'No requiere dirección física.', '']
      : ['', '━━━━━━━━━━━━━━━━━━━━', `${I.pin} *DIRECCIÓN DE ENTREGA*`, '━━━━━━━━━━━━━━━━━━━━',
         `${I.house} Dirección: ${data.address}`, `Barrio: ${data.neighborhood}`,
         `Ciudad / Municipio: ${data.city}`, `Departamento: ${data.department}`,
         data.postalCode ? `Código postal: ${data.postalCode}` : null,
         data.reference ? `${I.note} Referencia: ${data.reference}` : null,
    data.latitude && data.longitude ? `📍 Ubicación: https://maps.google.com/?q=${data.latitude},${data.longitude}` : null, '']),
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

async function submitProductCheckout(event) {
  event.preventDefault();
  const form=event.currentTarget;
  if(!form.checkValidity()){form.reportValidity();return;}
  const raw=new FormData(form);
  const data={
    firstName:cleanField(raw.get('firstName')),lastName:cleanField(raw.get('lastName')),
    phone:cleanField(raw.get('phone')),email:cleanField(raw.get('email')),
    address:cleanField(raw.get('address')),neighborhood:cleanField(raw.get('neighborhood')),
    city:cleanField(raw.get('city')),department:cleanField(raw.get('department')),
    postalCode:cleanField(raw.get('postalCode')),reference:cleanField(raw.get('reference')),
    paymentMethod:cleanField(raw.get('paymentMethod')),
    couponCode:cleanField(raw.get('couponCode')).toUpperCase(),
    latitude:cleanField(raw.get('latitude')),longitude:cleanField(raw.get('longitude'))
  };
  if(currentProduct.deliveryType!=='digital' && (!data.address || !data.neighborhood || !data.city || !data.department)){
    showToast('Para productos físicos, completa dirección, barrio, ciudad y departamento.');
    return;
  }
  // Pre-open WhatsApp during the click to avoid browser popup blocking after the async database call.
  const whatsappTab=window.open('about:blank','_blank');
  let savedOrder=null;
  if(window.NovaShopDB?.isConfigured?.()){
    const button=form.querySelector('button[type="submit"]');
    if(button){button.disabled=true;button.textContent='Guardando pedido…';}
    try{
      savedOrder=await window.NovaShopDB.createOrder(data,[{product_id:Number(currentProduct.id),quantity:Number(quantity)}]);
    }catch(error){
      whatsappTab?.close();
      showToast(error?.message||'No pudimos guardar el pedido. Inténtalo de nuevo.');
      if(button){button.disabled=false;button.textContent='💬 Continuar a WhatsApp';}
      return;
    }finally{if(button){button.disabled=false;button.textContent='💬 Continuar a WhatsApp';}}
  }
  const text=buildProductWhatsAppMessage(data,savedOrder||{});
  const url=`https://wa.me/${CONFIG.whatsapp}?text=${encodeURIComponent(text)}`;
  closeProductCheckout();
  window.open(url,'_blank','noopener,noreferrer');
}

function renderProduct() {
  document.title = `${currentProduct.name} — ${CONFIG.storeName}`;

  $('#breadcrumbCategory').textContent = currentProduct.category;
  $('#breadcrumbProduct').textContent = currentProduct.name;
  $('#breadcrumbCategory').href = currentProduct.category === 'Streaming' ? 'streaming.html' : `index.html?category=${encodeURIComponent(currentProduct.category)}#productos`;

  $('#productCategory').textContent = currentProduct.category.toUpperCase();
  $('#productName').textContent = currentProduct.name;
  const hasRatings = Number.isFinite(currentProduct.rating) && Number(currentProduct.reviews) > 0;
  const ratingRow = document.querySelector('.rating-row');
  if(ratingRow) ratingRow.hidden = !hasRatings;
  $('#productRating').textContent = hasRatings ? Number(currentProduct.rating).toFixed(1) : '';
  $('#productReviews').textContent = hasRatings ? `(${currentProduct.reviews} reseñas)` : '';
  $('#productPrice').textContent = money(currentProduct.price);
  $('#productOldPrice').textContent = currentProduct.oldPrice ? money(currentProduct.oldPrice) : '';
  $('#productDiscount').textContent = currentProduct.oldPrice ? currentProduct.tag : '';
  $('#productDescription').textContent = currentProduct.description;
  $('#longDescription').textContent = currentProduct.description;
  $('#productShipping').textContent = currentProduct.shipping;
  $('#productTag').textContent = currentProduct.category === 'Streaming' ? 'SERVICIO DIGITAL' : currentProduct.tag;

  const stars = '★'.repeat(Math.round(currentProduct.rating)) + '☆'.repeat(5 - Math.round(currentProduct.rating));
  $('#productRatingStars').textContent = stars;

  const mainImage=$('#productMainImage'),mainVideo=$('#productMainVideo');
  mainImage.hidden=false;mainImage.src=currentProduct.images?.[0]||'images/streaming-placeholder.svg';mainImage.alt=currentProduct.name;
  mainVideo.pause();mainVideo.hidden=true;mainVideo.removeAttribute('src');mainVideo.load();
  if(currentProduct.videoUrl){mainVideo.src=currentProduct.videoUrl;}
  $('#productThumbnails').innerHTML = (currentProduct.images||[]).map((image,index)=>`
    <button class="thumbnail ${index===0?'active':''}" type="button" data-index="${index}" aria-label="Ver imagen ${index+1}">
      <img src="${image}" alt="${currentProduct.name} imagen ${index+1}">
    </button>`).join('') + (currentProduct.videoUrl ? '<button class="thumbnail video-thumbnail" type="button" data-video="true" aria-label="Reproducir video del producto"><span>▶</span><small>Ver video</small></button>' : '');
  document.querySelectorAll('.thumbnail').forEach(button=>{
    button.addEventListener('click',()=>{
      document.querySelectorAll('.thumbnail').forEach(item=>item.classList.remove('active'));
      button.classList.add('active');
      if(button.dataset.video==='true'){
        mainImage.hidden=true;mainVideo.hidden=false;mainVideo.play().catch(()=>{});
      }else{
        mainVideo.pause();mainVideo.hidden=true;mainImage.hidden=false;
        const imageIndex=Number(button.dataset.index);mainImage.src=currentProduct.images[imageIndex];
      }
    });
  });

  $('#productFeatures').innerHTML = currentProduct.features.map(item => `<li>✓ ${item}</li>`).join('');
}

$('#qtyMinus').addEventListener('click', () => {
  quantity = Math.max(1, quantity - 1);
  $('#quantityValue').textContent = quantity;
});

$('#qtyPlus').addEventListener('click', () => {
  if(currentProduct.stockQuantity!=null&&quantity>=Number(currentProduct.stockQuantity)){showToast('No hay más unidades disponibles');return;}
  quantity += 1;
  $('#quantityValue').textContent = quantity;
});

$('#addProductToCart').addEventListener('click', () => addCurrentProduct());
$('#toggleProductFavorite')?.addEventListener('click',toggleCurrentProductFavorite);
$('#productReviewForm')?.addEventListener('submit',submitProductReview);
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
refreshProductFavorite();
loadProductReviews();
window.NovaShopDB?.syncCatalog?.(products).then(()=>{currentProduct=products.find(p=>p.id===productId)||currentProduct;renderProduct();refreshProductFavorite();loadProductReviews();}).catch(err=>console.warn('Catálogo Supabase:',err));
