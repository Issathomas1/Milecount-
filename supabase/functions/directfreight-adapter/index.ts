import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Content-Type":"application/json","Cache-Control":"no-store"};
const out=(body:any,status=200)=>new Response(JSON.stringify(body),{status,headers:cors});
const DF="https://api.directfreight.com/v1";
function admin(){
 const keys=JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS")||"{}");
 const key=keys.default||Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
 return createClient(Deno.env.get("SUPABASE_URL")!,key,{auth:{persistSession:false}});
}
async function mileCountUser(req:Request){
 const bearer=(req.headers.get("authorization")||"").replace(/^Bearer\s+/i,"");
 if(!bearer)throw new Error("Sign in to MileCount first.");
 const {data,error}=await admin().auth.getUser(bearer);
 if(error||!data.user)throw new Error("MileCount session is invalid.");
 return data.user;
}
Deno.serve(async(req)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 try{
  const partner=Deno.env.get("DIRECT_FREIGHT_API_TOKEN");
  if(!partner)return out({ok:false,configured:false,error:"Direct Freight partner credential is not configured"},503);
  const user=await mileCountUser(req), body=await req.json().catch(()=>({})), action=String(body.action||"search");
  const db=admin();
  if(action==="status"){
   const {data}=await db.from("provider_connections").select("status,account_email,subscription_tier,connected_at,updated_at").eq("user_id",user.id).eq("provider","direct_freight").maybeSingle();
   return out({ok:true,configured:true,connected:!!data,connection:data||null});
  }
  if(action==="disconnect"){
   await db.from("provider_connections").delete().eq("user_id",user.id).eq("provider","direct_freight");
   return out({ok:true,connected:false});
  }
  if(action==="connect"){
   const email=String(body.email||"").trim(),password=String(body.password||"");
   if(!email||!password)return out({ok:false,error:"Direct Freight email and password are required."},400);
   // Direct Freight's login schema differs from its create-user schema.
   // Never forward the MileCount session password or persist this secret.
   const r=await fetch(DF+"/end_user_authentications",{method:"POST",headers:{"Accept":"application/json","Content-Type":"application/json","api-token":partner},body:JSON.stringify({login:email,realm:"email",secret:password})});
   const data=await r.json().catch(()=>({}));
   if(!r.ok)return out({ok:false,connected:false,upstreamStatus:r.status,error:"Direct Freight sign-in was rejected. Check the Direct Freight credentials and account status."},r.status===401?401:400);
   const token=String(data["end-user-token"]??"");
   if(!token)return out({ok:false,error:"Direct Freight authenticated but did not return an end-user token."},502);
   const tier=String(data.subscription_tier??data.subscription??data.account_type??"unknown");
   const {error}=await db.from("provider_connections").upsert({user_id:user.id,provider:"direct_freight",status:"connected",account_email:email,subscription_tier:tier,access_token:token,updated_at:new Date().toISOString()},{onConflict:"user_id,provider"});
   if(error)throw error;
   return out({ok:true,connected:true,accountEmail:email,subscriptionTier:tier,contactInfoLimit:tier.toLowerCase().includes("free")?3:null});
  }
  const {data:conn}=await db.from("provider_connections").select("access_token,subscription_tier").eq("user_id",user.id).eq("provider","direct_freight").maybeSingle();
  if(!conn?.access_token)return out({ok:false,connected:false,needsUserAuth:true,loads:[],error:"Connect your Direct Freight account before searching Direct Freight."},401);
  const origin=String(body.origin||"").trim(),m=origin.match(/^(.+?),\s*([A-Za-z]{2})$/);
  const payload:any={origin_city:m?.[1]?.trim()||undefined,origin_state:m?.[2]?[m[2].toUpperCase()]:undefined,origin_radius:Math.min(300,Math.max(25,Number(body.radius||150))),item_count:Math.min(100,Math.max(1,Number(body.limit||50))),page_number:Math.max(0,Number(body.page||0)),max_tripmiles:Math.min(1000,Math.max(1,Number(body.max_trip_miles||500))),max_weight:Math.min(10000,Math.max(1,Number(body.max_weight||9999))),hide_blank_weights:false,hide_blank_payrates:false,return_web_url:true,sort_parameter:"age",sort_direction:"asc"};
  Object.keys(payload).forEach(k=>payload[k]===undefined&&delete payload[k]);
  const r=await fetch(DF+"/boards/loads",{method:"POST",headers:{"Accept":"application/json","Content-Type":"application/json","api-token":partner,"end-user-token":conn.access_token},body:JSON.stringify(payload)});
  const data=await r.json().catch(()=>({}));
  if(!r.ok)return out({ok:false,connected:true,needsUserAuth:r.status===401||r.status===403,loads:[],upstreamStatus:r.status,error:"Direct Freight rejected the real-time search."},r.status);
  const arr=Array.isArray(data)?data:(data.list||data.loads||data.entries||data.results||data.data||[]);
  const loads=(Array.isArray(arr)?arr:[]).map((x:any)=>({provider:"Direct Freight",providerLoadId:String(x.entry_id??x.id??x.load_id??x.custom_id??""),pickup:[x.origin_city??x.origin?.city,x.origin_state??x.origin?.state].filter(Boolean).join(", "),delivery:[x.destination_city??x.destination?.city,x.destination_state??x.destination?.state].filter(Boolean).join(", "),pay:Number(x.pay_rate??x.rate??x.pay??0),loadedMiles:Number(x.tripmiles??x.trip_miles??x.miles??0),weight:Number(x.weight??0),space:Number(x.length??0),pickupDate:x.pickup_date??x.pickupDate??null,deliveryDate:x.delivery_date??x.deliveryDate??null,equipment:x.trailer_type??x.equipment??"Unknown",companyName:x.company_name??x.company??null,phone:x.phone??x.phone_number??null,sourceUrl:x.web_url??x.url??data.search_url??null,isSandbox:false,sourceType:"REAL"})).filter((x:any)=>x.pickup&&x.delivery);
  return out({ok:true,configured:true,connected:true,provider:"Direct Freight",subscriptionTier:conn.subscription_tier,loads,count:loads.length});
 }catch(e){return out({ok:false,loads:[],error:String((e as Error)?.message||e)},401)}
});
