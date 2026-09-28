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
 try{const r=await fetch("https://lrnyxqtmywkhtrmsjquc.supabase.co/functions/v1/truktek-public-pilot",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({origin:S.origin,destination:S.destination,space_ft:space,weight_lb:weight,max_deadhead:Math.max(0,val("maxDeadhead",100)),min_rpm:Math.max(0,val("minRPM",0)),pickup_date:el("pickupDate")?.value||null,equipment:el("vehicleType")?.value||"box26",search_mode:window.MileCountActiveMapArea?"map_area":"lane",map_bounds:window.MileCountActiveMapArea||null,map_center:window.MileCountActiveMapArea?.center||null,map_zoom:window.MileCountActiveMapArea?.zoom||null})});if(r.ok){const j=await r.json();providerResponded=true;providerLiveFound=Number(j.live_found||0);resolvedLane=j.resolved||null;loads=(j.loads||[]).map(x=>({name:x.name+" • TrukTek",pay:x.pay,space:x.space,weight:x.weight,stop:x.delivery||S.destination,fallback:Number(x.deadhead||0),deadhead:Number(x.deadhead||0),loadedMiles:Number(x.loadedMiles||0),origin:x.origin,destination:x.destination,provider:"TrukTek",providerLoadId:x.provider_load_id,bookingReference:x.booking_reference,routeCoordinates:x.routeCoordinates||[],pickup:x.pickup,delivery:x.delivery,broker:x.broker,pickupDate:x.pickupDate,deliveryDate:x.deliveryDate}));if(window.MileCountActiveMapArea&&typeof window.MileCountLoadInArea==="function")loads=loads.filter(l=>window.MileCountLoadInArea(l,window.MileCountActiveMapArea));liveProvider=loads.length>0}}catch(e){providerErrors.push("TrukTek");console.warn("TrukTek live pilot unavailable",e)}
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
  const d=await routeDetour(l.stop,l.fallback);
  l.extraMiles=Number.isFinite(d.extraMiles)?d.extraMiles:l.fallback;
  l.extraDriveTime=d.extraDriveTime||"Estimated";
  l.fuel=fuelFor(l.extraMiles);
  l.afterFuel=l.pay-(l.fuel.fuelCost||0);
 }
 const maxDH=Math.max(0,val("maxDeadhead",100)),minRPM=Math.max(0,val("minRPM",0));
 loads=loads.filter(l=>Number(l.extraMiles||0)<=maxDH && (Number(l.extraMiles||0)<=0 || Number(l.pay||0)/Number(l.extraMiles||1)>=minRPM));
 loads.sort((a,b)=>b.afterFuel-a.afterFuel);
 const best=loads[0]||{pay:0,space:0,weight:0,stop:S.destination,extraMiles:0,extraDriveTime:"0 min",fuel:fuelFor(0),afterFuel:0};
 S.primaryPay=pay;S.addedPay=best.pay;S.totalPay=pay+best.pay;S.extraMiles=best.extraMiles;S.selectedStop=best.stop;S.homeAdded=false;

 S.candidateLoads=loads;S.selectedCandidate=best;
 if(typeof window.renderMileCountLoadMap==="function")window.renderMileCountLoadMap(loads,{breakEven:profile.breakEven,target:profile.target,origin:S.origin,destination:S.destination});
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
 const addedRPM=best.extraMiles>0?best.pay/best.extraMiles:0;
 if(el("loadVerdict")){
   el("loadVerdict").textContent=!best.pay?"NO FIT":(addedRPM>=profile.target?"STRONG ✓":addedRPM>=profile.breakEven?"WORKS":"PASS");
   el("loadVerdict").style.color=!best.pay?"#93a79d":(addedRPM>=profile.target?"#31bf72":addedRPM>=profile.breakEven?"#f1c75b":"#ff7777");
 }
 if(el("autoStackReason"))el("autoStackReason").textContent=best.pay?"Adds "+best.extraMiles.toFixed(1)+" road miles and about "+money(best.fuel.fuelCost)+" in diesel. Estimated +"+money(best.afterFuel)+" after added fuel. Your break-even is $"+profile.breakEven.toFixed(2)+"/mi.":"No compatible freight fits the remaining truck capacity.";
 showScreen(2);
}

function selectCandidate(i){
 const l=(S.candidateLoads||[])[i];if(!l)return;S.selectedCandidate=l;S.homeAdded=false;S.returnPay=0;
 if(l.provider){
  S.tripMode="live";S.primaryPay=0;S.addedPay=l.pay;S.totalPay=l.pay;S.origin=l.pickup||([l.origin?.city,l.origin?.state].filter(Boolean).join(", "));S.destination=l.delivery||([l.destination?.city,l.destination?.state].filter(Boolean).join(", "));S.selectedStop=S.destination;S.extraMiles=Math.max(0,Number(l.deadhead||0));
 }else{
  S.tripMode="simulation";S.primaryPay=Math.max(0,val("pay",1400));S.addedPay=l.pay;S.totalPay=S.primaryPay+l.pay;S.extraMiles=l.extraMiles;S.selectedStop=l.stop;
 }
 const economicMiles=l.provider?Math.max(0,Number(l.loadedMiles||0))+Math.max(0,Number(l.deadhead||0)):Math.max(0,Number(l.extraMiles||0));
 const fuel=l.provider?fuelFor(economicMiles):l.fuel;const afterFuel=l.pay-(fuel?.fuelCost||0);
 if(el("added"))el("added").textContent="+"+money(l.pay);if(el("current"))el("current").textContent=money(S.primaryPay);if(el("newTotal"))el("newTotal").textContent=money(S.totalPay);if(el("tripPay"))el("tripPay").textContent=money(S.totalPay);if(el("tripAdded"))el("tripAdded").textContent="+"+money(l.pay);
 if(el("remainingSpace"))el("remainingSpace").textContent=Math.max(0,val("space",0)-l.space)+" ft remaining";if(el("remainingWeight"))el("remainingWeight").textContent=Math.max(0,val("weight",0)-l.weight).toLocaleString()+" lb remaining";
 if(el("detourMiles"))el("detourMiles").textContent=S.extraMiles.toFixed(1)+" mi";if(el("detourTime"))el("detourTime").textContent=l.provider?"Provider deadhead":l.extraDriveTime;if(el("spaceUsed"))el("spaceUsed").textContent=l.space+" ft";if(el("weightUsed"))el("weightUsed").textContent=l.weight.toLocaleString()+" lb";if(el("extraFuel"))el("extraFuel").textContent=money(fuel?.fuelCost||0);if(el("addedAfterFuel"))el("addedAfterFuel").textContent=money(afterFuel);
 document.querySelectorAll(".candidateLoad").forEach((b,n)=>b.classList.toggle("selected",n===i));
 if(typeof window.focusMileCountLoadMarker==="function")window.focusMileCountLoadMarker(i);
}
window.MileCountSelectCandidate=selectCandidate;
async function updateOutboundMap(){
 const l=S.selectedCandidate;
 if(l?.provider&&Array.isArray(l.routeCoordinates)&&l.routeCoordinates.length>1&&typeof showMileCountProviderRoute==="function")return await showMileCountProviderRoute(l);
 if(typeof showMileCountRoute!=="function")return null;
 if(l?.provider)return await showMileCountRoute([l.pickup||S.origin,l.delivery||S.destination]);
 const stops=[S.origin];if(S.selectedStop&&S.selectedStop!==S.origin&&S.selectedStop!==S.destination)stops.push(S.selectedStop);if(stops.at(-1)!==S.destination)stops.push(S.destination);return await showMileCountRoute(stops);
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
 if(l?.provider&&el("tripStops"))el("tripStops").innerHTML='<div class="stop">🚚 <b>'+S.origin+'</b><br>LIVE LOAD PICKUP • '+l.provider+'</div><div class="stop">🏁 <b>'+S.destination+'</b><br>LIVE LOAD DELIVERY</div>';showScreen(3);await updateOutboundMap();
}
function protectReturn(){
 if(el("returnLane"))el("returnLane").textContent=S.destination+" → "+S.home;
 if(el("returnPay"))el("returnPay").textContent=money(S.returnPay||0);
 if(el("previewRoundPay"))el("previewRoundPay").textContent=money(S.totalPay+S.returnPay);
 if(el("returnMilesPreview"))el("returnMilesPreview").textContent=Math.round(S.roundTripMiles||0).toLocaleString()+" mi";
 showScreen(4)
}

async function getHomePaid(){
 if(!(S.returnPay>0)){S.homeAdded=false;el("homeResult")?.classList.add("hidden");if(el("getHome")){el("getHome").disabled=true;el("getHome").textContent="NO RETURN LOAD SELECTED"}alert("No return load has been selected. MileCount will not add return revenue until a real or manually entered return load exists.");return}
 S.homeAdded=true;
 if(S.plannerTripId&&window.MileCountCloud){try{const all=await MileCountCloud.plannerTrips(),t=all.find(x=>x.id===S.plannerTripId);if(t)await MileCountCloud.updatePlannerTrip(t.id,{return_pay:Number(S.returnPay||0),expected_revenue:Number(t.original_pay||0)+Number(t.autostack_pay||0)+Number(S.returnPay||0)})}catch(e){console.warn("Planner return cloud update failed",e)}}
let route=null;
 if(typeof showHomeboundRoute==="function"){try{route=await showHomeboundRoute(S.origin,S.destination,S.home)}catch(e){console.warn(e)}}
 const live=route&&Number.isFinite(route.miles)?route.miles:(typeof getMileCountCurrentRoadMiles==="function"?getMileCountCurrentRoadMiles():null);
 const miles=Number.isFinite(live)&&live>0?live:S.roundTripMiles;S.roundTripMiles=miles;
 const r=typeof calculateMileCountRoundTrip==="function"?calculateMileCountRoundTrip(S.totalPay,S.returnPay,miles,S.origin):null;
 if(r){
  const monthlyMiles=Math.max(1,val("monthlyMiles",8000));
  const maintenanceCost=r.miles*Math.max(0,val("maintenanceCPM",.20));
  const insuranceCost=r.miles*(Math.max(0,val("monthlyInsurance",1800))/monthlyMiles);
  const paymentCost=r.miles*(Math.max(0,val("monthlyPayment",900))/monthlyMiles);
  const otherCost=r.miles*(Math.max(0,val("monthlyOther",300))/monthlyMiles);
  const totalTripCost=r.fuelCost+maintenanceCost+insuranceCost+paymentCost+otherCost;
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
 el("homeResult")?.classList.remove("hidden");if(el("getHome")){el("getHome").textContent="HOMEBOUND LOAD ADDED ✓";el("getHome").disabled=true}
}

async function viewUpdatedTrip(){
 const total=S.totalPay+(S.homeAdded?S.returnPay:0);if(el("tripPay"))el("tripPay").textContent=money(total);
 if(el("tripStops"))el("tripStops").innerHTML='<div class="stop">🚚 <b>'+S.origin+'</b><br>START / PRIMARY CARGO</div>'+(S.selectedStop!==S.destination?'<div class="stop">📦 <b>'+S.selectedStop+'</b><br>MileCount partial delivery</div>':'')+'<div class="stop">🏁 <b>'+S.destination+'</b><br>Original delivery</div>'+(S.homeAdded&&S.returnPay>0?'<div class="stop">💰 <b>'+S.destination+'</b><br>Confirmed return load • +'+money(S.returnPay)+'</div><div class="stop">🏠 <b>'+S.home+'</b><br>HOME ✓</div>':'');
 await saveCurrentTrip();
 showScreen(3);setTimeout(()=>{if(S.homeAdded&&typeof showHomeboundRoute==="function")showHomeboundRoute(S.origin,S.destination,S.home);else updateOutboundMap()},200);
}
async function saveCurrentTrip(){
 try{
  const s=await MileCountCloud.session();if(!s)return false;
  const miles=S.roundTripMiles||0,total=S.totalPay+(S.homeAdded?S.returnPay:0),fuel=fuelFor(miles),p=costProfile();
  const estimatedCost=miles*p.breakEven;
  await MileCountCloud.saveTrip({origin:S.origin,destination:S.destination,home_city:S.home,primary_pay:S.primaryPay,added_pay:S.addedPay,return_pay:S.homeAdded?S.returnPay:0,road_miles:miles,fuel_cost:fuel.fuelCost,all_miles_rpm:miles?total/miles:0,break_even_rpm:p.breakEven,estimated_trip_cost:estimatedCost,estimated_margin:total-estimatedCost,status:"saved"});
  return true;
 }catch(e){console.warn("Trip cloud save failed",e);return false}
}
function startNewTrip(){S.primaryPay=0;S.addedPay=0;S.totalPay=0;S.homeAdded=false;S.returnPay=0;S.extraMiles=0;S.roundTripMiles=0;S.selectedStop="";S.tripMode="idle";S.selectedCandidate=null;S.candidateLoads=[];el("homeResult")?.classList.add("hidden");if(el("getHome")){el("getHome").disabled=false;el("getHome").textContent="PROTECT MY RETURN"}showScreen(1)}
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

bind("find",findMoney);bind("addTrip",addToTrip);
bind("checkMarketQuote",checkWarpMarketQuote);bind("backToOptions",function(){showScreen(2)});bind("protect",protectReturn);bind("getHome",getHomePaid);bind("updatedTrip",viewUpdatedTrip);bind("restart",startNewTrip);
console.log("MileCount App Engine V2 Ready");
})();