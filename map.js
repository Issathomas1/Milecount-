/* MileCount Map Module v1 */

let mileCountMap = null;
let mileCountRoute = null;
let mileCountMarkers = [];

const mileCountCities = {
  "Atlanta, GA": [33.7490, -84.3880],
  "Greenville, SC": [34.8526, -82.3940],
  "Spartanburg, SC": [34.9496, -81.9320],
  "Charlotte, NC": [35.2271, -80.8431],
  "Nashville, TN": [36.1627, -86.7816],
  "Baltimore, MD": [39.2904, -76.6122]
};

function initMileCountMap() {

  const mapElement =
    document.getElementById("realMap");

  if (!mapElement || typeof L === "undefined") {
    return;
  }

  if (mileCountMap) {
    return;
  }

  mileCountMap = L.map("realMap").setView(
    mileCountCities["Atlanta, GA"],
    7
  );

  L.tileLayer(
    "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    {
      maxZoom: 19,
      attribution:
        '&copy; OpenStreetMap contributors'
    }
  ).addTo(mileCountMap);

  showMileCountRoute([
    "Atlanta, GA",
    "Greenville, SC",
    "Charlotte, NC"
  ]);
}


function clearMileCountMap() {

  if (!mileCountMap) {
    return;
  }

  if (mileCountRoute) {
    mileCountMap.removeLayer(mileCountRoute);
    mileCountRoute = null;
  }

  mileCountMarkers.forEach(function(marker) {
    mileCountMap.removeLayer(marker);
  });

  mileCountMarkers = [];
}


function showMileCountRoute(stops) {

  if (!mileCountMap) {
    return;
  }

  clearMileCountMap();

  const coordinates = [];

  stops.forEach(function(city, index) {

    const location =
      mileCountCities[city];

    if (!location) {
      return;
    }

    coordinates.push(location);

    const marker = L.marker(location)
      .addTo(mileCountMap);

    marker.bindPopup(
      "<strong>" +
      (index + 1) +
      ". " +
      city +
      "</strong>"
    );

    mileCountMarkers.push(marker);
  });

  if (coordinates.length < 2) {
    return;
  }

  mileCountRoute = L.polyline(
    coordinates,
    {
      color: "#16a466",
      weight: 6,
      opacity: 0.9,
      dashArray: "4, 12",
      lineCap: "round"
    }
  ).addTo(mileCountMap);

  mileCountMap.fitBounds(
    mileCountRoute.getBounds(),
    {
      padding: [30, 30]
    }
  );
}


function showHomeboundRoute() {

  showMileCountRoute([
    "Atlanta, GA",
    "Greenville, SC",
    "Charlotte, NC",
    "Atlanta, GA"
  ]);
}
