const fs=require('fs'),assert=require('assert'),api=require('../pickup-delivery');
const fixtures=require('./fixtures/dispatch-cases.json'),roads=require('./fixtures/road-matrix.json');
const output=[];
for(const c of fixtures.cases){const loads=c.loads.map(([id,pickup,delivery,weight,space,pay])=>({name:id,provider:'QA fixture',pickup,delivery,weight,space,pay,isSandbox:true}));
 const p=api.problem({loads,truck:{currentLocation:c.start,payload:c.payload,cargoCapacity:c.space,onboardLoads:[]},finalDestination:c.home,startMinutes:360,serviceMinutes:{pickup:20,drop:20},fuelCostPerMile:.6,baseLoadId:api.key(loads[0])});
 p.matrix=p.locations.map(a=>p.locations.map(b=>roads.matrix[roads.locations.indexOf(a)][roads.locations.indexOf(b)]));
 const chosen=api.optimize(p),paired=api.paired(p);assert(chosen.ok);assert(chosen.audit.ok);assert(!paired||chosen.miles<=paired.miles+1);assert.equal(chosen.addedPay,chosen.totalPay-loads[0].pay);
 const item={name:c.name,oldMiles:paired?.miles,newMiles:chosen.miles,savedMiles:paired?paired.miles-chosen.miles:0,newOrder:chosen.events.map(e=>({type:e.type,location:e.location,load:e.load?.name,onboardWeight:e.onboardWeight,onboardSpace:e.onboardSpace})),oldOrder:paired?.events.map(e=>({type:e.type,location:e.location,load:e.load?.name})),routeStops:chosen.routeStops,optimal:chosen.optimal,expanded:chosen.expanded,totalPay:chosen.totalPay,addedPay:chosen.addedPay,deadhead:chosen.deadhead,driveHours:chosen.drive/60,afterGas:chosen.afterGas};output.push(item);console.log(JSON.stringify(item));
}
fs.writeFileSync('tests/fixtures/road-example-results.json',JSON.stringify(output,null,2));
