"""Record v1's numbers as parity fixtures for the v2 engine.

Loads the v1 page (dist/index.html), runs the six starters and every chassis x the v1 stress combos,
and writes the full v1 state plus everything v1 computed to studio/test/fixtures/v1-parity.json.
Run from the repo root after `python3 build.py`: python3 studio/tools/v1_fixtures.py
"""
import json, pathlib, sys
from playwright.sync_api import sync_playwright
root = pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0, str(root / 'tests'))
PAGE = (root / 'dist' / 'index.html').as_uri()
# the same combos as tests/stress.py
src = (root / 'tests' / 'stress.py').read_text()
combos = eval(src[src.index('combos = [') + len('combos = '):src.index(']\n    for ch in') + 1].replace('dict(', 'dict('))
GRAB = """(() => {
  const A = window.__artcar; A.rebuildNow();
  const i = A.car.info, box = (b) => ({ min: [b.min.x, b.min.y, b.min.z], max: [b.max.x, b.max.y, b.max.z] });
  const keep = {};
  for (const [k, v] of Object.entries(i)) if (typeof v === 'number' || typeof v === 'boolean' || typeof v === 'string') keep[k] = v;
  keep.kg = i.kg; keep.bom = i.bom; keep.tip = i.tip; keep.archInfo = i.archInfo;
  const boxes = {}; for (const [k, b] of Object.entries(A.car.boxes)) boxes[k] = box(b);
  return { state: JSON.parse(JSON.stringify(A.state())), info: keep, bbox: box(A.car.bbox), boxes };
})()"""
out = []
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
    pg = b.new_page(viewport={'width': 480, 'height': 320})
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(PAGE)
    pg.wait_for_function('window.__artcar', timeout=120000)
    pg.evaluate('window.__artcar.pause(true)')
    for pid in ['haulster', 'bigfoot', 'mc480', 'npr', 'express', 'f350']:
        pg.select_option('#preset', pid); pg.wait_for_timeout(150)
        r = pg.evaluate(GRAB); r['case'] = f'starter:{pid}'; out.append(r)
    for ch in ['haulster', 'bigfoot', 'mc480', 'npr', 'express', 'f350']:
        for n, c in enumerate(combos):
            pg.evaluate(f"window.__artcar.setValue('chassis','{ch}'); window.__artcar.setValue('frameView',false); window.__artcar.setValue('transportPreview',false)")
            pg.evaluate(f"Object.entries({json.dumps(c)}).forEach(([k,v])=>window.__artcar.setValue(k,v))")
            r = pg.evaluate(GRAB); r['case'] = f'combo:{ch}:{n}'; out.append(r)
    b.close()
if errs:
    print('page errors:', errs[:5]); sys.exit(1)
dest = root / 'studio' / 'test' / 'fixtures' / 'v1-parity.json'
def fix(o):
    import math
    if isinstance(o, float) and math.isinf(o): return None
    if isinstance(o, dict): return {k: fix(v) for k, v in o.items()}
    if isinstance(o, list): return [fix(v) for v in o]
    return o
out = fix(out)
dest.write_text(json.dumps({'note': 'Generated from v1 (dist/index.html) by studio/tools/v1_fixtures.py. Do not edit by hand.', 'cases': out}, indent=0, allow_nan=False))
print(len(out), 'cases ->', dest.relative_to(root), dest.stat().st_size // 1024, 'KB')
