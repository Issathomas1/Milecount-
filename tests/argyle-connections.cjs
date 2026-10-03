const assert=require('node:assert/strict'),fs=require('node:fs');
const USER='11111111-1111-4111-8111-111111111111',ARGYLE='22222222-2222-4222-8222-222222222222',ACCOUNT='33333333-3333-4333-8333-333333333333',OTHER='44444444-4444-4444-8444-444444444444';
(async()=>{
 const {createHandler,summarizeGigs}=await import('../supabase/functions/argyle-connect/handler.mjs');
 const now=Date.parse('2026-10-03T16:00:00Z'),since=new Date(now-30*86400000).toISOString(),until=new Date(now).toISOString();
 const sample={id:'gig-1',account:ACCOUNT,status:'completed',type:'delivery',earning_type:'work',start_datetime:'2026-10-02T12:00:00Z',income:{total:'30.50',currency:'USD'},distance:'16.09344',distance_unit:'km',duration:1800};
 const summary=summarizeGigs([sample,sample,{...sample,id:'pending',status:'in_progress'},{...sample,id:'offer',earning_type:'offer'},{...sample,id:'other-user',account:OTHER},{...sample,id:'cancel',status:'cancelled'},{...sample,id:'old',start_datetime:'2025-01-01'},{...sample,id:'future',start_datetime:'2027-01-01'},{...sample,id:'missing',income:{total:null,currency:'USD'},distance:null},{...sample,id:'cad',income:{total:'10',currency:'CAD'}}],new Set([ACCOUNT]),since,until);
 assert.equal(summary.completed,3);assert.deepEqual(summary.totals.find(t=>t.currency==='USD'),{currency:'USD',earnings:30.5,paidRecords:1,completed:2,missingPay:1});assert.equal(summary.records.find(r=>r.id==='gig-1').miles,10);assert.equal(summary.records.find(r=>r.id==='missing').pay,null);
 function setup(overrides={}){
  let clock=now,mapping=null,deleted=false,foreign=false,badPage=false,second=false,failProvider=false;
  const calls=[];
  const config={SUPABASE_URL:'https://db.example',SUPABASE_SERVICE_ROLE_KEY:'server-only',ARGYLE_API_KEY_ID:'key-id',ARGYLE_API_KEY_SECRET:'secret-only',ARGYLE_FLOW_ID:'reviewed-flow',ARGYLE_ITEMS_JSON:JSON.stringify({instacart:'item_instacart',spark:'item_spark'}),...overrides};
  const account=()=>({id:ACCOUNT,user:foreign?OTHER:ARGYLE,item:'item_instacart',connection:{status:'connected'},scanned_at:until,availability:{gigs:{status:'synced'}},ongoing_refresh:{status:'enabled'}});
  const response=(data,status=200)=>new Response(status===204?null:JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
  const fetchImpl=async(url,opts={})=>{
   const u=new URL(url),method=opts.method||'GET',body=opts.body?JSON.parse(opts.body):null;calls.push({url:u.href,method,body,headers:opts.headers});
   if(u.hostname==='db.example'){
    if(u.pathname==='/auth/v1/user')return response(opts.headers.Authorization==='Bearer valid'?{id:USER}:{error:'invalid'},opts.headers.Authorization==='Bearer valid'?200:401);
    assert.match(u.pathname,/argyle_user_connections/);assert.equal(opts.headers.apikey,'server-only');
    if(method==='POST'){mapping ||= {user_id:USER,environment:config.ARGYLE_ENVIRONMENT==='production'?'production':'sandbox',argyle_user_id:null,locked_until:null};return response([],201);}
    assert.equal(u.searchParams.get('user_id'),'eq.'+USER,'DB reads and writes scoped to verified user');
    assert.equal(u.searchParams.get('environment'),'eq.'+(config.ARGYLE_ENVIRONMENT==='production'?'production':'sandbox'));
    if(method==='GET')return response(mapping?[mapping]:[]);
    if(u.searchParams.has('or')&&mapping.locked_until&&Date.parse(mapping.locked_until)>=clock)return response([]);
    if(u.searchParams.has('lock_id'))assert.equal('eq.'+mapping.lock_id,u.searchParams.get('lock_id'));
    Object.assign(mapping,body);return response(opts.headers.Prefer==='return=representation'?[mapping]:[]);
   }
   assert.equal(u.origin,'https://api-sandbox.argyle.com');assert.equal(opts.headers.Authorization,'Basic '+btoa('key-id:secret-only'));
   if(failProvider)return response({secret:'DO NOT LEAK',message:'provider internal'},500);
   if(u.pathname==='/v2/users')return response({id:ARGYLE,user_token:'unused-token'});
   if(u.pathname.startsWith('/v2/items/'))return response({id:u.pathname.split('/').at(-1),status:'healthy',kind:'gig'});
   if(u.pathname==='/v2/user-tokens'){assert.deepEqual(body,{user:ARGYLE});return response({user_token:'short-lived-token'});}
   if(u.pathname==='/v2/accounts/'+ACCOUNT){if(method==='DELETE'){deleted=true;return response(null,204);}return response(account());}
   if(u.pathname==='/v2/accounts'){assert.equal(u.searchParams.get('user'),ARGYLE);return response({results:deleted?[]:[account()],next:null});}
   if(u.pathname==='/v2/gigs'){
    assert.equal(u.searchParams.get('user'),ARGYLE);assert(u.searchParams.has('from_start_datetime'));
    if(u.searchParams.has('cursor')){second=true;return response({results:[{...sample,id:'gig-2'}],next:null});}
    return response({results:[sample,{...sample,id:'foreign',account:OTHER}],next:badPage?'https://evil.example/v2/gigs?cursor=secret':'https://api-sandbox.argyle.com/v2/gigs?cursor=second-page&user='+OTHER});
   }
   throw Error('Unexpected request '+u.href);
  };
  const handler=createHandler({env:key=>config[key],fetchImpl,now:()=>clock});
  const invoke=async(body,token='valid',origin='https://milecount.editallfutures.com')=>{clock+=3000;const r=await handler(new Request('https://edge.example',{method:'POST',headers:{Authorization:'Bearer '+token,Origin:origin},body:JSON.stringify(body)}));return {status:r.status,data:await r.json()};};
  return {invoke,handler,calls,setForeign:()=>foreign=true,setBadPage:()=>badPage=true,setFailure:()=>failProvider=true,get deleted(){return deleted;},get second(){return second;},lock:()=>mapping.locked_until=new Date(clock+100000).toISOString()};
 }
 const missing=setup({ARGYLE_API_KEY_SECRET:''});let r=await missing.invoke({action:'link',provider:'instacart',consent:true});assert.equal(r.data.configured,false);assert.equal(missing.calls.filter(c=>c.url.includes('argyle.com')).length,0);
 const removed=setup({ARGYLE_ITEMS_JSON:JSON.stringify({doordash:'item_doordash',instacart:'item_instacart'})});r=await removed.invoke({action:'link',provider:'doordash',consent:true});assert.equal(r.status,400,'Removed provider cannot be linked even with stale configuration');assert(!removed.calls.some(c=>c.url.includes('argyle.com')));r=await removed.invoke({action:'status'});assert.deepEqual(r.data.providers.map(p=>p.key),['instacart','spark']);
 const production=setup({ARGYLE_ENVIRONMENT:'production'});r=await production.invoke({action:'status'});assert.equal(r.data.configured,false,'Production must be explicitly activated');
 const h=setup();r=await h.invoke({action:'status'},'bad');assert.equal(r.status,401);assert.equal(h.calls.length,1,'No provider/data access before auth');
 r=await h.invoke({action:'status'},'valid','https://evil.example');assert.equal(r.status,403);
 r=await h.invoke({action:'link',provider:'instacart'});assert.equal(r.status,400,'Consent required');
 r=await h.invoke({action:'link',provider:'instacart',consent:true,userId:OTHER,user:OTHER});assert.equal(r.status,200);assert.equal(r.data.userToken,'short-lived-token');assert.equal(r.data.environment,'sandbox');assert.deepEqual(r.data.items,['item_instacart']);assert.equal(r.data.liveOffers,false);assert(!JSON.stringify(r.data).includes('secret-only'));
 r=await h.invoke({action:'activity',user:OTHER});assert.equal(r.status,200);assert.equal(r.data.activity.completed,2);assert(h.second,'Pagination followed');assert.equal(r.data.activity.totals[0].earnings,61);assert(!JSON.stringify(r.data).includes('start_location'));
 h.setBadPage();r=await h.invoke({action:'activity'});assert.equal(r.status,502);assert(!h.calls.some(c=>c.url.includes('evil.example')),'Never forward credentials to pagination URL');
 h.setForeign();r=await h.invoke({action:'disconnect',accountId:ACCOUNT,confirm:true});assert.equal(r.status,403);assert(!h.deleted);r=await h.invoke({action:'link',provider:'instacart',accountId:ACCOUNT,consent:true});assert.equal(r.status,403);
 const d=setup();await d.invoke({action:'link',provider:'instacart',consent:true});r=await d.invoke({action:'disconnect',accountId:ACCOUNT});assert.equal(r.status,400);assert(!d.deleted);r=await d.invoke({action:'disconnect',accountId:ACCOUNT,confirm:true});assert.equal(r.status,200);assert(d.deleted);
 const locked=setup();await locked.invoke({action:'link',provider:'instacart',consent:true});locked.lock();r=await locked.invoke({action:'link',provider:'instacart',consent:true});assert.equal(r.status,429,'Concurrent requests cannot create/link another user');
 const failure=setup();await failure.invoke({action:'link',provider:'instacart',consent:true});failure.setFailure();r=await failure.invoke({action:'activity'});assert.equal(r.status,502);assert(!JSON.stringify(r.data).includes('DO NOT LEAK'));
 // Run the real migration with PostgreSQL semantics, then inspect privileges/RLS.
 const {PGlite}=require('@electric-sql/pglite'),db=new PGlite();
 await db.exec('create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create table auth.users(id uuid primary key);');
 await db.exec(fs.readFileSync('supabase/migrations/20261003163532_argyle_account_connections.sql','utf8'));
 const permissions=await db.query("select relrowsecurity as rls,has_table_privilege('anon','public.argyle_user_connections','SELECT') as anon_read,has_table_privilege('authenticated','public.argyle_user_connections','SELECT') as user_read,has_table_privilege('service_role','public.argyle_user_connections','SELECT') as server_read from pg_class where oid='public.argyle_user_connections'::regclass");
 assert.deepEqual(permissions.rows[0],{rls:true,anon_read:false,user_read:false,server_read:true});await db.close();
 console.log('PASS Argyle auth, consent, owner isolation, environment gate, pagination, completed earnings, missing data, disconnect, concurrency, redaction and database permissions');
})().catch(e=>{console.error(e);process.exit(1);});
