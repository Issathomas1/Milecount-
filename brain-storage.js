/* Per-account/per-vehicle persistence with optimistic cloud version checks. */
(function(root){
'use strict';
const clone=x=>JSON.parse(JSON.stringify(x));
class Repository{
 constructor({storage,cloud,userId='guest',vehicleKey='vehicle1',onStatus=()=>{}}){Object.assign(this,{storage,cloud,userId,vehicleKey,onStatus});this.key='milecountTruckBrain:'+userId+':'+vehicleKey;this.cloudVersion=0;this.queue=Promise.resolve();this.cloudEnabled=userId!=='guest'&&!!cloud;}
 local(){try{return JSON.parse(this.storage.getItem(this.key)||'null');}catch(e){throw Error('Saved truck state cannot be read; restore it before dispatching');}}
 async load(){const local=this.local();if(!this.cloudEnabled)return local?.state||{};
  try{const remote=await this.cloud.load(this.vehicleKey);this.cloudVersion=remote?.version||0;
   if(local?.dirty){if(local.cloudVersion!==this.cloudVersion){this.cloudEnabled=false;this.onStatus('Cloud conflict: this device has unsynced events. Reconcile both states before syncing.');return local.state;}return local.state;}
   if(remote?.state){this.storage.setItem(this.key,JSON.stringify({state:remote.state,cloudVersion:this.cloudVersion,dirty:false}));this.onStatus('Truck state synced');return remote.state;}
   return local?.state||{};
  }catch(e){this.cloudEnabled=false;this.onStatus('Truck state is saved on this device only • '+e.message);return local?.state||{};}
 }
 save(state){const snapshot=clone(state);this.storage.setItem(this.key,JSON.stringify({state:snapshot,cloudVersion:this.cloudVersion,dirty:this.userId!=='guest'}));
  if(!this.cloudEnabled){this.onStatus('Truck state saved on this device only');return;}
  this.queue=this.queue.then(async()=>{if(!this.cloudEnabled)return;try{this.cloudVersion=await this.cloud.save(this.vehicleKey,this.cloudVersion,snapshot);const current=this.local(),same=(current.state.revision??current.state.version)===(snapshot.revision??snapshot.version);this.storage.setItem(this.key,JSON.stringify({...current,cloudVersion:this.cloudVersion,dirty:!same}));this.onStatus(same?'Truck state synced':'Truck state sync pending');}catch(e){this.cloudEnabled=false;this.onStatus('Cloud sync paused; local state retained • '+e.message);}});
 }
}
if(typeof module!=='undefined')module.exports={Repository};root.MileCountBrainStorage={Repository};
})(typeof window!=='undefined'?window:globalThis);
