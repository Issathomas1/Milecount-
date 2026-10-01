/* Compare complete legal truck plans. Network, booking and platform fees are excluded. */
(function(root){
'use strict';
const routes=root.MileCountPickupDelivery||(typeof require==='function'?require('./pickup-delivery.js'):null);
const economics=root.MileCountDispatchBrain||(typeof require==='function'?require('./dispatch-brain.js'):null);
const isTest=l=>!!(l.isSandbox||l.isLocalSim||['TEST','SIM'].includes(l.mode));
const road=(p,a,b)=>p.matrix[p.locations.indexOf(a)]?.[p.locations.indexOf(b)];
function recommend(template,options={}){
 const protectedIds=new Set([...(options.committedIds||[]),...template.loads.filter(l=>l.initialOnboard).map(l=>l.id)]);
 const baseLoads=template.loads.filter(l=>protectedIds.has(l.id));
 const baseProblem={...template,loads:baseLoads};
 const baseline=routes.solve(baseProblem);
 if(!baseline.ok)return {ok:false,issues:baseline.issues,choices:[],evaluated:0};
 const baselineEconomics=economics.evaluate(baseline,{...options.economics,guardrails:{}});
 const homebound=options.mode==='homebound',rejections=[];
 const target=template.finalDestination;
 if(homebound&&!target)return {ok:false,issues:['Choose the exact home destination first'],choices:[],evaluated:0};
 const candidates=template.loads.filter(l=>!protectedIds.has(l.id)).filter(l=>{
  let reason=null;
  if(isTest(l)||l.dataFreshness==='stale')reason='Only fresh LIVE freight can improve a real dispatch';
  else if(l.pay==null||!Number.isFinite(Number(l.pay))||Number(l.pay)<=0)reason='Pay not provided by provider';
  else if(homebound){const before=road(template,l.pickup,target),after=road(template,l.delivery,target);if(!before||!after||before.miles-after.miles<Math.max(1,Number(options.minimumHomeProgressMiles||1)))reason='Delivery does not make meaningful road progress toward home';}
  if(reason)rejections.push({id:l.id,reason});return !reason;
 });
 // Cheap complete-solo-plan estimate orders the bounded search; it never decides the final plan.
 const soloValue=l=>{const a=road(template,template.truck.currentLocation,l.pickup),b=road(template,l.pickup,l.delivery),c=target?road(template,l.delivery,target):{miles:0};return a&&b&&c?Number(l.pay)-(a.miles+b.miles+c.miles)*Number(template.fuelCostPerMile||0):-Infinity;};
 candidates.sort((a,b)=>soloValue(b)-soloValue(a)||a.id.localeCompare(b.id));
 const maxCandidates=Math.min(8,Math.max(0,options.maxCandidates??8)),pool=candidates.slice(0,maxCandidates);
 const maxAdded=Math.min(options.maxAddedLoads??3,Math.max(0,15-baseLoads.length)),maxPlans=options.maxPlans??96;
 const started=Date.now(),timeBudgetMs=options.timeBudgetMs??5000;
 const choices=[];let evaluated=0,truncated=candidates.length>pool.length;
 function visit(at,selected){
  if(Date.now()-started>timeBudgetMs){truncated=true;return;}
  if(selected.length){
   if(evaluated>=maxPlans){truncated=true;return;}
   evaluated++;
   const p={...template,loads:[...baseLoads,...selected]},plan=routes.solve(p);
   if(!plan.ok){rejections.push({ids:selected.map(l=>l.id),reason:plan.issues.join(' • ')});}
   else{
    plan.detourMiles=Math.max(0,plan.miles-baseline.miles);
    const review=economics.evaluate(plan,options.economics),improvement=review.metrics.operatingMargin-baselineEconomics.metrics.operatingMargin;
    let eachHopImproves=true;
    if(homebound&&selected.length>1)for(const load of selected){const without=routes.solve({...p,loads:p.loads.filter(l=>l.id!==load.id)});if(!without.ok)continue;const removed=economics.evaluate(without,{...options.economics,guardrails:{}});if(review.metrics.operatingMargin<=removed.metrics.operatingMargin+.01){eachHopImproves=false;break;}}
    if(review.ok&&improvement>.01&&eachHopImproves)choices.push({plan,review,added:selected.map(l=>({...l})),improvement,extraMiles:plan.miles-baseline.miles,reason:'Improves estimated carrier operating margin by $'+improvement.toFixed(2)+' versus the current complete plan.'});
    else rejections.push({ids:selected.map(l=>l.id),reason:review.issues.join(' • ')||(!eachHopImproves?'One hop does not improve the complete plan':'Does not improve the current complete plan')});
   }
  }
  if(selected.length>=maxAdded)return;
  if(evaluated>=maxPlans){if(at<pool.length)truncated=true;return;}
  for(let i=at;i<pool.length;i++)visit(i+1,[...selected,pool[i]]);
 }
 visit(0,[]);
 choices.sort((a,b)=>b.review.metrics.operatingMargin-a.review.metrics.operatingMargin||a.plan.miles-b.plan.miles||a.plan.drive-b.plan.drive);
 return {ok:true,baseline,baselineEconomics,choices:choices.slice(0,5),rejections,evaluated,truncated,searchMethod:'bounded subset search with global pickup/delivery optimization',remainingEmptyMiles:baseline.deadhead,message:choices.length?'Best complete plans found in this search':homebound?'No profitable live freight found along remaining corridor.':'No profitable live addition found for the current plan.'};
}
const api={recommend};if(typeof module!=='undefined')module.exports=api;root.MileCountDispatchPlanner=api;
})(typeof window!=='undefined'?window:globalThis);
