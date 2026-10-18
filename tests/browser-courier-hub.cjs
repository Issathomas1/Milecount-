const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
(async()=>{
 const root=process.cwd();
 const server=http.createServer((req,res)=>{
  try{
   const pathname=new URL(req.url,'http://local').pathname;
   const file=path.resolve(root,'.'+(pathname==='/'?'/courier.html':pathname));
   if(!file.startsWith(root+path.sep))throw Error('Invalid path');
   const ext=path.extname(file);
   res.setHeader('Content-Type',ext==='.js'?'application/javascript':ext==='.css'?'text/css':ext==='.json'?'application/json':'text/html; charset=utf-8');
   res.end(fs.readFileSync(file));
  }catch{res.statusCode=404;res.end('Not found');}
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE,args:['--no-sandbox'],headless:true});
 try{
  for(const width of [390,1280]){
   const context=await browser.newContext({viewport:{width,height:900},acceptDownloads:true});
   const page=await context.newPage();
   const errors=[];
   page.on('pageerror',e=>errors.push(String(e)));
   await page.route('**/*',route=>route.request().url().startsWith(base)?route.continue():route.abort());
   await page.goto(base+'/courier.html');
   await page.getByRole('heading',{name:/Your van\. Your gigs\./}).waitFor();
   assert.equal(await page.locator('.provider-card').count(),4,'provider directory renders');
   assert.equal(await page.locator('#savedCount').textContent(),'0');
   // calculator: $100 pay - ($45/20*$3.25) - ($45*$0.20) = $83.6875
   await page.locator('#pay').fill('100');
   await page.locator('#miles').fill('45');
   await page.locator('#hours').fill('2');
   await page.locator('#mpg').fill('20');
   await page.locator('#fuel').fill('3.25');
   await page.locator('#wear').fill('0.20');
   await page.locator('#other').fill('0');
   assert.equal(await page.locator('#estNet').textContent(),'$83.69','profit calculator computes fuel and per-mile costs');
   assert.equal(await page.locator('#netMile').textContent(),'$1.86','net per mile is calculated');
   await page.getByLabel('Business / opportunity name').fill('Test auto parts run');
   await page.getByLabel('Pickup area').fill('Riverdale, GA');
   await page.getByLabel('Delivery area').fill('Atlanta, GA');
   await page.getByLabel('Quoted pay ($)').fill('100');
   await page.getByLabel('Estimated total miles').fill('45');
   await page.getByRole('button',{name:'Save opportunity on this device'}).click();
   assert.equal(await page.locator('#savedCount').textContent(),'1','saved opportunity count updates');
   assert.equal(await page.locator('#gigList').getByText('Test auto parts run').count(),1);
   await page.getByLabel('Gig / client').fill('Test client');
   await page.getByLabel('Gross pay received ($)').fill('100');
   await page.getByLabel('Expenses ($)').fill('25');
   await page.getByLabel('Miles driven').fill('45');
   await page.getByRole('button',{name:'Record earnings'}).click();
   assert.equal(await page.locator('#grossTotal').textContent(),'$100.00');
   assert.equal(await page.locator('#expenseTotal').textContent(),'$25.00');
   assert.equal(await page.locator('#netTotal').textContent(),'$75.00');
   await page.reload();
   assert.equal(await page.locator('#savedCount').textContent(),'1','opportunities persist across reload on same browser');
   assert.equal(await page.locator('#netTotal').textContent(),'$75.00','earnings persist across reload on same browser');
   assert.deepEqual(errors,[],'no uncaught browser exceptions');
   assert.equal(await page.locator('body').evaluate(el=>el.scrollWidth<=window.innerWidth),true,'layout does not overflow viewport');
   await context.close();
  }
  console.log('PASS courier hub desktop/mobile, provider directory, calculator, local opportunity/earnings persistence, and overflow checks');
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exit(1);});
