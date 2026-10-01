/* Bounded worker execution: a slow search cannot freeze the map or event controls. */
(function(){
'use strict';
const url=new URL('optimizer-worker.js?v=20261001-stackrepair1',document.currentScript.src);
window.MileCountOptimizer={run(method,args){return new Promise((resolve,reject)=>{
 let worker,timer;
 const finish=(error,value)=>{clearTimeout(timer);worker?.terminate();error?reject(Error(error)):resolve(value);};
 try{worker=new Worker(url);timer=setTimeout(()=>finish('Search time limit reached. Your current truck plan is preserved; try a smaller candidate set.'),20000);worker.onmessage=e=>finish(e.data.error,e.data.value);worker.onerror=()=>finish('Optimizer worker unavailable. Your truck plan is preserved.');worker.postMessage({method,args});}catch(e){finish(e.message);}
});}};
})();
