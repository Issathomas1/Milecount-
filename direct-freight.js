/*
MileCount Direct Freight connection client.
Direct Freight credentials are sent only to the MileCount Edge Function and are never persisted in browser storage.
*/
(function(){
 const URL="https://lrnyxqtmywkhtrmsjquc.supabase.co/functions/v1/directfreight-adapter";
 const KEY="sb_publishable_6cP65DrMPJFkHgnk6eEAAA_-LQQC1fN";
 async function call(body){
  const s=await window.MileCountCloud.session();
  if(!s?.access_token)throw new Error("Sign in to MileCount first.");
  const r=await fetch(URL,{method:"POST",cache:"no-store",headers:{"Content-Type":"application/json","apikey":KEY,"Authorization":"Bearer "+s.access_token},body:JSON.stringify(body)});
  const data=await r.json().catch(()=>({}));
  if(!r.ok||data.ok===false)throw new Error(data.error||"Direct Freight request failed.");
  return data;
 }
 async function status(){return call({action:"status"})}
 async function connect(email,password){return call({action:"connect",email,password})}
 async function disconnect(){return call({action:"disconnect"})}
 async function search(request){return call({...request,action:"search"})}
 window.MileCountDirectFreight={status,connect,disconnect,search};
})();