const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{context}=require('./autostack-workflow.cjs'),fixtures=require('./fixtures/dispatch-cases.json');
const source=fs.readFileSync('app.js','utf8'),slice=(a,b)=>source.slice(source.indexOf(a),source.indexOf(b,source.indexOf(a)));
function node(value=''){return {value,textContent:'',disabled:false};}
(async()=>{
 for(const empty of [false,true]){
  const live={id:'live',provider:'QA',pickup:'Atlanta, GA',delivery:'Newnan, GA',pay:200},sim={...live,id:'sim',isLocalSim:true,pay:900},test={...live,id:'test',mode:'TEST',pay:1000};
  let demos=0,optimized=0;const nodes={from:node('Atlanta, GA'),localMoneyMode:node(),localMoneyStatus:node()};
  const c={equipment:require('../equipment-fit'),geo:require('../trip-opportunities'),S:{},captureCapacityInputs(){},escHtml:x=>x,editableStackLoads:()=>[],el:id=>nodes[id],navigator:{},console,Promise,Set,Map,setTimeout:()=>{},isRoutableLocation:()=>true,fetchTrukTekLocal:async()=>empty?[]:[live,sim,test,{...live,id:"wrong-equipment",equipment:"Flatbed",pay:12000},{...live,id:"long-haul",delivery:"Miami, FL",pay:9000},{...live,id:"near-border",pickup:"Savannah, GA",delivery:"Hardeeville, SC",pay:5000},{...live,id:"outside-pickup",pickup:"Chattanooga, TN",delivery:"Newnan, GA",pay:3000},{...live,id:"unknown-drop",delivery:"Unknown",pay:6000}],fetchDirectFreightLocal:async()=>[],fetchLoadBootSandbox:()=>{demos++;return[];},localSimPool:()=>{demos++;return[sim];},enforceWeightCap:x=>x,dedupeNormalizedLoads:x=>x,renderUnifiedLoadList(){},showScreen(){},updateStackTray(){},invalidateStackProjection(){},currentPlan:()=>({maxStack:5}),getMileCountRoadRoute:async stops=>({miles:stops.includes("Miami, FL")?1000:10,hours:stops.includes("Miami, FL")?20:1,legs:[{distance:1609.344}]}),roadMilesBetween:async()=>5,withTimeout:p=>p,fuelFor:()=>({fuelCost:2}),smartAutoStack:async()=>optimized++,loadKey:l=>l.id};
  vm.createContext(c);vm.runInContext('let physicalBrain=null;const window={MileCountEquipment:equipment,MileCountTripOpportunities:geo};let tripBrowseGeneration=0,loadSearchGeneration=0;const selectedStackKeys=new Set();'+slice('function clearTripOpportunityBrowse(','function renderHomeboundSimulations(')+slice('function isPlanningTestLoad(','function editableStackLoads(')+slice('function resetLocalDaySelection(','async function browseStateLoads('),c);
  await c.buildLocalMoneyDay();assert.equal(demos,0);assert.equal(c.S.allUnifiedLoads.length,empty?0:2);assert.deepEqual(Array.from(vm.runInContext("[...selectedStackKeys]",c)),empty?[]:["live"]);assert.equal(optimized,empty?0:1);assert.equal(nodes.localMoneyMode.disabled,false);if(empty)assert.match(nodes.localMoneyStatus.textContent,/No live/);
 }
 const h=context(fixtures.cases[2]);for(const l of h.S.allUnifiedLoads)l.isSandbox=false;h.S.allUnifiedLoads[0].isLocalSim=true;
 vm.runInContext('let stackSelectionRevision=0;'+slice('function isPlanningTestLoad(','function normalizeTripLocation('),h.c);h.c.document.querySelectorAll=()=>[];
 await h.c.smartAutoStack();assert.match(h.nodes.get('stackPlanResult').innerHTML,/LIVE and TEST\/SIM/);
 await h.c.removeStackLoads([h.c.loadKey(h.S.basePlanLoad)]);await h.timers();assert.equal(h.S.basePlanLoad,null);assert(h.S.stackPlan.valid);assert.equal(h.S.stackPlan.loads.length,2);assert(!h.S.stackPlan.loads.some(l=>l.isLocalSim));assert.deepEqual(h.maps(),Array.from(h.S.stackPlan.routeStops));

 // Reproduce an automatically picked oversized load retained in planCommitments.
 function repairHarness(){
  const h=context(fixtures.cases[2]);h.S.allUnifiedLoads.forEach(l=>l.isSandbox=false);
  h.S.planCommitments=[...h.S.allUnifiedLoads];h.c.document.querySelectorAll=()=>[];
  h.c.window.dispatchEvent=()=>{};h.c.CustomEvent=class{};
  for(const id of ['stackCount','stackSelectedPay','stackTray'])h.nodes.set(id,{textContent:'',classList:{toggle(){}}});
  vm.runInContext('let stackSelectionRevision=0;'+slice('function isPlanningTestLoad(','function normalizeTripLocation(')+slice('function updateStackTray(','function toggleStackLoad(')+slice('function resetLocalDaySelection(','let localDayBuildSeq='),h.c);
  return h;
 }
 const auto=repairHarness(),bad=auto.S.allUnifiedLoads[1];bad.weight=auto.c.currentCapacity().maxWeight+1;
 await auto.c.smartAutoStack({automatic:true});
 assert(auto.S.stackPlan?.valid,auto.nodes.get('stackPlanResult').innerHTML);
 assert(!auto.S.stackPlan.loads.some(l=>l.name===bad.name));
 assert(!auto.S.planCommitments.some(l=>l.name===bad.name));
 assert.equal(auto.nodes.get('stackCount').textContent,auto.c.editableStackLoads().length);
 assert.equal(auto.nodes.get('stackSelectedPay').textContent,auto.c.money(auto.S.stackPlan.totalPay));
 assert.match(auto.nodes.get('stackPlanResult').innerHTML,/AUTOSTACK ADJUSTED/);
 console.log('AUTO REPAIR EXAMPLE '+JSON.stringify({removed:bad.pickup+' → '+bad.delivery,order:auto.S.stackPlan.events.map(e=>e.type+' '+e.location),miles:auto.S.stackPlan.miles,pay:auto.S.stackPlan.totalPay}));
 await auto.c.smartAutoStack();assert(!auto.S.stackPlan.loads.some(l=>l.name===bad.name));
 const protectedCase=repairHarness();protectedCase.S.allUnifiedLoads[1].weight=99999;protectedCase.S.allUnifiedLoads[1].committed=true;
 await protectedCase.c.smartAutoStack({automatic:true});assert.equal(protectedCase.S.stackPlan,null);
 assert(protectedCase.c.editableStackLoads().some(l=>l.weight===99999));
 assert.match(protectedCase.nodes.get('stackPlanResult').innerHTML,/exceeding the truck/);
 const fresh=repairHarness();fresh.S.allUnifiedLoads[1].committed=true;
 fresh.c.resetLocalDaySelection();fresh.c.updateStackTray();
 assert.equal(fresh.S.basePlanLoad,null);assert.equal(fresh.c.editableStackLoads().length,1);
 assert.equal(fresh.c.editableStackLoads()[0].name,fresh.S.allUnifiedLoads[1].name);
 console.log('PASS automatic infeasible stack → atomic removal → valid route, matching count/pay, no restored stale load; confirmed commitments protected; fresh Local Day discards old tentative base');
 const multi=context(fixtures.cases[1]);multi.S.localMoneyMode=true;for(const l of multi.S.allUnifiedLoads){l.isSandbox=false;l.weight=null;l.space=0;}
 await multi.c.smartAutoStack();assert(multi.S.stackPlan.valid,multi.nodes.get('stackPlanResult').innerHTML);assert.equal(multi.S.stackPlan.timingVerified,false);assert.equal(multi.S.stackPlan.capacityVerified,false);assert(multi.S.stackPlan.drive>600);assert(multi.nodes.get('stackPlanResult').innerHTML.includes('REST SCHEDULE NOT VERIFIED'));
 await multi.c.finishAutoStack();await multi.timers();assert.deepEqual(multi.maps(),Array.from(multi.S.stackPlan.routeStops));assert(multi.nodes.get('routeSource').textContent.includes('TIMING NOT VERIFIED'));
 console.log('PASS impossible local-day schedule → explicit multi-day preview → all selected loads retained → finalized map');
 // A stalled router must release the busy state and never publish a late plan.
 const timeout=context(fixtures.cases[0]);let releaseRoad;const busy=[];
 timeout.c.setTimeout=setTimeout;timeout.c.clearTimeout=clearTimeout;timeout.c.console={error(){}};
 timeout.c.setBusy=value=>busy.push(value);timeout.c.getMileCountRoadMatrix=()=>new Promise(r=>releaseRoad=r);
 vm.runInContext(slice('function withTimeout(','async function providerJSON('),timeout.c);
 await timeout.c.smartAutoStack({automatic:true,deadline:Date.now()+20});
 assert.deepEqual(busy,[true,false]);assert.equal(timeout.S.stackPlan,null);
 assert.match(timeout.nodes.get('stackPlanResult').innerHTML,/took too long/);
 assert.equal(timeout.c.stackSelectedLoads().length,4);
 releaseRoad({matrix:[]});await Promise.resolve();assert.equal(timeout.S.stackPlan,null);
 // A newer search also cancels a local optimization that is awaiting roads.
 const cancelled=context(fixtures.cases[0]);let started,release;let active=true;
 const began=new Promise(r=>started=r);cancelled.c.getMileCountRoadMatrix=()=>{started();return new Promise(r=>release=r);};
 const building=cancelled.c.smartAutoStack({automatic:true,isCurrent:()=>active});await began;active=false;release({matrix:[]});await building;
 assert.equal(cancelled.S.stackPlan,null);
 console.log('PASS local routing deadline releases controls, retains selections, ignores late road response; superseded local optimization cannot publish');
 console.log('PASS Local Day excludes injected TEST/SIM, never queries demo sources, handles zero live loads, and removes a mixed-mode base load before rebuilding map/economics');
})().catch(e=>{console.error(e);process.exitCode=1;});
