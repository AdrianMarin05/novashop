/* NovaShop discovery controls: prominent search, quick categories, result count and reset. */
(() => {
 const $ = (selector) => document.querySelector(selector);
 const fire = (element, type) => element?.dispatchEvent(new Event(type,{bubbles:true}));
 const scrollToCatalog = () => $('#productos')?.scrollIntoView({behavior:'smooth',block:'start'});
 function init(){
  const heroSearch=$('#heroProductSearch'), headerSearch=$('#searchInput'), category=$('#categoryFilter');
  const grid=$('#productGrid'), chipBox=$('#heroCategoryChips');
  if(!heroSearch||!headerSearch||!category||!grid)return;
  heroSearch.addEventListener('input',()=>{headerSearch.value=heroSearch.value;fire(headerSearch,'input');});
  headerSearch.addEventListener('input',()=>{if(heroSearch.value!==headerSearch.value)heroSearch.value=headerSearch.value;});
  heroSearch.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();scrollToCatalog();}});
  $('#heroSearchSubmit')?.addEventListener('click',()=>{headerSearch.value=heroSearch.value;fire(headerSearch,'input');scrollToCatalog();});
  if(chipBox){
   const options=[...category.options].filter(option=>option.value!=='all').map(option=>({value:option.value,label:option.textContent.trim()}));
   const shortlist=options.slice(0,4);
   chipBox.innerHTML='<button type="button" class="hero-category-chip" data-quick-category="all">Ver todo</button>'+shortlist.map(option=>'<button type="button" class="hero-category-chip" data-quick-category="'+option.value.replace(/&/g,'&amp;').replace(/"/g,'&quot;')+'">'+option.label.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')+'</button>').join('');
   chipBox.querySelectorAll('[data-quick-category]').forEach(button=>button.addEventListener('click',()=>{
    category.value=button.dataset.quickCategory;fire(category,'change');scrollToCatalog();
   }));
  }
  let discovery=$('#catalogDiscoveryBar');
  if(!discovery){
   discovery=document.createElement('div');discovery.id='catalogDiscoveryBar';discovery.className='catalog-discovery-bar';
   discovery.innerHTML='<div class="catalog-results-copy" role="status" aria-live="polite"><span class="catalog-results-dot" aria-hidden="true"></span><span id="catalogResultsText">Mostrando productos</span></div><button type="button" id="clearCatalogFilters" class="clear-catalog-btn">Limpiar filtros</button>';
   grid.parentNode.insertBefore(discovery,grid);
  }
  const resultText=$('#catalogResultsText');
  function updateResults(){
   const cards=[...grid.querySelectorAll('.product-card')],count=cards.length;
   const term=headerSearch.value.trim();
   resultText.innerHTML='<strong>'+count+'</strong> '+(count===1?'producto encontrado':'productos encontrados')+(term?' para <strong>“'+term.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))+'”</strong>':'');
   const clear=$('#clearCatalogFilters');
   const active=!!term||category.value!=='all'||!!$('#minPriceFilter')?.value||!!$('#maxPriceFilter')?.value||!!$('#hideSoldOut')?.checked||!!$('#onlyOffers')?.checked||$('#sortSelect')?.value!=='featured';
   clear.hidden=!active;
  }
  const observer=new MutationObserver(updateResults);observer.observe(grid,{childList:true,subtree:false});
  ['change','input'].forEach(type=>{
   ['searchInput','categoryFilter','sortSelect','minPriceFilter','maxPriceFilter','hideSoldOut','onlyOffers'].forEach(id=>{
    const element=$('#'+id);element?.addEventListener(type,updateResults);
   });
  });
  $('#clearCatalogFilters')?.addEventListener('click',()=>{
   headerSearch.value='';heroSearch.value='';
   category.value='all';$('#sortSelect').value='featured';
   $('#minPriceFilter').value='';$('#maxPriceFilter').value='';
   $('#hideSoldOut').checked=false;$('#onlyOffers').checked=false;
   fire(headerSearch,'input');fire(category,'change');fire($('#sortSelect'),'change');
   fire($('#minPriceFilter'),'input');fire($('#maxPriceFilter'),'input');
   fire($('#hideSoldOut'),'change');fire($('#onlyOffers'),'change');
   updateResults();
  });
  updateResults();
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
