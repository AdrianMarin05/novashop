(() => {
  const params=new URLSearchParams(window.location.search);
  const mode=params.get("modo");
  const orderNumber=String(params.get("pedido")||"").trim().slice(0,60);
  const title=document.querySelector("#orderTitle");
  const number=document.querySelector("#orderNumber");
  const email=document.querySelector("#freightEmail");

  if(mode!=="contraentrega"||!orderNumber){
    title.textContent="No encontramos el número de pedido";
    number.textContent="Vuelve a NovaShop para consultar tus opciones de compra.";
    email.hidden=true;
    return;
  }
  number.textContent="Número de pedido: "+orderNumber;
  const subject="Consulta de flete para el pedido "+orderNumber;
  const body="Hola, necesito conocer el valor del flete y las instrucciones para pagarlo por anticipado a la transportadora.\n\nNúmero de pedido: "+orderNumber;
  email.href="mailto:hola@novashop.co?subject="+encodeURIComponent(subject)+"&body="+encodeURIComponent(body);
})();