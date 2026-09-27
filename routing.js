/*
==================================================
MILECOUNT ROUTING ENGINE V1
==================================================

Purpose:
- Calculate actual road routes
- Calculate drivable miles
- Calculate estimated drive time
- Return road geometry for the map
- Calculate additional detour miles

Prototype routing provider:
OSRM public demo service

IMPORTANT:
The public OSRM service is for development/testing.
MileCount will use production routing infrastructure
before commercial launch.
==================================================
*/


/*
------------------------------
CITY COORDINATES
------------------------------

Format:
[longitude, latitude]

OSRM requires longitude first.
*/

const MileCountLocations = {

  "Atlanta, GA": [
    -84.3880,
    33.7490
  ],

  "Greenville, SC": [
    -82.3940,
    34.8526
  ],

  "Spartanburg, SC": [
    -81.9320,
    34.9496
  ],

  "Charlotte, NC": [
    -80.8431,
    35.2271
  ],

  "Nashville, TN": [
    -86.7816,
    36.1627
  ],

  "Baltimore, MD": [
    -76.6122,
    39.2904
  ],

  "Birmingham, AL": [
    -86.8104,
    33.5186
  ],

  "Macon, GA": [
    -83.6324,
    32.8407
  ],

  "Jacksonville, FL": [
    -81.6557,
    30.3322
  ],

  "Orlando, FL": [
    -81.3792,
    28.5383
  ],

  "Dallas, TX": [
    -96.7970,
    32.7767
  ],

  "Houston, TX": [
    -95.3698,
    29.7604
  ]

};



const mileCountGeoCache=new Map();
async function resolveMileCountLocation(value){
 const q=String(value||"").trim();if(!q)throw new Error("Location required");
 if(mileCountGeoCache.has(q))return mileCountGeoCache.get(q);
 if(MileCountLocations[q]){const x={lon:MileCountLocations[q][0],lat:MileCountLocations[q][1],label:q,source:"MileCount verified city table"};mileCountGeoCache.set(q,x);return x}
 let query=q;
 if(/^\d{5}$/.test(q)){const z=await fetch("https://api.zippopotam.us/us/"+q);if(z.ok){const j=await z.json(),p=j.places?.[0];if(p)query=(p["place name"]||"")+", "+(p["state abbreviation"]||"")+" "+q}}
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),2200);
 try{
  const r=await fetch("https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=us&q="+encodeURIComponent(query),{headers:{"Accept":"application/json"},signal:controller.signal});
  if(!r.ok)throw new Error("Geocoder "+r.status);
  const j=await r.json(),p=j?.[0];if(!p)throw new Error("Location not found: "+q);
  const x={lon:Number(p.lon),lat:Number(p.lat),label:p.display_name||q,source:"OpenStreetMap Nominatim"};mileCountGeoCache.set(q,x);return x
 }finally{clearTimeout(timer)}
}
async function buildResolvedCoordinates(stops){
 const points=await Promise.all(stops.map(resolveMileCountLocation));
 return{points,coordinateString:points.map(p=>p.lon+","+p.lat).join(";")};
}

/*
------------------------------
CONVERSIONS
------------------------------
*/

function mileCountMetersToMiles(
  meters
) {

  return meters / 1609.344;

}


function mileCountSecondsToHours(
  seconds
) {

  return seconds / 3600;

}


/*
------------------------------
FORMAT DRIVE TIME
------------------------------
*/

function formatMileCountDriveTime(
  seconds
) {

  seconds =
    Number(seconds) || 0;


  const totalMinutes =
    Math.round(
      seconds / 60
    );


  const hours =
    Math.floor(
      totalMinutes / 60
    );


  const minutes =
    totalMinutes % 60;


  if (hours <= 0) {

    return (
      minutes +
      " min"
    );

  }


  return (
    hours +
    " hr " +
    minutes +
    " min"
  );

}


/*
------------------------------
BUILD OSRM COORDINATES
------------------------------
*/

function buildMileCountCoordinates(
  stops
) {

  const coordinates = [];


  stops.forEach(function (
    city
  ) {

    const location =
      MileCountLocations[
        city
      ];


    if (location) {

      coordinates.push(
        location.join(",")
      );

    }

  });


  return coordinates.join(";");

}


/*
------------------------------
GET ROAD ROUTE
------------------------------
*/

async function getMileCountRoadRoute(
  stops
) {

  if (
    !Array.isArray(stops) ||
    stops.length < 2
  ) {

    throw new Error(
      "MileCount route requires at least two stops."
    );

  }


  const resolved=await buildResolvedCoordinates(stops);
  const coordinateString=resolved.coordinateString;

  if (!coordinateString) {

    throw new Error(
      "MileCount could not find route coordinates."
    );

  }


  const url =
    "https://router.project-osrm.org/route/v1/driving/" +
    coordinateString +
    "?overview=full" +
    "&geometries=geojson" +
    "&steps=true";


  const response =
    await fetch(url);


  if (!response.ok) {

    throw new Error(
      "Routing service returned " +
      response.status
    );

  }


  const data =
    await response.json();


  if (
    data.code !== "Ok" ||
    !data.routes ||
    !data.routes.length
  ) {

    throw new Error(
      "No road route found."
    );

  }


  const route =
    data.routes[0];


  const miles =
    mileCountMetersToMiles(
      route.distance
    );


  const hours =
    mileCountSecondsToHours(
      route.duration
    );


  return {

    stops:
      stops,

    meters:
      route.distance,

    miles:
      miles,

    seconds:
      route.duration,

    hours:
      hours,

    driveTime:
      formatMileCountDriveTime(
        route.duration
      ),

    geometry:
      route.geometry,

    legs:
      route.legs,

    source:
      "OSRM road route / OpenStreetMap geography",

    resolvedLocations: resolved.points

  };

}


/*
------------------------------
PRIMARY ROUTE
------------------------------
*/

async function getMileCountPrimaryRoute(
  origin,
  destination
) {

  return await
    getMileCountRoadRoute([
      origin,
      destination
    ]);

}


/*
------------------------------
STACKED ROUTE
------------------------------

Example:

Atlanta
Greenville
Charlotte
*/

async function getMileCountStackedRoute(
  stops
) {

  return await
    getMileCountRoadRoute(
      stops
    );

}


/*
------------------------------
CALCULATE DETOUR
------------------------------

Compares:

Direct route

vs

Route with MileCount stops
*/

async function calculateMileCountDetour(
  origin,
  destination,
  additionalStops
) {

  additionalStops =
    additionalStops || [];


  const direct =
    await
    getMileCountRoadRoute([
      origin,
      destination
    ]);


  const stackedStops = [
    origin
  ]
  .concat(
    additionalStops
  )
  .concat([
    destination
  ]);


  const stacked =
    await
    getMileCountRoadRoute(
      stackedStops
    );


  const extraMiles =
    Math.max(
      0,
      stacked.miles -
      direct.miles
    );


  const extraSeconds =
    Math.max(
      0,
      stacked.seconds -
      direct.seconds
    );


  return {

    directMiles:
      direct.miles,

    stackedMiles:
      stacked.miles,

    extraMiles:
      extraMiles,

    directDriveTime:
      direct.driveTime,

    stackedDriveTime:
      stacked.driveTime,

    extraDriveTime:
      formatMileCountDriveTime(
        extraSeconds
      ),

    direct:
      direct,

    stacked:
      stacked

  };

}


/*
------------------------------
ROUND TRIP ROUTE
------------------------------
*/

async function getMileCountRoundTripRoute(
  outboundStops,
  homeCity
) {

  const stops =
    outboundStops.slice();


  if (
    stops[
      stops.length - 1
    ] !== homeCity
  ) {

    stops.push(
      homeCity
    );

  }


  return await
    getMileCountRoadRoute(
      stops
    );

}


/*
------------------------------
ROAD GEOMETRY FOR LEAFLET
------------------------------

OSRM GeoJSON uses:

[longitude, latitude]

Leaflet uses:

[latitude, longitude]
*/

function mileCountGeometryToLeaflet(
  geometry
) {

  if (
    !geometry ||
    !geometry.coordinates
  ) {

    return [];

  }


  return geometry.coordinates.map(
    function (coordinate) {

      return [
        coordinate[1],
        coordinate[0]
      ];

    }
  );

}


/*
------------------------------
TEST ROUTING ENGINE
------------------------------

Later in browser console:

mileCountRoutingTest()
*/

async function mileCountRoutingTest() {

  try {

    const result =
      await
      calculateMileCountDetour(
        "Atlanta, GA",
        "Charlotte, NC",
        [
          "Greenville, SC"
        ]
      );


    console.log(
      "MileCount Routing Test:",
      result
    );


    return result;

  }

  catch (error) {

    console.error(
      "MileCount Routing Error:",
      error
    );


    return null;

  }

}
