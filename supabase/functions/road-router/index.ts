import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const cors={
  "Access-Control-Allow-Origin":"*",
  "Access-Control-Allow-Headers":"authorization,apikey,content-type",
  "Access-Control-Allow-Methods":"POST,OPTIONS",
  "Content-Type":"application/json",
  "Cache-Control":"no-store"
};
const out=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:cors});
const delay=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));
async function fetchJSON(url:string,ms:number,headers:Record<string,string>={}){
  let last:unknown;
  for(let attempt=0;attempt<2;attempt++){
    try{
      const response=await fetch(url,{headers:{Accept:"application/json",...headers},signal:AbortSignal.timeout(ms)});
      if(!response.ok)throw new Error("Upstream road service returned "+response.status);
      return await response.json();
    }catch(e){
      last=e;
      if(attempt===0)await delay(250);
    }
  }
  throw last instanceof Error?last:new Error("Upstream road service unavailable");
}
function validPoint(p:any){
  return p&&Number.isFinite(Number(p.lat))&&Number.isFinite(Number(p.lon))&&Math.abs(Number(p.lat))<=90&&Math.abs(Number(p.lon))<=180;
}
Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
  if(req.method!=="POST")return out({ok:false,error:"POST required"},405);
  try{
    const text=await req.text();
    if(text.length>32768)return out({ok:false,error:"Request too large"},413);
    const input=JSON.parse(text||"{}"),kind=String(input.kind||"");
    if(kind==="geocode"){
      const query=String(input.query||"").trim();
      if(!query||query.length>160)return out({ok:false,error:"Invalid location query"},400);
      const url="https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=us&q="+encodeURIComponent(query);
      const data=await fetchJSON(url,9000,{"User-Agent":"MileCount/1.0 (mymilecount.com)"});
      return out({ok:true,data});
    }
    if(kind!=="route"&&kind!=="matrix")return out({ok:false,error:"Unknown road request"},400);
    const points=Array.isArray(input.points)?input.points:[];
    if(points.length<2||points.length>32||points.some((p:any)=>!validPoint(p)))return out({ok:false,error:"Invalid route coordinates"},400);
    const coords=points.map((p:any)=>Number(p.lon)+","+Number(p.lat)).join(";");
    const url=kind==="route"
      ?"https://router.project-osrm.org/route/v1/driving/"+coords+"?overview=full&geometries=geojson&steps=true"
      :"https://router.project-osrm.org/table/v1/driving/"+coords+"?annotations=distance,duration";
    const data=await fetchJSON(url,kind==="matrix"?20000:15000);
    if(data?.code!=="Ok")return out({ok:false,error:"No road route available"},502);
    return out({ok:true,data});
  }catch(e){
    return out({ok:false,error:e instanceof Error?e.message:"Road fallback unavailable"},502);
  }
});