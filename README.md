# Bus Fare BD

Offline bilingual (English / বাংলা) bus fare calculator for Bangladesh, built on the official BRTA fare schedule. Enter a distance and a service type and see the fare in taka — with the minimum fare, return-trip and multi-passenger totals, a cheapest-first comparison, popular Dhaka routes, and an editable rate table.

## Features

- **Fare calculator** — distance (0.1–2000 km) × official per-km rate, rounded to the nearest whole taka, with the gazette minimum fare applied to short trips; optional return trip (×2) and 1–10 passengers.
- **Compare all services** — the same distance priced for all four service types, cheapest first with a CHEAPEST badge.
- **Popular routes** — 8 Dhaka routes (Chattogram, Sylhet, Khulna, Rajshahi, Barishal, Mymensingh, Cumilla, Cox's Bazar) with approximate road distances; tap to load into the calculator.
- **Editable rate table** — per-km rate and minimum fare per service type, saved on the device, with one-click reset to the gazette defaults; includes a rate-history table (April 2026 vs September 2026).
- **Saved calculations** — history with totals, SVG chart, delete, JSON export / import with strict validation, and typed-DELETE erase-all.
- **Bilingual** — EN / বাংলা toggle persisted across reloads, Bengali digits, 390px mobile layout, zero network requests, fully offline.

## Official rates (defaults)

Gazette notification of 23 September 2026 (Road Transport and Highways Division), effective 22 September 2026, under section 34(2) of the Road Transport Act, 2018. Diesel-run buses and minibuses only — gas-run buses are not covered by these rates.

| Service | Rate / km | Minimum fare |
|---|---|---|
| City bus — Dhaka / Chattogram metro | Tk 2.70 | Tk 10 |
| City minibus — Dhaka / Chattogram metro | Tk 2.60 | Tk 8 |
| DTCA-area bus / minibus (Dhaka, Narayanganj, Munshiganj, Narsingdi, Gazipur, Manikganj) | Tk 2.60 | Tk 8 |
| Inter-district / long-distance bus / minibus | Tk 2.40 | Tk 8 |

Previous rates (23 April 2026): Tk 2.53 / 2.43 / 2.43 / 2.23. Sources: The Business Standard (23 Sep 2026), BSS (23 Sep 2026), bdnews24 (23 Sep 2026), Dhaka Tribune (23 Sep 2026), The Daily Star (23 Apr 2026).

Route distances are approximate road distances (shortest route) from the Roads & Highways Department distance matrix, as published by bdtradeinfo.com and reportbd.net; they vary by route.

## Worked examples

- 10 km city bus: 10 × Tk 2.70 = **Tk 27.00**
- 3.7 km city bus: 3.7 × Tk 2.70 = Tk 9.99 → minimum fare **Tk 10.00**
- Dhaka → Chattogram, 242 km inter-district: 242 × Tk 2.40 = Tk 580.80 → **Tk 581.00**
- Same trip, return, 3 passengers: Tk 581.00 × 2 × 3 = **Tk 3,486.00**

## Stack

Vanilla HTML / CSS / JavaScript, no dependencies, no build step, no network calls. Money is integer paisa everywhere (no float error); distance is handled in integer hundredths of a kilometre.

## Run locally

Open `index.html` in any browser, or serve the folder:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

## Testing

```bash
node tests/logic.test.js   # 71 node unit tests
node tests/smoke.js        # 54 headless-Chrome smoke checks (raw CDP)
```

See [TEST_RESULTS.md](TEST_RESULTS.md) for the hand-verified values.

## Limitations

- Fares are rounded to the nearest whole taka (labelled assumption — conductors charge whole taka); the gazette does not state a rounding rule.
- The Tk 8 minimum fare for DTCA-area and inter-district services follows the "Tk 10 in metropolitan areas, Tk 8 outside" minimum reported in April 2026; the September 2026 reports state the Tk 10 / Tk 8 minima for the metropolitan areas explicitly.
- Route distances are approximate; check your ticket for the exact distance and fare.
- This is a personal estimator, not an official BRTA app. Verify the fare chart in the bus before paying.

## Status

Complete and verified. See [TEST_RESULTS.md](TEST_RESULTS.md).
