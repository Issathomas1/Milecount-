const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),{stripTypeScriptTypes}=require('node:module');
const source=fs.readFileSync('supabase/functions/truktek-public-pilot/index.ts','utf8').replace(/^import .*;\n/m,'');
const upstream={geo:{olat:33.7627,olon:-84.4224,dlat:33.7627,dlon:-84.4224},total:12050,loads:[
 {loadId:'far',octy:'Hazleton',ost:'PA',dcty:'Westfield',dst:'MA',o2oDist:676.13,length:53,weight:43500,ratePay:1000,equip:'Van'},
 {loadId:'local-too-long',octy:'Atlanta',ost:'GA',dcty:'Griffin',dst:'GA',o2oDist:7.47,length:53,weight:8400,ratePay:250,equip:'Van'},
 {loadId:'box-outbound',octy:'Atlanta',ost:'GA',dcty:'Charlotte',dst:'NC',o2oDist:7.47,length:20,weight:6000,ratePay:900,equip:'Box Truck'},
 {loadId:'unknown-space',octy:'Newnan',ost:'GA',dcty:'Orlando',dst:'FL',o2oDist:39,length:null,weight:2000,ratePay:800,equip:'Van'},
 {loadId:'overweight',octy:'Atlanta',ost:'GA',dcty:'Griffin',dst:'GA',o2oDist:7.47,length:20,weight:38000,ratePay:800,equip:'Van'}
]};
async function run(data){let handler,url;const c={Request,Response,URLSearchParams,Map,Number,JSON,Promise,Deno:{serve:h=>handler=h},fetch:async u=>{url=u;return new Response(JSON.stringify(data),{headers:{'Content-Type':'application/json'}})}};vm.createContext(c);vm.runInContext(stripTypeScriptTypes(source,{mode:'strip'}),c);const res=await handler(new Request('https://fixture',{method:'POST',body:JSON.stringify({search_mode:'origin_board',origin:'Atlanta, GA',max_deadhead:175,space_ft:26,weight_lb:10000})}));return{res,data:await res.json(),url:new URL(url)}}
(async()=>{
 const x=await run(upstream);assert.equal(x.res.status,200);assert.equal(x.res.headers.get('Access-Control-Allow-Origin'),'*');assert.equal(x.url.searchParams.get('dcty'),'Atlanta');assert.equal(x.url.searchParams.get('dst'),'GA');assert.equal(x.url.searchParams.get('milesSlider'),'9999');assert.equal(x.url.searchParams.has('freight'),false);
 assert.deepEqual(x.data.loads.map(l=>l.provider_load_id),['box-outbound','unknown-space']);assert.equal(x.data.loads[0].equipment,'Box Truck');assert.equal(x.data.loads[0].delivery,'Charlotte, NC');assert.equal(x.data.live_found,4);
 assert.equal((await run({...upstream,geo:{olat:0,olon:0}})).res.status,502);
 const app=fs.readFileSync('app.js','utf8'),start=app.indexOf('async function fetchTrukTekLocal('),end=app.indexOf('function dedupeNormalizedLoads(',start);let request;
 const c={window:{},S:{},enforceWeightCap:x=>x,currentCapacity:()=>({maxSpace:26,maxWeight:10000}),providerJSON:async(url,options)=>{request={url,body:JSON.parse(options.body)};return x.data},console};vm.createContext(c);vm.runInContext(app.slice(start,end),c);const loads=await c.fetchTrukTekLocal('Atlanta, GA',true);assert(request.url.includes('supabase.co/functions/v1/truktek-public-pilot'));assert.equal(request.body.search_mode,'origin_board');assert.equal(loads[0].providerLoadId,'box-outbound');assert.equal(loads[0].pay,900);
 console.log('PASS browser-safe market adapter: resolved Atlanta origin, nearby pickup filter, outbound retained, exact capacity, missing fields, zero-origin rejection and provider attribution');
})().catch(e=>{console.error(e);process.exit(1)});
