window.mcTripStorageKey="mcOriginalTrips:guest";(async()=>{try{const s=await window.MileCountCloud?.session?.();if(s?.user?.id)window.mcTripStorageKey="mcOriginalTrips:"+s.user.id}catch(e){}})();
/*
MileCount App Engine V2
Stable buttons + simulated AutoStack optimizer + routing + fuel
*/
(function(){
"use strict";
const S={primaryPay:1400,addedPay:0,totalPay:1400,returnPay:0,extraMiles:0,roundTripMiles:0,homeAdded:false,origin:"Atlanta, GA",destination:"Charlotte, NC",home:"Atlanta, GA",selectedStop:"Greenville, SC",liveOnlyBrowse:false,stayHomeAfterSearch:false};
const MILECOUNT_PLANS={
 basic:{name:"Basic",price:19,maxTrucks:1,maxStack:3,dispatcher:false,strongFit:false,autoCorrect:false},
 gold:{name:"Gold Pro",price:39,maxTrucks:1,maxStack:5,dispatcher:true,strongFit:true,autoCorrect:false},
 premium:{name:"Premium Pro",price:69,maxTrucks:1,maxStack:10,dispatcher:true,strongFit:true,autoCorrect:true},
 platinum:{name:"Platinum Pro",price:129,maxTrucks:5,maxStack:Infinity,dispatcher:true,strongFit:true,autoCorrect:true,fleet:true}
};
let mcOwnerAccess=false;
function currentPlanKey(){return mcOwnerAccess?"platinum":String(localStorage.getItem("milecount_plan")||"basic").toLowerCase()}
function currentPlan(){return mcOwnerAccess?{...MILECOUNT_PLANS.platinum,name:"OWNER • FULL ACCESS",maxTrucks:Infinity,maxStack:Infinity}:MILECOUNT_PLANS[currentPlanKey()]||MILECOUNT_PLANS.basic}
async function syncOwnerAccess(){
 try{
   const s=await window.MileCountCloud?.session?.();
   // Owner access is granted from the authenticated account's admin role,
   // never from a client-side email comparison or localStorage flag.
   mcOwnerAccess=!!(s?.user&&await window.MileCountCloud?.isAdmin?.());
   document.documentElement.dataset.ownerAccess=mcOwnerAccess?"true":"false";
 }catch(e){mcOwnerAccess=false}
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
 return Promise.race([p,new Promise(resolve=>setTimeout(()=>resolve(fallback),ms))]);
}
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
 return !(w>MAX_LOAD_WEIGHT_LB);
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
 if(w>MAX_LOAD_WEIGHT_LB)issues.push("weight");
 if(pay<0)issues.push("pay");
 if(e.deadhead<0||e.loaded<0||e.allMiles<0)issues.push("miles");
 if(e.allMiles>0&&Math.abs(e.rpm-(pay/e.allMiles))>.02)issues.push("rpm");
 return {ok:issues.length===0,issues,e};
}
function silentValidateTrip(){
 const st=S.tripState;if(!st)return {ok:true,issues:[]};
 const issues=[],cap=Math.min(MAX_LOAD_WEIGHT_LB,activeVehicle.payload||MAX_LOAD_WEIGHT_LB);
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
 captureCapacityInputs();
 setBoardStatus("working","Checking connected freight…");
 syncOwnerAccess().then(()=>updateStackTray()).catch(()=>{});
applyVehicle(el("vehicleType")?.value||"box26",false);
 const profile=updateCostUI();
 const pay=Math.max(0,val("pay",1400)),space=Math.max(0,val("space",14)),weight=Math.max(0,val("weight",6200));
 S.origin=el("from")?.value||"Atlanta, GA"; S.destination=el("to")?.value||"Charlotte, NC";
 let loads=[];let liveProvider=false; let providerErrors=[];
 let providerResponded=false,providerLiveFound=0,resolvedLane=null;
 try{const r=await withTimeout(fetch("https://lrnyxqtmywkhtrmsjquc.supabase.co/functions/v1/truktek-public-pilot",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({origin:S.origin,destination:S.destination,space_ft:space,weight_lb:weight,max_deadhead:Math.max(0,val("maxDeadhead",100)),min_rpm:Math.max(0,val("minRPM",0)),pickup_date:el("pickupDate")?.value||null,equipment:el("vehicleType")?.value||"box26",search_mode:S.liveOnlyBrowse?"live_board":(window.MileCountActiveMapArea?"map_area":"lane"),map_bounds:window.MileCountActiveMapArea||null,map_center:window.MileCountActiveMapArea?.center||null,map_zoom:window.MileCountActiveMapArea?.zoom||null})}),10000,null);if(!r)throw new Error("TrukTek request timed out");if(r.ok){const j=await r.json();providerResponded=true;providerLiveFound=Number(j.live_found||0);resolvedLane=j.resolved||null;loads=(j.loads||[]).map(x=>({name:x.name+" • TrukTek",pay:x.pay,space:x.space,weight:x.weight,stop:x.delivery||S.destination,fallback:Number(x.deadhead||0),deadhead:Number(x.deadhead||0),loadedMiles:Number(x.loadedMiles||0),origin:x.origin,destination:x.destination,provider:"TrukTek",providerLoadId:x.provider_load_id,bookingReference:x.booking_reference,routeCoordinates:x.routeCoordinates||[],pickup:x.pickup,delivery:x.delivery,broker:x.broker,pickupDate:x.pickupDate,deliveryDate:x.deliveryDate}));loads=enforceWeightCap(loads);if(window.MileCountActiveMapArea&&typeof window.MileCountLoadInArea==="function")loads=loads.filter(l=>window.MileCountLoadInArea(l,window.MileCountActiveMapArea));liveProvider=loads.length>0}}catch(e){providerErrors.push("TrukTek");console.warn("TrukTek live pilot unavailable",e);setBoardStatus("warn","TrukTek is temporarily slow/unavailable. Other connected freight can still display.")}
 // Every lane search aggregates every connected source. LoadBoot is sandbox/test
 // only, so it is clearly labeled and never contributes to live trip revenue.
 if(!S.liveOnlyBrowse){
   try{
     const sb=await fetchLoadBootSandbox(false);
     const requestedDate=el("pickupDate")?.value||"";
     const matching=enforceWeightCap(sb.filter(l=>laneMatches(l,S.origin,S.destination))).map(l=>({...l,dateMatchesSearch:pickupDateMatches(l,requestedDate),demoWorkflow:true}));
     if(matching.length){
       loads=[...loads,...matching];
       providerResponded=true;
     }
   }catch(e){providerErrors.push("LoadBoot Sandbox");console.warn("LoadBoot lane aggregation unavailable",e)}
 }

 if(el("dataModeBadge")){
  el("dataModeBadge").textContent=S.liveOnlyBrowse
    ?(providerResponded?(liveProvider?"LIVE LOAD BOARD":"LIVE • NO MATCHES"):"LIVE API UNAVAILABLE")
    :(providerResponded?(liveProvider?"LIVE • TRUKTEK":"SIMULATION • NO LIVE MATCH"):"LIVE API UNAVAILABLE");
  el("dataModeBadge").style.background=liveProvider?"#dff8e9":"#fff0bf";
}
 if(el("footerMode"))el("footerMode").textContent=S.liveOnlyBrowse
 ?(liveProvider?"LIVE LOAD BOARD • CONNECTED PROVIDERS":"LIVE LOAD BOARD • NO MATCHES")
 :(liveProvider?"LIVE TRUKTEK LOADS • SOURCE ATTRIBUTED":"SIMULATION • NO LIVE MATCH");
 if(el("mapModeLabel"))el("mapModeLabel").textContent=liveProvider?"Live-provider trip preview • green line = MileCount road route":"Route preview • green line = MileCount road route";
 if(!loads.length&&!S.liveOnlyBrowse){
 if(el("dataModeBadge")){el("dataModeBadge").textContent="DEMO FALLBACK • NO CONNECTED LANE MATCH";el("dataModeBadge").style.background="#fff0bf"}
 setBoardStatus("warn","No connected TrukTek or LoadBoot sandbox freight matched this lane/date. Showing demo freight separately.");
 loads=[
  {name:"Greenville Partial A • SIMULATION",pay:475,space:7,weight:2450,stop:"Greenville, SC",fallback:30},
  {name:"Greenville Partial B • SIMULATION",pay:290,space:4,weight:1800,stop:"Greenville, SC",fallback:18},
  {name:"Spartanburg Partial • SIMULATION",pay:360,space:5,weight:2100,stop:"Spartanburg, SC",fallback:24}
 ].filter(l=>l.space<=space&&l.weight<=weight);
 }
 if(providerResponded&&!loads.length&&el("loadCandidates")){
  el("loadCandidates").innerHTML=S.liveOnlyBrowse
   ?'<div class="details" style="padding:14px;border:1px solid #5f4d18;border-radius:12px">LIVE LOAD BOARD SEARCH COMPLETE • No authorized live loads matched the current truck, date, and filter settings. No simulation was substituted.</div>'
   :'<div class="details" style="padding:14px;border:1px solid #5f4d18;border-radius:12px">LIVE SEARCH COMPLETE • '+providerLiveFound+' provider loads found, but none fit the remaining '+space+' ft / '+weight.toLocaleString()+' lb capacity and current filters. No simulation was substituted.</div>';
}

 for(const l of loads){
  if(l.provider){
   const pickup=l.pickup||([l.origin?.city,l.origin?.state].filter(Boolean).join(", "));
   const delivery=l.delivery||([l.destination?.city,l.destination?.state].filter(Boolean).join(", "));
   let dh=null,loaded=Number(l.loadedMiles||0);

   // Provider o2oDist is not assumed to be driver deadhead. Driver deadhead is FROM -> pickup.
   if(S.liveOnlyBrowse){
     dh=0; // nationwide board has no driver-origin economics until a user searches/selects a FROM location
   }else{
     dh=await roadMilesBetween(S.origin,pickup);
     if(!Number.isFinite(dh))dh=Math.max(0,Number(l.deadhead||0));
   }

   if(!(loaded>0)){
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
 }
 const maxDH=Math.max(0,val("maxDeadhead",100)),minRPM=Math.max(0,val("minRPM",0));
 if(!S.liveOnlyBrowse){
   loads=loads.filter(l=>loadEconomics(l).deadhead<=maxDH && loadEconomics(l).rpm>=minRPM);
 }
 loads.sort((a,b)=>qualityScore(b,profile)-qualityScore(a,profile));
 const best=loads[0]||{pay:0,space:0,weight:0,stop:S.destination,extraMiles:0,extraDriveTime:"0 min",fuel:fuelFor(0),afterFuel:0};
 S.primaryPay=pay;S.addedPay=best.pay;S.totalPay=pay+best.pay;S.extraMiles=best.extraMiles;S.selectedStop=best.stop;S.homeAdded=false;

 if(S.liveOnlyBrowse)S.liveBoardLoads=[...loads];
 if(providerErrors.length===0)setBoardStatus("ok",loads.length?("Freight updated • "+loads.length+" provider load"+(loads.length===1?"":"s")+" processed"):"Connected • no matching live freight right now");
 S.candidateLoads=loads;S.selectedCandidate=best;
 if(typeof window.renderMileCountLoadMap==="function")window.renderMileCountLoadMap(loads,{breakEven:profile.breakEven,target:profile.target,origin:S.origin,destination:S.destination});
 if(el("loadCandidates"))el("loadCandidates").innerHTML=loads.length?loads.map((l,i)=>{
 const miles=Math.max(0,Number(l.loadedMiles||l.loaded_miles||0)),dh=Math.max(0,Number(l.deadheadMiles??l.deadhead_miles??l.extraMiles??0));
 const allMiles=miles+dh,rpm=loadEconomics(l).rpm;
 const margin=Number(l.afterFuel||0),verdict=rpm>=profile.target?"STRONG":rpm>=profile.breakEven?"WORKS":"PASS";
 const origin=l.origin?.city?l.origin.city+", "+(l.origin.state||""):S.origin,destination=l.destination?.city?l.destination.city+", "+(l.destination.state||""):l.stop;
 const source=l.provider||((l.name||"").includes("SIMULATION")?"SIMULATION":"MILECOUNT");
 return `<button type="button" class="candidateLoad loadResult ${i===0?"selected":""}" data-load-index="${i}">
 <div class="loadTop"><div><div class="loadLane">${origin} → ${destination}</div><div class="loadMeta">${l.name||"Available load"} • ${activeVehicle.name}</div></div><div class="loadPay">${money(l.pay)}</div></div>
 <div class="loadMetrics"><div class="loadMetric"><small>ALL-MILE RPM</small><b>${rpm?"$"+rpm.toFixed(2):"—"}</b></div><div class="loadMetric"><small>DEADHEAD</small><b>${dh.toFixed(0)} mi</b></div><div class="loadMetric"><small>WEIGHT</small><b>${Number(l.weight||0).toLocaleString()} lb</b></div><div class="loadMetric"><small>EST. AFTER FUEL*</small><b>${money(margin)}</b></div></div>
 <div class="loadFoot"><span class="sourceTag">${source}</span><span class="stackPick" data-stack-index="${i}">＋ STACK</span><span class="verdictTag">${i===0&&verdict!=="PASS"?"BEST FIT • ":""}${verdict}</span></div></button>`}).join(""):'<div class="details">No compatible freight matched these filters. Adjust deadhead/RPM or use simulation mode for the demo.</div>'; document.querySelectorAll(".candidateLoad").forEach(btn=>btn.addEventListener("click",()=>selectCandidate(Number(btn.dataset.loadIndex))));
 document.querySelectorAll(".stackPick").forEach(x=>x.addEventListener("click",e=>{e.stopPropagation();toggleStackLoad(Number(x.dataset.stackIndex))}));
 document.querySelectorAll(".candidateLoad").forEach((b,i)=>{const l=(S.candidateLoads||[])[i];b.classList.toggle("stackChosen",!!l&&selectedStackKeys.has(loadKey(l)))});
 updateStackTray();

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
 const l=S.selectedCandidate;
 if(l?.provider&&Array.isArray(l.routeCoordinates)&&l.routeCoordinates.length>1&&typeof showMileCountProviderRoute==="function")return await showMileCountProviderRoute(l);
 if(typeof showMileCountRoute!=="function")return null;
 if(l?.provider){
  const pickup=l.pickup||S.selectedLoadPickup||S.origin;
  const delivery=l.delivery||S.selectedLoadDelivery||S.destination;
  const stops=[S.origin,pickup,delivery].filter(isRoutableLocation).filter((x,i,a)=>a.indexOf(x)===i);
  if(stops.length<2)return null;
  return await showMileCountRoute(stops);
 }
 const stops=[S.origin];if(S.selectedStop&&S.selectedStop!==S.origin&&S.selectedStop!==S.destination)stops.push(S.selectedStop);if(stops.at(-1)!==S.destination)stops.push(S.destination);return await showMileCountRoute(stops);
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

async function protectReturn(){
 if(el("protect")?.disabled)return;
 // The driver's explicitly selected FINAL DESTINATION is authoritative.
 // Do not overwrite it with the original FROM field or a stale load destination.
 setBusy(true,"One moment — dispatching your way home…");
 setButtonBusy("protect",true,"SEARCHING 0–3 DAYS…","FIND MY WAY HOME");
 const selected=S.selectedCandidate;
 const plannedEvents=Array.isArray(S.stackPlan?.events)?S.stackPlan.events:[];
 const lastFreight=[...plannedEvents].reverse().find(e=>e.type==="drop"&&e.load);
 const delivery=lastFreight?.location||selected?.delivery||S.selectedLoadDelivery||S.destination;
 const chosenEnd=(el("tripHomeChoice")?.value||"").trim();
 const home=(chosenEnd||S.home||el("from")?.value||S.origin||"Atlanta, GA").trim();
 S.home=home;
 if(S.stackPlan)S.stackPlan.endLocation=home;
 if(el("returnLane"))el("returnLane").textContent=delivery+" → "+home;
 if(el("returnSource"))el("returnSource").textContent="SEARCHING";
 if(el("returnStatus"))el("returnStatus").textContent="UP TO 3 DAYS";
 if(el("returnSourceTag"))el("returnSourceTag").textContent="DISPATCH SEARCH";
 if(el("returnPay"))el("returnPay").textContent="Searching…";
 if(el("returnLead"))el("returnLead").textContent="Searching connected freight up to 3 days after delivery for loads that move you toward "+home+".";
 showScreen(4);

 const candidates=[];
 // Search TrukTek from delivery market toward home on today + next 3 days.
 for(let day=0;day<=3;day++){
   if(el("returnStatus"))el("returnStatus").textContent="CHECKING DAY "+(day+1)+" OF 4";
   if(el("returnLead"))el("returnLead").textContent="Searching "+dateISOPlus(day)+" freight from "+delivery+" toward "+home+"…";
   await new Promise(r=>requestAnimationFrame(()=>r()));
   try{
     const r=await withTimeout(fetch("https://lrnyxqtmywkhtrmsjquc.supabase.co/functions/v1/truktek-public-pilot",{
       method:"POST",headers:{"Content-Type":"application/json"},
       body:JSON.stringify({
         origin:delivery,destination:home,
         space_ft:activeVehicle.cargoLength,weight_lb:activeVehicle.payload,
         max_deadhead:250,min_rpm:0,pickup_date:dateISOPlus(day),
         equipment:el("vehicleType")?.value||"box26",search_mode:"lane"
       })
     }),5500,null);
     if(r?.ok){
       const j=await r.json();
       (j.loads||[]).forEach(x=>candidates.push({
         provider:"TrukTek",pay:Number(x.pay||0),pickup:x.pickup,delivery:x.delivery,
         loadedMiles:Number(x.loadedMiles||0),deadheadMiles:Number(x.deadhead||0),
         pickupDate:x.pickupDate||dateISOPlus(day),weight:Number(x.weight||0),
         sourceUrl:x.sourceUrl||null,daysOut:day
       }));
     }
   }catch(e){console.warn("Homebound TrukTek search",e)}
 }

 // Include LoadBoot sandbox opportunities for dispatcher UX, but label test data.
 try{
   const sb=await fetchLoadBootSandbox(false);
   sb.forEach(x=>candidates.push({...x,deadheadMiles:0,daysOut:0}));
 }catch(e){}

 // Rank by direction toward home, then economics. Road distance calls are capped.
 let directHome=null;
 try{directHome=await withTimeout(getMileCountRoadRoute([delivery,home]),4500,null)}catch(e){}
 const directMiles=Number(directHome?.miles||0);

 for(const c of candidates.slice(0,30)){
   let progress=0,detour=Number(c.deadheadMiles||0),homeAfter=0;
   try{
     const a=await withTimeout(getMileCountRoadRoute([delivery,c.pickup||delivery]),2200,null);
     if(a?.miles!=null)detour=Number(a.miles);
     const h=await withTimeout(getMileCountRoadRoute([c.delivery||c.pickup||delivery,home]),2200,null);
     if(h?.miles!=null)homeAfter=Number(h.miles);
     if(directMiles>0)progress=directMiles-homeAfter;
   }catch(e){}
   c.dispatchDeadhead=detour;
   c.homeProgress=progress;
   const loaded=Math.max(1,Number(c.loadedMiles||0));
   c.allMiles=detour+loaded;
   c.dispatchRPM=c.allMiles>0?Number(c.pay||0)/c.allMiles:0;
   c.score=(progress*1.5)+(c.dispatchRPM*100)-(detour*.75)-(Number(c.daysOut||0)*20);
 }

 const weightSafeCandidates=enforceWeightCap(candidates);
 // A homebound load must be reachable from the truck and actually improve the
 // trip toward home. Do not let a Florida pickup win from Charlotte just because
 // the provider returned it for the lane query.
 const seenReturn=new Set();
 const useful=weightSafeCandidates.filter(c=>{
   const key=[laneCity(c.pickup),laneCity(c.delivery),Number(c.pay||0),String(c.pickupDate||"")].join("|");
   if(seenReturn.has(key))return false;seenReturn.add(key);
   const dh=Number(c.dispatchDeadhead||0);
   const progress=Number(c.homeProgress||0);
   const maxReturnDH=Math.min(150,Math.max(50,Number(el("maxDeadhead")?.value||100)));
   if(dh>maxReturnDH)return false;
   if(directMiles>0&&progress<=0)return false;
   return true;
 }).sort((a,b)=>b.score-a.score).slice(0,8);
 S.returnCandidates=useful;
 const bestLive=useful.find(c=>!c.isSandbox);
 const best=bestLive||useful[0];

 if(best){
   S.returnPay=Number(best.pay||0); S.demoReturn=!!best.isSandbox;
   S.returnSelected=best;
   if(el("returnLane"))el("returnLane").textContent=(best.pickup||delivery)+" → "+(best.delivery||home);
   if(el("returnPay"))el("returnPay").textContent=best.isSandbox?("TEST "+money(best.pay)):money(best.pay);
   if(el("returnSource"))el("returnSource").textContent=best.isSandbox?"LoadBoot TEST":"TrukTek";
   if(el("returnStatus"))el("returnStatus").textContent=(best.pickupDate||("+"+best.daysOut+" day"))+(best.isSandbox?" • TEST":" • LIVE");
   if(el("returnMilesPreview"))el("returnMilesPreview").textContent=Math.round(Number(best.allMiles||0)).toLocaleString()+" all mi";
   if(el("previewRoundPay"))el("previewRoundPay").textContent=money(S.totalPay+S.returnPay)+(best.isSandbox?" TEST":"");
   if(el("returnSourceTag"))el("returnSourceTag").textContent=best.isSandbox?"SANDBOX TEST • via LoadBoot":"LIVE • TrukTek";
    if(el("returnLead"))el("returnLead").textContent="Best homebound option: "+(best.pickup||delivery)+" → "+(best.delivery||home)+" • "+money(best.pay)+" • "+(best.dispatchRPM?("$"+best.dispatchRPM.toFixed(2)+"/all-mile"):"RPM pending")+" • "+Math.round(best.dispatchDeadhead||0)+" mi deadhead"+(best.homeProgress>0?" • moves "+Math.round(best.homeProgress)+" mi closer to home":"")+".";
 if(el("homeboundAlternatives")){
   el("homeboundAlternatives").innerHTML=useful.slice(0,5).map((c,i)=>'<div class="homeAlt"><b>'+(i+1)+'. '+(c.pickup||delivery)+' → '+(c.delivery||home)+'</b><span>'+money(c.pay)+' • '+(c.dispatchRPM?("$"+c.dispatchRPM.toFixed(2)+"/mi"):"RPM —")+' • '+Math.round(c.dispatchDeadhead||0)+' mi DH • '+(c.pickupDate||"date n/a")+(c.isSandbox?" • TEST":" • LIVE")+'</span></div>').join("");
 }
   if(el("getHome")){
     el("getHome").disabled=false;
     el("getHome").textContent=best.isSandbox?"ADD TO DEMO TRIP":"ADD BEST HOMEBOUND LOAD";
   }
 }else{
   const simPickup=delivery;
   const simDelivery=home;
   const simMiles=Math.max(1,Number(directMiles||S.homeTargetMiles||250));
   const simPay=Math.max(250,Math.round((simMiles*1.85)/25)*25);
   const sim={pickup:simPickup,delivery:simDelivery,pay:simPay,loadedMiles:simMiles,deadheadMiles:0,provider:"MileCount Simulation",isSandbox:true,isSimulatedHome:true,commodity:"SIMULATED DIRECT HOMEBOUND LOAD"};
   S.returnPay=simPay;S.demoReturn=true;S.returnSelected=sim;S.returnCandidates=[sim];
   if(el("returnLane"))el("returnLane").textContent=simPickup+" → "+simDelivery;
   if(el("returnPay"))el("returnPay").textContent="SIM "+money(simPay);
   if(el("returnSource"))el("returnSource").textContent="MILECOUNT SIM";
   if(el("returnStatus"))el("returnStatus").textContent="NOT BOOKABLE";
   if(el("returnSourceTag"))el("returnSourceTag").textContent="SIMULATED HOMEBOUND";
   if(el("previewRoundPay"))el("previewRoundPay").textContent=money(S.totalPay+simPay)+" SIM";
   if(el("returnMilesPreview"))el("returnMilesPreview").textContent=Math.round(simMiles).toLocaleString()+" mi";
   if(el("returnLead"))el("returnLead").textContent="No connected homebound freight matched. MileCount built a simulated route from "+simPickup+" to "+simDelivery+" for planning only.";
   if(el("homeboundAlternatives"))el("homeboundAlternatives").innerHTML='<div class="homeAlt"><b>SIM • '+escHtml(simPickup)+' → '+escHtml(simDelivery)+'</b><span>'+money(simPay)+' planning estimate • '+Math.round(simMiles)+' mi • NOT BOOKABLE</span></div>';
   if(el("getHome")){el("getHome").disabled=false;el("getHome").textContent="USE SIM ROUTE HOME"}
 }
 setButtonBusy("protect",false,"","FIND MY WAY HOME");
 setBusy(false);
}

async function getHomePaid(){
 if(S.returnSelected?.isSandbox)S.demoReturn=true;
 if(!(S.returnPay>0)){S.homeAdded=false;el("homeResult")?.classList.add("hidden");if(el("getHome")){el("getHome").disabled=true;el("getHome").textContent="NO RETURN LOAD SELECTED"}alert("No return load has been selected. MileCount will not add return revenue until a real or manually entered return load exists.");return}
 // A return load must still fit the Local Day. Never turn "homebound" into an
 // out-of-way second trip (for example Atlanta → Charlotte → Riverdale).
 if(S.localMoneyMode&&S.returnSelected){
   const ev=(S.finalRouteEvents||S.stackPlan?.events||[]);
   const lastFreight=[...ev].reverse().find(e=>e.type==="drop"&&e.load);
   const from=lastFreight?.location||S.destination;
   const rp=S.returnSelected.pickup||from,rd=S.returnSelected.delivery||S.home;
   let candidateRoute=null,directHome=null;
   try{candidateRoute=await withTimeout(getMileCountRoadRoute([from,rp,rd,S.home].filter(isRoutableLocation)),5000,null)}catch(e){}
   try{directHome=await withTimeout(getMileCountRoadRoute([from,S.home].filter(isRoutableLocation)),3500,null)}catch(e){}
   const candidateHours=Number(candidateRoute?.durationHours||candidateRoute?.hours||0);
   const candidateMiles=Number(candidateRoute?.miles||0),directMiles=Number(directHome?.miles||0);
   if((candidateHours&&candidateHours>10)||(directMiles>0&&candidateMiles>directMiles*1.6)){
     S.homeAdded=false;
     alert("That return load takes you too far out of the way or pushes the Local Day past 10 driving hours. Pick a closer homebound load.");
     return;
   }
 }
 S.homeAdded=true;
 if(S.plannerTripId&&!S.demoReturn&&window.MileCountCloud){try{const all=await MileCountCloud.plannerTrips(),t=all.find(x=>x.id===S.plannerTripId);if(t)await MileCountCloud.updatePlannerTrip(t.id,{return_pay:Number(S.returnPay||0),expected_revenue:Number(t.original_pay||0)+Number(t.autostack_pay||0)+Number(S.returnPay||0)})}catch(e){console.warn("Planner return cloud update failed",e)}}
let route=null;
 if(typeof showMileCountRoute==="function"){
   try{
     const baseEvents=(Array.isArray(S.finalRouteEvents)&&S.finalRouteEvents.length?S.finalRouteEvents:(Array.isArray(S.stackPlan?.events)?S.stackPlan.events:[]));
     const lastFreight=[...baseEvents].reverse().find(e=>e.type==="drop"&&e.load);
     const baseDelivery=lastFreight?.location||S.selectedCandidate?.delivery||S.selectedLoadDelivery||S.destination;
     // Strip synthetic/chosen HOME from the base route before inserting a return load.
     const rawBase=(Array.isArray(S.finalRouteStops)&&S.finalRouteStops.length?S.finalRouteStops:(Array.isArray(S.stackPlan?.routeStops)?S.stackPlan.routeStops:[])).filter(isRoutableLocation);
     const homeKey=laneCity(S.home||"");
     const baseStops=rawBase.filter((x,i)=>!(homeKey&&laneCity(x)===homeKey&&i===rawBase.length-1));
     const rp=S.returnSelected?.pickup||baseDelivery;
     const rd=S.returnSelected?.delivery||S.home;
     const stops=[...baseStops];
     [rp,rd,S.home].filter(isRoutableLocation).forEach(x=>{if(stops.at(-1)!==x)stops.push(x)});
     S.finalRouteStops=[...stops];
     route=stops.length>=2?await showMileCountRoute(stops):null;
   }catch(e){console.warn(e)}
 }
 const live=route&&Number.isFinite(route.miles)?route.miles:(typeof getMileCountCurrentRoadMiles==="function"?getMileCountCurrentRoadMiles():null);
 const miles=Number.isFinite(live)&&live>0?live:S.roundTripMiles;S.roundTripMiles=miles;
 const r=typeof calculateMileCountRoundTrip==="function"?calculateMileCountRoundTrip(S.totalPay,S.returnPay,miles,S.origin):null;
 if(r){
  const maintenanceCost=0,insuranceCost=0,paymentCost=0,otherCost=0;
  const totalTripCost=Number(r.fuelCost||0);
  const tripMargin=r.totalRevenue-totalTripCost;
  const breakEvenRPM=r.miles>0?totalTripCost/r.miles:0;
  if(el("allMilesRPM"))el("allMilesRPM").textContent="$"+r.rpm.toFixed(2);
  if(el("tripBreakEvenRPM"))el("tripBreakEvenRPM").textContent="$"+breakEvenRPM.toFixed(2);
  if(el("costFuel"))el("costFuel").textContent="-"+money(r.fuelCost);
  if(el("costMaintenance"))el("costMaintenance").textContent="-"+money(maintenanceCost);
  if(el("costInsurance"))el("costInsurance").textContent="-"+money(insuranceCost);
  if(el("costPayment"))el("costPayment").textContent="-"+money(paymentCost);
  if(el("costOther"))el("costOther").textContent="-"+money(otherCost);
  if(el("operatingCost"))el("operatingCost").textContent="-"+money(totalTripCost);
  if(el("roundPay"))el("roundPay").textContent=money(r.totalRevenue);
  if(el("roundMiles"))el("roundMiles").textContent=Math.round(r.miles).toLocaleString();
  if(el("roundRPM"))el("roundRPM").textContent="$"+r.rpm.toFixed(2);
  if(el("fuelCostDisplay"))el("fuelCostDisplay").textContent=money(r.fuelCost);
  if(el("fuelDetails"))el("fuelDetails").textContent=r.gallons.toFixed(1)+" gallons • $"+r.dieselPrice.toFixed(2)+"/gal • "+r.fuelSource+(r.fuelUpdated?" • "+r.fuelUpdated:"");
  if(el("afterFuel"))el("afterFuel").textContent=money(tripMargin);
 }
 if(el("returnConfirmationBadge"))el("returnConfirmationBadge").textContent=S.demoReturn?"SANDBOX RETURN ADDED • DEMO ONLY":"LIVE RETURN LOAD ADDED";
 el("homeResult")?.classList.remove("hidden");
 if(el("getHome")){el("getHome").textContent=S.demoReturn?"DEMO RETURN ADDED ✓":"HOMEBOUND LOAD ADDED ✓";el("getHome").disabled=true}
 // The return is now part of the trip. Remove stale search CTA and selection tray.
 const protectCard=el("protect")?.closest(".alert");
 if(protectCard)protectCard.classList.add("hidden");
 selectedStackKeys.clear();
 updateStackTray();
 el("doneStack")?.classList.add("hidden");
 // Return confirmation is complete; move straight back to the updated trip.
 setTimeout(()=>viewUpdatedTrip(),250);
}

function refreshFinalTripOverview(){
 const miles=Math.max(0,Number(S.roundTripMiles||0));
 const revenue=Math.max(0,Number(S.totalPay||0)+(S.homeAdded?Number(S.returnPay||0):0));
 const fuel=fuelFor(miles);
 // Trip economics for this owner: only fuel is charged against trip revenue.
 // Insurance, maintenance reserve, truck payment and other overhead stay in the
 // owner's separate personal/business budget and are not trip deductions.
 const maintenance=0,insurance=0,payment=0,other=0;
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
 if(el("tripDetailReturn"))el("tripDetailReturn").textContent=S.homeAdded&&S.returnPay>0?money(S.returnPay):"$0";
 if(el("tripSaveStatus"))el("tripSaveStatus").textContent="";
 renderFinalTripStops();
 await saveCurrentTrip();
 refreshFinalTripOverview();
 showScreen(3);setTimeout(async()=>{try{const stops=(Array.isArray(S.finalRouteStops)?S.finalRouteStops:[]).filter(isRoutableLocation);if(stops.length>1&&typeof showMileCountRoute==="function")await showMileCountRoute(stops);else await updateOutboundMap()}catch(e){console.warn("Final route map",e)}},200);
}
async function saveCurrentTrip(showStatus=false){
 S.home=(S.home||el("from")?.value||S.origin||"").trim();
 if(S.demoTrip||S.demoReturn){if(showStatus&&el("tripSaveStatus"))el("tripSaveStatus").textContent="TEST / SANDBOX trips are not saved as live trip history.";return false}
 try{
  const s=await MileCountCloud.session();if(!s)return false;
  const miles=S.roundTripMiles||0,total=S.totalPay+(S.homeAdded?S.returnPay:0),fuel=fuelFor(miles),p=costProfile();
  const estimatedCost=Number(fuel.fuelCost||0);
  await MileCountCloud.saveTrip({origin:S.origin,destination:S.destination,home_city:S.home,primary_pay:S.primaryPay,added_pay:S.addedPay,return_pay:S.homeAdded?S.returnPay:0,road_miles:miles,fuel_cost:fuel.fuelCost,all_miles_rpm:miles?total/miles:0,break_even_rpm:p.breakEven,estimated_trip_cost:estimatedCost,estimated_margin:total-estimatedCost,status:"saved"});
  if(showStatus&&el("tripSaveStatus"))el("tripSaveStatus").innerHTML='SAVED ✓ <a href="trips.html" style="color:#8adbb5">VIEW MY TRIPS</a>';
  return true;
 }catch(e){console.warn("Trip cloud save failed",e);if(showStatus&&el("tripSaveStatus"))el("tripSaveStatus").textContent=e.message||"Could not save trip.";return false}
}
function startNewTrip(){S.finalRouteEvents=null;S.finalRouteStops=null;S.homeChosen=false;S.localMoneyMode=false;S.home="";S.origin=(el("from")?.value||"").trim();S.basePlanLoad=null;selectedStackKeys.clear();updateStackTray();S.primaryPay=0;S.addedPay=0;S.totalPay=0;S.homeAdded=false;S.returnPay=0;S.extraMiles=0;S.roundTripMiles=0;S.selectedStop="";S.tripMode="idle";S.selectedCandidate=null;S.candidateLoads=[];el("homeResult")?.classList.add("hidden");if(el("getHome")){el("getHome").disabled=false;el("getHome").textContent="PROTECT MY RETURN"}showScreen(1)}
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
   await MileCountCloud.saveVehicle({name:v.name,vehicle_type:data.vehicleType,mpg:v.mpg,cargo_length_ft:v.cargoLength,payload_lb:v.payload,monthly_payment:data.monthlyPayment,monthly_insurance:data.monthlyInsurance,maintenance_cpm:data.maintenanceCPM,monthly_other:data.monthlyOther,expected_monthly_miles:data.monthlyMiles,is_default:true});
   if(el("saveStatus"))el("saveStatus").textContent="Saved to MileCount Cloud ✓";
 }catch(e){if(el("saveStatus"))el("saveStatus").textContent="Local save worked • Cloud: "+e.message}
}
function loadProfile(){
 try{const d=JSON.parse(localStorage.getItem("milecountProfile")||"null");if(!d)return;if(el("vehicleType")&&d.vehicleType)el("vehicleType").value=d.vehicleType;["monthlyPayment","monthlyInsurance","maintenanceCPM","monthlyOther","monthlyMiles"].forEach(id=>{if(el(id)&&d[id]!=null)el(id).value=d[id]});applyVehicle(d.vehicleType||"box26",false);updateCostUI()}catch(e){}
}
function bind(id,fn){const b=el(id);if(b)b.addEventListener("click",fn);else console.warn("Missing button",id)}
if(el("vehicleType"))el("vehicleType").addEventListener("change",function(){applyVehicle(this.value,true);updateCostUI()});
["monthlyPayment","monthlyInsurance","maintenanceCPM","monthlyOther","monthlyMiles"].forEach(id=>{if(el(id))el(id).addEventListener("input",updateCostUI)});
applyVehicle(el("vehicleType")?.value||"box26",false);
updateCostUI();
loadProfile();
bind("analyzeManual",analyzeManualLoad);bind("saveProfile",saveProfile);
async function refreshAccount(){
 try{
  const s=await MileCountCloud.session(),logged=!!s;
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
 const home=(el("tripHomeChoice")?.value||"").trim();
 if(!home){alert("Enter the city and state where you want the trip to end.");return}
 S.home=home;
 if(el("tripFinalDestination"))el("tripFinalDestination").textContent=home;
 setBusy(true,"Recalculating route to your end location…");
 try{
  const p=S.stackPlan;
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
     S.smartDispatchLocationEnabled=true;S.smartDispatchOrigin=lat.toFixed(5)+","+lng.toFixed(5);
     if(status)status.textContent="Truck location approved ✓ Searching freight that makes sense from your current position…";
     const oldFrom=el("from")?.value;
     if(el("from"))el("from").value=S.smartDispatchOrigin;
     await browseLiveLoadBoard(true);
     if(el("from"))el("from").value=oldFrom||"";
     // "Compatible" must include geography. The provider board can return nationwide
     // freight, so calculate actual deadhead from the truck's GPS position and reject
     // anything outside the driver's Smart Dispatch radius.
     const raw=(S.candidateLoads||[]);
     const maxDH=Math.max(25,Number(el("maxDeadhead")?.value||100));
     const ranked=[];
     for(const l of raw.slice(0,30)){
       let dh=null;
       try{dh=await withTimeout(roadMilesBetween(S.smartDispatchOrigin,l.pickup),2200,null)}catch(e){}
       if(!Number.isFinite(dh))continue;
       l.smartDispatchDeadhead=Number(dh);
       l.deadheadMiles=Number(dh);
       if(dh<=maxDH){
         const econ=loadEconomics(l);
         l.smartDispatchScore=(Number(econ.afterFuel||l.pay||0))-(dh*Number(costProfile().breakEven||0));
         ranked.push(l);
       }
     }
     ranked.sort((a,b)=>(b.smartDispatchScore||0)-(a.smartDispatchScore||0));
     const loads=ranked.slice(0,8);
     if(status)status.textContent=loads.length?("SMART DISPATCH ✓ "+loads.length+" loads within "+maxDH+" road miles of your truck. Opening best matches…"):("SMART DISPATCH ✓ No loads within "+maxDH+" road miles of your current location.");
     if(loads.length){
       // Smart Dispatch is an action, not a status-only button: take the driver
       // directly to the compatible freight results after location search finishes.
       S.candidateLoads=loads;
       renderUnifiedLoadList(loads);
       showScreen(2);
       setTimeout(()=>el("loadCandidates")?.scrollIntoView({behavior:"smooth",block:"start"}),120);
     }
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
async function fetchDirectFreightLocal(home){
 try{
  const r=await withTimeout(fetch("https://lrnyxqtmywkhtrmsjquc.supabase.co/functions/v1/directfreight-adapter",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({origin:home,radius:175,max_trip_miles:1000,max_weight:9999,limit:60})}),8000,null);
  if(!r)return[];
  const j=await r.json();
  S.directFreightConfigured=!!j.configured;
  return enforceWeightCap(Array.isArray(j.loads)?j.loads:[]);
 }catch(e){console.warn("Direct Freight adapter",e);return[]}
}
async function fetchTrukTekLocal(home){
 const parts=String(home||"Atlanta, GA").split(","),city=(parts[0]||"Atlanta").trim(),state=(parts[1]||"GA").trim().slice(0,2).toUpperCase();
 try{
  const url="https://www.truktek.com/api/loads?octy="+encodeURIComponent(city)+"&ost="+encodeURIComponent(state)+"&milesSlider=100&gross_rpm=0";
  const r=await withTimeout(fetch(url,{cache:"no-store"}),6500,null);if(!r?.ok)return[];
  const j=await r.json();
  return enforceWeightCap((j.loads||[]).map(x=>({
   name:(x.octy+", "+x.ost)+" → "+(x.dcty+", "+x.dst),
   provider:"TrukTek",providerLoadId:String(x.loadId||""),
   pickup:x.octy+", "+x.ost,delivery:x.dcty+", "+x.dst,pay:Number(x.ratePay||0),
   loadedMiles:Number(x.loadDist||0),deadheadMiles:Number(x.o2oDist||0),
   weight:Number(x.weight||0),space:Number(x.length||0),pickupDate:x.pickupDate||null,
   deliveryDate:x.deliveryDate||null,equipment:x.equip||"Unknown",isSandbox:false,sourceType:"REAL"
  })));
 }catch(e){console.warn("TrukTek local direct search",e);return[]}
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

async function refreshLiveLoadCount(){
 const countEl=el("liveLoadCount"),sourceEl=el("liveLoadCountSource");
 if(countEl)countEl.textContent="Checking…";
 try{
   const r=await fetch("https://lrnyxqtmywkhtrmsjquc.supabase.co/functions/v1/milecount-live-count",{cache:"no-store"});
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
setInterval(refreshLiveLoadCount,60000);

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
async function fetchLoadBootSandbox(force=false){
 const now=Date.now();
 if(!force&&loadBootSandboxLoads.length&&now-loadBootSandboxLastFetch<300000)return loadBootSandboxLoads;
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
   const label=isLoadBootRecord(l)?"LoadBoot Sandbox":(l.isLocalSim?"MileCount SIM":(l.provider||"Other Provider"));
   if(key&&!seen.has(key))seen.set(key,label);
 });
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
 const filtered=filteredUnifiedLoads(all);
 S.candidateLoads=filtered;
 const profile=updateCostUI();
 if(typeof window.renderMileCountLoadMap==="function")await window.renderMileCountLoadMap(filtered,{breakEven:profile.breakEven,target:profile.target,origin:S.origin,destination:S.destination});
 renderUnifiedLoadList(filtered);
 const showing=el("providerFilterShowing");
 if(showing)showing.textContent="Showing "+filtered.length+" of "+all.length+" freight opportunities";
}




function currentCapacity(){
 const maxWeight=Math.min(MAX_LOAD_WEIGHT_LB,Number(activeVehicle.payload||MAX_LOAD_WEIGHT_LB));
 const maxSpace=Number(activeVehicle.cargoLength||26);
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
 if(writeInputs){
   if(el("weight"))el("weight").value=Math.round(S.capacityState.availableWeight);
   if(el("space"))el("space").value=Number(S.capacityState.availableSpace.toFixed(1));
 }
 if(el("capacityEverywhere"))el("capacityEverywhere").textContent=Math.round(S.capacityState.availableWeight).toLocaleString()+" lb • "+S.capacityState.availableSpace.toFixed(1)+" ft available";
 return S.capacityState;
}
function captureCapacityInputs(){
 const maxWeight=Math.min(MAX_LOAD_WEIGHT_LB,Number(activeVehicle.payload||MAX_LOAD_WEIGHT_LB));
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
 return String(l.providerLoadId||l.bookingReference||l.name||"")+"|"+String(l.provider||"");
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
 // Manual choice is valid with one or more selected loads; AutoStack remains optional.
 const done=el("doneStack");if(done)done.classList.toggle("hidden",chosen.length<1);
}
function toggleStackLoad(index){
 const loads=S.candidateLoads||[],l=loads[index];if(!l)return;
 const key=loadKey(l),p=currentPlan();
 // Regression fix: this function receives "index"; the previous entitlement
 // check referenced an undefined variable "i", throwing before STACK could toggle.
 if(!selectedStackKeys.has(key)&&selectedStackKeys.size>=p.maxStack){alert(p.name+" supports up to "+p.maxStack+" AutoStack loads. Upgrade for more.");return}

 if(selectedStackKeys.has(key))selectedStackKeys.delete(key);else selectedStackKeys.add(key);
 document.querySelectorAll(".candidateLoad").forEach((b,i)=>{
   const x=loads[i];b.classList.toggle("stackChosen",!!x&&selectedStackKeys.has(loadKey(x)));
 });
 updateStackTray();
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
function mcLoadDate(load,type){
 const v=type==="pickup"?(load.pickupDate||load.pickup_date):(load.deliveryDate||load.delivery_date||load.pickupDate||load.pickup_date);
 if(!v)return null;const d=new Date(String(v).slice(0,10)+"T00:00:00");return Number.isNaN(d.getTime())?null:d;
}
function mcDayOffset(load,type){
 const trip=el("pickupDate")?.value;if(!trip)return 0;
 const base=new Date(trip+"T00:00:00"),d=mcLoadDate(load,type);if(!d||Number.isNaN(base.getTime()))return 0;
 return Math.round((d-base)/86400000)*1440;
}
function mcTime(m){m=((Math.round(m)%1440)+1440)%1440;const h=Math.floor(m/60),n=m%60;return (h%12||12)+":"+String(n).padStart(2,"0")+" "+(h>=12?"PM":"AM")}
async function buildDispatchTimeline(events,start){
 let now=mcClock(el("dayStartTime")?.value||"06:00")??360,drive=0,onDuty=0,sinceBreak=0,prev=start;const timeline=[],issues=[];
 for(const e of events||[]){if(e.type==="home")continue;const loc=e.location||"";let mi=0;try{mi=await withTimeout(roadMilesBetween(prev,loc),1600,0)||0}catch(_){}
  const dm=Math.max(0,Number(mi)/50*60);
  if(sinceBreak+dm>480){timeline.push({type:"break",arrival:mcTime(now),location:"MANDATORY BREAK",window:"30 min"});now+=30;onDuty+=30;sinceBreak=0}
  now+=dm;drive+=dm;onDuty+=dm;sinceBreak+=dm;
  // SIM freight has generated demonstration windows, not broker appointments.
  // Keep its displayed schedule flexible and never reject a plan on SIM-only times.
  const simFlexible=!!e.load?.isLocalSim;
  const w=simFlexible?null:mcWindow(e.load,e.type),off=simFlexible?0:mcDayOffset(e.load,e.type);
  const ws=w?w.start+off:null,we=w?w.end+off:null;
  if(w&&now<ws){onDuty+=ws-now;now=ws}
  if(w&&now>we)issues.push((e.type==="pickup"?"Pickup":"Delivery")+" missed at "+loc+" • "+mcTime(now)+" > "+mcTime(we));
  const service=Math.max(0,Number(e.type==="pickup"?(el("pickupServiceMin")?.value||20):(el("dropServiceMin")?.value||20)));
  timeline.push({type:e.type,arrival:mcTime(now),location:loc,window:w?.raw||"Flexible",service});now+=service;onDuty+=service;prev=loc;
 }
 return {ok:issues.length===0&&drive<=600,issues,driveMinutes:drive,onDutyMinutes:onDuty,start:mcTime(mcClock(el("dayStartTime")?.value||"06:00")??360),finish:mcTime(now),timeline};
}
function strongFitScore(l,origin){
 const econ=loadEconomics(l),dh=Math.max(0,Number(l.deadheadMiles??l.smartDispatchDeadhead??0)),rpm=Number(econ.rpm||0),pay=Number(l.pay||0);
 const timeBonus=(l.pickupWindow||l.pickup_time||l.pickupTime)?40:0;
 return (rpm*110)+(pay/20)-dh+timeBonus;
}
function strongFitAlternatives(excluded,all,origin){if(!currentPlan().strongFit)return[];
 const used=new Set((excluded||[]).map(loadKey));
 return (all||[]).filter(l=>!used.has(loadKey(l))&&isRoutableLocation(l.pickup)&&isRoutableLocation(l.delivery))
  .sort((a,b)=>strongFitScore(b,origin)-strongFitScore(a,origin)).slice(0,5);
}
async function smartAutoStack(){
 const base=S.basePlanLoad||null;
 let chosen=stackSelectedLoads().filter(x=>!base||loadKey(x)!==loadKey(base));
 if(!base&&chosen.length<2){alert("Select at least 2 loads for Smart AutoStack.");return}
 if(base&&chosen.length<1){alert("Your base trip is saved. Select at least 1 additional load to stack.");return}
 setBusy(true,"One moment — optimizing every pickup and drop…");
 setButtonBusy("smartAutoStack",true,"BUILDING TRIP…","SMART AUTOSTACK");
 try{
   const startLoc=(el("from")?.value||S.origin||base?.pickup||chosen[0]?.pickup||"").trim();
   const state=createTripState(startLoc);
   const allLoads=[];
   if(base)allLoads.push(base);
   chosen.forEach(l=>{if(!allLoads.some(x=>loadKey(x)===loadKey(l)))allLoads.push(l)});
   const unpicked=[...allLoads],onboard=[];
   const routeStops=[startLoc].filter(isRoutableLocation);
   let cursor=startLoc;

   // Smart Stack is a pickup-and-delivery route, NOT a list of isolated lanes.
   // At every stop we choose between every legal pickup and every legal drop.
   // A drop is only eligible after its matching pickup. This allows FL pickup,
   // FL pickup, GA pickup, then northbound drops without returning to Florida.
   const mileCache=new Map();
   async function legMiles(a,b){
     if(!a||!b||laneCity(a)===laneCity(b))return 0;
     const k=laneCity(a)+"->"+laneCity(b);
     if(mileCache.has(k))return mileCache.get(k);
     const m=await withTimeout(roadMilesBetween(a,b),1800,null);
     const n=Number.isFinite(m)?Number(m):999999;
     mileCache.set(k,n);return n;
   }
   function fits(l){
     const maxPayload=Number(state.capacityWeightLimit??currentCapacity().availableWeight);
     const maxSpace=Number(state.capacitySpaceLimit??currentCapacity().availableSpace);
     return state.onboardWeight+Math.max(0,Number(l.weight||0))<=maxPayload &&
            state.onboardSpace+Math.max(0,Number(l.space||0))<=maxSpace;
   }
   async function directionPenalty(from,next,load,type){
     // Penalize moves that point away from the load's useful corridor.
     if(type==="drop")return 0;
     const direct=await legMiles(from,load.delivery||load.stop);
     const via1=await legMiles(from,next),via2=await legMiles(next,load.delivery||load.stop);
     if(direct>=999999||via1>=999999||via2>=999999)return 0;
     return Math.max(0,(via1+via2)-direct);
   }

   let guard=0;
   while((unpicked.length||onboard.length)&&guard++<100){
     const options=[];
     // Every feasible unpicked load is a candidate pickup.
     for(let i=0;i<unpicked.length;i++){
       const l=unpicked[i]; if(!fits(l))continue;
       const loc=l.pickup; if(!isRoutableLocation(loc))continue;
       const miles=await legMiles(cursor,loc);
       const detour=await directionPenalty(cursor,loc,l,"pickup");
       const value=Number(l.pay||0)/Math.max(1,Number(l.loadedMiles||1));
       // Strongly favor nearby/on-corridor pickups; revenue breaks close ties.
       options.push({type:"pickup",l,i,loc,miles,score:miles+(detour*.45)-(value*10)});
     }
     // Every onboard load is now legally eligible to drop.
     for(let i=0;i<onboard.length;i++){
       const l=onboard[i],loc=l.delivery||l.stop;
       if(!isRoutableLocation(loc))continue;
       const miles=await legMiles(cursor,loc);
       options.push({type:"drop",l,i,loc,miles,score:miles});
     }
     if(!options.length){
       state.feasible=false;
       state.issues.push("No legal next stop fits the current truck state.");
       break;
     }

     // Look one stop ahead so we do not greedily leave a pickup market and
     // later backtrack hundreds of miles for freight that was already nearby.
     for(const o of options){
       let lookAhead=0,bestNext=Infinity;
       const futurePickups=unpicked.filter((x,j)=>!(o.type==="pickup"&&j===o.i));
       for(const x of futurePickups){
         if(!isRoutableLocation(x.pickup))continue;
         const m=await legMiles(o.loc,x.pickup);
         if(m<bestNext)bestNext=m;
       }
       if(bestNext<Infinity)lookAhead=bestNext*.18;
       o.score+=lookAhead;
     }
     options.sort((a,b)=>a.score-b.score);
     const next=options[0];
     const travel=await legMiles(cursor,next.loc);
     if(Number.isFinite(travel)&&travel<999999)state.miles+=travel;
     if(routeStops.at(-1)!==next.loc)routeStops.push(next.loc);
     cursor=next.loc;

     if(next.type==="pickup"){
       const l=unpicked.splice(next.i,1)[0];
       applyTripPickup(state,l);
       onboard.push(l);
     }else{
       const l=onboard.splice(next.i,1)[0];
       applyTripDrop(state,l);
     }
   }

   let route=null;
   if(routeStops.length>=2&&typeof getMileCountRoadRoute==="function"){
     try{route=await withTimeout(getMileCountRoadRoute(routeStops),5000,null)}catch(e){console.warn("AutoStack route verification",e)}
   }
   const routeVerified=!!(route&&Number(route.miles)>0);
   if(Number(route?.miles)>0)state.miles=Number(route.miles);
   if(S.localMoneyMode){
     const localHome=(S.home||el("from")?.value||startLoc).trim();
     if(isRoutableLocation(localHome)&&laneCity(cursor)!==laneCity(localHome)){
       const homeLeg=await legMiles(cursor,localHome);
       if(Number.isFinite(homeLeg)&&homeLeg<999999){
         state.miles+=homeLeg;
         if(routeStops.at(-1)!==localHome)routeStops.push(localHome);
         state.location=localHome;
         state.events.push({type:"home",location:localHome,load:{pickup:cursor,delivery:localHome,pay:0},onboardWeight:state.onboardWeight,onboardSpace:state.onboardSpace,ok:true});
       }
     }
   }
   
   // MileCount Local Day product rule: keep the completed route under 10
   // driving hours. This is intentionally stricter than the mileage cap.
   const localDriveHours=Number(route?.durationHours||route?.hours||0);
   const estimatedDriveHours=localDriveHours>0?localDriveHours:(state.miles/43.5);
   state.driveHours=estimatedDriveHours;
   if(S.localMoneyMode&&estimatedDriveHours>10){
     state.feasible=false;
     state.issues.push("LOCAL DAY driving limit exceeded: "+estimatedDriveHours.toFixed(1)+" hr. Maximum is 10 driving hours.");
   }
   const schedule=await buildDispatchTimeline(state.events,startLoc);
   state.schedule=schedule;
   if(!schedule.ok){state.feasible=false;state.issues.push(...schedule.issues);if(schedule.driveMinutes>600)state.issues.push("LOCAL DAY exceeds 10 driving hours")}
   const fuel=fuelFor(state.miles);
   const totalRevenue=state.liveRevenue+state.testRevenue;
   const rpm=state.miles>0?totalRevenue/state.miles:0;
   const snapshot=tripSnapshot(state);
   S.tripState=state;
   S.stackPlan={loads:state.completed,routeStops,miles:state.miles,livePay:state.liveRevenue,testPay:state.testRevenue,fuel,rpm,valid:state.feasible,events:state.events,schedule:state.schedule,snapshot,routeVerified};
   el("doneStack")?.classList.remove("hidden");

   if(el("stackPlanResult"))el("stackPlanResult").innerHTML=
    '<div class="stackPlanStatus '+(state.feasible?"good":"bad")+'">'+(state.feasible?"SMART TRIP READY":"TRIP NEEDS CHANGES")+'</div>'+
    '<div class="stackPlanMetrics"><div><small>FINAL LOCATION</small><b>'+escHtml(snapshot.location||"—")+'</b></div><div><small>LIVE PAY</small><b>'+money(state.liveRevenue)+'</b></div><div><small>TEST PAY</small><b>'+money(state.testRevenue)+'</b></div><div><small>ROAD MILES</small><b>'+Math.round(state.miles).toLocaleString()+' mi</b></div><div><small>ALL-MILE RPM</small><b>'+(rpm?"$"+rpm.toFixed(2):"—")+'</b></div><div><small>EST. FUEL</small><b>'+money(fuel.fuelCost||0)+'</b></div></div>'+
    (state.schedule?'<div class="tripStateNow"><b>DRIVER DAY • '+(state.schedule.ok?'ON TIME ✓':'IMPOSSIBLE ✕')+'</b><span>'+state.schedule.start+' → '+state.schedule.finish+' • '+(state.schedule.driveMinutes/60).toFixed(1)+' driving hr • '+(state.schedule.onDutyMinutes/60).toFixed(1)+' on-duty hr</span></div>':'')+
    '<div class="tripStateNow"><b>OPTIMIZED STOP ORDER</b><span>Multiple pickups can happen before drops. MileCount will not intentionally return to a market it already left when a legal on-route pickup was available.</span></div>'+
    '<div class="stackRoute">'+state.events.map((e,i)=>'<div><b>STOP '+(i+1)+' • '+(e.type==="pickup"?"PICKUP":e.type==="home"?"HOME":"DROP")+' • '+escHtml(e.location||"Location")+'</b><span>'+escHtml(e.load.pickup||"")+' → '+escHtml(e.load.delivery||"")+' • '+Math.round(e.onboardWeight).toLocaleString()+' lb onboard • '+e.onboardSpace.toFixed(1)+' ft used</span></div>').join("")+'</div>'+
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
       const fits=strongFitAlternatives(allLoads,S.allUnifiedLoads||S.candidateLoads||[],startLoc);
       if(fits.length){
         el("stackPlanResult").insertAdjacentHTML("beforeend",'<div class="tripStateNow" style="margin-top:12px"><b>STRONG FIT REPLACEMENTS</b><span>MileCount found nearby alternatives to replace loads that make this day impossible.</span></div><div class="strongFitList">'+fits.map((l,i)=>'<button type="button" class="strongFitPick" data-key="'+escHtml(loadKey(l))+'" style="margin-top:7px;text-align:left"><b>STRONG FIT • '+escHtml(l.pickup)+' → '+escHtml(l.delivery)+'</b><span style="display:block">'+money(l.pay)+' • '+Math.round(Number(l.loadedMiles||0))+' mi • '+(loadEconomics(l).rpm?("$"+loadEconomics(l).rpm.toFixed(2)+"/mi"):"RPM —")+'</span></button>').join("")+'</div>');
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
   console.error("Smart AutoStack failed",e);
   const box=el("stackPlanResult");
   if(box){
     box.innerHTML='<div class="stackPlanStatus bad">AUTOSTACK COULD NOT FINISH</div><p class="stackWarn">'+escHtml(e?.message||"A route service failed. Your selected loads are still saved — tap Smart AutoStack again.")+'</p>';
     box.scrollIntoView({behavior:"smooth",block:"center"});
   }
 }finally{setButtonBusy("smartAutoStack",false,"","SMART AUTOSTACK");setBusy(false)}
}
async function proposeAutoCorrect(){
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
 const picked=new Set();
 for(const e of events){
  if(e.type==="home")continue;
  const id=tripLoadId(e.load||{});
  if(e.type==="drop"&&!picked.has(id))return {ok:false,event:e};
  if(e.type==="pickup")picked.add(id);
 }
 return {ok:true};
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
 const removed=event.load;
 // Removing either pickup or drop removes the entire load so the route remains legal.
 p.events=p.events.filter(e=>e.type==="home"||tripLoadId(e.load||{})!==id);
 p.loads=(p.loads||[]).filter(l=>tripLoadId(l)!==id);
 selectedStackKeys.delete(id);
 const pay=Number(removed?.pay||0);
 if(removed?.isSandbox)p.testPay=Math.max(0,Number(p.testPay||0)-pay);
 else p.livePay=Math.max(0,Number(p.livePay||0)-pay);
 updateStackTray();
 if(m)m.textContent="Removed "+(removed?.pickup||"load")+" → "+(removed?.delivery||"")+" • Press APPLY MY ROUTE ORDER to recalculate.";
 renderRouteOrderRows();
}
function moveRouteStop(i,delta){return moveRouteStopTo(i,i+delta)}
function moveRouteStopTo(i,j){
 const p=S.stackPlan;if(!p||j<0||j>=p.events.length||i===j)return false;
 const next=[...p.events],[item]=next.splice(i,1);next.splice(j,0,item);
 const legal=routeOrderIsLegal(next),m=el("routeOrderMessage");
 if(!legal.ok){if(m)m.textContent="Can't put "+(item.location||"that stop")+" there — its delivery must stay after pickup.";return false}
 p.events=next;if(m)m.textContent="Order changed. Press APPLY MY ROUTE ORDER to recalculate miles.";
 renderRouteOrderRows();return true;
}
async function applyManualRouteOrder(){
 const p=S.stackPlan;if(!p?.events?.length)return;
 const legal=routeOrderIsLegal(p.events),m=el("routeOrderMessage");
 if(!legal.ok){if(m)m.textContent="That order is not possible: "+(legal.event?.location||"a delivery")+" is before its pickup.";return}
 const stops=[S.origin||p.routeStops?.[0]].filter(isRoutableLocation);
 p.events.forEach(e=>{if(isRoutableLocation(e.location)&&stops.at(-1)!==e.location)stops.push(e.location)});
 setBusy(true,"Recalculating your custom route…");
 try{
  let route=null;if(stops.length>1&&typeof getMileCountRoadRoute==="function")route=await withTimeout(getMileCountRoadRoute(stops),5000,null);
  p.routeStops=stops;p.routeVerified=!!(route&&Number(route.miles)>0);if(Number(route?.miles)>0)p.miles=Number(route.miles);
  const manualDriveHours=Number(route?.durationHours||route?.hours||0)||(Number(p.miles||0)/43.5);
  p.driveHours=manualDriveHours;
  if(S.localMoneyMode&&manualDriveHours>10){p.valid=false;if(m)m.textContent="Route is "+manualDriveHours.toFixed(1)+" driving hours — Local Day maximum is 10. Remove an out-of-way load.";return}
  p.valid=true;
  p.fuel=fuelFor(p.miles);const total=Number(p.livePay||0)+Number(p.testPay||0);p.rpm=p.miles?total/p.miles:0;S.roundTripMiles=p.miles;
  if(m)m.textContent="Custom stop order applied ✓ • "+Math.round(p.miles).toLocaleString()+" road miles";
  if(typeof showMileCountRoute==="function")await showMileCountRoute(stops);
  const routeBox=el("stackPlanResult")?.querySelector(".stackRoute");
  if(routeBox)routeBox.innerHTML=p.events.map((e,i)=>'<div><b>STOP '+(i+1)+' • '+(e.type==="pickup"?"PICKUP":"DROP")+' • '+escHtml(e.location||"Location")+'</b><span>'+escHtml(e.load?.pickup||"")+' → '+escHtml(e.load?.delivery||"")+'</span></div>').join("");
 }catch(e){if(m)m.textContent="Order saved, but road-mile verification is temporarily unavailable."}
 finally{setBusy(false)}
}

async function finishMyPicks(){
 const chosen=stackSelectedLoads();
 if(!chosen.length){alert("Pick at least 1 load first.");return}
 const base=S.basePlanLoad||null;
 const ordered=[];
 if(base)ordered.push(base);
 chosen.forEach(l=>{if(!ordered.some(x=>loadKey(x)===loadKey(l)))ordered.push(l)});
 const stops=[];
 const start=(el("from")?.value||S.origin||ordered[0]?.pickup||"").trim();
 if(isRoutableLocation(start))stops.push(start);
 const events=[];
 let livePay=0,testPay=0,miles=0;
 for(const l of ordered){
   if(isRoutableLocation(l.pickup)&&stops.at(-1)!==l.pickup)stops.push(l.pickup);
   events.push({type:"pickup",location:l.pickup,load:l,onboardWeight:Number(l.weight||0),onboardSpace:Number(l.space||0)});
   if(isRoutableLocation(l.delivery)&&stops.at(-1)!==l.delivery)stops.push(l.delivery);
   events.push({type:"drop",location:l.delivery,load:l,onboardWeight:0,onboardSpace:0});
   if(l.isSandbox)testPay+=Number(l.pay||0);else livePay+=Number(l.pay||0);
   miles+=Math.max(0,Number(l.loadedMiles||0))+Math.max(0,Number(l.deadheadMiles||0));
 }
 S.stackPlan={loads:ordered,routeStops:stops,miles,livePay,testPay,fuel:fuelFor(miles),rpm:miles?livePay/miles:0,valid:true,events,snapshot:{},routeVerified:false,manual:true};
 await finishAutoStack();
}
async function finishAutoStack(){
 const p=S.stackPlan;
 if(S.localMoneyMode&&p&&p.valid===false){
   const box=el("stackPlanResult");
   if(box){box.insertAdjacentHTML("afterbegin",'<div class="stackPlanStatus bad">NOT READY YET • Choose a Strong Fit replacement or remove a problem load.</div>');box.scrollIntoView({behavior:"smooth",block:"center"})}
   return;
 }
 if(!p||!Array.isArray(p.routeStops)||p.routeStops.length<2){
   alert("Build the Smart AutoStack first.");
   return;
 }
 const loads=Array.isArray(p.loads)?p.loads:[];
 const first=loads[0]||S.basePlanLoad||{};
 const last=loads[loads.length-1]||S.basePlanLoad||{};
 S.origin=p.routeStops[0]||first.pickup||S.origin;
 const chosenHome=(el("tripHomeChoice")?.value||S.home||"").trim();
 const freightEnd=p.routeStops[p.routeStops.length-1]||last.delivery||last.stop||S.destination;
 S.destination=freightEnd;
 if(S.localMoneyMode&&isRoutableLocation(chosenHome)){
   S.home=chosenHome;S.homeChosen=true;p.endLocation=chosenHome;
   if(p.routeStops.at(-1)!==chosenHome)p.routeStops.push(chosenHome);
 }
 S.primaryPay=Number(S.basePlanLoad?.pay||0);
 S.addedPay=Math.max(0,Number(p.livePay||0)+Number(p.testPay||0)-S.primaryPay);
 S.totalPay=Number(p.livePay||0)+Number(p.testPay||0);
 S.roundTripMiles=Number(p.miles||0);
 S.selectedStop=S.destination;
 if(el("tripPay"))el("tripPay").textContent=money(S.totalPay);
 if(el("tripAdded"))el("tripAdded").textContent="+"+money(S.addedPay).replace("-$","-$");
 if(el("roadMiles"))el("roadMiles").textContent=Math.round(Number(p.miles||0)).toLocaleString()+" mi";
 if(el("routeSource"))el("routeSource").textContent=p.routeVerified?"Smart AutoStack • verified road route":"Smart AutoStack • estimated road route";
 const events=Array.isArray(p.events)?p.events:[];
 S.finalRouteEvents=events.filter(e=>e.type!=="home").map(e=>({type:e.type,location:e.location,load:e.load}));
 if(S.localMoneyMode&&S.home&&S.finalRouteEvents.at(-1)?.location!==S.home)S.finalRouteEvents.push({type:"home",location:S.home,label:"HOME / FINAL DESTINATION ✓"});
 S.finalRouteStops=Array.isArray(p.routeStops)?[...p.routeStops]:[];
 renderFinalTripStops();
 showScreen(3);
 setTimeout(async()=>{
   try{
     if(typeof initMileCountMap==="function")initMileCountMap();
     if(typeof showMileCountRoute==="function")await showMileCountRoute(p.routeStops);
     else if(typeof updateOutboundMap==="function")await updateOutboundMap();
   }catch(e){console.warn("AutoStack route display",e)}
 },250);
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
 if(S.homeChosen&&!S.homeAdded&&S.home){
   events.push({type:"homeTarget",location:S.home,label:"CHOSEN HOME / FINAL DESTINATION • ROUTE HOME PENDING"});
 }
 if(S.homeAdded&&S.returnPay>0){
   const r=S.returnSelected||{};
   const pickup=r.pickup||S.destination;
   const delivery=r.delivery||S.home;
   events.push({type:"returnPickup",location:pickup,load:r,label:"RETURN LOAD PICKUP • +"+money(S.returnPay)});
   events.push({type:"returnDrop",location:delivery,load:r,label:"RETURN LOAD DROP"});
   if(S.home&&delivery!==S.home)events.push({type:"home",location:S.home,label:"HOME / FINAL DESTINATION ✓"});
   else if(S.home&&events.at(-1)?.location!==S.home)events.push({type:"home",location:S.home,label:"HOME / FINAL DESTINATION ✓"});
 }
 const rows=events.map((e,i)=>{
   const type=e.type||"stop";
   const icon=type==="pickup"?"📦":type==="drop"?"🏁":type==="returnPickup"?"💰":type==="returnDrop"?"🏁":type==="home"||type==="homeTarget"?"🏠":"🚚";
   const title=type==="pickup"?"PICKUP":type==="drop"?"DROP":type==="returnPickup"?"RETURN PICKUP":type==="returnDrop"?"RETURN DROP":type==="home"?"HOME":type==="homeTarget"?"HOME TARGET":"START";
   const lane=e.load&&(e.load.pickup||e.load.delivery)?escHtml(e.load.pickup||"")+" → "+escHtml(e.load.delivery||""):"";
   const pay=e.load&&Number(e.load.pay)>0?" • "+money(e.load.pay):"";
   const detail=e.label?escHtml(e.label):(title+(lane?" • "+lane:"")+pay);
   return '<div class="stop">'+icon+' <b>STOP '+(i+1)+' • '+escHtml(e.location||"Stop")+'</b><br>'+detail+'</div>';
 }).join("");
 const start=events[0]?.location||S.origin||"Start";
 const end=events[events.length-1]?.location||S.destination||"End";
 box.innerHTML='<details class="simpleDetails" style="margin-top:12px"><summary><span>FULL ROUTE • '+events.length+' STOPS</span><span style="font-size:10px;color:#93a79d;margin-left:auto;margin-right:8px">'+escHtml(start)+' → '+escHtml(end)+'</span></summary><div class="simpleDetailsBody">'+rows+'</div></details>';
}
function escHtml(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\\\"":"&quot;","'":"&#39;"}[c]))}

function isLoadBootRecord(l){return String(l?.provider||"").toLowerCase().includes("loadboot")&&!!l?.providerLoadId}
function unifiedSourceLabel(l){
 if(isLoadBootRecord(l))return "SANDBOX TEST • via LoadBoot";
 if(l?.isLocalSim||String(l?.provider||"").includes("MileCount"))return "SIM • MileCount • NOT BOOKABLE";
 return "LIVE • "+(l.provider||"Provider");
}
function renderUnifiedLoadList(loads){
 const profile=updateCostUI();
 if(el("loadCandidates"))el("loadCandidates").innerHTML=loads.length?loads.map((l,i)=>{
   const loaded=Math.max(0,Number(l.loadedMiles||0));
   const dh=Math.max(0,Number(l.deadheadMiles??l.extraMiles??0));
   const all=loaded+dh;
   const rpm=Number(l.rpm||0)||(all>0?Number(l.pay||0)/all:0);
   const verdict=l.isSandbox?"TEST DATA":(rpm>=profile.target?"STRONG":rpm>=profile.breakEven?"WORKS":"PASS");
   return '<button type="button" class="candidateLoad loadResult '+(i===0?"selected":"")+'" data-load-index="'+i+'">'+
    '<div class="loadTop"><div><div class="loadLane">'+(l.pickup||"Pickup")+' → '+(l.delivery||"Delivery")+'</div><div class="loadMeta">'+unifiedSourceLabel(l)+' • '+(l.equipment||activeVehicle.name)+(l.commodity?" • "+l.commodity:"")+'</div></div><div class="loadPay">'+money(l.pay)+'</div></div>'+
    '<div class="loadMetrics"><div class="loadMetric"><small>ALL-MILE RPM</small><b>'+(rpm?"$"+rpm.toFixed(2):"—")+'</b></div><div class="loadMetric"><small>DEADHEAD</small><b>'+(S.liveOnlyBrowse&&!l.isSandbox?"—":dh.toFixed(0)+" mi")+'</b></div><div class="loadMetric"><small>WEIGHT</small><b>'+(Number(l.weight||0)>0?Number(l.weight).toLocaleString()+" lb":"UNKNOWN")+'</b></div><div class="loadMetric"><small>SOURCE</small><b>'+(isLoadBootRecord(l)?"via LoadBoot":(l.isLocalSim?"MileCount SIM":(l.provider||"LIVE")))+'</b></div></div>'+
    (isLoadBootRecord(l)?'<div class="loadBootRef"><b>LoadBoot ref: '+escHtml(l.providerLoadId)+'</b> • <a href="'+escHtml(l.sourceUrl)+'" target="_blank" rel="noopener" onclick="event.stopPropagation()">View on LoadBoot</a></div>':'')+
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
    '<div class="loadTop"><div><div class="loadLane">'+(l.pickup||"Pickup")+' → '+(l.delivery||"Delivery")+'</div><div class="loadMeta">SANDBOX TEST • '+(l.equipment||"Equipment not specified")+' • '+(l.commodity||"")+'</div></div><div class="loadPay">'+money(l.pay)+'</div></div>'+
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

el("providerFilter")?.addEventListener("change",applyProviderFilter);
window.addEventListener("unhandledrejection",e=>{console.warn("MileCount async error",e.reason);setBoardStatus("warn","A service request failed. MileCount kept the app running — tap Refresh to retry.")});
bind("smartAutoStack",smartAutoStack);
bind("doneStack",finishMyPicks);
bind("clearStack",()=>{selectedStackKeys.clear();S.stackPlan=null;el("doneStack")?.classList.add("hidden");updateStackTray();document.querySelectorAll(".candidateLoad").forEach(b=>b.classList.remove("stackChosen"))});
silentAudit();
setInterval(()=>{
 try{
   silentAudit();
   refreshLiveLoadCount();
   // LoadBoot fetch remains cached for at least 5 minutes; this does not poll it every minute.
   fetchLoadBootSandbox(false).catch(()=>{});
 }catch(e){console.warn("MileCount background audit",e)}
},60000);
document.addEventListener("visibilitychange",()=>{if(!document.hidden){silentAudit();refreshLiveLoadCount()}});
["weight","space"].forEach(id=>el(id)?.addEventListener("input",()=>{captureCapacityInputs();syncCapacityState(S.capacityState.availableWeight,S.capacityState.availableSpace,false)}));
captureCapacityInputs();
console.log("MileCount App Engine V2 Ready");
})();