/*
Milecount Live Load Discovery Map
- plots every returned load that has usable provider geometry or a known fallback city
- click marker -> load details + synced result selection
- click result -> focus marker
*/
(function(){
"use strict";

let loadMap=null;
let loadMarkers=[];
let selectedIndex=-1;

const fallbackLocations={
 "Atlanta, GA":[33.7490,-84.3880],
 "Greenville, SC":[34.8526,-82.3940],
 "Spartanburg, SC":[34.9496,-81.9320],
 "Charlotte, NC":[35.2271,-80.8431],
 "Nashville, TN":[36.1627,-86.7816],
 "Baltimore, MD":[39.2904,-76.6122],
 "Birmingham, AL":[33.5186,-86.8104],
 "Macon, GA":[32.8407,-83.6324],
 "Jacksonville, FL":[30.3322,-81.6557],
 "Orlando, FL":[28.5383,-81.3792],
 "Dallas, TX":[32.7767,-96.7970],
 "Houston, TX":[29.7604,-95.3698],
 "Chicago, IL":[41.8781,-87.6298],
 "New York, NY":[40.7128,-74.0060],
 "Los Angeles, CA":[34.0522,-118.2437],
 "Miami, FL":[25.7617,-80.1918],
 "Philadelphia, PA":[39.9526,-75.1652],
 "Indianapolis, IN":[39.7684,-86.1581],
 "Columbus, OH":[39.9612,-82.9988],
 "Detroit, MI":[42.3314,-83.0458],
 "Louisville, KY":[38.2527,-85.7585],
 "Memphis, TN":[35.1495,-90.0490]
};

function esc(v){
 return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
}
function money(v){return "$"+Math.round(Number(v)||0).toLocaleString()}
function cityState(v){
 if(!v)return "";
 if(typeof v==="string")return v;
 return [v.city,v.state].filter(Boolean).join(", ");
}
function loadPoint(load){
 const c=Array.isArray(load.routeCoordinates)?load.routeCoordinates:[];
 if(c.length){
   const p=c[0];
   if(Array.isArray(p)&&p.length>=2){
     const lon=Number(p[0]),lat=Number(p[1]);
     if(Number.isFinite(lat)&&Number.isFinite(lon))return [lat,lon];
   }
 }
 const pickup=load.pickup||cityState(load.origin);
 return fallbackLocations[pickup]||null;
}
function verdict(load,profile){
 const loaded=Math.max(0,Number(load.loadedMiles||load.loaded_miles||0));
 const dh=Math.max(0,Number(load.deadhead||load.deadhead_miles||load.extraMiles||0));
 const miles=loaded+dh;
 const rpm=miles>0?(Number(load.pay||0)/miles):0;
 const target=Number(profile?.target||0),be=Number(profile?.breakEven||0);
 if(rpm>=target&&target>0)return {label:"STRONG",tone:"strong",rpm};
 if(rpm>=be&&be>0)return {label:"WORKS",tone:"works",rpm};
 return {label:"PASS",tone:"pass",rpm};
}
function markerIcon(tone,index){
 const fill=tone==="strong"?"#18b66d":tone==="works"?"#d5a62d":"#c95757";
 return L.divIcon({
   className:"",
   html:'<div style="width:34px;height:34px;border-radius:50% 50% 50% 8px;transform:rotate(-45deg);background:'+fill+';border:3px solid #fff;box-shadow:0 4px 12px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center"><span style="transform:rotate(45deg);font-size:10px;font-weight:900;color:#fff">'+(index+1)+'</span></div>',
   iconSize:[36,36],iconAnchor:[18,34],popupAnchor:[0,-32]
 });
}
function popupHtml(load,index,profile){
 const origin=cityState(load.origin)||load.pickup||"Pickup";
 const destination=cityState(load.destination)||load.delivery||load.stop||"Delivery";
 const loaded=Math.max(0,Number(load.loadedMiles||load.loaded_miles||0));
 const dh=Math.max(0,Number(load.deadhead||load.deadhead_miles||load.extraMiles||0));
 const v=verdict(load,profile);
 const provider=load.provider||((load.name||"").includes("SIMULATION")?"SIMULATION":"MILECOUNT");
 const pickup=load.pickupDate||load.pickup_at||"—";
 const after=Number(load.afterFuel||0);
 return '<div class="mcMapPopup">'+
   '<div class="mcMapPopupTop"><b>'+esc(origin)+' → '+esc(destination)+'</b><strong>'+money(load.pay)+'</strong></div>'+
   '<div class="mcMapProvider">'+esc(provider)+' • '+esc(v.label)+'</div>'+
   '<div class="mcMapGrid">'+
    '<span><small>ALL-MILE RPM</small><b>'+(v.rpm?"$"+v.rpm.toFixed(2):"—")+'</b></span>'+
    '<span><small>DEADHEAD</small><b>'+dh.toFixed(0)+' mi</b></span>'+
    '<span><small>LOADED</small><b>'+(loaded?loaded.toFixed(0)+" mi":"—")+'</b></span>'+
    '<span><small>AFTER FUEL*</small><b>'+money(after)+'</b></span>'+
   '</div>'+
   '<div class="mcMapFine">Pickup: '+esc(pickup)+' • '+Number(load.weight||0).toLocaleString()+' lb'+(load.space?" • "+esc(load.space)+" ft":"")+'</div>'+
   '<button type="button" class="mcMapSelect" onclick="window.MileCountSelectCandidate && window.MileCountSelectCandidate('+index+')">VIEW THIS LOAD</button>'+
  '</div>';
}
function ensureMap(){
 const el=document.getElementById("loadDiscoveryMap");
 if(!el||typeof L==="undefined")return null;
 if(loadMap){setTimeout(()=>loadMap.invalidateSize(),50);return loadMap}
 loadMap=L.map(el,{zoomControl:true,scrollWheelZoom:true}).setView([36.2,-86.0],5);
 L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:"&copy; OpenStreetMap contributors"}).addTo(loadMap);
 return loadMap;
}
function clear(){
 if(!loadMap)return;
 loadMarkers.forEach(x=>loadMap.removeLayer(x.marker));
 loadMarkers=[];
}
window.renderMileCountLoadMap=function(loads,profile){
 const map=ensureMap();
 const count=document.getElementById("loadMapCount");
 if(!map)return;
 clear();
 const bounds=[];
 (Array.isArray(loads)?loads:[]).forEach((load,index)=>{
   const pt=loadPoint(load); if(!pt)return;
   const v=verdict(load,profile);
   const marker=L.marker(pt,{icon:markerIcon(v.tone,index),riseOnHover:true}).addTo(map);
   marker.bindPopup(popupHtml(load,index,profile),{maxWidth:330,minWidth:275});
   marker.on("click",()=>{
     selectedIndex=index;
     if(window.MileCountSelectCandidate)window.MileCountSelectCandidate(index);
   });
   loadMarkers.push({index,marker,pt});
   bounds.push(pt);
 });
 if(count)count.textContent=loadMarkers.length+" MAPPED";
 if(bounds.length===1)map.setView(bounds[0],8);
 else if(bounds.length>1)map.fitBounds(bounds,{padding:[32,32],maxZoom:9});
 setTimeout(()=>map.invalidateSize(),100);
};
window.focusMileCountLoadMarker=function(index){
 selectedIndex=index;
 const x=loadMarkers.find(m=>m.index===Number(index));
 if(!x||!loadMap)return;
 loadMap.setView(x.pt,Math.max(loadMap.getZoom(),7),{animate:true});
 x.marker.openPopup();
 const card=document.querySelector('.candidateLoad[data-load-index="'+index+'"]');
 if(card)card.scrollIntoView({behavior:"smooth",block:"nearest"});
};
})();
