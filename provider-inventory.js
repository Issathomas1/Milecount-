/* Existing authorized adapters only. A provider outage is different from zero loads. */
(function(root){
'use strict';
const copy=x=>JSON.parse(JSON.stringify(x));
class Inventory{
 constructor(adapters,{now=()=>Date.now(),ttlMs=300000}={}){this.adapters=adapters;this.now=now;this.ttlMs=ttlMs;this.cache=new Map();this.pending=new Map();}
 async provider(adapter,query){
  const key=adapter.id+':'+JSON.stringify(query),cached=this.cache.get(key),age=cached?this.now()-cached.at:Infinity;
  if(cached&&age<(adapter.minRefreshMs??this.ttlMs))return copy(cached.result);
  if(this.pending.has(key))return this.pending.get(key);
  const job=(async()=>{try{
   const loads=await adapter.search(copy(query));if(!Array.isArray(loads))throw Error('Provider returned an invalid load list');
   if((adapter.mode||'LIVE')==='LIVE'&&loads.some(l=>l.isSandbox||l.isLocalSim||['TEST','SIM'].includes(l.mode)||['TEST','SIM'].includes(l.status)))throw Error('Provider response mixed LIVE and TEST/SIM freight');
   const normalized=loads.map(l=>({...l,provider:l.provider||adapter.name,providerId:adapter.id,mode:adapter.mode||'LIVE',dataFreshness:'fresh',observedAt:new Date(this.now()).toISOString()}));
   if(normalized.some(l=>l.mode==='LIVE'&&(l.isSandbox||l.isLocalSim||['TEST','SIM'].includes(l.status))))throw Error('Provider response mixed LIVE and TEST/SIM freight');
   const result={provider:adapter.name,status:normalized.length?'ok':'empty',loads:normalized,updatedAt:this.now(),error:null};this.cache.set(key,{at:this.now(),result});return copy(result);
  }catch(e){return {provider:adapter.name,status:cached?'stale':'error',error:e.message||'Provider unavailable',updatedAt:cached?.at||null,loads:(cached?.result.loads||[]).map(l=>({...l,dataFreshness:'stale'}))};}
  finally{this.pending.delete(key);}})();this.pending.set(key,job);return job;
 }
 async search(query){const providers=await Promise.all(this.adapters.map(a=>this.provider(a,query)));return {providers,loads:providers.flatMap(p=>p.loads),searchedAt:this.now(),complete:providers.every(p=>p.status==='ok'||p.status==='empty')};}
}
const api={Inventory};if(typeof module!=='undefined')module.exports=api;root.MileCountInventory=api;
})(typeof window!=='undefined'?window:globalThis);
