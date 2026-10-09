const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
(async()=>{
 const root=process.cwd();
 const server=http.createServer((req,res)=>{
  try{
   const pathname=new URL(req.url,'http://local').pathname;
   const file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
   if(!file.startsWith(root+path.sep))throw Error('Invalid path');
   res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'text/html');
   res.end(fs.readFileSync(file));
  }catch{res.statusCode=404;res.end();}
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE,args:['--no-sandbox'],headless:true});
 try{
  for(const width of [390,1280]){
   const context=await browser.newContext({viewport:{width,height:844}});
   const page=await context.newPage();
   const requested=[];
   await page.route('**/*',route=>{
    const url=route.request().url();requested.push(url);
    return url.startsWith(base)?route.continue():route.fulfill({status:503,contentType:'application/json',body:'{}'});
   });
   await page.goto(base+'/home.html');
   assert.equal(await page.locator('a[href="car.html"]').count(),0);
   await page.getByRole('link',{name:'Open Freight Planner',exact:true}).click();
   await page.locator('#gateSignIn').waitFor({state:'visible'});
   assert.deepEqual(await page.locator('#vehicleType option').evaluateAll(es=>es.map(e=>e.value)),['cargo','sprinter','box16','box20','box24','box26']);
   assert.equal(await page.locator('a[href="car.html"]').count(),0);
   await page.goto(base+'/car.html?legacy=1#offers');
   await page.waitForURL(base+'/');
   await page.locator('#gateSignIn').waitFor({state:'visible'});
   assert(!requested.some(url=>/\/(car-ui|car-planner|car-worker|account-connections|offer-import)\.js/.test(url)),'Retired workspace must not start or connect gig accounts');
   await context.close();
  }
  console.log('PASS desktop/mobile freight-only entry points, vehicle choices, legacy redirect and sign-in gate');
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exit(1);});
