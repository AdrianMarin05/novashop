/* Toggle global account links based on the actual Supabase session. */
(() => {
 const links=[...document.querySelectorAll('[data-auth-nav]')];if(!links.length)return;
 const paint=signed=>links.forEach(a=>{a.hidden=signed?a.dataset.authNav!=="account":a.dataset.authNav==="account";});
 const client=window.NovaShopDB?.client;if(!client){paint(false);return;}
 client.auth.getSession().then(({data})=>paint(!!data.session));
 client.auth.onAuthStateChange((_event,session)=>paint(!!session));
})();