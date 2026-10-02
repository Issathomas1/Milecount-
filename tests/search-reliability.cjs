const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const app=fs.readFileSync('app.js','utf8'),client=fs.readFileSync('direct-freight.js','utf8');
const chunk=(a,b)=>app.slice(app.indexOf(a),app.indexOf(b,app.indexOf(a)));
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {resolve,promise}};
const never=()=>new Promise(()=>{});
const fastTimer=(fn,ms)=>setTimeout(fn,Math.min(ms,30));
function context(){
 const c={console:{warn(){}},setTimeout:fastTimer,clearTimeout,AbortController,Map,Promise,Date,window:{},S:{},loadSearchGeneration:0,tripBrowseGeneration:0,
  el:()=>null,val:(id,f)=>f,clearTripOpportunityBrowse(){},captureCapacityInputs(){},setBoardStatus(kind,text){c.status={kind,text}},syncOwnerAccess:async()=>{},updateStackTray(){},applyVehicle(){},updateCostUI:()=>({target:2,breakEven:1}),activeVehicle:{cargoLength:26,payload:9999},
  fetchDirectFreightLocal:async()=>[],fetchTrukTekLocal:async()=>[],fetchLoadBootSandbox:async()=>[],enforceWeightCap:x=>x,laneMatches:()=>true,pickupDateMatches:()=>true,updateProviderFilterOptions(){},filteredUnifiedLoads:x=>x,
  roadMilesBetween:async()=>20,fuelFor:m=>({fuelCost:m/2,gallons:m/8,dieselPrice:4,source:'TEST'}),loadEconomics:l=>({deadhead:l.deadheadMiles||0,rpm:l.pay/((l.loadedMiles||0)+(l.deadheadMiles||0))}),qualityScore:l=>l.pay,
  renderUnifiedLoadList(x){c.rendered=x},showScreen(n){c.screen=n},providerJSON:async()=>({loads:[]})};
 vm.createContext(c);vm.runInContext(chunk('function withTimeout(','async function providerJSON(')+chunk('async function forEachConcurrent(','let loadSearchGeneration=')+chunk('async function findMoney(','function selectCandidate('),c);return c;
}
const load=id=>({name:id,provider_load_id:id,pickup:'Atlanta, GA',delivery:'Charlotte, NC',pay:500,loadedMiles:100,weight:1000,space:4,equipment:'Box Truck',map_lat:33.75,map_lon:-84.39});
(async()=>{
 // Deadline includes authentication, response headers, and response body.
 for(const phase of ['auth','headers','body']){
  let calls=0,signal;const c={window:{MileCountCloud:{session:()=>phase==='auth'?never():Promise.resolve({access_token:'fixture'})}},AbortController,setTimeout:fastTimer,clearTimeout,fetch:async(_,opts)=>{calls++;signal=opts.signal;return phase==='headers'?never():{ok:true,json:never}}};
  vm.createContext(c);vm.runInContext(client,c);await assert.rejects(c.window.MileCountDirectFreight.status(),/timed out/);if(phase==='auth')assert.equal(calls,0);else assert(signal.aborted);
 }
 const transport={AbortController,setTimeout:fastTimer,clearTimeout,fetch:async()=>({ok:true,json:never})};vm.createContext(transport);vm.runInContext(chunk('async function providerJSON(','async function forEachConcurrent('),transport);await assert.rejects(transport.providerJSON('fixture'),/timed out/);
 console.log('PASS provider auth/headers/body deadlines terminate stalled requests');
 // A failure in either source leaves the other source visible, attributed correctly.
 for(const broken of ['Direct Freight','TrukTek']){
  const c=context();c.providerJSON=async()=>{if(broken==='TrukTek')throw Error('offline');return {loads:[load('truck')]}};
  c.fetchDirectFreightLocal=async()=>{if(broken==='Direct Freight')throw Error('offline');return [{...load('direct'),provider:'Direct Freight',providerLoadId:'direct'}]};
  await c.findMoney();assert.equal(c.rendered.length,1);assert.equal(c.rendered[0].provider,broken==='TrukTek'?'Direct Freight':'TrukTek');assert(c.status.text.includes(broken));
  if(broken==='Direct Freight'){assert.equal(c.rendered[0].equipment,'Box Truck');assert.equal(c.rendered[0].map_lat,33.75)}
 }
 console.log('PASS either provider outage preserves the other provider and source fields');
 const nearby=context();nearby.fetchTrukTekLocal=async()=>[{...load('nearby'),provider:'TrukTek',providerLoadId:'nearby'}];await nearby.findMoney();assert.equal(nearby.rendered.length,1);assert(nearby.status.text.includes('nearby alternatives'));
 console.log('PASS empty lane discovers clearly labeled nearby alternatives');
 // A large board cannot wait indefinitely for routing; unknown costs stay unknown.
 const c=context(),road=deferred();c.roadMilesBetween=()=>road.promise;c.providerJSON=async()=>({loads:Array.from({length:100},(_,i)=>load(String(i)))});
 await c.findMoney();assert.equal(c.rendered.length,100);assert(c.rendered.every(l=>l.economicsPending&&!l.fuel));const snapshot=JSON.stringify(c.rendered);road.resolve(20);await new Promise(r=>setTimeout(r,5));assert.equal(JSON.stringify(c.rendered),snapshot);
 console.log('PASS 100 loads remain visible on road timeout; late estimates cannot mutate results');
 // An old automatic search must not replace the driver's new lane.
 const race=context(),old=deferred();let calls=0;race.providerJSON=()=>++calls===1?old.promise:Promise.resolve({loads:[load('new')]});const first=race.findMoney({liveBrowse:true,stayHome:true});await race.findMoney({liveBrowse:false});old.resolve({loads:[load('old')]});await first;assert.equal(race.rendered[0].name,'new • TrukTek');assert.equal(race.screen,2);
 const refresh=context(),sandbox=deferred();refresh.fetchLoadBootSandbox=()=>sandbox.promise;refresh.loadSearchGeneration=1;refresh.S.liveBoardLoads=[load('old')];vm.runInContext(chunk('async function refreshUnifiedFreightBoard(','async function showLoadBootSandbox('),refresh);const pending=refresh.refreshUnifiedFreightBoard(false,1);refresh.loadSearchGeneration=2;refresh.rendered=[load('new')];sandbox.resolve([]);await pending;assert.equal(refresh.rendered[0].name,'new');
 console.log('PASS stale background search and sandbox refresh cannot overwrite newer results');
 // The automatic browse must never write temporary defaults into form controls.
 const browse=context(),nodes=Object.fromEntries(['to','pay','maxDeadhead','minRPM','pickupDate','space','weight'].map(k=>[k,{value:'driver-'+k}])) ;browse.el=id=>nodes[id];browse.setBusy=()=>{};browse.setButtonBusy=()=>{};browse.findMoney=async()=>{browse.loadSearchGeneration++;nodes.to.value='New Orleans, LA'};browse.refreshUnifiedFreightBoard=async()=>{};vm.runInContext(chunk('async function browseLiveLoadBoard(','bind("applyTripHome"'),browse);await browse.browseLiveLoadBoard(true);assert.equal(nodes.to.value,'New Orleans, LA');assert.equal(nodes.pay.value,'driver-pay');
 console.log('PASS background browse preserves driver edits and form values');
})().catch(e=>{console.error(e);process.exit(1)});
