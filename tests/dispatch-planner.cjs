const assert=require('node:assert/strict'),routes=require('../pickup-delivery'),planner=require('../dispatch-planner'),{Inventory}=require('../provider-inventory');require('../truck-brain');
const load=(id,pickup,delivery,pay=100,weight=1,space=1)=>({id,provider:'Authorized fixture',mode:'LIVE',pickup,delivery,pay,weight,space,services:{pickup:0,drop:0}});
const build=(loads,points,start='TX',home='GA',capacity=3)=>{const p=routes.problem({loads,truck:{currentLocation:start,payload:capacity,cargoCapacity:capacity,onboardLoads:[]},finalDestination:home,startMinutes:0,fuelCostPerMile:1});p.matrix=p.locations.map(a=>p.locations.map(b=>({miles:Math.abs(points[a]-points[b]),minutes:Math.abs(points[a]-points[b])})));return p;};
const economic={mpg:4,fuelPrice:4,maintenanceCPM:0,guardrails:{}};
(async()=>{
 const p=build([load('A','TX','LA',150),load('B','LA','MS',150),load('C','MS','AL',150),load('D','AL','GA',150)],{TX:0,LA:100,MS:200,AL:300,GA:400});
 const r=planner.recommend(p,{mode:'homebound',maxAddedLoads:4,economics:economic});assert(r.ok);assert.equal(r.choices[0].added.length,4);assert.equal(r.choices[0].plan.deadhead,0);assert.equal(r.choices[0].plan.miles,400);assert.equal(r.choices[0].review.metrics.afterGas,200);assert.deepEqual(r.choices[0].plan.events.filter(e=>e.type==='drop').map(e=>e.location),['LA','MS','AL','GA']);
 console.log('PASS Texas → Louisiana → Mississippi → Alabama → Georgia paid multi-hop route; capacity and full-plan economics');
 const reverse=build([load('bad','MS','TX',900)],{TX:0,MS:200,GA:400},'MS');assert.equal(planner.recommend(reverse,{mode:'homebound',economics:economic}).choices.length,0);
 const noFreight=planner.recommend(build([],{TX:0,GA:400}),{mode:'homebound',economics:economic});assert.equal(noFreight.message,'No profitable live freight found along remaining corridor.');assert.equal(noFreight.remainingEmptyMiles,400);
 const economicChoice=build([load('gross','TX','FAR',900),load('net','TX','NEAR',650)],{TX:0,GA:400,FAR:900,NEAR:200});const best=planner.recommend(economicChoice,{economics:economic,maxAddedLoads:1}).choices[0];assert.equal(best.added[0].id,'net|Authorized fixture');
 console.log('PASS away-from-home rejection, exact empty miles on no result and net economics beat highest gross');
 const guarded=planner.recommend(p,{economics:{...economic,guardrails:{maxDeadhead:0,minRPM:5}},maxAddedLoads:4});assert.equal(guarded.choices.length,0);
 let calls=0,fail=false,now=100;const inventory=new Inventory([{id:'a',name:'A',search:async()=>{calls++;if(fail)throw Error('offline');return [load('x','TX','LA')];}}],{now:()=>now,ttlMs:10});const [one,two]=await Promise.all([inventory.search({origin:'TX'}),inventory.search({origin:'TX'})]);assert.equal(calls,1);assert.equal(one.providers[0].status,'ok');now+=11;fail=true;const stale=await inventory.search({origin:'TX'});assert.equal(stale.providers[0].status,'stale');assert.equal(stale.loads[0].dataFreshness,'stale');assert.equal(stale.complete,false);
 const empty=await new Inventory([{id:'b',name:'B',search:async()=>[]}]).search({});assert.equal(empty.providers[0].status,'empty');
 const mixed=await new Inventory([{id:'bad',name:'Bad',search:async()=>[{...load('sim','TX','LA'),mode:'SIM'}]}]).search({});assert.equal(mixed.providers[0].status,'error');assert.equal(mixed.loads.length,0);
 console.log('PASS profit guardrails, provider single-flight/cache, outage preservation and empty/error separation');
})().catch(e=>{console.error(e);process.exitCode=1;});
