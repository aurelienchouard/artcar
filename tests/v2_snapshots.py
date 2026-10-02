"""Visual snapshots: every starter at every step, saved to tests/shots/v2/snap/. With --baseline, also saves them
to tests/shots/v2/baseline/; without it, compares against an existing baseline and reports images that changed.
Software rendering (SwiftShader) is deterministic on one machine, so baselines are per machine."""
import pathlib, sys
from v2_common import open_studio, settle, sync_playwright, ROOT
snap = ROOT / 'tests' / 'shots' / 'v2' / 'snap'; base = ROOT / 'tests' / 'shots' / 'v2' / 'baseline'
snap.mkdir(parents=True, exist_ok=True)
make = '--baseline' in sys.argv
if make: base.mkdir(parents=True, exist_ok=True)
changed = []
with sync_playwright() as p:
    b, pg, errs = open_studio(p, 1280, 800)
    for st in pg.evaluate('window.__studio.starters'):
        pg.evaluate(f"window.__studio.loadStarter('{st}')"); settle(pg)
        for i in range(9):
            pg.evaluate(f"window.__studio.goStep({i})"); pg.wait_for_timeout(700)
            pg.evaluate("window.__studio.app.userMoved=false; window.__studio.setView(window.__studio.app.view, true)"); pg.wait_for_timeout(300)
            name = f'{st}-step{i}.png'
            pg.screenshot(path=str(snap / name))
            if make: (base / name).write_bytes((snap / name).read_bytes())
            elif (base / name).exists() and (base / name).read_bytes() != (snap / name).read_bytes(): changed.append(name)
        print(st, 'done')
    b.close()
print('\n'.join(errs) or 'no errors')
if not make: print(f'{len(changed)} snapshots differ from the baseline' + (': ' + ', '.join(changed) if changed else ''))
