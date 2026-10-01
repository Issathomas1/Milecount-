/* Carrier economics and event-triggered planning; platform revenue is excluded. */
(function(root){
'use strict';
const finite=(x,name)=>{if(x==null||x===''||!Number.isFinite(Number(x))||Number(x)<0)throw Error('Verify '+name);return Number(x);};
function evaluate(plan,{mpg,fuelPrice,maintenanceCPM=0,guardrails={},nowMinutes=0}={}){
 const miles=finite(plan.miles,'road miles'),drive=finite(plan.drive,'drive minutes');
 const deadhead=finite(plan.deadhead,'deadhead miles');if(deadhead>miles)throw Error('Deadhead exceeds total road miles');
 mpg=finite(mpg,'MPG');if(!mpg)throw Error('Verify MPG');fuelPrice=finite(fuelPrice,'fuel price');
 const seen=new Set();let livePay=0,testPay=0,hasLive=false,hasTest=false;
 for(const l of plan.loads||[]){const k=root.MileCountTruckState.id(l);if(seen.has(k))continue;seen.add(k);const pay=finite(l.pay,'load pay');if(l.isSandbox||l.isLocalSim||l.mode==='TEST'||l.mode==='SIM'){hasTest=true;testPay+=pay;}else{hasLive=true;livePay+=pay;}}
 if(hasLive&&hasTest)throw Error('LIVE and TEST/SIM economics must be evaluated separately');
 const revenue=livePay+testPay,fuelCost=miles/mpg*fuelPrice,afterGas=revenue-fuelCost;
 const metrics={livePay,testPay,revenue,totalMiles:miles,deadheadMiles:deadhead,loadedMiles:miles-deadhead,fuelCost,afterGas,operatingMargin:afterGas-miles*finite(maintenanceCPM,'maintenance cost'),allMileRPM:miles?revenue/miles:null,revenuePerDrivingHour:drive?revenue/(drive/60):null,emptyPercent:miles?deadhead/miles*100:0};
 const issues=[],check=(key,value,test,text)=>{if(guardrails[key]!=null&&guardrails[key]!==''){const limit=finite(guardrails[key],key);if(value==null||test(value,limit))issues.push(text+' ('+limit+')');}};
 check('minRPM',metrics.allMileRPM,(v,l)=>v<l,'Below minimum all-mile RPM');check('minAfterGas',afterGas,(v,l)=>v<l,'Below minimum after-gas profit');check('minRevenueHour',metrics.revenuePerDrivingHour,(v,l)=>v<l,'Below minimum revenue/hour');check('maxDeadhead',deadhead,(v,l)=>v>l,'Exceeds maximum deadhead');check('maxEmptyPercent',metrics.emptyPercent,(v,l)=>v>l,'Exceeds empty-mile percentage');
 if(guardrails.maxDetour!=null){const detour=finite(plan.detourMiles,'detour miles');check('maxDetour',detour,(v,l)=>v>l,'Exceeds maximum detour');}
 if(guardrails.homeDeadlineMinutes!=null){if(!plan.finalDestination)issues.push('Home destination is required for a deadline');else check('homeDeadlineMinutes',finite(plan.time,'arrival time')+nowMinutes,(v,l)=>v>l,'Home deadline missed');}
 return {ok:!issues.length,issues,metrics};
}
function rank(plans,options){return plans.map(plan=>({plan,review:evaluate(plan,options)})).filter(x=>x.review.ok).sort((a,b)=>b.review.metrics.operatingMargin-a.review.metrics.operatingMargin||a.plan.miles-b.plan.miles);}
class Coordinator{
 constructor({brain,recalculate,searchProviders,onResult=()=>{}}){Object.assign(this,{brain,recalculate,searchProviders,onResult});this.generation=0;}
 async afterEvent(event){const state=this.brain.event(event),generation=++this.generation;
  const settled=await Promise.allSettled([this.recalculate(state),this.searchProviders(state)]);
  if(generation!==this.generation||state.version!==this.brain.get().version)return {stale:true};
  const result={truckVersion:state.version,route:settled[0].status==='fulfilled'?settled[0].value:null,inventory:settled[1].status==='fulfilled'?settled[1].value:null,errors:settled.filter(x=>x.status==='rejected').map(x=>x.reason?.message||'Dispatch service unavailable')};this.onResult(result);return result;
 }
}
const api={evaluate,rank,Coordinator};if(typeof module!=='undefined')module.exports=api;root.MileCountDispatchBrain=api;
})(typeof window!=='undefined'?window:globalThis);
