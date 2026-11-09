# TEST RESULTS — bus-fare-bd (run #280, 2026-11-09 11:00 slot)

## Node unit tests — 71/71 passed (0 failed)
Command: `node tests/logic.test.js`

Hand-verified exact values (all integer paisa):
- 10 km city-bus: raw 2700, fare **2700 (Tk 27.00)**, min not applied
- 3.7 km city-bus: raw 999 (Tk 9.99) → minimum fare **1000 (Tk 10.00)**, minApplied true
- 4 km city-bus: 1080 → rounds to **1100 (Tk 11.00)**
- 1 km city-minibus: raw 260 → minimum fare **800 (Tk 8.00)**
- 242 km inter-district (Dhaka → Chattogram): 58080 → **58100 (Tk 581.00)**
- 96 km inter-district (Cumilla): 23040 → **23000 (Tk 230.00)**
- 180 km inter-district (Khulna): exact **43200 (Tk 432.00)**
- 388 km inter-district (Cox's Bazar): 93120 → **93100 (Tk 931.00)**
- 241 km (Sylhet): 57840 → **57800**; 122 km (Mymensingh): 29280 → **29300**; 256 km (Rajshahi): 61440 → **61400**; 169 km (Barishal): 40560 → **40600**
- 10 km DTCA: **2600 (Tk 26.00)**
- 10 km city-bus, return, 2 passengers: total **10800 (Tk 108.00)**, per person 5400
- 242 km inter-district, return, 3 passengers: total **348600 (Tk 3,486.00)**
- Compare 10 km: inter-district 2400 < minibus 2600 = DTCA 2600 < city-bus 2700; 2 km: all at minimum
- Custom rate 3.00/km → 10 km fare 3000
- Validation: distance 0 / negative / NaN / 2001 rejected; 0.1 and 2000 accepted; unknown type, passengers 0 / 11 / 1.5 rejected; 10 accepted; zero rate rejected
- Routes: 8 routes with the RHD-matrix distances above; unknown route → null
- Rate history: Apr 2026 city-bus 2.53, Sep 2026 city-bus 2.70 / inter-district 2.40
- Formatting: formatBDT(348600) = '3,486.00'; toBnDigits('581.00') = '৫৮১.০০'
- Import: good payload accepted; wrong app / version 2 / bad rate / unknown type / bad history item / null rejected; empty payload accepted

## Headless-Chrome smoke tests — 54/54 passed (0 failed)
Command: `node tests/smoke.js` (raw CDP, headless_shell-1187, file:// + ?asof=2026-11-09)

- Page renders: title, 5 tabs, info card, 4 service-type options
- Calc: default 10 km city-bus → Tk 27.00 on load; breakdown shows Tk 27.00; rate line shows 2.70/km
- Validation: zero distance shows inline error
- Minimum fare: 3.7 km → Tk 10.00 + min-fare note visible
- Return × 2 passengers: 10 km city-bus → Tk 108.00, per-person Tk 54.00; back to one-way 1 pax → Tk 27.00
- Compare: 4 rows, cheapest inter-district Tk 24.00 first with CHEAPEST badge, most expensive city-bus Tk 27.00 last
- Routes: 8 rows; Chattogram 242 km, Tk 581.00; Load switches to calc tab, sets distance 242, total Tk 581.00
- Rates: 4 rows + 2 history rows (Sep 2026 2.70 shown); edit city-bus 2.70 → 3.00 → calc 10 km Tk 30.00; reset restores 2.70
- Save + history: label 'Office commute' saved, total Tk 27.00, 1 chart bar, persists after reload
- Export/import: payload is bus-fare-bd v1, carries saved calc; eraseAll clears history and resets rates; valid import restores; wrong-app import rejected with data intact
- i18n: Bengali title + tab label + Bengali-digit total (Tk ২৭.০০), persists after reload, back to EN
- Mobile: 390px no horizontal overflow on calc / rates / history tabs
- Zero non-file network requests; 0 console/page errors

Repairs: 2 test-side fixes only (export-payload assertions expected compact JSON; export uses pretty-printed JSON). 0 app-logic bugs.

## ASCII hygiene
All shipped sources are pure ASCII (Bengali stored as \uXXXX escapes in JS; static HTML uses entities overwritten by JS i18n at runtime). Verified with `grep -P '[^\x00-\x7F]'` — 0 matches across index.html, css/, js/, tests/.

## Facts verified before build (web search, 2026-11-09)
- BRTA gazette rates effective 22 Sep 2026 (notification 23 Sep 2026): metro bus Tk 2.70/km (min Tk 10), metro minibus Tk 2.60/km (min Tk 8), DTCA-area bus/minibus Tk 2.60/km, inter-district & long-distance Tk 2.40/km; previous rates 2.53 / 2.23 / 2.43. Cross-checked across TBS, BSS, bdnews24, Dhaka Tribune (Sep 2026) and The Daily Star (Apr 2026). Diesel-run only; gas-run buses excluded.
- Route distances (shortest route, RHD distance matrix via bdtradeinfo.com 2026-11-09, cross-checked with reportbd.net district table): Chattogram 242, Sylhet 241, Khulna 180, Rajshahi 256, Barishal 169, Mymensingh 122, Cumilla 96, Cox's Bazar 388 km. Labelled approximate in UI, README and footer.
