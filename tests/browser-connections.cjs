const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
(async()=>{
 const root=process.cwd(),server=http.createServer((req,res)=>{try{const file=path.resolve(root,'.'+new URL(req.url,'http://local').pathname);if(!file.startsWith(root+path.sep))throw Error();res.setHeader('Content-Type',({'html':'text/html','js':'application/javascript','css':'text/css'})[file.split('.').at(-1)]||'text/plain');res.end(fs.readFileSync(file));}catch{res.statusCode=404;res.end();}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port,browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE,args:['--no-sandbox'],headless:true});
 try{
  const ctx=await browser.newContext({viewport:{width:390,height:844}});let configured=false,connected=false,failure=false,user='driver-a',sdkRequests=0;const actions=[],errors=[];
  await ctx.addInitScript(()=>localStorage.setItem('milecount_supabase_session',JSON.stringify({access_token:'test-only'})));
  await ctx.route('**/*',async route=>{
   const url=route.request().url(),json=(x,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(x)});
   if(url.startsWith(base))return route.continue();
   if(url.includes('/auth/v1/user'))return json({id:user});
   if(url==='https://plugin.argyle.com/argyle.web.v5.js'){
    sdkRequests++;return route.fulfill({contentType:'application/javascript',body:'window.Argyle={create(options){window.qaArgyleOptions={sandbox:options.sandbox,items:options.items,flowId:options.flowId};return {open(){options.onAccountConnected();options.onClose();},close(){options.onClose();}}}};'});
   }
   if(url.includes('/functions/v1/argyle-connect')){
    const body=route.request().postDataJSON();actions.push(body);
    if(failure)return json({ok:false,error:'Provider unavailable. Retry later.'},502);
    const config={ok:true,configured,environment:'sandbox',liveOffers:false,providers:['instacart','spark'].map((key,i)=>({key,name:['Instacart','Spark Driver'][i],available:configured})),message:configured?'Test connections only. Use Argyle sample accounts, not your driver login.':'Account connections are awaiting activation. Your saved offers and planner still work.'};
    if(body.action==='link'){assert.equal(body.consent,true);connected=true;return json({...config,userToken:'secret-test-token',flowId:'test-flow',items:['item_instacart']});}
    if(body.action==='disconnect'){assert.equal(body.confirm,true);connected=false;return json({ok:true,disconnected:true});}
    return json({...config,accounts:connected?[{id:'acct',provider:'instacart',name:'Instacart <img src=x onerror=alert(1)>',status:'connected',syncStatus:'synced',scannedAt:'2026-10-03T12:00:00Z',refreshStatus:'enabled'}]:[],activity:connected?{completed:1,totals:[{currency:'USD',earnings:25.5,paidRecords:1,completed:1,missingPay:0}],records:[{id:'gig',accountId:'acct',start:'2026-10-02T12:00:00Z',pay:25.5,currency:'USD',miles:10}],partial:false}:null,checkedAt:'2026-10-03T12:01:00Z'});
   }
   return json({},503);
  });
  const page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/car.html');await page.getByText('Account connections are awaiting activation.',{exact:false}).waitFor();
  assert.equal(await page.locator('[data-connect]').count(),2);assert.equal(await page.locator('[data-connect]:enabled').count(),0);assert.equal(sdkRequests,0);assert.equal(await page.locator('#connectionEarnings').textContent(),'');
  assert.match(await page.locator('#modeNotice').textContent(),/Live package feeds are not connected/);
  configured=true;await page.reload();await page.locator('#connectionConsentArea').waitFor({state:'visible'});assert.equal(await page.locator('[data-connect]:enabled').count(),0);
  await page.locator('#connectionConsent').check();await page.locator('[data-connect="instacart"]').click();
  await page.waitForFunction(()=>document.querySelector('#connectionEarnings').textContent.includes('$25.50'));
  assert.equal(sdkRequests,1);assert.deepEqual(await page.evaluate(()=>window.qaArgyleOptions),{sandbox:true,items:['item_instacart'],flowId:'test-flow'});
  assert.equal(await page.locator('#connectionAccounts img').count(),0,'Provider names escaped');
  assert.equal(await page.locator('#jobList .job').count(),0,'History never becomes an available offer');
  assert(await page.evaluate(()=>!JSON.stringify(localStorage).includes('secret-test-token')),'No Link token persisted');
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Mobile layout fits');
  if(process.env.QA_SCREENSHOT_DIR){fs.mkdirSync(process.env.QA_SCREENSHOT_DIR,{recursive:true});await page.locator('#connections').screenshot({path:path.join(process.env.QA_SCREENSHOT_DIR,'connections-test-mobile.png')});}
  failure=true;await page.locator('#refreshConnections').click();await page.getByText('Provider unavailable. Retry later.',{exact:true}).waitFor();assert.match(await page.locator('#connectionFreshness').textContent(),/MileCount checked/);failure=false;
  page.once('dialog',d=>d.dismiss());await page.locator('[data-disconnect]').click();assert(!actions.some(a=>a.action==='disconnect'));
  page.once('dialog',d=>d.accept());await page.locator('[data-disconnect]').click();await page.getByText('Disconnected. Shared records for this connection were deleted.',{exact:true}).waitFor();assert.equal(await page.locator('#connectionEarnings').textContent(),'');
  user='driver-b';await page.locator('#refreshConnections').click();await page.getByText('Your MileCount session changed. Sign in again and reload this page.',{exact:true}).waitFor();assert.equal(await page.locator('#connectionEarnings').textContent(),'');assert(await page.locator('#refreshConnections').isDisabled());
  await page.reload();await page.locator('#workspace').waitFor();assert.equal(await page.locator('#connectionEarnings').textContent(),'');assert(!await page.locator('#connectionConsent').isChecked());
  assert.deepEqual(errors,[]);await ctx.close();
  const out=await browser.newContext(),signedout=await out.newPage();const before=actions.length;await signedout.goto(base+'/car.html');assert(await signedout.locator('#workspace').isHidden());assert.equal(actions.length,before,'No connection request while signed out');await out.close();
  console.log('PASS mobile account gating, consent, SDK, sandbox labels, earnings isolation, errors, disconnect confirmation, account changes and signed-out behavior');
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exit(1);});
