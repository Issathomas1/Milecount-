window.mcTripStorageKey="mcOriginalTrips:guest";(async()=>{try{const s=await window.MileCountCloud?.session?.();if(s?.user?.id)window.mcTripStorageKey="mcOriginalTrips:"+s.user.id}catch(e){}})();
/*
MileCount App Engine V2
Stable buttons + simulated AutoStack optimizer + routing + fuel
*/
(function(){
"use strict";
const S={primaryPay:1400,addedPay:0,totalPay:1400,returnPay:0,extraMiles:0,roundTripMiles:0,homeAdded:false,origin:"Atlanta, GA",destination:"Charlotte, NC",home:"Atlanta, GA",selectedStop:"Greenville, SC"};
const el=id=>document.getElementById(id);
const val=(id,f=0)=>{const n=Number(el(id)?.value);return Number.isFinite(n)?n:f};
const money=v=>{const n=Math.round(Number(v)||0);return (n<0?"-$":"$")+Math.abs(n).toLocaleString()};
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

async function findMoney(){
 applyVehicle(el("vehicleType")?.value||"box26",false);
 const profile=updateCostUI();
 const pay=Math.max(0,val("pay",1400)),space=Math.max(0,val("space",14)),weight=Math.max(0,val("weight",6200));
 S.origin=el("from")?.value||"Atlanta, GA"; S.destination=el("to")?.value||"Charlotte, NC";
 let loads=[];let liveProvider=false; let providerErrors=[];
 let providerResponded=false,providerLiveFound=0,resolvedLane=null;
 try{const r=await fetch("https://lrnyxqtmywkhtrmsjquc.supabase.co/functions/v1/truktek-public-pilot",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({origin:S.origin,destination:S.destination,space_ft:space,weight_lb:weight,max_deadhead:Math.max(0,val("maxDeadhead",100)),min_rpm:Math.max(0,val("minRPM",0)),pickup_date:el("pickupDate")?.value||null,equipment:el("vehicleType")?.value||"box26"})});if(r.ok){const j=await r.json();providerResponded=true;providerLiveFound=Number(j.live_found||0);resolvedLane=j.resolved||null;loads=(j.loads||[]).map(x=>({name:x.name+" • TrukTek",pay:x.pay,space:x.space,weight:x.weight,stop:x.delivery||S.destination,fallback:Number(x.deadhead||0),deadhead:Number(x.deadhead||0),loadedMiles:Number(x.loadedMiles||0),origin:x.origin,destination:x.destination,provider:"TrukTek",providerLoadId:x.provider_load_id,bookingReference:x.booking_reference,routeCoordinates:x.routeCoordinates||[],pickup:x.pickup,delivery:x.delivery,broker:x.broker,pickupDate:x.pickupDate,deliveryDate:x.deliveryDate}));liveProvider=loads.length>0}}catch(e){providerErrors.push("TrukTek");console.warn("TrukTek live pilot unavailable",e)}
 if(el("dataModeBadge")){el("dataModeBadge").textContent=providerResponded?(liveProvider?"LIVE • TRUKTEK":"SIMULATION • NO LIVE MATCH"):"LIVE API UNAVAILABLE";el("dataModeBadge").style.background=liveProvider?"#dff8e9":"#fff0bf";}
 if(el("footerMode"))el("footerMode").textContent=liveProvider?"LIVE TRUKTEK LOADS • SOURCE ATTRIBUTED":"SIMULATION • NO LIVE MATCH";
 if(el("mapModeLabel"))el("mapModeLabel").textContent=liveProvider?"Live-provider trip preview • green line = MileCount road route":"Route preview • green line = MileCount road route";
 if(!loads.length)loads=[
  {name:"Greenville Partial A • SIMULATION",pay:475,space:7,weight:2450,stop:"Greenville, SC",fallback:30},
  {name:"Greenville Partial B • SIMULATION",pay:290,space:4,weight:1800,stop:"Greenville, SC",fallback:18},
  {name:"Spartanburg Partial • SIMULATION",pay:360,space:5,weight:2100,stop:"Spartanburg, SC",fallback:24}
 ].filter(l=>l.space<=space&&l.weight<=weight);
 if(providerResponded&&!loads.length&&el("loadCandidates"))el("loadCandidates").innerHTML='<div class="details" style="padding:14px;border:1px solid #5f4d18;border-radius:12px">LIVE SEARCH COMPLETE • '+providerLiveFound+' provider loads found, but none fit the remaining '+space+' ft / '+weight.toLocaleString()+' lb capacity and current filters. No simulation was substituted.</div>';

 for(const l of loads){
  if(l.provider){
   l.extraMiles=Math.max(0,Number(l.deadhead||0));
   l.extraDriveTime=l.extraMiles>0?"Provider deadhead":"0 mi";
   const economicMiles=Math.max(0,Number(l.loadedMiles||0))+l.extraMiles;
   l.fuel=fuelFor(economicMiles);
   l.afterFuel=l.pay-(l.fuel.fuelCost||0);
  }else{
   const d=await routeDetour(l.stop,l.fallback);
   l.extraMiles=Number.isFinite(d.extraMiles)?d.extraMiles:l.fallback;
   l.extraDriveTime=d.extraDriveTime||"Estimated";
   l.fuel=fuelFor(l.extraMiles);
   l.afterFuel=l.pay-(l.fuel.fuelCost||0);
  }
 }
 const maxDH=Math.max(0,val("maxDeadhead",100)),minRPM=Math.max(0,val("minRPM",0));
 loads=loads.filter(l=>Number(l.extraMiles||0)<=maxDH && (Number(l.extraMiles||0)<=0 || Number(l.pay||0)/Number(l.extraMiles||1)>=minRPM));
 loads.sort((a,b)=>b.afterFuel-a.afterFuel);
 const best=loads[0]||{pay:0,space:0,weight:0,stop:S.destination,extraMiles:0,extraDriveTime:"0 min",fuel:fuelFor(0),afterFuel:0};
 if(best.provider){S.primaryPay=0;S.addedPay=best.pay;S.totalPay=best.pay;S.origin=best.pickup||([best.origin?.city,best.origin?.state].filter(Boolean).join(", "));S.destination=best.delivery||([best.destination?.city,best.destination?.state].filter(Boolean).join(", "));S.selectedStop=S.destination;S.tripMode="live";S.returnPay=0;S.homeAdded=false}else{S.primaryPay=pay;S.addedPay=best.pay;S.totalPay=pay+best.pay;S.selectedStop=best.stop;S.tripMode="simulation";S.homeAdded=false}S.extraMiles=best.extraMiles;

 S.candidateLoads=loads;S.selectedCandidate=best;
 if(el("loadCandidates"))el("loadCandidates").innerHTML=loads.length?loads.map((l,i)=>{
 const miles=Math.max(0,Number(l.loadedMiles||l.loaded_miles||0)),dh=Math.max(0,Number(l.deadhead||l.deadhead_miles||l.extraMiles||0));
 const allMiles=miles+dh,rpm=allMiles>0?Number(l.pay||0)/allMiles:(dh>0?Number(l.pay||0)/dh:0);
 const margin=Number(l.afterFuel||0),verdict=rpm>=profile.target?"STRONG":rpm>=profile.breakEven?"WORKS":"PASS";
 const origin=l.origin?.city?l.origin.city+", "+(l.origin.state||""):S.origin,destination=l.destination?.city?l.destination.city+", "+(l.destination.state||""):l.stop;
 const source=l.provider||((l.name||"").includes("SIMULATION")?"SIMULATION":"MILECOUNT");
 return `<button type="button" class="candidateLoad loadResult ${i===0?"selected":""}" data-load-index="${i}">
 <div class="loadTop"><div><div class="loadLane">${origin} → ${destination}</div><div class="loadMeta">${l.name||"Available load"} • ${activeVehicle.name}</div></div><div class="loadPay">${money(l.pay)}</div></div>
 <div class="loadMetrics"><div class="loadMetric"><small>ALL-MILE RPM</small><b>${rpm?"$"+rpm.toFixed(2):"—"}</b></div><div class="loadMetric"><small>DEADHEAD</small><b>${dh.toFixed(0)} mi</b></div><div class="loadMetric"><small>WEIGHT</small><b>${Number(l.weight||0).toLocaleString()} lb</b></div><div class="loadMetric"><small>EST. AFTER FUEL*</small><b>${money(margin)}</b></div></div>
 <div class="loadFoot"><span class="sourceTag">${source}</span><span class="verdictTag">${i===0?"BEST FIT • ":""}${verdict}</span></div></button>`}).join(""):'<div class="details">No compatible freight matched these filters. Adjust deadhead/RPM or use simulation mode for the demo.</div>'; document.querySelectorAll(".candidateLoad").forEach(btn=>btn.addEventListener("click",()=>selectCandidate(Number(btn.dataset.loadIndex))));

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
 const addedMiles=best.provider?(Number(best.loadedMiles||0)+Number(best.deadhead||0)):best.extraMiles;const addedRPM=addedMiles>0?best.pay/addedMiles:0;
 if(el("loadVerdict")){
   el("loadVerdict").textContent=!best.pay?"NO FIT":(addedRPM>=profile.target?"STRONG ✓":addedRPM>=profile.breakEven?"WORKS":"PASS");
   el("loadVerdict").style.color=!best.pay?"#93a79d":(addedRPM>=profile.target?"#31bf72":addedRPM>=profile.breakEven?"#f1c75b":"#ff7777");
 }
 if(el("autoStackReason"))el("autoStackReason").textContent=best.pay?(best.provider?"LIVE "+best.provider+" load • "+Number(best.loadedMiles||0).toFixed(0)+" loaded mi + "+Number(best.deadhead||0).toFixed(0)+" deadhead mi • estimated "+money(best.fuel.fuelCost)+" fuel.":"SIMULATION • Adds "+best.extraMiles.toFixed(1)+" road miles and about "+money(best.fuel.fuelCost)+" in diesel."):"No compatible freight fits the remaining truck capacity.";
 showScreen(2);
}

function selectCandidate(i){
 const l=(S.candidateLoads||[])[i];if(!l)return;S.selectedCandidate=l;S.addedPay=l.pay;S.totalPay=S.primaryPay+l.pay;S.extraMiles=l.extraMiles;S.selectedStop=l.stop;
 if(el("added"))el("added").textContent="+"+money(l.pay);if(el("newTotal"))el("newTotal").textContent=money(S.totalPay);if(el("tripPay"))el("tripPay").textContent=money(S.totalPay);if(el("tripAdded"))el("tripAdded").textContent="+"+money(l.pay);
 if(el("remainingSpace"))el("remainingSpace").textContent=Math.max(0,val("space",0)-l.space)+" ft remaining";if(el("remainingWeight"))el("remainingWeight").textContent=Math.max(0,val("weight",0)-l.weight).toLocaleString()+" lb remaining";
 if(el("detourMiles"))el("detourMiles").textContent=l.extraMiles.toFixed(1)+" mi";if(el("detourTime"))el("detourTime").textContent=l.extraDriveTime;if(el("spaceUsed"))el("spaceUsed").textContent=l.space+" ft";if(el("weightUsed"))el("weightUsed").textContent=l.weight.toLocaleString()+" lb";if(el("extraFuel"))el("extraFuel").textContent=money(l.fuel.fuelCost);if(el("addedAfterFuel"))el("addedAfterFuel").textContent="+"+money(l.afterFuel);
 document.querySelectorAll(".candidateLoad").forEach((b,n)=>b.classList.toggle("selected",n===i));
}
async function updateOutboundMap(){
 const l=S.selectedCandidate;
 if(l?.provider&&Array.isArray(l.routeCoordinates)&&l.routeCoordinates.length>1&&typeof showMileCountProviderRoute==="function")return await showMileCountProviderRoute(l);
 if(typeof showMileCountRoute!=="function")return null;
 if(l?.provider)return await showMileCountRoute([l.pickup||S.origin,l.delivery||S.destination]);
 const stops=[S.origin];if(S.selectedStop&&S.selectedStop!==S.origin&&S.selectedStop!==S.destination)stops.push(S.selectedStop);if(stops.at(-1)!==S.destination)stops.push(S.destination);
 return await showMileCountRoute(stops);
}
async function addToTrip(){
 const l=S.selectedCandidate;
 if(l&&S.plannerTripId&&window.MileCountCloud){
  try{
   const all=await MileCountCloud.plannerTrips(),t=all.find(x=>x.id===S.plannerTripId);
   if(t){
    const parts=Array.isArray(t.autostack_json)?t.autostack_json:[];
    const exists=parts.some(p=>p.name===l.name&&Number(p.pay)===Number(l.pay));
    if(!exists){parts.push({name:l.name,stop:l.stop,pay:Number(l.pay||0),space:Number(l.space||0),weight:Number(l.weight||0)});
     await MileCountCloud.updatePlannerTrip(t.id,{autostack_json:parts,autostack_pay:Number(t.autostack_pay||0)+Number(l.pay||0),expected_revenue:Number(t.original_pay||0)+Number(t.autostack_pay||0)+Number(l.pay||0)+Number(t.return_pay||0),cargo_used_ft:Number(t.cargo_used_ft||0)+Number(l.space||0),weight_used_lb:Number(t.weight_used_lb||0)+Number(l.weight||0)});
    }
   }
  }catch(e){console.warn("Planner AutoStack cloud update failed",e)}
 }
 if(l?.provider&&el("tripStops"))el("tripStops").innerHTML='<div class="stop">🚚 <b>'+(l.pickup||S.origin)+'</b><br>LIVE LOAD PICKUP • '+l.provider+'</div><div class="stop">🏁 <b>'+(l.delivery||S.destination)+'</b><br>LIVE LOAD DELIVERY</div>';
 showScreen(3);await updateOutboundMap();
}
function protectReturn(){
 if(el("returnLane"))el("returnLane").textContent=S.destination+" → "+S.home;
 if(el("returnPay"))el("returnPay").textContent="+"+money(S.returnPay);
 if(el("previewRoundPay"))el("previewRoundPay").textContent=money(S.totalPay+S.returnPay);
 if(el("returnMilesPreview"))el("returnMilesPreview").textContent=Math.round(S.roundTripMiles||0).toLocaleString()+" mi";
 showScreen(4)
}

async function getHomePaid(){
 S.homeAdded=false;S.returnPay=0;
 el("homeResult")?.classList.add("hidden");
 if(el("getHome")){el("getHome").disabled=true;el("getHome").textContent="NO RETURN LOAD SELECTED"}
 alert("No return load has been selected. MileCount will not add return revenue until a real or manually entered return load exists.");
}
;