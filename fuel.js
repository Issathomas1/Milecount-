/*
==================================================
MILECOUNT FUEL ENGINE V3
Official EIA baseline
==================================================
*/

const MileCountTruck = {
  type: "26-ft Box Truck",
  mpg: 9,
  home: "Atlanta, GA",
  cargoLength: 26,
  payloadCapacity: 10000
};


/*
==================================================
PUBLIC DIESEL DATA

Source:
U.S. Energy Information Administration

Dataset:
Weekly Retail On-Highway Diesel Prices

Region:
Lower Atlantic (PADD 1C)

Current verified value:
$6.139 / gallon

Week:
September 21, 2026

Release:
September 22, 2026
==================================================
*/

const MileCountFuelPrices = {

  "Atlanta, GA": {
    price: 6.139,
    source: "EIA • Lower Atlantic",
    updated: "Sep 21, 2026"
  },

  "Charlotte, NC": {
    price: 6.139,
    source: "EIA • Lower Atlantic",
    updated: "Sep 21, 2026"
  },

  "Greenville, SC": {
    price: 6.139,
    source: "EIA • Lower Atlantic",
    updated: "Sep 21, 2026"
  },

  "Nashville, TN": {
    price: 6.139,
    source: "EIA • Lower Atlantic",
    updated: "Sep 21, 2026"
  }

};


/*
Fallback
*/

const MileCountFallbackFuel = {

  price: 6.139,

  source: "EIA • Lower Atlantic",

  updated: "Sep 21, 2026"

};


/*
GET FUEL PRICE
*/

function getMileCountFuelPrice(city) {

  if (MileCountFuelPrices[city]) {

    return MileCountFuelPrices[city];

  }

  return MileCountFallbackFuel;

}


/*
CALCULATE GALLONS
*/

function calculateMileCountGallons(
  miles,
  mpg
) {

  miles = Number(miles) || 0;

  mpg = Number(mpg) || MileCountTruck.mpg;


  if (miles < 0) {

    miles = 0;

  }


  if (mpg <= 0) {

    mpg = MileCountTruck.mpg;

  }


  return miles / mpg;

}


/*
CALCULATE TRIP FUEL
*/

function calculateMileCountTripFuel(
  miles,
  city
) {

  const fuelData =
    getMileCountFuelPrice(city);


  const gallons =
    calculateMileCountGallons(
      miles,
      MileCountTruck.mpg
    );


  const fuelCost =
    gallons *
    fuelData.price;


  return {

    miles:
      Number(miles) || 0,

    mpg:
      MileCountTruck.mpg,

    gallons:
      gallons,

    dieselPrice:
      fuelData.price,

    fuelCost:
      fuelCost,

    source:
      fuelData.source,

    updated:
      fuelData.updated

  };

}


/*
CALCULATE ROUND TRIP
*/

function calculateMileCountRoundTrip(
  outboundRevenue,
  returnRevenue,
  roundTripMiles,
  originCity
) {

  outboundRevenue =
    Number(outboundRevenue) || 0;


  returnRevenue =
    Number(returnRevenue) || 0;


  roundTripMiles =
    Number(roundTripMiles) || 0;


  const totalRevenue =
    outboundRevenue +
    returnRevenue;


  const fuel =
    calculateMileCountTripFuel(
      roundTripMiles,
      originCity
    );


  let rpm = 0;


  if (roundTripMiles > 0) {

    rpm =
      totalRevenue /
      roundTripMiles;

  }


  const afterFuel =
    totalRevenue -
    fuel.fuelCost;


  return {

    outboundRevenue:
      outboundRevenue,

    returnRevenue:
      returnRevenue,

    totalRevenue:
      totalRevenue,

    miles:
      roundTripMiles,

    rpm:
      rpm,

    gallons:
      fuel.gallons,

    mpg:
      fuel.mpg,

    dieselPrice:
      fuel.dieselPrice,

    fuelCost:
      fuel.fuelCost,

    afterFuel:
      afterFuel,

    fuelSource:
      fuel.source,

    fuelUpdated:
      fuel.updated

  };

}


/*
MONEY FORMAT
*/

function mileCountMoney(value) {

  return "$" +
    Math.round(
      Number(value) || 0
    ).toLocaleString();

}


/*
TEST
*/

function mileCountFuelTest() {

  const result =
    calculateMileCountRoundTrip(
      1875,
      740,
      524,
      "Atlanta, GA"
    );


  console.log(
    "MileCount EIA Fuel Engine:",
    result
  );


  return result;

}
