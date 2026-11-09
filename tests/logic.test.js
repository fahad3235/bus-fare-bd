// bus-fare-bd -- node unit tests. Usage: node tests/logic.test.js
const L = require('../js/logic.js');
let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('ok - ' + name); }
  else { fail++; console.log('FAIL - ' + name + (extra !== undefined ? ' :: ' + JSON.stringify(extra) : '')); }
}
function eq(a, b) { return a === b; }

// --- core fare math (hand-verified) ---
let r = L.calcFare({ distanceKm: 10, typeId: 'city-bus' });
check('10km city-bus ok', r.ok === true);
check('10km city-bus raw 2700', r.rawPaisa === 2700, r);
check('10km city-bus fare 2700', r.farePaisa === 2700, r);
check('10km city-bus total 2700', r.totalPaisa === 2700, r);
check('10km city-bus min not applied', r.minApplied === false, r);

r = L.calcFare({ distanceKm: 3.7, typeId: 'city-bus' });
check('3.7km city-bus raw 999', r.rawPaisa === 999, r);
check('3.7km city-bus min fare 1000', r.farePaisa === 1000, r);
check('3.7km city-bus minApplied', r.minApplied === true, r);

r = L.calcFare({ distanceKm: 4, typeId: 'city-bus' });
check('4km city-bus 10.80 rounds to 1100', r.farePaisa === 1100, r);

r = L.calcFare({ distanceKm: 1, typeId: 'city-minibus' });
check('1km minibus raw 260', r.rawPaisa === 260, r);
check('1km minibus min fare 800', r.farePaisa === 800, r);

r = L.calcFare({ distanceKm: 242, typeId: 'interdistrict' });
check('242km interdistrict 580.80 -> 58100', r.farePaisa === 58100, r);
r = L.calcFare({ distanceKm: 96, typeId: 'interdistrict' });
check('96km interdistrict 230.40 -> 23000', r.farePaisa === 23000, r);
r = L.calcFare({ distanceKm: 180, typeId: 'interdistrict' });
check('180km interdistrict exact 43200', r.farePaisa === 43200, r);
r = L.calcFare({ distanceKm: 388, typeId: 'interdistrict' });
check('388km interdistrict 931.20 -> 93100', r.farePaisa === 93100, r);
r = L.calcFare({ distanceKm: 241, typeId: 'interdistrict' });
check('241km interdistrict 578.40 -> 57800', r.farePaisa === 57800, r);
r = L.calcFare({ distanceKm: 122, typeId: 'interdistrict' });
check('122km interdistrict 292.80 -> 29300', r.farePaisa === 29300, r);
r = L.calcFare({ distanceKm: 256, typeId: 'interdistrict' });
check('256km interdistrict 614.40 -> 61400', r.farePaisa === 61400, r);
r = L.calcFare({ distanceKm: 169, typeId: 'interdistrict' });
check('169km interdistrict 405.60 -> 40600', r.farePaisa === 40600, r);

// DTCA rate equals minibus rate
r = L.calcFare({ distanceKm: 10, typeId: 'dtca' });
check('10km dtca fare 2600', r.farePaisa === 2600, r);

// Round trip + passengers
r = L.calcFare({ distanceKm: 10, typeId: 'city-bus', roundTrip: true, passengers: 2 });
check('10km city-bus return x2 pax total 10800', r.totalPaisa === 10800, r);
check('10km city-bus return x2 pax per-person 5400', r.perPersonPaisa === 5400, r);
r = L.calcFare({ distanceKm: 242, typeId: 'interdistrict', roundTrip: true, passengers: 3 });
check('242km interdistrict return x3 pax total 348600', r.totalPaisa === 348600, r);

// Compare: cheapest first
let c = L.compareAll({ distanceKm: 10 });
check('compare 10km ok', c.ok === true);
check('compare 10km has 4 rows', c.rows.length === 4, c);
check('compare 10km cheapest interdistrict 2400', c.rows[0].typeId === 'interdistrict' && c.rows[0].farePaisa === 2400, c.rows[0]);
check('compare 10km most expensive city-bus 2700', c.rows[3].typeId === 'city-bus' && c.rows[3].farePaisa === 2700, c.rows[3]);
c = L.compareAll({ distanceKm: 2 });
check('compare 2km all at minimum', c.rows.every(function (x) { return x.farePaisa === x.min; }), c.rows);

// Custom rates respected
r = L.calcFare({ distanceKm: 10, typeId: 'city-bus', rates: { 'city-bus': { rate: 300, min: 1000 } } });
check('custom rate 3.00/km -> 10km fare 3000', r.farePaisa === 3000, r);

// Validation
check('distance 0 rejected', L.calcFare({ distanceKm: 0, typeId: 'city-bus' }).ok === false);
check('distance negative rejected', L.calcFare({ distanceKm: -5, typeId: 'city-bus' }).ok === false);
check('distance NaN rejected', L.calcFare({ distanceKm: NaN, typeId: 'city-bus' }).ok === false);
check('distance 2001 rejected', L.calcFare({ distanceKm: 2001, typeId: 'city-bus' }).ok === false);
check('distance 2000 accepted', L.calcFare({ distanceKm: 2000, typeId: 'interdistrict' }).ok === true);
check('distance 0.1 accepted', L.calcFare({ distanceKm: 0.1, typeId: 'city-bus' }).ok === true);
check('unknown type rejected', L.calcFare({ distanceKm: 10, typeId: 'jet' }).ok === false);
check('passengers 0 rejected', L.calcFare({ distanceKm: 10, typeId: 'city-bus', passengers: 0 }).ok === false);
check('passengers 11 rejected', L.calcFare({ distanceKm: 10, typeId: 'city-bus', passengers: 11 }).ok === false);
check('passengers 1.5 rejected', L.calcFare({ distanceKm: 10, typeId: 'city-bus', passengers: 1.5 }).ok === false);
check('passengers 10 accepted', L.calcFare({ distanceKm: 10, typeId: 'city-bus', passengers: 10 }).ok === true);
check('bad rate rejected', L.calcFare({ distanceKm: 10, typeId: 'city-bus', rates: { 'city-bus': { rate: 0, min: 1000 } } }).ok === false);

// Routes
check('8 routes', L.ROUTES.length === 8);
check('route chattogram 242', L.routeById('chattogram').km === 242);
check('route sylhet 241', L.routeById('sylhet').km === 241);
check('route khulna 180', L.routeById('khulna').km === 180);
check('route rajshahi 256', L.routeById('rajshahi').km === 256);
check('route barishal 169', L.routeById('barishal').km === 169);
check('route mymensingh 122', L.routeById('mymensingh').km === 122);
check('route cumilla 96', L.routeById('cumilla').km === 96);
check('route coxsbazar 388', L.routeById('coxsbazar').km === 388);
check('route unknown null', L.routeById('nope') === null);

// Rate history
check('history has 2 entries', L.RATE_HISTORY.length === 2);
check('history Apr 2026 city-bus 2.53', L.RATE_HISTORY[0]['city-bus'] === 2.53);
check('history Sep 2026 city-bus 2.70', L.RATE_HISTORY[1]['city-bus'] === 2.70);
check('history Sep 2026 interdistrict 2.40', L.RATE_HISTORY[1].interdistrict === 2.40);

// Formatting
check('formatBDT 58100 = 581.00', L.formatBDT(58100) === '581.00');
check('formatBDT 1000 = 10.00', L.formatBDT(1000) === '10.00');
check('formatBDT 2700 = 27.00', L.formatBDT(2700) === '27.00');
check('formatBDT 348600 = 3,486.00', L.formatBDT(348600) === '3,486.00');
check('formatKm 3.7', L.formatKm(3.7) === '3.7');
check('formatKm 242', L.formatKm(242) === '242');
check('toBnDigits 27', L.toBnDigits('27') === '\u09e8\u09ed');
check('toBnDigits 581.00', L.toBnDigits('581.00') === '\u09eb\u09ee\u09e7.\u09e6\u09e6');

// Import validation
var good = { app: 'bus-fare-bd', version: 1, rates: { 'city-bus': { rate: 270, min: 1000 } },
  history: [{ date: '2026-11-09', distanceKm: 10, typeId: 'city-bus', farePaisa: 2700, totalPaisa: 2700, passengers: 1, roundTrip: false, label: 'Office' }] };
check('import good ok', L.validateImport(good).ok === true);
check('import wrong app rejected', L.validateImport({ app: 'remittance-bd', version: 1 }).ok === false);
check('import version 2 rejected', L.validateImport({ app: 'bus-fare-bd', version: 2 }).ok === false);
check('import bad rate rejected', L.validateImport({ app: 'bus-fare-bd', version: 1, rates: { 'city-bus': { rate: 0, min: 1000 } } }).ok === false);
check('import unknown type rejected', L.validateImport({ app: 'bus-fare-bd', version: 1, rates: { jet: { rate: 100, min: 100 } } }).ok === false);
check('import bad history item rejected', L.validateImport({ app: 'bus-fare-bd', version: 1, history: [{ date: '2026-11-09', distanceKm: -1, typeId: 'city-bus', farePaisa: 1, totalPaisa: 1, passengers: 1, roundTrip: false, label: '' }] }).ok === false);
check('import null rejected', L.validateImport(null).ok === false);
check('import empty payload ok', L.validateImport({ app: 'bus-fare-bd', version: 1 }).ok === true);

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
