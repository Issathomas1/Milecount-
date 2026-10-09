/* Public freight only. LoadBoot credentials remain in the MileCount backend. */
(function(root){
'use strict';
const ENDPOINT='https://lrnyxqtmywkhtrmsjquc.supabase.co/functions/v1/loadboot-sandbox';
const TTL=300000,MAX_AGE=900000,cache=new Map(),pending=new Map();
const number=x=>{const n=Number(String(x??'').replace(/[$,]/g,''));return Number.isFinite(n)&&n>=0?n:0;};
const place=x=>typeof x==='string'?x:[x?.city,x?.state].filter(Boolean).join(', ');
function fresh(l,now=Date.now()){
 return now-Date.parse(l.observedAt)<MAX_AGE&&(!l.expiresAt||Date.parse(l.expiresAt)>now);
}
function normalize(x,observedAt){
 const ref=String(x.ref||'');if(!ref||/^SBX/i.test(ref)||x.sandbox===true||x.isSandbox===true)return null;
 const pickup=place(x.origin),delivery=place(x.destination);if(!pickup||!delivery)return null;
 const pay=number(x.rate),miles=number(x.miles);
 return {name:pickup+' → '+delivery+' • LoadBoot',provider:'LoadBoot',providerLoadId:ref,bookingReference:ref,
  pickup,delivery,stop:delivery,pay,loadedMiles:miles,rpm:miles?pay/miles:number(x.rpm),weight:number(x.weight),space:0,
  equipment:String(x.equipment||''),commodity:String(x.commodity||''),pickupDate:x.pickup_date||null,
  posted:x.posted||null,expiresAt:x.expires_at||null,observedAt,broker:x.posted_by||null,
  sourceUrl:'https://loadboot.com/app/carrier/?src=milecount-edit-all-futures-llc&ref='+encodeURIComponent(ref),
  isSandbox:false,mode:'LIVE',sourceType:'REAL',routeCoordinates:[],deadhead:0};
}
async function search(query={}){
 const state=String(query.origin_state||(String(query.origin||'').match(/,\s*([A-Za-z]{2})\b/)||[])[1]||'').toUpperCase();
 const params=new URLSearchParams({mode:'production',limit:'50'});if(state)params.set('origin_state',state);
 const key=params.toString(),hit=cache.get(key),now=Date.now();
 if(hit&&now-hit.at<TTL)return hit.loads.filter(l=>fresh(l,now));
 if(pending.has(key))return pending.get(key);
 const job=(async()=>{
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
  try{
   const r=await fetch(ENDPOINT+'?'+params,{cache:'no-store',signal:controller.signal});const j=await r.json();
   if(!r.ok||j.ok===false)throw Error(j.error||'LoadBoot unavailable');
   if(j.sandbox!==false||j.mode!=='LIVE'||!Array.isArray(j.data?.loads))throw Error('LoadBoot production response not verified');
   const at=Date.parse(j.fetchedAt);if(!Number.isFinite(at)||Date.now()-at>=MAX_AGE)throw Error('LoadBoot data expired');
   const loads=j.data.loads.map(x=>normalize(x,j.fetchedAt)).filter(l=>l&&fresh(l));
   cache.set(key,{at,loads});return loads;
  }catch(e){cache.delete(key);throw e;}finally{clearTimeout(timer);pending.delete(key);}
 })();pending.set(key,job);return job;
}
root.MileCountLoadBoot={search,normalize,fresh};
if(typeof module!=='undefined')module.exports=root.MileCountLoadBoot;
})(typeof window!=='undefined'?window:globalThis);
