/* Account connection UI; credentials are never stored by this module. */
(function(){
 'use strict';
 const $=id=>document.getElementById(id),client=window.MileCountDirectFreight;
 const form=$('dfConnectForm'),message=$('dfMessage');
 if(!form||!client)return;
 let revision=0;
 function render(data){
  const on=!!data?.connected;
  form.classList.toggle('hidden',on);$('dfConnected').classList.toggle('hidden',!on);
  $('dfSummary').textContent='Direct Freight · '+(on?'Connected':'Connect your account');
  $('dfManage').textContent='Direct Freight · '+(on?'Manage connection':'Connect account');
  $('dfAccount').textContent=on?(data.connection?.account_email||data.accountEmail||'Account connected'):'';
  const tier=String(data.connection?.subscription_tier||data.subscriptionTier||'unknown').toLowerCase();
  $('dfPlan').textContent=on?(tier.includes('free')?'Free account connected. Search listings; contact details follow your Direct Freight allowance.':'Searches use your connected Direct Freight account.') : '';
 }
 $('dfManage').addEventListener('click',()=>{
  window.MileCountNavigation.go(1);
  $('directFreightPanel').open=true;
  $('directFreightPanel').scrollIntoView({block:'start'});
  $('dfSummary').focus();
 });
 form.addEventListener('submit',async event=>{
  event.preventDefault();if($('dfConnect').disabled)return;
  ++revision;$('dfConnect').disabled=true;message.textContent='Connecting securely…';
  try{
   const data=await client.connect($('dfEmail').value.trim(),$('dfPassword').value);
   if(!data.connected)throw Error('Connection was not confirmed. Please try again.');
   render(data);message.textContent='Connected. Searching Direct Freight loads…';
   $('dfSearch').click();
  }catch(error){message.textContent=error.message;}
  finally{$('dfPassword').value='';$('dfConnect').disabled=false;}
 });
 $('dfDisconnect').addEventListener('click',async()=>{
  ++revision;$('dfDisconnect').disabled=true;
  try{
   await client.disconnect();render({connected:false});message.textContent='Disconnected. Other freight sources remain available.';
   window.dispatchEvent(new CustomEvent('milecount:directfreight-disconnected'));
  }catch(error){message.textContent=error.message;}
  finally{$('dfDisconnect').disabled=false;}
 });
 window.addEventListener('milecount:directfreight-auth-required',()=>{
  ++revision;render({connected:false});message.textContent='Your Direct Freight login needs reconnecting. Other freight sources are still available.';
 });
 // Attach the controls before checking status. A late initial response cannot
 // undo a connection/disconnection made while the status check was in flight.
 const initial=revision;
 client.status().then(data=>{if(revision===initial)render(data);}).catch(error=>{
  if(revision===initial)message.textContent=error.message;
 });
})();
