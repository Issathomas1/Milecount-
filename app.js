window.mcTripStorageKey="mcOriginalTrips:guest";(async()=>{try{const s=await window.MileCountCloud?.session?.();if(s?.user?.id)window.mcTripStorageKey="mcOriginalTrips:"+s.user.id}catch(e){}})();
/*
MileCount App Engine V2
Stable buttons + simulated AutoStack optimizer + routing + fuel
*/
(function(){
"use strict";
const S={primaryPay:1400,addedPay:0,totalPay:1400,returnPay:0,extraMiles:0,roundTripMiles:0,homeAdded:false,origin:"Atlanta, GA",destination:"Charlotte, NC",home:"Atlanta, GA",selectedStop:"Greenville, SC",liveOnlyBrowse:false,stayHomeAfterSearch:false};
function mcCanonicalLocation(value,fallback=""){
 const raw=String(value||"").trim(),fb=String(fallback||"").trim();
 if(!raw)return fb;
 if(raw.includes(","))return raw.replace(/\s*,\s*/,", ");
 if(fb&&fb.includes(",")&&fb.split(",")[0].trim().toLowerCase()===raw.toLowerCase())return fb;
 return raw;
}
let physicalBrain=null,brainAccount='loading',brainLoadGeneration=0;
function syncTruckBrain(reason="sync"){
 let canonical=physicalBrain?.get();
 const pending=[...new Map([...(S.basePlanLoad?[S.basePlanLoad]:[]),...stackSelectedLoads(),...(S.planCommitments||[]),...(canonical?.onboardLoads||[])].map(l=>[loadKey(l),l])).values()].filter(l=>!canonical?.completedLoadIds?.includes(window.MileCountTruckState?.id(l)));
 if(physicalBrain&&['autostack-start','stack-selection','home-selected'].includes(reason)){physicalBrain.configure({commitments:pending,baseLoadId:S.basePlanLoad?loadKey(S.basePlanLoad):null});canonical=physicalBrain.get();}
 const cap=currentCapacity(),actual=canonical?.currentLocation?canonical:S.executionState||{};
 // A proposed route is a projection, never evidence that the truck moved.
 const onboardLoads=Array.isArray(actual.onboardLoads)?actual.onboardLoads:[];
 const onboardWeight=onboardLoads.reduce((n,l)=>n+Number(l.weight||0),0);
 const onboardSpace=onboardLoads.reduce((n,l)=>n+Number(l.space||0),0);
 const current=mcCanonicalLocation(actual.currentLocation||(S.smartDispatchLocationEnabled?S.smartDispatchOrigin:"")||el("from")?.value||S.origin,S.origin);
 const committedLoads=canonical?.commitments||pending;
 S.truckBrain={version:canonical?.version||0,commercialProfile:canonical?.profile||null,currentGrossWeightLb:canonical?.currentGrossWeightLb??null,actualLocationVerified:!!actual.currentLocation,guardrails:canonical?.guardrails||{},homeDeadline:canonical?.homeDeadline||null,duty:canonical?.duty||null,currentLocation:current,homeLocation:mcCanonicalLocation(canonical?.homeLocation||S.home, S.origin),
  finalDestination:canonical?.homeLocation?mcCanonicalLocation(canonical.homeLocation):S.homeChosen||S.localMoneyMode?mcCanonicalLocation(el("tripHomeChoice")?.value||S.home,S.origin):null,
  onboardLoads:[...onboardLoads],onboardWeight,onboardSpace,
  payload:cap.maxWeight,cargoCapacity:cap.maxSpace,
  // User-entered available capacity can reserve room for unmodeled cargo.
  reservedWeight:Math.max(0,cap.maxWeight-cap.availableWeight-onboardWeight),
  reservedSpace:Math.max(0,cap.maxSpace-cap.availableSpace-onboardSpace),
  availableWeight:Math.max(0,Math.min(cap.availableWeight,cap.maxWeight-onboardWeight)),availableSpace:Math.max(0,Math.min(cap.availableSpace,cap.maxSpace-onboardSpace)),
  committedLoads,committedPickups:committedLoads.filter(l=>!onboardLoads.some(x=>loadKey(x)===loadKey(l))),
  committedDeliveries:committedLoads,plannedFreightEnd:S.stackPlan?.freightEnd||null,
  currentPlan:canonical?.projection&&canonical.projection.inputVersion===canonical.version?canonical.projection.plan:null,inventory:canonical?.inventory||null,bookings:canonical?.bookings||{},completedLoads:canonical?.completedLoads||[],
  finalRouteStops:[...(canonical?.projection?.plan?.routeStops||S.finalRouteStops||[])],updatedAt:Date.now(),reason};
 return S.truckBrain;
}
function truckBrain(){return syncTruckBrain("read")}
window.MileCountTruckBrain={get:()=>truckBrain(),setActualState:state=>{
 if(!state?.currentLocation||!Array.isArray(state.onboardLoads))throw Error('Actual location and onboard loads are required');
 if(state.onboardLoads.some(l=>!Number.isFinite(Number(l.weight))||Number(l.weight)<=0||!Number.isFinite(Number(l.space))||Number(l.space)<=0))throw Error('Verify onboard weight and space first');
 if(!physicalBrain)throw Error('Truck Brain is loading');physicalBrain.setActual(state.currentLocation,state.onboardLoads);S.capacityState=null;if(el('weight'))el('weight').value=physicalBrain.get().remainingWeight;if(el('space'))el('space').value=physicalBrain.get().remainingSpace;
 S.executionState={currentLocation:state.currentLocation,onboardLoads:state.onboardLoads.map(l=>({...l}))};
 invalidateStackProjection('Actual truck state changed — recalculating.');scheduleContinuousDispatch('location');return syncTruckBrain('actual-state');
}};
window.MileCountTruckBrain.setProfile=raw=>{if(!physicalBrain)throw Error('Truck Brain is loading');physicalBrain.setProfile(raw);S.capacityState=null;if(el('weight'))el('weight').value=physicalBrain.get().remainingWeight;if(el('space'))el('space').value=physicalBrain.get().remainingSpace;invalidateStackProjection('Truck profile changed — recalculating.');scheduleContinuousDispatch('profile');return truckBrain();};
window.MileCountTruckBrain.configure=values=>{if(!physicalBrain)throw Error('Truck Brain is loading');physicalBrain.configure(values);if('homeLocation' in values){S.home=values.homeLocation;S.homeChosen=!!values.homeLocation;if(el('tripHomeChoice'))el('tripHomeChoice').value=values.homeLocation||'';}invalidateStackProjection('Dispatch rules changed — recalculating.');scheduleContinuousDispatch('rules');return truckBrain();};
window.MileCountTruckBrain.recordEvent=async event=>{
 if(!physicalBrain)throw Error('Truck Brain is loading');const before=physicalBrain.get().version,state=physicalBrain.event(event);if(state.version===before)return truckBrain();
 S.executionState=state;S.capacityState=null;if(el('weight'))el('weight').value=state.remainingWeight;if(el('space'))el('space').value=state.remainingSpace;
 S.planCommitments=(S.planCommitments||[]).filter(l=>event.type!=='drop'||loadKey(l)!==loadKey(event.load));
 if(event.type==='drop'){selectedStackKeys.delete(loadKey(event.load));if(S.basePlanLoad&&loadKey(S.basePlanLoad)===loadKey(event.load))S.basePlanLoad=null;}
 const remainingCommitments=[...(S.planCommitments||[])];invalidateStackProjection('Truck event recorded — recalculating.');S.planCommitments=remainingCommitments;
 if(stackSelectedLoads().length||S.planCommitments?.length||S.basePlanLoad||state.onboardLoads.length||state.homeLocation){await smartAutoStack();if(S.stackPlan?.valid)await finishAutoStack();}
 // Refresh and compare complete plans after every physical event.
 if(window.MileCountDispatchPlanner)await refreshDispatchRecommendations('dispatch');
 document.dispatchEvent(new Event('milecount:plan-changed'));
 return truckBrain();
};
window.MileCountTruckBrain.initialize=async()=>{
 if(!window.MileCountTruckState)return;
 const generation=++brainLoadGeneration,session=await window.MileCountCloud?.session?.(),account=session?.user?.id||'guest';
 const repository=new window.MileCountBrainStorage.Repository({storage:localStorage,userId:account,vehicleKey:'vehicle1',cloud:session?{load:key=>window.MileCountCloud.loadTruckBrain(key),save:(key,version,state)=>window.MileCountCloud.saveTruckBrain(key,version,state)}:null,onStatus:message=>{window.MileCountBrainSyncStatus=message;document.dispatchEvent(new Event('milecount:brain-sync'));}});
 let stored;try{stored=await repository.load();}catch(e){window.MileCountBrainSyncStatus=e.message;document.dispatchEvent(new Event('milecount:brain-sync'));throw e;}if(generation!==brainLoadGeneration)return;
 brainAccount=account;physicalBrain=new window.MileCountTruckState.Brain(stored,state=>repository.save(state));
 S.executionState=physicalBrain.get();S.capacityState=null;S.planCommitments=[...S.executionState.commitments];S.basePlanLoad=S.planCommitments.find(l=>loadKey(l)===S.executionState.baseLoadId)||null;
 if(S.executionState.homeLocation){S.home=S.executionState.homeLocation;S.homeChosen=true;}
 if(S.executionState.currentLocation&&el("from"))el("from").value=S.executionState.currentLocation;
};
window.MileCountTruckBrain.claim=async(load,claimed=true)=>{if(!physicalBrain)throw Error('Truck Brain is loading');physicalBrain.claim(load,claimed);S.planCommitments=[...physicalBrain.get().commitments];invalidateStackProjection('Carrier booking status changed — recalculating.');scheduleContinuousDispatch('claim');return truckBrain();};
window.MileCountTruckBrain.ready=window.MileCountTruckBrain.initialize();window.MileCountTruckBrain.ready.catch(()=>{});
const MILECOUNT_PLANS={
 basic:{name:"Basic",price:19,maxTrucks:1,maxStack:3,dispatcher:false,strongFit:false,autoCorrect:false},
 gold:{name:"Gold Pro",price:39,maxTrucks:1,maxStack:5,dispatcher:true,strongFit:true,autoCorrect:false},
 premium:{name:"Premium Pro",price:69,maxTrucks:1,maxStack:10,dispatcher:true,strongFit:true,autoCorrect:true},
 platinum:{name:"Platinum Pro",price:129,maxTrucks:5,maxStack:15,dispatcher:true,strongFit:true,autoCorrect:true,fleet:true}
};
let mcOwnerAccess=false,mcVerifiedPlan="basic";
function currentPlanKey(){return mcOwnerAccess?"platinum":mcVerifiedPlan}
function currentPlan(){return mcOwnerAccess?{...MILECOUNT_PLANS.platinum,name:"OWNER • FULL ACCESS",maxTrucks:Infinity,maxStack:Infinity}:MILECOUNT_PLANS[currentPlanKey()]||MILECOUNT_PLANS.basic}
async function syncOwnerAccess(){
 try{
   const s=await window.MileCountCloud?.session?.();
   // Owner access is granted from the authenticated account's admin role,
   // never from a client-side email comparison or localStorage flag.
   mcOwnerAccess=!!(s?.user&&await window.MileCountCloud?.isAdmin?.());
   try{const entitlement=await window.MileCountCloud?.entitlements?.();mcVerifiedPlan=entitlement?.active&&MILECOUNT_PLANS[entitlement.plan]?entitlement.plan:'basic';}catch(e){mcVerifiedPlan='basic';}
   document.documentElement.dataset.ownerAccess=mcOwnerAccess?"true":"false";
 }catch(e){mcOwnerAccess=false;mcVerifiedPlan="basic"}
 return mcOwnerAccess;
}
function requirePlan(feature){
 const p=currentPlan();
 if(feature==="dispatcher"&&!p.dispatcher||feature==="strongFit"&&!p.strongFit||feature==="autoCorrect"&&!p.autoCorrect||feature==="fleet"&&!p.fleet){
   const box=el("upgradePrompt");if(box){box.classList.remove("hidden");box.innerHTML='<b>UPGRADE MILECOUNT</b><span>'+p.name+' does not include this feature. Compare Pro plans to unlock it.</span><a href="pricing.html">VIEW PLANS</a>'}
   return false;
 }
 return true;
}

const el=id=>document.getElementById(id);
const val=(id,f=0)=>{const n=Number(el(id)?.value);return Number.isFinite(n)?n:f};
const money=v=>{const n=Math.round(Number(v)||0);return (n<0?"-$":"$")+Math.abs(n).toLocaleString()};
function withTimeout(p,ms,fallback=null){
 let timer;
 return Promise.race([p,new Promise(resolve=>{timer=setTimeout(()=>resolve(fallback),ms)})]).finally(()=>clearTimeout(timer));
}
async function forEachConcurrent(items,limit,fn){
 let next=0;
 await Promise.all(Array.from({length:Math.min(limit,items.length)},async()=>{
  while(next<items.length){const i=next++;await fn(items[i],i)}
 }));
}
let loadSearchGeneration=0;

let busyCount=0;
function setBusy(on,message="One moment — working…"){
 busyCount=Math.max(0,busyCount+(on?1:-1));
 const active=busyCount>0,bar=el("globalBusy"),text=el("globalBusyText");
 if(text&&on)text.textContent=message;
 if(bar)bar.classList.toggle("active",active);
 document.body.classList.toggle("mcBusy",active);
}
function setButtonBusy(id,on,busyText,normalText){
 const b=el(id);if(!b)return;
 b.disabled=!!on;
 if(on){b.dataset.normalText=b.textContent;b.textContent=busyText}
 else b.textContent=normalText||b.dataset.normalText||b.textContent;
}

function isRoutableLocation(v){
 const s=String(v||"").trim().toLowerCase();
 return !!s && !["anywhere, usa","anywhere","nationwide","usa"].includes(s);
}
function dateISOPlus(days){
 const d=new Date();d.setDate(d.getDate()+days);return [d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-");
}

const SEARCH_KEY="milecount:driver-search:v1";
function saveDriverSearch(){
 try{
  localStorage.setItem(SEARCH_KEY,JSON.stringify({
   from:el("from")?.value||"",
   to:el("to")?.value||"",
   vehicleType:el("vehicleType")?.value||"box26",
   maxDeadhead:el("maxDeadhead")?.value||"100",
   minRPM:el("minRPM")?.value||"1.75",
   pickupDate:el("pickupDate")?.value||""
  }));
 }catch(e){}
}
function restoreDriverSearch(){
 try{
  const x=JSON.parse(localStorage.getItem(SEARCH_KEY)||"null");
  if(!x)return;
  if(el("from")&&x.from)el("from").value=x.from;
  if(el("to")&&x.to)el("to").value=x.to;
  if(el("vehicleType")&&x.vehicleType)el("vehicleType").value=x.vehicleType;
  if(el("maxDeadhead")&&x.maxDeadhead!=null)el("maxDeadhead").value=x.maxDeadhead;
  if(el("minRPM")&&x.minRPM!=null)el("minRPM").value=x.minRPM;
  if(el("pickupDate")&&x.pickupDate)el("pickupDate").value=x.pickupDate;
 }catch(e){}
}
async function roadMilesBetween(a,b){
 if(!a||!b||a===b)return 0;
 try{
  if(typeof getMileCountRoadRoute==="function"){
   const r=await getMileCountRoadRoute([a,b]);
   if(Number.isFinite(Number(r?.miles)))return Number(r.miles);
  }
 }catch(e){}
 try{
  if(typeof calculateMileCountDetour==="function"){
   const r=await calculateMileCountDetour(a,b,[]);
   if(Number.isFinite(Number(r?.routeMiles)))return Number(r.routeMiles);
  }
 }catch(e){}
 return null;
}

const VEHICLES={
 cargo:{name:"Cargo Van",mpg:18,cargoLength:10,payload:3500,costPerMile:.35,defaultSpace:10,defaultWeight:3000},
 sprinter:{name:"Sprinter / High-Roof Van",mpg:16,cargoLength:14,payload:4000,costPerMile:.40,defaultSpace:14,defaultWeight:3500},
 box16:{name:"16-ft Box Truck",mpg:12,cargoLength:16,payload:7000,costPerMile:.50,defaultSpace:12,defaultWeight:5500},
 box20:{name:"20-ft Box Truck",mpg:10.5,cargoLength:20,payload:8500,costPerMile:.58,defaultSpace:14,defaultWeight:6200},
 box24:{name:"24-ft Box Truck",mpg:9.5,cargoLength:24,payload:9500,costPerMile:.62,defaultSpace:14,defaultWeight:6200},
 box26:{name:"26-ft Box Truck",mpg:9,cargoLength:26,payload:10000,costPerMile:.65,defaultSpace:14,defaultWeight:6200}
};
let activeVehicle=VEHICLES.box26;
function applyVehicle(key,updateInputs=true){
 activeVehicle=VEHICLES[key]||VEHICLES.box26;
 if(typeof setMileCountVehicleProfile==="function")setMileCountVehicleProfile(activeVehicle);
 if(el("vehicleName"))el("vehicleName").textContent=activeVehicle.name;
 if(el("vehicleMPG"))el("vehicleMPG").textContent=activeVehicle.mpg;
 if(el("vehiclePayload"))el("vehiclePayload").textContent=activeVehicle.payload.toLocaleString()+" lb";
 if(el("vehicleSummary"))el("vehicleSummary").textContent=activeVehicle.mpg+" MPG • "+activeVehicle.cargoLength+" ft cargo • Nationwide search ready";
 if(updateInputs){if(el("space"))el("space").value=activeVehicle.defaultSpace;if(el("weight"))el("weight").value=activeVehicle.defaultWeight}
}

function showScreen(n){
 document.querySelectorAll(".screen").forEach((s,i)=>s.classList.toggle("active",i===n-1));
 window.scrollTo(0,0);
 if(n===3)setTimeout(()=>{if(typeof initMileCountMap==="function")initMileCountMap();if(typeof mileCountMap!=="undefined"&&mileCountMap)mileCountMap.invalidateSize()},200);
}

function costProfile(){
 const monthlyMiles=Math.max(1,val("monthlyMiles",8000));
 const fixed=val("monthlyPayment",900)+val("monthlyInsurance",1800)+val("monthlyOther",300);
 const maintenance=Math.max(0,val("maintenanceCPM",.20));
 const fuelPrice=(typeof getMileCountFuelPrice==="function"?getMileCountFuelPrice(S.origin).price:0);
 const fuelCPM=fuelPrice/(activeVehicle.mpg||9);
 const breakEven=(fixed/monthlyMiles)+maintenance+fuelCPM;
 const target=breakEven*1.25;
 return {fixed,maintenance,fuelCPM,breakEven,target};
}
function updateCostUI(){
 const p=costProfile();
 if(el("breakEvenCPM"))el("breakEvenCPM").textContent="$"+p.breakEven.toFixed(2);
 if(el("targetRPM"))el("targetRPM").textContent="$"+p.target.toFixed(2);
 if(el("decisionBreakEven"))el("decisionBreakEven").textContent="$"+p.breakEven.toFixed(2);
 return p;
}

function fuelFor(miles){
 return typeof calculateMileCountTripFuel==="function"?calculateMileCountTripFuel(miles,S.origin):{fuelCost:0,gallons:0,dieselPrice:0,source:"Unavailable"};
}

async function routeDetour(stop,fallback){
 if(typeof calculateMileCountDetour!=="function")return {extraMiles:fallback,extraDriveTime:"Estimated"};
 try{return await calculateMileCountDetour(S.origin,S.destination,[stop])}
 catch(e){console.warn("Detour fallback",e);return {extraMiles:fallback,extraDriveTime:"Estimated"}}
}


const MAX_LOAD_WEIGHT_LB=9999;
function allowedLoadWeight(l){
 const w=Number(l?.weight||0);
 // Unknown/zero weight remains visible but is not treated as verified weight.
 return !(w>(physicalBrain?.get().profile.payloadLb??MAX_LOAD_WEIGHT_LB));
}
function enforceWeightCap(loads){
 return (Array.isArray(loads)?loads:[]).filter(allowedLoadWeight);
}
function loadEconomics(l){
 const loaded=Math.max(0,Number(l.loadedMiles||0));
 const deadhead=Math.max(0,Number(l.deadheadMiles??l.extraMiles??0));
 const allMiles=loaded+deadhead;
 const rpm=allMiles>0?Number(l.pay||0)/allMiles:Number(l.rpm||0);
 const fuelCost=Number(l.fuel?.fuelCost||0);
 const afterFuel=Number(l.pay||0)-fuelCost;
 return {loaded,deadhead,allMiles,rpm,fuelCost,afterFuel};
}
function setBoardStatus(kind,text){
 const s=el("boardHealth");if(!s)return;
 s.className="boardHealth "+kind;
 s.textContent=text;
}

function silentValidateLoad(l){
 const issues=[],e=loadEconomics(l),w=Number(l?.weight||0),pay=Number(l?.pay||0);
 if(w>(physicalBrain?.get().profile.payloadLb??MAX_LOAD_WEIGHT_LB))issues.push("weight");
 if(pay<0)issues.push("pay");
 if(e.deadhead<0||e.loaded<0||e.allMiles<0)issues.push("miles");
 if(e.allMiles>0&&Math.abs(e.rpm-(pay/e.allMiles))>.02)issues.push("rpm");
 return {ok:issues.length===0,issues,e};
}
function silentValidateTrip(){
 const st=S.tripState;if(!st)return {ok:true,issues:[]};
 const issues=[],cap=physicalBrain?.get().profile.payloadLb??Math.min(MAX_LOAD_WEIGHT_LB,activeVehicle.payload||MAX_LOAD_WEIGHT_LB);
 if(Number(st.onboardWeight||0)>cap)issues.push("weight");
 if(Number(st.onboardSpace||0)>activeVehicle.cargoLength)issues.push("space");
 const expected=(st.completed||[]).filter(l=>!l.isSandbox).reduce((s,l)=>s+Number(l.pay||0),0);
 if(Math.abs(expected-Number(st.liveRevenue||0))>.01)issues.push("revenue");
 return {ok:issues.length===0,issues};
}
function silentAudit(){
 const loads=Array.isArray(S.allUnifiedLoads)?S.allUnifiedLoads:(S.candidateLoads||[]);
 const bad=loads.filter(l=>!silentValidateLoad(l).ok);
 const trip=silentValidateTrip();
 S.lastAudit={at:Date.now(),ok:bad.length===0&&trip.ok,badLoads:bad.length,tripIssues:trip.issues};
 // Never expose a suspect selected-load calculation as a confident fact.
 if(S.selectedCandidate&&!silentValidateLoad(S.selectedCandidate).ok){
   if(el("loadVerdict"))el("loadVerdict").textContent="RECHECKING…";
   if(el("autoStackReason"))el("autoStackReason").textContent="Milecount is rechecking this load's route and economics.";
 }
 return S.lastAudit;
}

function qualityScore(l,profile){
 const e=loadEconomics(l);
 if(l.isSandbox)return -100000+(Number(l.pay||0));
 const rpmScore=e.rpm*220;
 const payScore=Math.min(1200,Number(l.pay||0))*.12;
 const dhPenalty=e.deadhead*.65;
 const fitBonus=e.rpm>=profile.target?220:e.rpm>=profile.breakEven?90:0;
 return rpmScore+payScore+fitBonus-dhPenalty;
}


function cityStateNorm(v){
 return String(v||"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
}
function laneMatches(load,from,to){
 const p=cityStateNorm(load.pickup||([load.origin?.city,load.origin?.state].filter(Boolean).join(" ")));
 const d=cityStateNorm(load.delivery||([load.destination?.city,load.destination?.state].filter(Boolean).join(" ")));
 const f=cityStateNorm(from),t=cityStateNorm(to);
 const originOK=!f||p.includes(f)||f.includes(p);
 const destOK=!t||t==="anywhere usa"||d.includes(t)||t.includes(d);
 return originOK&&destOK;
}
function pickupDateMatches(load,date){
 if(!date)return true;
 const pd=String(load.pickupDate||load.pickup_date||"").slice(0,10);
 return !pd||pd===date;
}

async function findMoney(){
 const generation=++loadSearchGeneration;
 captureCapacityInputs();
 setBoardStatus("working","Checking connected freight…");
 syncOwnerAccess().then(()=>updateStackTray()).catch(()=>{});
applyVehicle(el("vehicleType")?.value||"box26",false);
 const profile=updateCostUI();
 const pay=Math.max(0,val("pay",1400)),space=Math.max(0,val("space",14)),weight=Math.max(0,val("weight",6200));
 S.origin=el("from")?.value||"Atlanta, GA"; S.destination=el("to")?.value||"Charlotte, NC";
 const searchOrigin=S.origin,searchDestination=S.destination,isLiveBrowse=S.liveOnlyBrowse;
 const directRequest=fetchDirectFreightLocal(searchOrigin,true);directRequest.catch(()=>{});
 const sandboxRequest=isLiveBrowse?Promise.resolve([]):fetchLoadBootSandbox(false).catch(()=>[]);
 let loads=[];let liveProvider=false; let providerErrors=[];
 let providerResponded=false,providerLiveFound=0,resolvedLane=null;
 try{const r=await withTimeout(fetch("https://lrnyxqtmywkhtrmsjquc.supabase.co/functions/v1/truktek-public-pilot",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({origin:searchOrigin,destination:searchDestination,space_ft:space,weight_lb:weight,max_deadhead:Math.max(0,val("maxDeadhead",100)),min_rpm:Math.max(0,val("minRPM",0)),pickup_date:el("pickupDate")?.value||null,equipment:el("vehicleType")?.value||"box26",search_mode:isLiveBrowse?"live_board":(window.MileCountActiveMapArea?"map_area":"lane"),map_bounds:window.MileCountActiveMapArea||null,map_center:window.MileCountActiveMapArea?.center||null,map_zoom:window.MileCountActiveMapArea?.zoom||null})}),10000,null);if(!r)throw new Error("TrukTek request timed out");if(r.ok){const j=await r.json();providerResponded=true;providerLiveFound=Number(j.live_found||0);resolvedLane=j.resolved||null;loads=(j.loads||[]).map(x=>({name:x.name+" • TrukTek",pay:x.pay,space:x.space,weight:x.weight,stop:x.delivery||searchDestination,fallback:Number(x.deadhead||0),deadhead:Number(x.deadhead||0),loadedMiles:Number(x.loadedMiles||0),origin:x.origin,destination:x.destination,provider:"TrukTek",providerLoadId:x.provider_load_id,bookingReference:x.booking_reference,routeCoordinates:x.routeCoordinates||[],pickup:x.pickup,delivery:x.delivery,broker:x.broker,pickupDate:x.pickupDate,deliveryDate:x.deliveryDate}));loads=enforceWeightCap(loads);if(window.MileCountActiveMapArea&&typeof window.MileCountLoadInArea==="function")loads=loads.filter(l=>window.MileCountLoadInArea(l,window.MileCountActiveMapArea));liveProvider=loads.length>0}}catch(e){providerErrors.push("TrukTek");console.warn("TrukTek live pilot unavailable",e);setBoardStatus("warn","TrukTek is temporarily slow/unavailable. Other connected freight can still display.")}
 // Direct Freight production board: query in real time for this lane's origin.
 try{
   const direct=await directRequest;
   if(generation!==loadSearchGeneration)return;
   const requestedDate=el("pickupDate")?.value||"";
   // Direct Freight discovery is origin-first. Destination is a preference/ranking
   // signal, not a hard visibility filter, so carriers can see all current DF
   // freight around the truck instead of mistaking non-matching lanes for no inventory.
   const matching=enforceWeightCap(direct).map(l=>({...l,dateMatchesSearch:pickupDateMatches(l,requestedDate),destinationPreferred:laneMatches(l,searchOrigin,searchDestination)}))
     .sort((a,b)=>Number(b.destinationPreferred)-Number(a.destinationPreferred));
   S.directFreightLiveCount=matching.length;S.directFreightLastUpdated=Date.now();
   if(matching.length){loads=[...loads,...matching];providerResponded=true;liveProvider=true}
 }catch(e){providerErrors.push("Direct Freight");console.warn("Direct Freight lane aggregation unavailable",e)}
 updateProviderFilterOptions(loads);
 // Every lane search aggregates every connected source. LoadBoot is sandbox/test
 // only, so it is clearly labeled and never contributes to live trip revenue.
 if(!isLiveBrowse){
   try{
     const sb=await sandboxRequest;
     if(generation!==loadSearchGeneration)return;
     const requestedDate=el("pickupDate")?.value||"";
     const matching=enforceWeightCap(sb.filter(l=>laneMatches(l,searchOrigin,searchDestination))).map(l=>({...l,dateMatchesSearch:pickupDateMatches(l,requestedDate),demoWorkflow:true}));
     if(matching.length){
       loads=[...loads,...matching];
       providerResponded=true;
     }
   }catch(e){providerErrors.push("LoadBoot Sandbox");console.warn("LoadBoot lane aggregation unavailable",e)}
 }

 if(el("dataModeBadge")){
  el("dataModeBadge").textContent=isLiveBrowse
    ?(providerResponded?(liveProvider?"LIVE LOAD BOARD":"LIVE • NO MATCHES"):"LIVE API UNAVAILABLE")
    :(providerResponded?(liveProvider?"LIVE • TRUKTEK":"SIMULATION • NO LIVE MATCH"):"LIVE API UNAVAILABLE");
  el("dataModeBadge").style.background=liveProvider?"#dff8e9":"#fff0bf";
}
 if(el("footerMode"))el("footerMode").textContent=isLiveBrowse
 ?(liveProvider?"LIVE LOAD BOARD • CONNECTED PROVIDERS":"LIVE LOAD BOARD • NO MATCHES")
 :(liveProvider?"LIVE TRUKTEK LOADS • SOURCE ATTRIBUTED":"SIMULATION • NO LIVE MATCH");
 if(el("mapModeLabel"))el("mapModeLabel").textContent=liveProvider?"Live-provider trip preview • green line = MileCount road route":"Route preview • green line = MileCount road route";
 if(providerResponded&&!loads.length&&el("loadCandidates")){
  el("loadCandidates").innerHTML=isLiveBrowse
   ?'<div class="details" style="padding:14px;border:1px solid #5f4d18;border-radius:12px">LIVE LOAD BOARD SEARCH COMPLETE • No authorized live loads matched the current truck, date, and filter settings. No simulation was substituted.</div>'
   :'<div class="details" style="padding:14px;border:1px solid #5f4d18;border-radius:12px">LIVE SEARCH COMPLETE • '+providerLiveFound+' provider loads found, but none fit the remaining '+space+' ft / '+weight.toLocaleString()+' lb capacity and current filters. No simulation was substituted.</div>';
}

 if(generation!==loadSearchGeneration)return;
 await forEachConcurrent(loads,4,async l=>{
  if(l.provider){
   const pickup=l.pickup||([l.origin?.city,l.origin?.state].filter(Boolean).join(", "));
   const delivery=l.delivery||([l.destination?.city,l.destination?.state].filter(Boolean).join(", "));
   let dh=null,loaded=Number(l.loadedMiles||0);

   // Provider o2oDist is not assumed to be driver deadhead. Driver deadhead is FROM -> pickup.
   if(isLiveBrowse){
     dh=0; // nationwide board has no driver-origin economics until a user searches/selects a FROM location
   }else{
     dh=await roadMilesBetween(searchOrigin,pickup);
     if(!Number.isFinite(dh))dh=Math.max(0,Number(l.deadhead||0));
   }

   if(!isLiveBrowse&&!(loaded>0)){
     const routedLoaded=await roadMilesBetween(pickup,delivery);
     if(Number.isFinite(routedLoaded))loaded=routedLoaded;
   }

   l.deadheadMiles=Math.max(0,Number(dh||0));
   l.loadedMiles=Math.max(0,Number(loaded||0));
   l.extraMiles=l.deadheadMiles;
   l.extraDriveTime=l.deadheadMiles>0?"Deadhead to pickup":"At/near pickup";
   l.tripMiles=l.deadheadMiles+l.loadedMiles;
   l.fuel=fuelFor(l.tripMiles);
   l.afterFuel=l.pay-(l.fuel.fuelCost||0);
  }else{
   const d=await routeDetour(l.stop,l.fallback);
   l.extraMiles=Number.isFinite(d.extraMiles)?d.extraMiles:l.fallback;
   l.extraDriveTime=d.extraDriveTime||"Estimated";
   l.deadheadMiles=l.extraMiles;
   l.tripMiles=l.extraMiles;
   l.fuel=fuelFor(l.extraMiles);
   l.afterFuel=l.pay-(l.fuel.fuelCost||0);
  }
 });
 if(generation!==loadSearchGeneration)return;
 const maxDH=Math.max(0,val("maxDeadhead",100)),minRPM=Math.max(0,val("minRPM",0));
 if(!isLiveBrowse){
   loads=loads.filter(l=>loadEconomics(l).deadhead<=maxDH && loadEconomics(l).rpm>=minRPM);
 }
 loads.sort((a,b)=>qualityScore(b,profile)-qualityScore(a,profile));
 const best=loads[0]||{pay:0,space:0,weight:0,stop:searchDestination,extraMiles:0,extraDriveTime:"0 min",fuel:fuelFor(0),afterFuel:0};
 S.primaryPay=pay;S.addedPay=best.pay;S.totalPay=pay+best.pay;S.extraMiles=best.extraMiles;S.selectedStop=best.stop;S.homeAdded=false;

 if(isLiveBrowse)S.liveBoardLoads=[...loads];
 if(providerErrors.length===0)setBoardStatus("ok",loads.length?("Freight updated • "+loads.length+" provider load"+(loads.length===1?"":"s")+" processed"):"Connected • no matching live freight right now");
 S.allUnifiedLoads=loads;S.candidateLoads=loads;S.selectedCandidate=best;
 if(typeof window.renderMileCountLoadMap==="function")window.renderMileCountLoadMap(loads,{breakEven:profile.breakEven,target:profile.target,origin:searchOrigin,destination:searchDestination});
 renderUnifiedLoadList(loads);

 if(el("added"))el("added").textContent="+"+money(best.pay);
 if(el("current"))el("current").textContent=money(pay);
 if(el("newTotal"))el("newTotal").textContent=money(S.totalPay);
 if(el("tripPay"))el("tripPay").textContent=money(S.totalPay);
 if(el("tripAdded"))el("tripAdded").textContent="+"+money(best.pay);
 if(el("remainingSpace"))el("remainingSpace").textContent=Math.max(0,space-best.space)+" ft remaining";
 if(el("remainingWeight"))el("remainingWeight").textContent=Math.max(0,weight-best.weight).toLocaleString()+" lb remaining";
 if(el("detourMiles"))el("detourMiles").textContent=best.extraMiles.toFixed(1)+" mi";
 if(el("detourTime"))el("detourTime").textContent=best.extraDriveTime;
 if(el("spaceUsed"))el("spaceUsed").textContent=best.space+" ft";
 if(el("weightUsed"))el("weightUsed").textContent=best.weight.toLocaleString()+" lb";
 if(el("extraFuel"))el("extraFuel").textContent=money(best.fuel.fuelCost);
 if(el("extraFuelDetails"))el("extraFuelDetails").textContent=best.fuel.gallons.toFixed(1)+" gal • $"+best.fuel.dieselPrice.toFixed(2)+"/gal • "+best.fuel.source;
 if(el("addedAfterFuel"))el("addedAfterFuel").textContent="+"+money(best.afterFuel);
 const addedRPM=loadEconomics(best).rpm;
 if(el("loadVerdict")){
   el("loadVerdict").textContent=!best.pay?"NO FIT":(addedRPM>=profile.target?"STRONG ✓":addedRPM>=profile.breakEven?"WORKS":"PASS");
   el("loadVerdict").style.color=!best.pay?"#93a79d":(addedRPM>=profile.target?"#31bf72":addedRPM>=profile.breakEven?"#f1c75b":"#ff7777");
 }
 if(el("autoStackReason"))el("autoStackReason").textContent=best.pay?"Adds "+best.extraMiles.toFixed(1)+" road miles and about "+money(best.fuel.fuelCost)+" in diesel. Estimated +"+money(best.afterFuel)+" after added fuel. Your break-even is $"+profile.breakEven.toFixed(2)+"/mi.":"No compatible freight fits the remaining truck capacity.";
 if(!S.stayHomeAfterSearch)showScreen(2);
}

function selectCandidate(i){
 const l=(S.candidateLoads||[])[i];if(!l)return;
 const e=loadEconomics(l);
 if(el("selectedLoadSummary"))el("selectedLoadSummary").innerHTML='<b>'+(l.pickup||"Pickup")+' → '+(l.delivery||l.stop||"Delivery")+'</b><span>'+money(l.pay)+' • '+(e.rpm?("$"+e.rpm.toFixed(2)+"/all-mile"):"RPM —")+' • '+Math.round(e.deadhead)+' mi deadhead • '+(l.isSandbox?"SANDBOX TEST • preview only":"LIVE • ready for trip analysis")+'</span>';
S.selectedCandidate=l;S.homeAdded=false;S.returnPay=0;
 if(l.provider){
  S.tripMode=l.isSandbox?"sandbox":"live";
  S.primaryPay=0;
  S.addedPay=l.pay;
  S.totalPay=l.pay;
  S.demoTrip=!!l.isSandbox;
  S.selectedLoadPickup=l.pickup||([l.origin?.city,l.origin?.state].filter(Boolean).join(", "));
  S.selectedLoadDelivery=l.delivery||([l.destination?.city,l.destination?.state].filter(Boolean).join(", "));
  S.selectedStop=S.selectedLoadDelivery;
  S.extraMiles=Math.max(0,Number(l.deadheadMiles??l.extraMiles??0));
 }else{
  S.tripMode="simulation";S.primaryPay=Math.max(0,val("pay",1400));S.addedPay=l.pay;S.totalPay=S.primaryPay+l.pay;S.extraMiles=l.extraMiles;S.selectedStop=l.stop;
 }
 const economicMiles=l.provider?Math.max(0,Number(l.loadedMiles||0))+Math.max(0,Number(l.deadheadMiles??l.extraMiles??0)):Math.max(0,Number(l.extraMiles||0));
 const fuel=l.provider?fuelFor(economicMiles):l.fuel;const afterFuel=l.pay-(fuel?.fuelCost||0);
 if(el("added"))el("added").textContent=l.isSandbox?"TEST "+money(l.pay):"+"+money(l.pay);
 if(el("current"))el("current").textContent=money(S.primaryPay);
 if(el("newTotal"))el("newTotal").textContent=l.isSandbox?"TEST ONLY":money(S.totalPay);
 if(el("tripPay"))el("tripPay").textContent=l.isSandbox?"$0 LIVE":money(S.totalPay);
 if(el("tripAdded"))el("tripAdded").textContent=l.isSandbox?"TEST "+money(l.pay):"+"+money(l.pay);
 if(el("remainingSpace"))el("remainingSpace").textContent=Math.max(0,val("space",0)-l.space)+" ft remaining";if(el("remainingWeight"))el("remainingWeight").textContent=Math.max(0,val("weight",0)-l.weight).toLocaleString()+" lb remaining";
 if(el("detourMiles"))el("detourMiles").textContent=S.extraMiles.toFixed(1)+" mi";if(el("detourTime"))el("detourTime").textContent=l.provider?"Provider deadhead":l.extraDriveTime;if(el("spaceUsed"))el("spaceUsed").textContent=l.space+" ft";if(el("weightUsed"))el("weightUsed").textContent=l.weight.toLocaleString()+" lb";if(el("extraFuel"))el("extraFuel").textContent=money(fuel?.fuelCost||0);if(el("addedAfterFuel"))el("addedAfterFuel").textContent=money(afterFuel);
 document.querySelectorAll(".candidateLoad").forEach((b,n)=>b.classList.toggle("selected",n===i));
 if(typeof window.focusMileCountLoadMarker==="function")window.focusMileCountLoadMarker(i);
}
window.MileCountSelectCandidate=selectCandidate;
window.MileCountOpenLoadDetails=function(index){
 const i=Number(index);
 if(!Number.isInteger(i)||!(S.candidateLoads||[])[i])return;
 selectCandidate(i);
 showScreen(2);
 const card=document.querySelector('.candidateLoad[data-load-index="'+i+'"]');
 if(card)setTimeout(()=>card.scrollIntoView({behavior:"smooth",block:"center"}),80);
};
async function updateOutboundMap(){
 const brain=syncTruckBrain("map");
 const l=S.selectedCandidate;
 if(l?.provider&&Array.isArray(l.routeCoordinates)&&l.routeCoordinates.length>1&&typeof showMileCountProviderRoute==="function")return await showMileCountProviderRoute(l);
 if(typeof showMileCountRoute!=="function")return null;
 if(l?.provider){
  const pickup=l.pickup||S.selectedLoadPickup||S.origin;
  const delivery=l.delivery||S.selectedLoadDelivery||S.destination;
  const stops=[brain.currentLocation||S.origin,pickup,delivery].filter(isRoutableLocation).filter((x,i,a)=>a.indexOf(x)===i);
  if(stops.length<2)return null;
  return await showMileCountRoute(stops);
 }
 const stops=[brain.currentLocation||S.origin];if(S.selectedStop&&S.selectedStop!==S.origin&&S.selectedStop!==S.destination)stops.push(S.selectedStop);if(stops.at(-1)!==S.destination)stops.push(S.destination);return await showMileCountRoute(stops);
}
async function addToTrip(){
 captureCapacityInputs();
 const l=S.selectedCandidate;if(!l)return;
 // Add the selected freight as the BASE PLAN. Do not force route preview yet.
 S.basePlanLoad=l;
 S.demoTrip=!!l.isSandbox||!l.provider;
 selectedStackKeys.add(loadKey(l));

 // Persist only genuinely live/provider planner data; test/demo remains local.
 if(!l.isSandbox&&l.provider&&S.plannerTripId&&window.MileCountCloud){
   try{
     const all=await MileCountCloud.plannerTrips(),t=all.find(x=>x.id===S.plannerTripId);
     if(t){
       const parts=Array.isArray(t.autostack_json)?t.autostack_json:[];
       const exists=parts.some(p=>p.name===l.name&&Number(p.pay)===Number(l.pay));
       if(!exists){
         parts.push({name:l.name,pickup:l.pickup,delivery:l.delivery,stop:l.stop,pay:Number(l.pay||0),space:Number(l.space||0),weight:Number(l.weight||0),provider:l.provider});
         await MileCountCloud.updatePlannerTrip(t.id,{autostack_json:parts});
       }
     }
   }catch(e){console.warn("Planner base-load save failed",e)}
 }

 // Rebuild a broad stack candidate pool: keep current connected board + current
 // lane results + sandbox. Simulation stays available as demo candidates.
 setBusy(true,"One moment — finding loads that can stack with this trip…");
 try{
   const current=Array.isArray(S.allUnifiedLoads)?S.allUnifiedLoads:[];
   const lane=Array.isArray(S.candidateLoads)?S.candidateLoads:[];
   const sandbox=await fetchLoadBootSandbox(false);
   const merged=[l,...current,...lane,...sandbox];
   const seen=new Set(),unique=enforceWeightCap(merged.filter(x=>{
     const k=loadKey(x);if(!k||seen.has(k))return false;seen.add(k);return true;
   }));
   S.allUnifiedLoads=unique;
   S.candidateLoads=unique;
   updateProviderFilterOptions(unique);
   renderUnifiedLoadList(unique);
   const profile=updateCostUI();
   if(typeof window.renderMileCountLoadMap==="function")await window.renderMileCountLoadMap(unique,{breakEven:profile.breakEven,target:profile.target,origin:l.pickup||S.origin,destination:l.delivery||S.destination});
   updateStackTray();

   if(el("selectedLoadSummary"))el("selectedLoadSummary").innerHTML='<b>BASE TRIP • '+(l.pickup||"Pickup")+' → '+(l.delivery||l.stop||"Delivery")+'</b><span>'+money(l.pay)+' • Select more loads with + STACK, then press SMART AUTOSTACK.</span>';
   showScreen(2);
   setTimeout(()=>el("loadCandidates")?.scrollIntoView({behavior:"smooth",block:"start"}),80);
 }finally{setBusy(false)}
}

function homeboundStartLocation(brain=syncTruckBrain('homebound-start')){
 const events=S.finalRouteEvents?.length?S.finalRouteEvents:(S.stackPlan?.events||[]);
 const lastDelivery=[...events].reverse().find(e=>e.type==='drop'||e.type==='returnDrop');
 return brain.actualLocationVerified?brain.currentLocation:lastDelivery?.location||brain.currentLocation;
}
let dispatchInventory=null,dispatchGeneration=0,continuousTimer=null;
function scheduleContinuousDispatch(reason){
 if(!window.MileCountDispatchPlanner)return;
 clearTimeout(continuousTimer);
 continuousTimer=setTimeout(async()=>{try{
  await window.MileCountTruckBrain.ready;
  if(!physicalBrain?.get().currentLocation)return;
  if(truckBrain().committedLoads.length||truckBrain().finalDestination){await smartAutoStack();if(S.stackPlan?.valid)await finishAutoStack();}
  await refreshDispatchRecommendations('dispatch');
 }catch(e){renderNextMove({message:'Dispatch refresh needs attention: '+e.message,choices:[]});}},500);
}
function inventoryService(){
 if(!dispatchInventory)dispatchInventory=new window.MileCountInventory.Inventory([
  {id:'directfreight',name:'Direct Freight',search:q=>fetchDirectFreightLocal(q.origin,true)},
  {id:'truktek',name:'TrukTek',search:q=>fetchTrukTekLocal(q.origin,true)}
 ]);
 return dispatchInventory;
}
function renderNextMove(result){
 let box=el('bestNextMove');
 if(!box){const parent=el('stackPlanResult')?.parentElement;if(!parent)return;box=document.createElement('section');box.id='bestNextMove';box.className='panel';parent.appendChild(box);}
 box.innerHTML='<h3>BEST NEXT MOVE</h3><p>'+escHtml(result.message||'Review complete carrier plans')+'</p>'+(result.routingStatus?'<p class="details">'+escHtml(result.routingStatus)+'</p>':'')+(result.providerIssues?.length?'<p class="stackWarn">'+result.providerIssues.map(escHtml).join(' • ')+'</p>':'')+(result.truncated?'<p class="details">Bounded search: these are the strongest plans evaluated, not a guarantee across all available freight.</p>':'');
 (result.choices||[]).slice(0,3).forEach((choice,index)=>{
  const card=document.createElement('div');card.className='homeAlt';
  card.innerHTML='<b>'+choice.added.length+' compatible load'+(choice.added.length===1?'':'s')+' • '+money(choice.review.metrics.afterGas)+' projected after gas</b><span>'+Math.round(choice.plan.miles)+' total mi • '+Math.round(choice.plan.deadhead)+' empty mi • '+money(choice.improvement)+' better estimated margin</span><p>'+choice.plan.events.map(e=>escHtml(e.type.toUpperCase()+' '+e.location)).join(' → ')+'</p><p>'+choice.added.map(l=>escHtml((l.provider||'Provider')+' • '+(l.providerLoadId||l.name||'Reference not provided'))).join('<br>')+'</p>';
  const button=document.createElement('button');button.type='button';button.textContent='REVIEW THIS COMPLETE PLAN';button.onclick=()=>acceptDispatchChoice(result,index);card.appendChild(button);box.appendChild(card);
 });
 if(!result.choices?.length&&Number.isFinite(result.remainingEmptyMiles))box.insertAdjacentHTML('beforeend','<p>'+Math.round(result.remainingEmptyMiles)+' remaining empty road miles.</p>');
}
async function refreshDispatchRecommendations(mode='dispatch'){
 if(!window.MileCountDispatchPlanner)return null;
 if(mode==='homebound'&&!requirePlan('dispatcher'))return null;
 if(mode==='dispatch'&&!currentPlan().strongFit)return null;
 await window.MileCountTruckBrain.ready;
 const generation=++dispatchGeneration,brain=syncTruckBrain('autostack-start'),version=brain.version;
 if(!brain.actualLocationVerified){const result={choices:[],message:'Set Truck Brain’s actual location before live dispatch.'};renderNextMove(result);return result;}
 if(mode==='homebound'&&!brain.finalDestination)throw Error('Choose the exact home destination first');
 const isLive=l=>!l.isSandbox&&!l.isLocalSim&&!['TEST','SIM'].includes(l.mode);
 if(brain.committedLoads.some(l=>!isLive(l)))throw Error('Finish or clear the TEST/SIM plan before live dispatch');
 const committed=window.MileCountPickupDelivery.unique([...brain.committedLoads,...brain.onboardLoads]);
 const services=inventoryService(),origins=[...new Set([brain.currentLocation,...committed.map(l=>l.delivery),...(mode==='homebound'&&brain.finalDestination?[brain.finalDestination]:[])])].filter(Boolean).slice(0,4);
 renderNextMove({message:'Checking live freight against the entire truck plan…',choices:[]});
 const snapshots=await Promise.all(origins.map(origin=>services.search({origin})));
 if(generation!==dispatchGeneration||physicalBrain?.get().version!==version)return null;
 let loads=window.MileCountPickupDelivery.unique(snapshots.flatMap(s=>s.loads));
 // Explore a small second set of markets returned by the providers for paid hops.
 if(mode==='homebound'){
  const next=[...new Set(loads.filter(isLive).map(l=>l.delivery))].filter(x=>x&&!origins.includes(x)).slice(0,2);
  snapshots.push(...await Promise.all(next.map(origin=>services.search({origin}))));
  loads=window.MileCountPickupDelivery.unique(snapshots.flatMap(s=>s.loads));
 }
 if(generation!==dispatchGeneration||physicalBrain?.get().version!==version)return null;
 const providers=snapshots.flatMap(s=>s.providers),inventory={loads,providers,searchedAt:Date.now()};physicalBrain?.setInventory(inventory,version);
 const providerIssues=[...new Set(providers.filter(p=>p.status==='error'||p.status==='stale').map(p=>p.provider+': '+p.error))];
 const selected=new Set(committed.map(loadKey)),pool=[],rejections=[];
 for(const load of loads){
  if(selected.has(loadKey(load))||!isLive(load)||load.dataFreshness==='stale')continue;
  if(!(Number(load.pay)>0)||!(Number(load.weight)>0)||!(Number(load.space)>0)||!load.pickup||!load.delivery){rejections.push({id:loadKey(load),reason:'Pay, weight, space or stop not provided by provider'});continue;}
  try{buildPickupDeliveryProblem(brain,[load],null);pool.push(load);}catch(e){rejections.push({id:loadKey(load),reason:e.message});}
 }
 // Provider-balanced shortlist; the same road matrix evaluates every complete subset.
 const max=Math.min(8,Math.max(0,15-committed.length)),balanced=[];
 const groups=[...new Set(pool.map(l=>l.provider))].map(name=>pool.filter(l=>l.provider===name));
 for(let i=0;balanced.length<max&&groups.some(g=>i<g.length);i++)for(const group of groups){if(group[i]&&balanced.length<max)balanced.push(group[i]);}
 const problem=buildPickupDeliveryProblem(brain,[...committed,...balanced],S.basePlanLoad),roads=await getMileCountRoadMatrix(problem.locations);
 if(generation!==dispatchGeneration||physicalBrain?.get().version!==version)return null;
 problem.matrix=roads.matrix;
 const result=await runDispatchSolver('dispatch',problem,{mode,committedIds:committed.map(loadKey),maxAddedLoads:Math.min(4,Math.max(0,currentPlan().maxStack-committed.length)),maxPlans:96,economics:{mpg:activeVehicle.mpg,fuelPrice:Number(fuelFor(1).fuelCost)*activeVehicle.mpg,maintenanceCPM:costProfile().maintenance,guardrails:brain.guardrails}});
 if(generation!==dispatchGeneration||physicalBrain?.get().version!==version)return null;
 result.truncated=result.truncated||pool.length>balanced.length;result.rejections=[...(result.rejections||[]),...rejections];result.providerIssues=providerIssues;result.routingStatus=roads.routingStatus||'GENERAL ROAD ESTIMATE — COMMERCIAL ROUTE UNAVAILABLE';result.truckVersion=version;result.account=brainAccount;
 if(!result.ok)result.message=(result.issues||[]).join(' • ');
 if(!result.choices?.length&&providerIssues.length)result.message='Live freight search is incomplete. The current trip is preserved; retry the unavailable providers.';
 S.dispatchRecommendation=result;renderNextMove(result);return result;
}
async function acceptDispatchChoice(result,index=0){
 if(result.account!==brainAccount||result.truckVersion!==physicalBrain?.get().version){alert('Truck state changed. Refresh Best Next Move before accepting.');return;}
 const choice=result.choices[index];if(!choice)return;
 if(choice.added.some(l=>l.dataFreshness==='stale')){alert('Refresh provider availability first.');return;}
 S.allUnifiedLoads=window.MileCountPickupDelivery.unique([...(S.allUnifiedLoads||[]),...choice.plan.loads]);
 S.planCommitments=choice.plan.loads;selectedStackKeys.clear();choice.plan.loads.forEach(l=>selectedStackKeys.add(loadKey(l)));
 invalidateStackProjection('Rechecking the selected complete plan…');updateStackTray();await smartAutoStack();if(S.stackPlan?.valid)await finishAutoStack();
}
window.MileCountTruckBrain.refreshNextMove=refreshDispatchRecommendations;
async function protectReturn(){
 if(!requirePlan('dispatcher'))return;
 setBusy(true,'Comparing complete paid routes toward home…');setButtonBusy('protect',true,'SEARCHING…','FIND MY WAY HOME');
 try{
  const home=(el('tripHomeChoice')?.value||physicalBrain?.get().homeLocation||S.home||'').trim();if(!home)throw Error('Enter your exact final/home destination');
  physicalBrain?.configure({homeLocation:home});S.home=home;S.homeChosen=true;
  const result=await refreshDispatchRecommendations('homebound');S.homeboundRecommendation=result;
  if(el('returnLead'))el('returnLead').textContent=result?.message||'Homebound search unavailable';
  if(el('returnPay'))el('returnPay').textContent=result?.choices?.length?money(result.choices[0].review.metrics.revenue):'No live addition';
  if(el('getHome'))el('getHome').disabled=!result?.choices?.length;
  showScreen(2);el('bestNextMove')?.scrollIntoView({behavior:'smooth',block:'center'});
 }catch(e){renderNextMove({message:e.message,choices:[]});}finally{setBusy(false);setButtonBusy('protect',false,'','FIND MY WAY HOME');}
}
async function getHomePaid(){
 const result=S.homeboundRecommendation;if(!result?.choices?.length){await protectReturn();return;}await acceptDispatchChoice(result);
}

function refreshFinalTripOverview(){
 const brain=syncTruckBrain("economics");
 const plan=brain.currentPlan||S.stackPlan;
 const miles=plan?.valid?plan.miles:Math.max(0,Number(S.roundTripMiles||0));
 const revenue=plan?.valid?plan.totalPay:Math.max(0,Number(S.totalPay||0));
 const fuel=plan?.valid?plan.fuel:fuelFor(miles);
 // Trip economics for this owner: only fuel is charged against trip revenue.
 // Insurance, maintenance reserve, truck payment and other overhead stay in the
 // owner's separate personal/business budget and are not trip deductions.
 const maintenance=0,insurance=0,payment=0,other=0;
 const profile=costProfile(),budgetCost=Number(fuel.fuelCost||0)+miles*(profile.maintenance+profile.fixed/Math.max(1,val("monthlyMiles",8000)));
 if(el("overviewBudgetCost"))el("overviewBudgetCost").textContent=money(budgetCost);
 if(el("overviewBudgetMargin"))el("overviewBudgetMargin").textContent=money(revenue-budgetCost);
 const cost=Number(fuel.fuelCost||0);
 const margin=revenue-cost;
 if(el("overviewRevenue"))el("overviewRevenue").textContent=money(revenue);
 if(el("overviewMiles"))el("overviewMiles").textContent=Math.round(miles).toLocaleString()+" mi";
 if(el("overviewRPM"))el("overviewRPM").textContent=miles?"$"+(revenue/miles).toFixed(2):"—";
 if(el("overviewDriveTime"))el("overviewDriveTime").textContent=el("driveTime")?.textContent||"—";
 if(el("overviewGallons"))el("overviewGallons").textContent=Number(fuel.gallons||0).toFixed(1)+" gal";
 if(el("overviewFuel"))el("overviewFuel").textContent=money(fuel.fuelCost||0);
 if(el("overviewMaintenance"))el("overviewMaintenance").textContent=money(maintenance);
 if(el("overviewInsurance"))el("overviewInsurance").textContent=money(insurance);
 if(el("overviewPayment"))el("overviewPayment").textContent=money(payment);
 if(el("overviewOther"))el("overviewOther").textContent=money(other);
 if(el("overviewCost"))el("overviewCost").textContent=money(cost);
 if(el("overviewMargin"))el("overviewMargin").textContent=money(margin);
 if(el("overviewFuelDetail"))el("overviewFuelDetail").textContent=Number(fuel.gallons||0).toFixed(1)+" gallons × $"+Number(fuel.dieselPrice||0).toFixed(2)+"/gal • "+(fuel.source||fuel.fuelSource||"fuel estimate");
}
async function viewUpdatedTrip(){
 S.home=(S.home||el("from")?.value||S.origin||"").trim();
 const total=S.totalPay+(S.homeAdded?S.returnPay:0);if(el("tripPay"))el("tripPay").textContent=money(total);
 if(el("tripHomeStart"))el("tripHomeStart").textContent=S.home||"—";
 if(el("tripFinalDestination"))el("tripFinalDestination").textContent=S.homeAdded?(S.home||"—"):(S.destination||"—");
 if(el("tripDetailPay"))el("tripDetailPay").textContent=money(total);
 if(el('tripDetailReturn'))el('tripDetailReturn').textContent='Projected • verify booking';
 if(el("tripSaveStatus"))el("tripSaveStatus").textContent="";
 renderFinalTripStops();
 void saveCurrentTrip();
 refreshFinalTripOverview();
 showScreen(3);setTimeout(async()=>{try{const stops=(Array.isArray(S.finalRouteStops)?S.finalRouteStops:[]).filter(isRoutableLocation);if(stops.length>1&&typeof showMileCountRoute==="function")await showMileCountRoute(stops,S.stackPlan?.route);else await updateOutboundMap()}catch(e){console.warn("Final route map",e)}},200);
}
function bookingLoadsForTrip(){
 const brain=syncTruckBrain("booking");
 const ev=Array.isArray(S.finalRouteEvents)&&S.finalRouteEvents.length?S.finalRouteEvents:(S.stackPlan?.events||[]);
 const seen=new Set(),out=[];
 ev.filter(e=>e.type==="pickup"&&e.load).forEach(e=>{const l=e.load,k=loadKey(l);if(!seen.has(k)){seen.add(k);out.push(l)}});
 (S.homeboundHops||[]).forEach(l=>{const k=loadKey(l);if(!seen.has(k)){seen.add(k);out.push(l)}});
 return out.filter(l=>!l.isSandbox&&!l.isLocalSim);
}
function renderBookingChecklist(){
 const brain=syncTruckBrain("booking-render"),loads=bookingLoadsForTrip(),box=el("bookingChecklist");if(!box)return;
 S.bookingConfirmed=S.bookingConfirmed||{};
 if(el("bookingCount"))el("bookingCount").textContent=loads.length+" live load"+(loads.length===1?"":"s")+" • booking checklist";
 box.innerHTML=loads.length?loads.map((l,i)=>{
  const k=loadKey(l),done=brain.bookings[k]?.status==='CLAIMED',provider=l.provider||'Provider',url=l.sourceUrl||'';
  return '<div class="homeAlt"><b>'+(i+1)+'. '+escHtml(l.pickup)+' → '+escHtml(l.delivery)+'</b><span>'+escHtml(provider)+' • '+money(l.pay)+'</span><div style="display:flex;gap:7px;flex-wrap:wrap;margin-top:7px">'+(url?'<a class="miniBtn" href="'+escHtml(url)+'" target="_blank" rel="noopener">CONTINUE WITH '+escHtml(provider).toUpperCase()+'</a>':'<span class="sourceTag">CONTACT '+escHtml(provider).toUpperCase()+'</span>')+'<button type="button" class="bookingConfirm" data-key="'+escHtml(k)+'">'+(done?'✓ CLAIMED — CARRIER REPORTED':'I BOOKED / CLAIMED THIS ON THE PROVIDER')+'</button></div></div>';
 }).join(""):'<div class="details">No live provider loads are attached to this trip.</div>';
 box.querySelectorAll('.bookingConfirm').forEach(b=>b.onclick=async()=>{const l=loads.find(x=>loadKey(x)===b.dataset.key);if(!l)return;await window.MileCountTruckBrain.claim(l,brain.bookings[b.dataset.key]?.status!=='CLAIMED');renderBookingChecklist();window.MileCountBooking?.refreshCommittedSummary?.();});
 const allDone=loads.length>0&&loads.every(l=>brain.bookings[loadKey(l)]?.status==='CLAIMED'||window.MileCountBooking?.isConfirmed?.(l));
 el("startBookedTrip")?.classList.toggle("hidden",!allDone);
}
function openBookingHandoffs(){renderBookingChecklist();el("bookingHandoff")?.scrollIntoView({behavior:"smooth",block:"start"})}
async function saveCurrentTrip(showStatus=false){
 S.home=(S.home||el("from")?.value||S.origin||"").trim();
 if(S.demoTrip||S.demoReturn){if(showStatus&&el("tripSaveStatus"))el("tripSaveStatus").textContent="TEST / SANDBOX trips are not saved as live trip history.";return false}
 try{
  const miles=S.roundTripMiles||0,total=S.totalPay+(S.homeAdded?S.returnPay:0),fuel=fuelFor(miles),p=costProfile();
  const estimatedCost=Number(fuel.fuelCost||0);
  const tripSnapshot={origin:S.origin,destination:S.destination,home_city:S.home,primary_pay:S.primaryPay,added_pay:S.addedPay,return_pay:S.homeAdded?S.returnPay:0,road_miles:miles,fuel_cost:fuel.fuelCost,all_miles_rpm:miles?total/miles:0,break_even_rpm:p.breakEven,estimated_trip_cost:estimatedCost,estimated_margin:total-estimatedCost,status:"saved"};
  const s=await MileCountCloud.session();if(!s)return false;
  await MileCountCloud.saveTrip(tripSnapshot);
  if(showStatus&&el("tripSaveStatus"))el("tripSaveStatus").innerHTML='SAVED ✓ <a href="trips.html" style="color:#8adbb5">VIEW MY TRIPS</a>';
  return true;
 }catch(e){console.warn("Trip cloud save failed",e);if(showStatus&&el("tripSaveStatus"))el("tripSaveStatus").textContent=e.message||"Could not save trip.";return false}
}
function startNewTrip(){S.planCommitments=physicalBrain?.get().onboardLoads||[];physicalBrain?.configure({commitments:S.planCommitments,baseLoadId:null,homeLocation:null,homeDeadline:null});invalidateStackProjection('New trip — onboard freight remains committed.');S.truckBrain=null;S.homeboundHops=[];S.finalRouteEvents=null;S.finalRouteStops=null;S.homeChosen=false;S.localMoneyMode=false;S.home="";S.origin=(el("from")?.value||"").trim();S.basePlanLoad=null;selectedStackKeys.clear();updateStackTray();S.primaryPay=0;S.addedPay=0;S.totalPay=0;S.homeAdded=false;S.returnPay=0;S.extraMiles=0;S.roundTripMiles=0;S.selectedStop="";S.tripMode="idle";S.selectedCandidate=null;S.candidateLoads=[];el("homeResult")?.classList.add("hidden");if(el("getHome")){el("getHome").disabled=false;el("getHome").textContent="PROTECT MY RETURN"}showScreen(1)}
async function analyzeManualLoad(){
 applyVehicle(el("vehicleType")?.value||"box26",false);
 S.origin=el("from")?.value||"Atlanta, GA"; S.destination=el("to")?.value||"Charlotte, NC";
 const load={name:el("manualName")?.value.trim()||"Manual load",pickup:el("manualPickup")?.value||S.origin,stop:el("manualDelivery")?.value||S.destination,pay:Math.max(0,val("manualPay",0)),weight:Math.max(0,val("manualWeight",0)),space:Math.max(0,val("manualSpace",0))};
 const availableSpace=Math.max(0,val("space",0)),availableWeight=Math.max(0,val("weight",0));
 if(!load.pay){alert("Enter the load pay first.");return}
 if(load.space>availableSpace||load.weight>availableWeight){alert("This load does not fit the remaining vehicle capacity.");return}
 let detour={extraMiles:0,extraDriveTime:"On route"};
 if(load.stop!==S.destination)detour=await routeDetour(load.stop,0);
 load.extraMiles=Math.max(0,Number(detour.extraMiles)||0);load.extraDriveTime=detour.extraDriveTime||"Estimated";load.fuel=fuelFor(load.extraMiles);load.afterFuel=load.pay-load.fuel.fuelCost;
 S.primaryPay=Math.max(0,val("pay",0));S.addedPay=load.pay;S.totalPay=S.primaryPay+load.pay;S.extraMiles=load.extraMiles;S.selectedStop=load.stop;S.homeAdded=false;
 const p=updateCostUI();const incrementalRPM=load.extraMiles>0?load.pay/load.extraMiles:load.pay;
 if(el("loadCandidates"))el("loadCandidates").innerHTML='<div style="padding:12px;border:1px solid #31bf72;border-radius:12px;background:#0d2118"><div style="display:flex;justify-content:space-between"><b>'+load.name+'</b><b style="color:#31bf72">+'+money(load.pay)+'</b></div><div class="details">'+load.pickup+' → '+load.stop+' • '+load.space+' ft • '+load.weight.toLocaleString()+' lb • +'+load.extraMiles.toFixed(1)+' detour mi • MANUAL LOAD • USER ENTERED</div></div>';
 if(el("added"))el("added").textContent="+"+money(load.pay);if(el("current"))el("current").textContent=money(S.primaryPay);if(el("newTotal"))el("newTotal").textContent=money(S.totalPay);if(el("tripPay"))el("tripPay").textContent=money(S.totalPay);if(el("tripAdded"))el("tripAdded").textContent="+"+money(load.pay);
 if(el("detourMiles"))el("detourMiles").textContent=load.extraMiles.toFixed(1)+" mi";if(el("detourTime"))el("detourTime").textContent=load.extraDriveTime;if(el("spaceUsed"))el("spaceUsed").textContent=load.space+" ft";if(el("weightUsed"))el("weightUsed").textContent=load.weight.toLocaleString()+" lb";
 if(el("extraFuel"))el("extraFuel").textContent=money(load.fuel.fuelCost);if(el("extraFuelDetails"))el("extraFuelDetails").textContent=load.fuel.gallons.toFixed(1)+" gal • $"+load.fuel.dieselPrice.toFixed(2)+"/gal • "+load.fuel.source;if(el("addedAfterFuel"))el("addedAfterFuel").textContent="+"+money(load.afterFuel);
 if(el("loadVerdict"))el("loadVerdict").textContent=incrementalRPM>=p.target?"STRONG ✓":incrementalRPM>=p.breakEven?"WORKS":"PASS";
 if(el("autoStackReason"))el("autoStackReason").textContent="Manual load analysis: estimated +"+money(load.afterFuel)+" after incremental fuel. Break-even is $"+p.breakEven.toFixed(2)+"/mi.";
 showScreen(2);
}
async function saveProfile(){
 const data={vehicleType:el("vehicleType")?.value,monthlyPayment:val("monthlyPayment",0),monthlyInsurance:val("monthlyInsurance",0),maintenanceCPM:val("maintenanceCPM",0),monthlyOther:val("monthlyOther",0),monthlyMiles:val("monthlyMiles",0)};
 try{localStorage.setItem("milecountProfile",JSON.stringify(data))}catch(e){}
 try{
   const s=await MileCountCloud.session();
   if(!s){if(el("saveStatus"))el("saveStatus").textContent="Saved on this device. Sign in to sync to cloud.";return}
   const v=activeVehicle;
   const existing=await MileCountCloud.defaultVehicle();
   const vehicleData={name:v.name,vehicle_type:data.vehicleType,mpg:v.mpg,cargo_length_ft:v.cargoLength,payload_lb:v.payload,monthly_payment:data.monthlyPayment,monthly_insurance:data.monthlyInsurance,maintenance_cpm:data.maintenanceCPM,monthly_other:data.monthlyOther,expected_monthly_miles:data.monthlyMiles,is_default:true};
   if(existing)await MileCountCloud.updateVehicle(existing.id,vehicleData);else await MileCountCloud.saveVehicle(vehicleData);
   if(el("saveStatus"))el("saveStatus").textContent="Saved to MileCount Cloud ✓";
 }catch(e){if(el("saveStatus"))el("saveStatus").textContent="Local save worked • Cloud: "+e.message}
}
function loadProfile(){
 try{const d=JSON.parse(localStorage.getItem("milecountProfile")||"null");if(!d)return;if(el("vehicleType")&&d.vehicleType)el("vehicleType").value=d.vehicleType;["monthlyPayment","monthlyInsurance","maintenanceCPM","monthlyOther","monthlyMiles"].forEach(id=>{if(el(id)&&d[id]!=null)el(id).value=d[id]});applyVehicle(d.vehicleType||"box26",false);updateCostUI()}catch(e){}
}
function bind(id,fn){const b=el(id);if(b)b.addEventListener("click",fn);else console.warn("Missing button",id)}
if(el("vehicleType"))el("vehicleType").addEventListener("change",function(){applyVehicle(this.value,true);updateCostUI()});
["monthlyPayment","monthlyInsurance","maintenanceCPM","monthlyOther","monthlyMiles"].forEach(id=>{if(el(id))el(id).addEventListener("input",()=>{updateCostUI();refreshFinalTripOverview()})});
applyVehicle(el("vehicleType")?.value||"box26",false);
updateCostUI();
loadProfile();
bind("analyzeManual",analyzeManualLoad);bind("saveProfile",saveProfile);
async function refreshAccount(){
 try{
  const s=await MileCountCloud.session(),logged=!!s;
  await window.MileCountTruckBrain.ready;
  if((s?.user?.id||'guest')!==brainAccount){physicalBrain=null;S.executionState=null;S.basePlanLoad=null;selectedStackKeys.clear();invalidateStackProjection('Account changed — rebuild the route.');window.MileCountTruckBrain.ready=window.MileCountTruckBrain.initialize();await window.MileCountTruckBrain.ready;}
  await syncOwnerAccess();
  el("authLoggedOut")?.classList.toggle("hidden",logged);el("authLoggedIn")?.classList.toggle("hidden",!logged);
  if(!logged)return;
  if(el("accountEmail"))el("accountEmail").textContent=s.user.email||"Signed in";
  const [p,v,t,admin]=await Promise.all([MileCountCloud.profile(),MileCountCloud.vehicles(),MileCountCloud.plannerTrips(),MileCountCloud.isAdmin()]);
  if(el("accountPlan"))el("accountPlan").textContent=admin?"MASTER ADMIN":(p?.plan||"free").toUpperCase();if(admin){const pro=el("accountPanel")?.querySelector(".card[style*='background:#0a1510']");if(pro)pro.style.display="none";}
  if(el("cloudVehicleCount"))el("cloudVehicleCount").textContent=v.length;
  if(el("cloudTripCount"))el("cloudTripCount").textContent=t.length;
 }catch(e){if(el("authMessage"))el("authMessage").textContent=e.message}
}
bind("accountButton",async function(){
 document.querySelectorAll(".screen").forEach(s=>s.classList.remove("active"));
 const panel=el("accountPanel");if(panel){panel.classList.remove("hidden");panel.scrollIntoView({behavior:"smooth",block:"start"})}
 await refreshAccount();
});
bind("testCloud",async function(){try{el("authMessage").textContent="Testing MileCount Cloud...";const h=await MileCountCloud.health();el("authMessage").textContent=h.ok?"CLOUD CONNECTED ✓ ("+h.status+")":"CLOUD FAILED • status "+h.status+(h.error?" • "+h.error:"")}catch(e){el("authMessage").textContent="CLOUD TEST ERROR • "+e.message}});
bind("signUp",async function(){try{const email=el("authEmail").value.trim(),password=el("authPassword").value,name=el("authName").value.trim();if(password.length<8)throw new Error("Use at least 8 characters.");await MileCountCloud.signUp(email,password,name);if(el("authMessage"))el("authMessage").textContent="Account created. Check your email if confirmation is required.";await refreshAccount()}catch(e){el("authMessage").textContent=e.message}});
bind("signIn",async function(){try{await MileCountCloud.signIn(el("authEmail").value.trim(),el("authPassword").value);el("authMessage").textContent="Signed in ✓";await refreshAccount()}catch(e){el("authMessage").textContent=e.message}});
bind("signOut",async function(){try{await MileCountCloud.signOut();el("authMessage").textContent="Signed out.";await refreshAccount()}catch(e){el("authMessage").textContent=e.message}});
bind("closeAccount",function(){el("accountPanel")?.classList.add("hidden");showScreen(1)});
async function loadPlannerAutoStack(){try{const q=new URLSearchParams(location.search),id=q.get("autostack_id")||localStorage.getItem("mcAutoStackPlannerId");if(!id||!window.MileCountCloud)return;const all=await MileCountCloud.plannerTrips(),t=all.find(x=>x.id===id);if(t){S.plannerTripId=t.id;if(el("from"))el("from").value=t.origin;if(el("to"))el("to").value=t.destination;if(el("pay"))el("pay").value=Number(t.original_pay||t.expected_revenue||0);if(el("space"))el("space").value=Math.max(0,26-Number(t.cargo_used_ft||0));if(el("weight"))el("weight").value=Math.max(0,10000-Number(t.weight_used_lb||0));setTimeout(findMoney,150)}localStorage.removeItem("mcAutoStackPlannerId")}catch(e){console.warn("AutoStack planner handoff",e)}}loadPlannerAutoStack();
document.querySelectorAll(".quickLane").forEach(b=>b.addEventListener("click",()=>{if(el("to"))el("to").value=b.dataset.dest||"Anywhere, USA"}));
 if(el("pickupDate")&&!el("pickupDate").value){const d=new Date();el("pickupDate").value=[d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-")}
document.addEventListener("milecount:search-area",()=>findMoney());

async function checkWarpMarketQuote(){
 const priceEl=el("marketQuotePrice"),statusEl=el("marketQuoteStatus"),detailsEl=el("marketQuoteDetails"),btn=el("checkMarketQuote");
 const origin=String(el("marketFromZip")?.value||"").trim(),destination=String(el("marketToZip")?.value||"").trim();
 const pallets=Math.max(1,Math.min(12,Math.round(val("marketPallets",1))));
 const weight=Math.max(50,Math.round(val("marketWeightPerPallet",500)));
 const pickup=el("pickupDate")?.value||"";
 const zip=/^\d{5}$/;
 if(!zip.test(origin)||!zip.test(destination)){
   if(statusEl)statusEl.textContent="NEED ZIPS";
   if(priceEl)priceEl.textContent="Enter ZIPs";
   if(detailsEl)detailsEl.textContent="Enter 5-digit ZIP codes in FROM and TO, then try again.";
   return;
 }
 if(!pickup){
   if(statusEl)statusEl.textContent="NEED DATE";
   if(detailsEl)detailsEl.textContent="Choose a pickup date first.";
   return;
 }
 if(pallets*weight>10000){
   if(statusEl)statusEl.textContent="TOO HEAVY";
   if(detailsEl)detailsEl.textContent="WARP's 26-ft box-truck quote supports up to 10,000 lb total. Reduce pallets or weight per pallet.";
   return;
 }
 try{
   if(btn){btn.disabled=true;btn.textContent="CHECKING LIVE WARP RATE..."}
   if(statusEl)statusEl.textContent="CHECKING";
   if(priceEl)priceEl.textContent="...";
   if(detailsEl)detailsEl.textContent="Requesting a live 26-ft box-truck quote from WARP.";
   const r=await fetch("https://www.wearewarp.com/api/v1/box-truck/quote",{
     method:"POST",
     headers:{"Content-Type":"application/json"},
     body:JSON.stringify({
       origin_zip:origin,
       destination_zip:destination,
       pickup_date:pickup,
       pallets,
       weight_lbs_per_pallet:weight
     })
   });
   const text=await r.text();
   let j={};try{j=text?JSON.parse(text):{}}catch(e){j={message:text}}
   if(!r.ok)throw new Error(j.message||j.error||("WARP returned "+r.status));
   const quote=Number(j.price_usd);
   if(!Number.isFinite(quote))throw new Error("WARP returned a quote without a price.");
   if(priceEl)priceEl.textContent=money(quote);
   if(statusEl)statusEl.textContent=(j.quote_tier||"LIVE").toUpperCase();
   const parts=[
     "Live WARP 26-ft box-truck shipper quote",
     j.transit_days!=null?j.transit_days+" day transit":null,
     j.delivery_date?"delivery "+j.delivery_date:null,
     j.quote_id?"Quote ID "+j.quote_id:null
   ].filter(Boolean);
   if(detailsEl)detailsEl.textContent=parts.join(" • ")+". Pricing intelligence only — not a load offered to your truck.";
 }catch(e){
   if(statusEl)statusEl.textContent="ERROR";
   if(priceEl)priceEl.textContent="Unavailable";
   if(detailsEl)detailsEl.textContent="WARP quote failed: "+(e?.message||"Unknown error")+".";
 }finally{
   if(btn){btn.disabled=false;btn.textContent="CHECK LIVE WARP QUOTE"}
 }
}

async function runNormalLoadSearch(){
 if(el("find")?.disabled)return;
 S.liveOnlyBrowse=false;saveDriverSearch();
 setBusy(true,"One moment — finding the best loads…");setButtonBusy("find",true,"FINDING LOADS…","FIND LOADS");
 try{await withTimeout(findMoney(),15000,null)}
 finally{setButtonBusy("find",false,"","FIND LOADS");setBusy(false)}
}
async function browseLiveLoadBoard(stayHome=false){
 if(el("browseLiveLoads")?.disabled&&!stayHome)return;
 setBusy(true,"One moment — refreshing connected freight…");
 if(!stayHome)setButtonBusy("browseLiveLoads",true,"REFRESHING BOARD…","BROWSE LOCAL LOADS");
 S.liveOnlyBrowse=true;
 S.stayHomeAfterSearch=!!stayHome;
 applyVehicle(el("vehicleType")?.value||"box26",false);
 // Browse uses full truck capacity but does not overwrite the driver's saved lane/filter form.
 const savedBrowse={to:el("to")?.value||"",pay:el("pay")?.value||"",maxDeadhead:el("maxDeadhead")?.value||"",minRPM:el("minRPM")?.value||"",pickupDate:el("pickupDate")?.value||"",space:el("space")?.value||"",weight:el("weight")?.value||""};
 if(el("to"))el("to").value="Anywhere, USA";
 if(el("pay"))el("pay").value=0;
 if(el("maxDeadhead"))el("maxDeadhead").value=500;
 if(el("minRPM"))el("minRPM").value=0;
 if(el("pickupDate"))el("pickupDate").value="";
 if(el("space"))el("space").value=activeVehicle.cargoLength;
 if(el("weight"))el("weight").value=activeVehicle.payload;
 try{
   await withTimeout(findMoney(),15000,null);
   await withTimeout(refreshUnifiedFreightBoard(false),12000,null);
 }finally{
   S.stayHomeAfterSearch=false;
   if(typeof savedBrowse!=="undefined"){
     ["to","pay","maxDeadhead","minRPM","pickupDate","space","weight"].forEach(k=>{if(el(k))el(k).value=savedBrowse[k]});
   }
   if(!stayHome)setButtonBusy("browseLiveLoads",false,"","BROWSE LOCAL LOADS");
   setBusy(false);
 }
}
bind("applyTripHome",async function(){
 let home=(el("tripHomeChoice")?.value||"").trim();
 if(!home){alert("Enter where you want the trip to end.");return}
 home=normalizeTripLocation(home,S.origin||S.finalRouteStops?.[0]||"");
 if(el("tripHomeChoice"))el("tripHomeChoice").value=home;
 S.home=home;physicalBrain?.configure({homeLocation:home});
 if(el("tripFinalDestination"))el("tripFinalDestination").textContent=home;
 setBusy(true,"Recalculating route to your end location…");
 try{
  const p=S.stackPlan;
  if(p?.problem){
   const retained=[...p.loads];S.homeChosen=true;
   S.allUnifiedLoads=window.MileCountPickupDelivery.unique([...(S.allUnifiedLoads||[]),...retained]);
   selectedStackKeys.clear();retained.forEach(l=>selectedStackKeys.add(loadKey(l)));
   invalidateStackProjection('Final destination changed — optimizing the whole trip.');
   await smartAutoStack();if(S.stackPlan?.valid)await finishAutoStack();
   if(el('tripSaveStatus'))el('tripSaveStatus').textContent=S.stackPlan?.valid?'Entire route recalculated to '+home:'Final destination requires a new feasible plan.';
   return;
  }
  const freightStops=(Array.isArray(S.finalRouteStops)&&S.finalRouteStops.length?S.finalRouteStops:(Array.isArray(p?.routeStops)?p.routeStops:[])).filter(isRoutableLocation);
  const currentEnd=freightStops.at(-1)||S.destination||S.origin;
  let route=null;
  if(typeof getMileCountRoadRoute==="function"&&isRoutableLocation(currentEnd)&&isRoutableLocation(home)){
    route=await withTimeout(getMileCountRoadRoute([currentEnd,home]),5000,null);
  }
  // Home is the target for Homebound Dispatcher, not another freight stop yet.
  // Keep the finalized freight route intact until a return load is selected.
  S.homeTargetMiles=Number(route?.miles||0);
  if(p)p.endLocation=home;
  if(el("tripFinalDestination"))el("tripFinalDestination").textContent=home;
  if(el("tripSaveStatus"))el("tripSaveStatus").textContent="Home/end location set to "+home+" ✓ Homebound Dispatcher will route toward it.";
  S.homeChosen=true;
  renderFinalTripStops();
  if(typeof showMileCountRoute==="function"&&freightStops.length>1)await showMileCountRoute(freightStops);
  refreshFinalTripOverview();
 }catch(e){
  console.warn("End location route update failed",e);
  if(el("tripSaveStatus"))el("tripSaveStatus").textContent="End location saved. Road-mile verification is temporarily unavailable.";
 }finally{setBusy(false)}
});
bind("saveTripButton",()=>saveCurrentTrip(true));
bind("bookAllLoads",openBookingHandoffs);
bind("startBookedTrip",async()=>{const ok=await saveCurrentTrip(true);if(ok&&el("tripSaveStatus"))el("tripSaveStatus").textContent="Trip saved. Provider confirmation is tracked separately.";});

async function startSmartDispatchFromLocation(){
 const status=el("smartDispatchStatus"),btn=el("smartDispatchLocation");
 if(!navigator.geolocation){if(status)status.textContent="Location is not supported by this browser.";return}
 if(status)status.textContent="Waiting for your location permission…";
 if(btn){btn.disabled=true;btn.textContent="LOCATING TRUCK…"}
 navigator.geolocation.getCurrentPosition(async pos=>{
   try{
     const lat=Number(pos.coords.latitude),lng=Number(pos.coords.longitude);
     S.manualTruckLocation=false;
     S.driverLocation={lat,lng,accuracy:Number(pos.coords.accuracy||0),updatedAt:Date.now()};
     S.smartDispatchLocationEnabled=true;S.smartDispatchOrigin=lat.toFixed(5)+','+lng.toFixed(5);
     await window.MileCountTruckBrain.ready;window.MileCountTruckBrain.setActualState({currentLocation:S.smartDispatchOrigin,onboardLoads:truckBrain().onboardLoads});
     if(status)status.textContent="Truck location approved ✓ Searching freight that makes sense from your current position…";
     const oldFrom=el("from")?.value;
     if(el("from"))el("from").value=S.smartDispatchOrigin;
     await browseLiveLoadBoard(true);
     if(el("from"))el("from").value=oldFrom||"";
     const result=await refreshDispatchRecommendations('dispatch');if(status)status.textContent=result?.message||'Review the Best Next Move panel.';showScreen(2);
   }catch(e){console.warn("Smart Dispatch location search",e);if(status)status.textContent="Location received, but freight search could not finish. Try again."}
   finally{if(btn){btn.disabled=false;btn.textContent="📍 REFRESH MY LOCATION"}}
 },err=>{
   if(status)status.textContent=err.code===1?"Location permission was not granted. Manual MileCount still works normally.":"Could not get your current location. Try again.";
   if(btn){btn.disabled=false;btn.textContent="📍 USE MY CURRENT LOCATION"}
 },{enableHighAccuracy:true,timeout:10000,maximumAge:60000});
}
bind("find",runNormalLoadSearch);


function localSimPool(home){
 const today=dateISOPlus(0),h=String(home||"Atlanta, GA").toUpperCase();
 const state=(h.match(/,\s*([A-Z]{2})(?:\b|$)/)||[])[1]||"GA";
 const markets={
  GA:["Riverdale, GA","Atlanta, GA","Forest Park, GA","College Park, GA","Fairburn, GA","Union City, GA","McDonough, GA","Stockbridge, GA","Marietta, GA","Smyrna, GA","Kennesaw, GA","Alpharetta, GA","Duluth, GA","Norcross, GA","Lawrenceville, GA","Newnan, GA","Peachtree City, GA","Macon, GA","Athens, GA"],
  FL:["Tampa, FL","Lakeland, FL","Orlando, FL","Kissimmee, FL","Plant City, FL","Clearwater, FL","St. Petersburg, FL","Leesburg, FL","Ocala, FL","Jacksonville, FL"],
  NC:["Charlotte, NC","Gastonia, NC","Concord, NC","Huntersville, NC","Greensboro, NC","Winston-Salem, NC","Raleigh, NC","Durham, NC"],
  SC:["Greenville, SC","Spartanburg, SC","Simpsonville, SC","Columbia, SC","Rock Hill, SC","Charleston, SC"],
  TN:["Chattanooga, TN","Nashville, TN","Murfreesboro, TN","Knoxville, TN","Johnson City, TN","Cleveland, TN"],
  AL:["Birmingham, AL","Montgomery, AL","Auburn, AL","Huntsville, AL","Tuscaloosa, AL"]
 };
 const cities=markets[state]||markets.GA,rows=[];
 for(let i=0;i<Math.min(24,cities.length*2);i++){
   const a=cities[i%cities.length],b=cities[(i*3+2)%cities.length];if(a===b)continue;
   const miles=18+((i*17)%105),pay=175+((i*55)%425),weight=700+((i*430)%4200),space=3+((i*2)%9);
   const hour=6+(i%11),pickup=String(hour).padStart(2,"0")+":00-"+String(hour+1).padStart(2,"0")+":00";
   rows.push([a,b,pay,miles,weight,space,pickup,String(hour+1).padStart(2,"0")+":15-"+String(hour+3).padStart(2,"0")+":00"]);
 }
 return rows.map((r,i)=>({name:state+" LOCAL SIM "+(i+1),provider:"MileCount Local SIM",providerLoadId:"MC-"+state+"-"+today+"-"+(i+1),pickup:r[0],delivery:r[1],pay:r[2],loadedMiles:r[3],weight:r[4],space:r[5],pickupDate:today,pickupWindow:null,deliveryWindow:null,simSuggestedPickup:r[6],simSuggestedDelivery:r[7],equipment:"Box Truck",commodity:"Local palletized freight",isSandbox:true,isLocalSim:true,sandboxLabel:"LOCAL SIM • NOT BOOKABLE"}));
}
async function fetchDirectFreightLocal(home,strict=false){
 home=String(home||syncTruckBrain("df-search").currentLocation||S.origin||"").trim();
 try{
  const r=await withTimeout(fetch("https://lrnyxqtmywkhtrmsjquc.supabase.co/functions/v1/directfreight-adapter",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({origin:home,radius:175,max_trip_miles:1000,max_weight:currentCapacity().maxWeight,limit:60})}),8000,null);
  if(!r?.ok)throw Error('Direct Freight search timed out or returned an error');
  const j=await r.json();
  S.directFreightConfigured=!!j.configured;if(j.configured===false||!Array.isArray(j.loads))throw Error(j.error||'Direct Freight is not configured');
  return enforceWeightCap(Array.isArray(j.loads)?j.loads:[]);
 }catch(e){if(strict)throw e;console.warn("Direct Freight adapter",e);return[]}
}
async function fetchTrukTekLocal(home,strict=false){
 home=String(home||syncTruckBrain("truktek-search").currentLocation||S.origin||"Atlanta, GA").trim();
 const parts=String(home||"Atlanta, GA").split(","),city=(parts[0]||"Atlanta").trim(),state=(parts[1]||"GA").trim().slice(0,2).toUpperCase();
 try{
  const url="https://www.truktek.com/api/loads?octy="+encodeURIComponent(city)+"&ost="+encodeURIComponent(state)+"&milesSlider=100&gross_rpm=0";
  const r=await withTimeout(fetch(url,{cache:"no-store"}),6500,null);if(!r?.ok)throw Error('TrukTek search timed out or returned an error');
  const j=await r.json();if(!Array.isArray(j.loads))throw Error('TrukTek returned an invalid load list');
  return enforceWeightCap((j.loads||[]).map(x=>({
   name:(x.octy+", "+x.ost)+" → "+(x.dcty+", "+x.dst),
   provider:"TrukTek",providerLoadId:String(x.loadId||""),
   pickup:x.octy+", "+x.ost,delivery:x.dcty+", "+x.dst,pay:Number(x.ratePay||0),
   loadedMiles:Number(x.loadDist||0),deadheadMiles:Number(x.o2oDist||0),
   weight:Number(x.weight||0),space:Number(x.length||0),pickupDate:x.pickupDate||null,
   deliveryDate:x.deliveryDate||null,equipment:x.equip||null,pickupWindow:x.pickupWindow||null,deliveryWindow:x.deliveryWindow||null,commodity:x.commodity||null,sourceUrl:x.sourceUrl||x.url||null,isSandbox:false,sourceType:"REAL"
  })));
 }catch(e){if(strict)throw e;console.warn("TrukTek local direct search",e);return[]}
}
function dedupeNormalizedLoads(loads){
 const seen=new Set();
 return (loads||[]).filter(l=>{
  const k=[laneCity(l.pickup),laneCity(l.delivery),Math.round(Number(l.pay||0)),String(l.pickupDate||"")].join("|");
  if(seen.has(k))return false;seen.add(k);return true;
 });
}
async function buildLocalMoneyDay(){
 const btn=el("localMoneyMode"),status=el("localMoneyStatus");
 if(btn){btn.disabled=true;btn.textContent="BUILDING LOCAL DAY…"}
 try{
   let typedHome=(el("from")?.value||"").trim();
   if(!typedHome&&!S.manualTruckLocation&&!S.smartDispatchLocationEnabled&&navigator.geolocation){
     await new Promise(resolve=>navigator.geolocation.getCurrentPosition(pos=>{
       const lat=Number(pos.coords.latitude),lng=Number(pos.coords.longitude);
       S.driverLocation={lat,lng,accuracy:Number(pos.coords.accuracy||0),updatedAt:Date.now()};
       S.smartDispatchLocationEnabled=true;S.smartDispatchOrigin=lat.toFixed(5)+","+lng.toFixed(5);resolve();
     },()=>resolve(),{enableHighAccuracy:false,timeout:2500,maximumAge:300000}));
     typedHome=(el("from")?.value||"").trim();
   }
   if(!S.smartDispatchLocationEnabled&&!typedHome){if(status)status.textContent="Choose where the truck is first.";return}
   const home=(S.smartDispatchLocationEnabled&&isRoutableLocation(S.smartDispatchOrigin)?S.smartDispatchOrigin:typedHome).trim();
   S.home=home;S.origin=home;S.homeChosen=true;S.localMoneyMode=true;S.localMaxLoads=5;
   const homeLabel=(S.smartDispatchLocationEnabled&&S.smartDispatchOrigin===home)?"your truck location":home;
   if(status)status.textContent="Finding local money around "+homeLabel+"…";

   // Fetch every source concurrently. Do NOT let a slow provider block the first screen.
   // Local Day must NEVER reuse the nationwide/current candidate board.
   // Only fresh provider searches + local SIM seeded from the truck market belong here.
   const localSeed=(typedHome||S.home||"Atlanta, GA").trim();
   const sourceJobs=[
     fetchTrukTekLocal(home).catch(()=>[]),
     fetchDirectFreightLocal(home).catch(()=>[]),
     fetchLoadBootSandbox(false).catch(()=>[]),
     Promise.resolve(localSimPool(localSeed))
   ];
   const localState=(String(localSeed).match(/,\s*([A-Z]{2})\s*$/i)||[])[1]?.toUpperCase()||"";
   const isLocalCandidate=l=>{
     const p=String(l?.pickup||"").trim().toUpperCase();
     // When a city/state is known, Local Day starts with pickups in that state.
     // GPS coordinates cannot yield a state here, so local SIM/direct searches remain eligible.
     return !localState||p.endsWith(", "+localState)||l?.isLocalSim;
   };
   const quick=await Promise.all(sourceJobs.map(p=>Promise.race([p,new Promise(r=>setTimeout(()=>r([]),1200))])));
   let raw=dedupeNormalizedLoads(enforceWeightCap(quick.flat())).filter(isLocalCandidate);
   // Always render a first screen immediately from source data; routing enrichment must never hide loads.
   raw.sort((a,b)=>Number(b.pay||0)-Number(a.pay||0));
   const first=raw.slice(0,5);
   S.candidateLoads=first;S.allUnifiedLoads=[...first];
   renderUnifiedLoadList(first);showScreen(2);
   if(status)status.textContent=first.length?"Showing first "+first.length+" • checking more loads…":"Checking connected providers…";

   // Show the first local loads immediately. Do NOT auto-select/stack until the
   // local pool is established; this prevents nationwide sandbox lanes from being mixed in.
   selectedStackKeys.clear();updateStackTray();

   // Full provider results + route enrichment continue in background.
   Promise.all(sourceJobs).then(async all=>{
     let full=dedupeNormalizedLoads(enforceWeightCap(all.flat())).filter(isLocalCandidate).slice(0,40);
     const enriched=await Promise.all(full.map(async l=>{
       const loaded=Number(l.loadedMiles||0);
       try{
         const [toPickup,back]=await Promise.all([
           withTimeout(roadMilesBetween(home,l.pickup),1600,null),
           withTimeout(roadMilesBetween(l.delivery||l.pickup,home),1600,null)
         ]);
         if(Number.isFinite(toPickup)){l.deadheadMiles=Number(toPickup);l.localSoloMiles=Number(toPickup)+loaded+(Number.isFinite(back)?Number(back):0);l.localAfterGas=Number(l.pay||0)-Number(fuelFor(Math.max(1,Number(toPickup)+loaded)).fuelCost||0)}
       }catch(e){}
       return l; // route timeout never deletes the load
     }));
     enriched.sort((a,b)=>Number(b.localAfterGas??b.pay??0)-Number(a.localAfterGas??a.pay??0));
     // Refresh the board, but preserve any selections that still exist in the new local pool.
     S.candidateLoads=enriched;S.allUnifiedLoads=[...enriched];renderUnifiedLoadList(enriched);updateStackTray();
     // Once the complete LOCAL pool is visible, select the strongest plan candidates.
     const picks=enriched.slice(0,Math.min(currentPlan().maxStack===Infinity?5:currentPlan().maxStack,5));
     selectedStackKeys.clear();picks.forEach(l=>selectedStackKeys.add(loadKey(l)));updateStackTray();
     if(picks.length>=2)setTimeout(async()=>{
       await smartAutoStack();
       if(S.stackPlan&&!S.stackPlan.valid&&!S.stackPlan.feasible){
         const proposal=await proposeAutoCorrect();
         if(proposal?.loads?.length){
           // Local Day is an automatic dispatcher mode: apply the feasible prune
           // immediately instead of leaving impossible loads selected.
           selectedStackKeys.clear();proposal.loads.forEach(l=>selectedStackKeys.add(loadKey(l)));
           S.autoCorrectProposal=null;updateStackTray();await smartAutoStack();
         }
       }
     },80);
     const sc={real:enriched.filter(x=>!x.isSandbox&&!x.isLocalSim).length,sandbox:enriched.filter(x=>x.isSandbox&&!x.isLocalSim).length,sim:enriched.filter(x=>x.isLocalSim).length};
     S.localSourceCounts=sc;
     if(status)status.textContent="LOCAL MONEY ✓ "+enriched.length+" loads • "+sc.real+" real • "+sc.sandbox+" sandbox • "+sc.sim+" SIM";
   }).catch(e=>console.warn("Local Day background refresh",e));
 }catch(e){console.warn("Local Money Mode",e);if(status)status.textContent="Could not finish the local-day build. Try again."}
 finally{if(btn){btn.disabled=false;btn.textContent="💰 BUILD MY LOCAL DAY"}}
}

async function browseStateLoads(state){
 state=String(state||"").toUpperCase();if(!state)return;
 const sel=el("stateLoadBrowser"),status=el("stateBrowseStatus");
 if(status)status.textContent="Loading "+state+" local freight…";
 try{
   const stateNames={GA:"Atlanta, GA",FL:"Orlando, FL",NC:"Charlotte, NC",SC:"Columbia, SC",TN:"Nashville, TN",AL:"Birmingham, AL",TX:"Dallas, TX",CA:"Los Angeles, CA",IL:"Chicago, IL",NY:"Albany, NY",NJ:"Newark, NJ",PA:"Philadelphia, PA",OH:"Columbus, OH",MI:"Detroit, MI",VA:"Richmond, VA",MD:"Baltimore, MD"};
   const seed=stateNames[state]||("Anywhere, "+state);
   // Selecting a state is an explicit planning-location override.
   S.manualTruckLocation=true;S.smartDispatchLocationEnabled=false;S.smartDispatchOrigin="";
   S.origin=seed;
   if(el("from"))el("from").value=seed;
   if(status)status.textContent="🚚 TRUCK LOCATION: "+seed+" • Loading local freight…";
   const [truk,direct,sandbox]=await Promise.all([fetchTrukTekLocal(seed),fetchDirectFreightLocal(seed),fetchLoadBootSandbox(false)]);
   const existing=Array.isArray(S.allUnifiedLoads)?S.allUnifiedLoads:[];
   const sims=localSimPool(seed);
   const all=dedupeNormalizedLoads(enforceWeightCap([...existing,...truk,...direct,...sandbox,...sims]));
   const inState=all.filter(l=>{
     // State browsing is LOCAL discovery: the pickup must be inside the state
     // the driver selected. A load merely delivering into that state belongs to
     // the pickup state's board, not this one.
     const p=String(l.pickup||"").trim().toUpperCase();
     return p.endsWith(", "+state);
   });
   S.candidateLoads=inState;S.allUnifiedLoads=inState;
   updateProviderFilterOptions(inState);renderUnifiedLoadList(inState);
   const profile=updateCostUI();
   if(typeof window.renderMileCountLoadMap==="function")await window.renderMileCountLoadMap(inState,{breakEven:profile.breakEven,target:profile.target,origin:seed,destination:""});
   if(status)status.textContent=inState.length+" local pickup loads in "+state+" • REAL, SANDBOX and SIM clearly labeled";
   const total=el("unifiedFreightCount");if(total)total.textContent=inState.length.toLocaleString();
   // State selection is an action: open the freight results immediately.
   // Do not leave the driver sitting on the map after they chose a state.
   if(inState.length){
     showScreen(2);
     setTimeout(()=>el("loadCandidates")?.scrollIntoView({behavior:"smooth",block:"start"}),100);
   }else{
     // Stay on the map only when there truly are no results to show.
     setTimeout(()=>el("stateBrowseStatus")?.scrollIntoView({behavior:"smooth",block:"center"}),80);
   }
 }catch(e){console.warn("State load browser",e);if(status)status.textContent="Could not load this state. Try again."}
}
bind("localMoneyMode",buildLocalMoneyDay);
el("stateLoadBrowser")?.addEventListener("change",e=>browseStateLoads(e.target.value));
bind("browseLiveLoads",()=>browseLiveLoadBoard(false));
bind("refreshLiveMap",async()=>{await browseLiveLoadBoard(true);await Promise.all([refreshLiveLoadCount(),refreshUnifiedFreightBoard(true)])});
bind("viewLoadList",()=>showScreen(2));
bind("addTrip",addToTrip);
bind("checkMarketQuote",checkWarpMarketQuote);bind("backToOptions",function(){showScreen(2)});bind("protect",protectReturn);bind("getHome",getHomePaid);bind("finishHomebound",async()=>{if(S.returnPay>0&&!S.homeAdded){await getHomePaid();return}await viewUpdatedTrip()});bind("updatedTrip",viewUpdatedTrip);bind("restart",startNewTrip);
restoreDriverSearch();
applyVehicle(el("vehicleType")?.value||"box26",false);
["from","to","vehicleType","maxDeadhead","minRPM","pickupDate"].forEach(id=>el(id)?.addEventListener("change",saveDriverSearch));
setTimeout(()=>browseLiveLoadBoard(true),250);

let liveCountRequest=null;
function refreshLiveLoadCount(){
 if(liveCountRequest)return liveCountRequest;
 liveCountRequest=fetchLiveLoadCount().finally(()=>{liveCountRequest=null});
 return liveCountRequest;
}
async function fetchLiveLoadCount(){
 const countEl=el("liveLoadCount"),sourceEl=el("liveLoadCountSource");
 if(countEl)countEl.textContent="Checking…";
 try{
   const r=await withTimeout(fetch("https://lrnyxqtmywkhtrmsjquc.supabase.co/functions/v1/milecount-live-count",{cache:"no-store"}),8000,null);
   if(!r)throw new Error("Live count timed out");
   const j=await r.json();
   if(!r.ok||j.ok===false)throw new Error(j.error||("Count service "+r.status));
   const n=Number(j.count??j.total??0);
   if(countEl)countEl.textContent=n.toLocaleString()+" LOAD"+(n===1?"":"S");
   if(sourceEl)sourceEl.textContent="TrukTek live public feed";
 }catch(e){
   if(countEl)countEl.textContent="Unavailable";
   if(sourceEl)sourceEl.textContent="Live count could not refresh";
 }
}

refreshLiveLoadCount();
// Live count is refreshed by the single background audit below.

let loadBootSandboxLoads=[];
let loadBootSandboxLastFetch=0;

function loadBootText(v){
 if(v==null)return "";
 if(typeof v==="string")return v;
 return [v.city,v.state].filter(Boolean).join(", ");
}
function normalizeLoadBootSandbox(x){
 const ref=String(x.ref??x.id??x.load_ref??"");
 const origin=loadBootText(x.origin??x.origin_city??x.pickup);
 const destination=loadBootText(x.destination??x.destination_city??x.delivery);
 const rate=Number(x.rate??x.pay??x.amount??0);
 const miles=Number(x.miles??x.loaded_miles??x.distance??0);
 const rpm=Number(x.rpm??(miles>0?rate/miles:0));
 const equipment=String(x.equipment??x.equipment_type??"");
 const commodity=String(x.commodity??"SANDBOX TEST");
 return {
   name:(origin||"Pickup")+" → "+(destination||"Delivery")+" • LoadBoot SANDBOX",
   provider:"LoadBoot SANDBOX",
   providerLoadId:ref,
   bookingReference:ref,
   pickup:origin,
   delivery:destination,
   origin:typeof x.origin==="object"?x.origin:{city:(origin.split(",")[0]||"").trim(),state:(origin.split(",")[1]||"").trim()},
   destination:typeof x.destination==="object"?x.destination:{city:(destination.split(",")[0]||"").trim(),state:(destination.split(",")[1]||"").trim()},
   pay:rate,
   loadedMiles:miles,
   rpm,
   deadhead:0,
   equipment,
   pickupDate:x.pickup_date??x.pickupDate??null,
   posted:x.posted??null,
   expiresAt:x.expires_at??null,
   commodity,
   weight:Number(x.weight??0),
   space:0,
   broker:x.posted_by??null,
   routeCoordinates:[],
   sourceUrl:"https://loadboot.com/app/carrier/?src=milecount&ref="+encodeURIComponent(ref),
   isSandbox:true,
   sandboxLabel:"SANDBOX TEST"
 };
}
function extractLoadBootArray(data){
 if(Array.isArray(data))return data;
 if(Array.isArray(data?.loads))return data.loads;
 if(Array.isArray(data?.data))return data.data;
 if(Array.isArray(data?.items))return data.items;
 if(Array.isArray(data?.results))return data.results;
 return [];
}
let loadBootSandboxRequest=null;
function fetchLoadBootSandbox(force=false){
 if(loadBootSandboxRequest)return loadBootSandboxRequest;
 // The provider permits polling at most once per five minutes, including manual refresh.
 if(loadBootSandboxLastFetch&&Date.now()-loadBootSandboxLastFetch<300000)return Promise.resolve(loadBootSandboxLoads);
 loadBootSandboxRequest=fetchLoadBootSandboxNow().finally(()=>{loadBootSandboxRequest=null});
 return loadBootSandboxRequest;
}
async function fetchLoadBootSandboxNow(){
 const now=Date.now();
 loadBootSandboxLastFetch=now;
 const badge=el("loadBootSandboxStatus");
 try{
   if(badge)badge.textContent="Checking sandbox…";
   const r=await withTimeout(fetch("https://lrnyxqtmywkhtrmsjquc.supabase.co/functions/v1/loadboot-sandbox?resource=loads&limit=50",{cache:"no-store"}),8000,null);if(!r)throw new Error("LoadBoot sandbox timed out");
   const j=await r.json();
   if(!r.ok||j.ok===false)throw new Error(j.error?.message||j.error||("Sandbox "+r.status));
   const raw=extractLoadBootArray(j.data);
   loadBootSandboxLoads=enforceWeightCap(raw.map(normalizeLoadBootSandbox));
   loadBootSandboxLastFetch=now;
   if(badge)badge.textContent=loadBootSandboxLoads.length+" TEST LOAD"+(loadBootSandboxLoads.length===1?"":"S");
   const count=el("loadBootSandboxCount");
   if(count)count.textContent=loadBootSandboxLoads.length.toLocaleString();
   return loadBootSandboxLoads;
 }catch(e){
   console.warn("LoadBoot sandbox unavailable",e);
   if(badge)badge.textContent="Sandbox unavailable";
   return [];
 }
}


function providerFilterKey(l){
 if(isLoadBootRecord(l))return "loadboot-sandbox";
 if(l.isLocalSim)return "milecount-sim";
 return String(l.provider||"unknown").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
}
function updateProviderFilterOptions(loads){
 const sel=el("providerFilter");if(!sel)return;
 const current=sel.value||"all";
 const seen=new Map();
 (loads||[]).forEach(l=>{
   const key=providerFilterKey(l);
   const label=isLoadBootRecord(l)?"LoadBoot Sandbox":(l.isLocalSim?"MileCount SIM":(String(l.provider||"").toLowerCase()==="direct freight"?"Direct Freight"+(Number.isFinite(S.directFreightLiveCount)?" • "+S.directFreightLiveCount+" live":""):(l.provider||"Other Provider")));
   if(key&&!seen.has(key))seen.set(key,label);
 });
 if(S.directFreightConfigured&&!seen.has("direct-freight"))seen.set("direct-freight","Direct Freight"+(Number.isFinite(S.directFreightLiveCount)?" • "+S.directFreightLiveCount+" live":""));
 const options=[
  ["all","All Companies"],
  ["live","Live Only"],
  ["sandbox","Sandbox / Test Only"],
  ...[...seen.entries()]
 ];
 sel.innerHTML=options.map(([v,label])=>'<option value="'+v+'">'+label+'</option>').join("");
 sel.value=options.some(x=>x[0]===current)?current:"all";
}
function filteredUnifiedLoads(loads){
 const mode=el("providerFilter")?.value||"all";
 if(mode==="all")return loads;
 if(mode==="live")return loads.filter(l=>!l.isSandbox);
 if(mode==="sandbox")return loads.filter(l=>!!l.isSandbox);
 return loads.filter(l=>providerFilterKey(l)===mode);
}
async function applyProviderFilter(){
 const all=Array.isArray(S.allUnifiedLoads)?S.allUnifiedLoads:[];
 const selectedProvider=el("providerFilter")?.value||"all";
 if(selectedProvider==="direct-freight")setBoardStatus("working","Direct Freight • live production freight");
 const filtered=filteredUnifiedLoads(all);
 S.candidateLoads=filtered;
 const profile=updateCostUI();
 if(typeof window.renderMileCountLoadMap==="function")await window.renderMileCountLoadMap(filtered,{breakEven:profile.breakEven,target:profile.target,origin:S.origin,destination:S.destination});
 renderUnifiedLoadList(filtered);
 const showing=el("providerFilterShowing");
 if(showing){
  const df=selectedProvider==="direct-freight",age=S.directFreightLastUpdated?Math.max(0,Math.round((Date.now()-S.directFreightLastUpdated)/60000)):null;
  showing.textContent=df?"Direct Freight: "+filtered.length+" live load"+(filtered.length===1?"":"s")+" returned • updated "+(age===0?"just now":age+" min ago"):"Showing "+filtered.length+" of "+all.length+" freight opportunities";
 }
}




function currentCapacity(){
 const actual=physicalBrain?.get(),exact=actual?.profile;
 if(actual?.currentLocation&&exact?.payloadLb!=null&&exact?.cargoLengthFt!=null)return {maxWeight:exact.payloadLb,maxSpace:exact.cargoLengthFt,availableWeight:actual.remainingWeight,availableSpace:actual.remainingSpace};
 const maxWeight=exact?.payloadLb??Math.min(MAX_LOAD_WEIGHT_LB,Number(activeVehicle.payload||MAX_LOAD_WEIGHT_LB));
 const maxSpace=exact?.cargoLengthFt??Number(activeVehicle.cargoLength||26);
 const inputWeight=Math.max(0,Math.min(maxWeight,val("weight",maxWeight)));
 const inputSpace=Math.max(0,Math.min(maxSpace,val("space",maxSpace)));
 const base=S.capacityState||{};
 return {
   maxWeight,maxSpace,
   availableWeight:Number.isFinite(base.availableWeight)?Math.min(maxWeight,Math.max(0,base.availableWeight)):inputWeight,
   availableSpace:Number.isFinite(base.availableSpace)?Math.min(maxSpace,Math.max(0,base.availableSpace)):inputSpace
 };
}
function syncCapacityState(weight,space,writeInputs=true){
 const c=currentCapacity();
 S.capacityState={
   maxWeight:c.maxWeight,maxSpace:c.maxSpace,
   availableWeight:Math.min(c.maxWeight,Math.max(0,Number(weight))),
   availableSpace:Math.min(c.maxSpace,Math.max(0,Number(space)))
 };
 if(S.truckBrain)syncTruckBrain("capacity");
 if(writeInputs){
   if(el("weight"))el("weight").value=Math.round(S.capacityState.availableWeight);
   if(el("space"))el("space").value=Number(S.capacityState.availableSpace.toFixed(1));
 }
 if(el("capacityEverywhere"))el("capacityEverywhere").textContent=Math.round(S.capacityState.availableWeight).toLocaleString()+" lb • "+S.capacityState.availableSpace.toFixed(1)+" ft available";
 return S.capacityState;
}
function captureCapacityInputs(){
 const maxWeight=physicalBrain?.get().profile.payloadLb??Math.min(MAX_LOAD_WEIGHT_LB,Number(activeVehicle.payload||MAX_LOAD_WEIGHT_LB));
 const maxSpace=Number(activeVehicle.cargoLength||26);
 syncCapacityState(Math.min(maxWeight,Math.max(0,val("weight",maxWeight))),Math.min(maxSpace,Math.max(0,val("space",maxSpace))),false);
}

function createTripState(start){
 const cap=currentCapacity();
 return {
  location:start||S.origin||"",
  onboard:[],
  completed:[],
  events:[],
  initialAvailableWeight:cap.availableWeight,
  initialAvailableSpace:cap.availableSpace,
  capacityWeightLimit:cap.availableWeight,
  capacitySpaceLimit:cap.availableSpace,
  onboardWeight:0,
  onboardSpace:0,
  peakWeight:0,
  peakSpace:0,
  liveRevenue:0,
  testRevenue:0,
  miles:0,
  feasible:true,
  issues:[]
 };
}
function tripLoadId(l){return loadKey(l)}
function applyTripPickup(state,l){
 const w=Math.max(0,Number(l.weight||0)),sp=Math.max(0,Number(l.space||0));
 state.location=l.pickup||state.location;
 state.onboard.push(l);
 state.onboardWeight+=w;state.onboardSpace+=sp;
 state.peakWeight=Math.max(state.peakWeight,state.onboardWeight);
 state.peakSpace=Math.max(state.peakSpace,state.onboardSpace);
 const maxPayload=Number(state.capacityWeightLimit??currentCapacity().availableWeight);
 const maxSpace=Number(state.capacitySpaceLimit??currentCapacity().availableSpace);
 const ok=state.onboardWeight<=maxPayload&&state.onboardSpace<=maxSpace;
 if(!ok){
   state.feasible=false;
   state.issues.push("Capacity exceeded at "+state.location);
 }
 state.events.push({type:"pickup",location:state.location,load:l,onboardWeight:state.onboardWeight,onboardSpace:state.onboardSpace,ok});
 return ok;
}
function applyTripDrop(state,l){
 const id=tripLoadId(l),idx=state.onboard.findIndex(x=>tripLoadId(x)===id);
 if(idx>=0)state.onboard.splice(idx,1);
 state.onboardWeight=Math.max(0,state.onboardWeight-Math.max(0,Number(l.weight||0)));
 state.onboardSpace=Math.max(0,state.onboardSpace-Math.max(0,Number(l.space||0)));
 state.location=l.delivery||state.location;
 state.completed.push(l);
 if(l.isSandbox)state.testRevenue+=Number(l.pay||0);else state.liveRevenue+=Number(l.pay||0);
 state.events.push({type:"drop",location:state.location,load:l,onboardWeight:state.onboardWeight,onboardSpace:state.onboardSpace,ok:true});
}
function tripSnapshot(state){
 return {
  location:state.location,
  onboardCount:state.onboard.length,
  onboardWeight:state.onboardWeight,
  onboardSpace:state.onboardSpace,
  availableWeight:Math.max(0,Number(state.capacityWeightLimit??currentCapacity().availableWeight)-state.onboardWeight),
  availableSpace:Math.max(0,Number(state.capacitySpaceLimit??currentCapacity().availableSpace)-state.onboardSpace),
  completedCount:state.completed.length,
  liveRevenue:state.liveRevenue,
  testRevenue:state.testRevenue,
  feasible:state.feasible
 };
}

const selectedStackKeys=new Set();
function loadKey(l){
 return l._mcLoadKey||String(l.providerLoadId||l.id||l.bookingReference||l.name||'')+'|'+String(l.provider||'');
}
function stackSelectedLoads(){
 const all=Array.isArray(S.allUnifiedLoads)?S.allUnifiedLoads:(S.candidateLoads||[]);
 return all.filter(l=>selectedStackKeys.has(loadKey(l)));
}
function updateStackTray(){
 const chosen=stackSelectedLoads(),tray=el("stackTray"),count=el("stackCount"),pay=el("stackSelectedPay");
 if(count)count.textContent=chosen.length;
 if(pay)pay.textContent=money(chosen.reduce((s,l)=>s+Number(l.pay||0),0));
 if(tray)tray.classList.toggle("active",chosen.length>0);
 syncTruckBrain("stack-selection");
  window.MileCountBooking?.refreshCommittedSummary?.();
 // Manual choice is valid with one or more selected loads; AutoStack remains optional.
 const done=el("doneStack");if(done)done.classList.toggle("hidden",chosen.length<1);
}
function toggleStackLoad(index){
 const loads=S.candidateLoads||[],l=loads[index];if(!l)return;
 const key=loadKey(l),p=currentPlan();
 // Regression fix: this function receives "index"; the previous entitlement
 // check referenced an undefined variable "i", throwing before STACK could toggle.
 if(!selectedStackKeys.has(key)&&selectedStackKeys.size>=p.maxStack){alert(p.name+" supports up to "+p.maxStack+" AutoStack loads. Upgrade for more.");return}

 if(selectedStackKeys.has(key)){selectedStackKeys.delete(key);S.planCommitments=(S.planCommitments||[]).filter(x=>loadKey(x)!==key);}else selectedStackKeys.add(key);
 invalidateStackProjection();
 document.querySelectorAll(".candidateLoad").forEach((b,i)=>{
   const x=loads[i];b.classList.toggle("stackChosen",!!x&&selectedStackKeys.has(loadKey(x)));
 });
 updateStackTray();
}
function normalizeTripLocation(v,fallbackState=""){
 const s=String(v||"").trim();if(!s)return "";
 if(s.includes(","))return s;
 const state=String(fallbackState||"").match(/,\s*([A-Z]{2})\s*$/i)?.[1]?.toUpperCase()||"";
 return state?s+", "+state:s;
}
function laneCity(v){
 return String(v||"").trim().toLowerCase()
  .replace(/\s+/g," ")
  .split(",").slice(0,2).join(",");
}
function mcClock(v){
 const s=String(v||"").trim(),m=s.match(/(\d{1,2}):(\d{2})(?:\s*([AP]M))?/i);if(!m)return null;
 let h=Number(m[1]),min=Number(m[2]),ap=String(m[3]||"").toUpperCase();
 if(ap){if(h===12)h=0;if(ap==="PM")h+=12}
 return h*60+min;
}
function mcWindow(load,type){
 const raw=type==="pickup"?(load.pickupWindow||load.pickup_time||load.pickupTime):(load.deliveryWindow||load.delivery_time||load.deliveryTime);
 if(!raw)return null;
 const p=String(raw).split(/\s*[-–—]\s*/),a=mcClock(p[0]),b=mcClock(p[1]||p[0]);
 if(!Number.isFinite(a))return null;
 let end=Number.isFinite(b)?b:a;if(end<a)end+=1440;
 return {start:a,end,raw:String(raw)};
}
function mcTime(m){m=((Math.round(m)%1440)+1440)%1440;const h=Math.floor(m/60),n=m%60;return (h%12||12)+":"+String(n).padStart(2,"0")+" "+(h>=12?"PM":"AM")}
function strongFitScore(l,origin){
 const econ=loadEconomics(l),dh=Math.max(0,Number(l.deadheadMiles??l.smartDispatchDeadhead??0)),rpm=Number(econ.rpm||0),pay=Number(l.pay||0);
 const timeBonus=(l.pickupWindow||l.pickup_time||l.pickupTime)?40:0;
 return (rpm*110)+(pay/20)-dh+timeBonus;
}
async function strongFitAlternatives(excluded,all,origin){if(!currentPlan().strongFit)return[];
 const brain=syncTruckBrain("strong-fit"),used=new Set((excluded||[]).map(loadKey)),from=String(origin||brain.currentLocation||S.origin||"").trim(),ranked=[];
 for(const l of (all||[])){
  if(used.has(loadKey(l))||!isRoutableLocation(l.pickup)||!isRoutableLocation(l.delivery))continue;
  const dh=await withTimeout(roadMilesBetween(from,l.pickup),1400,null);
  if(!Number.isFinite(dh))continue;
  const maxDh=Math.min(175,Math.max(50,Number(el("maxDeadhead")?.value||100)));
  if(Number(dh)>maxDh)continue;
  const loaded=Math.max(1,Number(l.loadedMiles||0)),allMiles=Number(dh)+loaded,rpm=allMiles>0?Number(l.pay||0)/allMiles:0;
  ranked.push({...l,strongFitDeadhead:Number(dh),strongFitAllMiles:allMiles,strongFitRPM:rpm,strongFitRouteScore:(rpm*120)+(Number(l.pay||0)/25)-Number(dh)});
 }
 return ranked.sort((a,b)=>b.strongFitRouteScore-a.strongFitRouteScore).slice(0,5);
}
async function runDispatchSolver(method,...args){return window.MileCountOptimizer?window.MileCountOptimizer.run(method,args):method==='dispatch'?window.MileCountDispatchPlanner.recommend(...args):window.MileCountPickupDelivery[method](...args);}
function mcZonedMinute(date,clock,zone,anchor){
 const desired=Date.parse(date+'T00:00:00Z')+clock*60000;
 if(!Number.isFinite(desired))throw Error('Invalid appointment date');
 const fmt=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
 let epoch=desired;
 for(let i=0;i<3;i++){const v=Object.fromEntries(fmt.formatToParts(new Date(epoch)).filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));const wall=Date.parse(v.year+'-'+v.month+'-'+v.day+'T'+v.hour+':'+v.minute+':00Z');epoch+=desired-wall;}
 return (epoch-anchor)/60000;
}
function buildPickupDeliveryProblem(brain,loads,base){
 const api=window.MileCountPickupDelivery,date=el('pickupDate')?.value||new Date().toISOString().slice(0,10);
 const zone=el('dispatchTimeZone')?.value||'America/New_York';
 const anchor=mcZonedMinute(date,0,zone,0)*60000;
 const start=mcZonedMinute(date,mcClock(el('dayStartTime')?.value||'06:00')??360,zone,anchor);
 const warnings=[];
 const normalized=loads.map(l=>{
  const windows={};
  if(!l.isSandbox&&!l.isLocalSim)for(const type of ['pickup','drop']){
   if(type==='pickup'&&brain.onboardLoads.some(x=>loadKey(x)===loadKey(l)))continue;
   const raw=type==='pickup'?(l.pickupWindow||l.pickup_time||l.pickupTime):(l.deliveryWindow||l.delivery_time||l.deliveryTime);
   const w=mcWindow(l,type),d=type==='pickup'?(l.pickupDate||l.pickup_date):(l.deliveryDate||l.delivery_date);
   const appointmentZone=type==='pickup'?(l.pickupTimeZone||l.pickupTimezone||l.timeZone):(l.deliveryTimeZone||l.deliveryTimezone||l.timeZone);
   if(raw&&!w)throw Error('Unrecognized broker appointment format at '+(type==='pickup'?l.pickup:l.delivery));
   if(w&&(!d||!appointmentZone))throw Error('Verify the appointment date and timezone for '+(type==='pickup'?'pickup':'delivery')+' at '+(type==='pickup'?l.pickup:l.delivery));
   if(w)windows[type]={start:mcZonedMinute(String(d).slice(0,10),w.start,appointmentZone,anchor),end:mcZonedMinute(String(d).slice(0,10),w.end,appointmentZone,anchor)};
   else if(d){const dt=String(d).slice(0,10);windows[type]={start:mcZonedMinute(dt,0,appointmentZone||zone,anchor),end:mcZonedMinute(dt,1440,appointmentZone||zone,anchor)};if(!appointmentZone)warnings.push('Date-only '+type+' uses your selected dispatch timezone; confirm broker timezone.');}
   else warnings.push('No '+type+' appointment supplied for '+l.pickup+' → '+l.delivery+'.');
  }
  return {...l,windows,services:{pickup:Number(l.pickupServiceMinutes??val('pickupServiceMin',20)),drop:Number(l.deliveryServiceMinutes??val('dropServiceMin',20))}};
 });
 const hosEnabled=el('dispatchHos')?.value==='us-property';
 if(hosEnabled&&(!el('hosCycleRemaining')?.value||Number(el('hosCycleRemaining').value)<=0))throw Error('Enter your remaining weekly-cycle minutes before enabling driving limits.');
 const hos=brain.duty?.hos|| (hosEnabled?{enabled:true,breakAfterMinutes:480,breakMinutes:30,maxDriveMinutes:Math.max(0,660-val('hosDriveUsed',0)),maxDutyMinutes:Math.min(Math.max(0,840-val('hosDutyUsed',0)),val('hosCycleRemaining',0)),sinceBreakMinutes:val('hosSinceBreak',0)}:null);
 return api.problem({truck:{...brain},loads:normalized,baseLoadId:base?loadKey(base):null,
  committedLoadIds:normalized.filter(l=>l.committed||l.bookingStatus==='confirmed'||brain.bookings?.[loadKey(l)]?.status==='CLAIMED'||window.MileCountBooking?.isConfirmed?.(l)).map(loadKey),
  finalDestination:brain.finalDestination,homeDeadlineMinutes:brain.homeDeadline?(Date.parse(brain.homeDeadline)-anchor)/60000:null,startMinutes:start,serviceMinutes:{pickup:val('pickupServiceMin',20),drop:val('dropServiceMin',20)},
  maxDriveMinutes:S.localMoneyMode?600:null,hos,warnings,fuelCostPerMile:Number(fuelFor(1).fuelCost||0)});
}
function commercialLegProfiles(problem,optimized){
 const p=problem.truck.commercialProfile;if(!p)return null;
 let weight=problem.truck.onboardWeight||0;
 return optimized.events.map(event=>{const value={currentGrossWeightLb:Number(p.emptyWeightLb)+weight,hazmat:p.hazmat};weight=event.onboardWeight;return value;});
}
async function verifyDispatchRoute(problem,optimized){
 const api=window.MileCountPickupDelivery;
 let route=await getMileCountRoadRoute([...optimized.routeStops],{legProfiles:commercialLegProfiles(problem,optimized)});
 if(!route?.legs||route.legs.length!==optimized.events.length)throw Error('Road route did not preserve every pickup/delivery event');
 // Replay exact returned legs, including home, before readiness is displayed.
 let prev=0;
 optimized.events.forEach((e,i)=>{const at=problem.locations.indexOf(e.location),leg=route.legs[i];problem.matrix[prev][at]={miles:Number(leg.distance)/1609.344,minutes:Number(leg.duration)/60};prev=at;});
 let check=api.audit(problem,optimized.events);
 if(!check.ok)throw Error(check.issues.join(' • '));
 if(Math.abs(check.result.miles-Number(route.miles))>1)throw Error('Road geometry and event mileage disagree');
 if(Math.abs(check.result.miles-optimized.miles)>Math.max(2,optimized.miles*.02)){
  optimized=await runDispatchSolver(optimized.loads.length?'optimize':'solve',problem);if(!optimized.ok)throw Error(optimized.issues.join(' • '));
  route=await getMileCountRoadRoute([...optimized.routeStops],{legProfiles:commercialLegProfiles(problem,optimized)});
  if(route.legs?.length!==optimized.events.length)throw Error('Reoptimized road route lost an event');
  prev=0;optimized.events.forEach((e,i)=>{const at=problem.locations.indexOf(e.location),leg=route.legs[i];problem.matrix[prev][at]={miles:leg.distance/1609.344,minutes:leg.duration/60};prev=at;});
  check=api.audit(problem,optimized.events);if(!check.ok||Math.abs(check.result.miles-route.miles)>1)throw Error('Final route audit failed');
 }
 const alternatives=api.alternatives(problem);
 if(alternatives.some(x=>x.miles<check.result.miles*.8))throw Error('A legal alternate is dramatically shorter. Rebuild the route before continuing.');
 const result={...optimized,...check.result,audit:check};
 route={...route,miles:result.miles,hours:result.drive/60,driveTime:Math.floor(result.drive/60)+' hr '+Math.round(result.drive%60)+' min',stops:[...result.routeStops],events:[...result.events]};
 return {result,route};
}
function invalidateStackProjection(message='Selection changed — rebuild the route.'){
 mcTripBuildSeq++;dispatchGeneration++;if(physicalBrain?.get().projection)physicalBrain.clearProjection();S.stackPlan=null;S.finalRouteEvents=[];S.finalRouteStops=[];S.roundTripMiles=0;S.totalPay=0;S.addedPay=0;window.MileCountFinalRouteEstimate=null;
 ['roadMiles','driveTime','tripPay','tripAdded'].forEach(id=>{if(el(id))el(id).textContent='Rebuild route';});
 if(typeof clearMileCountMap==='function')clearMileCountMap();
 el('doneStack')?.classList.add('hidden');
 if(el('stackPlanResult'))el('stackPlanResult').innerHTML='<p class="stackWarn">'+escHtml(message)+'</p>';
 if(el('tripStops'))el('tripStops').innerHTML='';
}

let mcTripBuildSeq=0,mcActiveStackBuildId=0;
async function smartAutoStack(){
 const previousPlan=S.stackPlan;
 const buildId=++mcTripBuildSeq;
 mcActiveStackBuildId=buildId;
 const base=S.basePlanLoad||null;
 // Freeze the exact selected load objects for this build. Background provider
 // refreshes may update the board, but they cannot mutate an in-progress trip.
 const selectedKeys=new Set([...selectedStackKeys,...(S.planCommitments||[]).map(loadKey)]);
 const selectionPool=[...(Array.isArray(S.allUnifiedLoads)?S.allUnifiedLoads:[]),...(S.candidateLoads||[]),...(S.planCommitments||[])];
 let chosen=selectionPool.filter(x=>selectedKeys.has(loadKey(x))).filter((x,i,a)=>a.findIndex(y=>loadKey(y)===loadKey(x))===i).filter(x=>!base||loadKey(x)!==loadKey(base));
 if(chosen.length+(base?1:0)>currentPlan().maxStack){alert(currentPlan().name+' stack limit reached. Remove a load or upgrade.');return;}
 if(!base&&chosen.length<1&&!(physicalBrain?.get().onboardLoads.length)&&!physicalBrain?.get().homeLocation){alert("Select at least 1 load for Smart AutoStack.");return}
 if(!previousPlan?.valid){S.stackPlan=null;S.finalRouteEvents=[];S.finalRouteStops=[];if(typeof clearMileCountMap==="function")clearMileCountMap();}
 setBusy(true,"One moment — optimizing every pickup and drop…");
 setButtonBusy("smartAutoStack",true,"BUILDING TRIP…","SMART AUTOSTACK");
 try{
   const missing=[...selectedKeys].filter(k=>!selectionPool.some(l=>loadKey(l)===k));if(missing.length)throw Error("A selected load is no longer in the provider results. Re-select it or remove it before building.");
   await window.MileCountTruckBrain?.ready;
   const brain=syncTruckBrain("autostack-start"),startLoc=brain.currentLocation;
   const allLoads=window.MileCountPickupDelivery.unique([...(base?[base]:[]),...chosen,...brain.onboardLoads]);
   const dispatchProblem=buildPickupDeliveryProblem(brain,allLoads,base);
   const roadData=await getMileCountRoadMatrix(dispatchProblem.locations);
   if(buildId!==mcTripBuildSeq)return;
   dispatchProblem.matrix=roadData.matrix;
   let optimized=await runDispatchSolver(allLoads.length?'optimize':'solve',dispatchProblem);
   if(!optimized.ok){
    const repair=await runDispatchSolver('recommend',dispatchProblem);if(buildId!==mcTripBuildSeq)return;
    const box=el("stackPlanResult");
    if(box){box.innerHTML='<div class="stackPlanStatus bad">TRIP NEEDS CHANGES</div><p class="stackWarn">'+optimized.issues.map(escHtml).join(' • ')+'</p>';
     if(repair){S.routeRepair=repair;box.insertAdjacentHTML('beforeend','<div class="tripStateNow"><b>RECALCULATED ALTERNATIVE • '+Math.round(repair.plan.miles)+' road miles</b><span>'+escHtml(repair.reason)+'</span></div><button id="acceptRouteRepair" type="button">REMOVE CONFLICTING LOAD + REBUILD</button>');el("acceptRouteRepair")?.addEventListener('click',()=>{repair.removedLoads.forEach(l=>selectedStackKeys.delete(loadKey(l)));updateStackTray();smartAutoStack()});}
     box.scrollIntoView({behavior:'smooth',block:'center'});
    }
    S.stackPlan=null;el("doneStack")?.classList.add("hidden");return;
   }
   const weak=await runDispatchSolver('economicReview',dispatchProblem,optimized);if(buildId!==mcTripBuildSeq)return;
   if(weak){
    const box=el('stackPlanResult');if(box){box.innerHTML='<div class="stackPlanStatus bad">LOW-VALUE LOAD NEEDS REVIEW</div><p class="stackWarn">'+escHtml(weak.reason)+'</p><p>Recalculated alternative: '+Math.round(weak.plan.miles)+' road miles • '+money(weak.plan.afterGas)+' estimated after gas.</p><button id="removeWeakRouteLoad" type="button">REMOVE WEAK LOAD + REBUILD</button>';el('removeWeakRouteLoad')?.addEventListener('click',()=>{selectedStackKeys.delete(loadKey(weak.removed));updateStackTray();smartAutoStack()});box.scrollIntoView({behavior:'smooth',block:'center'});}return;
   }
   const finalized=await verifyDispatchRoute(dispatchProblem,optimized);
   if(buildId!==mcTripBuildSeq)return;
   optimized=finalized.result;
   const route=finalized.route,routeVerified=true,routeStops=[...optimized.routeStops];
   optimized.detourMiles=0;if(brain.guardrails.maxDetour!=null){const baseline=window.MileCountPickupDelivery.solve({...dispatchProblem,loads:dispatchProblem.loads.filter(l=>l.initialOnboard||l.id===dispatchProblem.baseLoadId)});if(!baseline.ok)throw Error('Cannot calculate detour against the base/onboard plan');optimized.detourMiles=Math.max(0,optimized.miles-baseline.miles);}
   let economicReview=null;
   if(window.MileCountDispatchBrain){const review=window.MileCountDispatchBrain.evaluate({...optimized,deadhead:optimized.deadhead,loads:optimized.loads},{mpg:activeVehicle.mpg,fuelPrice:Number(fuelFor(1).fuelCost)*Number(activeVehicle.mpg),guardrails:brain.guardrails});if(!review.ok)throw Error('Carrier profit guardrails: '+review.issues.join(' • '));economicReview=review;}
   const state={location:optimized.events.at(-1)?.location||startLoc,onboard:[],completed:optimized.loads,
    events:optimized.events,miles:optimized.miles,liveRevenue:optimized.livePay,testRevenue:optimized.testPay,
    onboardWeight:optimized.weight,onboardSpace:optimized.space,capacityWeightLimit:brain.payload,capacitySpaceLimit:brain.cargoCapacity,
    peakWeight:Math.max(0,...optimized.events.map(e=>e.onboardWeight)),peakSpace:Math.max(0,...optimized.events.map(e=>e.onboardSpace)),
    feasible:true,issues:[],driveHours:optimized.drive/60};
   const schedule={ok:true,issues:[],driveMinutes:optimized.drive,onDutyMinutes:optimized.duty,
    start:mcTime(dispatchProblem.startMinutes),finish:mcTime(optimized.time),
    timeline:optimized.events.map(e=>({type:e.type,arrival:mcTime(e.arrivalMinutes),location:e.location,window:e.load?.windows?.[e.type]?'Broker window':'No supplied appointment'}))};
   state.schedule=schedule;
   const fuel=fuelFor(state.miles),rpm=optimized.rpm,snapshot=tripSnapshot(state);
   // Planning does not mutate actual Truck Brain location or onboard inventory.
   S.stackPlan={...optimized,problem:dispatchProblem,route,routeStops,miles:optimized.miles,
    livePay:optimized.livePay,testPay:optimized.testPay,fuel,rpm,economics:economicReview?.metrics||null,valid:true,
    events:optimized.events,schedule,snapshot,routeVerified,commercialVerified:route.commercialVerified===true,routingStatus:route.routingStatus||"GENERAL ROAD ESTIMATE ONLY",driveHours:optimized.drive/60,durationHours:optimized.drive/60};
   if(physicalBrain&&brain.actualLocationVerified&&!optimized.loads.some(l=>l.isSandbox||l.isLocalSim||['TEST','SIM'].includes(l.mode)))physicalBrain.publish(S.stackPlan,brain.version);
   S.planCommitments=brain.committedLoads;S.finalRouteEvents=[];S.finalRouteStops=[];document.dispatchEvent(new Event("milecount:plan-changed"));
   el("doneStack")?.classList.remove("hidden");

   if(el("stackPlanResult"))el("stackPlanResult").innerHTML=
    '<div class="stackPlanStatus '+(state.feasible?"good":"bad")+'">'+(state.feasible?escHtml(route.routingStatus||'GENERAL ROAD ESTIMATE — COMMERCIAL ROUTE UNAVAILABLE')+' • REVIEW SUPPLIED CONSTRAINTS':"TRIP NEEDS CHANGES")+'</div>'+
    '<div class="stackPlanMetrics"><div><small>FINAL LOCATION</small><b>'+escHtml(snapshot.location||"—")+'</b></div><div><small>LIVE PAY</small><b>'+money(state.liveRevenue)+'</b></div><div><small>TEST PAY</small><b>'+money(state.testRevenue)+'</b></div><div><small>ROAD MILES</small><b>'+Math.round(state.miles).toLocaleString()+' mi</b></div><div><small>ALL-MILE RPM</small><b>'+(rpm?"$"+rpm.toFixed(2):"—")+'</b></div><div><small>EST. FUEL</small><b>'+money(fuel.fuelCost||0)+'</b></div></div>'+
    (state.schedule?'<div class="tripStateNow"><b>DRIVER DAY • '+(state.schedule.ok?'SUPPLIED WINDOWS FEASIBLE':'INFEASIBLE')+'</b><span>'+state.schedule.start+' → '+state.schedule.finish+' • '+(state.schedule.driveMinutes/60).toFixed(1)+' driving hr • '+(state.schedule.onDutyMinutes/60).toFixed(1)+' on-duty hr</span></div>':'')+
    '<div class="tripStateNow"><b>'+escHtml(optimized.method)+' • '+(optimized.optimal?'globally optimal for supplied matrix':'bounded search')+'</b><span>'+[...dispatchProblem.warnings,...(!dispatchProblem.hos?.enabled?['Driver-hours eligibility not verified; configure limits before dispatch.']:[])].map(escHtml).join(' • ')+'</span></div>'+
    '<div class="tripStateNow"><b>OPTIMIZED STOP ORDER</b><span>Multiple pickups can happen before drops. MileCount will not intentionally return to a market it already left when a legal on-route pickup was available.</span></div>'+
    '<div class="stackRoute">'+state.events.map((e,i)=>'<div><b>STOP '+(i+1)+' • '+(e.type==="pickup"?"PICKUP":e.type==="home"?"HOME":"DROP")+' • '+escHtml(e.location||"Location")+'</b><span>'+escHtml(e.load?.pickup||"")+' → '+escHtml(e.load?.delivery||"")+' • '+Math.round(e.onboardWeight).toLocaleString()+' lb onboard • '+e.onboardSpace.toFixed(1)+' ft used</span></div>').join("")+'</div>'+
    (state.issues.length?'<p class="stackWarn">'+state.issues.map(escHtml).join(" • ")+'</p>':'')+
    (state.testRevenue?'<p class="stackWarn">Sandbox/test revenue is excluded from LIVE PAY.</p>':'');
   if(el("stackPlanResult")){
     if(!state.feasible){
       el("stackPlanResult").insertAdjacentHTML("beforeend",'<button id="autoCorrectDay" type="button" style="margin-top:12px">✨ AUTO-CORRECT MY DAY</button>');
       el("autoCorrectDay")?.addEventListener("click",async()=>{
         const b=el("autoCorrectDay");if(b){b.disabled=true;b.textContent="REBUILDING DAY…"}
         const proposal=await proposeAutoCorrect();
         if(proposal)renderAutoCorrectProposal(proposal);
         else if(b){b.disabled=false;b.textContent="NO FEASIBLE COMBINATION FOUND"}
       });
       const repairOrigin=state.blockedAt||state.events.at(-1)?.location||startLoc;
       const fits=await strongFitAlternatives(allLoads,S.allUnifiedLoads||S.candidateLoads||[],repairOrigin);
       if(fits.length){
         el("stackPlanResult").insertAdjacentHTML("beforeend",'<div class="tripStateNow" style="margin-top:12px"><b>STRONG FIT REPLACEMENTS NEAR '+escHtml(repairOrigin)+'</b><span>Only reachable alternatives within your deadhead limit are shown. RPM includes the deadhead from the truck’s current position.</span></div><div class="strongFitList">'+fits.map((l,i)=>'<button type="button" class="strongFitPick" data-key="'+escHtml(loadKey(l))+'" style="margin-top:7px;text-align:left"><b>STRONG FIT • '+escHtml(l.pickup)+' → '+escHtml(l.delivery)+'</b><span style="display:block">'+money(l.pay)+' • '+Math.round(Number(l.strongFitAllMiles||l.loadedMiles||0))+' all mi • '+Math.round(Number(l.strongFitDeadhead||0))+' mi deadhead • '+(Number(l.strongFitRPM||0)?("$"+Number(l.strongFitRPM).toFixed(2)+"/mi"):"RPM —")+'</span></button>').join("")+'</div>');
         el("stackPlanResult").querySelectorAll(".strongFitPick").forEach(b=>b.addEventListener("click",async()=>{
           const pool=(S.allUnifiedLoads||S.candidateLoads||[]),l=pool.find(x=>loadKey(x)===b.dataset.key);if(!l)return;
           // Strong Fit is a repair action, not "+ add another load".
           // Remove one weak/problem selected load first, then insert the replacement.
           const selected=stackSelectedLoads();
           const weak=[...selected].sort((a,b)=>strongFitScore(a,startLoc)-strongFitScore(b,startLoc))[0];
           if(weak)selectedStackKeys.delete(loadKey(weak));
           selectedStackKeys.add(loadKey(l));updateStackTray();
           b.textContent="REPLACING • RECALCULATING…";b.disabled=true;
           await smartAutoStack();
         }));
       }
     }
     if(state.feasible){
       el("stackPlanResult").insertAdjacentHTML("beforeend",'<button id="finishAutoStack" type="button" style="margin-top:12px">DONE • SHOW ROUTE</button>');
       el("finishAutoStack")?.addEventListener("click",finishAutoStack);
     }else{
       el("stackPlanResult").insertAdjacentHTML("beforeend",'<div class="tripStateNow" style="margin-top:12px"><b>FIX THE DAY TO CONTINUE</b><span>Choose one Strong Fit replacement or remove/reorder a problem load. MileCount will recalculate automatically.</span></div>');
     }
     renderEditableStopOrder();
     el("stackPlanResult").scrollIntoView({behavior:"smooth",block:"center"});
   }
 }catch(e){
   if(buildId!==mcTripBuildSeq)return;
   console.error("Smart AutoStack failed",e);
   const unchanged=previousPlan?.valid&&previousPlan.problem?.truck.version===(physicalBrain?.get().version||0);S.stackPlan=unchanged?previousPlan:null;if(!unchanged)el('doneStack')?.classList.add('hidden');
   const box=el("stackPlanResult");
   if(box){
     box.innerHTML='<div class="stackPlanStatus bad">ROUTE REFRESH NEEDS ATTENTION</div><p class="stackWarn">'+escHtml(e?.message||"A route service failed. Your selected loads are still saved — tap Smart AutoStack again.")+'</p>';
     if(unchanged)box.insertAdjacentHTML('beforeend','<p>Previous audited route retained. Your truck and selected loads have not changed.</p>');box.scrollIntoView({behavior:'smooth',block:'center'});
   }
 }finally{if(mcActiveStackBuildId===buildId){mcActiveStackBuildId=0;setButtonBusy("smartAutoStack",false,"","SMART AUTOSTACK");}setBusy(false)}
}
async function proposeAutoCorrect(){
 if(!requirePlan("autoCorrect"))return null;
 const p=S.stackPlan;if(!p)return;
 const pool=S.allUnifiedLoads||S.candidateLoads||[];
 const current=stackSelectedLoads(),origin=(el("from")?.value||S.origin||"").trim();
 // Start with current loads ranked strongest; progressively trim the weakest
 // until the dispatcher can build a feasible day, then fill open slots with Strong Fits.
 let keep=[...current].sort((a,b)=>strongFitScore(b,origin)-strongFitScore(a,origin));
 const removed=[];
 while(keep.length>0){
   const old=new Set(selectedStackKeys);selectedStackKeys.clear();keep.forEach(l=>selectedStackKeys.add(loadKey(l)));
   // Build silently by using the same optimizer; proposal is captured after each run.
   await smartAutoStack();
   if(S.stackPlan?.valid||S.stackPlan?.feasible){const proposed=[...keep];selectedStackKeys.clear();old.forEach(k=>selectedStackKeys.add(k));S.autoCorrectProposal={loads:proposed,removed:[...removed],plan:S.stackPlan};updateStackTray();return S.autoCorrectProposal}
   const weak=keep.pop();if(weak)removed.push(weak);
   selectedStackKeys.clear();old.forEach(k=>selectedStackKeys.add(k));
 }
 return null;
}
function renderAutoCorrectProposal(proposal){
 const box=el("stackPlanResult");if(!box||!proposal)return;
 const pay=(proposal.loads||[]).reduce((s,l)=>s+Number(l.pay||0),0);
 box.insertAdjacentHTML("beforeend",'<div class="tripStateNow autoCorrectProposal" style="margin-top:12px"><b>MILECOUNT AUTO-CORRECT</b><span>I rebuilt the day to fit the schedule. '+proposal.loads.length+' loads • '+money(pay)+(proposal.removed.length?' • removed '+proposal.removed.length+' conflicting load'+(proposal.removed.length===1?'':'s'):'')+'</span><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px"><button id="acceptAutoCorrect" type="button">ACCEPT ✓</button><button id="rejectAutoCorrect" type="button" style="background:#351818">REJECT ✕</button></div></div>');
 el("acceptAutoCorrect")?.addEventListener("click",async()=>{selectedStackKeys.clear();proposal.loads.forEach(l=>selectedStackKeys.add(loadKey(l)));S.autoCorrectProposal=null;updateStackTray();await smartAutoStack()});
 el("rejectAutoCorrect")?.addEventListener("click",()=>{S.autoCorrectProposal=null;el("stackPlanResult")?.querySelector(".autoCorrectProposal")?.remove()});
}
function routeOrderIsLegal(events){
 const p=S.stackPlan;
 if(p?.problem){const check=window.MileCountPickupDelivery.audit(p.problem,events);return {ok:check.ok,event:events.find(e=>e.type==='drop'),issues:check.issues};}
 return {ok:false,issues:['Build an audited trip before editing its order']};
}
function renderEditableStopOrder(){
 const p=S.stackPlan,box=el("stackPlanResult");
 if(!p||!box||!Array.isArray(p.events))return;
 box.insertAdjacentHTML("beforeend",
  '<div class="tripStateNow" style="margin-top:12px"><b>CHANGE ROUTE ORDER</b><span>Press and hold ☰, then drag a stop where you want it. ↑ ↓ buttons are also available.</span></div>'+
  '<div id="routeOrderEditor"></div>'+
  '<button id="applyRouteOrder" type="button" style="background:#15271f;border:1px solid #2b4438;margin-top:10px">APPLY MY ROUTE ORDER</button>'+
  '<div id="routeOrderMessage" class="details"></div>');
 renderRouteOrderRows();
 el("applyRouteOrder")?.addEventListener("click",applyManualRouteOrder);
}
function renderRouteOrderRows(){
 const p=S.stackPlan,wrap=el("routeOrderEditor");if(!p||!wrap)return;
 wrap.innerHTML=p.events.map((e,i)=>
  '<div class="routeOrderRow" data-i="'+i+'" draggable="true" style="display:grid;grid-template-columns:44px 1fr auto;gap:8px;align-items:center;padding:11px 0;border-bottom:1px solid #1d392d;touch-action:pan-y">'+
   '<button type="button" class="routeDrag" aria-label="Drag stop '+(i+1)+'" style="width:44px;padding:10px;cursor:grab;background:#15271f">☰</button>'+
   '<span><b>STOP '+(i+1)+' • '+(e.type==="pickup"?"📦 PICKUP":e.type==="home"?"🏠 HOME":"🏁 DROP")+' • '+escHtml(e.location||"Stop")+'</b><small style="display:block;opacity:.7">'+escHtml(e.load?.pickup||"")+' → '+escHtml(e.load?.delivery||"")+'</small></span>'+
   '<span style="display:flex;gap:4px"><button type="button" class="routeMoveUp" data-i="'+i+'" '+(i===0?"disabled":"")+' style="width:42px;padding:9px">↑</button><button type="button" class="routeMoveDown" data-i="'+i+'" '+(i===p.events.length-1?"disabled":"")+' style="width:42px;padding:9px">↓</button>'+(e.type!=="home"?'<button type="button" class="routeDeleteLoad" data-i="'+i+'" aria-label="Remove this load" style="width:42px;padding:9px;background:#351818">✕</button>':'')+'</span>'+
  '</div>').join("");
 wrap.querySelectorAll(".routeMoveUp").forEach(b=>b.addEventListener("click",()=>moveRouteStop(Number(b.dataset.i),-1)));
 wrap.querySelectorAll(".routeMoveDown").forEach(b=>b.addEventListener("click",()=>moveRouteStop(Number(b.dataset.i),1)));
 wrap.querySelectorAll(".routeDeleteLoad").forEach(b=>b.addEventListener("click",()=>deleteRouteLoad(Number(b.dataset.i))));
 let dragIndex=null;
 wrap.querySelectorAll(".routeOrderRow").forEach(row=>{
  row.addEventListener("dragstart",e=>{dragIndex=Number(row.dataset.i);row.style.opacity=".45";if(e.dataTransfer)e.dataTransfer.effectAllowed="move"});
  row.addEventListener("dragend",()=>{row.style.opacity="";dragIndex=null});
  row.addEventListener("dragover",e=>e.preventDefault());
  row.addEventListener("drop",e=>{e.preventDefault();const to=Number(row.dataset.i);if(dragIndex!=null)moveRouteStopTo(dragIndex,to)});
 });
 // iPhone/Safari: pointer drag from the handle, without disabling normal scrolling elsewhere.
 wrap.querySelectorAll(".routeDrag").forEach(handle=>{
  let from=null,active=false;
  handle.addEventListener("pointerdown",e=>{from=Number(handle.closest(".routeOrderRow").dataset.i);active=true;handle.setPointerCapture?.(e.pointerId)});
  handle.addEventListener("pointermove",e=>{
   if(!active)return;
   const hit=document.elementFromPoint(e.clientX,e.clientY)?.closest?.(".routeOrderRow");
   if(hit){const to=Number(hit.dataset.i);if(Number.isFinite(to)&&to!==from){if(moveRouteStopTo(from,to)){from=to}}}
  });
  const stop=()=>{active=false;from=null};
  handle.addEventListener("pointerup",stop);handle.addEventListener("pointercancel",stop);
 });
}
function deleteRouteLoad(i){
 const p=S.stackPlan,m=el("routeOrderMessage");if(!p?.events?.[i])return;
 const event=p.events[i],id=tripLoadId(event.load||{});
 if(!id||event.type==="home")return;
 if(truckBrain().onboardLoads.some(l=>loadKey(l)===id)){if(m)m.textContent='This load is onboard. Record its delivery before removing it from the truck plan.';return;}
 const removed=event.load;
 (p.loads||[]).forEach(l=>{if(tripLoadId(l)!==id)selectedStackKeys.add(tripLoadId(l));});
 // Removing either pickup or drop removes the entire load so the route remains legal.
 p.events=p.events.filter(e=>e.type==="home"||tripLoadId(e.load||{})!==id);
 p.loads=(p.loads||[]).filter(l=>tripLoadId(l)!==id);
 selectedStackKeys.delete(id);S.planCommitments=(S.planCommitments||[]).filter(l=>tripLoadId(l)!==id);
 if(S.basePlanLoad&&loadKey(S.basePlanLoad)===id)S.basePlanLoad=null;
 const pay=Number(removed?.pay||0);
 if(removed?.isSandbox)p.testPay=Math.max(0,Number(p.testPay||0)-pay);
 else p.livePay=Math.max(0,Number(p.livePay||0)-pay);
 updateStackTray();
 if(m)m.textContent="Removed "+(removed?.pickup||"load")+" → "+(removed?.delivery||"")+" • Recalculating route…";
 renderRouteOrderRows();
 // A deleted load invalidates every derived route/map snapshot immediately.
 S.finalRouteEvents=[];S.finalRouteStops=[];S.roundTripMiles=0;
 p.valid=false;S.totalPay=0;S.addedPay=0;window.MileCountFinalRouteEstimate=null;if(typeof clearMileCountMap==="function")clearMileCountMap();
 ['roadMiles','driveTime','tripPay','tripAdded'].forEach(id=>{if(el(id))el(id).textContent='Recalculating…';});
 mcTripBuildSeq++;
 setTimeout(()=>smartAutoStack(),0);
}
function moveRouteStop(i,delta){return moveRouteStopTo(i,i+delta)}
function moveRouteStopTo(i,j){
 const p=S.stackPlan;if(!p||j<0||j>=p.events.length||i===j)return false;
 const next=[...p.events],[item]=next.splice(i,1);next.splice(j,0,item);
 const legal=routeOrderIsLegal(next),m=el("routeOrderMessage");
 if(!legal.ok){if(m)m.textContent="Can't put "+(item.location||"that stop")+" there — its delivery must stay after pickup.";return false}
 p.events=next;p.valid=false;p.routeVerified=false;mcTripBuildSeq++;if(typeof clearMileCountMap==="function")clearMileCountMap();if(m)m.textContent="Order changed. Press APPLY MY ROUTE ORDER to recalculate miles.";
 renderRouteOrderRows();return true;
}
async function applyManualRouteOrder(){
 const p=S.stackPlan,m=el("routeOrderMessage");if(!p?.problem)return;
 const generation=++mcTripBuildSeq;setBusy(true,"Auditing your custom route…");
 try{
  const check=window.MileCountPickupDelivery.audit(p.problem,p.events);
  if(!check.ok){p.valid=false;if(m)m.textContent=check.issues.join(' • ');return;}
  const finalized=await verifyDispatchRoute(p.problem,{...p,...check.result});
  if(generation!==mcTripBuildSeq)return;
  let economics=null;if(window.MileCountDispatchBrain){const baseline=window.MileCountPickupDelivery.solve({...p.problem,loads:p.problem.loads.filter(l=>l.initialOnboard||l.id===p.problem.baseLoadId)});if(!baseline.ok)throw Error('Cannot validate route detour');finalized.result.detourMiles=Math.max(0,finalized.result.miles-baseline.miles);const review=window.MileCountDispatchBrain.evaluate(finalized.result,{mpg:activeVehicle.mpg,fuelPrice:Number(fuelFor(1).fuelCost)*activeVehicle.mpg,guardrails:truckBrain().guardrails});if(!review.ok)throw Error(review.issues.join(' • '));economics=review.metrics;}
  S.stackPlan={...p,...finalized.result,economics,route:finalized.route,routingStatus:finalized.route.routingStatus||"GENERAL ROAD ESTIMATE ONLY",commercialVerified:finalized.route.commercialVerified===true,valid:true,routeVerified:true,fuel:fuelFor(finalized.result.miles),durationHours:finalized.result.drive/60};
  if(physicalBrain&&truckBrain().actualLocationVerified&&!S.stackPlan.loads.some(l=>l.isSandbox||l.isLocalSim))physicalBrain.publish(S.stackPlan,truckBrain().version);
  S.finalRouteEvents=[...S.stackPlan.events];S.finalRouteStops=[...S.stackPlan.routeStops];S.roundTripMiles=S.stackPlan.miles;
  const routeBox=el("stackPlanResult")?.querySelector(".stackRoute");if(routeBox)routeBox.innerHTML=S.stackPlan.events.map((e,i)=>'<div><b>STOP '+(i+1)+' • '+e.type.toUpperCase()+' • '+escHtml(e.location)+'</b></div>').join('');
  if(m)m.textContent='Audited custom route • '+Math.round(S.stackPlan.miles)+' road miles';
  await finishAutoStack();
 }catch(e){p.valid=false;if(m)m.textContent=e.message;}finally{setBusy(false);}
}

async function finishMyPicks(){
 if(!stackSelectedLoads().length){alert('Pick at least one load first.');return;}
 await smartAutoStack();if(S.stackPlan?.valid)await finishAutoStack();
}
async function finishAutoStack(){
 const p=S.stackPlan;
 if(p&&p.valid===false){
   const box=el("stackPlanResult");
   if(box){box.insertAdjacentHTML("afterbegin",'<div class="stackPlanStatus bad">NOT READY YET • Choose a Strong Fit replacement or remove a problem load.</div>');box.scrollIntoView({behavior:"smooth",block:"center"})}
   return;
 }
 if(!p||!Array.isArray(p.routeStops)||p.routeStops.length<2){
   alert("Build the Smart AutoStack first.");
   return;
 }
 if(p.problem){
  const actual=syncTruckBrain('final-audit'),built=p.problem.truck;
  if(['version','currentLocation','payload','cargoCapacity','reservedWeight','reservedSpace','finalDestination'].some(k=>actual[k]!==built[k])){p.valid=false;alert('Truck location, capacity or final destination changed. Rebuild Smart AutoStack.');return;}
 }
 const loads=Array.isArray(p.loads)?p.loads:[];
 const first=loads[0]||S.basePlanLoad||{};
 const last=loads[loads.length-1]||S.basePlanLoad||{};
 S.origin=p.routeStops[0]||first.pickup||S.origin;
 const freightEnd=p.freightEnd||[...p.events].reverse().find(e=>e.type==='drop')?.location||S.destination;
 S.destination=freightEnd;
 if(p.finalDestination){S.home=p.finalDestination;S.homeChosen=true;}
 S.primaryPay=Number(S.basePlanLoad?.pay||0);
 S.addedPay=Number(p.livePay||0)+Number(p.testPay||0)-S.primaryPay;
 S.totalPay=Number(p.livePay||0)+Number(p.testPay||0);
 S.roundTripMiles=Number(p.miles||0);
 S.selectedStop=S.destination;
 if(el("tripPay"))el("tripPay").textContent=money(S.totalPay);
 if(el("tripAdded"))el("tripAdded").textContent="+"+money(S.addedPay).replace("-$","-$");
 if(el("roadMiles"))el("roadMiles").textContent=Math.round(Number(p.miles||0)).toLocaleString()+" mi";
 if(el("routeSource"))el("routeSource").textContent=p.routingStatus||"GENERAL ROAD ESTIMATE ONLY";
 const events=Array.isArray(p.events)?p.events:[];
 S.finalRouteEvents=events.map(e=>({...e}));

 const mapStops=[];
 const mapStart=(S.origin||first.pickup||"").trim();if(isRoutableLocation(mapStart))mapStops.push(mapStart);
 S.finalRouteEvents.forEach(e=>{if(isRoutableLocation(e.location))mapStops.push(e.location)});

 S.finalRouteStops=[...mapStops];syncTruckBrain("trip-finalized");
 p.routeStops=[...mapStops];
 // The audited immutable projection is also the map/list/economics source.
 if(p.problem){const check=window.MileCountPickupDelivery.audit(p.problem,p.events);if(!check.ok){p.valid=false;alert(check.issues.join(' • '));return;}}
 // Fuel is frozen with the audited projection; a refresh builds a new plan.
 S.origin=S.finalRouteStops[0]||S.origin;
 S.destination=S.finalRouteStops.at(-1)||freightEnd;
 if(el("tripHomeStart"))el("tripHomeStart").textContent=S.origin||"—";
 if(el("tripFinalDestination"))el("tripFinalDestination").textContent=S.destination||"—";
 if(el("roadMiles"))el("roadMiles").textContent=Math.round(Number(p.miles||0)).toLocaleString()+" mi";
 const finalHours=Number(p.durationHours||0)||(Number(p.miles||0)>0?Number(p.miles)/50:0);
 window.MileCountFinalRouteEstimate={miles:Number(p.miles||0),hours:finalHours};
 if(el("driveTime"))el("driveTime").textContent=finalHours?(Math.floor(finalHours)+" hr "+Math.round((finalHours%1)*60)+" min"):"—";
 if(el("routeSource")&&!p.routeVerified)el("routeSource").textContent="Estimated trip route • road verification pending";
 selectedStackKeys.clear();updateStackTray();
 if(window.MileCountDispatchPlanner)refreshDispatchRecommendations('dispatch').catch(e=>renderNextMove({message:e.message,choices:[]}));
 renderFinalTripStops();
 if(typeof renderBookingChecklist==='function')renderBookingChecklist();
 if(el('tripDetailPay'))el('tripDetailPay').textContent=money(S.totalPay);
 if(el('tripDetailReturn'))el('tripDetailReturn').textContent='Projected • verify booking';
 refreshFinalTripOverview();
 showScreen(3);
 const mapBuildId=mcTripBuildSeq;
 setTimeout(async()=>{
   try{
     if(mapBuildId!==mcTripBuildSeq)return;
     if(typeof initMileCountMap==="function")initMileCountMap();
     if(typeof showMileCountRoute==="function")await showMileCountRoute([...S.finalRouteStops],S.stackPlan?.route);
     else if(typeof updateOutboundMap==="function")await updateOutboundMap();
   }catch(e){console.warn("AutoStack route display",e)}
 },120);
}
function renderFinalTripStops(){
 const box=el("tripStops");if(!box)return;
 let events=Array.isArray(S.finalRouteEvents)?S.finalRouteEvents.map(e=>({...e})):[];
 if(!events.length&&S.stackPlan?.events?.length)events=S.stackPlan.events.map(e=>({type:e.type,location:e.location,load:e.load}));
 if(!events.length){
   events=[
    {type:"start",location:S.origin,label:"START / PRIMARY CARGO"},
    ...(S.selectedStop&&S.selectedStop!==S.destination?[{type:"drop",location:S.selectedStop,label:"MileCount partial delivery"}]:[]),
    {type:"drop",location:S.destination,label:"Original delivery"}
   ];
 }

 const rows=events.map((e,i)=>{
   const type=e.type||"stop";
   const icon=type==="pickup"?"📦":type==="drop"?"🏁":type==="returnPickup"?"💰":type==="returnDrop"?"🏁":type==="home"||type==="homeTarget"?"🏠":"🚚";
   const title=type==="pickup"?"PICKUP":type==="drop"?"DROP":type==="returnPickup"?"RETURN PICKUP":type==="returnDrop"?"RETURN DROP":type==="home"?"HOME":type==="homeTarget"?"HOME TARGET":"START";
   const lane=e.load&&(e.load.pickup||e.load.delivery)?escHtml(e.load?.pickup||"")+" → "+escHtml(e.load?.delivery||""):"";
   const pay=e.load&&Number(e.load.pay)>0?" • "+money(e.load.pay):"";
   const detail=e.label?escHtml(e.label):(title+(lane?" • "+lane:"")+pay);
   return '<div class="stop">'+icon+' <b>STOP '+(i+1)+' • '+title+' • '+escHtml(e.location||"Stop")+'</b><br>'+detail+'</div>';
 }).join("");
 const start=S.stackPlan?.startLocation||S.origin||"Start";
 const end=events[events.length-1]?.location||S.destination||"End";
 box.innerHTML='<details class="simpleDetails" style="margin-top:12px"><summary><span>FULL ROUTE • '+events.length+' STOPS</span><span style="font-size:10px;color:#93a79d;margin-left:auto;margin-right:8px">'+escHtml(start)+' → '+escHtml(end)+'</span></summary><div class="simpleDetailsBody">'+rows+'</div></details>';
}
function escHtml(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}

function isLoadBootRecord(l){return String(l?.provider||"").toLowerCase().includes("loadboot")&&!!l?.providerLoadId}
function unifiedSourceLabel(l){
 if(isLoadBootRecord(l))return "SANDBOX TEST • via LoadBoot";
 if(l?.isLocalSim||String(l?.provider||"").includes("MileCount"))return "SIM • MileCount • NOT BOOKABLE";
 return "LIVE • "+(l.provider||"Provider");
}
function directFreightDetailValue(v,suffix=""){return v!==null&&v!==undefined&&String(v).trim()!==""&&Number(v)!==0?escHtml(String(v))+suffix:"Not provided by provider"}
function openDirectFreightDetails(l){
 if(!l||String(l.provider||"").toLowerCase()!=="direct freight")return;
 if(el("dfDetailLane"))el("dfDetailLane").textContent=(l.pickup||"Pickup")+" → "+(l.delivery||"Delivery");
 const fields=[
  ["RATE / PAY",Number(l.pay||0)>0?money(l.pay):null],["LOADED MILES",Number(l.loadedMiles||0)>0?Math.round(l.loadedMiles)+" mi":null],
  ["WEIGHT",Number(l.weight||0)>0?Number(l.weight).toLocaleString()+" lb":null],["EQUIPMENT",l.equipment],
  ["COMMODITY",l.commodity],["PICKUP DATE",l.pickupDate],["PICKUP WINDOW",l.pickupWindow],
  ["DELIVERY DATE",l.deliveryDate],["DELIVERY WINDOW",l.deliveryWindow],["DIRECT FREIGHT REF",l.providerLoadId||l.bookingReference]
 ];
 if(el("dfDetailBody"))el("dfDetailBody").innerHTML=fields.map(([k,v])=>'<div class="loadMetric"><small>'+k+'</small><b>'+(v?escHtml(String(v)):"Not provided by provider")+'</b></div>').join("");
 if(el("dfDetailNote"))el("dfDetailNote").textContent="MileCount displays only fields returned by the authorized Direct Freight response. Additional broker/company/contact details may require Direct Freight end-user authentication and the appropriate subscription.";
 if(el("dfDetailLink")){el("dfDetailLink").href=l.sourceUrl||"#";el("dfDetailLink").classList.toggle("hidden",!l.sourceUrl)}
 el("dfDetailsModal")?.classList.remove("hidden");
}
function renderUnifiedLoadList(loads){
 updateProviderFilterOptions(loads||[]);
 const profile=updateCostUI();
 if(el("loadCandidates"))el("loadCandidates").innerHTML=loads.length?loads.map((l,i)=>{
   const loaded=Math.max(0,Number(l.loadedMiles||0));
   const dh=Math.max(0,Number(l.deadheadMiles??l.extraMiles??0));
   const all=loaded+dh;
   const rpm=Number(l.rpm||0)||(all>0?Number(l.pay||0)/all:0);
   const verdict=l.isSandbox?"TEST DATA":(rpm>=profile.target?"STRONG":rpm>=profile.breakEven?"WORKS":"PASS");
   return '<button type="button" class="candidateLoad loadResult '+(i===0?"selected":"")+'" data-load-index="'+i+'">'+
    '<div class="loadTop"><div><div class="loadLane">'+escHtml(l.pickup||"Not provided by provider")+' → '+escHtml(l.delivery||"Not provided by provider")+'</div><div class="loadMeta">'+unifiedSourceLabel(l)+' • '+escHtml(l.equipment||"Not provided by provider")+(l.commodity?" • "+escHtml(l.commodity):"")+'</div></div><div class="loadPay">'+money(l.pay)+'</div></div>'+
    '<div class="loadMetrics"><div class="loadMetric"><small>ALL-MILE RPM</small><b>'+(rpm?"$"+rpm.toFixed(2):"—")+'</b></div><div class="loadMetric"><small>DEADHEAD</small><b>'+(S.liveOnlyBrowse&&!l.isSandbox?"—":dh.toFixed(0)+" mi")+'</b></div><div class="loadMetric"><small>WEIGHT</small><b>'+(Number(l.weight||0)>0?Number(l.weight).toLocaleString()+" lb":"Not provided by provider")+'</b></div><div class="loadMetric"><small>SOURCE</small><b>'+(isLoadBootRecord(l)?"via LoadBoot":(l.isLocalSim?"MileCount SIM":(l.provider||"LIVE")))+'</b></div></div>'+
    (isLoadBootRecord(l)?'<div class="loadBootRef"><b>LoadBoot ref: '+escHtml(l.providerLoadId)+'</b> • <a href="'+escHtml(l.sourceUrl)+'" target="_blank" rel="noopener" onclick="event.stopPropagation()">View on LoadBoot</a></div>':(String(l.provider||"").toLowerCase()==="direct freight"?'<div class="loadBootRef"><b>Direct Freight'+(l.providerLoadId?' ref: '+escHtml(l.providerLoadId):'')+'</b>'+(l.sourceUrl?' • <a href="'+escHtml(l.sourceUrl)+'" target="_blank" rel="noopener" onclick="event.stopPropagation()">View on Direct Freight</a>':' • LIVE PROVIDER')+' • <span class="dfDetailsOpen" data-df-index="'+i+'" style="text-decoration:underline;font-weight:900;cursor:pointer">DETAILS</span></div>':''))+
    '<div class="loadFoot"><span class="sourceTag">'+(isLoadBootRecord(l)?"LOADBOOT SANDBOX":(l.isLocalSim?"MILECOUNT SIM":"LIVE • "+(l.provider||"PROVIDER")))+'</span><span class="stackPick" data-stack-index="'+i+'">＋ STACK</span><span class="verdictTag">'+verdict+'</span></div></button>';
 }).join(""):'<div class="details">No freight is currently available from connected sources.</div>';
 document.querySelectorAll(".candidateLoad").forEach(btn=>btn.addEventListener("click",()=>selectCandidate(Number(btn.dataset.loadIndex))));
 document.querySelectorAll(".stackPick").forEach(x=>x.addEventListener("click",e=>{e.stopPropagation();toggleStackLoad(Number(x.dataset.stackIndex))}));
 document.querySelectorAll(".candidateLoad").forEach((b,i)=>{const l=(S.candidateLoads||[])[i];b.classList.toggle("stackChosen",!!l&&selectedStackKeys.has(loadKey(l)))});
 updateStackTray();
}
async function refreshUnifiedFreightBoard(forceSandbox=false){
 const sandbox=await fetchLoadBootSandbox(forceSandbox);
 const live=Array.isArray(S.liveBoardLoads)?S.liveBoardLoads:[];
 const all=enforceWeightCap([...live,...sandbox]);
 S.allUnifiedLoads=all;
 updateProviderFilterOptions(all);
 const filtered=filteredUnifiedLoads(all);
 S.candidateLoads=filtered;
 const profile=updateCostUI();
 if(typeof window.renderMileCountLoadMap==="function")await window.renderMileCountLoadMap(filtered,{breakEven:profile.breakEven,target:profile.target,origin:S.origin,destination:S.destination});
 renderUnifiedLoadList(filtered);
 const showing=el("providerFilterShowing");
 if(showing)showing.textContent="Showing "+filtered.length+" of "+all.length+" freight opportunities";
 const total=el("unifiedFreightCount");
 if(total)total.textContent=all.length.toLocaleString();
 const split=el("unifiedFreightSplit");
 if(split)split.textContent=live.length+" LIVE • "+sandbox.length+" SANDBOX TEST";
}

async function showLoadBootSandbox(){
 const loads=await fetchLoadBootSandbox(true);
 if(!loads.length){alert("LoadBoot sandbox returned no test loads.");return}
 S.liveOnlyBrowse=false;
 S.candidateLoads=loads;
 const profile=updateCostUI();
 if(typeof window.renderMileCountLoadMap==="function")await window.renderMileCountLoadMap(loads,{breakEven:profile.breakEven,target:profile.target,origin:"",destination:""});
 if(el("loadCandidates"))el("loadCandidates").innerHTML=loads.map((l,i)=>{
   const rpm=Number(l.rpm||0);
   return '<button type="button" class="candidateLoad loadResult '+(i===0?"selected":"")+'" data-load-index="'+i+'">'+
    '<div class="loadTop"><div><div class="loadLane">'+escHtml(l.pickup||"Not provided by provider")+' → '+escHtml(l.delivery||"Not provided by provider")+'</div><div class="loadMeta">SANDBOX TEST • '+(l.equipment||"Equipment not specified")+' • '+(l.commodity||"")+'</div></div><div class="loadPay">'+money(l.pay)+'</div></div>'+
    '<div class="loadMetrics"><div class="loadMetric"><small>RPM</small><b>'+(rpm?"$"+rpm.toFixed(2):"—")+'</b></div><div class="loadMetric"><small>MILES</small><b>'+Number(l.loadedMiles||0).toLocaleString()+'</b></div><div class="loadMetric"><small>WEIGHT</small><b>'+Number(l.weight||0).toLocaleString()+' lb</b></div><div class="loadMetric"><small>SOURCE</small><b>via LoadBoot</b></div></div>'+
    '<div class="loadFoot"><span class="sourceTag">LOADBOOT SANDBOX</span><span class="verdictTag">TEST DATA</span></div></button>';
 }).join("");
 document.querySelectorAll(".candidateLoad").forEach(btn=>btn.addEventListener("click",()=>selectCandidate(Number(btn.dataset.loadIndex))));
 document.querySelectorAll(".stackPick").forEach(x=>x.addEventListener("click",e=>{e.stopPropagation();toggleStackLoad(Number(x.dataset.stackIndex))}));
 document.querySelectorAll(".candidateLoad").forEach((b,i)=>{const l=(S.candidateLoads||[])[i];b.classList.toggle("stackChosen",!!l&&selectedStackKeys.has(loadKey(l)))});
 updateStackTray();
 showScreen(2);
}
bind("viewLoadBootSandbox",showLoadBootSandbox);
fetchLoadBootSandbox(false);

window.MileCountBookingBridge={
 getLoad(index){return (S.candidateLoads||[])[Number(index)]||null},
 getLoads(){return Array.isArray(S.candidateLoads)?[...S.candidateLoads]:[]},
 getPlannedLoads(){return stackSelectedLoads()},
 getLoadKey(load){return loadKey(load)},
 async refreshLoad(load){
  if(!load||load.isSandbox||load.isLocalSim)return load||null;
  const provider=String(load.provider||"").toLowerCase();
  if(provider==="direct freight"){
   const refreshed=await fetchDirectFreightLocal(load.pickup||S.origin||el("from")?.value||"");
   return refreshed.find(x=>String(x.providerLoadId||x.bookingReference||"")===String(load.providerLoadId||load.bookingReference||""))||null;
  }
  if(provider==="truktek"){
   const refreshed=await fetchTrukTekLocal(load.pickup||S.origin||el("from")?.value||"");
   return refreshed.find(x=>String(x.providerLoadId||x.bookingReference||"")===String(load.providerLoadId||load.bookingReference||""))||null;
  }
  return load;
 }
};
el("providerFilter")?.addEventListener("change",applyProviderFilter);
window.addEventListener("unhandledrejection",e=>{console.warn("MileCount async error",e.reason);setBoardStatus("warn","A service request failed. MileCount kept the app running — tap Refresh to retry.")});
bind("smartAutoStack",smartAutoStack);
bind("doneStack",finishMyPicks);
bind("clearStack",()=>{selectedStackKeys.clear();S.basePlanLoad=null;S.planCommitments=physicalBrain?.get().onboardLoads||[];physicalBrain?.configure({commitments:S.planCommitments,baseLoadId:null});invalidateStackProjection();S.stackPlan=null;el("doneStack")?.classList.add("hidden");updateStackTray();document.querySelectorAll(".candidateLoad").forEach(b=>b.classList.remove("stackChosen"))});
silentAudit();
setInterval(()=>{
 try{
   if(document.hidden)return;
   silentAudit();
   refreshLiveLoadCount();
   // LoadBoot fetch remains cached for at least 5 minutes; this does not poll it every minute.
   fetchLoadBootSandbox(false).catch(()=>{});
 }catch(e){console.warn("MileCount background audit",e)}
},60000);
document.addEventListener("visibilitychange",()=>{if(!document.hidden){silentAudit();refreshLiveLoadCount()}});
["weight","space"].forEach(id=>el(id)?.addEventListener("input",()=>{captureCapacityInputs();syncCapacityState(S.capacityState.availableWeight,S.capacityState.availableSpace,false);if(S.stackPlan||mcActiveStackBuildId)invalidateStackProjection('Truck capacity changed — rebuild the route.')}));
["from","vehicleType","pickupDate","dayStartTime","dispatchTimeZone","dispatchHos","hosDriveUsed","hosDutyUsed","hosSinceBreak","hosCycleRemaining","pickupServiceMin","dropServiceMin"].forEach(id=>el(id)?.addEventListener("change",()=>{if(S.stackPlan||mcActiveStackBuildId)invalidateStackProjection('Truck or schedule constraints changed — rebuild the route.')}));
captureCapacityInputs();
console.log("MileCount App Engine V2 Ready");
})();
document.getElementById("closeDfDetails")?.addEventListener("click",()=>document.getElementById("dfDetailsModal")?.classList.add("hidden"));
document.getElementById("dfDetailsModal")?.addEventListener("click",e=>{if(e.target===document.getElementById("dfDetailsModal"))document.getElementById("dfDetailsModal").classList.add("hidden")});
