/* Car workspace adapter: shares the existing pickup/delivery solver, with cubic-foot
   capacity and driver-net economics. No provider credentials, bookings or freight state. */
(function(root){
'use strict';
const engine=typeof module==='object'?require('./pickup-delivery.js'):root.MileCountPickupDelivery;
const stateOf=s=>String(s||'').trim().match(/,\s*([A-Za-z]{2})(?:\s+\d{5}(?:-\d{4})?)?$/)?.[1].toUpperCase();
function number(v,name,fallback,min=0){const n=v===''||v==null?fallback:Number(v);if(!Number.isFinite(n)||n<min)throw Error('Check '+name+'.');return n;}
function prepare(draft){
 const s=draft.settings||{},start=String(s.start||'').trim(),home=String(s.home||start).trim(),state=stateOf(start);
 if(!state||stateOf(home)!==state)throw Error('Enter your start and finish with city, state (for example Atlanta, GA). Keep this local day in one state.');
 const startMinutes=Date.parse(s.departure)/60000;if(!Number.isFinite(startMinutes))throw Error('Choose a departure date and time.');
 const maxHours=number(s.hours,'available hours',4,.25),mpg=number(s.mpg,'MPG',25,1),gas=number(s.gas,'gas price',3.5),wear=number(s.wear,'wear per mile',.2),target=number(s.target,'hourly goal',20);
 if(maxHours>16)throw Error('Plan a shift of 16 hours or less.');
 const jobs=draft.jobs||[];if(!jobs.length)throw Error('Add an offer or try the demo first.');if(jobs.length>5)throw Error('Compare up to five offers at a time.');
 const ids=new Set();const loads=jobs.map((j,i)=>{
  if(!j.id||ids.has(j.id))throw Error('Each offer needs a unique reference.');ids.add(j.id);
  const pickup=String(j.pickup||'').trim(),delivery=String(j.delivery||'').trim();
  if(stateOf(pickup)!==state||stateOf(delivery)!==state)throw Error('Offer '+(i+1)+': pickup and delivery must stay in '+state+'.');
  const pay=number(j.pay,'offer pay',NaN);const weight=number(j.weight,'package weight',0),space=number(j.volume,'package volume',0),fee=number(j.fee,'offer fees',0),minutes=number(j.service,'minutes per stop',5);
  const windows={};for(const [type,field] of [['pickup','pickupBy'],['drop','deliverBy']])if(j[field]){const end=Date.parse(j[field])/60000;if(!Number.isFinite(end)||end<startMinutes)throw Error('Offer '+(i+1)+': deadline must be after departure.');windows[type]={start:startMinutes,end:end-minutes};}
  return {id:j.id,providerLoadId:j.id,provider:'Driver entered',name:j.name||'Package '+(i+1),pickup,delivery,pay,weight,space,fee,canStack:j.canStack===true,committed:j.committed===true,windows,services:{pickup:minutes,drop:minutes},isSandbox:!!draft.demo};
 });
 const input={loads,truck:{currentLocation:start,payload:number(s.payload,'available payload',200,1),cargoCapacity:number(s.volume,'available cargo volume',8,.1),onboardLoads:[]},startMinutes,finalDestination:home,homeDeadlineMinutes:startMinutes+maxHours*60,planningPreview:true,previewTiming:false,fuelCostPerMile:gas/mpg};
 return {problem:engine.problem(input),wear,target,overhead:number(s.overhead,'parking and tolls',0),capacityAssumed:s.payload===''||s.payload==null||s.volume===''||s.volume==null,demo:!!draft.demo};
}
function compare(draft,matrix){
 const config=prepare(draft),full=config.problem;full.matrix=matrix;
 if(!Array.isArray(matrix)||matrix.length!==full.locations.length)throw Error('Road estimates are incomplete. Try again.');
 const candidates=[],required=full.loads.filter(l=>l.committed).map(l=>l.id);
 for(let mask=1;mask<2**full.loads.length;mask++){
  const loads=full.loads.filter((_,i)=>mask&(2**i));if(required.some(id=>!loads.some(l=>l.id===id)))continue;
  if(loads.length>1&&loads.some(l=>!l.canStack))continue;
  const p={...full,loads};const r=engine.solve(p);if(!r.ok)continue;
  const fees=loads.reduce((sum,l)=>sum+l.fee,config.overhead),wearCost=r.miles*config.wear,net=r.totalPay-r.fuelCost-wearCost-fees,hours=(r.time-full.startMinutes)/60;
  const hourly=hours>0?net/hours:0,meetsGoal=net>0&&hourly>=config.target;
  candidates.push({...r,net,hourly,hours,fees,wearCost,meetsGoal,demo:config.demo,capacityAssumed:config.capacityAssumed,windowDetailsMissing:loads.some(l=>!l.windows.pickup||!l.windows.drop)});
 }
 candidates.sort((a,b)=>Number(b.meetsGoal)-Number(a.meetsGoal)||b.net-a.net||b.hourly-a.hourly||a.miles-b.miles);
 return {best:candidates[0]||null,alternatives:candidates.slice(1,3),compared:candidates.length,required,issues:candidates.length?[]:['No combination fits the supplied limits. Check deadlines, cargo capacity, available hours and stacking permission. Already accepted offers are always kept.']};
}
const api={prepare,compare,stateOf};root.MileCountCarPlanner=api;if(typeof module==='object')module.exports=api;
})(typeof window==='undefined'?globalThis:window);
