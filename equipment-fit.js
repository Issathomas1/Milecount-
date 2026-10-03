/* Equipment screening is separate from payload/space. Unknown codes need provider confirmation. */
(function(root){
'use strict';
function check(load,vehicle='box26'){
 const raw=String(load?.equipment||'').trim(),v=String(vehicle||'box26').toLowerCase();
 if(load?.isSandbox||load?.isLocalSim)return {status:'preview',message:'Test equipment only'};
 const options=raw.toLowerCase().split(/[,;/]|\s+or\s+/).map(x=>x.trim()).filter(Boolean);
 const cargo=/cargo|sprinter/.test(v);
 const knownFit=options.some(x=>cargo?/^(cargo van|sprinter|sprinter van|high-roof van)$/.test(x):/^(box truck|straight truck|bt)$/.test(x));
 if(knownFit)return {status:'listed',message:'Vehicle type listed · confirm dimensions and loading requirements'};
 const specialized=x=>/^(f|f\+t|r|sd|hs)$/.test(x)||/flatbed|reefer|refrigerat|step.?deck|hot.?shot|lowboy|tanker|conestoga/.test(x);
 if(options.length&&options.every(specialized))return {status:'incompatible',message:'Equipment mismatch: '+raw+' requires a different setup. Not eligible for this '+(cargo?'cargo van':'box truck')+' plan.'};
 return {status:'unknown',message:'Equipment not verified for your vehicle · confirm with the provider before accepting'};
}
const api={check};root.MileCountEquipment=api;if(typeof module==='object')module.exports=api;
})(typeof window==='undefined'?globalThis:window);
