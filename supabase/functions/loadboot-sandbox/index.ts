// Existing endpoint retained for sandbox compatibility; production is explicit.
const BASE = "https://rwscphuhpjoudvljvmdk.supabase.co/functions/v1/dev-api";
const SANDBOX_BASE = "https://snslhvmkjusozgjelghi.supabase.co/functions/v1/dev-api";
const ORIGINS = new Set(["https://issathomas1.github.io", "https://milecount.editallfutures.com", "https://mymilecount.com", "https://www.mymilecount.com"]);
const cache = new Map<string, {at:number; data:any}>();
const pending = new Map<string, Promise<any>>();
let retryAt = 0;
async function productionToken() {
  const env = Deno.env.get("LOADBOOT_PRODUCTION_TOKEN");
  if (env) return env;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const r = await fetch(Deno.env.get("SUPABASE_URL") + "/rest/v1/rpc/milecount_loadboot_production_token", {
    method:"POST", headers:{apikey:service, Authorization:"Bearer "+service, "Content-Type":"application/json"}, body:"{}", signal:AbortSignal.timeout(5000)
  });
  if (!r.ok) throw Error("Production credential unavailable");
  const token = await r.json();
  if (typeof token !== "string" || !token.startsWith("lb_")) throw Error("Production credential unavailable");
  return token;
}
export async function handler(req:Request) {
  const origin=req.headers.get("origin")||"";
  const headers:Record<string,string>={"Content-Type":"application/json","Cache-Control":"no-store","Vary":"Origin","Access-Control-Allow-Headers":"authorization,content-type,apikey","Access-Control-Allow-Methods":"GET,OPTIONS"};
  if(ORIGINS.has(origin))headers["Access-Control-Allow-Origin"]=origin;
  const reply=(body:any,status=200)=>new Response(JSON.stringify(body),{status,headers});
  if(origin&&!ORIGINS.has(origin))return reply({ok:false,error:"Origin not allowed"},403);
  if(req.method==="OPTIONS")return new Response(null,{status:204,headers});
  if(req.method!=="GET")return reply({ok:false,error:"Read-only endpoint"},405);
  const u=new URL(req.url),production=u.searchParams.get("mode")==="production";
  const params=new URLSearchParams({resource:"loads",limit:"50"});
  for(const name of ["origin_state","dest_state"]){const value=u.searchParams.get(name);if(value){if(!/^[A-Z]{2}$/.test(value))return reply({ok:false,error:"Invalid state"},400);params.set(name,value);}}
  const equipment=u.searchParams.get("equipment");if(equipment){if(equipment.length>60)return reply({ok:false,error:"Invalid equipment"},400);params.set("equipment",equipment);}
  const key=(production?"production:":"sandbox:")+params;
  try{
    let entry=cache.get(key);
    if(!entry||Date.now()-entry.at>=300000){
      if(Date.now()<retryAt)return reply({ok:false,error:"LoadBoot rate limited; retry shortly"},429);
      let job=pending.get(key);
      if(!job){job=(async()=>{
        const token=production?await productionToken():Deno.env.get("LOADBOOT_SANDBOX_TOKEN");
        if(!token)throw Error("Sandbox credential unavailable");
        const r=await fetch((production?BASE:SANDBOX_BASE)+"?"+params,{headers:{Authorization:"Bearer "+token,Accept:"application/json"},signal:AbortSignal.timeout(8000)});
        if(r.status===429){retryAt=Date.now()+Math.max(1,Number(r.headers.get("Retry-After"))||60)*1000;throw Error("LoadBoot rate limited");}
        if(!r.ok)throw Error("LoadBoot returned HTTP "+r.status);
        const data=await r.json();
        if(data.ok===false||data.error)throw Error("LoadBoot could not return loads");
        if(production&&(data.sandbox===true||data.mode==="sandbox"))throw Error("Production returned sandbox data");
        const rows=Array.isArray(data)?data:data.loads??data.data?.loads??data.data;
        if(!Array.isArray(rows))throw Error("Unexpected LoadBoot response");
        const loads=rows.filter((x:any)=>x.ref&&(!production||(!/^SBX/i.test(x.ref)&&x.isSandbox!==true&&x.sandbox!==true)))
          .map((x:any)=>({ref:x.ref,origin:x.origin,destination:x.destination,equipment:x.equipment,miles:x.miles,rate:x.rate,rpm:x.rpm,pickup_date:x.pickup_date,posted:x.posted,expires_at:x.expires_at,commodity:x.commodity,weight:x.weight,posted_by:x.posted_by,url:"https://loadboot.com/app/carrier/?src=milecount-edit-all-futures-llc&ref="+encodeURIComponent(x.ref)}));
        const value={at:Date.now(),data:{loads}};if(cache.size>=128)cache.delete(cache.keys().next().value!);cache.set(key,value);return value;
      })().finally(()=>pending.delete(key));pending.set(key,job);}
      entry=await job;
    }
    const loads=entry!.data.loads.filter((x:any)=>!x.expires_at||Date.parse(x.expires_at)>Date.now());
    return reply({ok:true,provider:"LoadBoot",sandbox:!production,mode:production?"LIVE":"TEST",fetchedAt:new Date(entry!.at).toISOString(),data:{loads}});
  }catch(e){cache.delete(key);return reply({ok:false,provider:"LoadBoot",sandbox:!production,error:e instanceof Error?e.message:"LoadBoot unavailable"},502);}
}
Deno.serve(handler);
