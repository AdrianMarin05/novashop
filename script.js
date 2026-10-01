let cart = JSON.parse(localStorage.getItem('novashop-cart') || '[]');
const $ = (s) => document.querySelector(s);
const money = (n) => new Intl.NumberFormat('es-CO',{style:'currency',currency:CONFIG.currency,maximumFractionDigits:0}).format(n);

function saveCart(){ localStorage.setItem('novashop-cart',JSON.stringify(cart)); }
function cartCount(){ return cart.reduce((sum,i)=>sum+i.qty,0); }
function cartTotal(){ return cart.reduce((sum,i)=>sum+i.price*i.qty,0); }
function product(id){ return products.find(p=>p.id===id); }

function renderCategories(){
  $('#categoryGrid').innerHTML = categoryMeta.map(c=>`<button class="category-card" data-cat="${c.name}" aria-label="Ver ${c.name}"><img src="${c.image}" alt="${c.name}" loading="lazy"><div class="category-info"><h3>${c.name}</h3><span>${c.count}</span></div></button>`).join('');
  document.querySelectorAll('.category-card').forEach(btn=>btn.addEventListener('click',()=>{ $('#categoryFilter').value=btn.dataset.cat; renderProducts(); document.querySelector('#productos').scrollIntoView({behavior:'smooth'}); }));
}

function renderProducts(){
  const query = $('#searchInput').value.trim().toLowerCase();
  const cat = $('#categoryFilter').value;
  const sort = $('#sortSelect').value;
  let list = products.filter(p=>(cat==='all'||p.category===cat)&&(p.name.toLowerCase().includes(query)||p.category.toLowerCase().includes(query)));
  if(sort==='priceAsc') list.sort((a,b)=>a.price-b.price);
  if(sort==='priceDesc') list.sort((a,b)=>b.price-a.price);
  if(sort==='name') list.sort((a,b)=>a.name.localeCompare(b.name,'es'));
  $('#emptyState').hidden=list.length!==0;
  $('#productGrid').innerHTML=list.map(p=>`<article class="product-card">
    <a class="product-link" href="producto.html?id=${p.id}" aria-label="Ver ${p.name}">
      <div class="product-media"><img src="${p.images[0]}" alt="${p.name}" loading="lazy"><span class="tag">${p.tag}</span></div>
      <div class="product-body"><div class="category-label">${p.category}</div><div class="product-title">${p.name}</div>
        <div class="price-row"><span class="price">${money(p.price)}</span>${p.oldPrice?`<span class="old-price">${money(p.oldPrice)}</span>`:''}</div>
      </div>
    </a>
    <div class="product-actions"><button class="add-btn" data-id="${p.id}">Añadir al carrito</button></div>
  </article>`).join('');
  document.querySelectorAll('.add-btn').forEach(btn=>btn.addEventListener('click',()=>addToCart(Number(btn.dataset.id))));
}

function addToCart(id){
  const found=cart.find(i=>i.id===id);
  if(found) found.qty++; else { const p=product(id); cart.push({id:p.id,name:p.name,price:p.price,image:p.images[0],qty:1}); }
  saveCart(); renderCart(); openCart(); toast('Producto añadido al carrito');
}
function changeQty(id,delta){ const item=cart.find(i=>i.id===id); if(!item) return; item.qty+=delta; if(item.qty<=0) cart=cart.filter(i=>i.id!==id); saveCart(); renderCart(); }
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
function toast(msg){ const t=$('#toast'); t.textContent=msg; t.classList.add('show'); clearTimeout(window.__toast); window.__toast=setTimeout(()=>t.classList.remove('show'),1800); }

function checkoutWhatsApp(){
  if(!cart.length){ toast('Añade al menos un producto'); return; }
  const lines=cart.map(i=>`• ${i.name} x${i.qty} — ${money(i.price*i.qty)}`).join('\n');
  const text=`Hola, quiero hacer este pedido en ${CONFIG.storeName}:\n\n${lines}\n\nSubtotal: ${money(cartTotal())}\n\n¿Me confirman disponibilidad, envío y formas de pago?`;
  window.open(`https://wa.me/${CONFIG.whatsapp}?text=${encodeURIComponent(text)}`,'_blank','noopener,noreferrer');
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
  $('#categoryFilter').innerHTML='<option value="all">Todas las categorías</option>'+[...new Set(products.map(p=>p.category))].map(c=>`<option>${c}</option>`).join('');
  renderCategories(); renderProducts(); renderCart();
  $('#categoryFilter').addEventListener('change',renderProducts); $('#sortSelect').addEventListener('change',renderProducts); $('#searchInput').addEventListener('input',renderProducts);
  $('#searchToggle').addEventListener('click',()=>{ const x=$('#searchBarWrap'); x.classList.toggle('open'); if(x.classList.contains('open')) $('#searchInput').focus(); });
  $('#cartToggle').addEventListener('click',openCart); $('#cartClose').addEventListener('click',closeCart); $('#drawerOverlay').addEventListener('click',closeCart); $('#whatsappCheckout').addEventListener('click',checkoutWhatsApp);
  $('#newsletterForm').addEventListener('submit',e=>{e.preventDefault();e.target.reset();toast('Gracias. Suscripción registrada en modo demo.');});
  if(window.location.hash==='#carrito') openCart();
  $('#infoModal').addEventListener('click',e=>{if(e.target.id==='infoModal') closeModal();});
});
