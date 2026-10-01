const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const app=fs.readFileSync('app.js','utf8');
(async()=>{
 let admin=false,entitlement={active:false,plan:'premium'};const c={localStorage:{getItem:()=> 'platinum'},document:{documentElement:{dataset:{}}},window:{MileCountCloud:{session:async()=>({user:{email:'Issa.bj99@yahoo.com'}}),isAdmin:async()=>admin,entitlements:async()=>entitlement}},el:()=>null};vm.createContext(c);vm.runInContext(app.slice(app.indexOf('const MILECOUNT_PLANS='),app.indexOf('const el=id=>')),c);
 assert.equal(c.currentPlanKey(),'basic');await c.syncOwnerAccess();assert.equal(c.currentPlanKey(),'basic');assert.equal(c.requirePlan('dispatcher'),false);
 entitlement={active:true,plan:'gold'};await c.syncOwnerAccess();assert.equal(c.currentPlanKey(),'gold');assert.equal(c.requirePlan('dispatcher'),true);assert.equal(c.requirePlan('autoCorrect'),false);
 admin=true;await c.syncOwnerAccess();assert.equal(c.currentPlan().name,'OWNER • FULL ACCESS');assert.equal(c.currentPlan().maxTrucks,Infinity);assert.equal(c.requirePlan('autoCorrect'),true);assert.equal(c.requirePlan('fleet'),true);
 admin=false;c.window.MileCountCloud.isAdmin=async()=>{throw Error('offline');};await c.syncOwnerAccess();assert.equal(c.currentPlanKey(),'basic'); // failures revoke elevated access
 console.log('PASS client plan tampering and email impersonation rejected; verified Gold gates and server-admin full access');
 const source=fs.readFileSync('booking.js','utf8'),memory=new Map(),b={window:{mcTripStorageKey:'mcOriginalTrips:owner'},localStorage:{getItem:k=>memory.get(k),setItem:(k,v)=>memory.set(k,v)},decorate(){},renderCenter(){},refreshCommittedSummary(){}};vm.createContext(b);vm.runInContext(source.slice(source.indexOf('var STORAGE_KEY='),source.indexOf('function actionUrl('))+'window.test={save,isConfirmed,statusFor};',b);
 const load={providerLoadId:'1',provider:'Carrier'};const receipt=b.window.test.save(load,'ACCEPTED',{confirmationNumber:'unverified'});assert.equal(receipt.status,'ACTION_REQUIRED');assert.equal(b.window.test.isConfirmed(load),false);
 memory.set('milecount_booking_center_v1:mcOriginalTrips:owner',JSON.stringify({'1|Carrier':{status:'ACCEPTED'}}));assert.equal(b.window.test.isConfirmed(load),false);assert.equal(b.window.test.statusFor(load),'ACTION_REQUIRED');b.window.mcTripStorageKey='mcOriginalTrips:other';assert.equal(b.window.test.statusFor(load),'AVAILABLE');
 assert(!fs.readFileSync('planner.html','utf8').includes('status:"booked"'));
 console.log('PASS unverified/legacy/browser-forged acceptance stays handoff-only; account isolation and manual planner status');
})().catch(e=>{console.error(e);process.exitCode=1;});
