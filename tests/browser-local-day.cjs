/* Full static app, real Chromium/Leaflet; all external services are deterministic QA fixtures.
   BROWSER_EXECUTABLE and LEAFLET_FIXTURE_DIR point to locally installed test dependencies. */
const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),http=require('node:http');
const fixtures=require('./fixtures/dispatch-cases.json'),roads=require('./fixtures/road-matrix.json');
(async()=>{
 const root=process.cwd(),server=http.createServer((req,res)=>{try{const pathname=new URL(req.url,'http://local').pathname,file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));if(!file.startsWith(root+path.sep))throw Error();const ext=file.split('.').at(-1);res.setHeader('Content-Type',({html:'text/html',js:'application/javascript',css:'text/css'})[ext]||'application/octet-stream');res.end(fs.readFileSync(file));}catch(e){res.statusCode=404;res.end();}});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base='http://127.0.0.1:'+server.address().port,browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE,args:['--no-sandbox','--disable-dev-shm-usage'],headless:true});
 try{
 for(const scenario of ['slow-road','empty','failure-retry','unpriced','stale-board']){
  const f=fixtures.cases[0];let fail=scenario==='failure-retry',releaseOld;const oldBoard=new Promise(r=>releaseOld=r),searches=[];
  const ctx=await browser.newContext({viewport:{width:390,height:844}}),page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>{errors.push('Dialog: '+d.message());d.dismiss();});
  const profile={type:'box-truck',commercial:true,gvwrLb:26000,payloadLb:f.payload,emptyWeightLb:16000,cargoLengthFt:f.space,heightFt:12,widthFt:8.5,vehicleLengthFt:35,axleCount:2,axleWeightLb:13000,trailerCount:0,hazmat:false,tollPreference:'allow',avoidFerries:true};
  let state={version:1,revision:1,profile,currentLocation:f.start,onboardLoads:[],commitments:[],homeLocation:'Charlotte, NC'},cloudVersion=1;
  const loads=f.loads.map(([name,pickup,delivery,weight,space,pay])=>({name,provider:'Direct Freight',providerLoadId:name,pickup,delivery,weight,space,pay,isSandbox:false,mode:'LIVE',sourceUrl:'https://provider.example/loads/'+name}));
  if(f===fixtures.cases[1]){loads[0].weight=null;loads[0].space=0;loads[0].pickupDate='2026-10-01';loads[0].pickupWindow='00:00-00:01';loads[0].pickupTimeZone='America/New_York';}
  const nearest=point=>{let best,dist=Infinity;for(const [name,coord] of Object.entries(fixtures.coordinates)){const d=(coord[0]-point[0])**2+(coord[1]-point[1])**2;if(d<dist){best=name;dist=d;}}return roads.locations.indexOf(best);};
  await ctx.addInitScript(()=>localStorage.setItem('milecount_supabase_session',JSON.stringify({access_token:'local-qa-session'})));
  await page.route('**/*',async route=>{
   const req=route.request(),url=req.url(),u=new URL(url),json=(x,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(x)});
   if(url.startsWith(base))return route.continue();
   if(url.includes('/loadboot-sandbox')&&url.includes('mode=production'))return json({ok:true,mode:'LIVE',sandbox:false,fetchedAt:new Date().toISOString(),data:{loads:[]}});
   if(url.includes('unpkg.com/leaflet')){const name=url.includes('.css')?'leaflet.css':'leaflet.js';return route.fulfill({body:fs.readFileSync(process.env.LEAFLET_FIXTURE_DIR?path.join(process.env.LEAFLET_FIXTURE_DIR,name):require.resolve('leaflet/dist/'+name)),contentType:name.endsWith('css')?'text/css':'application/javascript'});}
   if(u.pathname==='/auth/v1/user')return json({id:'00000000-0000-0000-0000-000000000001',email:'qa@example.invalid'});
   if(url.includes('/rpc/is_milecount_admin'))return json(true);
   if(url.includes('/rpc/milecount_entitlements'))return json({admin:true,active:true,plan:'platinum',maxTrucks:2147483647,commercialRouting:true});
   if(url.includes('/rpc/save_truck_brain')){const body=req.postDataJSON();assert.equal(body.p_expected_version,cloudVersion);state=body.p_state;return json(++cloudVersion);}
   if(url.includes('/rest/v1/truck_brain_states'))return json([{version:cloudVersion,state}]);
   if(url.includes('/rest/v1/profiles'))return json([{id:'00000000-0000-0000-0000-000000000001',plan:'free'}]);
   if(url.includes('/rest/v1/'))return json([]);
   if(url.includes('/functions/v1/commercial-route'))return json({error:'Commercial router unavailable in QA'},503);
   if(url.includes('/functions/v1/directfreight-adapter')){
    const body=req.postDataJSON();if(body.action==='status')return json({connected:true,configured:true});searches.push(body);
    if(fail)return json({error:'QA source offline'},503);
    if(scenario==='stale-board'&&!body.local_state)await oldBoard;
    const inventory=scenario==='empty'?[]:scenario==='unpriced'?loads.map(l=>({...l,pay:0})):loads;
    return json({configured:true,loads:[...inventory,...(scenario==='empty'?[]:[{...loads[0],providerLoadId:'injected-sim',isSandbox:true,pay:9999},{...loads[0],providerLoadId:'outside-pickup',pickup:'Greenville, SC',pay:8888}])]});
   }
   if(url.includes('/truktek-public-pilot')&&fail)return json({error:'QA source offline'},503);
   if(url.includes('/functions/')||url.includes('truktek.com/api/loads'))return json({loads:[],configured:true,live_found:0});
   if(url.includes('nominatim')){const q=u.searchParams.get('q')||'',key=Object.keys(fixtures.coordinates).find(k=>q.includes(k)),c=fixtures.coordinates[key];return json(c?[{lat:String(c[1]),lon:String(c[0]),display_name:key}]:[]);}
   if(url.includes('/route/v1/')||url.includes('/table/v1/')){
    const coords=decodeURIComponent(u.pathname.split('/').at(-1)).split(';').map(p=>p.split(',').map(Number)),indices=coords.map(nearest);
    if(scenario==='slow-road'&&url.includes('/route/'))await new Promise(r=>setTimeout(r,6000));
    if(url.includes('/table/'))return json({code:'Ok',distances:indices.map(a=>indices.map(b=>roads.matrix[a][b].miles*1609.344)),durations:indices.map(a=>indices.map(b=>roads.matrix[a][b].minutes*60))});
    const legs=indices.slice(1).map((b,i)=>({distance:roads.matrix[indices[i]][b].miles*1609.344,duration:roads.matrix[indices[i]][b].minutes*60}));return json({code:'Ok',routes:[{legs,distance:legs.reduce((s,l)=>s+l.distance,0),duration:legs.reduce((s,l)=>s+l.duration,0),geometry:{type:'LineString',coordinates:coords}}]});
   }
   return route.fulfill({status:503,body:'External service deliberately unavailable in QA'});
  });
  await page.goto(base,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.MileCountTruckBrain?.get?.().actualLocationVerified);await page.waitForFunction(()=>document.documentElement.dataset.ownerAccess==='true');await page.waitForFunction(()=>document.querySelector('#commercialTruckForm [name=heightFt]')?.value==='12');


  await page.locator('#from').fill(f.start);
  await page.locator('#localMoneyMode').click();
  await page.waitForFunction(()=>!document.getElementById('localMoneyMode').disabled,null,{timeout:35000});
  assert(searches.some(q=>q.local_state==='GA'),'Provider search must constrain state before pagination');
  if(['empty','failure-retry','unpriced'].includes(scenario)){
   assert(await page.locator('#localDayResultStatus').isVisible());assert(await page.locator('#retryLocalDay').isEnabled());
   const status=await page.locator('#localDayResultStatus').textContent();
   if(scenario==='empty'){assert.match(status,/No live loads/);assert.equal(await page.locator('.stackPick').count(),0);}
   if(scenario==='unpriced'){assert.match(status,/no rates/);assert.equal(await page.locator('.stackPick').count(),3);await page.locator('.stackPick').first().click();assert.equal(await page.locator('.stackPick[aria-pressed="true"]').count(),1);}
   if(scenario==='failure-retry'){assert.match(status,/unavailable/);fail=false;await page.locator('#retryLocalDay').click();await page.waitForFunction(()=>!document.getElementById('localMoneyMode').disabled);}
   if(process.env.QA_SCREENSHOT_DIR&&scenario==='empty'){fs.mkdirSync(process.env.QA_SCREENSHOT_DIR,{recursive:true});await page.screenshot({path:path.join(process.env.QA_SCREENSHOT_DIR,'local-day-empty.png')});}
  }
  if(!['empty','unpriced'].includes(scenario)){
   const result=await page.evaluate(()=>({plan:window.MileCountTruckBrain.get().currentPlan,status:document.getElementById('localMoneyStatus').textContent,visible:document.getElementById('screen3').classList.contains('active')}));
   assert(result.plan?.loads.length,result.status);
   assert.equal(result.plan.routeStops.at(-1),f.start,'Local Day must override an old out-of-state home target');
   assert(result.plan.loads.every(l=>l.pickup.endsWith(', GA')&&l.delivery.endsWith(', GA')&&!l.isSandbox));
   assert(result.plan.drive<=600);assert(result.visible,'Built local day opens My trip');
   if(scenario==='stale-board'){
    releaseOld();await page.waitForFunction(()=>!document.body.classList.contains('mcBusy'));
    assert((await page.evaluate(()=>window.MileCountBookingBridge.getLoads())).every(l=>l.pickup.endsWith(', GA')&&l.delivery.endsWith(', GA')&&!l.isSandbox));
   }
   if(process.env.QA_SCREENSHOT_DIR&&scenario==='slow-road'){fs.mkdirSync(process.env.QA_SCREENSHOT_DIR,{recursive:true});await page.screenshot({path:path.join(process.env.QA_SCREENSHOT_DIR,'local-day-ready.png')});}
  }
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(errors,[]);
  console.log('PASS mobile Local Day: '+scenario);
  releaseOld();await ctx.close();
 }
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1});
