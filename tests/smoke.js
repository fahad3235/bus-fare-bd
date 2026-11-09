// bus-fare-bd -- headless-Chrome smoke test via raw CDP (no puppeteer dependency).
// Usage: node tests/smoke.js
// Exits non-zero on any failed assertion; fails on page console errors.
// ?asof=2026-11-09 pins "today" for saved-calculation dates.
const { spawn } = require('child_process');
const http = require('http');
const path = require('path');

const PORT = 9351;
const FILE = 'file://' + path.resolve(__dirname, '..', 'index.html') + '?asof=2026-11-09';
let failures = 0;
let count = 0;
const pageErrors = [];
function check(name, cond, extra) {
  count++;
  console.log((cond ? 'ok - ' : 'FAIL - ') + name + (cond ? '' : ' :: ' + (extra || '')));
  if (!cond) failures++;
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const CHROME_BIN = process.env.CHROME_BIN ||
    require('os').homedir() + '/.cache/ms-playwright/chromium_headless_shell-1187/chrome-linux/headless_shell';
  const chrome = spawn(CHROME_BIN, [
    '--headless=new', '--no-sandbox', '--disable-gpu',
    '--remote-debugging-port=' + PORT, '--user-data-dir=/tmp/busfare-smoke-' + process.pid,
    'about:blank',
  ], { stdio: 'ignore' });
  let targets = [];
  for (let i = 0; i < 50 && targets.length === 0; i++) {
    await wait(200);
    try {
      targets = JSON.parse(await new Promise((res, rej) => {
        http.get('http://127.0.0.1:' + PORT + '/json/list', (r) => {
          let d = ''; r.on('data', (c) => (d += c)); r.on('end', () => res(d));
        }).on('error', rej);
      }));
    } catch (e) { /* retry */ }
  }
  if (!targets.length) { console.log('FAIL - chrome did not start'); process.exit(2); }
  const wsUrl = targets[0].webSocketDebuggerUrl;
  const ws = new WebSocket(wsUrl);
  await new Promise((res) => { ws.onopen = res; });
  let seq = 0; const pending = new Map();
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
    if (msg.method === 'Runtime.exceptionThrown') {
      pageErrors.push('exception: ' + JSON.stringify(msg.params.exceptionDetails).slice(0, 300));
    }
    if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
      pageErrors.push('console.error: ' + JSON.stringify(msg.params.args).slice(0, 300));
    }
  };
  function send(method, params) {
    return new Promise((res) => {
      const id = ++seq;
      pending.set(id, res);
      ws.send(JSON.stringify({ id, method, params: params || {} }));
    });
  }
  await send('Page.enable'); await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: FILE });
  await wait(1500);
  const ev = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.result && r.result.exceptionDetails) return { error: JSON.stringify(r.result.exceptionDetails).slice(0, 300) };
    return r.result ? r.result.result.value : undefined;
  };
  const T = '\u09f3'; // taka sign

  check('page title contains Bus Fare', (await ev('document.title'))?.includes('Bus Fare'));
  check('5 tabs render', (await ev(`document.querySelectorAll('.tab').length`)) === 5);
  check('calc tab visible by default', (await ev(`document.getElementById('tab-calc').hidden`)) === false);
  check('info card renders', (await ev(`document.querySelector('.info p').textContent.length`)) > 40);
  check('type select has 4 options', (await ev(`document.getElementById('typeSel').options.length`)) === 4);

  // Calculator: default 10 km city-bus -> Tk 27.00 (auto-calculated on load).
  check('default calc total ' + T + '27.00', (await ev(`document.getElementById('resTotal').textContent`)) === T + '27.00');
  check('breakdown shows 10 km x rate = ' + T + '27.00', (await ev(`document.getElementById('resRows').textContent`)).includes(T + '27.00'));
  check('rate line shows 2.70/km', (await ev(`document.getElementById('resRate').textContent`)).includes('2.70'));

  // Validation: zero distance shows inline error.
  await ev(`document.getElementById('distInput').value='0';`);
  await ev(`document.getElementById('calcBtn').click()`);
  check('zero distance shows error', (await ev(`document.getElementById('calcError').hidden`)) === false);

  // Minimum fare: 3.7 km city-bus -> raw 9.99 -> min Tk 10.00 + note visible.
  await ev(`document.getElementById('distInput').value='3.7';`);
  await ev(`document.getElementById('calcBtn').click()`);
  check('3.7km total ' + T + '10.00', (await ev(`document.getElementById('resTotal').textContent`)) === T + '10.00');
  check('min-fare note visible', (await ev(`document.getElementById('minNote').hidden`)) === false);

  // Return trip x2 passengers: 10 km city-bus -> 27 x 2 x 2 = Tk 108.00.
  await ev(`document.getElementById('distInput').value='10';`);
  await ev(`document.getElementById('roundTripChk').click();`);
  await ev(`document.getElementById('paxInput').value='2';`);
  await ev(`document.getElementById('calcBtn').click()`);
  check('return x2 pax total ' + T + '108.00', (await ev(`document.getElementById('resTotal').textContent`)) === T + '108.00');
  check('per-person row ' + T + '54.00', (await ev(`document.getElementById('resRows').textContent`)).includes(T + '54.00'));
  await ev(`document.getElementById('roundTripChk').click();`);
  await ev(`document.getElementById('paxInput').value='1';`);
  await ev(`document.getElementById('calcBtn').click()`);
  check('back to one-way 1 pax ' + T + '27.00', (await ev(`document.getElementById('resTotal').textContent`)) === T + '27.00');

  // Compare tab: 4 rows, cheapest interdistrict Tk 24.00 first with CHEAPEST badge.
  await ev(`document.getElementById('tabbtn-compare').click()`);
  await ev(`document.getElementById('cmpBtn').click()`);
  check('compare has 4 rows', (await ev(`document.querySelectorAll('#cmpBody tr').length`)) === 4);
  check('compare cheapest is inter-district', (await ev(`document.querySelector('#cmpBody tr').textContent`)).includes('Inter-district'));
  check('compare cheapest shows CHEAPEST', (await ev(`document.querySelector('#cmpBody tr').textContent`)).includes('CHEAPEST'));
  check('compare cheapest amount ' + T + '24.00', (await ev(`document.querySelector('#cmpBody tr').textContent`)).includes(T + '24.00'));
  check('compare most expensive is city bus 27.00', (await ev(`document.querySelectorAll('#cmpBody tr')[3].textContent`)).includes(T + '27.00'));

  // Routes tab: 8 rows; Chattogram 242 km, Tk 581.00; Load fills calculator.
  await ev(`document.getElementById('tabbtn-routes').click()`);
  check('routes has 8 rows', (await ev(`document.querySelectorAll('#routeRows tr').length`)) === 8);
  check('routes Chattogram 242 km', (await ev(`document.querySelector('#routeRows tr').textContent`)).includes('242'));
  check('routes Chattogram fare ' + T + '581.00', (await ev(`document.querySelector('#routeRows tr').textContent`)).includes(T + '581.00'));
  await ev(`document.querySelector('#routeRows button').click()`);
  check('route load switches to calc tab', (await ev(`document.getElementById('tab-calc').hidden`)) === false);
  check('route load sets distance 242', (await ev(`document.getElementById('distInput').value`)) === '242');
  check('route load total ' + T + '581.00', (await ev(`document.getElementById('resTotal').textContent`)) === T + '581.00');

  // Rates tab: 4 rows + 2 history rows; edit city-bus rate 2.70 -> 3.00, calc 10km -> Tk 30.00; reset restores 2.70.
  await ev(`document.getElementById('tabbtn-rates').click()`);
  check('rate table has 4 rows', (await ev(`document.querySelectorAll('#rateRows tr').length`)) === 4);
  check('rate history has 2 rows', (await ev(`document.querySelectorAll('#histRows tr').length`)) === 2);
  check('history shows Sep 2026 2.70', (await ev(`document.getElementById('histRows').textContent`)).includes('2.70'));
  await ev(`document.getElementById('rate-city-bus').value='3.00';`);
  await ev(`document.getElementById('saveRatesBtn').click()`);
  check('rates saved message', (await ev(`document.getElementById('ratesMsg').hidden`)) === false);
  await ev(`document.getElementById('tabbtn-calc').click()`);
  await ev(`document.getElementById('distInput').value='10';`);
  await ev(`document.getElementById('typeSel').value='city-bus';`);
  await ev(`document.getElementById('calcBtn').click()`);
  check('edited rate total ' + T + '30.00', (await ev(`document.getElementById('resTotal').textContent`)) === T + '30.00');
  await ev(`document.getElementById('tabbtn-rates').click()`);
  await ev(`document.getElementById('resetRatesBtn').click()`);
  check('rate reset to 2.70', (await ev(`document.getElementById('rate-city-bus').value`)) === '2.70');

  // Save calculation + history totals + reload persistence.
  await ev(`window.__busfare.eraseAll()`);
  await ev(`document.getElementById('tabbtn-calc').click()`);
  await ev(`document.getElementById('calcBtn').click()`);
  await ev(`document.getElementById('calcLabel').value='Office commute'; document.getElementById('saveCalcBtn').click();`);
  check('saved message shows', (await ev(`document.getElementById('savedMsg').hidden`)) === false);
  await ev(`document.getElementById('tabbtn-history').click()`);
  check('history total ' + T + '27.00', (await ev(`document.getElementById('histTotal').textContent`)) === T + '27.00');
  check('history row label Office commute', (await ev(`document.getElementById('histBody').textContent`)).includes('Office commute'));
  check('history chart has 1 bar', (await ev(`document.querySelectorAll('#histChart rect').length`)) === 1);
  await send('Page.navigate', { url: FILE });
  await wait(1200);
  await ev(`document.getElementById('tabbtn-history').click()`);
  check('saved calc persists after reload', (await ev(`document.getElementById('histTotal').textContent`)) === T + '27.00');

  // Export / import round-trip + invalid import via test hooks.
  const payload = await ev(`window.__busfare.exportPayload()`);
  check('export payload is bus-fare-bd v1', payload.includes('"app": "bus-fare-bd"') && payload.includes('"version": 1'), payload);
  check('export payload carries saved calc', payload.includes('Office commute'));
  await ev(`window.__busfare.eraseAll()`);
  check('eraseAll clears history total', (await ev(`window.__busfare.exportPayload()`)).includes('"history": []'));
  check('eraseAll resets city-bus rate', (await ev(`JSON.stringify(window.__busfare.state.rates)`)).includes('"rate":270'));
  const imp = await ev(`JSON.stringify(window.__busfare.importPayload(${JSON.stringify(payload)}))`);
  check('import valid payload ok', imp.includes('"ok":true'), imp);
  check('import restores saved calc', (await ev(`JSON.stringify(window.__busfare.exportPayload())`)).includes('Office commute'));
  const badImp = await ev(`JSON.stringify(window.__busfare.importPayload('{"app":"remittance-bd","version":1}'))`);
  check('import wrong app rejected', badImp.includes('"ok":false'));
  check('invalid import leaves data intact', (await ev(`JSON.stringify(window.__busfare.exportPayload())`)).includes('Office commute'));
  await ev(`window.__busfare.eraseAll()`);

  // Language toggle: Bengali title + digits, persists after reload.
  await ev(`document.getElementById('langBtn').click()`);
  check('BN toggle: title in Bengali', (await ev(`document.getElementById('title').textContent`)) === '\u09ac\u09be\u09b8 \u09ad\u09be\u09a1\u09bc\u09be \u09ac\u09bf\u09a1\u09bf');
  check('BN toggle: tab label in Bengali', (await ev(`document.getElementById('tabbtn-calc').textContent`)) === '\u09b9\u09bf\u09b8\u09be\u09ac');
  await ev(`document.getElementById('tabbtn-calc').click()`);
  await ev(`document.getElementById('calcBtn').click()`);
  check('BN toggle: total in Bengali digits', (await ev(`document.getElementById('resTotal').textContent`)) === T + '\u09e8\u09ed.\u09e6\u09e6');
  await send('Page.navigate', { url: FILE });
  await wait(1200);
  check('BN toggle persists after reload', (await ev(`window.__busfare.state.lang`)) === 'bn');
  await ev(`document.getElementById('langBtn').click()`);
  check('back to EN', (await ev(`window.__busfare.state.lang`)) === 'en');

  // Mobile 390px: no horizontal overflow on calc + rates + history tabs.
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await send('Page.navigate', { url: FILE });
  await wait(1200);
  const overflow = await ev(`document.documentElement.scrollWidth - document.documentElement.clientWidth`);
  check('390px no horizontal overflow (calc)', overflow <= 0, 'overflow=' + overflow);
  await ev(`document.getElementById('tabbtn-rates').click()`);
  const overflow2 = await ev(`document.documentElement.scrollWidth - document.documentElement.clientWidth`);
  check('390px no horizontal overflow (rates)', overflow2 <= 0, 'overflow=' + overflow2);
  await ev(`document.getElementById('tabbtn-history').click()`);
  const overflow3 = await ev(`document.documentElement.scrollWidth - document.documentElement.clientWidth`);
  check('390px no horizontal overflow (history)', overflow3 <= 0, 'overflow=' + overflow3);

  // Zero network requests: app is fully offline (only file:// loads).
  const reqs = await ev(`performance.getEntriesByType('resource').map(r => r.name).filter(n => !n.startsWith('file://')).length`);
  check('zero non-file network requests', reqs === 0, 'non-file=' + reqs);

  check('no console/page errors', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '));

  chrome.kill();
  console.log('\n' + count + ' checks, ' + failures + ' failed');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.log('FAIL - harness error: ' + e.message); try { chrome.kill(); } catch (_) {} process.exit(2); });
