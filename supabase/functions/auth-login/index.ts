import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const headers={"Content-Type":"application/json; charset=utf-8","Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS","Cache-Control":"no-store"};
const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers});
const generic=()=>json({error:"Correo/teléfono o contraseña incorrectos."},401);
function keyValue(raw:string|undefined):string|undefined{if(!raw)return;try{const v=JSON.parse(raw);return typeof v.default==="string"?v.default:undefined;}catch{return undefined;}}
function e164(value:string){let n=String(value||"").trim().replace(/[^0-9+]/g,"");if(n.startsWith("+"))return n;if(n.startsWith("00"))return "+"+n.slice(2);n=n.replace(/\D/g,"");if(n.startsWith("57")&&n.length>=12)return "+"+n;return "+57"+n;}

Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers});
 if(req.method!=="POST")return json({error:"Método no permitido."},405);
 const text=await req.text();if(text.length>5000)return json({error:"Solicitud demasiado grande."},413);
 let body:any;try{body=JSON.parse(text);}catch{return json({error:"Solicitud no válida."},400);}
 const identity=String(body?.identifier||"").trim(),password=String(body?.password||"");
 if(!identity||!password||password.length>256)return generic();
 const url=Deno.env.get("SUPABASE_URL");
 const publishable=keyValue(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS"))||Deno.env.get("SUPABASE_ANON_KEY");
 const secret=keyValue(Deno.env.get("SUPABASE_SECRET_KEYS"))||Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
 if(!url||!publishable||!secret){console.error("auth-login is missing server configuration");return json({error:"El inicio de sesión no está configurado."},500);}
 try{
  const admin=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
  let lookup;
  if(identity.includes("@")){
   const email=identity.toLowerCase();
   if(email.length>120||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return generic();
   lookup=admin.from("profiles").select("id").eq("email",email).maybeSingle();
  }else{
   const phone=e164(identity);
   if(!/^\+[1-9]\d{7,14}$/.test(phone))return generic();
   lookup=admin.from("profiles").select("id").eq("phone",phone).maybeSingle();
  }
  const {data:profile,error:lookupError}=await lookup;
  if(lookupError||!profile?.id)return generic();
  const {data:userData,error:userError}=await admin.auth.admin.getUserById(profile.id);
  const user=userData?.user;
  if(userError||!user)return generic();
  // A profile may be found by phone even when the Auth identity is email, and vice versa.
  // Supabase Auth itself validates the password; this function never stores or logs it.
  const credentials=user.email?{email:user.email,password}:user.phone?{phone:user.phone,password}:null;
  if(!credentials)return generic();
  const response=await fetch(url.replace(/\/$/,"")+"/auth/v1/token?grant_type=password",{
   method:"POST",headers:{"Content-Type":"application/json","apikey":publishable,"Authorization":"Bearer "+publishable,"Cache-Control":"no-store"},
   body:JSON.stringify(credentials)
  });
  if(!response.ok)return generic();
  const session=await response.json();
  if(!session?.access_token||!session?.refresh_token)return generic();
  return json({session:{access_token:session.access_token,refresh_token:session.refresh_token,expires_in:session.expires_in,token_type:session.token_type}});
 }catch(_){
  console.error("auth-login operation failed; credentials omitted");
  return json({error:"No pudimos iniciar sesión. Inténtalo de nuevo."},500);
 }
});
