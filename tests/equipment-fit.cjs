const assert=require('node:assert/strict'),fit=require('../equipment-fit'),{context}=require('./autostack-workflow.cjs'),fixtures=require('./fixtures/dispatch-cases.json');
for(const equipment of ['Flatbed','Reefer','F,SD','refrigerated'])assert.equal(fit.check({equipment},'box26').status,'incompatible');
for(const equipment of ['', 'V','Van','F,V','53 foot trailer'])assert.equal(fit.check({equipment},'box26').status,'unknown');
assert.equal(fit.check({equipment:'Box Truck'},'box26').status,'listed');
assert.equal(fit.check({equipment:'Cargo van'},'cargo').status,'listed');
assert.equal(fit.check({equipment:'Reefer',isSandbox:true}).status,'preview');
(async()=>{
 const h=context(fixtures.cases[0]);h.c.window.MileCountEquipment=fit;
 h.S.allUnifiedLoads.forEach(l=>{l.isSandbox=false;l.equipment='V';});
 await h.c.smartAutoStack();assert(h.S.stackPlan?.valid,h.nodes.get('stackPlanResult').innerHTML);
 h.S.allUnifiedLoads[1].equipment='Reefer';
 await h.c.smartAutoStack();assert.equal(h.S.stackPlan,null);assert.match(h.nodes.get('stackPlanResult').innerHTML,/Equipment mismatch/);
 console.log('PASS equipment fit: known incompatible excluded from plans, generic van stays unverified');
})().catch(e=>{console.error(e);process.exitCode=1;});
