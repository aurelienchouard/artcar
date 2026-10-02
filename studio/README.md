# Art Car Studio v2

A studio for understanding the constraints of building a Burning Man art car and sharing the tradeoffs with
campmates. Nine steps, a scorecard that is always visible, and an explainer behind every flag: what failed, by how
much, why the rule exists, and what would fix it. Every number is a planning estimate.

**Open it:** https://aurelienchouard.github.io/artcar/ (or `dist/index.html`, which works offline). The archived v1 is at `/artcar/v1/`.

## How it is built

One self-contained HTML file: ES modules bundled with esbuild, three.js vendored (`vendor/three-bundle.js`).

| Folder | What it holds |
|---|---|
| `catalogs/` | Plain data: vehicles, design kits, materials, trailers, the rules table, tier points, starters, reality-check cards, and the schema that validates them all at build time. |
| `engine/` | Pure functions, no three.js and no DOM: the design state, limits, weight, riders, tipping, transport, DMV checks, driver view cone, power budget, tiers, teardown, scorecard, flags, eligibility, share links. |
| `engine/model/` | The parametric model (ported from v1) that lays out every part and emits a three-free scene description tagged by layer: vehicle, structure, upper deck, layout, design, lights, riders. It also counts seats and the bill of materials. |
| `builders/` | Turn the scene description into three.js objects; materials, overlays (dimensions, view cone, trailers, reference silhouette). |
| `ui/` | Stepper, scorecard, step panels, store (undo, persistence), compare, share, files, drive mode. |
| `test/` | Node tests (`npm run test:engine`). Browser tests live in `../tests/v2_*.py`. |

`evaluate(design)` in `engine/evaluate.js` runs everything and returns the scorecard, flags and step statuses.
Option eligibility (greyed-out options with their reasons) comes from `engine/eligibility.js`, never the UI.

## Adding data

- **A vehicle:** add an entry to `catalogs/vehicles.js`. Use `extends` to start from a similar vehicle; every fact you
  don't source yourself is shown as an estimate ("assumed from …, verify"). Badge each field with `facts({...})`.
- **A design kit:** add a `defineKit({...})` entry to `catalogs/kits.js` with the full kit contract: category, params,
  materials, wheel clearance, rider openings, transport, look by day and night, platforms, tiers, explainer, and
  `parts(T, p)` built from the parts toolbox (`T.shell`, `T.band`, `T.polyline`, `T.panel`, `T.solid`, `T.led`).
  Shells drop only the faces the wheel envelope touches and keep the standard rider and driver openings.
- **A rule or threshold:** edit `catalogs/rules.js`. Each entry has a value, a source, a "verified" date and a note;
  the explainers read from it. DMV figures were checked against the Mutant Vehicle Owner’s Handbook on 2026-10-02.
- **A reality-check card:** add to `catalogs/cards.js` a preset, the flag ids it must raise with a "why" for each,
  a nearest-buildable preset, and talking points. The tests hold every card to section 9 of the spec.

`npm run build:v2` refuses to build if any catalog entry fails the schema.

## Tests

| Command | What it checks |
|---|---|
| `npm run test:engine` | Schema; v1 parity on 126 fixture cases; the section 4.6 worked example; payload, tipping, DMV rails; wheel clearance at full lock for every kit on every platform; the kit contract; the cards; share links. |
| `python3 tests/v2_stress.py` | Every vehicle × option combos, every starter through every step and view, every card: no page errors. |
| `python3 tests/v2_func.py` | Save and open (v2 and v1 files), share link round trip, compare, cards, undo, render sheet, image, GLB, drive. |
| `python3 tests/v2_snapshots.py [--baseline]` | Screenshots of every starter at every step; compares against a per-machine baseline. |

The browser tests use Python Playwright with the preinstalled Chromium (`pip install playwright==1.56.0` matches it).
`studio/tools/v1_fixtures.py` regenerates the v1 parity fixtures from the v1 page.

## Known gaps

- Many vehicle figures are estimates, badged as such; the catalog lists what needs a source.
- Per-model configuration offers the real wheelbase options; single versus dual rear wheels and powertrain variants
  are separate catalog entries rather than switches.
- Design kits are low-fidelity shapes meant to explain envelope, weight, wheels and sight lines, not to look final.
- The driver view cone is our proxy; the DMV checks visibility itself at inspection.
- The v1 concept board isn't carried over.
