const {spawnSync}=require('node:child_process');
const suites=['pickup-delivery','autostack-workflow','verified-road-workflow','map-synchronization','performance-regressions','commercial-foundation','access-booking','physical-dispatch-workflow','dispatch-planner','database-permissions','commercial-endpoint','local-day-selection'];
for(const name of suites){const result=spawnSync(process.execPath,['tests/'+name+'.cjs'],{stdio:'inherit'});if(result.status!==0)process.exit(result.status||1);}
console.log('PASS all '+suites.length+' regression suites');
