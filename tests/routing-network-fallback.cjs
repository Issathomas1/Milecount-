const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const src=fs.readFileSync('routing.js','utf8');
const response=(data,status=200)=>({ok:status>=200&&status<300,status,json:async()=>data});
function context(fetchImpl,roadFallback){
 const c={console:{warn(){}},fetch:fetchImpl,AbortController,setTimeout,clearTimeout,Map,Promise,Error,window:{MileCountCloud:{roadFallback}}};
 vm.createContext(c);vm.runInContext(src,c);return c;
}
(async()=>{
 let cloud=[];
 const geo=context(async()=>{throw new TypeError('Failed to fetch')},async req=>{cloud.push(req);return {ok:true,data:[{lon:'-84.1702',lat:'33.8082',display_name:'Stone Mountain, Georgia'}]};});
 const point=await geo.resolveMileCountLocation('Stone Mountain, GA');
 assert.equal(Number(point.lat).toFixed(4),'33.8082');assert.equal(cloud.length,1);assert.equal(cloud[0].kind,'geocode');assert(point.source.includes('MileCount Cloud fallback'));
 console.log('PASS arbitrary-city geocoding falls back to authenticated MileCount Cloud only after direct network failure');

 let routeCloud=0;
 const route=context(async url=>{
  if(String(url).includes('nominatim')){
   const q=decodeURIComponent(String(url).split('q=')[1]||'');
   return response([{lon:q.includes('Bastrop')?'-91.8724':'-84.1702',lat:q.includes('Bastrop')?'32.7785':'33.8082',display_name:q}]);
  }
  if(String(url).includes('/route/v1/'))throw new TypeError('Failed to fetch');
  throw new Error('unexpected direct call '+url);
 },async req=>{assert.equal(req.kind,'route');routeCloud++;return {ok:true,data:{code:'Ok',routes:[{distance:836858.88,duration:32400,geometry:{type:'LineString',coordinates:[[-84.1702,33.8082],[-91.8724,32.7785]]},legs:[{distance:836858.88,duration:32400}]}]}};});
 const built=await route.getMileCountGeneralRoadRoute(['Stone Mountain, GA','Bastrop, LA']);
 assert.equal(Math.round(built.miles),520);assert.equal(routeCloud,1);assert(built.source.includes('MileCount Cloud fallback'));
 console.log('PASS verified route data falls back through cloud without changing stop order or provider load state');

 let matrixCloud=0;
 const matrix=context(async url=>{
  if(String(url).includes('nominatim')){
   const q=decodeURIComponent(String(url).split('q=')[1]||'');
   return response([{lon:q.includes('Bastrop')?'-91.8724':'-84.1702',lat:q.includes('Bastrop')?'32.7785':'33.8082',display_name:q}]);
  }
  if(String(url).includes('/table/v1/'))throw new TypeError('Failed to fetch');
  throw new Error('unexpected direct call '+url);
 },async req=>{assert.equal(req.kind,'matrix');matrixCloud++;return {ok:true,data:{code:'Ok',distances:[[0,836858.88],[836858.88,0]],durations:[[0,32400],[32400,0]]}};});
 const table=await matrix.getMileCountGeneralRoadMatrix(['Stone Mountain, GA','Bastrop, LA']);
 assert.equal(Math.round(table.matrix[0][1].miles),520);assert.equal(matrixCloud,1);assert(table.source.includes('MileCount Cloud fallback'));
 console.log('PASS Smart AutoStack road matrix survives a direct browser fetch failure');

 let directCloud=0;
 const direct=context(async url=>{
  if(String(url).includes('/route/v1/'))return response({code:'Ok',routes:[{distance:1000,duration:100,geometry:{type:'LineString',coordinates:[]},legs:[{distance:1000,duration:100}]}]});
  throw new Error('unexpected '+url);
 },async()=>{directCloud++;return {ok:false};});
 const unchanged=await direct.getMileCountGeneralRoadRoute(['Atlanta, GA','Charlotte, NC']);
 assert.equal(directCloud,0);assert.equal(unchanged.source,'OSRM road route / OpenStreetMap geography');
 console.log('PASS healthy direct routing remains the first path and does not call the fallback');
})().catch(e=>{console.error(e);process.exit(1)});