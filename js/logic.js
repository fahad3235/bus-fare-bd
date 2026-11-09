// bus-fare-bd -- pure bus-fare math (no DOM). Node-testable.
// Money is integer paisa everywhere (1 taka = 100 paisa).
// Distance is handled in integer hundredths of a kilometre to avoid float noise.
//
// Rate basis (see README for sources):
//   * Gazette notification of 23 September 2026 (Road Transport and Highways
//     Division), effective 22 September 2026, under section 34(2) of the Road
//     Transport Act, 2018 -- diesel-run buses and minibuses only; gas-run
//     buses are NOT covered by these rates.
//       - Dhaka & Chattogram metro bus: Tk 2.70/km, minimum fare Tk 10
//       - Dhaka & Chattogram metro minibus: Tk 2.60/km, minimum fare Tk 8
//       - DTCA-area (Dhaka, Narayanganj, Munshiganj, Narsingdi, Gazipur,
//         Manikganj) bus/minibus: Tk 2.60/km, minimum fare Tk 8
//         (outside-metro minimum Tk 8, per the April 2026 announcement)
//       - Inter-district & long-distance bus/minibus: Tk 2.40/km,
//         minimum fare Tk 8 (outside-metro minimum)
//   * Previous rates (23 April 2026): 2.53 / 2.43 / 2.43 / 2.23.
//   * Fares are rounded to the nearest whole taka after the per-km
//     multiplication (labelled assumption -- conductors charge whole taka);
//     the minimum fare applies when the computed fare is below it.
//   * Route distances are approximate road distances (shortest route) from
//     the Roads & Highways Department distance matrix, as published by
//     bdtradeinfo.com (2026-11-09) and reportbd.net; they vary by route.
(function (root) {
  'use strict';

  var APP = 'bus-fare-bd';
  var VERSION = 1;

  var MAX_DISTANCE_KM = 2000;
  var MAX_PASSENGERS = 10;

  // Default rates: paisa per km + minimum fare in paisa.
  var DEFAULT_RATES = {
    'city-bus':     { rate: 270, min: 1000 },
    'city-minibus': { rate: 260, min: 800 },
    'dtca':         { rate: 260, min: 800 },
    'interdistrict': { rate: 240, min: 800 }
  };

  var TYPE_IDS = ['city-bus', 'city-minibus', 'dtca', 'interdistrict'];

  // Popular Dhaka routes: approximate road distance (km, shortest route).
  var ROUTES = [
    { id: 'chattogram', km: 242 },
    { id: 'sylhet',     km: 241 },
    { id: 'khulna',     km: 180 },
    { id: 'rajshahi',   km: 256 },
    { id: 'barishal',   km: 169 },
    { id: 'mymensingh', km: 122 },
    { id: 'cumilla',    km: 96 },
    { id: 'coxsbazar',  km: 388 }
  ];

  // Gazette rate history (taka per km).
  var RATE_HISTORY = [
    { date: '2026-04-23', 'city-bus': 2.53, 'city-minibus': 2.43, 'dtca': 2.43, 'interdistrict': 2.23 },
    { date: '2026-09-22', 'city-bus': 2.70, 'city-minibus': 2.60, 'dtca': 2.60, 'interdistrict': 2.40 }
  ];

  function isFiniteNumber(x) { return typeof x === 'number' && isFinite(x); }

  function getRate(rates, typeId) {
    var r = (rates && rates[typeId]) || DEFAULT_RATES[typeId];
    return r || null;
  }

  function validRateEntry(e) {
    return e && isFiniteNumber(e.rate) && e.rate > 0 && e.rate <= 1000 &&
      isFiniteNumber(e.min) && e.min >= 0 && e.min <= 100000;
  }

  function validDistance(d) {
    return isFiniteNumber(d) && d > 0 && d <= MAX_DISTANCE_KM;
  }

  function validPassengers(p) {
    return typeof p === 'number' && isFinite(p) && Math.floor(p) === p && p >= 1 && p <= MAX_PASSENGERS;
  }

  // One-way fare for a distance, in integer paisa.
  // rawPaisa = distance x rate; fare = max(min, round(raw to whole taka)).
  function calcFare(opts) {
    opts = opts || {};
    var distanceKm = opts.distanceKm;
    var typeId = opts.typeId || 'city-bus';
    var roundTrip = opts.roundTrip === true;
    var passengers = opts.passengers == null ? 1 : opts.passengers;
    var rates = opts.rates || DEFAULT_RATES;

    if (!validDistance(distanceKm)) return { ok: false, error: 'distance' };
    if (TYPE_IDS.indexOf(typeId) === -1) return { ok: false, error: 'type' };
    var r = getRate(rates, typeId);
    if (!validRateEntry(r)) return { ok: false, error: 'rate' };
    if (!validPassengers(passengers)) return { ok: false, error: 'passengers' };

    var km100 = Math.round(distanceKm * 100); // integer hundredths of a km
    var rawPaisa = Math.round(km100 * r.rate / 100);
    var farePaisa = Math.max(r.min, Math.round(rawPaisa / 100) * 100);
    var trips = roundTrip ? 2 : 1;
    var totalPaisa = farePaisa * trips * passengers;

    return {
      ok: true,
      distanceKm: km100 / 100,
      typeId: typeId,
      rate: r.rate,
      min: r.min,
      rawPaisa: rawPaisa,
      farePaisa: farePaisa,
      minApplied: farePaisa === r.min && rawPaisa < r.min,
      roundTrip: roundTrip,
      passengers: passengers,
      totalPaisa: totalPaisa,
      perPersonPaisa: farePaisa * trips
    };
  }

  // Fare for every service type at one distance, cheapest first.
  function compareAll(opts) {
    opts = opts || {};
    var rows = [];
    for (var i = 0; i < TYPE_IDS.length; i++) {
      var r = calcFare({ distanceKm: opts.distanceKm, typeId: TYPE_IDS[i], rates: opts.rates });
      if (!r.ok) return { ok: false, error: r.error };
      rows.push(r);
    }
    rows.sort(function (a, b) { return a.farePaisa - b.farePaisa; });
    return { ok: true, rows: rows };
  }

  function routeById(id) {
    for (var i = 0; i < ROUTES.length; i++) if (ROUTES[i].id === id) return ROUTES[i];
    return null;
  }

  // --- formatting ---
  var BN_DIGITS = ['\u09e6', '\u09e7', '\u09e8', '\u09e9', '\u09ea', '\u09eb', '\u09ec', '\u09ed', '\u09ee', '\u09ef'];
  function toBnDigits(s) {
    return String(s).replace(/[0-9]/g, function (d) { return BN_DIGITS[+d]; });
  }

  // "12,586.00" from integer paisa (EN digits, comma-grouped, 2 decimals).
  function formatBDT(paisa) {
    var neg = paisa < 0;
    var abs = Math.abs(Math.round(paisa));
    var whole = Math.floor(abs / 100);
    var frac = abs % 100;
    var ws = String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return (neg ? '-' : '') + ws + '.' + (frac < 10 ? '0' : '') + frac;
  }

  // "242" / "3.70" from a km number (trims trailing zeros).
  function formatKm(km) {
    var n = Math.round(km * 100) / 100;
    return String(n);
  }

  // --- history / import validation ---
  function validateHistoryItem(it) {
    if (!it || typeof it !== 'object') return false;
    if (typeof it.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(it.date)) return false;
    if (!validDistance(it.distanceKm)) return false;
    if (TYPE_IDS.indexOf(it.typeId) === -1) return false;
    if (typeof it.farePaisa !== 'number' || it.farePaisa < 0 || it.farePaisa > 100000000) return false;
    if (typeof it.totalPaisa !== 'number' || it.totalPaisa < 0 || it.totalPaisa > 1000000000) return false;
    if (!validPassengers(it.passengers)) return false;
    if (typeof it.roundTrip !== 'boolean') return false;
    if (typeof it.label !== 'string' || it.label.length > 80) return false;
    return true;
  }

  function validateImport(payload) {
    if (!payload || typeof payload !== 'object') return { ok: false, error: 'not-object' };
    if (payload.app !== APP || payload.version !== VERSION) return { ok: false, error: 'app-version' };
    if (payload.rates) {
      for (var k in payload.rates) {
        if (TYPE_IDS.indexOf(k) === -1 || !validRateEntry(payload.rates[k])) return { ok: false, error: 'rates' };
      }
    }
    if (payload.history) {
      if (!Array.isArray(payload.history)) return { ok: false, error: 'history' };
      for (var j = 0; j < payload.history.length; j++) {
        if (!validateHistoryItem(payload.history[j])) return { ok: false, error: 'history-item' };
      }
    }
    return { ok: true };
  }

  var api = {
    APP: APP, VERSION: VERSION,
    MAX_DISTANCE_KM: MAX_DISTANCE_KM, MAX_PASSENGERS: MAX_PASSENGERS,
    DEFAULT_RATES: DEFAULT_RATES, TYPE_IDS: TYPE_IDS,
    ROUTES: ROUTES, RATE_HISTORY: RATE_HISTORY,
    calcFare: calcFare,
    compareAll: compareAll,
    routeById: routeById,
    formatBDT: formatBDT,
    formatKm: formatKm,
    toBnDigits: toBnDigits,
    validDistance: validDistance,
    validPassengers: validPassengers,
    validateImport: validateImport,
    validateHistoryItem: validateHistoryItem
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.BusFareLogic = api;
})(typeof window !== 'undefined' ? window : globalThis);
