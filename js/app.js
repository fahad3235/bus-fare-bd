// bus-fare-bd -- DOM wiring (no network, localStorage only).
(function () {
  'use strict';
  var L = window.BusFareLogic;
  var D = window.BusFareData;
  var KEY = 'bus-fare-bd-v1';
  var TAKA = '\u09f3';

  function $(id) { return document.getElementById(id); }
  function todayStr() {
    var q = new URLSearchParams(window.location.search).get('asof');
    if (q && /^\d{4}-\d{2}-\d{2}$/.test(q)) return q;
    var d = new Date();
    var m = d.getMonth() + 1, day = d.getDate();
    return d.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (day < 10 ? '0' : '') + day;
  }
  function cloneRates(r) {
    var out = {};
    for (var k in r) out[k] = { rate: r[k].rate, min: r[k].min };
    return out;
  }
  function loadState() {
    var st = { lang: 'en', rates: cloneRates(L.DEFAULT_RATES), history: [] };
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) {
        var p = JSON.parse(raw);
        if (p && typeof p === 'object') {
          if (p.lang === 'bn' || p.lang === 'en') st.lang = p.lang;
          if (p.rates) {
            for (var k in p.rates) {
              if (L.TYPE_IDS.indexOf(k) !== -1 && p.rates[k] &&
                  typeof p.rates[k].rate === 'number' && typeof p.rates[k].min === 'number') {
                st.rates[k] = { rate: p.rates[k].rate, min: p.rates[k].min };
              }
            }
          }
          if (Array.isArray(p.history)) st.history = p.history.filter(L.validateHistoryItem);
        }
      }
    } catch (e) { /* corrupted storage -> defaults */ }
    return st;
  }
  var state = loadState();
  function saveState() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
  }
  function t(key) {
    var entry = D.I18N[key];
    return entry ? (entry[state.lang] || entry.en) : key;
  }
  function money(paisa) {
    var s = L.formatBDT(paisa);
    return TAKA + (state.lang === 'bn' ? L.toBnDigits(s) : s);
  }
  function rateTk(ratePaisa) {
    var s = (ratePaisa / 100).toFixed(2);
    return TAKA + (state.lang === 'bn' ? L.toBnDigits(s) : s);
  }
  function kmText(km) {
    var s = L.formatKm(km);
    return (state.lang === 'bn' ? L.toBnDigits(s) : s) + ' ' + t('kmUnit');
  }
  function numText(n) {
    var s = String(n);
    return state.lang === 'bn' ? L.toBnDigits(s) : s;
  }

  var lastCalc = null;

  function applyLang() {
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      el.textContent = t(el.getAttribute('data-i18n'));
    });
    document.querySelectorAll('[data-i18n-ph]').forEach(function (el) {
      el.setAttribute('placeholder', t(el.getAttribute('data-i18n-ph')));
    });
    $('langBtn').textContent = state.lang === 'bn' ? 'English' : 'Bangla';
    document.documentElement.lang = state.lang === 'bn' ? 'bn' : 'en';
    renderTypeOptions();
    renderRoutes();
    renderRates();
    renderHistory();
    if (lastCalc) renderResult(lastCalc);
  }

  function renderTypeOptions() {
    var sel = $('typeSel');
    var cur = sel.value || 'city-bus';
    sel.innerHTML = '';
    L.TYPE_IDS.forEach(function (id) {
      var o = document.createElement('option');
      o.value = id;
      o.textContent = D.TYPE_NAMES[id][state.lang];
      sel.appendChild(o);
    });
    sel.value = L.TYPE_IDS.indexOf(cur) !== -1 ? cur : 'city-bus';
  }

  function switchTab(name) {
    ['calc', 'compare', 'routes', 'rates', 'history'].forEach(function (n) {
      $('tab-' + n).hidden = n !== name;
      $('tabbtn-' + n).classList.toggle('active', n === name);
    });
  }

  function renderResult(r) {
    lastCalc = r;
    $('resultBox').hidden = false;
    $('resTotal').textContent = money(r.totalPaisa);
    var rows = '';
    rows += '<tr><td>' + t('rowDistanceRate') + '</td><td>' + kmText(r.distanceKm) + ' \u00d7 ' + rateTk(r.rate) + ' = ' + money(r.rawPaisa) + '</td></tr>';
    rows += '<tr><td>' + t('rowOneWay') + '</td><td>' + money(r.farePaisa) + '</td></tr>';
    if (r.roundTrip) rows += '<tr><td>' + t('rowReturn') + '</td><td>' + money(r.farePaisa * 2) + '</td></tr>';
    if (r.passengers > 1) rows += '<tr><td>' + t('rowPassengers') + ' \u00d7 ' + numText(r.passengers) + '</td><td>' + money(r.totalPaisa) + '</td></tr>';
    rows += '<tr><td>' + t('rowPerPerson') + '</td><td>' + money(r.perPersonPaisa) + '</td></tr>';
    $('resRows').innerHTML = rows;
    $('resRate').textContent = t('serviceType') + ': ' + D.TYPE_NAMES[r.typeId][state.lang] +
      ' \u00b7 ' + rateTk(r.rate) + '/' + t('kmUnit') + ' \u00b7 ' + t('colMin') + ' ' + money(r.min);
    $('minNote').hidden = !r.minApplied;
    $('savedMsg').hidden = true;
  }

  function doCalc() {
    var dist = parseFloat($('distInput').value);
    var pax = parseInt($('paxInput').value, 10);
    var r = L.calcFare({
      distanceKm: dist,
      typeId: $('typeSel').value,
      roundTrip: $('roundTripChk').checked,
      passengers: pax,
      rates: state.rates
    });
    if (!r.ok) {
      $('resultBox').hidden = true;
      lastCalc = null;
      var err = $('calcError');
      err.hidden = false;
      err.textContent = r.error === 'passengers' ? t('errPassengers') : t('errDistance');
      return;
    }
    $('calcError').hidden = true;
    renderResult(r);
  }

  function doCompare() {
    var dist = parseFloat($('cmpDist').value);
    var res = L.compareAll({ distanceKm: dist, rates: state.rates });
    if (!res.ok) {
      $('cmpError').hidden = false;
      $('cmpError').textContent = t('errDistance');
      $('cmpBody').innerHTML = '';
      return;
    }
    $('cmpError').hidden = true;
    var html = '';
    res.rows.forEach(function (r, i) {
      html += '<tr' + (i === 0 ? ' class="best"' : '') + '><td>' + D.TYPE_NAMES[r.typeId][state.lang] +
        (i === 0 ? ' <span class="badge">' + t('best') + '</span>' : '') + '</td><td>' + rateTk(r.rate) + '</td><td>' +
        money(r.min) + '</td><td>' + money(r.farePaisa) + '</td></tr>';
    });
    $('cmpBody').innerHTML = html;
  }

  function renderRoutes() {
    var html = '';
    L.ROUTES.forEach(function (rt) {
      var fare = L.calcFare({ distanceKm: rt.km, typeId: 'interdistrict', rates: state.rates });
      html += '<tr><td>Dhaka \u2192 ' + D.ROUTE_NAMES[rt.id][state.lang] + '</td><td>' + kmText(rt.km) +
        '</td><td>' + money(fare.farePaisa) + '</td><td><button type="button" class="mini" data-route="' + rt.id + '">' +
        (state.lang === 'bn' ? '\u09b2\u09cb\u09a1' : 'Load') + '</button></td></tr>';
    });
    $('routeRows').innerHTML = html;
    $('routeRows').querySelectorAll('button[data-route]').forEach(function (b) {
      b.addEventListener('click', function () {
        var rt = L.routeById(b.getAttribute('data-route'));
        if (!rt) return;
        $('distInput').value = String(rt.km);
        $('typeSel').value = 'interdistrict';
        $('roundTripChk').checked = false;
        $('paxInput').value = '1';
        switchTab('calc');
        doCalc();
      });
    });
  }

  function renderRates() {
    var html = '';
    L.TYPE_IDS.forEach(function (id) {
      var r = state.rates[id];
      html += '<tr><td>' + D.TYPE_NAMES[id][state.lang] + '</td>' +
        '<td><input type="number" id="rate-' + id + '" min="0.01" max="10" step="0.01" value="' + (r.rate / 100).toFixed(2) + '" inputmode="decimal"></td>' +
        '<td><input type="number" id="min-' + id + '" min="0" max="1000" step="1" value="' + (r.min / 100) + '" inputmode="decimal"></td></tr>';
    });
    $('rateRows').innerHTML = html;
    var hh = '';
    L.RATE_HISTORY.forEach(function (h) {
      hh += '<tr><td>' + h.date + '</td><td>' + rateTk(Math.round(h['city-bus'] * 100)) + '</td><td>' +
        rateTk(Math.round(h['city-minibus'] * 100)) + '</td><td>' + rateTk(Math.round(h.dtca * 100)) + '</td><td>' +
        rateTk(Math.round(h.interdistrict * 100)) + '</td></tr>';
    });
    $('histRows').innerHTML = hh;
  }

  function renderHistory() {
    var body = $('histBody');
    if (!state.history.length) {
      $('histEmpty').hidden = false;
      $('histTable').hidden = true;
      $('histTotal').textContent = money(0);
      $('histChart').innerHTML = '';
      return;
    }
    $('histEmpty').hidden = true;
    $('histTable').hidden = false;
    var total = 0, html = '';
    state.history.forEach(function (it, i) {
      total += it.totalPaisa;
      html += '<tr><td>' + it.date + '</td><td>' + (it.label ? escapeHtml(it.label) : D.TYPE_NAMES[it.typeId][state.lang]) +
        '</td><td>' + kmText(it.distanceKm) + '</td><td>' + money(it.totalPaisa) +
        '</td><td><button type="button" class="mini" data-del="' + i + '">\u00d7</button></td></tr>';
    });
    body.innerHTML = html;
    $('histTotal').textContent = money(total);
    body.querySelectorAll('button[data-del]').forEach(function (b) {
      b.addEventListener('click', function () {
        state.history.splice(+b.getAttribute('data-del'), 1);
        saveState();
        renderHistory();
      });
    });
    // Simple SVG bar chart of saved totals (max 10 bars).
    var items = state.history.slice(-10);
    var max = 0;
    items.forEach(function (it) { if (it.totalPaisa > max) max = it.totalPaisa; });
    var svg = '<svg width="100%" height="80" viewBox="0 0 300 80" role="img" aria-label="history chart">';
    items.forEach(function (it, i) {
      var h = max ? Math.max(4, Math.round(it.totalPaisa / max * 70)) : 0;
      var x = 6 + i * 29;
      svg += '<rect x="' + x + '" y="' + (76 - h) + '" width="20" height="' + h + '" fill="#1e40af"><title>' + money(it.totalPaisa) + '</title></rect>';
    });
    svg += '</svg>';
    $('histChart').innerHTML = svg;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function exportPayload() {
    return JSON.stringify({ app: L.APP, version: L.VERSION, rates: state.rates, history: state.history }, null, 2);
  }

  function importPayload(text) {
    var payload;
    try { payload = JSON.parse(text); } catch (e) { return { ok: false, error: 'parse' }; }
    var v = L.validateImport(payload);
    if (!v.ok) return v;
    if (payload.rates) {
      for (var k in payload.rates) state.rates[k] = { rate: payload.rates[k].rate, min: payload.rates[k].min };
    }
    if (payload.history) state.history = payload.history.slice();
    saveState();
    renderRates();
    renderHistory();
    return { ok: true };
  }

  function eraseAll() {
    state.rates = cloneRates(L.DEFAULT_RATES);
    state.history = [];
    saveState();
    renderRates();
    renderHistory();
  }

  // Wire up.
  ['calc', 'compare', 'routes', 'rates', 'history'].forEach(function (n) {
    $('tabbtn-' + n).addEventListener('click', function () { switchTab(n); });
  });
  $('langBtn').addEventListener('click', function () {
    state.lang = state.lang === 'bn' ? 'en' : 'bn';
    saveState();
    applyLang();
  });
  $('calcBtn').addEventListener('click', doCalc);
  $('saveCalcBtn').addEventListener('click', function () {
    if (!lastCalc) return;
    state.history.push({
      date: todayStr(),
      distanceKm: lastCalc.distanceKm,
      typeId: lastCalc.typeId,
      farePaisa: lastCalc.farePaisa,
      totalPaisa: lastCalc.totalPaisa,
      passengers: lastCalc.passengers,
      roundTrip: lastCalc.roundTrip,
      label: ($('calcLabel').value || '').trim().slice(0, 80)
    });
    saveState();
    renderHistory();
    $('savedMsg').hidden = false;
  });
  $('cmpBtn').addEventListener('click', doCompare);
  $('saveRatesBtn').addEventListener('click', function () {
    var next = {};
    var bad = false;
    L.TYPE_IDS.forEach(function (id) {
      var rate = parseFloat($('rate-' + id).value);
      var min = parseFloat($('min-' + id).value);
      if (!(rate > 0 && rate <= 10) || !(min >= 0 && min <= 1000)) bad = true;
      next[id] = { rate: Math.round(rate * 100), min: Math.round(min * 100) };
    });
    if (bad) { $('ratesMsg').hidden = true; return; }
    state.rates = next;
    saveState();
    $('ratesMsg').hidden = false;
  });
  $('resetRatesBtn').addEventListener('click', function () {
    state.rates = cloneRates(L.DEFAULT_RATES);
    saveState();
    renderRates();
    $('ratesMsg').hidden = true;
  });
  $('exportBtn').addEventListener('click', function () {
    var blob = new Blob([exportPayload()], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'bus-fare-bd-export.json';
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  });
  $('importBtn').addEventListener('click', function () { $('importFile').click(); });
  $('importFile').addEventListener('change', function () {
    var f = $('importFile').files[0];
    if (!f) return;
    var reader = new FileReader();
    reader.onload = function () {
      var r = importPayload(String(reader.result));
      var m = $('importMsg');
      m.hidden = false;
      m.textContent = r.ok ? t('importOk') : t('importErr');
      m.className = r.ok ? 'ok' : 'error';
    };
    reader.readAsText(f);
    $('importFile').value = '';
  });
  $('eraseBtn').addEventListener('click', function () {
    if ($('eraseInput').value.trim() === 'DELETE') {
      eraseAll();
      $('eraseInput').value = '';
      $('eraseMsg').hidden = false;
      $('eraseMsg').textContent = t('savedMsg');
    }
  });

  applyLang();
  doCalc();

  window.__busfare = {
    state: state,
    exportPayload: exportPayload,
    importPayload: importPayload,
    eraseAll: eraseAll
  };
})();
