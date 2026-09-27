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


  /*
  Initial outbound route.
  */

  showMileCountRoute([
    "Atlanta, GA",
    "Greenville, SC",
    "Charlotte, NC"
  ]);

}


/*
==================================================
CLEAR ROUTE
==================================================
*/

function clearMileCountMap() {

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

function createMileCountMarker(
  city,
  index,
  totalStops
) {

  const location =
    MileCountMapLocations[
      city
    ];


  if (!location) {

    return null;

  }


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
      (index + 1) +
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
      (index + 1) +
      " • " +
      city;

  }


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
  stops
) {

  if (!mileCountMap) {

    return null;

  }


  clearMileCountMap();


  /*
  Add markers immediately so the
  driver sees something while the
  road route loads.
  */

  stops.forEach(
    function (city,index) {

      createMileCountMarker(
        city,
        index,
        stops.length
      );

    }
  );


  /*
  Try real road routing.
  */

  if (
    typeof getMileCountRoadRoute ===
    "function"
  ) {

    try {

      const roadRoute =
        await
        getMileCountRoadRoute(
          stops
        );


      mileCountLastRoute =
        roadRoute;


      const leafletCoordinates =
        mileCountGeometryToLeaflet(
          roadRoute.geometry
        );


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
                "4, 10",

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
      route.source;

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


/*
==================================================
HOMEBOUND ROUTE
==================================================
*/

async function showHomeboundRoute() {

  return await
    showMileCountRoute([
      "Atlanta, GA",
      "Greenville, SC",
      "Charlotte, NC",
      "Atlanta, GA"
    ]);

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
