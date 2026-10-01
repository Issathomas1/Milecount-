/* Physical truck state. Plans never advance this state. Units: lb and ft. */
(function(root){
'use strict';
const clone=x=>JSON.parse(JSON.stringify(x));
const id=l=>l._mcLoadKey||String(l.id||l.providerLoadId||l.bookingReference||l.name||'')+'|'+String(l.provider||'');
const numberFields=['gvwrLb','payloadLb','emptyWeightLb','cargoLengthFt','heightFt','widthFt','vehicleLengthFt','axleCount','axleWeightLb','trailerCount'];
function profile(raw={}){
 const p={type:raw.type||'',commercial:raw.commercial===true,hazmat:typeof raw.hazmat==='boolean'?raw.hazmat:null,tollPreference:raw.tollPreference||'allow',avoidFerries:raw.avoidFerries===true};
 for(const k of numberFields)p[k]=raw[k]==null||raw[k]===''?null:Number(raw[k]);
 return p;
}
function validateProfile(raw){
 const p=profile(raw),issues=[];
 if(!['cargo-van','box-truck','straight-truck','tractor-trailer'].includes(p.type))issues.push('Verify commercial truck type');
 if(!p.commercial)issues.push('Commercial vehicle status is required');
 for(const k of numberFields.filter(x=>!['axleWeightLb','trailerCount'].includes(x)))if(!Number.isFinite(p[k])||p[k]<=0)issues.push('Verify '+k);
 if(!Number.isInteger(p.axleCount)||p.axleCount<2)issues.push('Verify axle count');
 if(!Number.isInteger(p.trailerCount)||p.trailerCount<0)issues.push('Verify trailer count');
 if(p.axleWeightLb!=null&&(!Number.isFinite(p.axleWeightLb)||p.axleWeightLb<=0))issues.push('Verify axle weight');
 if(p.hazmat==null)issues.push('Verify hazmat status');
 if(!['allow','avoid'].includes(p.tollPreference))issues.push('Verify toll preference');
 if(p.emptyWeightLb>=p.gvwrLb)issues.push('Empty operating weight must be below GVWR');
 if(p.emptyWeightLb+p.payloadLb>p.gvwrLb)issues.push('Payload plus empty operating weight exceeds GVWR');
 if(p.cargoLengthFt>p.vehicleLengthFt)issues.push('Cargo length exceeds total vehicle length');
 return {ok:!issues.length,issues,profile:p};
}
function totals(loads){return loads.reduce((a,l)=>({weight:a.weight+Number(l.weight),space:a.space+Number(l.space)}),{weight:0,space:0});}
function checkLoads(loads){const seen=new Set();for(const l of loads){if(l.isSandbox||l.isLocalSim||['TEST','SIM'].includes(l.mode))throw Error('Simulation cannot enter physical Truck Brain');const k=id(l);if(!k||k==='|'||seen.has(k))throw Error('Missing or duplicate onboard load identity');seen.add(k);if(!Number.isFinite(Number(l.weight))||Number(l.weight)<=0||!Number.isFinite(Number(l.space))||Number(l.space)<=0)throw Error('Verify load weight and cargo space');}}
class Brain{
 constructor(state={},persist=()=>{}){this.persist=persist;this.state={version:0,profile:profile(),currentLocation:null,onboardLoads:[],commitments:[],completedLoadIds:[],eventIds:[],homeLocation:null,homeDeadline:null,duty:null,guardrails:{},...clone(state)};this.state.profile=profile(this.state.profile);checkLoads(this.state.onboardLoads);}
 get(){const s=clone(this.state),t=totals(s.onboardLoads);return {...s,onboardWeight:t.weight,onboardSpace:t.space,currentGrossWeightLb:s.profile.emptyWeightLb==null?null:s.profile.emptyWeightLb+t.weight,remainingWeight:s.profile.payloadLb==null?null:s.profile.payloadLb-t.weight,remainingSpace:s.profile.cargoLengthFt==null?null:s.profile.cargoLengthFt-t.space};}
 commit(next){checkLoads(next.onboardLoads);const t=totals(next.onboardLoads),p=next.profile;if(p.payloadLb!=null&&t.weight>p.payloadLb||p.cargoLengthFt!=null&&t.space>p.cargoLengthFt||p.gvwrLb!=null&&p.emptyWeightLb!=null&&p.emptyWeightLb+t.weight>p.gvwrLb)throw Error('Truck capacity or GVWR exceeded');next.version=this.state.version+1;next.updatedAt=new Date().toISOString();this.persist(clone(next));this.state=next;return this.get();}
 setProfile(raw){const v=validateProfile(raw);if(!v.ok)throw Error(v.issues.join(' • '));return this.commit({...clone(this.state),profile:v.profile});}
 setActual(currentLocation,onboardLoads){if(!currentLocation)throw Error('Actual truck location is required');return this.commit({...clone(this.state),currentLocation:clone(currentLocation),onboardLoads:clone(onboardLoads)});}
 configure(values){const allowed=['homeLocation','homeDeadline','duty','guardrails','commitments'];const n=clone(this.state);for(const k of allowed)if(k in values)n[k]=clone(values[k]);return this.commit(n);}
 event(event){
  if(!event.eventId||!event.location||!['pickup','drop'].includes(event.type))throw Error('Event identity, actual location and pickup/drop type are required');
  if(this.state.eventIds.includes(event.eventId))return this.get();
  const n=clone(this.state),k=id(event.load||{}),i=n.onboardLoads.findIndex(l=>id(l)===k);
  if(event.type==='pickup'){if(event.load?.isSandbox||event.load?.isLocalSim||['TEST','SIM'].includes(event.load?.mode))throw Error('Simulation cannot change physical Truck Brain');if(event.load?.hazmat===true&&n.profile.hazmat!==true)throw Error('Update hazmat status before pickup');if(i>=0||n.completedLoadIds.includes(k))throw Error('Load already picked up or delivered');checkLoads([event.load]);n.onboardLoads.push(clone(event.load));}
  else{if(i<0)throw Error('Cannot deliver a load that is not onboard');n.onboardLoads.splice(i,1);n.completedLoadIds.push(k);n.commitments=n.commitments.filter(l=>id(l)!==k);}
  n.currentLocation=clone(event.location);n.eventIds.push(event.eventId);return this.commit(n);
 }
}
const api={Brain,profile,validateProfile,totals,id};if(typeof module!=='undefined')module.exports=api;root.MileCountTruckState=api;
})(typeof window!=='undefined'?window:globalThis);
