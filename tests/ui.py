import pathlib
PAGE = (pathlib.Path(__file__).resolve().parent.parent / 'dist' / 'v1' / 'index.html').as_uri()
pathlib.Path('tests/shots').mkdir(parents=True, exist_ok=True)
import sys, base64
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
    pg = b.new_page(viewport={'width':1440,'height':900})
    logs = []
    pg.on('console', lambda m: logs.append(f'{m.type}: {m.text}'))
    pg.on('pageerror', lambda e: logs.append(f'PAGEERROR: {e}'))
    pg.goto(PAGE)
    pg.wait_for_function('window.__artcar', timeout=60000)
    pg.wait_for_function("document.getElementById('loading').classList.contains('done')", timeout=200000)
    pg.evaluate("document.querySelectorAll('details').forEach((d,i)=>{ if(i===6) d.open = true; })")
    pg.evaluate("window.__artcar.pause(true)")
    pg.evaluate("window.__artcar.snap()")
    pg.screenshot(path='tests/shots/ui.png', timeout=200000)
    print('\n'.join(l for l in logs if '403' not in l))
    b.close()
