/* PayPal approval is only a notification to recheck server-owned billing state. */
(()=>{
 const cloud=window.MileCountCloud,el=id=>document.getElementById(id);
 let config=null,busy=false,preparing=false,rendered=false,buttons=null;
 function message(text){el('billingStatus').textContent=text;}
 function showPanel(){el('checkoutPanel').hidden=false;el('checkoutPanel').scrollIntoView({behavior:'smooth',block:'start'});}
 function disableCheckout(){el('paypalButtons').hidden=true;}
 async function check(){
  if(busy)return;busy=true;el('checkPayment').disabled=true;
  try {
   const session=await cloud.session();
   if(!session){el('billingSignIn').hidden=false;message('Sign in to check your subscription. You do not need to pay again.');return;}
   el('billingSignIn').hidden=true;el('billingAccount').textContent='Signed in as '+session.user.email;
   const status=await cloud.billing('status');
   if(status.active){disableCheckout();message((status.environment==='sandbox'?'TEST PAYMENT VERIFIED — no live access changed. ':'Basic is active. ')+(status.paidUntil?'Paid through '+new Date(status.paidUntil).toLocaleDateString()+'.':''));}
   else if(status.status==='NONE')message('No subscription has been started.');
   else message('Payment is not confirmed yet. Check again shortly; do not start another subscription.');
   el('cancelSubscription').hidden=!['ACTIVE','SUSPENDED','APPROVED','APPROVAL_PENDING'].includes(status.status);
  }catch(e){message('We could not check your payment yet. Use “Check payment” to retry. Do not pay again.');}
  finally{busy=false;el('checkPayment').disabled=false;}
 }
 function loadSDK(){
  if(window.paypal)return Promise.resolve();
  return new Promise((resolve,reject)=>{
   const script=document.createElement('script');
   script.src='https://www.paypal.com/sdk/js?client-id='+encodeURIComponent(config.clientId)+'&vault=true&intent=subscription&currency=USD&components=buttons';
   script.onload=resolve;script.onerror=()=>{script.remove();reject(Error('PayPal could not load. Please try again.'));};
   document.head.appendChild(script);
  });
 }
 async function prepare(){
  if(preparing)return;preparing=true;
  try{return await prepareCheckout();}finally{preparing=false;}
 }
 async function prepareCheckout(){
  showPanel();const session=await cloud.session();
  el('billingSignIn').hidden=!!session;el('billingAccount').textContent=session?'Signed in as '+session.user.email:'Sign in to connect your payment to your MileCount account.';
  if(!session){disableCheckout();message('Sign in below before subscribing.');return;}
  const access=await cloud.entitlements();
  if(access.admin){disableCheckout();message('Your owner account already has full access. No subscription is needed.');return;}
  if(access.active){disableCheckout();message('Your paid plan is already active.');return;}
  if(!config?.enabled){disableCheckout();message('Payment setup is being completed. No payment can be started here yet.');return;}
  message(config.environment==='sandbox'?'TEST CHECKOUT — use a PayPal sandbox account.':'Basic: $19 USD each month. Renews until cancelled. No setup fee.');
  if(rendered){el('paypalButtons').hidden=false;return;}
  await loadSDK();
  buttons=window.paypal.Buttons({style:{shape:'rect',color:'gold',layout:'vertical',label:'subscribe'},
   createSubscription:async()=>{
    const checkout=await cloud.billing('create','basic');
    if(!checkout.subscriptionId)throw Error('Checkout could not be started.');
    return checkout.subscriptionId;
   },
   onApprove:async()=>{disableCheckout();message('Checking your payment with PayPal…');await check();},
   onCancel:()=>message('PayPal checkout was closed. Use “Check payment” if you already approved it.'),
   onError:()=>message('Checkout could not finish. Check payment status before trying again.')
  });
  await buttons.render('#paypalButtons');rendered=true;el('paypalButtons').hidden=false;
 }
 document.querySelectorAll('[data-plan]').forEach(button=>button.addEventListener('click',async e=>{
  e.preventDefault();if(button.dataset.plan!=='basic'){showPanel();message('This plan is not open for purchase yet.');disableCheckout();return;}
  try{await prepare();}catch(e){message('Checkout is unavailable right now. No payment has been started.');disableCheckout();}
 }));
 el('billingSignIn').addEventListener('submit',async e=>{
  e.preventDefault();const button=el('billingSignInButton');button.disabled=true;
  try{await cloud.signIn(el('billingEmail').value.trim(),el('billingPassword').value);el('billingPassword').value='';await prepare();await check();}
  catch(e){message('Sign-in failed. Check your email and password, then try again.');}
  finally{button.disabled=false;}
 });
 el('checkPayment').addEventListener('click',check);
 el('cancelSubscription').addEventListener('click',async()=>{
  if(!window.confirm('Cancel future MileCount payments? Any remaining paid access will continue until its end date.'))return;
  try{await cloud.billing('cancel');await check();message('Future payments are cancelled. Any remaining paid access stays available through its end date.');el('cancelSubscription').hidden=true;}
  catch(e){message('Cancellation was not confirmed. Please try again or manage the subscription in PayPal.');}
 });
 cloud.billingConfig().then(c=>{config=c;el('billingAvailability').textContent=c.enabled?(c.environment==='sandbox'?'Sandbox checkout only. No real charges.':'Basic checkout is available through PayPal. Other plans are coming soon.'):'Payment setup is being completed. You cannot be charged here yet.';}).catch(()=>{el('billingAvailability').textContent='Payment setup is being completed. You cannot be charged here yet.';}).finally(()=>{
  const result=new URLSearchParams(location.search).get('payment');
  if(result){showPanel();if(result==='return'||result==='status')check();else message('Checkout was closed. Check payment status if you approved a subscription.');history.replaceState(null,'',location.pathname);}
 });
})();
