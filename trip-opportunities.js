/* Discovery keeps incomplete provider records available for an explicit route preview. */
(function(root){
'use strict';
const markets={'Harrisburg, PA':[-76.8867,40.2732],'Scranton, PA':[-75.6624,41.4090],'Hagerstown, MD':[-77.72,39.64],'Winchester, VA':[-78.16,39.19],'Roanoke, VA':[-79.94,37.27],'Wytheville, VA':[-81.085,36.948],'Knoxville, TN':[-83.92,35.96],'Chattanooga, TN':[-85.31,35.05],'Charlotte, NC':[-80.8431,35.2271],'Greenville, SC':[-82.394,34.8526],'Atlanta, GA':[-84.388,33.749],'Birmingham, AL':[-86.81,33.52],'Jackson, MS':[-90.18,32.3],'Shreveport, LA':[-93.75,32.53],'Dallas, TX':[-96.8,32.78],'Jacksonville, FL':[-81.6557,30.3322],'Orlando, FL':[-81.3792,28.5383]};
function miles(a,b){const r=Math.PI/180,x=(b[1]-a[1])*r,y=(b[0]-a[0])*r,h=Math.sin(x/2)**2+Math.cos(a[1]*r)*Math.cos(b[1]*r)*Math.sin(y/2)**2;return 3958.8*2*Math.atan2(Math.sqrt(h),Math.sqrt(Math.max(0,1-h)));}
function corridorMarkets(coords,exclude=[]){
 if(!coords||coords.length<2)return [];
 const accumulated=[0];for(let i=1;i<coords.length;i++)accumulated.push(accumulated[i-1]+miles(coords[i-1],coords[i]));
 const result=[],used=new Set(exclude);
 for(const fraction of [.25,.5,.75]){const target=accumulated.at(-1)*fraction;let i=accumulated.findIndex(d=>d>=target);if(i<1)i=1;const span=accumulated[i]-accumulated[i-1],t=span?(target-accumulated[i-1])/span:0,point=coords[i-1].map((n,j)=>n+(coords[i][j]-n)*t);const near=Object.entries(markets).filter(([name])=>!used.has(name)).map(([name,xy])=>({name,d:miles(point,xy)})).sort((a,b)=>a.d-b.d)[0];if(near&&near.d<=100){result.push(near.name);used.add(near.name);}}
 return result;
}
function fresh(load){return load&&load.dataFreshness!=='stale'&&!load.isSandbox&&!load.isLocalSim&&!['TEST','SIM'].includes(load.mode)&&!!load.pickup&&!!(load.delivery||load.stop);}
function progress(load,distance){const a=distance.get(load.pickup),b=distance.get(load.delivery||load.stop);return Number.isFinite(a)&&Number.isFinite(b)?a-b:null;}
const states={AL:'Alabama',AK:'Alaska',AZ:'Arizona',AR:'Arkansas',CA:'California',CO:'Colorado',CT:'Connecticut',DE:'Delaware',FL:'Florida',GA:'Georgia',HI:'Hawaii',ID:'Idaho',IL:'Illinois',IN:'Indiana',IA:'Iowa',KS:'Kansas',KY:'Kentucky',LA:'Louisiana',ME:'Maine',MD:'Maryland',MA:'Massachusetts',MI:'Michigan',MN:'Minnesota',MS:'Mississippi',MO:'Missouri',MT:'Montana',NE:'Nebraska',NV:'Nevada',NH:'New Hampshire',NJ:'New Jersey',NM:'New Mexico',NY:'New York',NC:'North Carolina',ND:'North Dakota',OH:'Ohio',OK:'Oklahoma',OR:'Oregon',PA:'Pennsylvania',RI:'Rhode Island',SC:'South Carolina',SD:'South Dakota',TN:'Tennessee',TX:'Texas',UT:'Utah',VT:'Vermont',VA:'Virginia',WA:'Washington',WV:'West Virginia',WI:'Wisconsin',WY:'Wyoming',DC:'District of Columbia'};
function place(value){
 let text=String(value||'').trim().replace(/,?\s+(USA|US|United States(?: of America)?)$/i,'').replace(/\s+\d{5}(?:-\d{4})?$/,'').trim();
 for(const [code,name] of Object.entries(states)){
  const match=text.match(new RegExp('(?:^|[,\\s]+)('+code+'|'+name+')$','i'));
  if(match)return {state:code,city:text.slice(0,match.index).replace(/[^a-z0-9]+/gi,' ').trim().toLowerCase()};
 }
 return {state:null,city:null};
}
function matchesTarget(load,mode,target){
 const destination=place(load.delivery||load.stop),end=place(target);
 if(!end.state||destination.state!==end.state)return false;
 return mode==='outbound'||!!end.city&&destination.city===end.city;
}
function simulationOptions(start,home,markets=[]){
 const target=place(home);if(!target.city||!target.state)return [];
 return [...new Set([start,...markets])].filter(p=>!matchesTarget({delivery:p},'homebound',home)).slice(0,3).map((pickup,i)=>({
  id:'home-sim-'+i,provider:'MileCount SIM',pickup,delivery:home,pay:450+i*125,mode:'SIM',isLocalSim:true,isSandbox:true
 }));
}
const api={corridorMarkets,fresh,progress,place,matchesTarget,simulationOptions};if(typeof module!=='undefined')module.exports=api;root.MileCountTripOpportunities=api;
})(typeof window!=='undefined'?window:globalThis);
