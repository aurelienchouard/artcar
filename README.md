# Art Car Studio

A single-file 3D planner for a Burning Man art car. Pick a chassis, shape the body, tubes, decks,
lights, sound and power, then check riders, payload, tipping, DMV rules, a cut list and how it travels.

Chassis, smallest payload to largest: Cushman Haulster, Taylor-Dunn Bigfoot XL, Motrec MC-480,
Isuzu NPR-HD, Chevrolet Express 3500 cutaway, Ford F-350 DRW.

**Open it: https://aurelienchouard.github.io/artcar/**

**Version 2 (preview): https://aurelienchouard.github.io/artcar/v2/** A nine-step studio (brief, vehicle, strip down,
structure, upper deck, layout, design, lights and sound, transport) with an always-visible scorecard that explains
every flag, 26 vehicles with sourced specs, 24 design kits, reality-check cards, compare and share links. It lives
in `studio/`; see [studio/README.md](studio/README.md).

`dist/index.html` also works offline: download it and open it in any modern browser.

## Develop

- `src/app-data.js`: chassis catalog and specs, defaults, starters, panel sections, body limits
- `src/app-model.js`: the 3D model, cut list, weights, rider counts and tipping estimate
- `src/app-main.js`: UI, views, readouts, save/open, render sheet, 3D export, drive mode
- `src/style.css`, `src/index.template.html`
- `python3 build.py` builds `dist/index.html` and the identical `index.html` at the root (what GitHub Pages serves)
- `npm install && npm run bundle-three` rebuilds `vendor/three-bundle.js` (three r169); only needed to change three.js

Every push to `main` rebuilds the site (v1 at the root, v2 under `/v2/`) through `.github/workflows/pages.yml`.
`npm run build` builds both; `npm run build:v2` builds only v2 into `dist/v2/index.html` and `v2/index.html`.

Tests run headless Chromium through Playwright (`pip install playwright && playwright install chromium`),
from the repo root:

- `python3 tests/stress.py`: every chassis × option combos × starters × views, fails loudly on errors
- `python3 tests/func.py`: render sheet, save and open, 3D export, drive mode
- `python3 tests/starters.py`: riders, weight, arches and tipping for each starter
- `python3 tests/shot.py hero,top day "" -name`: renders views into `tests/shots/`

## About the numbers

Manufacturer specs are used where published; anything else is marked `est.` in `src/app-data.js`.
Build weights come from the model's own cut list and are ±30%. The tipping readout is a rough static estimate
(roof filled first, no suspension roll), flagged under 0.45 g as a rule of thumb, not a standard. The DMV
checks follow the 2024 handbook: 36–48″ rails on decks 84″ or more up, and playa-only licensing at 25′ long
or 13′ wide. None of it replaces weighing the real thing or the DMV's own inspection.
