window.mcTripStorageKey="mcOriginalTrips:guest";(async()=>{try{const s=await window.MileCountCloud?.session?.();if(s?.user?.id)window.mcTripStorageKey="mcOriginalTrips:"+s.user.id}catch(e){}})();
/*
MileCount App Engine V2
Stable buttons + simulated AutoStack optimizer + routing + fuel
*/
(function(){
"use strict";
const S={primaryPay:1400,addedPay:0,totalPay:1400,returnPay:0,extraMiles:0,roundTripMiles:0,homeAdded:false,origin:"Atlanta, GA",destination:"Charlotte, NC",home:"Atlanta, GA",selectedStop:"Greenville, SC",liveOnlyBrowse:false,stayHomeAfterSearch:false};
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

async function findMoney(){
 applyVehicle(el("vehicleType")?.value||"box26",false);
 const profile=updateCostUI();
 const pay=Math.max(0,val("pay",1400)),space=Math.max(0,val("space",14)),weight=Math.max(0,val("weight",6200));
 S.origin=el("from")?.value||"Atlanta, GA"; S.destination=el("to")?.value||"Charlotte, NC";
 let loads=[];let liveProvider=false; let providerErrors=[];
 let providerResponded=false,providerLiveFound=0,resolvedLane=null;
 try{const r=await withTimeout(fetch("https://lrnyxqtmywkhtrmsjquc.supabase.co/functions/v1/truktek-public-pilot",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({origin:S.origin,destination:S.destination,space_ft:space,weight_lb:weight,max_deadhead:Math.max(0,val("maxDeadhead",100)),min_rpm:Math.max(0,val("minRPM",0)),pickup_date:el("pickupDate")?.value||null,equipment:el("vehicleType")?.value||"box26",search_mode:S.liveOnlyBrowse?"live_board":(window.MileCountActiveMapArea?"map_area":"lane"),map_bounds:window.MileCountActiveMapArea||null,map_center:window.MileCountActiveMapArea?.center||null,map_zoom:window.MileCountActiveMapArea?.zoom||null})}),10000,null);if(!r)throw new Error("TrukTek request timed out");if(r.ok){const j=await r.json();providerResponded=true;providerLiveFound=Number(j.live_found||0);resolvedLane=j.resolved||null;loads=(j.loads||[]).map(x=>({name:x.name+" • TrukTek",pay:x.pay,space:x.space,weight:x.weight,stop:x.delivery||S.destination,fallback:Number(x.deadhead||0),deadhead:Number(x.deadhead||0),loadedMiles:Number(x.loadedMiles||0),origin:x.origin,destination:x.destination,provider:"TrukTek",providerLoadId:x.provider_load_id,bookingReference:x.booking_reference,routeCoordinates:x.routeCoordinates||[],pickup:x.pickup,delivery:x.delivery,broker:x.broker,pickupDate:x.pickupDate,deliveryDate:x.deliveryDate}));if(window.MileCountActiveMapArea&&typeof window.MileCountLoadInArea==="function")loads=loads.filter(l=>window.MileCountLoadInArea(l,window.MileCountActiveMapArea));liveProvider=loads.length>0}}catch(e){providerErrors.push("TrukTek");console.warn("TrukTek live pilot unavailable",e)}
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
 if(!loads.length&&!S.liveOnlyBrowse)loads=[
  {name:"Greenville Partial A • SIMULATION",pay:475,space:7,weight:2450,stop:"Greenville, SC",fallback:30},
  {name:"Greenville Partial B • SIMULATION",pay:290,space:4,weight:1800,stop:"Greenville, SC",fallback:18},
  {name:"Spartanburg Partial • SIMULATION",pay:360,space:5,weight:2100,stop:"Spartanburg, SC",fallback:24}
 ].filter(l=>l.space<=space&&l.weight<=weight);
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
   loads=loads.filter(l=>Number(l.extraMiles||0)<=maxDH && (Number(l.extraMiles||0)<=0 || Number(l.pay||0)/Number(l.extraMiles||1)>=minRPM));
 }
 loads.sort((a,b)=>b.afterFuel-a.afterFuel);
 const best=loads[0]||{pay:0,space:0,weight:0,stop:S.destination,extraMiles:0,extraDriveTime:"0 min",fuel:fuelFor(0),afterFuel:0};
 S.primaryPay=pay;S.addedPay=best.pay;S.totalPay=pay+best.pay;S.extraMiles=best.extraMiles;S.selectedStop=best.stop;S.homeAdded=false;

 if(S.liveOnlyBrowse)S.liveBoardLoads=[...loads];
 S.candidateLoads=loads;S.selectedCandidate=best;
 if(typeof window.renderMileCountLoadMap==="function")window.renderMileCountLoadMap(loads,{breakEven:profile.breakEven,target:profile.target,origin:S.origin,destination:S.destination});
 if(el("loadCandidates"))el("loadCandidates").innerHTML=loads.length?loads.map((l,i)=>{
 const miles=Math.max(0,Number(l.loadedMiles||l.loaded_miles||0)),dh=Math.max(0,Number(l.deadheadMiles??l.deadhead_miles??l.extraMiles??0));
 const allMiles=miles+dh,rpm=allMiles>0?Number(l.pay||0)/allMiles:(dh>0?Number(l.pay||0)/dh:0);
 const margin=Number(l.afterFuel||0),verdict=rpm>=profile.target?"STRONG":rpm>=profile.breakEven?"WORKS":"PASS";
 const origin=l.origin?.city?l.origin.city+", "+(l.origin.state||""):S.origin,destination=l.destination?.city?l.destination.city+", "+(l.destination.state||""):l.stop;
 const source=l.provider||((l.name||"").includes("SIMULATION")?"SIMULATION":"MILECOUNT");
 return `<button type="button" class="candidateLoad loadResult ${i===0?"selected":""}" data-load-index="${i}">
 <div class="loadTop"><div><div class="loadLane">${origin} → ${destination}</div><div class="loadMeta">${l.name||"Available load"} • ${activeVehicle.name}</div></div><div class="loadPay">${money(l.pay)}</div></div>
 <div class="loadMetrics"><div class="loadMetric"><small>ALL-MILE RPM</small><b>${rpm?"$"+rpm.toFixed(2):"—"}</b></div><div class="loadMetric"><small>DEADHEAD</small><b>${dh.toFixed(0)} mi</b></div><div class="loadMetric"><small>WEIGHT</small><b>${Number(l.weight||0).toLocaleString()} lb</b></div><div class="loadMetric"><small>EST. AFTER FUEL*</small><b>${money(margin)}</b></div></div>
 <div class="loadFoot"><span class="sourceTag">${source}</span><span class="verdictTag">${i===0&&verdict!=="PASS"?"BEST FIT • ":""}${verdict}</span></div></button>`}).join(""):'<div class="details">No compatible freight matched these filters. Adjust deadhead/RPM or use simulation mode for the demo.</div>'; document.querySelectorAll(".candidateLoad").forEach(btn=>btn.addEventListener("click",()=>selectCandidate(Number(btn.dataset.loadIndex))));

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
 if(!S.stayHomeAfterSearch)showScreen(2);
}

function selectCandidate(i){
 const l=(S.candidateLoads||[])[i];if(!l)return;S.selectedCandidate=l;S.homeAdded=false;S.returnPay=0;
 if(l.provider){
  S.tripMode="live";S.primaryPay=0;S.addedPay=l.pay;S.totalPay=l.pay;
  S.selectedLoadPickup=l.pickup||([l.origin?.city,l.origin?.state].filter(Boolean).join(", "));
  S.selectedLoadDelivery=l.delivery||([l.destination?.city,l.destination?.state].filter(Boolean).join(", "));
  S.selectedStop=S.selectedLoadDelivery;
  S.extraMiles=Math.max(0,Number(l.deadheadMiles??l.extraMiles??0));
 }else{
  S.tripMode="simulation";S.primaryPay=Math.max(0,val("pay",1400));S.addedPay=l.pay;S.totalPay=S.primaryPay+l.pay;S.extraMiles=l.extraMiles;S.selectedStop=l.stop;
 }
 const economicMiles=l.provider?Math.max(0,Number(l.loadedMiles||0))+Math.max(0,Number(l.deadheadMiles??l.extraMiles??0)):Math.max(0,Number(l.extraMiles||0));
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
 if(l?.provider)return await showMileCountRoute([S.origin,l.pickup||S.origin,l.delivery||S.destination].filter((x,i,a)=>x&&a.indexOf(x)===i));
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
 if(l?.provider&&el("tripStops"))el("tripStops").innerHTML='<div class="stop">🚚 <b>'+(l.pickup||S.selectedLoadPickup||S.origin)+'</b><br>LIVE LOAD PICKUP • '+l.provider+'</div><div class="stop">🏁 <b>'+(l.delivery||S.selectedLoadDelivery||S.destination)+'</b><br>LIVE LOAD DELIVERY</div>';
 showScreen(3);
 // Never leave the route card spinning forever.
 if(el("roadMiles"))el("roadMiles").textContent="Calculating…";
 if(el("driveTime"))el("driveTime").textContent="Calculating…";
 if(el("routeSource"))el("routeSource").textContent="Calculating road route…";
 const route=await withTimeout(updateOutboundMap(),6500,null);
 if(!route){
   if(el("roadMiles"))el("roadMiles").textContent="Route unavailable";
   if(el("driveTime"))el("driveTime").textContent="—";
   if(el("routeSource"))el("routeSource").textContent="Routing timed out. Load details are still usable; retry from the trip screen.";
 }
}
async function protectReturn(){
 if(el("protect")?.disabled)return;
 setBusy(true,"One moment — dispatching your way home…");
 setButtonBusy("protect",true,"SEARCHING 0–3 DAYS…","FIND MY WAY HOME");
 const selected=S.selectedCandidate;
 const delivery=selected?.delivery||S.selectedLoadDelivery||S.destination;
 const home=(el("from")?.value||S.home||"Atlanta, GA").trim();
 S.home=home;
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

 candidates.sort((a,b)=>b.score-a.score);
 const useful=candidates.filter(c=>c.homeProgress>=-50||!directMiles).slice(0,8);
 S.returnCandidates=useful;
 const best=useful[0];

 if(best){
   S.returnPay=Number(best.pay||0);
   S.returnSelected=best;
   if(el("returnPay"))el("returnPay").textContent=money(best.pay);
   if(el("returnSource"))el("returnSource").textContent=best.isSandbox?"LoadBoot TEST":"TrukTek";
   if(el("returnStatus"))el("returnStatus").textContent=(best.pickupDate||("+"+best.daysOut+" day"))+(best.isSandbox?" • TEST":" • LIVE");
   if(el("returnSourceTag"))el("returnSourceTag").textContent=best.isSandbox?"SANDBOX TEST • via LoadBoot":"LIVE • TrukTek";
   if(el("previewRoundPay"))el("previewRoundPay").textContent=money(S.totalPay+S.returnPay);
   if(el("returnMilesPreview"))el("returnMilesPreview").textContent=directMiles?Math.round(directMiles).toLocaleString()+" mi toward home":"Route found";
   if(el("returnLead"))el("returnLead").textContent="Best homebound option found. MileCount searched up to 3 days forward and ranked freight by homeward progress, deadhead and all-mile RPM.";
   if(el("getHome")){el("getHome").disabled=false;el("getHome").textContent="ADD BEST HOMEBOUND LOAD"}
 }else{
   S.returnPay=0;S.returnSelected=null;
   if(el("returnPay"))el("returnPay").textContent="$0";
   if(el("returnSource"))el("returnSource").textContent="NO MATCH";
   if(el("returnStatus"))el("returnStatus").textContent="0–3 DAYS CHECKED";
   if(el("returnSourceTag"))el("returnSourceTag").textContent="NO HOMEBOUND FREIGHT";
   if(el("returnLead"))el("returnLead").textContent="No connected freight currently moves you toward home within the 3-day search window. Try again later or widen the home market.";
   if(el("getHome")){el("getHome").disabled=true;el("getHome").textContent="NO HOMEBOUND LOAD YET"}
 }
 setButtonBusy("protect",false,"","FIND MY WAY HOME");
 setBusy(false);
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
 if(!stayHome)setButtonBusy("browseLiveLoads",true,"REFRESHING BOARD…","BROWSE LIVE LOAD BOARD");
 S.liveOnlyBrowse=true;
 S.stayHomeAfterSearch=!!stayHome;
 applyVehicle(el("vehicleType")?.value||"box26",false);
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
   if(!stayHome)setButtonBusy("browseLiveLoads",false,"","BROWSE LIVE LOAD BOARD");
   setBusy(false);
 }
}
bind("find",runNormalLoadSearch);
bind("browseLiveLoads",()=>browseLiveLoadBoard(false));
bind("refreshLiveMap",async()=>{await browseLiveLoadBoard(true);await Promise.all([refreshLiveLoadCount(),refreshUnifiedFreightBoard(true)])});
bind("viewLoadList",()=>showScreen(2));
bind("addTrip",addToTrip);
bind("checkMarketQuote",checkWarpMarketQuote);bind("backToOptions",function(){showScreen(2)});bind("protect",protectReturn);bind("getHome",getHomePaid);bind("updatedTrip",viewUpdatedTrip);bind("restart",startNewTrip);
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
   loadBootSandboxLoads=raw.map(normalizeLoadBootSandbox);
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
 if(l.isSandbox)return "loadboot-sandbox";
 return String(l.provider||"unknown").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
}
function updateProviderFilterOptions(loads){
 const sel=el("providerFilter");if(!sel)return;
 const current=sel.value||"all";
 const seen=new Map();
 (loads||[]).forEach(l=>{
   const key=providerFilterKey(l);
   const label=l.isSandbox?"LoadBoot Sandbox":(l.provider||"Other Provider");
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

function unifiedSourceLabel(l){
 return l.isSandbox?"SANDBOX TEST • via LoadBoot":"LIVE • "+(l.provider||"Provider");
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
    '<div class="loadMetrics"><div class="loadMetric"><small>ALL-MILE RPM</small><b>'+(rpm?"$"+rpm.toFixed(2):"—")+'</b></div><div class="loadMetric"><small>DEADHEAD</small><b>'+(S.liveOnlyBrowse&&!l.isSandbox?"—":dh.toFixed(0)+" mi")+'</b></div><div class="loadMetric"><small>WEIGHT</small><b>'+Number(l.weight||0).toLocaleString()+' lb</b></div><div class="loadMetric"><small>SOURCE</small><b>'+(l.isSandbox?"via LoadBoot":(l.provider||"LIVE"))+'</b></div></div>'+
    '<div class="loadFoot"><span class="sourceTag">'+(l.isSandbox?"LOADBOOT SANDBOX":"LIVE • "+(l.provider||"PROVIDER"))+'</span><span class="verdictTag">'+verdict+'</span></div></button>';
 }).join(""):'<div class="details">No freight is currently available from connected sources.</div>';
 document.querySelectorAll(".candidateLoad").forEach(btn=>btn.addEventListener("click",()=>selectCandidate(Number(btn.dataset.loadIndex))));
}
async function refreshUnifiedFreightBoard(forceSandbox=false){
 const sandbox=await fetchLoadBootSandbox(forceSandbox);
 const live=Array.isArray(S.liveBoardLoads)?S.liveBoardLoads:[];
 const all=[...live,...sandbox];
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
 showScreen(2);
}
bind("viewLoadBootSandbox",showLoadBootSandbox);
fetchLoadBootSandbox(false);

el("providerFilter")?.addEventListener("change",applyProviderFilter);
console.log("MileCount App Engine V2 Ready");
})();