"""v2 stress test: every vehicle x option combos x steps x views. Fails loudly on any page error.
Run from the repo root after `node studio/build.mjs`: python3 tests/v2_stress.py"""
import json, sys
from v2_common import open_studio, settle, sync_playwright
COMBOS = [
    {'strip.level': 'stock', 'upper.kind': 'none', 'structure.style': 'deck-posts'},
    {'strip.level': 'cut', 'upper.kind': 'stand', 'upper.coverage': 'full', 'upper.access': 'ladder-rear', 'layout.seating': 'ring'},
    {'strip.level': 'rails', 'structure.style': 'cage', 'upper.kind': 'stand', 'upper.access': 'stairs', 'layout.dj': 'front', 'layout.bar': 'side'},
    {'structure.style': 'barge', 'upper.kind': 'none', 'layout.seating': 'platform', 'lights.speakers': 'towers', 'layout.storage': 'rear'},
    {'upper.kind': 'bunk', 'upper.coverage': 'modular', 'upper.segments': [{'kind': 'deck', 'len': 2}, {'kind': 'open', 'len': 1}, {'kind': 'deck', 'len': 2}], 'upper.hatchSide': 'driver'},
    {'structure.material': 'alu', 'structure.powerBay': 'under', 'structure.powerBaySize': 'large', 'lights.batteryKwh': 30, 'layout.rear': 'daiquiri'},
    {'kits.side': 'skirts', 'kits.front': 'bullet-nose', 'transport.trailer': 'rollback'},
    {'kits.theme': 'centipede', 'transport.trailer': 'flatbed'},
    {'kits.full': 'pink-fish', 'transport.trailer': 'equipment'},
    {'kits.train': 'train', 'view.units': 'metric', 'view.mood': 'day'},
]
VIEWS = ['hero', 'left', 'right', 'front', 'rear', 'top', 'lounge', 'roof', 'cockpit', 'frame', 'packed']
with sync_playwright() as p:
    b, pg, errs = open_studio(p, 960, 640)
    pg.evaluate('window.__studio.pause(true)')
    vids = ['haulster', 'haulster-old', 'bigfoot', 'td-heavy', 'mc480', 'mc660', 'ranger-kinetic', 'gem-elxd', 'gator', 'npr', 'nrr-ev', 'ecanter', 'express', 'express-4500', 'e350', 'e450',
            'etransit-cutaway', 'f350', 'f450', 'ram-3500cc', 'ram-4500cc', 'bollinger-b4', 'intl-emv', 'cement-mixer', 'school-bus', 'double-decker']
    n = 0
    for vid in vids:
        for c in COMBOS:
            pg.evaluate(f"(()=>{{const S=window.__studio; S.loadStarter('express'); S.setValue('vehicle.id','{vid}'); for (const [k,v] of Object.entries({json.dumps(c)})) S.setValue(k, v); }})()")
            settle(pg, f"window.__studio.store.E.d.vehicle.id === '{vid}'", 50)
            n += 1
            if errs: print('ERR', vid, c, errs[:3]); sys.exit(1)
        print(vid, 'ok', pg.evaluate("(()=>{const E=window.__studio.store.E; return [E.rc.riders, Math.round(E.w.buildKg), +E.tip.ssf.toFixed(2), E.red.join(',')]})()"))
    for st in pg.evaluate('window.__studio.starters'):
        pg.evaluate(f"window.__studio.loadStarter('{st}')"); settle(pg)
        for i in range(9): pg.evaluate(f"window.__studio.goStep({i})")
        for v in VIEWS: pg.evaluate(f"window.__studio.setView('{v}', true)")
        print('starter', st, 'steps and views ok')
    for card in ['shinkansen', 'cement-mixer', 'school-bus', 'double-decker']:
        for which in ['dream', 'nearest']:
            pg.evaluate(f"window.__studio.loadCard('{card}', '{which}')"); settle(pg)
            print('card', card, which, pg.evaluate("window.__studio.store.E.red.join(',') || 'no red'"))
    print(n, 'combos;', '\n'.join(errs) or 'no errors')
    b.close()
    sys.exit(1 if errs else 0)
