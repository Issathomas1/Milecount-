/*
MileCount Cloud V3
Direct Supabase Auth + REST client (no external JS SDK dependency).
Only the browser-safe publishable key is used here. RLS protects user rows.
*/
const MC_URL="https://lrnyxqtmywkhtrmsjquc.supabase.co";
const MC_KEY="sb_publishable_6cP65DrMPJFkHgnk6eEAAA_-LQQC1fN";
const MC_SESSION_KEY="milecount_supabase_session";

window.MileCountCloud=(()=>{
 function readSession(){try{return JSON.parse(localStorage.getItem(MC_SESSION_KEY)||"null")}catch(e){return null}}
 function writeSession(s){if(s)localStorage.setItem(MC_SESSION_KEY,JSON.stringify(s));else localStorage.removeItem(MC_SESSION_KEY)}
 async function jsonFetch(url,options={}){
  let response;
  try {
    response=await fetch(url,{...options,mode:"cors",cache:"no-store"});
  } catch(e) {
    throw new Error("NETWORK: Browser could not reach MileCount Cloud. "+(e?.message||"Fetch failed"));
  }
  const text=await response.text();let body={};try{body=text?JSON.parse(text):{}}catch(e){body={message:text}}
  if(!response.ok)throw new Error("CLOUD "+response.status+": "+(body.msg||body.message||body.error_description||body.error||"Request rejected"));
  return body;
 }
 async function health(){
   try{
     const response=await fetch(MC_URL+"/auth/v1/health",{headers:{"apikey":MC_KEY},mode:"cors",cache:"no-store"});
     return {ok:response.ok,status:response.status,url:MC_URL};
   }catch(e){return {ok:false,status:0,url:MC_URL,error:e?.message||"Fetch failed"}}
 }
 function authHeaders(token){return {"apikey":MC_KEY,"Authorization":"Bearer "+(token||MC_KEY),"Content-Type":"application/json"}}
 async function signUp(email,password,displayName=""){
  const d=await jsonFetch(MC_URL+"/auth/v1/signup",{method:"POST",headers:authHeaders(),body:JSON.stringify({email,password,data:{display_name:displayName}})});
  if(d.access_token)writeSession(d);return d;
 }
 async function signIn(email,password){
  const d=await jsonFetch(MC_URL+"/auth/v1/token?grant_type=password",{method:"POST",headers:authHeaders(),body:JSON.stringify({email,password})});
  writeSession(d);return d;
 }
 async function signOut(){const s=readSession();if(s?.access_token){try{await fetch(MC_URL+"/auth/v1/logout",{method:"POST",headers:authHeaders(s.access_token)})}catch(e){}}writeSession(null)}
 async function session(){
  const s=readSession();if(!s?.access_token)return null;
  try{const user=await jsonFetch(MC_URL+"/auth/v1/user",{headers:authHeaders(s.access_token)});return {user,access_token:s.access_token}}
  catch(e){writeSession(null);return null}
 }
 async function rows(table,query=""){
  const s=await session();if(!s)throw new Error("Sign in first.");
  return jsonFetch(MC_URL+"/rest/v1/"+table+"?"+query,{headers:{...authHeaders(s.access_token),"Accept":"application/json"}});
 }
 async function profile(){const s=await session();if(!s)return null;const a=await rows("profiles","id=eq."+encodeURIComponent(s.user.id)+"&select=*");return a[0]||null}
 async function vehicles(){return rows("vehicles","select=*&order=is_default.desc,created_at.desc")}
 async function defaultVehicle(){const a=await rows("vehicles","is_default=eq.true&select=*&order=created_at.desc&limit=1");return a[0]||null}
 async function trips(){return rows("trips","select=*&order=created_at.desc")}
 async function updateVehicle(id,obj){
  const s=await session();if(!s)throw new Error("Sign in first.");
  const a=await jsonFetch(MC_URL+"/rest/v1/vehicles?id=eq."+encodeURIComponent(id),{method:"PATCH",headers:{...authHeaders(s.access_token),"Prefer":"return=representation"},body:JSON.stringify(obj)});return a[0]||a;
 }
 async function deleteVehicle(id){
  const s=await session();if(!s)throw new Error("Sign in first.");
  await jsonFetch(MC_URL+"/rest/v1/vehicles?id=eq."+encodeURIComponent(id),{method:"DELETE",headers:{...authHeaders(s.access_token),"Prefer":"return=minimal"}});return true;
 }
 async function insert(table,obj){
  const s=await session();if(!s)throw new Error("Sign in first.");
  const a=await jsonFetch(MC_URL+"/rest/v1/"+table,{method:"POST",headers:{...authHeaders(s.access_token),"Prefer":"return=representation"},body:JSON.stringify({...obj,user_id:s.user.id})});return a[0]||a;
 }
 return {isEnabled:()=>true,health,signUp,signIn,signOut,session,profile,vehicles,defaultVehicle,updateVehicle,deleteVehicle,trips,saveVehicle:v=>insert("vehicles",v),saveTrip:t=>insert("trips",t)};
})();