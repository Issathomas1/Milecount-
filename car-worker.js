importScripts('pickup-delivery.js','car-planner.js');
onmessage=event=>{try{postMessage({result:MileCountCarPlanner.compare(event.data.draft,event.data.matrix)});}catch(e){postMessage({error:e.message});}};
