/*
MileCount App Engine V2
Stable buttons + simulated AutoStack optimizer + routing + fuel
*/
(function(){
"use strict";
const S={primaryPay:1400,addedPay:0,totalPay:1400,returnPay:740,extraMiles:0,roundTripMiles:524,homeAdded:false,origin:"Atlanta, GA",destination:"Charlotte, NC",home:"Atlanta, GA",selectedStop:"Greenville, SC"};
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
 if(el("vehicleSummary"))el("vehicleSummary").textContent=activeVehicle.mpg+" MPG • "+activeVehicle.cargoLength+" ft cargo • Home: Atlanta, GA";
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
 if(typeof calculateMileCountDetour!=="function"||S.origin!=="Atlanta, GA"||S.destination!=="Charlotte, NC")return {extraMiles:fallback,extraDriveTime:"Estimated"};
 try{return await calculateMileCountDetour(S.origin,S.destination,[stop])}
 catch(e){console.warn("Detour fallback",e);return {extraMiles:fallback,extraDriveTime:"Estimated"}}
}

async function findMoney(){
 applyVehicle(el("vehicleType")?.value||"box26",false);
 const profile=updateCostUI();
 const pay=Math.max(0,val("pay",1400)),space=Math.max(0,val("space",14)),weight=Math.max(0,val("weight",6200));
 S.origin=el("from")?.value||"Atlanta, GA"; S.destination=el("to")?.value||"Charlotte, NC";
 const loads=[
  {name:"Greenville Partial A",pay:475,space:7,weight:2450,stop:"Greenville, SC",fallback:30},
  {name:"Greenville Partial B",pay:290,space:4,weight:1800,stop:"Greenville, SC",fallback:18},
  {name:"Spartanburg Partial",pay:360,space:5,weight:2100,stop:"Spartanburg, SC",fallback:24}
 ].filter(l=>l.space<=space&&l.weight<=weight);

 for(const l of loads){
  const d=await routeDetour(l.stop,l.fallback);
  l.extraMiles=Number.isFinite(d.extraMiles)?d.extraMiles:l.fallback;
  l.extraDriveTime=d.extraDriveTime||"Estimated";
  l.fuel=fuelFor(l.extraMiles);
  l.afterFuel=l.pay-(l.fuel.fuelCost||0);
 }
 loads.sort((a,b)=>b.afterFuel-a.afterFuel);
 const best=loads[0]||{pay:0,space:0,weight:0,stop:S.destination,extraMiles:0,extraDriveTime:"0 min",fuel:fuelFor(0),afterFuel:0};
 S.primaryPay=pay;S.addedPay=best.pay;S.totalPay=pay+best.pay;S.extraMiles=best.extraMiles;S.selectedStop=best.stop;S.homeAdded=false;

 if(el("loadCandidates"))el("loadCandidates").innerHTML=loads.length?loads.map((l,i)=>`
 <div style="padding:12px;border:1px solid ${i===0?"#31bf72":"#20352b"};border-radius:12px;background:${i===0?"#0d2118":"#111f19"}">
  <div style="display:flex;justify-content:space-between;gap:10px"><b>${l.name}</b><b style="color:#31bf72">+${money(l.pay)}</b></div>
  <div class="details">${l.space} ft • ${l.weight.toLocaleString()} lb • +${l.extraMiles.toFixed(1)} mi • est. +${money(l.afterFuel)} after fuel ${i===0?"• BEST FIT ✓":""}</div>
 </div>`).join(""):'<div class="details">No compatible simulated freight fits your remaining capacity.</div>';

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
 if(el("autoStackReason"))el("autoStackReason").textContent=best.pay?"Adds "+best.extraMiles.toFixed(1)+" road miles and about "+money(best.fuel.fuelCost)+" in diesel. Estimated +"+money(best.afterFuel)+" after added fuel. Your break-even is $"+profile.breakEven.toFixed(2)+"/mi.":"No compatible simulated freight fits the remaining truck capacity.";
 showScreen(2);
}

async function updateOutboundMap(){
 if(typeof showMileCountRoute!=="function")return null;
 const stops=[S.origin]; if(S.selectedStop&&S.selectedStop!==S.origin&&S.selectedStop!==S.destination)stops.push(S.selectedStop); if(stops.at(-1)!==S.destination)stops.push(S.destination);
 return await showMileCountRoute(stops);
}
async function addToTrip(){showScreen(3);await updateOutboundMap()}
function protectReturn(){if(el("previewRoundPay"))el("previewRoundPay").textContent=money(S.totalPay+S.returnPay)+" total round trip";showScreen(4)}

async function getHomePaid(){
 S.homeAdded=true;let route=null;
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

function viewUpdatedTrip(){
 const total=S.totalPay+(S.homeAdded?S.returnPay:0);if(el("tripPay"))el("tripPay").textContent=money(total);
 if(el("tripStops"))el("tripStops").innerHTML='<div class="stop">🚚 <b>'+S.origin+'</b><br>START / PRIMARY CARGO</div>'+(S.selectedStop!==S.destination?'<div class="stop">📦 <b>'+S.selectedStop+'</b><br>MileCount partial delivery</div>':'')+'<div class="stop">🏁 <b>'+S.destination+'</b><br>Original delivery</div>'+(S.homeAdded?'<div class="stop">💰 <b>'+S.destination+'</b><br>Return load pickup • +$740</div><div class="stop">🏠 <b>'+S.home+'</b><br>HOME ✓</div>':'');
 showScreen(3);setTimeout(()=>{if(S.homeAdded&&typeof showHomeboundRoute==="function")showHomeboundRoute(S.origin,S.destination,S.home);else updateOutboundMap()},200);
}
function startNewTrip(){S.homeAdded=false;el("homeResult")?.classList.add("hidden");if(el("getHome")){el("getHome").disabled=false;el("getHome").textContent="GET ME HOME PAID"}showScreen(1)}
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
 if(el("loadCandidates"))el("loadCandidates").innerHTML='<div style="padding:12px;border:1px solid #31bf72;border-radius:12px;background:#0d2118"><div style="display:flex;justify-content:space-between"><b>'+load.name+'</b><b style="color:#31bf72">+'+money(load.pay)+'</b></div><div class="details">'+load.pickup+' → '+load.stop+' • '+load.space+' ft • '+load.weight.toLocaleString()+' lb • +'+load.extraMiles.toFixed(1)+' detour mi • MANUAL LOAD ✓</div></div>';
 if(el("added"))el("added").textContent="+"+money(load.pay);if(el("current"))el("current").textContent=money(S.primaryPay);if(el("newTotal"))el("newTotal").textContent=money(S.totalPay);if(el("tripPay"))el("tripPay").textContent=money(S.totalPay);if(el("tripAdded"))el("tripAdded").textContent="+"+money(load.pay);
 if(el("detourMiles"))el("detourMiles").textContent=load.extraMiles.toFixed(1)+" mi";if(el("detourTime"))el("detourTime").textContent=load.extraDriveTime;if(el("spaceUsed"))el("spaceUsed").textContent=load.space+" ft";if(el("weightUsed"))el("weightUsed").textContent=load.weight.toLocaleString()+" lb";
 if(el("extraFuel"))el("extraFuel").textContent=money(load.fuel.fuelCost);if(el("extraFuelDetails"))el("extraFuelDetails").textContent=load.fuel.gallons.toFixed(1)+" gal • $"+load.fuel.dieselPrice.toFixed(2)+"/gal • "+load.fuel.source;if(el("addedAfterFuel"))el("addedAfterFuel").textContent="+"+money(load.afterFuel);
 if(el("loadVerdict"))el("loadVerdict").textContent=incrementalRPM>=p.target?"STRONG ✓":incrementalRPM>=p.breakEven?"WORKS":"PASS";
 if(el("autoStackReason"))el("autoStackReason").textContent="Manual load analysis: estimated +"+money(load.afterFuel)+" after incremental fuel. Break-even is $"+p.breakEven.toFixed(2)+"/mi.";
 showScreen(2);
}
function saveProfile(){
 const data={vehicleType:el("vehicleType")?.value,monthlyPayment:val("monthlyPayment",0),monthlyInsurance:val("monthlyInsurance",0),maintenanceCPM:val("maintenanceCPM",0),monthlyOther:val("monthlyOther",0),monthlyMiles:val("monthlyMiles",0)};
 try{localStorage.setItem("milecountProfile",JSON.stringify(data));if(el("saveStatus"))el("saveStatus").textContent="Saved on this device ✓"}catch(e){if(el("saveStatus"))el("saveStatus").textContent="Could not save on this device."}
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
  const [p,v,t]=await Promise.all([MileCountCloud.profile(),MileCountCloud.vehicles(),MileCountCloud.trips()]);
  if(el("accountPlan"))el("accountPlan").textContent=(p?.plan||"free").toUpperCase();
  if(el("cloudVehicleCount"))el("cloudVehicleCount").textContent=v.length;
  if(el("cloudTripCount"))el("cloudTripCount").textContent=t.length;
 }catch(e){if(el("authMessage"))el("authMessage").textContent=e.message}
}
bind("accountButton",async function(){
 document.querySelectorAll(".screen").forEach(s=>s.classList.remove("active"));
 const panel=el("accountPanel");if(panel){panel.classList.remove("hidden");panel.scrollIntoView({behavior:"smooth",block:"start"})}
 await refreshAccount();
});
bind("signUp",async function(){try{const email=el("authEmail").value.trim(),password=el("authPassword").value,name=el("authName").value.trim();if(password.length<8)throw new Error("Use at least 8 characters.");await MileCountCloud.signUp(email,password,name);if(el("authMessage"))el("authMessage").textContent="Account created. Check your email if confirmation is required.";await refreshAccount()}catch(e){el("authMessage").textContent=e.message}});
bind("signIn",async function(){try{await MileCountCloud.signIn(el("authEmail").value.trim(),el("authPassword").value);el("authMessage").textContent="Signed in ✓";await refreshAccount()}catch(e){el("authMessage").textContent=e.message}});
bind("signOut",async function(){try{await MileCountCloud.signOut();el("authMessage").textContent="Signed out.";await refreshAccount()}catch(e){el("authMessage").textContent=e.message}});
bind("closeAccount",function(){el("accountPanel")?.classList.add("hidden");showScreen(1)});
bind("find",findMoney);bind("addTrip",addToTrip);bind("protect",protectReturn);bind("getHome",getHomePaid);bind("updatedTrip",viewUpdatedTrip);bind("restart",startNewTrip);
console.log("MileCount App Engine V2 Ready");
})();