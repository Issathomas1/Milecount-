/* CPU-heavy searches stay off the driver interface. No credentials or network access. */
importScripts('truck-brain.js','pickup-delivery.js?v=20261001-stackrepair1','dispatch-brain.js','dispatch-planner.js');
onmessage=event=>{
 const {method,args}=event.data;
 try{
  const allowed=['solve','optimize','economicReview','recommend','dispatch'];
  if(!allowed.includes(method))throw Error('Unknown optimizer operation');
  const value=method==='dispatch'?MileCountDispatchPlanner.recommend(...args):MileCountPickupDelivery[method](...args);
  postMessage({value});
 }catch(e){postMessage({error:e.message||'Optimization failed'});}
};
