(function(){
"use strict";
var STORAGE_KEY="milecount_booking_center_v1";
var STATES={AVAILABLE:"AVAILABLE",REQUESTING:"REQUESTING",PENDING:"PENDING",ACCEPTED:"ACCEPTED",DECLINED:"DECLINED",EXPIRED:"EXPIRED",ACTION_REQUIRED:"ACTION_REQUIRED",CANCELLED:"CANCELLED"};
var adapters={};
var transientActions={};
var center=null;

function esc(v){return String(v==null?"":v).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]})}
function money(v){return "$"+Math.round(Number(v||0)).toLocaleString()}
function norm(v){return String(v||"provider").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")}
function keyFor(l){return String((l&&(l.providerLoadId||l.bookingReference||l.name))||"")+"|"+String((l&&l.provider)||"")}
function nonBookable(l){return !!(l&&(l.isSandbox||l.isLocalSim||/sandbox|sim/i.test(String(l.provider||""))))}
function readStore(){try{var x=JSON.parse(localStorage.getItem(STORAGE_KEY)||"{}");return x&&typeof x==="object"?x:{}}catch(e){return{}}}
function writeStore(x){localStorage.setItem(STORAGE_KEY,JSON.stringify(x))}
function recordFor(l){return readStore()[keyFor(l)]||null}
function statusFor(l){if(nonBookable(l))return"NOT_BOOKABLE";var r=recordFor(l);return r?r.status:STATES.AVAILABLE}
function isConfirmed(l){return statusFor(l)===STATES.ACCEPTED}
function bridge(){return window.MileCountBookingBridge||{}}
function allLoads(){try{return bridge().getLoads?bridge().getLoads():[]}catch(e){return[]}}
function currentByKey(k){var a=allLoads();for(var i=0;i<a.length;i++)if(keyFor(a[i])===k)return a[i];return null}

function save(l,status,extra){
 extra=extra||{};var s=readStore(),k=keyFor(l),prev=s[k]||{},now=new Date().toISOString();
 s[k]={provider:String((l&&l.provider)||prev.provider||"Provider"),providerLoadId:String((l&&(l.providerLoadId||l.bookingReference))||prev.providerLoadId||""),status:status,submittedAt:prev.submittedAt||((status===STATES.REQUESTING||status===STATES.PENDING)?now:null),updatedAt:now,requestId:extra.requestId||prev.requestId||null,confirmationNumber:extra.confirmationNumber||prev.confirmationNumber||null,message:String(extra.message||prev.message||"")};
 writeStore(s);decorate();renderCenter();refreshCommittedSummary();return s[k]
}
function removeRecord(k){var s=readStore();delete s[k];writeStore(s);delete transientActions[k];decorate();renderCenter();refreshCommittedSummary()}

function actionUrl(v){
 if(!v)return"";
 if(typeof v==="object")return String(v.url||v.href||v.link||v.deep_link||v.deepLink||v.booking_url||v.bookingUrl||"");
 var x=String(v).trim();if(/^(https?:|mailto:|tel:)/i.test(x))return x;
 try{return actionUrl(JSON.parse(x))}catch(e){return""}
}
function optionsFor(l){
 var i=(l&&(l.bookingInfo||l.booking_info))||{},out=[];
 var bu=actionUrl(i.book_button_data||l.book_button_data)||actionUrl(i.book_button_action||l.book_button_action);
 var qu=actionUrl(i.quote_button_data||l.quote_button_data)||actionUrl(i.quote_button_action||l.quote_button_action);
 if(bu)out.push({label:"BOOK NOW",url:bu});
 if(qu&&qu!==bu)out.push({label:"SEND QUOTE",url:qu});
 if(!out.length&&l&&l.sourceUrl)out.push({label:"OPEN "+String(l.provider||"PROVIDER").toUpperCase(),url:String(l.sourceUrl)});
 return out
}
function openUrl(u){if(!u)return false;try{return !!window.open(u,"_blank","noopener,noreferrer")}catch(e){return false}}
function defaultAdapter(){return{requestBooking:async function(l){return{status:STATES.ACTION_REQUIRED,options:optionsFor(l),message:"Finish the provider-authorized booking step. Milecount will keep this load tentative until the provider confirms it."}}}}
function adapterFor(l){return adapters[norm(l&&l.provider)]||defaultAdapter()}

async function beginBooking(l,index){
 if(!l||nonBookable(l))return;
 var r=recordFor(l);if(r&&[STATES.ACCEPTED,STATES.REQUESTING,STATES.PENDING].indexOf(r.status)>=0)return;
 save(l,STATES.REQUESTING,{message:"Rechecking live availability..."});
 var live=l;
 try{
   if(bridge().refreshLoad){var z=await bridge().refreshLoad(l);if(!z){save(l,STATES.EXPIRED,{message:"This load is no longer returned by the provider."});return}live=Object.assign({},l,z)}
   var result=await adapterFor(live).requestBooking(live,{index:index});
   var st=String((result&&result.status)||STATES.ACTION_REQUIRED).toUpperCase();
   if(st===STATES.ACCEPTED){save(live,STATES.ACCEPTED,{confirmationNumber:result.confirmationNumber||result.confirmation_number||null,requestId:result.requestId||result.request_id||null,message:result.message||"Provider confirmed this load."});return}
   if(st===STATES.PENDING){save(live,STATES.PENDING,{requestId:result.requestId||result.request_id||null,message:result.message||"Waiting for provider confirmation."});return}
   if(st===STATES.DECLINED||st===STATES.EXPIRED){save(live,st,{message:(result&&result.message)||"Provider did not confirm this load."});return}
   var opts=(result&&result.options&&result.options.length)?result.options:optionsFor(live);
   transientActions[keyFor(live)]=opts;save(live,STATES.ACTION_REQUIRED,{message:(result&&result.message)||"Finish booking with the provider."});
   if(opts.length)openUrl(opts[0].url);else openCenter();
 }catch(e){
   var fallback=optionsFor(l);transientActions[keyFor(l)]=fallback;save(l,STATES.ACTION_REQUIRED,{message:"Direct booking is not exposed yet. Continue with the provider handoff."});if(fallback.length)openUrl(fallback[0].url)
 }
}

function injectStyles(){
 if(document.getElementById("mcBookingStyles"))return;
 var s=document.createElement("style");s.id="mcBookingStyles";
 s.textContent=".mcBookingTopBtn{width:auto!important;margin:0 0 0 8px!important;padding:8px 10px!important;border:1px solid #2b6048!important;background:#102119!important;color:#8adbb5!important;font-size:9px!important;white-space:nowrap}.mcBookingActionRow{display:flex;align-items:center;gap:8px;margin:-5px 0 12px;padding:9px 10px;border:1px solid #20352b;border-top:0;border-radius:0 0 13px 13px;background:#08130e}.mcBookingActionRow button{width:auto;margin:0;padding:9px 12px;font-size:10px}.mcBookingActionRow small{margin-left:auto;font-size:9px;color:#93a79d;text-align:right}.mcBookingState{font-size:8px;font-weight:900;padding:5px 7px;border-radius:999px;background:#172a21;color:#b8cabf}.mcBookingState.accepted{background:#123b27;color:#73e5a8}.mcBookingState.pending{background:#372f13;color:#f0cb62}.mcBookingState.bad{background:#3a1818;color:#f6aaaa}.mcBookingOverlay{position:fixed;inset:0;z-index:100005;background:rgba(0,0,0,.72);display:none;align-items:flex-end;justify-content:center;padding:14px}.mcBookingOverlay.active{display:flex}.mcBookingPanel{width:min(680px,100%);max-height:86vh;overflow:auto;border:1px solid #28503d;border-radius:18px;background:#07110d;color:#f3f8f5;padding:16px;box-shadow:0 20px 70px rgba(0,0,0,.55)}.mcBookingHead{display:flex;align-items:center;justify-content:space-between;gap:10px}.mcBookingHead h2{margin:0}.mcBookingHead button{width:auto;margin:0;padding:8px 11px;background:#15271f}.mcBookingItem{margin-top:10px;padding:12px;border:1px solid #20352b;border-radius:13px;background:#0b1712}.mcBookingItemTop{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}.mcBookingItem b{font-size:12px}.mcBookingItem p{margin:7px 0 0;color:#93a79d;font-size:10px;line-height:1.4}.mcBookingItemActions{display:flex;gap:7px;flex-wrap:wrap}.mcBookingItemActions button{width:auto;padding:8px 10px;font-size:9px}.mcCommitSummary{grid-column:1/-1;padding:7px 9px;border-top:1px solid #244637;color:#93a79d;font-size:9px}.mcCommitSummary b{color:#73e5a8}.mcPlanCommitNotice{margin:9px 0;padding:9px;border:1px solid #5b4b19;border-radius:9px;background:#1a160a;color:#d6c58f;font-size:9px;line-height:1.4}@media(max-width:520px){.mcBookingActionRow{align-items:flex-start;flex-wrap:wrap}.mcBookingActionRow small{width:100%;text-align:left;margin:0}.mcBookingTopBtn{padding:7px 8px!important}}";
 document.head.appendChild(s)
}
function cls(st){if(st===STATES.ACCEPTED)return"accepted";if([STATES.REQUESTING,STATES.PENDING,STATES.ACTION_REQUIRED].indexOf(st)>=0)return"pending";if([STATES.DECLINED,STATES.EXPIRED,STATES.CANCELLED].indexOf(st)>=0)return"bad";return""}
function label(st){return{AVAILABLE:"AVAILABLE",REQUESTING:"CHECKING...",PENDING:"PENDING PROVIDER",ACCEPTED:"CONFIRMED",DECLINED:"DECLINED",EXPIRED:"UNAVAILABLE",ACTION_REQUIRED:"FINISH WITH PROVIDER",CANCELLED:"CANCELLED",NOT_BOOKABLE:"NOT BOOKABLE"}[st]||st}
function actionLabel(st){if(st===STATES.ACCEPTED)return"CONFIRMED";if(st===STATES.REQUESTING)return"CHECKING...";if(st===STATES.PENDING)return"PENDING";if(st===STATES.ACTION_REQUIRED)return"CONTINUE WITH PROVIDER";if(st===STATES.EXPIRED)return"UNAVAILABLE";return"REVIEW BOOKING"}

function ensureTop(){
 if(document.getElementById("mcBookingCenterBtn"))return;var h=document.querySelector("header");if(!h)return;
 var b=document.createElement("button");b.id="mcBookingCenterBtn";b.type="button";b.className="mcBookingTopBtn";b.textContent="BOOKINGS";b.onclick=openCenter;h.appendChild(b)
}
function ensureCenter(){
 if(center)return center;center=document.createElement("div");center.id="mcBookingCenter";center.className="mcBookingOverlay";document.body.appendChild(center);center.addEventListener("click",function(e){if(e.target===center)center.classList.remove("active")});return center
}
function renderCenter(){
 var c=ensureCenter(),s=readStore(),entries=Object.keys(s).sort(function(a,b){return String(s[b].updatedAt||"").localeCompare(String(s[a].updatedAt||""))});
 var html='<div class="mcBookingPanel"><div class="mcBookingHead"><div><div style="font-size:9px;color:#8adbb5;font-weight:900">MILECOUNT</div><h2>Booking Center</h2></div><button type="button" id="mcCloseBookingCenter">CLOSE</button></div><p style="color:#93a79d;font-size:11px">Only provider-confirmed loads count as committed. Tentative freight can still be planned and stacked.</p>';
 if(!entries.length)html+='<div class="mcPlanCommitNotice">No booking activity yet. Tap BOOK LOAD on a real provider load.</div>';
 entries.forEach(function(k){var r=s[k],live=currentByKey(k),opts=transientActions[k]||optionsFor(live||{});html+='<div class="mcBookingItem"><div class="mcBookingItemTop"><div><b>'+esc(r.provider)+(r.providerLoadId?' • '+esc(r.providerLoadId):'')+'</b><p>'+esc(r.message||"")+'</p></div><span class="mcBookingState '+cls(r.status)+'">'+esc(label(r.status))+'</span></div><div class="mcBookingItemActions">'+((r.status===STATES.ACTION_REQUIRED&&opts.length)?'<button type="button" data-mc-open="'+esc(k)+'">CONTINUE WITH PROVIDER</button>':'')+(([STATES.ACCEPTED,STATES.PENDING,STATES.REQUESTING].indexOf(r.status)<0)?'<button type="button" data-mc-dismiss="'+esc(k)+'" style="background:#15271f">DISMISS</button>':'')+'</div></div>'});
 html+='</div>';c.innerHTML=html;
 var close=c.querySelector("#mcCloseBookingCenter");if(close)close.onclick=function(){c.classList.remove("active")};
 c.querySelectorAll("[data-mc-dismiss]").forEach(function(b){b.onclick=function(){removeRecord(b.getAttribute("data-mc-dismiss"))}});
 c.querySelectorAll("[data-mc-open]").forEach(function(b){b.onclick=function(){var k=b.getAttribute("data-mc-open"),l=currentByKey(k),o=transientActions[k]||optionsFor(l||{});if(o.length)openUrl(o[0].url)}});
 var top=document.getElementById("mcBookingCenterBtn");if(top){var active=entries.filter(function(k){return[STATES.DECLINED,STATES.EXPIRED,STATES.CANCELLED].indexOf(s[k].status)<0}).length;top.textContent=active?"BOOKINGS • "+active:"BOOKINGS"}
}
function openCenter(){renderCenter();ensureCenter().classList.add("active")}

function decorate(){
 document.querySelectorAll(".candidateLoad[data-load-index]").forEach(function(card){
   var index=Number(card.getAttribute("data-load-index")),l=bridge().getLoad?bridge().getLoad(index):null;if(!l)return;
   var st=statusFor(l),row=card.nextElementSibling;
   if(!row||!row.classList.contains("mcBookingActionRow")){row=document.createElement("div");row.className="mcBookingActionRow";card.insertAdjacentElement("afterend",row)}
   if(nonBookable(l)){row.innerHTML='<span class="mcBookingState">NOT BOOKABLE</span><small>Test/SIM freight stays out of real booking.</small>';return}
   var dis=[STATES.ACCEPTED,STATES.REQUESTING,STATES.PENDING].indexOf(st)>=0?" disabled":"";
   row.innerHTML='<button type="button"'+dis+'>'+esc(actionLabel(st))+'</button><span class="mcBookingState '+cls(st)+'">'+esc(label(st))+'</span><small>'+(st===STATES.ACCEPTED?"Provider confirmed • committed":st===STATES.ACTION_REQUIRED?"Provider handoff required":"Live availability is rechecked before handoff")+'</small>';
   var btn=row.querySelector("button");if(btn)btn.onclick=function(e){e.preventDefault();e.stopPropagation();beginBooking(l,index)}
 });
 renderCenter()
}

function refreshCommittedSummary(){
 var tray=document.getElementById("stackTray");if(!tray)return;
 var box=document.getElementById("mcCommitSummary");if(!box){box=document.createElement("div");box.id="mcCommitSummary";box.className="mcCommitSummary";tray.appendChild(box)}
 var planned=bridge().getPlannedLoads?bridge().getPlannedLoads():[],confirmed=planned.filter(isConfirmed),tentative=planned.filter(function(l){return!isConfirmed(l)});
 var pay=confirmed.reduce(function(s,l){return s+Number(l.pay||0)},0),weight=confirmed.reduce(function(s,l){return s+Math.max(0,Number(l.weight||0))},0),space=confirmed.reduce(function(s,l){return s+Math.max(0,Number(l.space||0))},0);
 box.innerHTML='<b>CONFIRMED / COMMITTED: '+money(pay)+' • '+confirmed.length+' load'+(confirmed.length===1?"":"s")+'</b> • '+Math.round(weight).toLocaleString()+' lb • '+(Math.round(space*10)/10)+' ft'+(tentative.length?' • '+tentative.length+' tentative':'');
 var result=document.getElementById("stackPlanResult");if(result&&planned.length){var note=result.querySelector("[data-booking-plan]");if(!note){note=document.createElement("div");note.className="mcPlanCommitNotice";note.setAttribute("data-booking-plan","1");result.insertBefore(note,result.firstChild)}note.textContent=confirmed.length+" confirmed / "+planned.length+" planned loads • only confirmed freight counts as committed revenue/capacity."}
}
function registerProvider(name,adapter){if(name&&adapter)adapters[norm(name)]=adapter}
function setProviderStatus(l,status,payload){status=String(status||"").toUpperCase();if(Object.keys(STATES).map(function(k){return STATES[k]}).indexOf(status)<0)throw new Error("Unknown booking status");return save(l,status,payload||{})}

function init(){
 injectStyles();ensureTop();ensureCenter();decorate();refreshCommittedSummary();
 var target=document.getElementById("loadCandidates")||document.body;var obs=new MutationObserver(function(){decorate();refreshCommittedSummary()});obs.observe(target,{childList:true,subtree:false});
 setInterval(refreshCommittedSummary,1500)
}
window.MileCountBooking={STATES:STATES,statusForLoad:statusFor,isConfirmed:isConfirmed,registerProvider:registerProvider,setProviderStatus:setProviderStatus,refreshCommittedSummary:refreshCommittedSummary,openCenter:openCenter};
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})();