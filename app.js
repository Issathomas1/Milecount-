window.mcTripStorageKey="mcOriginalTrips:guest";(async()=>{try{const s=await window.MileCountCloud?.session?.();if(s?.user?.id)window.mcTripStorageKey="mcOriginalTrips:"+s.user.id}catch(e){}})();
/*
MileCount App Engine V2
Stable buttons + simulated AutoStack optimizer + routing + fuel
*/
(function(){
"use strict";
const S={primaryPay:1400,addedPay:0,totalPay:1400,returnPay:0,extraMiles:0,roundTripMiles:0,homeAdded:false,origin:"",destination:"",home:"Atlanta, GA",selectedStop:"",selectedCandidate:null,candidateLoads:[],tripMode:"idle"};
const el=id=>document.getElementById(id);
const val=(id,f=0)=>{const n=Number(el(id)?.value);return Number.isFinite(n)?n:f};
const money=v=>"$"+Math.round(Number(v)||0).toLocaleString();
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
 if(el("dataModeBadge")){el("dataModeBadge").textContent=providerResponded?(liveProvider?"LIVE • TRUKTEK":"LIVE • 0 MATCHES"):"LIVE API UNAVAILABLE";el("dataModeBadge").style.background=liveProvider?"#dff8e9":"#fff0bf";}
 if(el("footerMode"))el("footerMode").textContent=providerResponded?"LIVE TRUKTEK SEARCH • SOURCE ATTRIBUTED":"LIVE PROVIDER UNAVAILABLE";
 if(el("mapModeLabel"))el("mapModeLabel").textContent=liveProvider?"Live-provider trip preview • green line = MileCount road route":"Route preview • green line = MileCount road route";
 if(!loads.length&&!providerResponded){providerErrors.push("TrukTek unavailable");loads=[]}
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
 S.primaryPay=pay;S.addedPay=best.pay;S.totalPay=pay+best.pay;S.extraMiles=best.extraMiles;S.selectedStop=best.stop;S.homeAdded=false;S.returnPay=0;S.roundTripMiles=0;S.tripMode=liveProvider?"live":"simulation";

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
 <div class="loadFoot"><span class="sourceTag">${source}</span><span class="verdictTag">${i===0?"BEST FIT • ":""}${verdict}</span></div></button>`}).join(""):'<div class="details">'+(providerResponded?'LIVE SEARCH COMPLETE • '+providerLiveFound+' provider loads found, but none fit your remaining capacity/current filters.':'LIVE PROVIDER UNAVAILABLE • No loads were fabricated or substituted.')+'</div>'; document.querySelectorAll(".candidateLoad").forEach(btn=>btn.addEventListener("click",()=>selectCandidate(Number(btn.dataset.loadIndex))));

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
 showScreen(3);await updateOutboundMap();
}
async function searchLiveBackhaul(){
 const outbound=S.selectedCandidate;if(!outbound?.provider)return null;
 const from=outbound.delivery||([outbound.destination?.city,outbound.destination?.state].filter(Boolean).join(", "))||S.destination,home=S.home||"Atlanta, GA";
 if(!from||!home||from===home)return null;
 if(el("returnLane"))el("returnLane").textContent=from+" → "+home;if(el("returnPay"))el("returnPay").textContent="SEARCHING…";if(el("returnSource"))el("returnSource").textContent="LIVE SEARCH";if(el("returnStatus"))el("returnStatus").textContent="CHECKING";if(el("getHome")){el("getHome").disabled=true;el("getHome").textContent="SEARCHING LIVE BACKHAULS…"}
 try{
  const r=await fetch("https://lrnyxqtmywkhtrmsjquc.supabase.co/functions/v1/truktek-public-pilot",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({origin:from,destination:home,space_ft:Math.max(0,val("space",0)-Number(outbound.space||0)),weight_lb:Math.max(0,val("weight",0)-Number(outbound.weight||0)),max_deadhead:Math.max(0,val("maxDeadhead",100)),min_rpm:Math.max(0,val("minRPM",0)),pickup_date:el("pickupDate")?.value||null,equipment:el("vehicleType")?.value||"box26"})});
  if(!r.ok)throw new Error("Provider "+r.status);const j=await r.json(),rows=(j.loads||[]).map(x=>({...x,provider:"TrukTek"}));
  if(!rows.length){S.confirmedReturnLoad=null;S.returnPay=0;S.homeAdded=false;if(el("returnPay"))el("returnPay").textContent="$0";if(el("returnSource"))el("returnSource").textContent="TrukTek";if(el("returnStatus"))el("returnStatus").textContent="NO LIVE MATCH";if(el("returnSourceTag"))el("returnSourceTag").textContent="LIVE • 0 MATCHES";if(el("previewRoundPay"))el("previewRoundPay").textContent=money(S.totalPay);if(el("getHome")){el("getHome").disabled=false;el("getHome").textContent="SEARCH AGAIN"}return null}
  rows.sort((a,b)=>(Number(b.pay||0)/(Math.max(1,Number(b.loadedMiles||0)+Number(b.deadhead||0))))-(Number(a.pay||0)/(Math.max(1,Number(a.loadedMiles||0)+Number(a.deadhead||0)))));
  const best=rows[0];S.confirmedReturnLoad=best;S.returnPay=Number(best.pay||0);S.homeAdded=false;if(el("returnLane"))el("returnLane").textContent=(best.pickup||from)+" → "+(best.delivery||home);if(el("returnPay"))el("returnPay").textContent="+"+money(S.returnPay);if(el("returnSource"))el("returnSource").textContent=best.provider;if(el("returnStatus"))el("returnStatus").textContent="LIVE AVAILABLE";if(el("returnSourceTag"))el("returnSourceTag").textContent="LIVE • "+best.provider;if(el("returnMilesPreview"))el("returnMilesPreview").textContent=Math.round(Number(best.loadedMiles||0)+Number(best.deadhead||0)).toLocaleString()+" mi";if(el("previewRoundPay"))el("previewRoundPay").textContent=money(S.totalPay+S.returnPay);if(el("getHome")){el("getHome").disabled=false;el("getHome").textContent="ADD LIVE BACKHAUL"}return best
 }catch(e){S.confirmedReturnLoad=null;S.returnPay=0;S.homeAdded=false;if(el("returnPay"))el("returnPay").textContent="—";if(el("returnStatus"))el("returnStatus").textContent="PROVIDER UNAVAILABLE";if(el("getHome")){el("getHome").disabled=false;el("getHome").textContent="TRY LIVE SEARCH AGAIN"}return null}
}
async function protectReturn(){showScreen(4);if(S.tripMode==="live"||S.selectedCandidate?.provider)await searchLiveBackhaul()}
;