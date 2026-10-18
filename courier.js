(function(){
'use strict';
const STORE='milecount-courier-mvp-v1';
const $=id=>document.getElementById(id);
const money=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number.isFinite(n)?n:0);
const num=v=>{const n=Number(v);return Number.isFinite(n)&&n>=0?n:0};
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let state={gigs:[],earnings:[]};
try{const saved=JSON.parse(localStorage.getItem(STORE)||'null');if(saved&&Array.isArray(saved.gigs)&&Array.isArray(saved.earnings))state=saved;}catch(_){}
function persist(){try{localStorage.setItem(STORE,JSON.stringify(state));return true;}catch(_){$('formStatus').textContent='Browser storage is unavailable. Your changes may not persist after leaving this page.';return false;}}
function updateCalculator(){
 const pay=num($('pay').value),miles=num($('miles').value),hours=num($('hours').value),mpg=Math.max(1,num($('mpg').value)),fuel=num($('fuel').value),wear=num($('wear').value),other=num($('other').value);
 const cost=(miles/mpg)*fuel+miles*wear+other,net=pay-cost;
 $('estNet').textContent=money(net);$('netMile').textContent=miles?money(net/miles):'—';$('netHour').textContent=hours?money(net/hours):'—';$('estCost').textContent=money(cost);
 $('estNet').style.color=net<0?'#ffb0a6':'var(--green)';
}
function renderGigs(){
 $('savedCount').textContent=String(state.gigs.length);
 $('gigList').innerHTML=state.gigs.length?state.gigs.map((g,i)=>'<article class="gig-card"><h3>'+escape(g.title)+'</h3><p>'+escape(g.pickup)+' → '+escape(g.dropoff)+'</p><div class="pay">'+money(g.pay)+'</div><p>Estimated miles: '+num(g.miles)+' · Status: '+escape(g.status)+'</p>'+(g.notes?'<p>'+escape(g.notes)+'</p>':'')+'<div class="actions">'+(g.status!=='completed'?'<button type="button" class="button secondary" data-complete="'+i+'">Mark completed</button>':'')+'<button type="button" class="button danger" data-delete-gig="'+i+'">Delete</button></div></article>').join(''):'<p class="empty">No saved opportunities yet. Add a lead above to get started.</p>';
 $('gigList').querySelectorAll('[data-complete]').forEach(b=>b.addEventListener('click',()=>{const i=Number(b.dataset.complete);if(state.gigs[i]){state.gigs[i].status='completed';persist();renderGigs();}}));
 $('gigList').querySelectorAll('[data-delete-gig]').forEach(b=>b.addEventListener('click',()=>{state.gigs.splice(Number(b.dataset.deleteGig),1);persist();renderGigs();}));
}
function renderEarnings(){
 const gross=state.earnings.reduce((s,e)=>s+num(e.gross),0),expenses=state.earnings.reduce((s,e)=>s+num(e.expenses),0);
 $('grossTotal').textContent=money(gross);$('expenseTotal').textContent=money(expenses);$('netTotal').textContent=money(gross-expenses);
 $('earningsList').innerHTML=state.earnings.length?state.earnings.slice().reverse().map((e,reverseIndex)=>{const i=state.earnings.length-1-reverseIndex;return '<article class="gig-card"><h3>'+escape(e.title)+'</h3><p>'+escape(e.date)+' · '+num(e.miles)+' miles</p><p>Gross pay: '+money(e.gross)+' · Expenses: '+money(e.expenses)+'</p><div class="pay">Net: '+money(num(e.gross)-num(e.expenses))+'</div><div class="actions"><button type="button" class="button danger" data-delete-earning="'+i+'">Delete record</button></div></article>';}).join(''):'<p class="empty">No earnings recorded yet.</p>';
 $('earningsList').querySelectorAll('[data-delete-earning]').forEach(b=>b.addEventListener('click',()=>{state.earnings.splice(Number(b.dataset.deleteEarning),1);persist();renderEarnings();}));
}
['pay','miles','hours','mpg','fuel','wear','other'].forEach(id=>$(id).addEventListener('input',updateCalculator));
$('gigForm').addEventListener('submit',e=>{e.preventDefault();const f=new FormData(e.currentTarget);state.gigs.push({title:String(f.get('title')).trim(),pickup:String(f.get('pickup')).trim(),dropoff:String(f.get('dropoff')).trim(),pay:num(f.get('pay')),miles:num(f.get('miles')),status:String(f.get('status')),notes:String(f.get('notes')).trim(),createdAt:new Date().toISOString()});persist();renderGigs();e.currentTarget.reset();$('formStatus').textContent='Saved in this browser only. This lead has not been published or verified.';});
$('earningsForm').addEventListener('submit',e=>{e.preventDefault();const f=new FormData(e.currentTarget);state.earnings.push({title:String(f.get('title')).trim(),gross:num(f.get('gross')),expenses:num(f.get('expenses')),miles:num(f.get('miles')),date:String(f.get('date'))||new Date().toISOString().slice(0,10)});persist();renderEarnings();e.currentTarget.reset();e.currentTarget.elements.namedItem('date').value=new Date().toISOString().slice(0,10);e.currentTarget.elements.namedItem('expenses').value='0';e.currentTarget.elements.namedItem('miles').value='0';});
$('exportData').addEventListener('click',()=>{const blob=new Blob([JSON.stringify({exportedAt:new Date().toISOString(),...state},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='milecount-courier-data.json';a.click();URL.revokeObjectURL(url);});
$('clearData').addEventListener('click',()=>{if(!confirm('Clear all Courier Hub opportunities and earnings stored in this browser? This cannot be undone.'))return;state={gigs:[],earnings:[]};persist();renderGigs();renderEarnings();$('formStatus').textContent='Browser data cleared.';});
$('earningsForm').elements.namedItem('date').value=new Date().toISOString().slice(0,10);
updateCalculator();renderGigs();renderEarnings();
})();