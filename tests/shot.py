import pathlib
PAGE = (pathlib.Path(__file__).resolve().parent.parent / 'dist' / 'v1' / 'index.html').as_uri()
pathlib.Path('tests/shots').mkdir(parents=True, exist_ok=True)
import sys, base64
from playwright.sync_api import sync_playwright
views = sys.argv[1].split(',')
mood = sys.argv[2] if len(sys.argv) > 2 else 'day'
extra = sys.argv[3] if len(sys.argv) > 3 else ''
W,H = (1440,900)
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
    pg = b.new_page(viewport={'width':W,'height':H})
    logs = []
    pg.on('console', lambda m: logs.append(f'{m.type}: {m.text}'))
    pg.on('pageerror', lambda e: logs.append(f'PAGEERROR: {e}'))
    pg.goto(PAGE)
    pg.wait_for_function('window.__artcar', timeout=60000)
    pg.evaluate("window.__artcar.pause(true)")
    pg.evaluate(f"window.__artcar.applyMood('{mood}')")
    if extra: pg.evaluate(extra)
    for v in views:
        pg.evaluate(f"window.__artcar.setView('{v}', true)")
        r = pg.evaluate("window.__artcar.snap()")
        open(f'tests/shots/{v}-{mood}{sys.argv[4] if len(sys.argv)>4 else ""}.png','wb').write(base64.b64decode(r['url'].split(',')[1]))
        print(v, round(r['ms']), 'ms')
    if '--ui' in sys.argv:
        pg.evaluate("window.__artcar.pause(false)")
        pg.wait_for_timeout(4000)
        pg.screenshot(path=f'tests/shots/ui-{mood}.png', timeout=120000)
    print('\n'.join(logs[:30]))
    b.close()
