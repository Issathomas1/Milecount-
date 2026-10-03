(function(root){
 'use strict';
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const number=v=>Number.isFinite(Number(v))?Number(v):0;
 const money=v=>'$'+number(v).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});
 const metric=(label,value)=>'<div class="metric"><small>'+label+'</small><b>'+esc(value)+'</b></div>';
 function render(t){
  const total=number(t.primary_pay)+number(t.added_pay)+number(t.return_pay);
  const date=new Date(t.created_at),created=Number.isNaN(date.getTime())?'Date not saved':date.toLocaleString();
  const route=[t.origin||'Start',t.destination||'Destination',t.home_city].filter(Boolean).map(esc).join(' → ');
  return '<details class="card trip"><summary><div class="top"><div><div class="route">'+route+'</div><div class="muted">'+esc(created)+'</div></div><div class="pay">'+money(total)+'</div></div><div class="muted">Open saved trip details</div></summary><div class="grid">'+
   metric('ROAD MILES',number(t.road_miles).toLocaleString()+' mi')+metric('PRIMARY PAY',money(t.primary_pay))+metric('ADDED PAY',money(t.added_pay))+metric('RETURN PAY',money(t.return_pay))+metric('ALL-MILE RPM',money(t.all_miles_rpm))+metric('FUEL ESTIMATE',money(t.fuel_cost))+metric('SAVED COST ESTIMATE',money(t.estimated_trip_cost))+metric('SAVED MARGIN ESTIMATE',money(t.estimated_margin))+metric('STATUS',String(t.status||'saved').toUpperCase())+
   '</div><p class="muted">Saved planning estimates, not completed earnings. This record does not include the full pickup and delivery stop list.</p></details>';
 }
 const api={render};root.MileCountTrips=api;if(typeof module==='object')module.exports=api;
})(typeof window==='undefined'?globalThis:window);
