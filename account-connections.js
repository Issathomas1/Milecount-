(function(){
  'use strict';
  const $ = id => document.getElementById(id);
  const escape = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let userId, state, busy=false, active=false, instance, sdk, timer, refreshTimer, revision=0;
  const money = (n,currency) => { try { return new Intl.NumberFormat('en-US',{style:'currency',currency}).format(n); } catch { return n.toFixed(2)+' '+currency; } };
  const time = value => value ? new Date(value).toLocaleString() : 'Not received yet';
  function message(text){ $('connectionStatus').textContent=text; }
  function controls(){
    document.querySelectorAll('[data-connect],[data-reconnect]').forEach(b=>{
      const provider=b.dataset.connect||b.dataset.reconnect;
      b.disabled=busy||active||!$('connectionConsent').checked||!state?.configured||!state.providers.some(p=>p.key===provider&&p.available);
    });
    document.querySelectorAll('[data-disconnect]').forEach(b=>b.disabled=busy||active);
    $('refreshConnections').disabled=busy||active||!state?.configured;
  }
  async function call(action, extra={}) {
    const session=await MileCountCloud.session();
    if(!session || session.user.id!==userId){
      revision++; state=null; userId=null; busy=false; $('connectionAccounts').replaceChildren(); $('connectionEarnings').replaceChildren(); $('connectionFreshness').textContent=''; controls();
      message('Your MileCount session changed. Sign in again and reload this page.');
      throw Error('Your MileCount session changed. Sign in again and reload this page.');
    }
    const response=await fetch(MC_URL+'/functions/v1/argyle-connect',{method:'POST',cache:'no-store',
      headers:{apikey:MC_KEY,Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},
      body:JSON.stringify({action,...extra}),signal:AbortSignal.timeout(65000)});
    const data=await response.json().catch(()=>({}));
    if(!response.ok||!data.ok)throw Error(data.error||'Unable to reach account connections. Please retry.');
    return data;
  }
  function render(){
    $('connectionEnvironment').hidden=!state?.configured;
    $('connectionEnvironment').textContent=state?.environment==='sandbox'?'TEST MODE · Argyle sample accounts only':'Earnings & completed deliveries';
    $('connectionEnvironment').classList.toggle('demo',state?.environment==='sandbox');
    $('connectionConsentArea').hidden=!state?.configured;
    $('connectionPlatforms').innerHTML=(state?.providers||[]).map(p=>'<article class="connection-platform"><strong>'+escape(p.name)+'</strong><span class="muted">'+(p.available?'Connect with Argyle':'Awaiting activation')+'</span><button type="button" data-connect="'+escape(p.key)+'">'+(state.environment==='sandbox'?'Test connection':'Connect')+'</button></article>').join('');
    $('connectionAccounts').innerHTML=(state?.accounts||[]).map(a=>'<article class="job"><strong>'+escape(a.name)+'</strong><p>'+escape(a.status==='connected'?'Connected':a.status==='connecting'?'Connecting':a.needsReconnect?'Reconnect required':'Status unavailable')+' · Delivery sync: '+escape(a.syncStatus)+'</p><p class="muted">Provider last checked: '+escape(time(a.scannedAt))+'<br>Ongoing updates: '+escape(a.refreshStatus)+'</p><div class="actions">'+(a.provider?'<button type="button" data-reconnect="'+escape(a.provider)+'" data-account="'+escape(a.id)+'">Reconnect</button>':'')+'<button type="button" data-disconnect="'+escape(a.id)+'">Disconnect & delete shared data</button></div></article>').join('');
    if(state?.configured&&!state.accounts?.length)$('connectionAccounts').innerHTML='<p class="muted">No work accounts connected to this MileCount login.</p>';
    const activity=state?.activity;
    if(!activity){$('connectionEarnings').replaceChildren();}
    else {
      $('connectionEarnings').innerHTML='<h3>'+(state.environment==='sandbox'?'Sample ':'')+'Completed deliveries · last 30 days</h3><p class="muted">Recorded driver earnings before vehicle costs and tax. Only completed delivery work is included. Bonuses, adjustments, pending offers and missing records may not be included. This is not a complete pay statement.</p>'+
        (activity.partial?'<p class="notice demo">Partial results: this view reached its record limit. These totals are incomplete.</p>':'')+
        (activity.completed?'<div class="metrics">'+activity.totals.map(t=>'<div class="metric"><span>'+escape(t.currency||'Currency missing')+' · '+t.completed+' completed deliveries</span><b>'+(t.paidRecords?escape(money(t.earnings,t.currency)):'Pay unavailable')+'</b><small>'+t.missingPay+' missing pay record'+(t.missingPay===1?'':'s')+'</small></div>').join('')+'</div><details><summary>Recent completed deliveries</summary><div class="connection-table"><table><thead><tr><th scope="col">Platform / date</th><th scope="col">Driver pay</th><th scope="col">Trip miles</th></tr></thead><tbody>'+activity.records.map(r=>'<tr><td>'+escape(state.accounts.find(a=>a.id===r.accountId)?.name||'Work account')+'<br><small>'+escape(time(r.start))+'</small></td><td>'+(r.pay===null?'Unavailable':escape(money(r.pay,r.currency)))+'</td><td>'+(r.miles===null?'Unavailable':Number(r.miles).toFixed(1))+'</td></tr>').join('')+'</tbody></table></div><p class="muted">Showing up to 50 recent records. Trip miles can exclude travel to pickup and the drive home.</p></details>':'<p>No completed delivery records available in this period. Initial syncing may still be in progress.</p>');
    }
    $('connectionFreshness').textContent=state?.checkedAt?'MileCount checked '+time(state.checkedAt)+'. Checks automatically every minute while this page is visible; the provider controls when new data arrives.':'';
    controls();
  }
  async function refresh(quiet=false){
    if(busy||active||!userId)return; busy=true;controls();const version=++revision;
    if(!quiet)message('Checking your account connections…');
    try {
      const data=await call('activity'); if(version!==revision)return;
      state=data;render();message(data.message);
    } catch(e){if(version===revision)message(e.name==='TimeoutError'?'The connection check timed out. Please retry.':e.message);}
    finally{if(version===revision){busy=false;controls();}}
  }
  function loadSDK(){
    if(window.Argyle)return Promise.resolve();
    if(sdk)return sdk;
    sdk=new Promise((resolve,reject)=>{
      const script=document.createElement('script');script.src='https://plugin.argyle.com/argyle.web.v5.js';script.async=true;
      const timeout=setTimeout(()=>fail(),15000);
      function fail(){clearTimeout(timeout);script.remove();sdk=null;reject(Error('Argyle’s secure sign-in screen could not load. Please retry.'));}
      script.onerror=fail;script.onload=()=>{clearTimeout(timeout);window.Argyle?resolve():fail();};document.head.append(script);
    });return sdk;
  }
  function scheduleRefresh(){clearTimeout(refreshTimer);refreshTimer=setTimeout(()=>refresh(),2500);}
  async function connect(provider,accountId){
    if(busy||active||!$('connectionConsent').checked)return;busy=true;controls();
    try {
      const data=await call('link',{provider,accountId,consent:true});
      if(!data.configured||!data.userToken){state=data;render();message(data.message);return;}
      await loadSDK();
      active=true;
      instance=Argyle.create({userToken:data.userToken,sandbox:data.environment==='sandbox',flowId:data.flowId,items:data.items,
        ...(data.accountId?{accountId:data.accountId}:{}),
        onAccountConnected:()=>{message('Account linked. Argyle is retrieving your delivery activity.');},
        onAccountError:()=>message('This account needs attention. Follow the instructions in Argyle or close and retry.'),
        onTokenExpired:()=>{instance?.close();active=false;message('The secure connection expired. Click Connect or Reconnect to try again.');controls();},
        onClose:()=>{active=false;instance=null;controls();scheduleRefresh();}
      });
      instance.open();message(data.environment==='sandbox'?'Argyle test sign-in is open. Use sample accounts only.':'Finish sign-in in Argyle. MileCount does not receive your driver password.');
    }catch(e){active=false;message(e.message||'Unable to open account sign-in.');}
    finally{busy=false;controls();}
  }
  async function disconnect(accountId){
    if(busy||active)return;
    const account=state?.accounts.find(a=>a.id===accountId);if(!account)return;
    if(!confirm('Disconnect '+account.name+' from MileCount and delete its shared records from this Argyle connection? This cannot be undone; you can connect again. Your driver account and bookings are not deleted.'))return;
    busy=true;controls();revision++;
    try{await call('disconnect',{accountId,confirm:true});state.accounts=state.accounts.filter(a=>a.id!==accountId);state.activity=null;render();message('Disconnected. Shared records for this connection were deleted.');scheduleRefresh();}
    catch(e){message(e.message);}finally{busy=false;controls();}
  }
  function init(id){
    if(userId)return;userId=id;
    $('connectionConsent').addEventListener('change',controls);
    $('refreshConnections').onclick=()=>refresh();
    $('connections').addEventListener('click',e=>{
      const link=e.target.closest('[data-connect],[data-reconnect]'),remove=e.target.closest('[data-disconnect]');
      if(link)connect(link.dataset.connect||link.dataset.reconnect,link.dataset.account);
      if(remove)disconnect(remove.dataset.disconnect);
    });
    refresh();
    timer=setInterval(()=>{if(document.visibilityState==='visible'&&state?.configured)refresh(true);},60000);
    addEventListener('pagehide',()=>{revision++;clearInterval(timer);clearTimeout(refreshTimer);instance?.close();});
  }
  window.MileCountConnections={init};
})();
