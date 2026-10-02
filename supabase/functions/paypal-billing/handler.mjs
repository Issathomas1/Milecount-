import {BASIC,validatePlan,paidSnapshot,approvalLink} from './policy.mjs';

export function createHandler({env,fetch:request=fetch,now=()=>Date.now()}) {
 const environment=env('PAYPAL_ENVIRONMENT');
 const api=environment==='live'?'https://api-m.paypal.com':'https://api-m.sandbox.paypal.com';
 const base=env('SUPABASE_URL'),service=env('SUPABASE_SERVICE_ROLE_KEY');
 const client=env('PAYPAL_CLIENT_ID'),secret=env('PAYPAL_CLIENT_SECRET'),webhook=env('PAYPAL_WEBHOOK_ID');
 const planId=environment==='live'?BASIC.livePlanId:env('PAYPAL_SANDBOX_BASIC_PLAN_ID');
 const configured=!!(['live','sandbox'].includes(environment)&&client&&secret&&webhook&&planId&&base&&service);
 const enabled=configured&&env('PAYPAL_CHECKOUT_ENABLED')==='true';
 const allowed=new Set(['https://milecount.editallfutures.com','https://milecount.pages.dev','https://issathomas1.github.io']);
 if(environment==='sandbox'&&env('PAYPAL_PREVIEW_ORIGIN'))allowed.add(env('PAYPAL_PREVIEW_ORIGIN'));
 let token=null,tokenUntil=0;
 const error=(message,status=400)=>Object.assign(Error(message),{status});
 async function json(url,options={}) {
  const r=await request(url,{...options,signal:AbortSignal.timeout(15000)});
  if(!r.ok)throw error('Billing service is temporarily unavailable. Your trip and account are unchanged.',503);
  return r.status===204?{}:r.json();
 }
 async function pp(path,options={}) {
  if(!token||tokenUntil<=now()) {
   const t=await json(api+'/v1/oauth2/token',{method:'POST',headers:{Authorization:'Basic '+btoa(client+':'+secret),'Content-Type':'application/x-www-form-urlencoded'},body:'grant_type=client_credentials'});
   if(!t.access_token)throw error('PayPal connection is unavailable.',503);
   token=t.access_token;tokenUntil=now()+Math.max(0,Number(t.expires_in)-60)*1000;
  }
  return json(api+path,{...options,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json',...options.headers}});
 }
 const db=(path,options={})=>json(base+'/rest/v1/'+path,{...options,headers:{apikey:service,Authorization:'Bearer '+service,'Content-Type':'application/json',...options.headers}});
 const rpc=(name,args)=>db('rpc/'+name,{method:'POST',body:JSON.stringify(args)});
 async function lookup(query) {return (await db('paypal_checkouts?select=*&environment=eq.'+environment+'&'+query+'&limit=1'))[0];}
 async function details(id) {
  if(!/^I-[A-Z0-9]+$/.test(id))throw error('Invalid subscription reference');
  return pp('/v1/billing/subscriptions/'+id);
 }
 async function sync(c) {
  const version=await rpc('begin_paypal_sync',{p_checkout:c.id});
  // Always fetch AFTER the revision reservation, including for delayed webhook events.
  const sub=await details(c.subscription_id);
  const start=new Date(now()-62*86400000).toISOString(),end=new Date(now()).toISOString();
  const history=await pp('/v1/billing/subscriptions/'+c.subscription_id+'/transactions?start_time='+encodeURIComponent(start)+'&end_time='+encodeURIComponent(end));
  if(!Array.isArray(history.transactions)||history.total_pages>1||history.links?.some(l=>l.rel==='next'))throw error('Payment history needs another verification. Please try again.',503);
  const paid=paidSnapshot(sub,history.transactions,c,now());
  const applied=await rpc('apply_paypal_sync',{p_checkout:c.id,p_version:version,p_status:paid.status,p_payment:paid.paymentId,p_paid_until:paid.paidUntil});
  if(!applied)throw error('A newer payment update is processing. Please check again.',409);
  // Read back because a refunded transaction can be denied by the database.
  const stored=await lookup('id=eq.'+c.id);
  return {subscriptionId:c.subscription_id,status:stored.provider_status,active:Date.parse(stored.paid_until)>now(),paidUntil:stored.paid_until,environment,approvalUrl:sub.status==='APPROVAL_PENDING'?approvalLink(sub,environment):null};
 }
 async function handleWebhook(req) {
  if(!configured)throw error('Billing is not configured',503);
  if(Number(req.headers.get('content-length')||0)>262144)throw error('Request too large',413);
  const raw=await req.text();if(raw.length>262144)throw error('Request too large',413);
  const event=JSON.parse(raw),verify={webhook_id:webhook,webhook_event:event};
  for(const key of ['auth_algo','cert_url','transmission_id','transmission_sig','transmission_time']) {
   verify[key]=req.headers.get('paypal-'+key.replaceAll('_','-'));
   if(!verify[key])throw error('Missing webhook signature',401);
  }
  const verified=await pp('/v1/notifications/verify-webhook-signature',{method:'POST',body:JSON.stringify(verify)});
  if(verified.verification_status!=='SUCCESS')throw error('Invalid webhook signature',401);
  const resource=event.resource||{},type=event.event_type||'';
  if(!event.id)throw error('Missing event reference');
  if(['PAYMENT.SALE.REFUNDED','PAYMENT.SALE.REVERSED'].includes(type)) {
   const paymentId=type==='PAYMENT.SALE.REFUNDED'?resource.sale_id:resource.id;
   if(!paymentId)throw error('Payment reversal needs review',503);
   await rpc('revoke_paypal_payment',{p_environment:environment,p_payment:paymentId,p_event:event.id});
   return {received:true};
  }
  if(!type.startsWith('BILLING.SUBSCRIPTION.')&&!['PAYMENT.SALE.COMPLETED','PAYMENT.SALE.DENIED'].includes(type))return {received:true};
  const id=type.startsWith('BILLING.SUBSCRIPTION.')?resource.id:resource.billing_agreement_id;
  if(!id)return {received:true};
  let c=await lookup('subscription_id=eq.'+encodeURIComponent(id));
  if(!c) {
   const sub=await details(id);
   if(!/^[0-9a-f-]{36}$/i.test(sub.custom_id||''))return {received:true};
   c=await lookup('id=eq.'+sub.custom_id);
   if(!c||sub.plan_id!==c.plan_id)return {received:true};
   await rpc('attach_paypal_subscription',{p_checkout:c.id,p_subscription:id});c.subscription_id=id;
  }
  await sync(c);return {received:true};
 }
 return async req=>{
  const origin=req.headers.get('origin'),headers={'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin'};
  if(origin&&allowed.has(origin))Object.assign(headers,{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization,apikey,content-type','Access-Control-Allow-Methods':'GET,POST,OPTIONS'});
  const reply=(body,status=200)=>new Response(JSON.stringify(body),{status,headers});
  try {
   const isWebhook=new URL(req.url).pathname.endsWith('/webhook');
   if(origin&&!allowed.has(origin))return reply({error:'Origin not allowed'},403);
   if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
   if(isWebhook) {
    if(req.method!=='POST')return reply({error:'Method not allowed'},405);
    return reply(await handleWebhook(req));
   }
   if(req.method==='GET')return reply({enabled,environment:environment||null,clientId:enabled?client:null,plans:enabled?[{key:'basic',name:'Basic',amount:'19.00',currency:'USD',planId}]:[]});
   if(req.method!=='POST')return reply({error:'Method not allowed'},405);
   const authorization=req.headers.get('authorization');
   if(!authorization?.startsWith('Bearer '))return reply({error:'Sign in to MileCount first.'},401);
   const userResponse=await request(base+'/auth/v1/user',{headers:{apikey:service,Authorization:authorization},signal:AbortSignal.timeout(10000)});
   if(!userResponse.ok)return reply({error:'Please sign in again.'},401);
   const user=await userResponse.json();if(!user.id||user.is_anonymous)return reply({error:'Use a registered MileCount account.'},401);
   if(!configured)return reply({error:'Checkout is not ready yet. No payment has been started.'},503);
   const input=await req.json();
   if(!['create','status','cancel'].includes(input.action))throw error('Unknown billing action');
   const quota=await rpc('reserve_paypal_request',{p_user:user.id});
   if(!quota)throw error('Please wait before checking billing again.',429);
   let c=await lookup('user_id=eq.'+user.id+'&current=eq.true');
   if(input.action==='cancel') {
    if(!c?.subscription_id)throw error('No subscription was found for this account.',404);
    const sub=await details(c.subscription_id);
    if(sub.custom_id!==c.id||sub.plan_id!==c.plan_id)throw error('Subscription association conflict',409);
    if(!['CANCELLED','EXPIRED'].includes(sub.status))await pp('/v1/billing/subscriptions/'+c.subscription_id+'/cancel',{method:'POST',body:JSON.stringify({reason:'Customer cancelled future payments in MileCount'})});
    const status=await sync(c);
    if(!['CANCELLED','EXPIRED'].includes(status.status))throw error('Cancellation is processing. Please check again.',409);
    return reply(status);
   }
   if(input.action==='status')return reply(c?.subscription_id?await sync(c):{active:false,status:'NONE',environment});
   if(!enabled)throw error('Checkout is not ready yet. No payment has been started.',503);
   if(input.plan!=='basic')throw error('That plan is not available for purchase yet');
   const plan=await pp('/v1/billing/plans/'+planId);validatePlan(plan);
   const entitlementResponse=await json(base+'/rest/v1/rpc/milecount_entitlements',{method:'POST',headers:{apikey:service,Authorization:authorization,'Content-Type':'application/json'},body:'{}'});
   if(entitlementResponse.admin)throw error('Your owner account already has full access.',409);
   if(c?.subscription_id) {
    const current=await sync(c);
    if(current.approvalUrl)return reply(current);
    if(current.active||!['CANCELLED','EXPIRED'].includes(current.status))throw error('You already have a subscription. Manage it before starting another.',409);
   } else if(entitlementResponse.active)throw error('Your account already has a paid subscription.',409);
   c=await rpc('reserve_paypal_checkout',{p_user:user.id,p_environment:environment,p_plan:'basic',p_plan_id:planId});
   if(c.subscription_id)return reply(await sync(c));
   // Never retry an unresolved creation past the guaranteed local retry window.
   if(now()-Date.parse(c.created_at)>3600000)throw error('An earlier checkout needs recovery. Contact support before trying again.',409);
   const sub=await pp('/v1/billing/subscriptions',{method:'POST',headers:{'PayPal-Request-Id':c.id,'Prefer':'return=representation'},body:JSON.stringify({plan_id:planId,custom_id:c.id,application_context:{brand_name:'MileCount',user_action:'SUBSCRIBE_NOW',shipping_preference:'NO_SHIPPING',return_url:'https://milecount.editallfutures.com/pricing.html?payment=return',cancel_url:'https://milecount.editallfutures.com/pricing.html?payment=cancel'}})});
   if(!/^I-[A-Z0-9]+$/.test(sub.id||''))throw error('PayPal did not return a subscription reference.',503);
   await rpc('attach_paypal_subscription',{p_checkout:c.id,p_subscription:sub.id});
   return reply({subscriptionId:sub.id,status:sub.status,active:false,environment,approvalUrl:approvalLink(sub,environment)});
  } catch(e) {
   return reply({error:e.status?e.message:'We could not verify billing right now. No access changes were made.'},e.status||503);
  }
 };
}
