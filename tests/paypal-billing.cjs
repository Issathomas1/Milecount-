const assert=require('node:assert/strict'),fs=require('node:fs'),{PGlite}=require('@electric-sql/pglite');
(async()=>{
 const {createHandler}=await import('../supabase/functions/paypal-billing/handler.mjs');
 const {BASIC,validatePlan,paidSnapshot,nextMonth}=await import('../supabase/functions/paypal-billing/policy.mjs');
 const db=new PGlite();
 const user='00000000-0000-0000-0000-000000000001',other='00000000-0000-0000-0000-000000000002';
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);
 insert into auth.users values ('${user}'),('${other}');
 create table public.subscriptions(user_id uuid primary key,provider text,provider_subscription_id text,plan text,status text,current_period_end timestamptz,updated_at timestamptz);
 grant all on public.subscriptions to service_role;`);
 await db.exec(fs.readFileSync('supabase/migrations/20261002145456_paypal_billing.sql','utf8'));
 await db.exec('set role authenticated');
 await assert.rejects(()=>db.query('select * from paypal_checkouts'),/permission denied/);
 await assert.rejects(()=>db.query(`select reserve_paypal_checkout('${user}','live','basic','x')`),/permission denied/);
 await assert.rejects(()=>db.query(`select revoke_paypal_payment('live','x','y')`),/permission denied/);
 await db.exec('reset role');
 let plan={status:'ACTIVE',billing_cycles:[{tenure_type:'REGULAR',frequency:{interval_unit:'MONTH',interval_count:1},total_cycles:0,pricing_scheme:{fixed_price:{currency_code:'USD',value:'19.00'}}}],payment_preferences:{setup_fee:{value:'0'}}};
 validatePlan(plan);
 assert.throws(()=>validatePlan({...plan,billing_cycles:[]}),/not ready/);
 assert.throws(()=>validatePlan({...plan,taxes:{percentage:'7'}}),/tax/);
 assert.equal(new Date(nextMonth('2026-01-31T12:00:00Z')).toISOString(),'2026-02-28T12:00:00.000Z');
 const env={SUPABASE_URL:'https://db.example',SUPABASE_SERVICE_ROLE_KEY:'server-only',PAYPAL_ENVIRONMENT:'live',PAYPAL_CLIENT_ID:'public-client',PAYPAL_CLIENT_SECRET:'server-secret',PAYPAL_WEBHOOK_ID:'WH-CONFIG',PAYPAL_CHECKOUT_ENABLED:'true'};
 let actingUser=user,admin=false,verify=true,failPayPal=false,creationCalls=0,sub=null,transactions=[];const requests=[];
 const response=(data,status=200)=>new Response(JSON.stringify(data),{status});
 const fetch=async(url,options={})=>{
  requests.push({url,options});const u=new URL(url),body=options.body?JSON.parse(options.body.startsWith('{')?options.body:'{}'):{};
  if(u.origin==='https://db.example') {
   if(u.pathname==='/auth/v1/user')return options.headers.Authorization==='Bearer valid'?response({id:actingUser}):response({},401);
   if(u.pathname.endsWith('/milecount_entitlements'))return response({admin,active:false});
   if(u.pathname.includes('/rpc/')){
    const name=u.pathname.split('/').pop(),entries=Object.entries(body);
    assert.match(name,/^(reserve_paypal_request|reserve_paypal_checkout|attach_paypal_subscription|begin_paypal_sync|apply_paypal_sync|revoke_paypal_payment)$/);
    const result=await db.query(`select to_json(${name}(${entries.map(([k],i)=>k+' := $'+(i+1)).join(',')})) as result`,entries.map(([,v])=>v));return response(result.rows[0].result);
   }
   assert.equal(u.pathname,'/rest/v1/paypal_checkouts');
   const conditions=[],params=[];
   for(const field of ['id','environment','user_id','subscription_id','current'])if(u.searchParams.has(field)){params.push(u.searchParams.get(field).slice(3));conditions.push(field+'=$'+params.length);}
   return response((await db.query('select * from paypal_checkouts where '+conditions.join(' and ')+' limit 1',params)).rows);
  }
  if(failPayPal)return response({},503);
  if(u.pathname.endsWith('/token'))return response({access_token:'fake-token',expires_in:3600});
  if(u.pathname.includes('verify-webhook-signature'))return response({verification_status:verify?'SUCCESS':'FAILURE'});
  if(u.pathname.includes('/plans/'))return response(plan);
  if(u.pathname.endsWith('/transactions'))return response({transactions,total_pages:1});
  if(u.pathname.endsWith('/cancel')){sub.status='CANCELLED';delete sub.billing_info.next_billing_time;return new Response(null,{status:204});}
  if(u.pathname.endsWith('/subscriptions')){
   creationCalls++;assert.ok(options.headers['PayPal-Request-Id']);assert.equal(body.plan_id,env.PAYPAL_ENVIRONMENT==='live'?BASIC.livePlanId:'P-SANDBOX');
   sub={id:'I-TEST'+creationCalls,plan_id:body.plan_id,custom_id:body.custom_id,status:'APPROVAL_PENDING',links:[{rel:'approve',href:'https://www.paypal.com/approve?subscription='+creationCalls}],billing_info:{}};return response(sub);
  }
  if(u.pathname.includes('/subscriptions/I-'))return response(sub);
  throw Error('Unexpected request '+url);
 };
 let handler=createHandler({env:k=>env[k],fetch});
 const call=async(body,token='valid',origin='https://milecount.editallfutures.com')=>handler(new Request('https://db.example/functions/v1/paypal-billing',{method:'POST',headers:{Authorization:'Bearer '+token,Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(body)}));
 const hook=async(event)=>handler(new Request('https://db.example/functions/v1/paypal-billing/webhook',{method:'POST',headers:{'paypal-auth-algo':'SHA256withRSA','paypal-cert-url':'https://api.paypal.com/cert','paypal-transmission-id':'id','paypal-transmission-sig':'signature','paypal-transmission-time':new Date().toISOString()},body:JSON.stringify(event)}));
 assert.equal((await call({action:'create',plan:'basic'},'forged')).status,401);
 assert.equal((await call({action:'create',plan:'basic'},'valid','https://evil.example')).status,403);
 assert.equal((await call({action:'create',plan:'platinum'})).status,400);
 admin=true;assert.equal((await call({action:'create',plan:'basic'})).status,409);admin=false;
 const created=await (await call({action:'create',plan:'basic'})).json();assert.equal(created.active,false);assert.equal(creationCalls,1);
 await call({action:'create',plan:'basic'});assert.equal(creationCalls,1,'double click resumes the same subscription');
 let row=(await db.query('select * from paypal_checkouts')).rows[0];
 sub.status='ACTIVE';assert.equal((await (await call({action:'status'})).json()).active,false,'ACTIVE with no payment never grants access');
 const paidAt=new Date(Date.now()-60000).toISOString(),end=new Date(nextMonth(paidAt)).toISOString();
 sub.billing_info={last_payment:{time:paidAt,amount:{currency_code:'USD',value:'19.00'}},next_billing_time:end};
 transactions=[{id:'SALE1',status:'PENDING',time:paidAt,amount_with_breakdown:{gross_amount:{currency_code:'USD',value:'19.00'}}}];
 assert.equal((await (await call({action:'status'})).json()).active,false,'pending money is not paid access');
 transactions[0].status='COMPLETED';
 let status=await (await call({action:'status'})).json();assert.equal(status.active,true);
 assert.equal((await db.query('select plan from subscriptions')).rows[0].plan,'basic');
 actingUser=other;status=await (await call({action:'status',subscriptionId:created.subscriptionId})).json();assert.equal(status.status,'NONE');actingUser=user;
 const goodCustom=sub.custom_id;sub.custom_id=other;assert.equal((await call({action:'status'})).status,503);sub.custom_id=goodCustom;
 const goodPlan=sub.plan_id;sub.plan_id='P-WRONG';assert.equal((await call({action:'status'})).status,503);sub.plan_id=goodPlan;
 failPayPal=true;assert.equal((await call({action:'status'})).status,503);assert.equal((await db.query('select status from subscriptions')).rows[0].status,'active');failPayPal=false;
 await db.exec('set role service_role');
 await assert.rejects(()=>db.query("update subscriptions set provider='stripe',plan='pro'"),/verified billing writer/);await db.exec('reset role');
 status=await (await call({action:'cancel'})).json();assert.equal(status.status,'CANCELLED');assert.equal(status.active,true,'cancellation preserves the paid period');
 verify=false;assert.equal((await hook({id:'EV-REFUND',event_type:'PAYMENT.SALE.REFUNDED',resource:{sale_id:'SALE1'}})).status,401);
 assert.equal((await db.query('select count(*)::int n from paypal_revoked_payments')).rows[0].n,0);
 verify=true;const refund={id:'EV-REFUND',event_type:'PAYMENT.SALE.REFUNDED',resource:{sale_id:'SALE1'}};
 await hook(refund);await hook(refund);assert.equal((await db.query('select count(*)::int n from paypal_revoked_payments')).rows[0].n,1);
 assert.equal((await db.query('select status from subscriptions')).rows[0].status,'inactive');
 sub.status='ACTIVE';status=await (await call({action:'status'})).json();assert.equal(status.active,false,'stale PayPal data cannot restore a refunded payment');
 const v1=(await db.query('select begin_paypal_sync($1) v',[row.id])).rows[0].v;
 await db.query('select begin_paypal_sync($1)',[row.id]);
 assert.equal((await db.query("select apply_paypal_sync($1,$2,'ACTIVE','SALE2',$3) ok",[row.id,v1,end])).rows[0].ok,false,'older snapshot loses to a newer sync');
 const expired=structuredClone(sub);expired.billing_info.last_payment.time='2020-01-01T00:00:00Z';assert.equal(paidSnapshot(expired,transactions,row).paidUntil,null);
 // A sandbox transaction is isolated in its own checkout and never writes live entitlements.
 env.PAYPAL_ENVIRONMENT='sandbox';env.PAYPAL_SANDBOX_BASIC_PLAN_ID='P-SANDBOX';handler=createHandler({env:k=>env[k],fetch});
 await call({action:'create',plan:'basic'});sub.status='ACTIVE';sub.billing_info={last_payment:{time:paidAt,amount:{currency_code:'USD',value:'19.00'}},next_billing_time:end};
 transactions[0].id='SANDBOXSALE';status=await (await call({action:'status'})).json();assert.equal(status.active,true);assert.equal(status.environment,'sandbox');
 assert.equal((await db.query('select status from subscriptions')).rows[0].status,'inactive');
 env.PAYPAL_CHECKOUT_ENABLED='false';handler=createHandler({env:k=>env[k],fetch});
 const config=await (await handler(new Request('https://db.example/functions/v1/paypal-billing'))).json();assert.equal(config.enabled,false);assert.equal(config.clientId,null);
 assert.equal((await call({action:'create',plan:'basic'})).status,503);
 await db.close();
 console.log('PASS PayPal: auth/ownership, settled payment only, plan/price validation, duplicate checkout, cancellation, verified refunds, stale events, sandbox isolation, RLS and legacy-writer protection');
})().catch(e=>{console.error(e);process.exitCode=1});
