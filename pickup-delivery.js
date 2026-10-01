/* One immutable pickup/delivery problem. No DOM, map or network state in search. */
(function(root){
'use strict';
const EPS=1e-7;
const knownCapacity=v=>v!=null&&Number.isFinite(Number(v))&&Number(v)>0;
const loadLabel=l=>[l.pickup,l.delivery||l.stop].filter(Boolean).join(" → ")||l.name||"Selected load";
const isTest=l=>!!(l.isSandbox||l.isLocalSim||['TEST','SIM'].includes(l.mode));
const key=l=>l._mcLoadKey||String(l.providerLoadId||l.bookingReference||l.id||l.name||'')+'|'+String(l.provider||'');
function unique(loads){const m=new Map();for(const l of loads||[]){const k=key(l);if(!k||k==='|')throw Error('Each load needs a stable identity');if(!m.has(k))m.set(k,{...l,id:k,_mcLoadKey:k});}return [...m.values()];}
function problem(input){
 const loads=unique(input.loads), onboard=new Set((input.truck.onboardLoads||[]).map(key));
 const locations=[input.truck.currentLocation];
 const locate=x=>{if(!x)throw Error('Missing stop location');let i=locations.indexOf(x);if(i<0){i=locations.length;locations.push(x);}return i;};
 for(const l of loads){l.initialOnboard=onboard.has(l.id);l.p=l.initialOnboard?null:locate(l.pickup);l.d=locate(l.delivery||l.stop);}
 const home=input.finalDestination?locate(input.finalDestination):null;
 return {...input,loads,locations,home};
}
function capacity(p, picked, delivered){
 let weight=Number(p.truck.reservedWeight||0),space=Number(p.truck.reservedSpace||0);
 const onboard=[];p.loads.forEach((l,i)=>{if((picked&2**i)&&!(delivered&2**i)){weight+=knownCapacity(l.weight)?Number(l.weight):0;space+=knownCapacity(l.space)?Number(l.space):0;onboard.push(l.id);}});
 const capacityVerified=p.loads.every(l=>!onboard.includes(l.id)||(knownCapacity(l.weight)&&knownCapacity(l.space)));
 return {weight,space,onboard,capacityVerified,remainingWeight:p.truck.payload-weight,remainingSpace:p.truck.cargoCapacity-space};
}
function initial(p){let picked=0;p.loads.forEach((l,i)=>{if(l.initialOnboard)picked|=2**i;});const c=capacity(p,picked,0);return {picked,delivered:0,last:0,miles:0,deadhead:0,time:p.startMinutes||0,drive:0,duty:0,sinceBreak:Number(p.hos?.sinceBreakMinutes||0),events:[],...c};}
function leg(p,a,b){const x=p.matrix?.[a]?.[b];return x&&Number.isFinite(x.miles)&&x.miles>=0&&Number.isFinite(x.minutes)&&x.minutes>=0?x:null;}
function transition(p,s,i,type){
 const l=p.loads[i],bit=2**i;
 if(type==='pickup'?(s.picked&bit):(!(s.picked&bit)||(s.delivered&bit)))return null;
 const at=type==='pickup'?l.p:l.d,road=leg(p,s.last,at);if(!road)return null;
 let time=s.time,drive=s.drive,duty=s.duty,sinceBreak=s.sinceBreak;
 if(p.hos?.enabled){const breaks=Math.max(0,Math.ceil((sinceBreak+road.minutes)/p.hos.breakAfterMinutes)-1);time+=breaks*p.hos.breakMinutes;duty+=breaks*p.hos.breakMinutes;if(breaks)sinceBreak=(sinceBreak+road.minutes)-breaks*p.hos.breakAfterMinutes;else sinceBreak+=road.minutes;}else sinceBreak+=road.minutes;
 time+=road.minutes;drive+=road.minutes;duty+=road.minutes;
 const w=isTest(l)||p.previewTiming?null:l.windows?.[type];
 let waiting=0;
 if(w){const wait=Math.max(0,w.start-time);waiting=wait;time+=wait;duty+=wait;if(time>w.end+EPS)return null;}
 const service=Number(l.services?.[type]??p.serviceMinutes?.[type]??20);
 if(!Number.isFinite(service)||service<0)return null;
 const arrival=time;time+=service;duty+=service;if(p.hos?.enabled&&service+waiting>=p.hos.breakMinutes)sinceBreak=0;
 if((p.maxDriveMinutes!=null&&drive>p.maxDriveMinutes+EPS)||(p.hos?.enabled&&(drive>p.hos.maxDriveMinutes+EPS||duty>p.hos.maxDutyMinutes+EPS)))return null;
 const picked=type==='pickup'?s.picked|bit:s.picked,delivered=type==='drop'?s.delivered|bit:s.delivered;
 const c=capacity(p,picked,delivered);if(c.weight>p.truck.payload+EPS||c.space>p.truck.cargoCapacity+EPS)return null;
 const deadhead=s.deadhead+(s.onboard.length?0:road.miles);
 const event={type,location:p.locations[at],load:l,loadId:l.id,arrivalMinutes:arrival,departureMinutes:time,legMiles:road.miles,legMinutes:road.minutes,onboardWeight:c.weight,onboardSpace:c.space,capacityVerified:c.capacityVerified,onboardLoadIds:[...c.onboard],truckBrain:{currentLocation:p.locations[at],onboardLoadIds:[...c.onboard],onboardWeight:c.weight,onboardSpace:c.space,remainingWeight:c.remainingWeight,remainingSpace:c.remainingSpace},ok:true};
 return {...s,picked,delivered,last:at,miles:s.miles+road.miles,deadhead,time,drive,duty,sinceBreak,...c,events:[...s.events,event]};
}
function finish(p,s){
 if(p.home==null)return s;
 const road=leg(p,s.last,p.home);if(!road)return null;
 let time=s.time,duty=s.duty,drive=s.drive,sinceBreak=s.sinceBreak;
 if(p.hos?.enabled){const breaks=Math.max(0,Math.ceil((sinceBreak+road.minutes)/p.hos.breakAfterMinutes)-1);time+=breaks*p.hos.breakMinutes;duty+=breaks*p.hos.breakMinutes;if(breaks)sinceBreak=(sinceBreak+road.minutes)-breaks*p.hos.breakAfterMinutes;else sinceBreak+=road.minutes;}else sinceBreak+=road.minutes;
 time+=road.minutes;drive+=road.minutes;duty+=road.minutes;
 if((p.maxDriveMinutes!=null&&drive>p.maxDriveMinutes+EPS)||(p.hos?.enabled&&(drive>p.hos.maxDriveMinutes+EPS||duty>p.hos.maxDutyMinutes+EPS)))return null;
 if(p.homeDeadlineMinutes!=null&&time>p.homeDeadlineMinutes+EPS)return null;
 return {...s,last:p.home,time,drive,duty,sinceBreak,miles:s.miles+road.miles,deadhead:s.deadhead+(s.onboard.length?0:road.miles),events:[...s.events,{type:'home',location:p.locations[p.home],arrivalMinutes:time,departureMinutes:time,legMiles:road.miles,legMinutes:road.minutes,onboardWeight:s.weight,onboardSpace:s.space,ok:true}]};
}
const score=s=>s.miles+s.deadhead*.05; // Revenue is invariant across permutations. Geography dominates.
function summarize(p,s,extra={}){
 const livePay=p.loads.filter(l=>!isTest(l)).reduce((n,l)=>n+Number(l.pay||0),0),testPay=p.loads.filter(l=>isTest(l)).reduce((n,l)=>n+Number(l.pay||0),0);
 const totalPay=livePay+testPay,base=p.loads.find(l=>l.id===p.baseLoadId),basePay=Number(base?.pay||0),fuelCost=s.miles*Number(p.fuelCostPerMile||0);
 return {...s,...extra,planningPreview:p.planningPreview===true,timingVerified:!p.previewTiming,capacityVerified:p.loads.every(l=>knownCapacity(l.weight)&&knownCapacity(l.space)),loads:p.loads,routeStops:[p.truck.currentLocation,...s.events.map(e=>e.location)],livePay,testPay,totalPay,basePay,addedPay:totalPay-basePay,fuelCost,afterGas:totalPay-fuelCost,rpm:s.miles?totalPay/s.miles:0,startLocation:p.truck.currentLocation,freightEnd:[...s.events].reverse().find(e=>e.type==='drop')?.location||p.truck.currentLocation,finalDestination:p.finalDestination||null,score:score(s)};
}
function audit(p,events){
 let s=initial(p);const issues=[],seen=new Set();
 if(!p.planningPreview&&p.loads.some(l=>!knownCapacity(l.weight)||!knownCapacity(l.space)))issues.push('Capacity details are missing');
 if(!Number.isFinite(p.truck.payload)||!Number.isFinite(p.truck.cargoCapacity)||p.truck.payload<=0||p.truck.cargoCapacity<=0)issues.push('Truck capacity must be supplied');
 if(s.weight>p.truck.payload||s.space>p.truck.cargoCapacity)issues.push('Initial onboard capacity exceeded');
 for(const e of events||[]){
  if(!['pickup','drop','home'].includes(e.type)){issues.push('Unknown event type');continue;}
  if(e.type==='home'){if(e!==events.at(-1)||s.delivered!==(2**p.loads.length-1)||p.home==null||e.location!==p.locations[p.home])issues.push('Home must follow all deliveries and match the requested destination');else {const done=finish(p,s);if(!done)issues.push('Home leg violates road or driving constraints');else s=done;}continue;}
  const i=p.loads.findIndex(l=>l.id===(e.loadId||key(e.load||{}))),k=(e.loadId||key(e.load||{}))+':'+e.type;
  if(i<0){issues.push('Stale/orphan load in route');continue;}
  if(seen.has(k)){issues.push('Duplicate '+e.type+' for '+p.loads[i].id);continue;}seen.add(k);
  if(e.location!==p.locations[e.type==='pickup'?p.loads[i].p:p.loads[i].d]){issues.push('Stop location does not match load');continue;}
  const next=transition(p,s,i,e.type);if(!next){issues.push('Illegal precedence, capacity, road leg, appointment or HOS at '+e.location);continue;}s=next;
 }
 p.loads.forEach(l=>{if(!l.initialOnboard&&!seen.has(l.id+':pickup'))issues.push('Missing pickup '+l.id);if(!seen.has(l.id+':drop'))issues.push('Missing delivery '+l.id);});
 if(p.home!=null&&events?.at(-1)?.type!=='home')issues.push('Missing home/final stop');
 if(s.weight>Number(p.truck.payload)||s.space>Number(p.truck.cargoCapacity))issues.push('Initial truck capacity exceeded');
 return {ok:issues.length===0,issues,result:summarize(p,s)};
}
function solve(p,opts={}){
 if(p.homeDeadlineMinutes!=null&&(!Number.isFinite(p.homeDeadlineMinutes)||p.home==null))return {ok:false,issues:['A valid home destination and deadline are required'],conflicts:[]};
 if(p.loads.some(isTest)&&p.loads.some(l=>!isTest(l)))return {ok:false,issues:['LIVE and TEST/SIM freight must be planned separately'],conflicts:[]};
 if(!Number.isFinite(p.truck.payload)||!Number.isFinite(p.truck.cargoCapacity)||p.truck.payload<=0||p.truck.cargoCapacity<=0)return {ok:false,issues:['Truck payload and cargo capacity must be supplied'],conflicts:[]};
 if(!Number.isFinite(p.startMinutes))return {ok:false,issues:['A valid trip start time is required'],conflicts:[]};
 const badWindows=p.loads.filter(l=>!p.previewTiming&&!isTest(l)&&Object.values(l.windows||{}).some(w=>!Number.isFinite(w.start)||!Number.isFinite(w.end)||w.end<w.start));
 if(badWindows.length)return {ok:false,issues:badWindows.map(l=>'Verify appointment bounds for '+loadLabel(l)),conflicts:badWindows.map(l=>l.id)};
 const invalid=p.loads.filter(l=>!Number.isFinite(Number(l.weight))||Number(l.weight)<=0||!Number.isFinite(Number(l.space))||Number(l.space)<=0);
 if(invalid.length&&!p.planningPreview)return {ok:false,issues:invalid.map(l=>'Verify weight and cargo space for '+loadLabel(l)),conflicts:invalid.map(l=>l.id)};
 if(p.loads.some(l=>Number(l.weight)<0||Number(l.space)<0))return {ok:false,issues:['Weight and cargo space cannot be negative'],conflicts:[]};
 if(p.loads.length>15)return {ok:false,issues:['Split stacks above 15 loads into smaller dispatch plans'],conflicts:[]};
 const init=initial(p);if(init.weight>p.truck.payload||init.space>p.truck.cargoCapacity)return {ok:false,issues:['Actual onboard freight exceeds truck capacity'],conflicts:[]};
 const all=2**p.loads.length-1,exact=p.loads.length<=6,beamWidth=opts.beamWidth||1800;
 let frontier=[init],best=null,expanded=0,truncated=false;
 const dominates=(a,b)=>score(a)<=score(b)+EPS&&a.time<=b.time+EPS&&a.drive<=b.drive+EPS&&a.duty<=b.duty+EPS&&a.sinceBreak<=b.sinceBreak+EPS&&a.duty-a.time<=b.duty-b.time+EPS;
 for(let depth=0;depth<=p.loads.length*2;depth++){
  const buckets=new Map();
  for(const s of frontier){
   if(s.delivered===all){const done=finish(p,s);if(done&&(!best||score(done)<score(best)))best=done;continue;}
   for(let i=0;i<p.loads.length;i++)for(const type of ['pickup','drop']){
    const next=transition(p,s,i,type);expanded++;if(!next)continue;
    if(best&&score(next)>score(best)+EPS)continue;
    const k=next.picked+':'+next.delivered+':'+next.last,labels=buckets.get(k)||[];
    if(labels.some(x=>dominates(x,next)))continue;
    buckets.set(k,[...labels.filter(x=>!dominates(next,x)),next]);
   }
  }
  frontier=[...buckets.values()].flat();
  if(!exact&&frontier.length>beamWidth){frontier.sort((a,b)=>score(a)-score(b));frontier=frontier.slice(0,beamWidth);truncated=true;}
  if(!frontier.length)break;
 }
 if(!best)return {ok:false,issues:['No sequence meets capacity, real appointments, road connectivity and configured driving limits'],conflicts:[] ,expanded};
 const check=audit(p,best.events);if(!check.ok)return {ok:false,issues:check.issues,conflicts:[]};
 return {ok:true,...summarize(p,best),audit:check,expanded,optimal:exact&&!truncated,method:exact?'Pareto-label dynamic programming':'bounded beam search'};
}
function paired(p){let s=initial(p);for(let i=0;i<p.loads.length;i++){if(!p.loads[i].initialOnboard)s=transition(p,s,i,'pickup');if(!s)return null;s=transition(p,s,i,'drop');if(!s)return null;}s=finish(p,s);return s?summarize(p,s):null;}
function alternatives(p){
 const results=[],pair=paired(p);if(pair)results.push({name:'pickup/drop pairs',...pair});
 for(const pickupFirst of [true,false]){
  let s=initial(p);while(s.delivered!==2**p.loads.length-1){let choices=[];p.loads.forEach((l,i)=>{for(const t of ['pickup','drop']){const n=transition(p,s,i,t);if(n)choices.push(n);}});if(!choices.length){s=null;break;}
   if(pickupFirst&&choices.some(x=>x.events.at(-1).type==='pickup'))choices=choices.filter(x=>x.events.at(-1).type==='pickup');choices.sort((a,b)=>a.events.at(-1).legMiles-b.events.at(-1).legMiles);s=choices[0];}
  if(s){s=finish(p,s);if(s)results.push({name:pickupFirst?'legal pickup-first':'nearest legal stop',...summarize(p,s)});}
 }
 return results;
}
function optimize(p,opts={}){
 let best=solve(p,opts);if(!best.ok)return best;
 const compared=alternatives(p);for(const alt of compared)if(score(alt)+EPS<best.score){const checked=audit(p,alt.events);if(checked.ok)best={...best,...checked.result,optimal:false,method:'audited alternate sequence'};}
 if(best.afterGas<0&&!p.planningPreview)return {ok:false,issues:['The entire selected trip pays less than its estimated fuel cost'],conflicts:[],uneconomic:best};
 return {...best,comparisons:compared.map(x=>({name:x.name,miles:x.miles,score:x.score,order:x.events.map(e=>e.type+' '+e.location)}))};
}
function economicReview(p,result){
 const protectedIds=new Set([p.baseLoadId,...(p.committedLoadIds||[]),...p.loads.filter(l=>l.initialOnboard).map(l=>l.id)].filter(Boolean));
 let recommendation=null;
 for(const l of p.loads){if(protectedIds.has(l.id)||p.loads.length<2)continue;
  const alt=solve({...p,loads:p.loads.filter(x=>x.id!==l.id)});
  if(alt.ok&&alt.afterGas>result.afterGas+10&&(!recommendation||alt.afterGas>recommendation.plan.afterGas))recommendation={removed:l,removedLoads:[l],plan:alt,
   reason:'Removing '+l.pickup+' → '+(l.delivery||l.stop)+' saves '+Math.round(result.miles-alt.miles)+' road miles and improves estimated after-gas margin by $'+Math.round(alt.afterGas-result.afterGas)+'. Its pay does not cover its added fuel.'};
 }
 return recommendation;
}
function recommend(p){
 const protectedIds=new Set([p.baseLoadId,...(p.committedLoadIds||[]),...p.loads.filter(l=>l.initialOnboard).map(l=>l.id)].filter(Boolean));
 let best=null;
 for(const l of p.loads){if(protectedIds.has(l.id))continue;
  const subset={...p,loads:p.loads.filter(x=>x.id!==l.id)},r=optimize(subset);if(!r.ok)continue;
  if(!best||r.afterGas>best.plan.afterGas)best={removed:l,plan:r,reason:'Removing '+l.pickup+' → '+(l.delivery||l.stop)+' permits a legal trip under the supplied capacity, appointments and driving limits.'};
 }
 if(best)return {...best,removedLoads:[best.removed]};
 const optional=p.loads.filter(l=>!protectedIds.has(l.id)).sort((a,b)=>Number(a.pay||0)-Number(b.pay||0));
 const removed=[];let remaining=[...p.loads];
 for(const l of optional){removed.push(l);remaining=remaining.filter(x=>x.id!==l.id);if(!remaining.length)break;const plan=optimize({...p,loads:remaining});if(plan.ok)return {removed:l,removedLoads:[...removed],plan,reason:'Remove '+removed.map(x=>x.pickup+' → '+(x.delivery||x.stop)).join('; ')+' to meet supplied capacity, appointment and driving constraints.'};}
 return null;
}
const api={key,unique,problem,capacity,initial,transition,audit,solve,optimize,recommend,economicReview,paired,alternatives};
if(typeof module!=='undefined'&&module.exports)module.exports=api;root.MileCountPickupDelivery=api;
})(typeof window!=='undefined'?window:globalThis);
