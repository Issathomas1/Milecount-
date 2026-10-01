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
   if(url.includes('/functions/v1/directfreight-adapter'))return json({configured:true,loads});
   if(url.includes('/functions/')||url.includes('truktek.com/api/loads'))return json({loads:[],configured:true,live_found:0});
   if(url.includes('nominatim')){const q=u.searchParams.get('q')||'',key=Object.keys(fixtures.coordinates).find(k=>q.includes(k)),c=fixtures.coordinates[key];return json(c?[{lat:String(c[1]),lon:String(c[0]),display_name:key}]:[]);}
   if(url.includes('/route/v1/')||url.includes('/table/v1/')){
    const coords=decodeURIComponent(u.pathname.split('/').at(-1)).split(';').map(p=>p.split(',').map(Number)),indices=coords.map(nearest);
    if(url.includes('/table/'))return json({code:'Ok',distances:indices.map(a=>indices.map(b=>roads.matrix[a][b].miles*1609.344)),durations:indices.map(a=>indices.map(b=>roads.matrix[a][b].minutes*60))});
    const legs=indices.slice(1).map((b,i)=>({distance:roads.matrix[indices[i]][b].miles*1609.344,duration:roads.matrix[indices[i]][b].minutes*60}));return json({code:'Ok',routes:[{legs,distance:legs.reduce((s,l)=>s+l.distance,0),duration:legs.reduce((s,l)=>s+l.duration,0),geometry:{type:'LineString',coordinates:coords}}]});
   }
   return route.fulfill({status:503,body:'External service deliberately unavailable in QA'});
  });
  await page.goto(base,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.MileCountTruckBrain?.get?.().actualLocationVerified);await page.waitForFunction(()=>document.documentElement.dataset.ownerAccess==='true');
  await page.locator('#from').fill(f.start);await page.locator('#to').fill(f.home);await page.locator('#pickupDate').fill('2026-10-01');await page.evaluate(({payload,space})=>{for(const [id,value] of Object.entries({minRPM:0,maxDeadhead:2000,weight:payload,space})){const input=document.getElementById(id);input.value=value;input.dispatchEvent(new Event('input'));}},f);await page.locator('#find').click();await page.waitForFunction(n=>document.querySelectorAll('.stackPick').length===n&&!document.getElementById('find').disabled,f.loads.length);
  for(let i=0;i<f.loads.length;i++)await page.locator('.stackPick').nth(i).click();
  await page.locator('#smartAutoStack').click();await page.waitForFunction(()=>document.getElementById('finishAutoStack')||document.querySelector('#stackPlanResult .bad'));
  assert(await page.locator('#finishAutoStack').count(),await page.locator('#stackPlanResult').innerText());await page.locator('#finishAutoStack').click();
  await page.waitForFunction(()=>window.MileCountTruckBrain.get().currentPlan&&document.querySelectorAll('#tripStops .stop').length>0);
  await page.waitForFunction(()=>typeof mileCountMarkers!=='undefined'&&mileCountMarkers.length===window.MileCountTruckBrain.get().currentPlan.events.length+1);
  await page.locator('#tripStops summary').click();
  const result=await page.evaluate(()=>{const brain=window.MileCountTruckBrain.get();return {brain,list:document.querySelector('#tripStops').textContent,miles:document.querySelector('#roadMiles').textContent,pay:document.querySelector('#tripPay').textContent,overview:document.querySelector('#overviewMiles').textContent,routeSource:document.querySelector('#routeSource').textContent};});
  assert.equal(result.brain.currentLocation,f.start);assert.equal(result.brain.currentPlan.loads.length,f.loads.length);assert.equal(result.brain.currentPlan.routeStops.at(-1),f.home);assert.equal(result.brain.currentPlan.totalPay,f.loads.reduce((s,l)=>s+l[5],0));assert(result.routeSource.includes('COMMERCIAL ROUTE UNAVAILABLE'));
  for(const e of result.brain.currentPlan.events)assert(result.list.includes(e.location));assert(Math.abs(parseFloat(result.miles.replaceAll(',',''))-result.brain.currentPlan.miles)<1);
  if(f===fixtures.cases[0]){
   await page.locator('#bookAllLoads').click();await page.locator('.bookingConfirm').first().click();await page.waitForFunction(()=>Object.values(window.MileCountTruckBrain.get().bookings).some(b=>b.status==='CLAIMED'));const booking=await page.evaluate(()=>Object.values(window.MileCountTruckBrain.get().bookings)[0]);assert.equal(booking.providerConfirmed,false);
  }
  if(f===fixtures.cases[2]){
   const pickup=result.brain.currentPlan.events.find(e=>e.type==='pickup');
   await page.locator('#actualTruckForm input[name=location]').fill(pickup.location);
   await page.getByRole('button',{name:'Record pickup: '+pickup.location,exact:true}).click();
   await page.waitForFunction(id=>{const b=window.MileCountTruckBrain.get();return b.currentPlan&&b.onboardLoads.some(l=>window.MileCountTruckState.id(l)===id)&&!b.currentPlan.events.some(e=>e.type==='pickup'&&e.loadId===id);},pickup.loadId);
   await page.locator('#actualTruckForm input[name=location]').fill(pickup.load.delivery);
   await page.getByRole('button',{name:'Record delivery: '+pickup.load.delivery,exact:true}).click();
   await page.waitForFunction(id=>{const b=window.MileCountTruckBrain.get();return b.currentPlan&&!b.onboardLoads.length&&!b.currentPlan.events.some(e=>e.loadId===id);},pickup.loadId);
   await page.waitForFunction(()=>mileCountMarkers.length===window.MileCountTruckBrain.get().currentPlan.events.length+1&&document.querySelectorAll('#tripStops .stop').length===window.MileCountTruckBrain.get().currentPlan.events.length);
   console.log('PASS browser physical pickup → revised route → delivery → released capacity');
  }
  assert.deepEqual(errors,[]);console.log('PASS browser select → stack → route/list/economics → exact home: '+f.name+' • '+result.brain.currentPlan.miles.toFixed(1)+' mi');
  if(process.env.QA_SCREENSHOT_DIR){fs.mkdirSync(process.env.QA_SCREENSHOT_DIR,{recursive:true});await page.screenshot({path:path.join(process.env.QA_SCREENSHOT_DIR,'route-'+fixtures.cases.indexOf(f)+'.png'),fullPage:true});}
  await ctx.close();
 }
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1});
