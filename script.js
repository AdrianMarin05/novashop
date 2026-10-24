let cart = JSON.parse(localStorage.getItem('novashop-cart') || '[]');
const $ = (s) => document.querySelector(s);
let favoriteIds = new Set((()=>{try{return JSON.parse(localStorage.getItem("novashop-favorites-v1")||"[]").map(Number);}catch(_){return [];}})());
function refreshFavoriteIds(){window.NovaShopDB?.getFavoriteIds?.().then(ids=>{favoriteIds=new Set(ids.map(Number));if($("#productGrid"))renderProducts();}).catch(err=>console.warn("Favoritos:",err));}
async function toggleFavoriteFromButton(button){
 const id=Number(button.dataset.favorite);if(!id)return;
 try{
  const ids=await window.NovaShopDB?.toggleFavorite?.(id);
  if(ids)favoriteIds=new Set(ids.map(Number));
  else{const next=new Set(favoriteIds);next.has(id)?next.delete(id):next.add(id);favoriteIds=next;localStorage.setItem("novashop-favorites-v1",JSON.stringify([...next]));}
  renderProducts();toast(favoriteIds.has(id)?"Añadido a favoritos":"Quitado de favoritos");
 }catch(e){toast(e.message||"No pudimos actualizar los favoritos.");}
}
const money = (n) => new Intl.NumberFormat('es-CO',{style:'currency',currency:CONFIG.currency,maximumFractionDigits:0}).format(n);

function saveCart(){ localStorage.setItem('novashop-cart',JSON.stringify(cart)); }
function cartCount(){ return cart.reduce((sum,i)=>sum+i.qty,0); }
function cartTotal(){ return cart.reduce((sum,i)=>sum+i.price*i.qty,0); }
function product(id){ return products.find(p=>p.id===id); }


function renderFeaturedProduct(){
  const link=$('#featuredProductLink');
  if(!link || !Array.isArray(products) || !products.length)return;
  const cta=$('#featuredProductCta');
  if(document.body.dataset.page==='streaming'){
    link.href='streaming.html';
    link.setAttribute('aria-label','Explorar el catálogo completo de Streaming');
    $('#featuredProductImage').src='https://images.unsplash.com/photo-1522869635100-9f4c5e86aa37?auto=format&fit=crop&w=1100&q=85';
    $('#featuredProductImage').alt='Catálogo de plataformas y servicios digitales';
    $('#featuredProductBadge').textContent='CATÁLOGO';
    $('#featuredProductName').textContent='Explora las plataformas de Streaming';
    $('#featuredProductDiscount').textContent='20 servicios';
    if(cta)cta.textContent='Ver catálogo completo ↗';
    return;
  }
  const featured=products.find(p=>p.category!=='Streaming' && p.oldPrice) || products.find(p=>p.category!=='Streaming');
  if(!featured)return;
  const pct=featured.oldPrice?Math.round((1-(featured.price/featured.oldPrice))*100):0;
  link.href='producto.html?id='+featured.id;
  link.setAttribute('aria-label','Ver detalles y comprar '+featured.name);
  $('#featuredProductImage').src=(featured.images&&featured.images[0])||'';
  $('#featuredProductImage').alt=featured.name;
  $('#featuredProductBadge').textContent=featured.oldPrice?'OFERTA':'DESTACADO';
  $('#featuredProductName').textContent=featured.name;
  $('#featuredProductDiscount').textContent=featured.oldPrice?(pct+'% OFF'):'Ver producto';
  if(cta)cta.textContent='Ver detalles y comprar ↗';
}

function renderCategories(){
  const streamingPage=document.body.dataset.page==='streaming';
  const metaByName=new Map(categoryMeta.map(item=>[item.name,item]));
  const names=streamingPage?['Streaming']:[...new Set([...categoryMeta.map(item=>item.name),...products.map(item=>item.category)])];
  const visibleCategories=names.map(name=>{
    const meta=metaByName.get(name)||{};
    const count=products.filter(item=>item.category===name).length;
    return {name,image:meta.image||'images/streaming-placeholder.svg',count:name==='Streaming'?count+' servicios digitales':count+' '+(count===1?'producto':'productos')};
  });
  $('#categoryGrid').innerHTML=visibleCategories.map(c=>`<button class="category-card" data-cat="${c.name}" aria-label="Ver ${c.name}"><img src="${c.image}" alt="${c.name}" loading="lazy"><div class="category-info"><h3>${c.name}</h3><span>${c.count}</span></div></button>`).join('');
  document.querySelectorAll('.category-card').forEach(btn=>btn.addEventListener('click',()=>{if(btn.dataset.cat==='Streaming'){location.href='streaming.html';return;}$('#categoryFilter').value=btn.dataset.cat;renderProducts();document.querySelector('#productos').scrollIntoView({behavior:'smooth'});}));
}

function renderProducts(){
  const query = $('#searchInput').value.trim().toLocaleLowerCase('es').normalize('NFD').replace(/[\\u0300-\\u036f]/g,'');
  const cat = $('#categoryFilter').value;
  const sort = $('#sortSelect').value;
  const streamingPage = document.body.dataset.page === 'streaming';
  const minValue=Number($('#minPriceFilter')?.value||0),maxRaw=$('#maxPriceFilter')?.value;
  const maxValue=maxRaw==null||maxRaw===''?Infinity:Number(maxRaw);
  const hideSoldOut=!!$('#hideSoldOut')?.checked,onlyOffers=!!$('#onlyOffers')?.checked;
  let list = products.filter(p=>{
    const searchText=[p.name,p.category,p.description,p.tag,...(Array.isArray(p.features)?p.features:[])].filter(Boolean).join(' ').toLocaleLowerCase('es').normalize('NFD').replace(/[\\u0300-\\u036f]/g,'');
    return (streamingPage ? p.category==='Streaming' : p.category!=='Streaming')&&(cat==='all'||p.category===cat)&&searchText.includes(query)&&Number(p.price)>=minValue&&Number(p.price)<=maxValue&&(!hideSoldOut||p.stockQuantity==null||Number(p.stockQuantity)>0)&&(!onlyOffers||(Number(p.oldPrice)>Number(p.price)));
  });
  if(sort==='priceAsc') list.sort((a,b)=>a.price-b.price);
  if(sort==='priceDesc') list.sort((a,b)=>b.price-a.price);
  if(sort==='name') list.sort((a,b)=>a.name.localeCompare(b.name,'es'));
  $('#emptyState').hidden=list.length!==0;
  $('#productGrid').innerHTML=list.map(p=>`<article class="product-card">
    <a class="product-link" href="producto.html?id=${p.id}" aria-label="Ver ${p.name}">
      <div class="product-media"><img src="${p.images[0]}" alt="${p.name}" loading="lazy">${p.category==='Streaming'?'':(p.oldPrice?'<span class="tag">OFERTA</span>':(p.tag?'<span class="tag">'+p.tag+'</span>':''))}</div>
      <div class="product-body"><div class="category-label">${p.category}</div><div class="product-title">${p.name}</div>
        <div class="price-row"><span class="price">${money(p.price)}</span>${p.oldPrice?`<span class="old-price">${money(p.oldPrice)}</span>`:''}</div>
      </div>
    </a>
    <div class="product-actions"><button class="add-btn" data-id="${p.id}">Añadir al carrito</button></div>
  </article>`).join('');
  const grid=$('#productGrid');
  grid.querySelectorAll('.product-card').forEach((card,index)=>{
    const p=list[index];if(!p)return;
    const media=card.querySelector('.product-media');
    if(media){
      const favorite=document.createElement('button');favorite.type='button';favorite.className='favorite-toggle'+(favoriteIds.has(Number(p.id))?' is-favorite':'');
      favorite.dataset.favorite=String(p.id);favorite.setAttribute('aria-pressed',String(favoriteIds.has(Number(p.id))));
      favorite.setAttribute('aria-label',favoriteIds.has(Number(p.id))?'Quitar de favoritos':'Añadir a favoritos');favorite.textContent=favoriteIds.has(Number(p.id))?'♥':'♡';media.appendChild(favorite);
    }
    if(p.stockQuantity!=null){
      const label=document.createElement('small');label.className='stock-label'+(Number(p.stockQuantity)===0?' sold-out':'');
      label.textContent=Number(p.stockQuantity)===0?'Agotado':'Disponible: '+Number(p.stockQuantity);
      card.querySelector('.product-body')?.appendChild(label);
      const add=card.querySelector('.add-btn');if(add&&Number(p.stockQuantity)===0){add.disabled=true;add.textContent='Agotado';}
    }
  });
  grid.querySelectorAll('[data-favorite]').forEach(btn=>btn.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();toggleFavoriteFromButton(btn);}));
  document.querySelectorAll('.add-btn').forEach(btn=>btn.addEventListener('click',()=>addToCart(Number(btn.dataset.id))));
}

function addToCart(id){
  const p=product(id);if(!p)return;
  const found=cart.find(i=>i.id===id);
  if(p.stockQuantity!=null&&Number(p.stockQuantity)<=0){toast('Este producto está agotado');return;}
  if(found){if(p.stockQuantity!=null&&found.qty>=Number(p.stockQuantity)){toast('No hay más unidades disponibles');return;}found.qty++;}
  else cart.push({id:p.id,name:p.name,price:p.price,image:p.images[0],qty:1});
  saveCart(); renderCart(); openCart(); toast('Producto añadido al carrito');
}
function changeQty(id,delta){const item=cart.find(i=>i.id===id);if(!item)return;const p=product(id);if(delta>0&&p?.stockQuantity!=null&&item.qty>=Number(p.stockQuantity)){toast('No hay más unidades disponibles');return;}item.qty+=delta;if(item.qty<=0)cart=cart.filter(i=>i.id!==id);saveCart();renderCart();}
function removeItem(id){ cart=cart.filter(i=>i.id!==id); saveCart(); renderCart(); }
function renderCart(){
  $('#cartCount').textContent=cartCount();
  if(!cart.length){ $('#cartItems').innerHTML='<div class="cart-empty">Tu carrito está vacío.<br>Añade productos para comenzar.</div>'; $('#cartSubtotal').textContent=money(0); return; }
  $('#cartItems').innerHTML=cart.map(i=>`<div class="cart-item"><img src="${i.image}" alt=""><div><h4>${i.name}</h4><p>${money(i.price)} c/u</p><div class="qty-control"><button data-action="dec" data-id="${i.id}">−</button><span>${i.qty}</span><button data-action="inc" data-id="${i.id}">+</button></div></div><div><strong>${money(i.price*i.qty)}</strong><br><button class="remove" data-action="remove" data-id="${i.id}">Eliminar</button></div></div>`).join('');
  $('#cartSubtotal').textContent=money(cartTotal());
  document.querySelectorAll('#cartItems button').forEach(b=>b.addEventListener('click',()=>{ const id=Number(b.dataset.id); const a=b.dataset.action; if(a==='dec') changeQty(id,-1); if(a==='inc') changeQty(id,1); if(a==='remove') removeItem(id); }));
}

function openCart(){ $('#cartDrawer').classList.add('open'); $('#drawerOverlay').classList.add('show'); document.body.style.overflow='hidden'; }
function closeCart(){ $('#cartDrawer').classList.remove('open'); $('#drawerOverlay').classList.remove('show'); document.body.style.overflow=''; }
function toast(msg,duration=1800){ const t=$('#toast'); if(!t)return; t.textContent=msg; t.classList.add('show'); clearTimeout(window.__toast); window.__toast=setTimeout(()=>t.classList.remove('show'),duration); }

function checkoutWhatsApp(){
  if(!cart.length){ toast('Añade al menos un producto'); return; }
  renderCheckoutSummary();
  const digitalOnly=cart.every(item=>product(item.id)?.deliveryType==='digital');
  const deliveryFields=$('#cartDeliveryFields');if(deliveryFields)deliveryFields.hidden=digitalOnly;
  openCheckoutModal();
  window.NovaShopDB?.prefillCheckout?.($('#checkoutForm')).catch(err=>console.warn('Perfil no precargado:',err));
}

function renderCheckoutSummary(){
  const summary=$('#checkoutSummary');
  if(!summary) return;
  const itemCount=cartCount();
  const lines=cart.map(i=>`<li>${escapeHTML(i.name)} ×${i.qty} — <strong>${money(i.price*i.qty)}</strong></li>`).join('');
  summary.innerHTML=`<div class="checkout-summary-title"><strong>Resumen del pedido</strong><span>${itemCount} ${itemCount===1?'producto':'productos'}</span></div><ul class="checkout-summary-list">${lines}</ul><div class="checkout-summary-total"><span>Subtotal</span><strong>${money(cartTotal())}</strong></div>`;
}

function openCheckoutModal(){
  const modal=$('#checkoutModal');
  if(!modal) return;
  renderCheckoutSummary();
  modal.classList.add('show');
  modal.setAttribute('aria-hidden','false');
  document.body.style.overflow='hidden';
  const first=modal.querySelector('input[name="firstName"]');
  window.setTimeout(()=>first?.focus(),50);
}

function closeCheckoutModal(){
  const modal=$('#checkoutModal');
  if(!modal) return;
  modal.classList.remove('show');
  modal.setAttribute('aria-hidden','true');
  document.body.style.overflow='';
}

function escapeHTML(value){
  return String(value).replace(/[&<>"']/g, char=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[char]));
}

function cleanField(value){
  return String(value||'').trim().replace(/\s+/g,' ');
}

function buildWhatsAppMessage(data, orderInfo={}){
  const order=typeof orderInfo==='string'?{order_number:orderInfo}:(orderInfo||{});
  const orderNumber=order.order_number||'';
  const discount=Math.max(0,Number(order.discount_cop)||0);
  const finalTotal=Number.isFinite(Number(order.total_cop))&&order.total_cop!=null?Number(order.total_cop):Math.max(0,cartTotal()-discount);
  const lines=cart.map((i,index)=>[
    `${index+1}. ${i.name}`,
    `   Cantidad: ${i.qty}`,
    `   Precio: ${money(i.price)} c/u`,
    `   Total: ${money(i.price*i.qty)}`
  ].join('\n')).join('\n\n');

  const I = {
    wave: '\u{1F44B}',
    bag: '\u{1F6CD}',
    package: '\u{1F4E6}',
    user: '\u{1F464}',
    phone: '\u{1F4F1}',
    email: '\u{1F4E7}',
    pin: '\u{1F4CD}',
    house: '\u{1F3E0}',
    map: '\u{1F5FA}',
    note: '\u{1F4DD}',
    card: '\u{1F4B3}',
    check: '\u{2705}',
    pray: '\u{1F64F}'
  };

  return [
    `${I.wave} Hola, ${data.firstName}! Quiero realizar un pedido en ${CONFIG.storeName}.`,
    orderNumber ? `🧾 Número de pedido: ${orderNumber} (pendiente de pago)` : null,
    '',
    '━━━━━━━━━━━━━━━━━━━━',
    `${I.bag} *MI PEDIDO*`,
    '━━━━━━━━━━━━━━━━━━━━',
    lines,
    '',
    `${I.package} *Subtotal:* ${money(cartTotal())}`,
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
    ...(cart.every(item => product(item.id)?.deliveryType === 'digital')
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
    '• Disponibilidad de los productos',
    '• Costo de envío',
    '• Tiempo estimado de entrega',
    '',
    `${I.pray} ¡Muchas gracias! Quedo atento a su confirmación.`
  ].filter(Boolean).join('\n');
}

async function submitCheckoutForm(event){
  event.preventDefault();
  if(!cart.length){ closeCheckoutModal(); toast('Tu carrito está vacío'); return; }
  const form=event.currentTarget;
  if(!form.checkValidity()){ form.reportValidity(); return; }
  const raw=new FormData(form);
  const data={
    firstName:cleanField(raw.get('firstName')), lastName:cleanField(raw.get('lastName')),
    phone:cleanField(raw.get('phone')), email:cleanField(raw.get('email')),
    address:cleanField(raw.get('address')), neighborhood:cleanField(raw.get('neighborhood')),
    city:cleanField(raw.get('city')), department:cleanField(raw.get('department')),
    postalCode:cleanField(raw.get('postalCode')), reference:cleanField(raw.get('reference')),
    paymentMethod:cleanField(raw.get('paymentMethod')),
    couponCode:cleanField(raw.get('couponCode')).toUpperCase(),
    latitude:cleanField(raw.get('latitude')),
    longitude:cleanField(raw.get('longitude'))
  };
  const needsAddress = cart.some(item => product(item.id)?.deliveryType !== 'digital');
  if(needsAddress && (!data.address || !data.neighborhood || !data.city || !data.department)){
    toast('Para productos físicos, completa dirección, barrio, ciudad y departamento.');
    return;
  }
  // Pre-open WhatsApp while still inside the click event to avoid popup blockers after the async save.
  const whatsappTab = window.open('about:blank', '_blank');
  let savedOrder = null;
  if(window.NovaShopDB?.isConfigured?.()){
    const button=form.querySelector('button[type="submit"]');
    if(button){button.disabled=true;button.textContent='Guardando pedido…';}
    try{
      savedOrder=await window.NovaShopDB.createOrder(data,cart.map(item=>({product_id:Number(item.id),quantity:Number(item.qty)})));
    }catch(error){
      whatsappTab?.close();
      toast(error?.message||'No pudimos guardar el pedido. Inténtalo de nuevo.');
      if(button){button.disabled=false;button.textContent='💬 Continuar a WhatsApp';}
      return;
    }finally{if(button){button.disabled=false;button.textContent='💬 Continuar a WhatsApp';}}
  }
  const text=buildWhatsAppMessage(data,savedOrder||{});
  const url=`https://wa.me/${CONFIG.whatsapp}?text=${encodeURIComponent(text)}`;
  closeCheckoutModal();
  if(whatsappTab) whatsappTab.location.href=url;
  else window.location.href=url;
}

window.openModal=function(type){
  const content={
    shipping:['Envíos','Los tiempos y costos de envío se confirman por WhatsApp según la ciudad de destino. Esta plantilla está preparada para que reemplaces esta información por tus condiciones reales.'],
    returns:['Cambios y devoluciones','Personaliza esta sección con tus políticas reales de cambios, retracto, garantías y devoluciones antes de publicar.'],
    privacy:['Privacidad','No almacenes datos de tarjeta o contraseñas en esta web. Si implementas pagos, envía al cliente a un proveedor de pagos externo y utiliza su página segura.']
  }[type];
  $('#modalContent').innerHTML=`<span class="eyebrow">INFORMACIÓN</span><h2>${content[0]}</h2><p>${content[1]}</p>`;
  $('#infoModal').classList.add('show'); $('#infoModal').setAttribute('aria-hidden','false');
}
window.closeModal=function(){ $('#infoModal').classList.remove('show'); $('#infoModal').setAttribute('aria-hidden','true'); }

document.addEventListener('DOMContentLoaded',()=>{
  const registrationNotice=new URLSearchParams(window.location.search).get('registro');
  if(registrationNotice==='creado')toast('¡Cuenta creada correctamente! Ya puedes comprar en NovaShop.',5000);
  else if(registrationNotice==='acceso')toast('¡Listo! Guardamos tus datos y ya puedes comprar en NovaShop.',5000);
  if(registrationNotice)history.replaceState(null,'',window.location.pathname+window.location.hash);
  const streamingPage = document.body.dataset.page === 'streaming';
  const pageCategories = [...new Set(products.filter(p=>streamingPage ? p.category==='Streaming' : p.category!=='Streaming').map(p=>p.category))];
  $('#categoryFilter').innerHTML='<option value="all">'+(streamingPage?'Todas las plataformas':'Todas las categorías')+'</option>'+pageCategories.map(c=>`<option>${c}</option>`).join('');
  if(streamingPage){ $('#categorias')?.setAttribute('hidden',''); const h=$('.product-heading h2'); if(h) h.textContent='Plataformas de Streaming'; const eye=$('.product-heading .eyebrow'); if(eye) eye.textContent='SERVICIOS DIGITALES'; }
  renderFeaturedProduct(); renderCategories(); renderProducts(); renderCart();
  window.NovaShopDB?.syncCatalog?.(products).then(()=>{renderCategories();renderProducts();renderFeaturedProduct();}).catch(err=>console.warn('Catálogo Supabase:',err));
  $('#categoryFilter').addEventListener('change',renderProducts); $('#sortSelect').addEventListener('change',renderProducts); $('#searchInput').addEventListener('input',renderProducts);
  $('#minPriceFilter')?.addEventListener('input',renderProducts);$('#maxPriceFilter')?.addEventListener('input',renderProducts);$('#hideSoldOut')?.addEventListener('change',renderProducts);$('#onlyOffers')?.addEventListener('change',renderProducts);
  refreshFavoriteIds();
  $('#searchToggle').addEventListener('click',()=>{ const x=$('#searchBarWrap'); x.classList.toggle('open'); if(x.classList.contains('open')) $('#searchInput').focus(); });
  $('#cartToggle').addEventListener('click',openCart); $('#cartClose').addEventListener('click',closeCart); $('#drawerOverlay').addEventListener('click',closeCart); $('#whatsappCheckout').addEventListener('click',checkoutWhatsApp);
  $('#checkoutForm').addEventListener('submit',submitCheckoutForm);
  $('#checkoutClose').addEventListener('click',closeCheckoutModal);
  $('#checkoutModal').addEventListener('click',e=>{if(e.target.id==='checkoutModal') closeCheckoutModal();});
  $('#newsletterForm').addEventListener('submit',e=>{e.preventDefault();e.target.reset();toast('Gracias. Suscripción registrada en modo demo.');});
  if(window.location.hash==='#carrito') openCart();
  $('#infoModal').addEventListener('click',e=>{if(e.target.id==='infoModal') closeModal();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeCheckoutModal(); closeModal(); if($('#cartDrawer').classList.contains('open')) closeCart();}});
});
