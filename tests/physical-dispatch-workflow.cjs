const assert=require('node:assert/strict'),vm=require('node:vm'),{context}=require('./autostack-workflow.cjs'),fixtures=require('./fixtures/dispatch-cases.json');
(async()=>{
 const h=context(fixtures.cases[2]),memory=new Map(),c=h.c;for(const l of h.S.allUnifiedLoads)l.isSandbox=false;
 c.localStorage={getItem:key=>memory.get(key)||null,setItem:(key,value)=>memory.set(key,value)};
 c.window.MileCountTruckState=require('../truck-brain.js');c.window.MileCountBrainStorage=require('../brain-storage.js');
 c.fetchDirectFreightLocal=async()=>[];c.fetchTrukTekLocal=async()=>[];c.renderUnifiedLoadList=()=>{};
 await c.window.MileCountTruckBrain.initialize();
 const api=c.window.MileCountTruckBrain;
 api.setProfile({type:'box-truck',commercial:true,gvwrLb:26000,payloadLb:10000,emptyWeightLb:16000,cargoLengthFt:26,heightFt:12,widthFt:8.5,vehicleLengthFt:35,axleCount:2,axleWeightLb:13000,trailerCount:0,hazmat:false,tollPreference:'allow',avoidFerries:true});
 api.setActualState({currentLocation:fixtures.cases[2].start,onboardLoads:[]});await c.smartAutoStack();assert(h.S.stackPlan.valid,h.nodes.get('stackPlanResult').innerHTML);assert.equal(api.get().onboardLoads.length,0);const original=[...api.get().committedLoads];
 await c.finishAutoStack();await h.timers();const pickup=h.S.stackPlan.events.find(e=>e.type==='pickup');
 await api.recordEvent({eventId:'physical-pickup',type:'pickup',load:pickup.load,location:pickup.location});
 assert.equal(api.get().currentLocation,pickup.location);assert.equal(api.get().onboardLoads.length,1);assert(h.S.stackPlan.valid,h.nodes.get('stackPlanResult').innerHTML);assert.equal(h.S.stackPlan.events.filter(e=>e.type==='pickup'&&e.loadId===pickup.loadId).length,0);assert.equal(h.S.stackPlan.events.filter(e=>e.type==='drop'&&e.loadId===pickup.loadId).length,1);assert.equal(h.S.stackPlan.loads.length,original.length);
 const previous=api.get().version;await api.recordEvent({eventId:'physical-pickup',type:'pickup',load:pickup.load,location:pickup.location});assert.equal(api.get().version,previous);
 await api.recordEvent({eventId:'physical-delivery',type:'drop',load:pickup.load,location:pickup.load.delivery});
 assert.equal(api.get().onboardLoads.length,0);assert.equal(api.get().currentLocation,pickup.load.delivery);assert(!h.S.stackPlan?.events.some(e=>e.loadId===pickup.loadId));assert.equal(h.S.stackPlan.loads.length,original.length-1);
 api.configure({homeLocation:'Charlotte, NC',homeDeadline:'2026-10-02T22:00:00Z'});assert.equal(api.get().finalDestination,'Charlotte, NC');assert.equal(api.get().homeDeadline,'2026-10-02T22:00:00Z');
 console.log('PASS persistent physical state → pickup → pending delivery replan → duplicate event → capacity release → remaining commitments; exact home/deadline');
})().catch(e=>{console.error(e);process.exitCode=1;});
