const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{context}=require('./autostack-workflow.cjs'),fixtures=require('./fixtures/dispatch-cases.json');
const source=fs.readFileSync('app.js','utf8'),slice=(a,b)=>source.slice(source.indexOf(a),source.indexOf(b,source.indexOf(a)));
function node(value=''){return {value,textContent:'',disabled:false};}
(async()=>{
 for(const empty of [false,true]){
  const live={id:'live',provider:'QA',pickup:'Atlanta, GA',delivery:'Newnan, GA',pay:200},sim={...live,id:'sim',isLocalSim:true,pay:900},test={...live,id:'test',mode:'TEST',pay:1000};
  let demos=0,optimized=0;const nodes={from:node('Atlanta, GA'),localMoneyMode:node(),localMoneyStatus:node()};
  const c={S:{},el:id=>nodes[id],navigator:{},console,Promise,Set,Map,setTimeout:()=>{},isRoutableLocation:()=>true,fetchTrukTekLocal:async()=>empty?[]:[live,sim,test],fetchDirectFreightLocal:async()=>[],fetchLoadBootSandbox:()=>{demos++;return[];},localSimPool:()=>{demos++;return[sim];},enforceWeightCap:x=>x,dedupeNormalizedLoads:x=>x,renderUnifiedLoadList(){},showScreen(){},updateStackTray(){},invalidateStackProjection(){},currentPlan:()=>({maxStack:5}),roadMilesBetween:async()=>5,withTimeout:p=>p,fuelFor:()=>({fuelCost:2}),smartAutoStack:async()=>optimized++,loadKey:l=>l.id};
  vm.createContext(c);vm.runInContext('const selectedStackKeys=new Set();'+slice('function isPlanningTestLoad(','function editableStackLoads(')+slice('let localDayBuildSeq=','async function browseStateLoads('),c);
  await c.buildLocalMoneyDay();assert.equal(demos,0);assert.equal(c.S.allUnifiedLoads.length,empty?0:1);assert.equal(optimized,empty?0:1);assert.equal(nodes.localMoneyMode.disabled,false);if(empty)assert.match(nodes.localMoneyStatus.textContent,/No LIVE/);
 }
 const h=context(fixtures.cases[2]);for(const l of h.S.allUnifiedLoads)l.isSandbox=false;h.S.allUnifiedLoads[0].isLocalSim=true;
 vm.runInContext('let stackSelectionRevision=0;'+slice('function isPlanningTestLoad(','function normalizeTripLocation('),h.c);h.c.document.querySelectorAll=()=>[];
 await h.c.smartAutoStack();assert.match(h.nodes.get('stackPlanResult').innerHTML,/LIVE and TEST\/SIM/);
 await h.c.removeStackLoads([h.c.loadKey(h.S.basePlanLoad)]);await h.timers();assert.equal(h.S.basePlanLoad,null);assert(h.S.stackPlan.valid);assert.equal(h.S.stackPlan.loads.length,2);assert(!h.S.stackPlan.loads.some(l=>l.isLocalSim));assert.deepEqual(h.maps(),Array.from(h.S.stackPlan.routeStops));
 console.log('PASS Local Day excludes injected TEST/SIM, never queries demo sources, handles zero live loads, and removes a mixed-mode base load before rebuilding map/economics');
})().catch(e=>{console.error(e);process.exitCode=1;});
