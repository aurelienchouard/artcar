import pathlib
PAGE = (pathlib.Path(__file__).resolve().parent.parent / 'dist' / 'index.html').as_uri()
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
    pg = b.new_page(viewport={'width':480,'height':320}); errs=[]
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(PAGE); pg.wait_for_function('window.__artcar', timeout=120000)
    pg.evaluate("window.__artcar.pause(true)")
    for pid in ['haulster','bigfoot','mc480','npr','express','f350']:
        pg.select_option('#preset', pid); pg.wait_for_timeout(300); pg.evaluate("window.__artcar.rebuildNow()")
        g = lambda sel: pg.evaluate(f"[...document.querySelectorAll('{sel} dt')].map((d,i)=>d.textContent+': '+document.querySelectorAll('{sel} dd')[i].textContent)")
        st = g('#stats'); tr = g('#transportInfo')
        pick = lambda rows, keys: ' | '.join(r for r in rows if r.split(':')[0] in keys)
        print(pid.ljust(8), pick(st, ['Riders','On the platform','Seated below','Standing','Build, rough','Left over','Wheel arches','Tipping, loaded']), '||', pick(tr, ['Packed','Hauled height','Fits']))
    print(errs or 'no errors'); b.close()
