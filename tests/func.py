import pathlib
PAGE = (pathlib.Path(__file__).resolve().parent.parent / 'dist' / 'index.html').as_uri()
import base64, json, struct, time
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
    ctx = b.new_context(viewport={'width':1280,'height':800}, accept_downloads=True)
    pg = ctx.new_page()
    errs = []
    pg.on('pageerror', lambda e: errs.append(f'PAGEERROR: {e}'))
    pg.on('console', lambda m: errs.append(f'{m.type}: {m.text}') if m.type in ('error','warning') and '403' not in m.text else None)
    pg.goto(PAGE)
    pg.wait_for_function("document.getElementById('loading').classList.contains('done')", timeout=300000)
    pg.evaluate("window.__artcar.pause(true)")
    t=time.time()
    pg.evaluate("window.__artcar.renderSheet()")
    src = pg.evaluate("document.getElementById('sheetImg').src")
    open('shots/sheet.png','wb').write(base64.b64decode(src.split(',')[1]))
    print('sheet ok', round(time.time()-t), 's; dialog open:', pg.evaluate("document.getElementById('sheetDlg').open"))
    pg.evaluate("document.getElementById('sheetDlg').close()")
    with pg.expect_download() as d: pg.click('#saveBtn')
    d.value.save_as('shots/design.json'); data=json.load(open('shots/design.json'))
    print('saved', d.value.suggested_filename, 'keys', len(data['design']))
    with pg.expect_download(timeout=120000) as d: pg.click('#glbBtn')
    d.value.save_as('shots/car.glb'); raw=open('shots/car.glb','rb').read()
    print('glb', d.value.suggested_filename, len(raw)//1024, 'KB magic', raw[:4])
    # stress parameter combos
    combos = [
      "{chassis:'f350', width:2.3, tubeDia:1.2, secondStep:'driver', layout:'facing', seatDepth:0.95}",
      "{chassis:'npr', roofDeck:false, curtains:'all', ledLines:0, endCages:false, ribStyle:'match'}",
      "{chassis:'mc480', length:10, posts:7, wheelbase:7, layout:'ushape', roofSeating:'sides', ladder:'rear', bikeRack:'rear'}",
      "{chassis:'bigfoot', length:5, width:4.2, tubeDia:0.5, secondStepPos:1, secondStep:'passenger', rearStyle:'storage'}",
    ]
    for c in combos:
        pg.evaluate(f"Object.entries({c}).forEach(([k,v])=>window.__artcar.setValue(k,v))")
        pg.wait_for_timeout(400)
        info = pg.evaluate("(()=>{const i=window.__artcar.car.info; return [i.seatsLow,i.seatsRoof,+window.__artcar.car.bbox.max.y.toFixed(2),+i.widthMax.toFixed(2)]})()")
        print('combo', c[:48], '->', info)
    for pid in ['npr','indigo','bigfoot']:
        pg.select_option('#preset', pid); pg.wait_for_timeout(400)
        st = pg.evaluate("window.__artcar.state()")
        print('preset', pid, st['name'], st['width'], st['mood'], pg.evaluate("document.getElementById('stats').innerText.replace(/\\n/g,' | ')"))
    pg.set_input_files('#openInput', 'shots/design.json'); pg.wait_for_timeout(600)
    print('opened ->', pg.evaluate("window.__artcar.state().name"), pg.evaluate("document.getElementById('toast').textContent"))
    # drive
    pg.click('#driveBtn'); pg.evaluate("window.__artcar.pause(false)")
    pg.keyboard.down('w'); pg.keyboard.down('a')
    t0=time.time()
    while time.time()-t0 < 70: pg.wait_for_timeout(5000)
    pg.keyboard.up('w'); pg.keyboard.up('a')
    pos = pg.evaluate("(()=>{const r=window.__artcar.car.model.parent; return [r.position.x.toFixed(2), r.position.z.toFixed(2), r.rotation.y.toFixed(3)]})()")
    print('drive pos', pos, 'speed', pg.evaluate("document.getElementById('speedOut').textContent"), 'hud', pg.evaluate("!document.getElementById('hud').hidden"))
    pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    print('after park hud hidden:', pg.evaluate("document.getElementById('hud').hidden"))
    print('\n'.join(errs) or 'no errors')
    b.close()
