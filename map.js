let mileCountMapRenderGeneration=0;
/*
==================================================
MILECOUNT MAP ENGINE V2
REAL ROAD ROUTING
==================================================
Requires:
- Leaflet
- routing.js

Purpose:
- Real OpenStreetMap
- Actual road/highway route
- Dotted MileCount route
- Numbered stops
- Truck marker
- Route mileage
- Drive time
- Homebound route
- Safe fallback if routing service fails
==================================================
*/


let mileCountMap = null;

let mileCountRoute = null;

let mileCountMarkers = [];

let mileCountLastRoute = null;


/*
==================================================
CITY COORDINATES

Leaflet format:
[latitude, longitude]
==================================================
*/

const MileCountMapLocations = {

  "Atlanta, GA": [
    33.7490,
    -84.3880
  ],

  "Greenville, SC": [
    34.8526,
    -82.3940
  ],

  "Spartanburg, SC": [
    34.9496,
    -81.9320
  ],

  "Charlotte, NC": [
    35.2271,
    -80.8431
  ],

  "Nashville, TN": [
    36.1627,
    -86.7816
  ],

  "Baltimore, MD": [
    39.2904,
    -76.6122
  ],

  "Birmingham, AL": [
    33.5186,
    -86.8104
  ],

  "Macon, GA": [
    32.8407,
    -83.6324
  ],

  "Jacksonville, FL": [
    30.3322,
    -81.6557
  ],

  "Orlando, FL": [
    28.5383,
    -81.3792
  ]

};


/*
==================================================
INITIALIZE MAP
==================================================
*/

function initMileCountMap() {

  const mapElement =
    document.getElementById(
      "realMap"
    );


  if (
    !mapElement ||
    typeof L === "undefined"
  ) {

    return;

  }


  /*
  Don't create Leaflet twice.
  */

  if (mileCountMap) {

    setTimeout(function () {

      mileCountMap.invalidateSize();

    }, 100);

    return;

  }


  mileCountMap =
    L.map(
      "realMap",
      {
        zoomControl: true
      }
    )
    .setView(
      MileCountMapLocations[
        "Atlanta, GA"
      ],
      6
    );


  L.tileLayer(

    "https://tile.openstreetmap.org/{z}/{x}/{y}.png",

    {

      maxZoom: 19,

      attribution:
        "&copy; OpenStreetMap contributors"

    }

  ).addTo(
    mileCountMap
  );


  // Route is drawn only after the user selects/analyzes a trip.
  // Never preload demo geography into a real search session.

}


/*
==================================================
CLEAR ROUTE
==================================================
*/

function clearMileCountMap() {
  mileCountMapRenderGeneration++;

  if (!mileCountMap) {

    return;

  }


  if (mileCountRoute) {

    mileCountMap.removeLayer(
      mileCountRoute
    );

    mileCountRoute = null;

  }


  mileCountMarkers.forEach(
    function (marker) {

      mileCountMap.removeLayer(
        marker
      );

    }
  );


  mileCountMarkers = [];

}


/*
==================================================
CREATE NUMBERED MARKER
==================================================
*/

function createMileCountMarker(city,index,totalStops,overrideLocation,event=null) {
  const location=overrideLocation||MileCountMapLocations[city];
  if(!location)return null;


  let iconHTML = "";


  /*
  First stop = truck.
  Last stop = destination/home.
  */

  if (index === 0) {

    iconHTML =
      '<div style="' +
      'font-size:28px;' +
      'line-height:32px;' +
      '">' +
      '🚚' +
      '</div>';

  }

  else {

    iconHTML =
      '<div style="' +
      'width:30px;' +
      'height:30px;' +
      'border-radius:50%;' +
      'background:#102c21;' +
      'color:white;' +
      'border:3px solid white;' +
      'display:flex;' +
      'align-items:center;' +
      'justify-content:center;' +
      'font-weight:900;' +
      'box-shadow:0 2px 8px rgba(0,0,0,.25);' +
      '">' +
      (index) +
      '</div>';

  }


  const icon =
    L.divIcon({

      html:
        iconHTML,

      className:
        "",

      iconSize:
        [34,34],

      iconAnchor:
        [17,17]

    });


  const marker =
    L.marker(
      location,
      {
        icon: icon
      }
    )
    .addTo(
      mileCountMap
    );


  let label =
    city;


  if (index === 0) {

    label =
      "START • " +
      city;

  }

  else if (
    index ===
    totalStops - 1
  ) {

    label =
      "DESTINATION • " +
      city;

  }

  else {

    label =
      "STOP " +
      (index) +
      " • " +
      city;

  }


  if(event&&index>0)label="STOP "+index+" • "+String(event.type||"stop").toUpperCase()+" • "+city;

  marker.bindPopup(
    "<strong>" +
    label +
    "</strong>"
  );


  mileCountMarkers.push(
    marker
  );


  return marker;

}


/*
==================================================
SHOW REAL ROAD ROUTE
==================================================
*/

async function showMileCountRoute(
  stops, verifiedRoute=null
) {

  if (!mileCountMap) {

    return null;

  }


  clearMileCountMap();
  const renderGeneration=mileCountMapRenderGeneration;

  /*
  Add markers immediately so the
  driver sees something while the
  road route loads.
  */

  // Markers are added after locations are resolved; do not place guessed markers.


  /*
  Try real road routing.
  */

  if (
    typeof getMileCountRoadRoute ===
    "function"
  ) {

    try {

      const roadRoute =
        verifiedRoute&&JSON.stringify(verifiedRoute.stops)===JSON.stringify(stops)?verifiedRoute:await getMileCountRoadRoute(stops);
      if(renderGeneration!==mileCountMapRenderGeneration)return null;


      mileCountLastRoute =
        roadRoute;


      const leafletCoordinates=mileCountGeometryToLeaflet(roadRoute.geometry);
      (roadRoute.resolvedLocations||[]).forEach((p,index)=>createMileCountMarker(stops[index],index,stops.length,[p.lat,p.lon],roadRoute.events?.[index-1]));


      if (
        leafletCoordinates.length >
        1
      ) {

        mileCountRoute =
          L.polyline(
            leafletCoordinates,
            {

              color:
                "#18a568",

              weight:
                6,

              opacity:
                0.95,

              dashArray:
                null,

              lineCap:
                "round",

              lineJoin:
                "round"

            }
          )
          .addTo(
            mileCountMap
          );


        mileCountMap.fitBounds(
          mileCountRoute
            .getBounds(),
          {
            padding:
              [30,30]
          }
        );


        updateMileCountRouteInfo(
          roadRoute
        );


        return roadRoute;

      }

    }

    catch (error) {

      console.warn(
        "MileCount real road routing failed. Using map fallback.",
        error
      );

    }

  }


  /*
  Fallback:
  city-to-city dotted line.

  This means MileCount still works
  even if OSRM is unavailable.
  */

  if(renderGeneration!==mileCountMapRenderGeneration)return null;
  const sourceElement = document.getElementById("routeSource");
  if (sourceElement) {
    sourceElement.textContent = "Fallback route • live road routing unavailable";
  }

  return showMileCountFallbackRoute(
    stops
  );

}


/*
==================================================
FALLBACK ROUTE
==================================================
*/

function showMileCountFallbackRoute(
  stops
) {

  const coordinates = [];


  stops.forEach(
    function (city) {

      const location =
        MileCountMapLocations[
          city
        ];


      if (location) {

        coordinates.push(
          location
        );

      }

    }
  );


  if (
    coordinates.length <
    2
  ) {
    // Never leave the trip UI stuck on "Loading..." when the fallback cannot
    // draw unknown cities. Preserve the finalized trip estimate instead.
    const milesElement=document.getElementById("roadMiles");
    const timeElement=document.getElementById("driveTime");
    const sourceElement=document.getElementById("routeSource");
    const estimated=Number(window.MileCountFinalRouteEstimate?.miles||0);
    const hours=Number(window.MileCountFinalRouteEstimate?.hours||0);
    if(milesElement)milesElement.textContent=estimated?estimated.toFixed(1)+" mi":"Route unavailable";
    if(timeElement)timeElement.textContent=hours?(Math.floor(hours)+" hr "+Math.round((hours%1)*60)+" min"):"Route unavailable";
    if(sourceElement)sourceElement.textContent="Estimated trip route • live road routing temporarily unavailable";
    return null;
  }


  mileCountRoute =
    L.polyline(
      coordinates,
      {

        color:
          "#18a568",

        weight:
          6,

        opacity:
          0.8,

        dashArray:
          "4, 12",

        lineCap:
          "round"

      }
    )
    .addTo(
      mileCountMap
    );


  mileCountMap.fitBounds(
    mileCountRoute
      .getBounds(),
    {
      padding:
        [30,30]
    }
  );


  return null;

}


/*
==================================================
ROUTE INFORMATION
==================================================
*/

function updateMileCountRouteInfo(
  route
) {

  if (!route) {

    return;

  }


  /*
  These elements are optional.

  Later we can add them to the UI
  without changing this engine.
  */

  const milesElement =
    document.getElementById(
      "roadMiles"
    );


  const timeElement =
    document.getElementById(
      "driveTime"
    );


  const sourceElement =
    document.getElementById(
      "routeSource"
    );


  if (milesElement) {

    milesElement.textContent =
      route.miles
        .toFixed(1) +
      " mi";

  }


  if (timeElement) {

    timeElement.textContent =
      route.driveTime;

  }


  if (sourceElement) {

    sourceElement.textContent =
      (route.planningPreview?"PLANNING PREVIEW • "+(route.capacityVerified===false?"CAPACITY NOT VERIFIED • ":"")+(route.timingVerified===false?"MULTI-DAY / TIMING NOT VERIFIED • ":""):"")+(route.routingStatus||route.source);

  }

}


/*
==================================================
GET CURRENT ROAD MILES

app.js can use this later.
==================================================
*/

function getMileCountCurrentRoadMiles() {

  if (
    mileCountLastRoute &&
    Number.isFinite(
      mileCountLastRoute.miles
    )
  ) {

    return mileCountLastRoute.miles;

  }


  return null;

}


/*
==================================================
GET CURRENT DRIVE TIME
==================================================
*/

function getMileCountCurrentDriveTime() {

  if (
    mileCountLastRoute &&
    mileCountLastRoute.driveTime
  ) {

    return mileCountLastRoute.driveTime;

  }


  return null;

}



async function showMileCountProviderRoute(load){
  if(!mileCountMap||!load)return null;
  clearMileCountMap();
  const coords=Array.isArray(load.routeCoordinates)?load.routeCoordinates:[];
  const leaflet=coords.filter(c=>Array.isArray(c)&&c.length>=2).map(c=>[Number(c[1]),Number(c[0])]).filter(c=>Number.isFinite(c[0])&&Number.isFinite(c[1]));
  if(leaflet.length>1){
    mileCountRoute=L.polyline(leaflet,{color:"#18a568",weight:6,opacity:.95,lineCap:"round",lineJoin:"round"}).addTo(mileCountMap);
    const start=leaflet[0],end=leaflet[leaflet.length-1];
    [start,end].forEach((pt,i)=>{const icon=L.divIcon({html:i===0?'<div style="font-size:28px">🚚</div>':'<div style="width:30px;height:30px;border-radius:50%;background:#102c21;color:white;border:3px solid white;display:flex;align-items:center;justify-content:center;font-weight:900">✓</div>',className:"",iconSize:[34,34],iconAnchor:[17,17]});mileCountMarkers.push(L.marker(pt,{icon}).addTo(mileCountMap))});
    mileCountMap.fitBounds(mileCountRoute.getBounds(),{padding:[30,30]});
    const miles=Number(load.loadedMiles||0),hours=miles>0?miles/55:0;
    mileCountLastRoute={miles,driveTime:hours?Math.floor(hours)+" hr "+Math.round((hours%1)*60)+" min":"Provider route",source:(load.provider||"Provider")+" route geometry"};
    updateMileCountRouteInfo(mileCountLastRoute);
    return mileCountLastRoute;
  }
  return showMileCountRoute([load.pickup||load.originLabel,load.delivery||load.destinationLabel].filter(Boolean));
}

/*
==================================================
HOMEBOUND ROUTE
==================================================
*/

async function showHomeboundRoute(origin, destination, home) {

  origin = origin || "Atlanta, GA";
  destination = destination || "Charlotte, NC";
  home = home || "Atlanta, GA";

  const stops = [origin];

  if (stops[stops.length - 1] !== destination) {
    stops.push(destination);
  }

  if (stops[stops.length - 1] !== home) {
    stops.push(home);
  }

  return await showMileCountRoute(stops);

}


/*
==================================================
DIRECT ROUTE

Useful later for calculating
how many miles MileCount added.
==================================================
*/

async function showMileCountDirectRoute(
  origin,
  destination
) {

  return await
    showMileCountRoute([
      origin,
      destination
    ]);

}


/*
==================================================
MAP TEST
==================================================
*/

async function mileCountMapTest() {

  try {

    const result =
      await
      showMileCountRoute([
        "Atlanta, GA",
        "Greenville, SC",
        "Charlotte, NC"
      ]);


    console.log(
      "MileCount Map V2 Test:",
      result
    );


    return result;

  }

  catch (error) {

    console.error(
      "MileCount Map Test Error:",
      error
    );


    return null;

  }

}
