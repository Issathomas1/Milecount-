const {chromium}=require('playwright'),fs=require('node:fs'),http=require('node:http'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const root=process.cwd();const server=http.createServer((req,res)=>{
  const file=path.resolve(root,'.'+new URL(req.url,'http://local').pathname);
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){res.writeHead(404).end();return;}
  res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(file));
 });await new Promise(r=>server.listen(0,'127.0.0.1',r));
 let browser;
 try{
  browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE,args:['--no-sandbox','--disable-dev-shm-usage'],headless:true});
  const page=await browser.newPage({viewport:{width:390,height:844}});let enabled=false,paid=false,admin=false,creates=0,sdkLoads=0;const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>localStorage.setItem('milecount_supabase_session',JSON.stringify({access_token:'qa-session'})));
  await page.route('https://**/*',route=>{
   const req=route.request(),url=req.url(),json=data=>route.fulfill({contentType:'application/json',body:JSON.stringify(data)});
   if(url.includes('paypal.com/sdk/js')){sdkLoads++;return route.fulfill({contentType:'application/javascript',body:`window.paypal={Buttons:o=>({render:async selector=>{const b=document.createElement('button');b.textContent='PayPal Subscribe QA';b.onclick=async()=>{await o.createSubscription();await o.onApprove({subscriptionID:'FORGED-CLIENT-VALUE'});};document.querySelector(selector).append(b);}})};`});}
   if(url.endsWith('/auth/v1/user'))return json({id:'qa-user',email:'qa@example.invalid'});
   if(url.endsWith('/rpc/milecount_entitlements'))return json({admin,active:admin,plan:admin?'platinum':'basic'});
   if(url.endsWith('/functions/v1/paypal-billing')){
    if(req.method()==='GET')return json({enabled,clientId:enabled?'qa-public-id':null,environment:'live'});
    const body=req.postDataJSON();if(body.action==='create'){creates++;return json({subscriptionId:'I-QA'});}
    return json({active:paid,status:'ACTIVE',environment:'live',paidUntil:paid?'2026-11-02T00:00:00Z':null});
   }
   return route.abort();
  });
  const url='http://127.0.0.1:'+server.address().port+'/pricing.html';
  await page.goto(url);await page.getByText('CHOOSE BASIC',{exact:true}).click();
  await page.getByText('Payment setup is being completed. No payment can be started here yet.').waitFor();assert.equal(sdkLoads,0);
  enabled=true;await page.reload();await page.getByText('CHOOSE BASIC',{exact:true}).click();await page.getByText('PayPal Subscribe QA').click();
  await page.getByText('Payment is not confirmed yet.',{exact:false}).waitFor();assert.equal(creates,1);assert.equal(await page.locator('#paypalButtons').isVisible(),false);
  paid=true;await page.getByRole('button',{name:'Check payment',exact:true}).click();await page.getByText('Basic is active.',{exact:false}).waitFor();
  assert.equal(creates,1,'recheck must not charge again');
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'mobile checkout must fit the screen');
  fs.mkdirSync('test-results',{recursive:true});await page.screenshot({path:'test-results/paypal-mobile.png',fullPage:true});
  admin=true;await page.reload();await page.getByText('CHOOSE BASIC',{exact:true}).click();await page.getByText('Your owner account already has full access.',{exact:false}).waitFor();assert.equal(sdkLoads,1,'owner never loads checkout');
  assert.deepEqual(errors,[]);
  console.log('PASS mobile PayPal checkout: disabled setup, verified-only success, safe recheck, no duplicate payment, owner bypass, no horizontal overflow');
 }finally{await browser?.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1});
