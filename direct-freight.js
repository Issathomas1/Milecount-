/*
MileCount Direct Freight connection client.
Direct Freight credentials are sent only to the MileCount Edge Function and are never persisted in browser storage.
*/
(function(){
 const URL="https://lrnyxqtmywkhtrmsjquc.supabase.co/functions/v1/directfreight-adapter";
 const KEY="sb_publishable_6cP65DrMPJFkHgnk6eEAAA_-LQQC1fN";
 async function call(body){
  const controller=new AbortController();
  let timer;
  const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>{
   controller.abort();reject(new Error("Direct Freight timed out. Please retry."));
  },8000)});
  const request=(async()=>{
   const s=await window.MileCountCloud.session();
   if(controller.signal.aborted)throw new Error("Direct Freight timed out. Please retry.");
   if(!s?.access_token)throw new Error("Sign in to MileCount first.");
   const r=await fetch(URL,{method:"POST",cache:"no-store",signal:controller.signal,headers:{"Content-Type":"application/json","apikey":KEY,"Authorization":"Bearer "+s.access_token},body:JSON.stringify(body)});
   const data=await r.json();
   if(!r.ok||data.ok===false)throw new Error(data.error||"Direct Freight request failed.");
   return data;
  })();
  try{return await Promise.race([request,timeout])}finally{clearTimeout(timer)}
 }
 async function status(){return call({action:"status"})}
 async function connect(email,password){return call({action:"connect",email,password})}
 async function disconnect(){return call({action:"disconnect"})}
 async function search(request){return call({...request,action:"search"})}
 window.MileCountDirectFreight={status,connect,disconnect,search};
})();