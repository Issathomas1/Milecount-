// Evaluation adapter. Never reports commercially validated coverage.
// Deploy only with a private, authenticated Valhalla instance and quota controls.
// Native fetch keeps authentication server-side without an unpinned remote SDK.
// Shared browser/server serializer, with no provider secrets.
import '../../../truck-brain.js';
import '../../../commercial-routing.js';
const cors={'Access-Control-Allow-Origin':Deno.env.get('MILECOUNT_APP_ORIGIN')||'https://issathomas1.github.io','Access-Control-Allow-Headers':'authorization,apikey,content-type','Access-Control-Allow-Methods':'POST,OPTIONS'};
const json=(value:unknown,status=200)=>new Response(JSON.stringify(value),{status,headers:{...cors,'Content-Type':'application/json'}});
const fetchJSON=async(url:string,body:unknown)=>{const response=await fetch(url,{method:'POST',signal:AbortSignal.timeout(20000),headers:{'Content-Type':'application/json','Authorization':'Bearer '+Deno.env.get('VALHALLA_PRIVATE_TOKEN')},body:JSON.stringify(body)});if(!response.ok)throw Error('Truck routing backend unavailable');return response.json();};
function decode(shape:string){let at=0,lat=0,lon=0;const coordinates:number[][]=[];const next=()=>{let value=0,shift=0,b;do{if(at>=shape.length||shift>30)throw Error('Invalid route geometry');b=shape.charCodeAt(at++)-63;value|=(b&31)<<shift;shift+=5;}while(b>=32);return value&1?~(value>>1):value>>1;};while(at<shape.length){lat+=next();lon+=next();coordinates.push([lon/1e6,lat/1e6]);}return coordinates;}
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response('',{headers:cors});
 if(req.method!=='POST')return json({error:'POST required'},405);
 try{
  if(Number(req.headers.get('content-length')||0)>32768)return json({error:'Request too large'},413);
  const apiUrl=Deno.env.get('SUPABASE_URL')!,anonKey=Deno.env.get('SUPABASE_ANON_KEY')!,authorization=req.headers.get('Authorization')||'';
  const authResponse=await fetch(apiUrl+'/auth/v1/user',{headers:{apikey:anonKey,Authorization:authorization},signal:AbortSignal.timeout(10000)});
  if(!authResponse.ok)return json({error:'Sign in first'},401);const user=await authResponse.json();if(!user?.id)return json({error:'Sign in first'},401);
  const entitlementResponse=await fetch(apiUrl+'/rest/v1/rpc/milecount_entitlements',{method:'POST',headers:{apikey:anonKey,Authorization:authorization,'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(10000)});
  const entitlement=entitlementResponse.ok?await entitlementResponse.json():null;if(!entitlement?.commercialRouting)return json({error:'Commercial routing entitlement is unavailable'},403);
  const backend=Deno.env.get('VALHALLA_PRIVATE_URL'),token=Deno.env.get('VALHALLA_PRIVATE_TOKEN');if(!backend||!token)return json({error:'Commercial routing backend is not configured'},503);
  const text=await req.text();if(text.length>32768)return json({error:'Request too large'},413);
  const input=JSON.parse(text),{kind,points,profile,legProfiles}=input;
  if(!['route','matrix'].includes(kind)||!Array.isArray(points)||points.length<2||points.length>32)throw Error('Invalid route request');
  const api=(globalThis as any).MileCountCommercialRouting;
  const quota=Number(Deno.env.get('COMMERCIAL_ROUTE_UNITS_PER_HOUR')||'0');
  if(!Number.isInteger(quota)||quota<1)return json({error:'Routing quota has not been configured'},503);
  const serverKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const quotaResponse=await fetch(apiUrl+'/rest/v1/rpc/reserve_commercial_route',{method:'POST',headers:{apikey:serverKey,Authorization:'Bearer '+serverKey,'Content-Type':'application/json'},body:JSON.stringify({p_user:user.id,p_units:kind==='matrix'?points.length**2:points.length-1,p_limit:quota}),signal:AbortSignal.timeout(10000)});
  if(!quotaResponse.ok||await quotaResponse.json()!==true)return json({error:'Routing quota reached or unavailable; try later'},429);
  // Matrix is conservative at GVWR. Final route validates exact per-leg load state.
  const matrixProfile={...profile,currentGrossWeightLb:profile.gvwrLb};
  const options=api.valhallaRequest(points,kind==='matrix'?matrixProfile:profile);
  const metadata={qualification:'experimental',source:'MileCount self-hosted Valhalla • OSM restriction coverage unverified',datasetVersion:Deno.env.get('VALHALLA_DATASET_VERSION')||'unknown',resolvedLocations:points};
  if(kind==='matrix'){
   const result=await fetchJSON(backend+'/sources_to_targets',{...options,sources:options.locations,targets:options.locations});
   if(!Array.isArray(result.sources_to_targets))throw Error('Truck matrix unavailable');
   return json({...metadata,matrix:result.sources_to_targets.map((row:any[])=>row.map(cell=>cell.distance==null||cell.time==null?null:{miles:cell.distance,minutes:cell.time/60}))});
  }
  if(!Array.isArray(legProfiles)||legProfiles.length!==points.length-1)throw Error('Exact per-leg truck state is required');
  const legs:any[]=[],coordinates:number[][]=[];
  // Bounded sequential calls prevent a single stack from flooding the router.
  for(let i=0;i<points.length-1;i++){
   const legProfile={...profile,currentGrossWeightLb:legProfiles[i].currentGrossWeightLb};
   if(legProfile.heightFt!==profile.heightFt||legProfile.widthFt!==profile.widthFt||legProfile.vehicleLengthFt!==profile.vehicleLengthFt)throw Error('Vehicle dimensions changed inside route');
   const body=api.valhallaRequest(points.slice(i,i+2),legProfile),result=await fetchJSON(backend+'/route',body);
   if(result.trip?.status!==0||result.trip.legs?.length!==1)throw Error('Commercial leg unavailable');
   const leg=result.trip.legs[0];legs.push({distance:leg.summary.length*1609.344,duration:leg.summary.time,maneuvers:leg.maneuvers});
   const shape=decode(leg.shape);coordinates.push(...(i?shape.slice(1):shape));
  }
  return json({...metadata,legs,geometry:{type:'LineString',coordinates}});
 }catch(e){return json({error:e instanceof Error?e.message:'Commercial routing failed'},422);}
});
