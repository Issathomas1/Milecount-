/* Real browser and production client/UI, deterministic provider/account fixtures. */
const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
(async()=>{
 const root=process.cwd(),server=http.createServer((req,res)=>{try{const file=path.resolve(root,'.'+(req.url.split('?')[0]==='/'?'/index.html':req.url.split('?')[0]));if(!file.startsWith(root+path.sep))throw Error();res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(file))}catch{res.statusCode=404;res.end()}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base='http://127.0.0.1:'+server.address().port,browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE,args:['--no-sandbox'],headless:true});
 try{
  const ctx=await browser.newContext({viewport:{width:390,height:844}}),page=await ctx.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  let connected=false,rejectConnect=true,expired=false,searches=0,releaseStatus,holdStatus=false;
  const load={pickup:'Atlanta, GA',delivery:'Charlotte, NC',pay:800,weight:1000,space:3,loadedMiles:245,equipment:'Box Truck'};
  const direct=Array.from({length:4},(_,i)=>({...load,provider:'Direct Freight',providerLoadId:'df-fixture-'+i,isSandbox:false}));
  await ctx.addInitScript(()=>localStorage.setItem('milecount_supabase_session',JSON.stringify({access_token:'fixture'})));
  await page.route('**/*',async route=>{
   const url=route.request().url(),json=(x,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(x)});
   if(url.startsWith(base))return route.continue();
   if(url.includes('unpkg.com/leaflet')){const name=url.includes('.css')?'leaflet.css':'leaflet.js';return route.fulfill({body:fs.readFileSync(require.resolve('leaflet/dist/'+name)),contentType:name.endsWith('css')?'text/css':'application/javascript'})}
   if(url.includes('/auth/v1/user'))return json({id:'00000000-0000-0000-0000-000000000001',email:'qa@example.invalid'});
   if(url.includes('/rpc/is_milecount_admin'))return json(true);
   if(url.includes('/rpc/milecount_entitlements'))return json({admin:true,active:true,plan:'platinum'});
   if(url.includes('/rest/v1/'))return json([]);
   if(url.includes('/directfreight-adapter')){
    assert.equal(route.request().headers().authorization,'Bearer fixture');
    const body=route.request().postDataJSON();
    if(body.action==='status'){
     const initial=connected;
     if(holdStatus){holdStatus=false;await new Promise(r=>releaseStatus=r);}
     return json({ok:true,configured:true,connected:initial,connection:initial?{account_email:'driver@example.invalid',subscription_tier:'free'}:null});
    }
    if(body.action==='connect'){
     assert.equal(body.email,'driver@example.invalid');assert.equal(body.password,'fixture-password');
     if(rejectConnect)return json({ok:false,error:'Direct Freight sign-in was rejected.'},401);
     connected=true;return json({ok:true,connected:true,accountEmail:body.email,subscriptionTier:'free'});
    }
    if(body.action==='disconnect'){connected=false;return json({ok:true,connected:false});}
    searches++;assert(connected,'No Direct Freight search before per-user connection');
    if(expired)return json({ok:false,needsUserAuth:true,error:'Direct Freight rejected the real-time search.'},401);
    return json({ok:true,connected:true,subscriptionTier:'free',loads:direct});
   }
   if(url.includes('/truktek-public-pilot'))return json({loads:[{...load,provider_load_id:'truk-fixture'}],live_found:1});
   if(url.includes('/loadboot-sandbox'))return json({data:[]});
   if(url.includes('/nominatim'))return json([]);
   return json({error:'Unavailable in QA'},503);
  });
  const waitLoads=n=>page.waitForFunction(n=>!document.getElementById('find').disabled&&document.querySelectorAll('.stackPick').length===n,n);
  await page.goto(base,{waitUntil:'domcontentloaded'});await waitLoads(1);assert.equal(searches,0);
  assert(await page.locator('#dfSummary').isVisible());
  await page.locator('#dfSummary').click();
  await page.locator('#dfEmail').fill('driver@example.invalid');await page.locator('#dfPassword').fill('fixture-password');await page.locator('#dfConnect').click();
  await page.waitForFunction(()=>document.getElementById('dfMessage').textContent.includes('rejected'));
  assert.equal(await page.locator('#dfPassword').inputValue(),'');assert.equal(await page.locator('.stackPick').count(),1);assert.equal(searches,0);
  rejectConnect=false;
  await page.locator('#dfPassword').fill('fixture-password');await page.locator('#dfConnect').click();await waitLoads(4);
  assert.equal(await page.locator('#dfPassword').inputValue(),'');assert.equal(await page.locator('#providerFilter').inputValue(),'direct-freight');
  assert((await page.locator('#loadCandidates .loadMeta').allTextContents()).every(t=>t==='LIVE • Direct Freight'));
  await page.locator('.stackPick').first().click();assert.equal(await page.locator('.stackPick[aria-pressed="true"]').count(),1);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  assert(!(await page.evaluate(()=>JSON.stringify({...localStorage,...sessionStorage}))).includes('fixture-password'));
  await page.locator('#dfManage').click();assert(await page.locator('#dfConnected').isVisible());assert((await page.locator('#dfPlan').textContent()).includes('Free account'));
  await page.reload({waitUntil:'domcontentloaded'});await waitLoads(5);
  await page.locator('#dfSummary').click();assert(await page.locator('#dfConnected').isVisible());assert((await page.locator('#dfPlan').textContent()).includes('Free account'));
  // Token expiry offers reconnection without hiding the responding provider.
  expired=true;await page.locator('#find').click();await waitLoads(1);
  assert.equal(await page.locator('#loadCandidates .loadMeta').first().textContent(),'LIVE • TrukTek');
  await page.locator('#dfManage').click();assert(await page.locator('#dfConnectForm').isVisible());assert((await page.locator('#dfMessage').textContent()).includes('reconnecting'));
  expired=false;await page.locator('#dfEmail').fill('driver@example.invalid');await page.locator('#dfPassword').fill('fixture-password');await page.locator('#dfConnect').click();await waitLoads(4);
  await page.locator('#dfManage').click();await page.locator('#dfDisconnect').click();
  await page.waitForFunction(()=>document.querySelectorAll('.stackPick').length===1);
  assert.equal(await page.locator('#loadCandidates .loadMeta').first().textContent(),'LIVE • TrukTek');assert.equal(await page.locator('#providerFilter').inputValue(),'all');
  console.log('PASS mobile DF connect/reject/reload/free-account 4 listings/stack/expired token/disconnect; TrukTek survives; credentials not persisted');
  // Late disconnected status must not hide a just-connected account.
  holdStatus=true;await page.reload({waitUntil:'domcontentloaded'});
  await page.locator('#dfSummary').click();await page.locator('#dfEmail').fill('driver@example.invalid');await page.locator('#dfPassword').fill('fixture-password');await page.locator('#dfConnect').click();await waitLoads(4);
  releaseStatus();await page.locator('#dfManage').click();assert(await page.locator('#dfConnected').isVisible());
  assert.deepEqual(errors,[]);console.log('PASS late initial connection status cannot undo successful connect');
  await ctx.close();
 }finally{await browser.close();await new Promise(r=>server.close(r))}
})().catch(e=>{console.error(e);process.exitCode=1});
