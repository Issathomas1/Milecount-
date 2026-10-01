/* Full static app, real Chromium/Leaflet; all external services are deterministic QA fixtures.
   BROWSER_EXECUTABLE and LEAFLET_FIXTURE_DIR point to locally installed test dependencies. */
const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),http=require('node:http');
const fixtures=require('./fixtures/dispatch-cases.json'),roads=require('./fixtures/road-matrix.json');
(async()=>{
 const root=process.cwd(),server=http.createServer((req,res)=>{try{const pathname=new URL(req.url,'http://local').pathname,file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));if(!file.startsWith(root+path.sep))throw Error();const ext=file.split('.').at(-1);res.setHeader('Content-Type',({html:'text/html',js:'application/javascript',css:'text/css'})[ext]||'application/octet-stream');res.end(fs.readFileSync(file));}catch(e){res.statusCode=404;res.end();}});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base='http://127.0.0.1:'+server.address().port,browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE,args:['--no-sandbox','--disable-dev-shm-usage'],headless:true});
 try{
 for(const f of fixtures.cases){
  const ctx=await browser.newContext({viewport:{width:1280,height:900}}),page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>{errors.push('Dialog: '+d.message());d.dismiss();});
  const profile={type:'box-truck',commercial:true,gvwrLb:26000,payloadLb:f.payload,emptyWeightLb:16000,cargoLengthFt:f.space,heightFt:12,widthFt:8.5,vehicleLengthFt:35,axleCount:2,axleWeightLb:13000,trailerCount:0,hazmat:false,tollPreference:'allow',avoidFerries:true};
  let state={version:1,revision:1,profile,currentLocation:f.start,onboardLoads:[],commitments:[],homeLocation:f.home},cloudVersion=1;
  const loads=f.loads.map(([name,pickup,delivery,weight,space,pay])=>({name,provider:'Direct Freight',providerLoadId:name,pickup,delivery,weight,space,pay,isSandbox:false,mode:'LIVE',sourceUrl:'https://provider.example/loads/'+name}));
  if(f===fixtures.cases[1]){loads[0].weight=null;loads[0].space=0;loads[0].pickupDate='2026-10-01';loads[0].pickupWindow='00:00-00:01';loads[0].pickupTimeZone='America/New_York';}
  const nearest=point=>{let best,dist=Infinity;for(const [name,coord] of Object.entries(fixtures.coordinates)){const d=(coord[0]-point[0])**2+(coord[1]-point[1])**2;if(d<dist){best=name;dist=d;}}return roads.locations.indexOf(best);};
  await ctx.addInitScript(()=>localStorage.setItem('milecount_supabase_session',JSON.stringify({access_token:'local-qa-session'})));
  await page.route('**/*',async route=>{
   const req=route.request(),url=req.url(),u=new URL(url),json=(x,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(x)});
   if(url.startsWith(base))return route.continue();
   if(url.includes('unpkg.com/leaflet')){const name=url.includes('.css')?'leaflet.css':'leaflet.js';return route.fulfill({body:fs.readFileSync(process.env.LEAFLET_FIXTURE_DIR?path.join(process.env.LEAFLET_FIXTURE_DIR,name):require.resolve('leaflet/dist/'+name)),contentType:name.endsWith('css')?'text/css':'application/javascript'});}
   if(u.pathname==='/auth/v1/user')return json({id:'00000000-0000-0000-0000-000000000001',email:'qa@example.invalid'});
   if(url.includes('/rpc/is_milecount_admin'))return json(true);
   if(url.includes('/rpc/milecount_entitlements'))return json({admin:true,active:true,plan:'platinum',maxTrucks:2147483647,commercialRouting:true});
   if(url.includes('/rpc/save_truck_brain')){const body=req.postDataJSON();assert.equal(body.p_expected_version,cloudVersion);state=body.p_state;return json(++cloudVersion);}
   if(url.includes('/rest/v1/truck_brain_states'))return json([{version:cloudVersion,state}]);
   if(url.includes('/rest/v1/profiles'))return json([{id:'00000000-0000-0000-0000-000000000001',plan:'free'}]);
   if(url.includes('/rest/v1/'))return json([]);
   if(url.includes('/functions/v1/commercial-route'))return json({error:'Commercial router unavailable in QA'},503);
   if(url.includes('/functions/v1/directfreight-adapter')){const origin=req.postDataJSON()?.origin;const extra=f===fixtures.cases[0]&&origin!==f.start?[{name:'return-1',provider:'Direct Freight',providerLoadId:'return-1',pickup:'Charlotte, NC',delivery:'Greenville, SC',pay:800,weight:null,space:0},{name:'return-2',provider:'Direct Freight',providerLoadId:'return-2',pickup:'Greenville, SC',delivery:'Atlanta, GA',pay:700,weight:null,space:0}]:[];return json({configured:true,loads:[...loads,...extra]});}
   if(url.includes('/functions/')||url.includes('truktek.com/api/loads'))return json({loads:[],configured:true,live_found:0});
   if(url.includes('nominatim')){const q=u.searchParams.get('q')||'',key=Object.keys(fixtures.coordinates).find(k=>q.includes(k)),c=fixtures.coordinates[key];return json(c?[{lat:String(c[1]),lon:String(c[0]),display_name:key}]:[]);}
   if(url.includes('/route/v1/')||url.includes('/table/v1/')){
    const coords=decodeURIComponent(u.pathname.split('/').at(-1)).split(';').map(p=>p.split(',').map(Number)),indices=coords.map(nearest);
    if(url.includes('/table/'))return json({code:'Ok',distances:indices.map(a=>indices.map(b=>roads.matrix[a][b].miles*1609.344)),durations:indices.map(a=>indices.map(b=>roads.matrix[a][b].minutes*60))});
    const legs=indices.slice(1).map((b,i)=>({distance:roads.matrix[indices[i]][b].miles*1609.344,duration:roads.matrix[indices[i]][b].minutes*60}));return json({code:'Ok',routes:[{legs,distance:legs.reduce((s,l)=>s+l.distance,0),duration:legs.reduce((s,l)=>s+l.duration,0),geometry:{type:'LineString',coordinates:coords}}]});
   }
   return route.fulfill({status:503,body:'External service deliberately unavailable in QA'});
  });
  await page.goto(base,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.MileCountTruckBrain?.get?.().actualLocationVerified);await page.waitForFunction(()=>document.documentElement.dataset.ownerAccess==='true');await page.waitForFunction(()=>document.querySelector('#commercialTruckForm [name=heightFt]')?.value==='12');


  await page.locator('#from').fill(f.start);await page.locator('#to').fill(f.home);await page.locator('#pickupDate').fill('2026-10-01');await page.evaluate(({payload,space})=>{for(const [id,value] of Object.entries({minRPM:0,maxDeadhead:2000,weight:payload,space})){const input=document.getElementById(id);input.value=value;input.dispatchEvent(new Event('input'));}},f);await page.locator('#find').click();await page.waitForFunction(n=>document.querySelectorAll('.stackPick').length===n&&!document.getElementById('find').disabled,f.loads.length);
  for(let i=0;i<f.loads.length;i++)await page.locator('.stackPick').nth(i).click();
  if(f===fixtures.cases[0]){
   await page.setViewportSize({width:390,height:844});
   assert.equal(await page.locator('.candidateLoad button button').count(),0);
   assert.equal(await page.locator('.mcBookingActionRow').count(),0);
   assert.equal(await page.locator('.stackPick[aria-pressed="true"]').count(),f.loads.length);
   await page.locator('.inspectLoad').first().click();assert(await page.locator('#loadDetails-0').isVisible());
   await page.locator('.inspectLoad').first().click();assert(!(await page.locator('#loadDetails-0').isVisible()));
   await page.evaluate(()=>window.scrollTo(0,document.body.scrollHeight));await page.waitForFunction(()=>!document.getElementById('backToTop').hidden);
   const topRect=await page.locator('#backToTop').boundingBox(),trayRect=await page.locator('#stackTray').boundingBox();assert(topRect.y+topRect.height<=trayRect.y);
   await page.locator('#backToTop').click();await page.waitForFunction(()=>window.scrollY<2);
   assert.equal(await page.locator('.stackPick[aria-pressed="true"]').count(),f.loads.length);
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   if(process.env.QA_SCREENSHOT_DIR){fs.mkdirSync(process.env.QA_SCREENSHOT_DIR,{recursive:true});await page.screenshot({path:path.join(process.env.QA_SCREENSHOT_DIR,'simple-loads-mobile.png')});}
   await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await page.locator('#stackFeedback').evaluate(n=>getComputedStyle(n).transitionDuration),'0s');
   console.log('PASS mobile compact cards, selected-state feedback, accessible details, back-to-top preserves stack and clears sticky tray');
  }
  await page.locator('#doneStack').click();
  await page.waitForFunction(()=>window.MileCountTruckBrain.get().currentPlan&&document.querySelectorAll('#tripStops .stop').length>0);
  await page.waitForFunction(()=>typeof mileCountMarkers!=='undefined'&&mileCountMarkers.length===window.MileCountTruckBrain.get().currentPlan.events.length+1);
  await page.locator('#tripStops summary').click();
  const result=await page.evaluate(()=>{const brain=window.MileCountTruckBrain.get();return {brain,list:document.querySelector('#tripStops').textContent,miles:document.querySelector('#roadMiles').textContent,pay:document.querySelector('#tripPay').textContent,overview:document.querySelector('#overviewMiles').textContent,routeSource:document.querySelector('#routeSource').textContent};});
  assert.equal(result.brain.currentLocation,f.start);assert.equal(result.brain.currentPlan.loads.length,f.loads.length);assert.equal(result.brain.currentPlan.routeStops.at(-1),f.home);assert.equal(result.brain.currentPlan.totalPay,f.loads.reduce((s,l)=>s+l[5],0));assert(result.routeSource.includes('COMMERCIAL ROUTE UNAVAILABLE'));
  if(f===fixtures.cases[1]){assert.equal(result.brain.currentPlan.planningPreview,true);assert.equal(result.brain.currentPlan.capacityVerified,false);assert.equal(result.brain.currentPlan.timingVerified,false);assert(result.routeSource.includes('TIMING NOT VERIFIED'));assert(result.routeSource.includes('CAPACITY NOT VERIFIED'));assert.equal(result.brain.currentPlan.loads.find(l=>l.name===loads[0].name).weight,null);}
  for(const e of result.brain.currentPlan.events)assert(result.list.includes(e.location));assert(Math.abs(parseFloat(result.miles.replaceAll(',',''))-result.brain.currentPlan.miles)<1);
  if(f===fixtures.cases[0]){
   await page.locator('#bookingFold > summary').click();await page.locator('#bookAllLoads').click();await page.locator('.bookingConfirm').first().click();await page.waitForFunction(()=>Object.values(window.MileCountTruckBrain.get().bookings).some(b=>b.status==='CLAIMED'));const booking=await page.evaluate(()=>Object.values(window.MileCountTruckBrain.get().bookings)[0]);assert.equal(booking.providerConfirmed,false);await page.waitForFunction(()=>window.MileCountTruckBrain.get().currentPlan&&mileCountMarkers.length===window.MileCountTruckBrain.get().currentPlan.events.length+1);
  }
  if(f===fixtures.cases[2]){
   await page.locator('#clearStack').click();
   await page.locator('#truckBrainPanel > summary').click();
   const pickup=result.brain.currentPlan.events.find(e=>e.type==='pickup');
   await page.locator('#actualTruckForm input[name=location]').fill(pickup.location);
   await page.getByRole('button',{name:'Record pickup: '+pickup.location,exact:true}).click();
   await page.waitForFunction(id=>{const b=window.MileCountTruckBrain.get();return b.currentPlan&&b.onboardLoads.some(l=>window.MileCountTruckState.id(l)===id)&&!b.currentPlan.events.some(e=>e.type==='pickup'&&e.loadId===id);},pickup.loadId);
   await page.locator('#actualTruckForm input[name=location]').fill(pickup.load.delivery);
   await page.getByRole('button',{name:'Record delivery: '+pickup.load.delivery,exact:true}).click();
   await page.waitForFunction(id=>{const b=window.MileCountTruckBrain.get();return b.currentPlan&&!b.onboardLoads.length&&!b.currentPlan.events.some(e=>e.loadId===id);},pickup.loadId);
   await page.waitForFunction(()=>mileCountMarkers.length===window.MileCountTruckBrain.get().currentPlan.events.length+1&&document.querySelectorAll('#tripStops .stop').length===window.MileCountTruckBrain.get().currentPlan.events.length);
   assert.equal(await page.locator('.bookingConfirm').count(),f.loads.length-1);
   console.log('PASS browser physical pickup → revised route → delivery → released capacity');
  }
  assert((await page.locator('#bookingCount').textContent()).includes('live load'));
  assert.deepEqual(errors,[]);console.log('PASS browser select → stack → route/list/economics → exact home: '+f.name+' • '+result.brain.currentPlan.miles.toFixed(1)+' mi');
  if(process.env.QA_SCREENSHOT_DIR){fs.mkdirSync(process.env.QA_SCREENSHOT_DIR,{recursive:true});await page.screenshot({path:path.join(process.env.QA_SCREENSHOT_DIR,'route-'+fixtures.cases.indexOf(f)+'.png'),fullPage:true});}
  if(f===fixtures.cases[0]){
   await page.setViewportSize({width:390,height:844});
   await page.locator('#protect').click();await page.waitForFunction(()=>document.getElementById('tripOpportunityStatus').textContent.includes('live options.'));
   assert.equal(await page.locator('.stackPick').count(),2);
   assert(await page.evaluate(()=>Boolean(document.getElementById('loadCandidates').compareDocumentPosition(document.getElementById('selectedStackLoads'))&Node.DOCUMENT_POSITION_FOLLOWING)));
   for(let i=0;i<2;i++)await page.locator('.stackPick').nth(i).click();
   await page.locator('#buildOpportunityTrip').click();await page.waitForFunction(()=>window.MileCountTruckBrain.get().currentPlan?.loads.length===6);
   const full=await page.evaluate(()=>window.MileCountTruckBrain.get().currentPlan);assert.equal(full.totalPay,3250);assert.equal(full.routeStops.at(-1),f.home);assert.equal(full.loads.filter(l=>l.providerLoadId==='return-1').length,1);
   await page.waitForFunction(()=>mileCountMarkers.length===window.MileCountTruckBrain.get().currentPlan.events.length+1);
   await page.locator('#findOutboundLoads').click();await page.waitForFunction(()=>document.getElementById('tripOpportunityStatus').textContent.startsWith('OUTBOUND •'));
   assert.equal((await page.evaluate(()=>window.MileCountTruckBrain.get().committedLoads)).length,6);
   console.log('PASS browser Homebound list → two paid hops → rebuild all original loads/map/pay → outbound list');
  }
  if(f===fixtures.cases[0]){
   await page.setViewportSize({width:390,height:844});
   await page.evaluate(()=>document.getElementById('restart').click());await page.locator('#find').click();await page.waitForFunction(n=>document.querySelectorAll('.stackPick').length===n&&!document.getElementById('find').disabled,f.loads.length);
   await page.evaluate(()=>{const load=window.MileCountBookingBridge.getLoad(0);load.isLocalSim=true;load.isSandbox=true;});
   for(let i=0;i<f.loads.length;i++)await page.locator('.stackPick').nth(i).click();
   await page.locator('#reviewStackQuick').click();await page.locator('#smartAutoStack').click();await page.waitForFunction(()=>document.querySelector('#stackPlanResult')?.textContent.includes('LIVE and TEST/SIM'));
   assert.equal(await page.locator('#selectedStackLoads [data-remove-selection]').count(),f.loads.length);
   if(process.env.QA_SCREENSHOT_DIR){await page.locator('#selectedStackLoads').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(process.env.QA_SCREENSHOT_DIR,'mixed-selection-mobile.png')});}
   await page.locator('#removeTestSelections').click();await page.waitForFunction(n=>window.MileCountTruckBrain.get().currentPlan?.loads.length===n,f.loads.length-1);
   await page.waitForFunction(()=>mileCountMarkers.length===window.MileCountTruckBrain.get().currentPlan.events.length+1);
   assert(!(await page.evaluate(()=>window.MileCountTruckBrain.get().currentPlan.loads.some(l=>l.isLocalSim))));
   await page.locator('#editSelectedLoads').click();await page.locator('#selectedStackLoads [data-remove-selection]').last().click();
   await page.waitForFunction(n=>window.MileCountTruckBrain.get().currentPlan?.loads.length===n,f.loads.length-2);
   await page.evaluate(()=>document.getElementById('restart').click());await page.locator('#localMoneyMode').click();
   await page.waitForFunction(()=>!document.getElementById('localMoneyMode').disabled);
   assert((await page.evaluate(()=>window.MileCountBookingBridge.getLoads())).every(l=>!l.isLocalSim&&!l.isSandbox&&!['TEST','SIM'].includes(l.mode)));
   assert.deepEqual(errors,[]);console.log('PASS browser mixed-mode error → remove TEST/SIM → finalized route → individual removal → LIVE-only Local Day');
  }
  if(f===fixtures.cases[0]){
   await page.locator('#clearStack').click();
   await page.locator('#truckBrainPanel > summary').click();
   for(const key of ['emptyWeightLb','heightFt','widthFt','vehicleLengthFt','axleCount','axleWeightLb','trailerCount'])await page.locator('#commercialTruckForm [name='+key+']').fill('');
   await page.getByRole('button',{name:'Save truck details',exact:true}).click();
   assert.match(await page.locator('#truckSaveMessage').textContent(),/Truck details saved/);
   let saved=await page.evaluate(()=>window.MileCountTruckBrain.get());
   assert.equal(saved.commercialProfile.heightFt,null);assert.equal(saved.payload,10000);assert.equal(saved.cargoCapacity,26);
   await page.reload({waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>document.querySelector('#commercialTruckForm [name=payloadLb]')?.value==='10000');
   assert.equal(await page.locator('#commercialTruckForm [name=heightFt]').inputValue(),'');
   console.log('PASS optional truck measurements: actual Save button succeeds, known capacity retained, unknown values survive reload');
  }
  await ctx.close();
 }
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1});
