/*
==================================================
MILECOUNT FUEL ENGINE
Version 1.0
==================================================

Purpose:

- Store truck MPG
- Store latest diesel estimate
- Calculate gallons
- Calculate fuel cost
- Calculate extra-load fuel
- Calculate round-trip fuel
- Calculate estimated money after fuel

IMPORTANT:

"After Fuel" is NOT net profit.

It does not automatically include:
insurance
maintenance
truck payment
driver pay
tolls
taxes
repairs
other operating expenses
==================================================
*/


/*
------------------------------
DEFAULT TRUCK PROFILE
------------------------------
*/

const MileCountTruck = {

  type: "26-ft Box Truck",

  mpg: 9,

  home: "Atlanta, GA",

  cargoLength: 26,

  payloadCapacity: 10000,

  liftgate: true,

  palletJack: true

};


/*
------------------------------
FUEL PRICE DATABASE
------------------------------

For now these are CACHED / SIMULATION
values.

Later MileCount can replace these
with current EIA/public data.

Never label these as live prices.
------------------------------
*/

const MileCountFuelPrices = {

  "Atlanta, GA": {
    price: 3.45,
    source: "SIMULATED / CACHED",
    updated: "Prototype"
  },

  "Charlotte, NC": {
    price: 3.42,
    source: "SIMULATED / CACHED",
    updated: "Prototype"
  },

  "Nashville, TN": {
    price: 3.38,
    source: "SIMULATED / CACHED",
    updated: "Prototype"
  },

  "Greenville, SC": {
    price: 3.39,
    source: "SIMULATED / CACHED",
    updated: "Prototype"
  },

  "Baltimore, MD": {
    price: 3.58,
    source: "SIMULATED / CACHED",
    updated: "Prototype"
  }

};


/*
------------------------------
GET DIESEL PRICE
------------------------------
*/

function getMileCountFuelPrice(city) {

  if (MileCountFuelPrices[city]) {

    return MileCountFuelPrices[city];

  }

  /*
  Fallback price.

  Still clearly simulated.
  */

  return {

    price: 3.45,

    source: "SIMULATED / CACHED",

    updated: "Prototype"

  };

}


/*
------------------------------
CALCULATE GALLONS
------------------------------
*/

function calculateMileCountGallons(
  miles,
  mpg
) {

  miles = Number(miles);

  mpg = Number(mpg);


  if (
    !Number.isFinite(miles) ||
    miles < 0
  ) {

    miles = 0;

  }


  if (
    !Number.isFinite(mpg) ||
    mpg <= 0
  ) {

    mpg = MileCountTruck.mpg;

  }


  return miles / mpg;

}


/*
------------------------------
CALCULATE FUEL COST
------------------------------
*/

function calculateMileCountFuelCost(
  miles,
  mpg,
  dieselPrice
) {

  const gallons =
    calculateMileCountGallons(
      miles,
      mpg
    );


  dieselPrice =
    Number(dieselPrice);


  if (
    !Number.isFinite(dieselPrice) ||
    dieselPrice < 0
  ) {

    dieselPrice = 0;

  }


  return gallons * dieselPrice;

}


/*
------------------------------
FULL TRIP FUEL ESTIMATE
------------------------------
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


  const cost =
    gallons *
    fuelData.price;


  return {

    miles: miles,

    mpg: MileCountTruck.mpg,

    gallons: gallons,

    dieselPrice: fuelData.price,

    fuelCost: cost,

    source: fuelData.source,

    updated: fuelData.updated

  };

}


/*
------------------------------
EXTRA LOAD FUEL
------------------------------

Example:

MileCount adds a partial that
requires 30 additional miles.
------------------------------
*/

function calculateMileCountExtraFuel(
  extraMiles,
  city
) {

  return calculateMileCountTripFuel(
    extraMiles,
    city
  );

}


/*
------------------------------
ROUND TRIP ECONOMICS
------------------------------
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
------------------------------
MONEY FORMATTER
------------------------------
*/

function mileCountMoney(value) {

  value =
    Number(value) || 0;


  return (
    "$" +
    Math.round(value)
      .toLocaleString()
  );

}


/*
------------------------------
DECIMAL MONEY FORMATTER
------------------------------
*/

function mileCountMoneyDecimal(value) {

  value =
    Number(value) || 0;


  return (
    "$" +
    value.toFixed(2)
  );

}


/*
------------------------------
TEST / DEBUG
------------------------------

You can run this later
in the browser console:

mileCountFuelTest()

------------------------------
*/

function mileCountFuelTest() {

  const test =
    calculateMileCountRoundTrip(
      1875,
      740,
      524,
      "Atlanta, GA"
    );


  console.log(
    "MileCount Fuel Test",
    test
  );


  return test;

}
