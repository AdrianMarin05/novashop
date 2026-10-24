(() => {
const $=s=>document.querySelector(s);
const money=n=>new Intl.NumberFormat("es-CO",{style:"currency",currency:"COP",maximumFractionDigits:0}).format(Number(n)||0);
let ids=[];
function message(text,kind="info"){const box=$("#favoritesStatus");box.textContent=text;box.className="account-message "+kind;box.hidden=!text;}
function render(){
 const grid=$("#favoritesGrid"),empty=$("#favoritesEmpty");
 const list=products.filter(p=>ids.includes(Number(p.id)));
 empty.hidden=list.length!==0;grid.innerHTML=list.map(p=>{
  const saved=ids.includes(Number(p.id));
  return '<article class="product-card"><a class="product-link" href="producto.html?id='+Number(p.id)+'" aria-label="Ver '+esc(p.name)+'"><div class="product-media"><img src="'+esc(p.images?.[0]||"images/streaming-placeholder.svg")+'" alt="'+esc(p.name)+'" loading="lazy"><button class="favorite-toggle is-favorite" type="button" data-unfavorite="'+Number(p.id)+'" aria-label="Quitar de favoritos">♥</button></div><div class="product-body"><div class="category-label">'+esc(p.category)+'</div><div class="product-title">'+esc(p.name)+'</div><div class="price-row"><span class="price">'+money(p.price)+'</span>'+(p.oldPrice?'<span class="old-price">'+money(p.oldPrice)+'</span>':"")+'</div></div></a><div class="favorite-product-actions"><button class="btn btn-primary" data-add="'+Number(p.id)+'" '+(p.stockQuantity===0?'disabled':"")+'>'+(p.stockQuantity===0?'Agotado':'Añadir al carrito')+'</button></div></article>';
 }).join("");
 grid.querySelectorAll("[data-unfavorite]").forEach(b=>b.addEventListener("click",async e=>{e.preventDefault();e.stopPropagation();await toggle(Number(b.dataset.unfavorite));}));
 grid.querySelectorAll("[data-add]").forEach(b=>b.addEventListener("click",()=>add(Number(b.dataset.add))));
}
function esc(s){return String(s??"").replace(/[&<>\"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
async function toggle(id){
 try{ids=await window.NovaShopDB?.toggleFavorite?.(id)||ids.filter(x=>x!==id);if(!window.NovaShopDB?.toggleFavorite){localStorage.setItem("novashop-favorites-v1",JSON.stringify(ids));}render();message("Lista de favoritos actualizada.","success");}
 catch(e){message(e.message||"No pudimos actualizar los favoritos.","error");}
}
function add(id){
 const p=products.find(x=>Number(x.id)===id);if(!p)return;
 if(p.stockQuantity===0){message("Este producto está agotado.","error");return;}
 let cart=[];try{cart=JSON.parse(localStorage.getItem("novashop-cart")||"[]");}catch(_){}
 const row=cart.find(x=>Number(x.id)===id);if(row){if(p.stockQuantity!=null&&row.qty>=p.stockQuantity){message("No hay más unidades disponibles.","error");return;}row.qty++;}
 else cart.push({id:p.id,name:p.name,price:p.price,image:p.images?.[0]||"",qty:1});
 localStorage.setItem("novashop-cart",JSON.stringify(cart));message("Producto añadido al carrito.","success");
}
async function init(){
 await window.NovaShopDB?.syncCatalog?.(products).catch(()=>{});
 ids=await window.NovaShopDB?.getFavoriteIds?.()||[];
 render();
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})();