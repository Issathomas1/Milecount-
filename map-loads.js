/*
Milecount Load Discovery Map V2
- clickable load pins
- zoom-aware lightweight clustering (no external clustering plugin)
- nationwide density / heat view
- result list <-> map synchronization
*/
(function(){
"use strict";

let loadMap=null;
let renderedLayers=[];
let sourceLoads=[];
let sourceProfile={};
let mapRenderGeneration=0;
let selectedIndex=-1;
let mapMode="pins";
let areaSearchActive=false;

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
 "Memphis, TN":[35.1495,-90.0490],
 "Phoenix, AZ":[33.4484,-112.0740],
 "Denver, CO":[39.7392,-104.9903],
 "Seattle, WA":[47.6062,-122.3321],
 "Portland, OR":[45.5152,-122.6784],
 "San Francisco, CA":[37.7749,-122.4194],
 "San Diego, CA":[32.7157,-117.1611],
 "Las Vegas, NV":[36.1699,-115.1398],
 "Salt Lake City, UT":[40.7608,-111.8910],
 "Kansas City, MO":[39.0997,-94.5786],
 "St. Louis, MO":[38.6270,-90.1994],
 "Minneapolis, MN":[44.9778,-93.2650],
 "Milwaukee, WI":[43.0389,-87.9065],
 "Cleveland, OH":[41.4993,-81.6944],
 "Pittsburgh, PA":[40.4406,-79.9959],
 "Washington, DC":[38.9072,-77.0369],
 "Richmond, VA":[37.5407,-77.4360],
 "Raleigh, NC":[35.7796,-78.6382],
 "Charleston, SC":[32.7765,-79.9311],
 "Savannah, GA":[32.0809,-81.0912],
 "Tampa, FL":[27.9506,-82.4572],
 "Austin, TX":[30.2672,-97.7431],
 "San Antonio, TX":[29.4241,-98.4936],
 "New Orleans, LA":[29.9511,-90.0715],
 "Little Rock, AR":[34.7465,-92.2896],
 "Oklahoma City, OK":[35.4676,-97.5164],
 "Omaha, NE":[41.2565,-95.9345]
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
 if(load.map_lat!=null&&load.map_lon!=null&&String(load.map_lat).trim()&&String(load.map_lon).trim()&&Number.isFinite(Number(load.map_lat))&&Number.isFinite(Number(load.map_lon))&&Math.abs(Number(load.map_lat))<=90&&Math.abs(Number(load.map_lon))<=180)return [Number(load.map_lat),Number(load.map_lon)];
 if(Array.isArray(load._milecountMapPoint)&&load._milecountMapPoint.length===2)return load._milecountMapPoint;
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

async function hydrateMissingLoadPoints(loads,generation){
 if(typeof resolveMileCountLocation!=="function")return;
 const unresolved=(Array.isArray(loads)?loads:[]).filter(l=>!loadPoint(l));
 const byPickup=new Map();
 unresolved.forEach(l=>{
   const pickup=l.pickup||cityState(l.origin);
   if(pickup&&!byPickup.has(pickup))byPickup.set(pickup,[]);
   if(pickup)byPickup.get(pickup).push(l);
 });
 const entries=[...byPickup.entries()];
 const batchSize=5;
 for(let i=0;i<entries.length;i+=batchSize){
   if(generation!=null&&generation!==mapRenderGeneration)return;
   await Promise.all(entries.slice(i,i+batchSize).map(async([pickup,list])=>{
     try{
       const p=await resolveMileCountLocation(pickup);
       if(Number.isFinite(Number(p?.lat))&&Number.isFinite(Number(p?.lon))){
         list.forEach(l=>{l._milecountMapPoint=[Number(p.lat),Number(p.lon)]});
       }
     }catch(e){
       console.warn("Could not map live load pickup",pickup,e);
     }
   }));
 }
}
function economics(load,profile){
 const loaded=Math.max(0,Number(load.loadedMiles||load.loaded_miles||0));
 const dh=Math.max(0,Number(load.deadhead||load.deadhead_miles||load.extraMiles||0));
 const miles=loaded+dh;
 const rpm=miles>0?(Number(load.pay||0)/miles):0;
 const target=Number(profile?.target||0),be=Number(profile?.breakEven||0);
 let label="PASS",tone="pass";
 if(rpm>=target&&target>0){label="STRONG";tone="strong"}
 else if(rpm>=be&&be>0){label="WORKS";tone="works"}
 return {label,tone,rpm,loaded,dh,miles};
}
function markerColor(tone){
 return tone==="strong"?"#18b66d":tone==="works"?"#d5a62d":"#c95757";
}
function markerIcon(tone,index){
 const fill=markerColor(tone);
 return L.divIcon({
   className:"",
   html:'<div style="width:34px;height:34px;border-radius:50% 50% 50% 8px;transform:rotate(-45deg);background:'+fill+';border:3px solid #fff;box-shadow:0 4px 12px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center"><span style="transform:rotate(45deg);font-size:10px;font-weight:900;color:#fff">'+(index+1)+'</span></div>',
   iconSize:[36,36],iconAnchor:[18,34],popupAnchor:[0,-32]
 });
}
function popupHtml(load,index,profile){
 const origin=cityState(load.origin)||load.pickup||"Pickup";
 const destination=cityState(load.destination)||load.delivery||load.stop||"Delivery";
 const e=economics(load,profile);
 const provider=load.provider||((load.name||"").includes("SIMULATION")?"SIMULATION":"MILECOUNT");
 const pickup=load.pickupDate||load.pickup_at||"—";
 const after=Number(load.afterFuel||0);
 const sourceLink=load.bookingUrl||load.booking_url||load.sourceUrl||load.source_url||"";
 const loadBoot=/loadboot/i.test(provider)&&!!load.providerLoadId;
 const sourceButton=sourceLink?'<a class="mcMapSource" href="'+esc(sourceLink)+'" target="_blank" rel="noopener">'+(loadBoot?'via LoadBoot':'OPEN SOURCE')+'</a>':"";
 return '<div class="mcMapPopup">'+
   '<div class="mcMapPopupTop"><b>'+esc(origin)+' → '+esc(destination)+'</b><strong>'+money(load.pay)+'</strong></div>'+
   '<div class="mcMapProvider">'+esc(provider)+' • '+esc(e.label)+'</div>'+
   '<div class="mcMapGrid">'+
    '<span><small>ALL-MILE RPM</small><b>'+(e.rpm?"$"+e.rpm.toFixed(2):"—")+'</b></span>'+
    '<span><small>DEADHEAD</small><b>'+e.dh.toFixed(0)+' mi</b></span>'+
    '<span><small>LOADED</small><b>'+(e.loaded?e.loaded.toFixed(0)+" mi":"—")+'</b></span>'+
    '<span><small>AFTER FUEL*</small><b>'+money(after)+'</b></span>'+
   '</div>'+
   '<div class="mcMapFine">Pickup: '+esc(pickup)+' • '+Number(load.weight||0).toLocaleString()+' lb'+(load.space?" • "+esc(load.space)+" ft":"")+'</div>'+
   '<button type="button" class="mcMapSelect" onclick="window.MileCountOpenLoadDetails ? window.MileCountOpenLoadDetails('+index+') : (window.MileCountSelectCandidate && window.MileCountSelectCandidate('+index+'))">VIEW THIS LOAD</button>'+
   sourceButton+
  '</div>';
}
function ensureMap(){
 const el=document.getElementById("loadDiscoveryMap");
 if(!el||typeof L==="undefined")return null;
 if(loadMap){setTimeout(()=>loadMap.invalidateSize(),50);return loadMap}
 loadMap=L.map(el,{zoomControl:true,scrollWheelZoom:true,preferCanvas:true}).setView([39.5,-98.35],4);
 L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:"&copy; OpenStreetMap contributors"}).addTo(loadMap);
 loadMap.on("zoomend moveend",()=>{ if(sourceLoads.length) redraw(); });
 return loadMap;
}
function clearLayers(){
 if(!loadMap)return;
 renderedLayers.forEach(x=>{try{loadMap.removeLayer(x)}catch(e){}});
 renderedLayers=[];
}
function preparedLoads(){
 return sourceLoads.map((load,index)=>({load,index,pt:loadPoint(load)})).filter(x=>x.pt);
}
function clusterCellSize(zoom){
 if(zoom<=4)return 6;
 if(zoom===5)return 3.2;
 if(zoom===6)return 1.8;
 if(zoom===7)return .9;
 if(zoom===8)return .45;
 return .18;
}
function groupLoads(items){
 const size=clusterCellSize(loadMap?.getZoom?.()||5);
 const groups=new Map();
 items.forEach(x=>{
   const key=Math.floor(x.pt[0]/size)+"|"+Math.floor(x.pt[1]/size);
   if(!groups.has(key))groups.set(key,[]);
   groups.get(key).push(x);
 });
 return [...groups.values()];
}
function clusterIcon(count,strongCount){
 const hot=strongCount/Math.max(1,count)>.5;
 const bg=hot?"#18a568":"#15372a";
 const size=Math.min(58,36+Math.log2(Math.max(2,count))*6);
 return L.divIcon({
  className:"",
  html:'<div style="width:'+size+'px;height:'+size+'px;border-radius:50%;background:'+bg+';border:3px solid #fff;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:900;box-shadow:0 4px 14px rgba(0,0,0,.35)">'+count+'</div>',
  iconSize:[size,size],iconAnchor:[size/2,size/2]
 });
}
function clusterPopup(group){
 const ranked=[...group].sort((a,b)=>Number(b.load.pay||0)-Number(a.load.pay||0)).slice(0,5);
 return '<div class="mcClusterPopup"><b>'+group.length+' loads in this area</b>'+
   ranked.map(x=>{
     const e=economics(x.load,sourceProfile);
     const lane=(cityState(x.load.origin)||x.load.pickup||"Pickup")+' → '+(cityState(x.load.destination)||x.load.delivery||x.load.stop||"Delivery");
     return '<button type="button" onclick="window.MileCountOpenLoadDetails ? window.MileCountOpenLoadDetails(' + x.index + ') : (window.MileCountSelectCandidate && window.MileCountSelectCandidate(' + x.index + '))"><span>'+esc(lane)+'</span><strong>'+money(x.load.pay)+'</strong><small>'+e.label+(e.rpm?" • $"+e.rpm.toFixed(2)+"/mi":"")+'</small></button>';
   }).join("")+
   (group.length>5?'<div class="mcClusterMore">+'+(group.length-5)+' more — zoom in to separate</div>':"")+
  '</div>';
}
function renderPins(items){
 const groups=groupLoads(items);
 groups.forEach(group=>{
   if(group.length===1){
     const x=group[0],e=economics(x.load,sourceProfile);
     const marker=L.marker(x.pt,{icon:markerIcon(e.tone,x.index),riseOnHover:true}).addTo(loadMap);
     marker.bindPopup(popupHtml(x.load,x.index,sourceProfile),{maxWidth:330,minWidth:275,autoClose:false,closeOnClick:false});
     marker.on("click",e=>{
       if(e?.originalEvent)L.DomEvent.stopPropagation(e.originalEvent);
       selectedIndex=x.index;
       if(marker.closePopup)marker.closePopup();
       if(window.MileCountOpenLoadDetails)window.MileCountOpenLoadDetails(x.index);
       else if(window.MileCountSelectCandidate)window.MileCountSelectCandidate(x.index);
     });
     renderedLayers.push(marker);
   }else{
     const lat=group.reduce((s,x)=>s+x.pt[0],0)/group.length;
     const lon=group.reduce((s,x)=>s+x.pt[1],0)/group.length;
     const strong=group.filter(x=>economics(x.load,sourceProfile).tone==="strong").length;
     const marker=L.marker([lat,lon],{icon:clusterIcon(group.length,strong),riseOnHover:true}).addTo(loadMap);
     marker.bindPopup(clusterPopup(group),{maxWidth:340,minWidth:280});
     marker.on("dblclick",()=>loadMap.setView([lat,lon],Math.min(12,(loadMap.getZoom()||5)+2)));
     renderedLayers.push(marker);
   }
 });
}
function heatGroups(items){
 const zoom=loadMap?.getZoom?.()||4;
 const size=zoom<=4?5:zoom<=6?2.5:1.2;
 const m=new Map();
 items.forEach(x=>{
   const key=Math.floor(x.pt[0]/size)+"|"+Math.floor(x.pt[1]/size);
   if(!m.has(key))m.set(key,[]);
   m.get(key).push(x);
 });
 return [...m.values()];
}
function renderHeat(items){
 const groups=heatGroups(items);
 const max=Math.max(1,...groups.map(g=>g.length));
 groups.forEach(group=>{
   const lat=group.reduce((s,x)=>s+x.pt[0],0)/group.length;
   const lon=group.reduce((s,x)=>s+x.pt[1],0)/group.length;
   const avgPay=group.reduce((s,x)=>s+Number(x.load.pay||0),0)/group.length;
   const strong=group.filter(x=>economics(x.load,sourceProfile).tone==="strong").length;
   const intensity=group.length/max;
   const radius=10+Math.round(30*Math.sqrt(intensity));
   const fill=strong/group.length>=.5?"#18a568":group.length>=Math.max(3,max*.45)?"#d5a62d":"#c95757";
   const circle=L.circleMarker([lat,lon],{radius,color:fill,weight:2,fillColor:fill,fillOpacity:.28+.45*intensity,opacity:.9}).addTo(loadMap);
   circle.bindPopup('<div class="mcHeatPopup"><b>'+group.length+' loads nearby</b><div>Average pay '+money(avgPay)+'</div><div>'+strong+' strong-fit load'+(strong===1?"":"s")+'</div><div class="mcMapFine">Switch to Pins to inspect individual loads.</div></div>');
   renderedLayers.push(circle);
 });
}
function redraw(){
 const map=ensureMap(); if(!map)return; enableStateClicks(map);
 clearLayers();
 const items=preparedLoads();
 if(mapMode==="heat")renderHeat(items); else renderPins(items);
 const modeLabel=document.getElementById("loadMapModeLabel");
 if(modeLabel)modeLabel.textContent=mapMode==="heat"?"DENSITY VIEW":"CLUSTERED PINS";
 document.querySelectorAll("[data-load-map-mode]").forEach(b=>b.classList.toggle("active",b.dataset.loadMapMode===mapMode));
}
function fitItems(items){
 if(!loadMap||!items.length)return;
 const pts=items.map(x=>x.pt);
 if(pts.length===1)loadMap.setView(pts[0],8);
 else loadMap.fitBounds(pts,{padding:[32,32],maxZoom:8});
}

function visibleArea(){
 const map=ensureMap(); if(!map)return null;
 const b=map.getBounds(),c=map.getCenter();
 return {
   north:Number(b.getNorth().toFixed(5)),
   south:Number(b.getSouth().toFixed(5)),
   east:Number(b.getEast().toFixed(5)),
   west:Number(b.getWest().toFixed(5)),
   center:{lat:Number(c.lat.toFixed(5)),lon:Number(c.lng.toFixed(5))},
   zoom:map.getZoom()
 };
}
function pointInside(pt,area){
 if(!pt||!area)return true;
 const lat=Number(pt[0]),lon=Number(pt[1]);
 const latOk=lat>=Number(area.south)&&lat<=Number(area.north);
 const wraps=Number(area.west)>Number(area.east);
 const lonOk=wraps?(lon>=Number(area.west)||lon<=Number(area.east)):(lon>=Number(area.west)&&lon<=Number(area.east));
 return latOk&&lonOk;
}
const STATE_BOXES=[
 ["WA",45.5,49,-124.8,-116.9],["OR",42,46.3,-124.8,-116.4],["CA",32.4,42.1,-124.5,-114.0],["NV",35,42.1,-120.1,-114],["AZ",31.2,37.1,-114.9,-109],["UT",37,42.1,-114.1,-109],["ID",42,49.1,-117.3,-111],["MT",44.3,49.1,-116.1,-104],["WY",41,45.1,-111.1,-104],["CO",37,41.1,-109.1,-102],["NM",31.3,37.1,-109.1,-103],["TX",25.8,36.6,-106.7,-93.5],["OK",33.6,37.1,-103,-94.4],["KS",37,40.1,-102.1,-94.5],["NE",40,43.1,-104.1,-95.3],["SD",42.4,46,-104.1,-96.4],["ND",45.9,49.1,-104.1,-96.5],["MN",43.4,49.4,-97.3,-89.5],["IA",40.3,43.6,-96.7,-90.1],["MO",35.9,40.7,-95.8,-89.1],["AR",33,36.6,-94.7,-89.6],["LA",28.8,33.1,-94.1,-88.8],["WI",42.4,47.2,-92.9,-86.2],["IL",36.9,42.6,-91.6,-87.4],["MI",41.7,48.3,-90.5,-82.1],["IN",37.7,41.8,-88.1,-84.7],["OH",38.3,42.1,-84.9,-80.5],["KY",36.4,39.2,-89.6,-82],["TN",34.9,36.8,-90.4,-81.6],["MS",30.1,35.1,-91.7,-88.1],["AL",30.1,35.1,-88.5,-84.8],["GA",30.3,35.1,-85.7,-80.8],["FL",24.3,31.1,-87.7,-80],["SC",32,35.3,-83.4,-78.4],["NC",33.8,36.7,-84.4,-75.3],["VA",36.5,39.6,-83.7,-75.2],["WV",37.1,40.7,-82.7,-77.7],["MD",37.8,39.8,-79.6,-75],["PA",39.7,42.3,-80.6,-74.6],["NJ",38.8,41.4,-75.7,-73.8],["NY",40.4,45.1,-79.8,-71.8]
];
function stateAt(lat,lon){const hits=STATE_BOXES.filter(x=>lat>=x[1]&&lat<=x[2]&&lon>=x[3]&&lon<=x[4]);return hits.length?hits.sort((a,b)=>((a[2]-a[1])*(a[4]-a[3]))-((b[2]-b[1])*(b[4]-b[3])))[0][0]:null}
let stateOutlineLayer=null,selectedStateLayer=null,stateGeoLoaded=false;
const STATE_NAME_TO_ABBR={"Alabama":"AL","Alaska":"AK","Arizona":"AZ","Arkansas":"AR","California":"CA","Colorado":"CO","Connecticut":"CT","Delaware":"DE","Florida":"FL","Georgia":"GA","Hawaii":"HI","Idaho":"ID","Illinois":"IL","Indiana":"IN","Iowa":"IA","Kansas":"KS","Kentucky":"KY","Louisiana":"LA","Maine":"ME","Maryland":"MD","Massachusetts":"MA","Michigan":"MI","Minnesota":"MN","Mississippi":"MS","Missouri":"MO","Montana":"MT","Nebraska":"NE","Nevada":"NV","New Hampshire":"NH","New Jersey":"NJ","New Mexico":"NM","New York":"NY","North Carolina":"NC","North Dakota":"ND","Ohio":"OH","Oklahoma":"OK","Oregon":"OR","Pennsylvania":"PA","Rhode Island":"RI","South Carolina":"SC","South Dakota":"SD","Tennessee":"TN","Texas":"TX","Utah":"UT","Vermont":"VT","Virginia":"VA","Washington":"WA","West Virginia":"WV","Wisconsin":"WI","Wyoming":"WY"};
function stateFeatureCode(feature){
 const p=feature?.properties||{};
 const raw=String(p.STUSPS||p.postal||p.abbr||p.code||p.STATE_ABBR||"").toUpperCase();
 if(raw.length===2)return raw;
 return STATE_NAME_TO_ABBR[p.NAME||p.name]||null;
}
function selectStateOutline(code,layer){
 if(selectedStateLayer&&selectedStateLayer.setStyle)selectedStateLayer.setStyle({weight:1,fillOpacity:.04});
 selectedStateLayer=layer||null;
 if(selectedStateLayer?.setStyle)selectedStateLayer.setStyle({weight:3,fillOpacity:.20});
 const sel=document.getElementById("stateLoadBrowser");
 if(sel&&[...sel.options].some(o=>o.value===code)){sel.value=code;sel.dispatchEvent(new Event("change",{bubbles:true}))}
}
async function loadStateOutlines(map){
 if(stateGeoLoaded||!window.L)return;stateGeoLoaded=true;
 try{
   const r=await fetch("https://raw.githubusercontent.com/PublicaMundi/MappingAPI/master/data/geojson/us-states.json",{cache:"force-cache"});
   if(!r.ok)throw new Error("state boundary fetch "+r.status);
   const geo=await r.json();
   stateOutlineLayer=L.geoJSON(geo,{
     style:()=>({weight:1,opacity:.8,fillOpacity:.04}),
     onEachFeature:(feature,layer)=>{
       const code=stateFeatureCode(feature),name=feature?.properties?.name||feature?.properties?.NAME||code||"State";
       if(code)layer.bindTooltip(name,{sticky:true,direction:"top"});
       layer.on("mouseover",()=>{if(layer!==selectedStateLayer)layer.setStyle({weight:2,fillOpacity:.10})});
       layer.on("mouseout",()=>{if(layer!==selectedStateLayer)layer.setStyle({weight:1,fillOpacity:.04})});
       layer.on("click",e=>{if(e.originalEvent)L.DomEvent.stopPropagation(e.originalEvent);if(code)selectStateOutline(code,layer)});
     }
   }).addTo(map);
   if(stateOutlineLayer.bringToBack)stateOutlineLayer.bringToBack();
 }catch(e){console.warn("State outlines unavailable; using geographic fallback",e)}
}
function enableStateClicks(map){
 if(map._mileCountStateClick)return;map._mileCountStateClick=true;
 loadStateOutlines(map);
 // Fallback remains active if state polygons fail to load.
 map.on("click",e=>{const st=stateAt(e.latlng.lat,e.latlng.lng);if(!st)return;selectStateOutline(st,null)});
}
window.getMileCountVisibleArea=visibleArea;
window.MileCountLoadInArea=function(load,area){return pointInside(loadPoint(load),area)};
window.clearMileCountAreaSearch=function(){
 areaSearchActive=false;
 window.MileCountActiveMapArea=null;
 const s=document.getElementById("loadAreaStatus");
 if(s)s.textContent="Map area search off";
 const b=document.getElementById("searchMapArea");
 if(b)b.classList.remove("active");
};
window.searchMileCountVisibleArea=function(){
 const area=visibleArea(); if(!area)return;
 areaSearchActive=true;
 window.MileCountActiveMapArea=area;
 const s=document.getElementById("loadAreaStatus");
 if(s)s.textContent="Searching visible area • provider coverage varies";
 const b=document.getElementById("searchMapArea");
 if(b)b.classList.add("active");
 document.dispatchEvent(new CustomEvent("milecount:search-area",{detail:area}));
};

window.renderMileCountLoadMap=async function(loads,profile){
 const generation=++mapRenderGeneration;
 sourceLoads=Array.isArray(loads)?loads:[];
 sourceProfile=profile||{};
 const currentLoads=sourceLoads;
 const map=ensureMap(); if(!map)return;
 const total=document.getElementById("loadMapTotal");
 if(total)total.textContent=currentLoads.length+" RESULTS";
 const items=preparedLoads(),count=document.getElementById("loadMapCount");
 if(count)count.textContent=items.length+" MAPPED";
 redraw();fitItems(items);
 // A slow city lookup must not hold the load list or its controls hostage.
 if(items.length<currentLoads.length){
  hydrateMissingLoadPoints(currentLoads,generation).then(()=>{
   if(generation!==mapRenderGeneration)return;
   const mapped=preparedLoads();
   if(count)count.textContent=mapped.length+" MAPPED";
   redraw();fitItems(mapped);
  }).catch(e=>console.warn("Load map coordinates unavailable",e));
 }
 setTimeout(()=>{if(generation===mapRenderGeneration)map.invalidateSize()},100);
};

window.focusMileCountLoadMarker=function(index){
 selectedIndex=Number(index);
 const x=preparedLoads().find(m=>m.index===selectedIndex);
 if(!x||!loadMap)return;
 if(mapMode!=="pins"){mapMode="pins";redraw()}
 loadMap.setView(x.pt,Math.max(loadMap.getZoom(),8),{animate:true});
 setTimeout(()=>{
   const layers=[...renderedLayers];
   for(const layer of layers){
     if(layer.getLatLng){
       const p=layer.getLatLng();
       if(Math.abs(p.lat-x.pt[0])<.0001&&Math.abs(p.lng-x.pt[1])<.0001&&layer.openPopup){layer.openPopup();break}
     }
   }
 },180);
 const card=document.querySelector('.candidateLoad[data-load-index="'+selectedIndex+'"]');
 if(card)card.scrollIntoView({behavior:"smooth",block:"nearest"});
};
window.setMileCountLoadMapMode=function(mode){
 mapMode=mode==="heat"?"heat":"pins";
 redraw();
};
document.addEventListener("click",e=>{
 const mode=e.target.closest("[data-load-map-mode]");
 if(mode){window.setMileCountLoadMapMode(mode.dataset.loadMapMode);return}
 if(e.target.closest("#searchMapArea")){window.searchMileCountVisibleArea();return}
 if(e.target.closest("#clearMapArea")){window.clearMileCountAreaSearch();return}
});
})();
