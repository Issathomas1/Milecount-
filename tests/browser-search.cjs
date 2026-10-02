// Full UI recovery: real Chromium, fixture inventory, failed Direct Freight and map service.
const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
(async()=>{
 const root=process.cwd(),server=http.createServer((req,res)=>{try{const file=path.resolve(root,'.'+(req.url.split('?')[0]==='/'?'/index.html':req.url.split('?')[0]));if(!file.startsWith(root+path.sep))throw Error();res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(file))}catch{res.statusCode=404;res.end()}});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base='http://127.0.0.1:'+server.address().port,browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE,args:['--no-sandbox'],headless:true});
 try{
  const ctx=await browser.newContext({viewport:{width:390,height:844}}),page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  const loads=Array.from({length:100},(_,i)=>({provider_load_id:'fixture-'+i,name:'Load '+i,pickup:'Newnan, GA',delivery:'Charlotte, NC',pay:400+i,weight:1000,space:3,loadedMiles:245,equipment:'Box Truck',map_lat:33.749,map_lon:-84.388}));
  await ctx.addInitScript(()=>localStorage.setItem('milecount_supabase_session',JSON.stringify({access_token:'fixture'})));
  await page.route('**/*',route=>{
   const url=route.request().url(),json=(x,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(x)});
   if(url.startsWith(base))return route.continue();
   if(url.includes('unpkg.com/leaflet')){const name=url.includes('.css')?'leaflet.css':'leaflet.js';return route.fulfill({body:fs.readFileSync(require.resolve('leaflet/dist/'+name)),contentType:name.endsWith('css')?'text/css':'application/javascript'})}
   if(url.includes('/auth/v1/user'))return json({id:'00000000-0000-0000-0000-000000000001',email:'qa@example.invalid'});
   if(url.includes('/rpc/is_milecount_admin'))return json(true);
   if(url.includes('/rpc/milecount_entitlements'))return json({admin:true,active:true,plan:'platinum'});
   if(url.includes('/rest/v1/'))return json([]);
   if(url.includes('/directfreight-adapter'))return json({ok:false,error:'Provider unavailable in QA'},503);
   if(url.includes('/truktek-public-pilot'))return json({loads,live_found:100});
   if(url.includes('/loadboot-sandbox'))return json({data:[]});
   if(url.includes('/nominatim'))return json([]);
   return json({error:'Unavailable in QA'},503);
  });
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.querySelectorAll('.stackPick').length===100);
  await page.locator('#from').fill('Atlanta, GA');await page.locator('#to').fill('Charlotte, NC');
  // Simulate a never-completing map calculation after initial board discovery.
  await page.evaluate(()=>{window.getMileCountRoadRoute=()=>new Promise(()=>{});document.getElementById('minRPM').value=3});
  const started=Date.now();await page.locator('#find').click();await page.waitForFunction(()=>!document.getElementById('find').disabled&&document.querySelectorAll('.stackPick').length===100,{},{timeout:12000}).catch(async e=>{console.log('SEARCH DEBUG',errors,await page.evaluate(()=>({count:document.querySelectorAll('.stackPick').length,disabled:document.getElementById('find').disabled,health:document.getElementById('boardHealth').textContent})));throw e});
  assert(Date.now()-started<12000);assert((await page.locator('#boardHealth').textContent()).includes('Direct Freight unavailable'));assert.equal(await page.locator('#to').inputValue(),'Charlotte, NC');
  await page.locator('.inspectLoad').first().click();assert((await page.locator('#loadDetails-0').textContent()).includes('Road costs not calculated yet'));
  await page.locator('.stackPick').first().click();assert.equal(await page.locator('.stackPick[aria-pressed="true"]').count(),1);
  assert.equal(await page.locator('.loadMeta').first().textContent(),'LIVE • TrukTek');assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(errors,[]);
  console.log('PASS mobile Find Loads: 100 TrukTek loads survive Direct Freight outage and hung routing; search finishes, unknown costs labeled, +Stack works');
  await ctx.close();
 }finally{await browser.close();await new Promise(r=>server.close(r))}
})().catch(e=>{console.error(e);process.exitCode=1});
