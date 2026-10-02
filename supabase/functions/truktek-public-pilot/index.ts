import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const H={
  "Access-Control-Allow-Origin":"*",
  "Access-Control-Allow-Headers":"authorization,content-type,apikey",
  "Content-Type":"application/json"
};

async function loc(v:string){
  const s=String(v||"").trim();
  if(!s)return {city:"",state:"",zip:""};
  if(/^\d{5}$/.test(s)){
    try{
      const r=await fetch("https://api.zippopotam.us/us/"+s);
      if(r.ok){
        const j=await r.json(),p=j.places?.[0];
        if(p)return{city:p["place name"]||"",state:p["state abbreviation"]||"",zip:s};
      }
    }catch(_){}
  }
  const a=s.split(",");
  return{city:(a[0]||"").trim(),state:(a[1]||"").trim().toUpperCase(),zip:""};
}

async function geocodeCity(city:string,state:string){
  if(!city||!state)return null;
  try{
    const q=encodeURIComponent(city+", "+state+", USA");
    const r=await fetch("https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=us&q="+q,{
      headers:{"Accept":"application/json","User-Agent":"MileCount-Live-Board/1.0"}
    });
    if(!r.ok)return null;
    const j=await r.json(),p=j?.[0];
    if(!p)return null;
    const lat=Number(p.lat),lon=Number(p.lon);
    return Number.isFinite(lat)&&Number.isFinite(lon)?{lat,lon}:null;
  }catch(_){return null}
}

Deno.serve(async req=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:H});
  try{
    const b=await req.json();
    const liveBoard=String(b.search_mode||"")==="live_board";
    const originBoard=String(b.search_mode||"")==="origin_board";
    const o=await loc(b.origin);
    const d=await loc(originBoard?b.origin:b.destination);

    if(!liveBoard && (!o.city||!o.state)){
      return new Response(JSON.stringify({error:"Could not resolve origin",resolved:{origin:o,destination:d}}),{status:400,headers:H});
    }

    const p=new URLSearchParams();
    if(!liveBoard){
      p.set("octy",o.city);
      p.set("ost",o.state);
      if(d.city&&d.state&&(originBoard||String(b.destination||"").toLowerCase()!=="anywhere, usa")){
        p.set("dcty",d.city);
        p.set("dst",d.state);
      }
      p.set("milesSlider",originBoard?"9999":String(Math.min(9999,Math.max(0,Number(b.max_deadhead??100)))));
      if(b.pickup_date)p.set("pickupDate",String(b.pickup_date));
    }else{
      p.set("milesSlider","9999");
    }
    if(!originBoard)p.set("freight","Van");
    p.set("gross_rpm",String(Math.max(0,Number(b.min_rpm??0))));

    const r=await fetch("https://www.truktek.com/api/loads?"+p.toString(),{
      headers:{"Accept":"application/json","User-Agent":"MileCount-Live-Pilot/7.0"}
    });
    if(!r.ok){
      return new Response(JSON.stringify({error:"TrukTek "+r.status,resolved:{origin:o,destination:d}}),{status:502,headers:H});
    }

    const j=await r.json();
    // This provider resolves origin coordinates only when both endpoints are
    // supplied. Anchor both at the truck, then filter pickup distance ourselves
    // so outbound destinations remain available. Never accept its zero-origin board.
    if(originBoard&&(!Number.isFinite(Number(j.geo?.olat))||!Number.isFinite(Number(j.geo?.olon))||(Number(j.geo.olat)===0&&Number(j.geo.olon)===0))){
      return new Response(JSON.stringify({error:"Provider could not resolve the truck market",loads:[]}),{status:502,headers:H});
    }
    const space=Number(b.space_ft||999),weight=Number(b.weight_lb||999999);
    let raw=(j.loads||[]).map((x:any)=>({
      provider:"TrukTek",
      provider_load_id:String(x.loadId||""),
      name:(x.octy||"Pickup")+" → "+(x.dcty||"Delivery"),
      pickup:[x.octy,x.ost].filter(Boolean).join(", "),
      delivery:[x.dcty,x.dst].filter(Boolean).join(", "),
      origin:{city:x.octy||"",state:x.ost||""},
      destination:{city:x.dcty||"",state:x.dst||""},
      pay:Number(x.ratePay||0),
      weight:Number(x.weight||0),
      space:Number(x.length||0),
      loadedMiles:Number(x.loadDist||0),
      rpm:Number(x.grossRpm||0),
      deadhead:Number(x.o2oDist||0),
      equipment:x.equip,
      routeCoordinates:Array.isArray(x.coordinates)?x.coordinates:[],
      pickupDate:x.pickupDate||null,
      deliveryDate:x.deliveryDate||null,
      broker:x.shipperNm||null,
      booking_reference:String(x.loadId||""),
      map_lat:null,
      map_lon:null
    }));

    if(liveBoard){
      const missing=raw.filter((x:any)=>!Array.isArray(x.routeCoordinates)||!x.routeCoordinates.length);
      const keys=[...new Set(missing.map((x:any)=>[x.origin.city,x.origin.state].join("|")).filter(Boolean))].slice(0,30);
      const geo=new Map<string,{lat:number,lon:number}>();
      for(let i=0;i<keys.length;i+=5){
        const batch=keys.slice(i,i+5);
        const vals=await Promise.all(batch.map(async key=>{
          const [city,state]=key.split("|");
          return [key,await geocodeCity(city,state)] as const;
        }));
        vals.forEach(([key,v])=>{if(v)geo.set(key,v)});
      }
      raw=raw.map((x:any)=>{
        if(Array.isArray(x.routeCoordinates)&&x.routeCoordinates.length){
          const p=x.routeCoordinates[0];
          if(Array.isArray(p)&&p.length>=2){
            x.map_lon=Number(p[0]);x.map_lat=Number(p[1]);
          }
        }else{
          const g=geo.get([x.origin.city,x.origin.state].join("|"));
          if(g){x.map_lat=g.lat;x.map_lon=g.lon}
        }
        return x;
      });
    }

    if(originBoard)raw=raw.filter((x:any)=>Number.isFinite(x.deadhead)&&x.deadhead<=Math.min(300,Math.max(0,Number(b.max_deadhead??175))));
    const matched=liveBoard?raw:raw.filter((x:any)=>(!x.space||x.space<=space)&&(!x.weight||x.weight<=weight));
    const loads=originBoard?matched.sort((a:any,b:any)=>a.deadhead-b.deadhead).slice(0,200):matched;

    return new Response(JSON.stringify({
      mode:originBoard?"live_origin_board":liveBoard?"live_public_board":"live_public_api",
      provider:"TrukTek",
      resolved:{origin:o,destination:d},
      geo:j.geo||null,
      total:Number(j.total||raw.length),
      count:loads.length,
      live_found:raw.length,
      mapped_count:loads.filter((x:any)=>Number.isFinite(x.map_lat)&&Number.isFinite(x.map_lon)).length,
      loads,
      nearby_live_preview:loads.length?[]:raw.slice(0,5)
    }),{headers:H});
  }catch(e){
    return new Response(JSON.stringify({error:String(e)}),{status:500,headers:H});
  }
});
