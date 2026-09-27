/*
==================================================
MILECOUNT APP ENGINE
Version 1.0
==================================================
*/

(function () {
  "use strict";

  /*
  ------------------------------
  APP STATE
  ------------------------------
  */

  const MileCountState = {

    primaryPay: 1400,

    addedPay: 0,

    totalPay: 1400,

    returnPay: 740,

    extraMiles: 0,

    roundTripMiles: 524,

    homeAdded: false,

    origin: "Atlanta, GA",

    destination: "Charlotte, NC",

    home: "Atlanta, GA"

  };


  /*
  ------------------------------
  HELPERS
  ------------------------------
  */

  function el(id) {
    return document.getElementById(id);
  }


  function numberValue(id, fallback) {

    const element = el(id);

    if (!element) {
      return fallback || 0;
    }

    const value =
      Number(element.value);

    if (!Number.isFinite(value)) {
      return fallback || 0;
    }

    return value;
  }


  function money(value) {

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
  SCREEN CONTROL
  ------------------------------
  */

  function showScreen(number) {

    const screens =
      document.querySelectorAll(
        ".screen"
      );


    screens.forEach(function (
      screen,
      index
    ) {

      screen.classList.toggle(
        "active",
        index === number - 1
      );

    });


    window.scrollTo(0, 0);


    /*
    Refresh Leaflet after the
    map screen becomes visible.
    */

    if (number === 3) {

      setTimeout(function () {

        if (
          typeof initMileCountMap ===
          "function"
        ) {

          initMileCountMap();

        }


        if (
          typeof mileCountMap !==
            "undefined" &&
          mileCountMap
        ) {

          mileCountMap.invalidateSize();

        }

      }, 250);

    }

  }


  /*
  ------------------------------
  FIND ME MONEY
  ------------------------------
  */

  async function findMoney() {

    const pay =
      Math.max(
        0,
        numberValue(
          "pay",
          1400
        )
      );


    const space =
      Math.max(
        0,
        numberValue(
          "space",
          14
        )
      );


    const weight =
      Math.max(
        0,
        numberValue(
          "weight",
          6200
        )
      );


    const originElement =
      el("from");


    const destinationElement =
      el("to");


    if (originElement) {

      MileCountState.origin =
        originElement.value;

    }


    if (destinationElement) {

      MileCountState.destination =
        destinationElement.value;

    }


    /*
    SIMULATED AUTOSTACK

    Later this becomes the real
    optimization engine.
    */

    let addedPay = 0;

    let extraMiles = 0;

    let spaceUsed = 0;

    let weightUsed = 0;


    if (
      space >= 7 &&
      weight >= 2450
    ) {

      addedPay = 475;

      extraMiles = 30;

      spaceUsed = 7;

      weightUsed = 2450;

    }

    else if (
      space >= 4 &&
      weight >= 1800
    ) {

      addedPay = 290;

      extraMiles = 18;

      spaceUsed = 4;

      weightUsed = 1800;

    }


    MileCountState.primaryPay =
      pay;


    MileCountState.addedPay =
      addedPay;


    MileCountState.totalPay =
      pay + addedPay;


    MileCountState.extraMiles =
      extraMiles;


    MileCountState.homeAdded =
      false;


    /*
    Update recommendation UI.
    */

    if (el("added")) {

      el("added").textContent =
        "+" + money(addedPay);

    }


    if (el("current")) {

      el("current").textContent =
        money(pay);

    }


    if (el("newTotal")) {

      el("newTotal").textContent =
        money(
          MileCountState.totalPay
        );

    }


    if (el("tripPay")) {

      el("tripPay").textContent =
        money(
          MileCountState.totalPay
        );

    }


    if (el("tripAdded")) {

      el("tripAdded").textContent =
        "+" + money(addedPay);

    }


    /*
    Optional remaining capacity.
    */

    const remainingSpace =
      Math.max(
        0,
        space - spaceUsed
      );


    const remainingWeight =
      Math.max(
        0,
        weight - weightUsed
      );


    if (el("remainingSpace")) {

      el("remainingSpace")
        .textContent =
        remainingSpace +
        " ft remaining";

    }


    if (el("remainingWeight")) {

      el("remainingWeight")
        .textContent =
        remainingWeight
          .toLocaleString() +
        " lb remaining";

    }


    /*
    Fuel Engine connection.
    */

    let realExtraMiles = extraMiles;
    let extraDriveTime = "Estimated";

    if (
      MileCountState.origin === "Atlanta, GA" &&
      MileCountState.destination === "Charlotte, NC" &&
      typeof calculateMileCountDetour === "function" &&
      addedPay > 0
    ) {
      try {
        const detour = await calculateMileCountDetour(
          MileCountState.origin,
          MileCountState.destination,
          ["Greenville, SC"]
        );

        if (detour && Number.isFinite(detour.extraMiles)) {
          realExtraMiles = detour.extraMiles;
          extraDriveTime = detour.extraDriveTime;
          MileCountState.extraMiles = realExtraMiles;
        }
      } catch (error) {
        console.warn("MileCount detour calculation failed:", error);
      }
    }

    if (el("detourMiles")) {
      el("detourMiles").textContent = realExtraMiles.toFixed(1) + " mi";
    }

    if (el("detourTime")) {
      el("detourTime").textContent = extraDriveTime;
    }

    if (el("spaceUsed")) {
      el("spaceUsed").textContent = spaceUsed + " ft";
    }

    if (el("weightUsed")) {
      el("weightUsed").textContent = weightUsed.toLocaleString() + " lb";
    }

    const extraFuelResult = updateExtraFuel(realExtraMiles);

    if (extraFuelResult) {
      const afterFuelAdded = addedPay - extraFuelResult.fuelCost;

      if (el("addedAfterFuel")) {
        el("addedAfterFuel").textContent = "+" + money(afterFuelAdded);
      }

      if (el("autoStackReason")) {
        el("autoStackReason").textContent =
          addedPay > 0
            ? "Adds " + realExtraMiles.toFixed(1) +
              " road miles and about " + money(extraFuelResult.fuelCost) +
              " in diesel. Estimated +" + money(afterFuelAdded) +
              " after added fuel."
            : "No compatible simulated freight fits the remaining truck capacity.";
      }
    }

    showScreen(2);

  }


  /*
  ------------------------------
  EXTRA FUEL
  ------------------------------
  */

  function updateExtraFuel(
    extraMiles
  ) {

    if (
      typeof
        calculateMileCountTripFuel !==
      "function"
    ) {

      if (el("extraFuel")) {

        el("extraFuel")
          .textContent =
          "Fuel unavailable";

      }

      return null;

    }


    const fuel =
      calculateMileCountTripFuel(
        extraMiles,
        MileCountState.origin
      );


    if (el("extraFuel")) {

      el("extraFuel")
        .textContent =
        money(
          fuel.fuelCost
        );

    }


    if (
      el("extraFuelDetails")
    ) {

      el("extraFuelDetails")
        .textContent =

        fuel.gallons
          .toFixed(1) +

        " gal • $" +

        fuel.dieselPrice
          .toFixed(2) +

        "/gal • " +

        fuel.source;

    }

    return fuel;

  }


  /*
  ------------------------------
  ADD TO TRIP
  ------------------------------
  */

  async function addToTrip() {

    showScreen(3);

    await updateOutboundMap();

  }


  /*
  ------------------------------
  OUTBOUND MAP
  ------------------------------
  */

  async function updateOutboundMap() {

    if (
      typeof showMileCountRoute !==
      "function"
    ) {

      return;

    }


    /*
    Current simulated stack.
    */

    if (
      MileCountState.origin ===
      "Atlanta, GA"
    ) {

      return await showMileCountRoute([
        "Atlanta, GA",
        "Greenville, SC",
        MileCountState.destination
      ]);

    }

    else {

      return await showMileCountRoute([
        MileCountState.origin,
        MileCountState.destination
      ]);

    }

  }


  /*
  ------------------------------
  PROTECT RETURN
  ------------------------------
  */

  function protectReturn() {

    updateBackhaulPreview();

    showScreen(4);

  }


  /*
  ------------------------------
  BACKHAUL PREVIEW
  ------------------------------
  */

  function updateBackhaulPreview() {

    const outbound =
      MileCountState.totalPay;


    const returnPay =
      MileCountState.returnPay;


    const total =
      outbound + returnPay;


    if (el("previewRoundPay")) {

      el("previewRoundPay")
        .textContent =
        money(total);

    }

  }


  /*
  ------------------------------
  GET ME HOME PAID
  ------------------------------
  */

  async function getHomePaid() {

    MileCountState.homeAdded = true;

    const outbound = MileCountState.totalPay;
    const returnPay = MileCountState.returnPay;

    let route = null;

    if (typeof showHomeboundRoute === "function") {
      try {
        route = await showHomeboundRoute(
          MileCountState.origin,
          MileCountState.destination,
          MileCountState.home
        );
      } catch (error) {
        console.warn("MileCount homebound routing failed:", error);
      }
    }

    const liveMiles =
      route && Number.isFinite(route.miles)
        ? route.miles
        : (
            typeof getMileCountCurrentRoadMiles === "function"
              ? getMileCountCurrentRoadMiles()
              : null
          );

    const miles =
      Number.isFinite(liveMiles) && liveMiles > 0
        ? liveMiles
        : MileCountState.roundTripMiles;

    MileCountState.roundTripMiles = miles;

    let result = null;

    if (typeof calculateMileCountRoundTrip === "function") {
      result = calculateMileCountRoundTrip(
        outbound,
        returnPay,
        miles,
        MileCountState.origin
      );
    }

    if (result) {
      if (el("roundPay")) {
        el("roundPay").textContent = money(result.totalRevenue);
      }

      if (el("roundMiles")) {
        el("roundMiles").textContent =
          Math.round(result.miles).toLocaleString();
      }

      if (el("roundRPM")) {
        el("roundRPM").textContent = "$" + result.rpm.toFixed(2);
      }

      if (el("fuelCostDisplay")) {
        el("fuelCostDisplay").textContent = money(result.fuelCost);
      }

      if (el("fuelDetails")) {
        el("fuelDetails").textContent =
          result.gallons.toFixed(1) +
          " gallons • $" +
          result.dieselPrice.toFixed(2) +
          "/gal • " +
          result.fuelSource +
          (result.fuelUpdated ? " • " + result.fuelUpdated : "");
      }

      if (el("afterFuel")) {
        el("afterFuel").textContent = money(result.afterFuel);
      }
    }

    if (el("homeResult")) {
      el("homeResult").classList.remove("hidden");
    }

    const homeButton = el("getHome");

    if (homeButton) {
      homeButton.textContent = "HOMEBOUND LOAD ADDED ✓";
      homeButton.disabled = true;
    }
  }

  /*
  ------------------------------
  UPDATED TRIP
  ------------------------------
  */

  function viewUpdatedTrip() {

    const total =
      MileCountState.totalPay +
      (
        MileCountState.homeAdded
          ? MileCountState.returnPay
          : 0
      );


    if (el("tripPay")) {

      el("tripPay")
        .textContent =
        money(total);

    }


    if (el("tripStops")) {

      el("tripStops")
        .innerHTML =

        '<div class="stop">' +
        '🚚 <b>' +
        MileCountState.origin +
        '</b><br>' +
        'START / PRIMARY CARGO' +
        '</div>' +

        '<div class="stop">' +
        '📦 <b>Greenville, SC</b><br>' +
        'MileCount partial delivery' +
        '</div>' +

        '<div class="stop">' +
        '🏁 <b>' +
        MileCountState.destination +
        '</b><br>' +
        'Original delivery' +
        '</div>' +

        (
          MileCountState.homeAdded
            ?
            '<div class="stop">' +
            '💰 <b>' +
            MileCountState.destination +
            '</b><br>' +
            'Return load pickup • +$740' +
            '</div>' +

            '<div class="stop">' +
            '🏠 <b>' +
            MileCountState.home +
            '</b><br>' +
            'HOME ✓' +
            '</div>'
            :
            ''
        );

    }


    showScreen(3);


    setTimeout(function () {

      if (
        MileCountState.homeAdded &&
        typeof
          showHomeboundRoute ===
        "function"
      ) {

        showHomeboundRoute(
          MileCountState.origin,
          MileCountState.destination,
          MileCountState.home
        );

      }

      else {

        updateOutboundMap();

      }


      if (
        typeof mileCountMap !==
          "undefined" &&
        mileCountMap
      ) {

        mileCountMap
          .invalidateSize();

      }

    }, 250);

  }


  /*
  ------------------------------
  START NEW TRIP
  ------------------------------
  */

  function startNewTrip() {

    MileCountState.homeAdded =
      false;


    if (el("homeResult")) {

      el("homeResult")
        .classList
        .add("hidden");

    }


    const homeButton =
      el("getHome");


    if (homeButton) {

      homeButton.disabled =
        false;

      homeButton.textContent =
        "GET ME HOME PAID";

    }


    showScreen(1);

  }


  /*
  ------------------------------
  BUTTON BINDING
  ------------------------------
  */

  function bindButton(
    id,
    handler
  ) {

    const button =
      el(id);


    if (!button) {

      console.warn(
        "MileCount button missing:",
        id
      );

      return;

    }


    button.addEventListener(
      "click",
      handler
    );

  }


  bindButton(
    "find",
    findMoney
  );


  bindButton(
    "addTrip",
    addToTrip
  );


  bindButton(
    "protect",
    protectReturn
  );


  bindButton(
    "getHome",
    getHomePaid
  );


  bindButton(
    "updatedTrip",
    viewUpdatedTrip
  );


  bindButton(
    "restart",
    startNewTrip
  );


  /*
  ------------------------------
  APP READY
  ------------------------------
  */

  console.log(
    "MileCount App Engine Ready"
  );

})();
