# Art Car Studio

A single-file, offline 3D planner for a Burning Man art car. Pick a chassis, shape the body, tubes, decks,
lights, sound and power, then check riders, payload, tipping, DMV rules, a cut list and how it travels.

Chassis, smallest payload to largest: Cushman Haulster, Taylor-Dunn Bigfoot XL, Motrec MC-480,
Isuzu NPR-HD, Chevrolet Express 3500 cutaway, Ford F-350 DRW.

## Use it

Online: **https://aurelienchouard.github.io/artcar/** (GitHub Pages, rebuilt from `main` on every push by
`.github/workflows/pages.yml`).

Or open `dist/index.html` in any modern browser. Everything is inlined, so it works with no internet.
On the camp network it lives at **http://aurora.brc/artcar/**.

## Put it on GitHub (from your Mac)

```sh
unzip artcar-studio.zip && cd artcar-studio
git init -b main && git add -A && git commit -m "Art Car Studio v6"
gh repo create artcar-studio --private --source . --push
```

No `gh`? Create an empty repo on github.com, then
`git remote add origin git@github.com:<you>/artcar-studio.git && git push -u origin main`.

## Serve it at aurora.brc/artcar

Needs SSH to `aurora-pi` (Tailscale, or `pi@aurora-pi.local` on the camp Wi-Fi). Run it once before the
playa, because the first run installs nginx:

```sh
./deploy/aurora-pi/deploy.sh            # or: ./deploy/aurora-pi/deploy.sh pi@aurora-pi.local
```

It copies `dist/index.html` to `/var/www/artcar/`, adds an nginx server block that answers only for
`aurora.brc` on port 80, and adds `address=/aurora.brc/192.168.0.1` to `/etc/dnsmasq.conf` so every phone
on the Aurora Wi-Fi finds the Pi by that name. It finishes by fetching the page from the Pi itself.
Rerun it for every update; after the first run it works offline.

- `.brc` isn't a real top-level domain, so the name only works on the Aurora Wi-Fi. Type the `http://`,
  or browsers treat `aurora.brc/artcar` as a search. A bookmark or QR code at camp helps.
- If something other than nginx already owns port 80 (say the power dashboard), the script stops and shows
  what's there. Either put nginx in front of it, or add a route to the Flask app and rerun with `SKIP_WEB=1`:
  ```python
  from flask import send_file
  @app.route('/artcar/')
  def artcar():
      return send_file('/var/www/artcar/index.html')
  ```

## Develop

- `src/app-data.js`: chassis catalog and specs, defaults, starters, panel sections, body limits
- `src/app-model.js`: the 3D model, cut list, weights, rider counts and tipping estimate
- `src/app-main.js`: UI, views, readouts, save/open, render sheet, 3D export, drive mode
- `src/style.css`, `src/index.template.html`
- `python3 build.py` builds `dist/index.html`
- `npm install && npm run bundle-three` rebuilds `vendor/three-bundle.js` (three r169); only needed to change three.js

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
