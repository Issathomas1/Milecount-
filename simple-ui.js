/* Navigation and progressive disclosure only. Truck Brain owns all trip data. */
(function(){
'use strict';
const $=id=>document.getElementById(id);
let toastTimer;
function jump(node){if(!node)return;for(let p=node.parentElement;p;p=p.parentElement)if(p.tagName==='DETAILS')p.open=true;node.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});}
function fold(node,title,id){if(!node)return null;const box=document.createElement('details');box.className='simpleFold';box.id=id;const summary=document.createElement('summary');summary.textContent=title;node.before(box);box.append(summary,node);return box;}
function screen(n){if(n!==2)$('stackFeedback')?.classList.remove('visible');document.body.dataset.mcScreen=String(n);document.querySelectorAll('[data-step]').forEach(b=>{const active=Number(b.dataset.step)===(n===4?3:n);b.setAttribute('aria-current',active?'step':'false');});measure();}
function measure(){const tray=$('stackTray'),visible=tray?.classList.contains('active')&&document.body.dataset.mcScreen==='2';document.documentElement.style.setProperty('--stack-height',visible?Math.ceil(tray.getBoundingClientRect().height)+'px':'0px');}
function openStack(){if($('stackFold'))$('stackFold').open=true;jump($('stackFold'));}
function openBooking(){if($('bookingFold'))$('bookingFold').open=true;}
function notify(text){const box=$('stackFeedback');box.textContent=text;box.classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>box.classList.remove('visible'),2400);}
function init(){
 document.body.classList.add('simpleDispatch');
 const menu=$('driverMenu');if(menu){menu.add(new Option('BOOKINGS','bookings'));menu.add(new Option('TRUCK & DRIVER','truck'));}
 const nav=document.createElement('nav');nav.id='dispatchSteps';nav.setAttribute('aria-label','Trip planning steps');
 nav.innerHTML='<button type="button" data-step="1"><span>1</span> Find loads</button><button type="button" data-step="2"><span>2</span> My stack</button><button type="button" data-step="3"><span>3</span> My trip</button>';
 document.querySelector('header').after(nav);nav.querySelectorAll('button').forEach(b=>b.onclick=()=>window.MileCountNavigation.go(Number(b.dataset.step)));
 const top=document.createElement('button');top.id='backToTop';top.type='button';top.setAttribute('aria-label','Back to top');top.innerHTML='<span aria-hidden="true">↑</span> Top';top.hidden=true;document.body.append(top);
 top.onclick=()=>{window.scrollTo({top:0,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});nav.querySelector('[aria-current="step"]')?.focus({preventScroll:true});};
 addEventListener('scroll',()=>{top.hidden=window.scrollY<350;},{passive:true});
 const feedback=document.createElement('div');feedback.id='stackFeedback';feedback.setAttribute('role','status');feedback.setAttribute('aria-live','polite');document.body.append(feedback);
 const stack=fold($('selectedStackLoads'),'Your selected loads','stackFold');
 const optimize=$('smartAutoStack');if(stack&&optimize)stack.append(optimize);
 const review=document.createElement('button');review.type='button';review.id='reviewStackQuick';review.textContent='Edit';review.onclick=openStack;$('stackTray').insertBefore(review,$('clearStack'));
 if($('doneStack'))$('doneStack').textContent='Build my trip →';
 const first=$('stackTray').querySelector('small');if(first)first.textContent='YOUR STACK · PLANNED PAY';
 if($('screen2')){
  $('screen2').querySelector('h2').textContent='Find your next load';
  $('screen2').querySelector('.stackHelp').innerHTML='<b>See a fit? Stack it.</b><span>Add one or more loads. Build your trip to compare the route and costs.</span>';
  // The old single-load calculator remains accessible without occupying the load list.
  const moreRow=$('browseOutboundCandidates')?.parentElement;fold(moreRow,'Find outbound or homebound loads','moreFreightFold');
  const start=$('added'),end=$('addTrip');if(start&&end){const calc=document.createElement('details');calc.className='simpleFold';calc.innerHTML='<summary>Single-load analysis</summary>';start.before(calc);let node=start;while(node){const next=node.nextSibling;calc.append(node);if(node===end)break;node=next;}calc.hidden=true;window.addEventListener('milecount:inspect',()=>{calc.hidden=false;calc.open=true;jump(calc);});}
  if($('selectedLoadSummary'))$('selectedLoadSummary').hidden=true;
 }
 const overview=$('tripOverview');if(overview){
  const heading=$('screen3').querySelector('h2');heading.after(overview);
  const details=document.createElement('details');details.className='simpleFold';details.id='tripCostFold';details.innerHTML='<summary>Fuel & full breakdown</summary>';
  const primary=document.createElement('div');primary.className='tripPrimary';
  ['overviewRevenue','overviewMiles','overviewMargin'].forEach(id=>{const metric=$(id)?.closest('.metric');if(metric)primary.append(metric);});
  overview.prepend(primary);const keep=[...overview.children].filter(n=>n!==primary);overview.append(details);keep.forEach(n=>details.append(n));
  const added=$('tripAdded')?.closest('.card');if(added)details.append(added);
 }
 // End-location editing is available without repeating all of the trip totals.
 const final=$('finalTripDetails');if(final){const endBox=document.createElement('details');endBox.id='endLocationFold';endBox.className='simpleFold';endBox.innerHTML='<summary>Change where this trip ends</summary>';final.prepend(endBox);const start=$('tripHomeStart')?.closest('.row'),last=$('applyTripHome');if(start&&last){let n=start;while(n){let next=n.nextSibling;endBox.append(n);if(n===last)break;n=next;}}}
 fold($('bookingHandoff'),'Book your loads','bookingFold');
 const heading=$('bookingHandoff')?.querySelector('p.details');if(heading)heading.textContent='Review once here. Until direct booking is connected, finish each booking with its provider.';
 $('bookAllLoads')?.addEventListener('click',()=>{document.querySelectorAll('#bookingChecklist details')[0]?.setAttribute('open','');});
 // Load discovery stays on the home page, behind one clear entry point.
 const discovery=fold(document.querySelector('.homeMapCard'),'Browse map, sources & demo loads','discoveryFold');
 discovery?.addEventListener('toggle',()=>{if(discovery.open)window.setMileCountLoadMapMode?.('pins');});
 const form=document.querySelector('.simpleSearchCard');if(form){const settings=document.createElement('details');settings.className='simpleFold';settings.innerHTML='<summary>Truck settings, schedule & costs</summary>';const children=[...form.children].filter(n=>n.tagName==='DETAILS');form.append(settings);children.forEach(n=>settings.append(n));}
 const trailer=$('screen3')?.querySelector('.alert');if(trailer){trailer.classList.add('routeAdditions');trailer.querySelector('h2').textContent='Add freight to this trip';$('tripOverview')?.after(trailer);}
 const plan=$('stackPlanResult');if(plan)new MutationObserver(()=>{if(plan.querySelector('.bad')||plan.textContent.includes('LIVE and TEST/SIM')){if(stack)stack.open=true;}}).observe(plan,{childList:true,subtree:true});
 window.addEventListener('milecount:screen',e=>screen(e.detail.screen));
 window.addEventListener('milecount:stack',e=>{if(stack){stack.querySelector('summary').textContent='Your stack · '+e.detail.count+' selected';stack.hidden=e.detail.count===0;}$('reviewStackQuick').setAttribute('aria-label','Review '+e.detail.count+' selected loads');measure();});
 window.addEventListener('milecount:stack-choice',e=>{const {added,count,test}=e.detail;notify(added?(test?'Test load added':'✓ Load added')+' · '+count+' in your stack':'Load removed · '+count+' in your stack');if(added&&!matchMedia('(prefers-reduced-motion: reduce)').matches){$('stackTray').classList.remove('stackPop');void $('stackTray').offsetWidth;$('stackTray').classList.add('stackPop');}});
 if(window.ResizeObserver){const ro=new ResizeObserver(measure);ro.observe($('stackTray'));ro.observe(nav);}addEventListener('resize',measure);
 screen(Number(document.querySelector('.screen.active')?.id.replace('screen','')||1));
}
window.MileCountSimpleUI={openStack,openBooking};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
