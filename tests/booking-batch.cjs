const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
(async()=>{
 const source=fs.readFileSync('booking.js','utf8'),calls=[];
 let release;const paused=new Promise(r=>release=r);
 const ctx={adapters:{},bookingBatchBusy:false,norm:s=>String(s).toLowerCase(),nonBookable:l=>!!l.isSandbox||!!l.isLocalSim||['TEST','SIM'].includes(l.mode),keyFor:l=>l?.provider+'|'+l?.id,beginBooking:async l=>{calls.push(l.id);await paused;}};
 vm.createContext(ctx);vm.runInContext(source.slice(source.indexOf('function canRequest('),source.indexOf('function registerProvider(')),ctx);
 const live={id:'1',provider:'Example'},other={id:'2',provider:'Example'};
 assert.equal(ctx.canRequest(live),false);await ctx.requestSelected([live]);assert.equal(calls.length,0);
 ctx.adapters.example={requestBooking:async()=>{},requestViaApi:false};assert.equal(ctx.canRequest(live),false);
 ctx.adapters.example.requestViaApi=true;assert.equal(ctx.canRequest(live),true);
 const running=ctx.requestSelected([live,live,{...other,mode:'SIM'},other]);await ctx.requestSelected([other]);assert.deepEqual(calls,['1']);release();await running;assert.deepEqual(calls,['1','2']);
 ctx.beginBooking=async()=>{throw Error('server unavailable')};await assert.rejects(()=>ctx.requestSelected([live]));assert.equal(ctx.bookingBatchBusy,false);
 console.log('PASS booking batch: no handoff/test submission, explicit capability, unique requests, concurrent-click suppression and failure release');
})().catch(e=>{console.error(e);process.exitCode=1});
