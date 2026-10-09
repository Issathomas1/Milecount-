const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{stripTypeScriptTypes}=require('node:module');
const client=fs.readFileSync('loadboot.js','utf8');
const record={ref:'LB-live/123',origin:'Atlanta, GA',destination:'Macon, GA',equipment:'Box Truck',rate:'$400',miles:100,weight:'2,000'};
async function clientTests(){
 let now=Date.now(),calls=0,fail=false,response;
 const c={URLSearchParams,AbortController,setTimeout,clearTimeout,Date:class extends Date{static now(){return now}},fetch:async()=>{calls++;await Promise.resolve();if(fail)throw Error('offline');return {ok:true,json:async()=>response};}};
 vm.createContext(c);vm.runInContext(client,c);const api=c.MileCountLoadBoot;
 const result=()=>({ok:true,mode:'LIVE',sandbox:false,fetchedAt:new Date(now).toISOString(),data:{loads:[record,{...record,ref:'SBX123'},{...record,ref:'expired',expires_at:new Date(now-1).toISOString()}]}});response=result();
 const [a,b]=await Promise.all([api.search({origin:'Atlanta, GA'}),api.search({origin:'Atlanta, GA'})]);assert.equal(calls,1);assert.equal(a.length,1);assert.equal(b.length,1);assert.equal(a[0].pay,400);assert.equal(a[0].weight,2000);assert.equal(a[0].mode,'LIVE');assert.equal(a[0].isSandbox,false);assert(a[0].sourceUrl.endsWith('src=milecount-edit-all-futures-llc&ref=LB-live%2F123'));
 await api.search({origin:'Atlanta, GA'});assert.equal(calls,1);
 now+=300001;fail=true;await assert.rejects(api.search({origin:'Atlanta, GA'}),/offline/);fail=false;response={...result(),sandbox:true};await assert.rejects(api.search({origin:'Atlanta, GA'}),/not verified/);
 response={...result(),fetchedAt:new Date(now-900001).toISOString()};await assert.rejects(api.search({origin:'Atlanta, GA'}),/expired/);
 response={...result(),data:{loads:[]}};assert.equal((await api.search({origin:'Atlanta, GA'})).length,0);const n=calls;await api.search({origin:'Atlanta, GA'});assert.equal(calls,n);
}
async function serverTests(){
 let now=Date.now(),calls=0,status=200;
 const code=stripTypeScriptTypes(fs.readFileSync('supabase/functions/loadboot-sandbox/index.ts','utf8')).replace('export async function','async function');
 const c={URL,URLSearchParams,Request,Response,AbortSignal,Map,Set,Date:class extends Date{static now(){return now}},Deno:{env:{get:n=>n==='LOADBOOT_PRODUCTION_TOKEN'?'lb_fixture':null},serve:()=>{}},fetch:async(url,options)=>{calls++;assert.equal(options.headers.Authorization,'Bearer lb_fixture');assert(String(url).startsWith('https://rwscphuhpjoudvljvmdk.supabase.co/'));return new Response(JSON.stringify({loads:[record,{...record,ref:'SBX1'},{...record,ref:'old',expires_at:new Date(now-1).toISOString()}]}),{status});}};
 vm.createContext(c);vm.runInContext(code,c);
 const req=(query='',method='GET',origin='https://milecount.editallfutures.com')=>new Request('https://example.invalid/?mode=production'+query,{method,headers:{origin}});
 const r=await c.handler(req());assert.equal(r.status,200);assert.equal(r.headers.get('access-control-allow-origin'),'https://milecount.editallfutures.com');const j=await r.json();assert.equal(j.sandbox,false);assert.equal(j.data.loads.length,1);assert(!JSON.stringify(j).includes('lb_fixture'));
 await c.handler(req());assert.equal(calls,1);assert.equal((await c.handler(req('', 'POST'))).status,405);assert.equal((await c.handler(req('', 'GET','https://unrelated.invalid'))).status,403);assert.equal((await c.handler(req('&origin_state=INVALID'))).status,400);
 now+=300001;status=401;const unavailable=await c.handler(req());assert.equal(unavailable.status,502);assert.equal((await unavailable.json()).data,undefined);
 status=429;assert.equal((await c.handler(req())).status,502);assert.equal((await c.handler(req())).status,429);
}
(async()=>{await clientTests();await serverTests();console.log('PASS LoadBoot production: attribution/ref, normalization, TEST rejection, expiry, single-flight/cache, zero loads, read-only/CORS, failed refresh and rate limits');})().catch(e=>{console.error(e);process.exit(1)});
