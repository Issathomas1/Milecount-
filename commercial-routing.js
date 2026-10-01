/* One routing boundary. The backend owns provider credentials and qualification. */
(function(root){
'use strict';
const UNAVAILABLE='COMMERCIAL ROUTE UNAVAILABLE — GENERAL ROAD ESTIMATE ONLY';
function valhallaRequest(points,raw){
 const validation=root.MileCountTruckState.validateProfile(raw);if(!validation.ok)throw Error(validation.issues.join(' • '));const p=validation.profile;
 if(p.axleWeightLb==null)throw Error('Verified axle weight is required for experimental truck routing');
 const weight=Number(raw.currentGrossWeightLb);if(!Number.isFinite(weight)||weight<p.emptyWeightLb||weight>p.gvwrLb)throw Error('Verify current gross weight');
 const locations=points.map(p=>{if(!Number.isFinite(p.lat)||!Number.isFinite(p.lon)||Math.abs(p.lat)>90||Math.abs(p.lon)>180)throw Error('Invalid route coordinates');return {lat:p.lat,lon:p.lon,type:'break'};});
 return {locations,costing:'truck',units:'miles',costing_options:{truck:{height:p.heightFt*.3048,width:p.widthFt*.3048,length:p.vehicleLengthFt*.3048,weight:weight*.00045359237,axle_load:p.axleWeightLb*.00045359237,axle_count:p.axleCount,hazmat:p.hazmat,use_tolls:p.tollPreference==='avoid'?0:1,use_ferry:p.avoidFerries?0:1,hgv_no_access_penalty:43200,ignore_restrictions:false,ignore_access:false,ignore_oneways:false}}};
}
class Router{
 constructor({getProfile,transport,resolve,generalRoute,generalMatrix,onStatus=()=>{}}){Object.assign(this,{getProfile,transport,resolve,generalRoute,generalMatrix,onStatus});}
 async run(kind,stops,options={}){
  let failure;
  try{
   const profile=await this.getProfile(),v=root.MileCountTruckState.validateProfile(profile);if(!v.ok)throw Error(v.issues.join(' • '));
   if(!this.transport)throw Error('No commercial routing backend connected');
   const points=await this.resolve(stops),data=await this.transport({kind,points,profile,legProfiles:options.legProfiles||null});
   if(!data||data.restrictionViolations?.length)throw Error('Route violates truck restrictions');
   if(kind==='route'&&(!Array.isArray(data.legs)||data.legs.length!==stops.length-1||data.legs.some(l=>!Number.isFinite(l.distance)||l.distance<0||!Number.isFinite(l.duration)||l.duration<0)))throw Error('Commercial response lost route legs');
   if(kind==='matrix'&&(!Array.isArray(data.matrix)||data.matrix.length!==stops.length||data.matrix.some(r=>!Array.isArray(r)||r.length!==stops.length||r.some(c=>c!=null&&(!Number.isFinite(c.miles)||c.miles<0||!Number.isFinite(c.minutes)||c.minutes<0)))))throw Error('Commercial matrix is incomplete');
   const qualified=data.qualification==='commercial-validated';const result={...data,stops:[...stops],commercialVerified:qualified,routingStatus:qualified?'COMMERCIAL ROUTE':'EXPERIMENTAL TRUCK ROUTE — RESTRICTION COVERAGE UNVERIFIED',vehicleProfile:profile,source:qualified?data.source:'EXPERIMENTAL TRUCK ROUTE — RESTRICTION COVERAGE UNVERIFIED'};
   if(kind==='route'){result.miles=data.legs.reduce((n,l)=>n+l.distance/1609.344,0);result.hours=data.legs.reduce((n,l)=>n+l.duration/3600,0);result.seconds=result.hours*3600;}
   this.onStatus(result);return result;
  }catch(e){failure=e.message;}
  if(options.requireCommercial)throw Error(UNAVAILABLE+' • '+failure);
  const fallback=await (kind==='route'?this.generalRoute(stops):this.generalMatrix(stops));
  const result={...fallback,source:UNAVAILABLE,commercialVerified:false,routingStatus:UNAVAILABLE,routingFailure:failure};this.onStatus(result);return result;
 }
 route(stops,options){return this.run('route',stops,options);}
 matrix(stops,options){return this.run('matrix',stops,options);}
}
const api={Router,valhallaRequest,UNAVAILABLE};if(typeof module!=='undefined')module.exports=api;root.MileCountCommercialRouting=api;
})(typeof window!=='undefined'?window:globalThis);
