/*
MileCount Cloud V3
Direct Supabase Auth + REST client (no external JS SDK dependency).
Only the browser-safe publishable key is used here. RLS protects user rows.
*/
const MC_URL="https://lrnyxqtmywkhtrmsjquc.supabase.co";
const MC_KEY="sb_publishable_6cP65DrMPJFkHgnk6eEAAA_-LQQC1fN";
const MC_SESSION_KEY="milecount_supabase_session";

window.MileCountCloud=(()=>{
 let recoveryToken=null;
 const fragment=new URLSearchParams(location.hash.slice(1));
 if(fragment.get("type")==="recovery"){
  recoveryToken=fragment.get("access_token")||"";
  history.replaceState(null,"",location.pathname+location.search);
 }
 function isPasswordRecovery(){return recoveryToken!==null}
 async function requestPasswordReset(email){
  const redirect=new URL("./",location.href).href;
  return jsonFetch(MC_URL+"/auth/v1/recover?redirect_to="+encodeURIComponent(redirect),{method:"POST",headers:authHeaders(),body:JSON.stringify({email})});
 }
 async function finishPasswordReset(password){
  if(!recoveryToken)throw new Error("Reset link expired.");
  await jsonFetch(MC_URL+"/auth/v1/user",{headers:authHeaders(recoveryToken)});
  await jsonFetch(MC_URL+"/auth/v1/user",{method:"PUT",headers:authHeaders(recoveryToken),body:JSON.stringify({password})});
  try{await jsonFetch(MC_URL+"/auth/v1/logout",{method:"POST",headers:authHeaders(recoveryToken)})}catch(e){}finally{recoveryToken="";writeSession(null)}
 }
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
 async function patch(table,query,obj){const s=await session();if(!s)throw new Error("Sign in first.");return jsonFetch(MC_URL+"/rest/v1/"+table+"?"+query,{method:"PATCH",headers:{...authHeaders(s.access_token),"Prefer":"return=representation"},body:JSON.stringify(obj)})}
 async function insert(table,obj){
  const s=await session();if(!s)throw new Error("Sign in first.");
  const a=await jsonFetch(MC_URL+"/rest/v1/"+table,{method:"POST",headers:{...authHeaders(s.access_token),"Prefer":"return=representation"},body:JSON.stringify({...obj,user_id:s.user.id})});return a[0]||a;
 }
 async function rpc(name,obj={}){const s=await session();if(!s)throw new Error("Sign in first.");return jsonFetch(MC_URL+"/rest/v1/rpc/"+name,{method:"POST",headers:authHeaders(s.access_token),body:JSON.stringify(obj)})}
 async function isAdmin(){try{return !!(await rpc("is_milecount_admin"))}catch(e){return false}}
 async function plannerTrips(){return rows("planner_trips","select=*&order=pickup_at.asc")}
 async function savePlannerTrip(t){return insert("planner_trips",t)}
 async function updatePlannerTrip(id,obj){const a=await patch("planner_trips","id=eq."+encodeURIComponent(id),obj);return a[0]||a}
 async function loadTruckBrain(vehicleKey){const a=await rows('truck_brain_states','vehicle_key=eq.'+encodeURIComponent(vehicleKey)+'&select=state,version');return a[0]||null;}
 async function saveTruckBrain(vehicleKey,version,state){return rpc('save_truck_brain',{p_vehicle_key:vehicleKey,p_expected_version:version,p_state:state});}
 async function entitlements(){return rpc('milecount_entitlements')}
 async function billing(action,plan){
  const s=await session();if(!s)throw Error('Sign in to MileCount first.');
  return jsonFetch(MC_URL+'/functions/v1/paypal-billing',{method:'POST',headers:authHeaders(s.access_token),body:JSON.stringify({action,plan})});
 }
 async function billingConfig(){return jsonFetch(MC_URL+'/functions/v1/paypal-billing')}
 async function commercialRoute(request){const s=await session();if(!s)throw Error('Sign in for commercial routing');return jsonFetch(MC_URL+'/functions/v1/commercial-route',{method:'POST',headers:authHeaders(s.access_token),body:JSON.stringify(request)});}
 return {loadTruckBrain,saveTruckBrain,entitlements,billing,billingConfig,commercialRoute,isEnabled:()=>true,health,signUp,signIn,signOut,isPasswordRecovery,requestPasswordReset,finishPasswordReset,session,profile,vehicles,defaultVehicle,updateVehicle,deleteVehicle,trips,plannerTrips,savePlannerTrip,updatePlannerTrip,isAdmin,rpc,saveVehicle:v=>insert("vehicles",v),saveTrip:t=>insert("trips",t)};
})();
