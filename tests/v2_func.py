"""v2 functional test: save and open (v2 and v1 files), share link reopens the same design, compare, cards,
render sheet, image render, GLB export, drive mode, undo. Run after `node studio/build.mjs`."""
import base64, json, pathlib, struct, sys, time
from v2_common import open_studio, settle, sync_playwright, ROOT
out = ROOT / 'tests' / 'shots' / 'v2'; out.mkdir(parents=True, exist_ok=True)
fails = []
def check(cond, msg):
    print(('ok   ' if cond else 'FAIL ') + msg)
    if not cond: fails.append(msg)
with sync_playwright() as p:
    b, pg, errs = open_studio(p)
    # a first visit opens blank: no vehicle, nothing built, later steps locked
    settle(pg)
    check(pg.evaluate("window.__studio.store.E.blank && !window.__studio.car.root"), 'opens on a blank design with nothing built')
    check(pg.evaluate("[...document.querySelectorAll('#stepper .step')].filter(b => b.disabled).length") == 8, 'steps after the vehicle wait for a vehicle')
    # brief buttons answer right away, every time
    for lab, path, want in [('$$$', 'budget', 3), ('Light', 'effort', 1), ('$', 'budget', 1), ('Heavy', 'effort', 3)]:
        pg.locator(f'#panelBody .seg button:text-is("{lab}")').click()
        check(pg.locator(f'#panelBody .seg button:text-is("{lab}")').get_attribute('aria-pressed') == 'true' and pg.evaluate(f"window.__studio.store.d.brief.{path}") == want, f'brief button {lab} takes')
    check(pg.locator('#panelBody', has_text='Crew skills').count() == 1 and pg.locator('#panelBody', has_text='Chassis').count() == 0, 'crew skills are an output; no chassis age')
    # pick a vehicle: the view shows the stock vehicle alone
    pg.click('#nextBtn'); pg.wait_for_timeout(300)
    pg.locator('#panelBody .fams button:text-is("Cab-over trucks")').click(); pg.wait_for_timeout(200)
    pg.locator('#panelBody .ocard', has_text='Isuzu NPR-HD').first.click()
    settle(pg, "window.__studio.store.E.d.vehicle.id === 'npr'", 600)
    vis = pg.evaluate("window.__studio.car.root.children.filter(g => g.visible).map(g => g.userData.layer)")
    check(set(vis) == {'vehicle'}, f'vehicle step shows the vehicle only ({sorted(set(vis))})')
    check(pg.locator('#panelBody .yours', has_text='Isuzu NPR-HD').count() == 1, 'your vehicle sits at the top of the step')
    pg.evaluate("window.__studio.goStep(3)"); pg.wait_for_timeout(500)
    vis = set(pg.evaluate("window.__studio.car.root.children.filter(g => g.visible).map(g => g.userData.layer)"))
    check(vis == {'vehicle', 'structure'}, f'structure step adds the structure ({sorted(vis)})')
    # design: a full shell or a cover; power and transport as their own steps
    pg.evaluate("window.__studio.goStep(6)"); pg.wait_for_timeout(300)
    pg.locator('#panelBody .ocard', has_text='Yes: one shell over everything').click(); settle(pg, "window.__studio.store.E.d.kits.body.id === 'pink-fish'", 300)
    check(True, 'design: choosing a full shell gives the pink fish')
    pg.locator('#panelBody .ocard', has_text='No: cover the sides and the engine').click(); settle(pg, "window.__studio.store.E.d.kits.body.id === 'side-tubes'", 300)
    pg.locator('#panelBody .ocard', has_text='Rocket ship').click(); settle(pg, "window.__studio.store.E.d.kits.body.id === 'rocket'", 300)
    pg.locator('#panelBody .seg button', has_text='Plywood').first.click(); settle(pg, "window.__studio.store.E.d.kits.body.p.build === 'plywood'", 300)
    check(True, 'design: a rocket ship built from plywood')
    pg.evaluate("window.__studio.goStep(8)"); pg.wait_for_timeout(300)
    check(pg.locator('#panelHead h2').inner_text() == '8. Power' and pg.locator('#panelBody', has_text='Why power matters').count() == 1, 'power has its own step and says why it matters')
    pg.evaluate("window.__studio.goStep(9)"); pg.wait_for_timeout(300)
    check(pg.locator('#panelBody', has_text='Peik Construction').count() == 1 and pg.locator('#panelBody', has_text='Reno').count() == 0, 'transport: Peik hauls it, no Reno storage note')
    pg.locator('#panelBody label', has_text='The skin and design pieces come off').click(); settle(pg, "window.__studio.store.E.d.transport.skinOff === false", 300)
    check(pg.evaluate("window.__studio.store.E.teardown.pieces.every(p => p.group !== 'Design')"), 'transport: leaving the skin on keeps it out of the teardown')
    pg.evaluate("window.__studio.loadStarter('pinguina')"); settle(pg, "window.__studio.store.E.d.name.startsWith('Pingüina')")
    # save
    pg.click('#fileBtn')
    with pg.expect_download() as d: pg.click('#saveBtn')
    d.value.save_as(out / 'design.json'); data = json.loads((out / 'design.json').read_text())
    check(data['version'] == 2 and data['design']['structure']['style'] == 'cage', 'save writes a v2 design file')
    # change something, then open the saved file back
    pg.evaluate("window.__studio.loadStarter('haulster')"); settle(pg, "window.__studio.store.E.d.vehicle.id === 'haulster'")
    pg.set_input_files('#openInput', str(out / 'design.json')); settle(pg, "window.__studio.store.E.d.structure.style === 'cage'")
    check(pg.evaluate("window.__studio.store.d.kits.body.id") == 'penguin', 'open restores the saved design')
    # a v1 save opens with its numbers
    v1 = {'app': 'art-car-studio', 'version': 1, 'design': {'chassis': 'npr', 'layout': 'ring', 'roofDeck': True, 'headroom': 1.95, 'keepCab': False, 'ladder': 'front', 'name': 'v1 save', 'tubeDia': 0.6}}
    (out / 'v1.json').write_text(json.dumps(v1))
    pg.set_input_files('#openInput', str(out / 'v1.json')); settle(pg, "window.__studio.store.E.d.name === 'v1 save'")
    check(pg.evaluate("window.__studio.store.d.vehicle.id") == 'npr', 'a v1 file opens in v2')
    # share link round trip
    pg.evaluate("window.__studio.loadStarter('express')"); settle(pg, "window.__studio.store.E.d.vehicle.id === 'express'")
    pg.evaluate("window.__studio.setValue('kits.body', 'pink-fish'); window.__studio.setValue('layout.dj', 'front')"); settle(pg, "window.__studio.store.E.d.kits.body.id === 'pink-fish'")
    url = pg.evaluate("window.__studio.shareLink()")
    want = pg.evaluate("JSON.stringify(window.__studio.store.d)")
    b2, pg2, errs2 = open_studio(p, hash='#' + url.split('#')[1])
    settle(pg2, "window.__studio.store.E.d.kits.body.id === 'pink-fish'")
    check(pg2.evaluate("JSON.stringify(window.__studio.store.d)") == want, f'a shared link reopens the same design ({len(url)} chars)')
    errs += errs2; b2.close()
    # compare
    pg.click('#compareBtn'); pg.wait_for_timeout(500)
    pg.evaluate("window.__studio.setValue('vehicle.id', 'f350')"); settle(pg, "window.__studio.store.E.d.vehicle.id === 'f350'", 800)
    cols = pg.evaluate("document.querySelectorAll('#compareBar thead th').length")
    check(cols == 3 and len(pg.evaluate("window.__studio.car.others")) == 1, 'compare shows two designs on one scorecard and one camera')
    pg.screenshot(path=str(out / 'compare.png'))
    pg.click('#compareBar .chip'); pg.wait_for_timeout(300)
    # cards
    pg.evaluate("window.__studio.loadCard('shinkansen', 'dream')"); settle(pg, "window.__studio.store.E.d.kits.body.id === 'bullet-train' && !window.__studio.store.E.d.kits.body.p.window", 600)
    banner = pg.evaluate("document.getElementById('cardBanner').innerText")
    check('What breaks' in banner and 'nearest buildable' in banner, 'reality card shows what breaks and offers the nearest buildable')
    pg.screenshot(path=str(out / 'card-shinkansen.png'))
    pg.click('#cardBanner .btn.primary'); settle(pg, "window.__studio.store.E.d.kits.body.p.window === true", 600)
    check(pg.evaluate("window.__studio.store.E.red.length") == 0, 'nearest buildable has no red flags')
    pg.screenshot(path=str(out / 'card-shinkansen-nearest.png'))
    # undo
    before = pg.evaluate("window.__studio.store.d.layout.seating")
    pg.evaluate("window.__studio.setValue('layout.seating', before === 'ring' ? 'facing' : 'ring')".replace('before', json.dumps(before)))
    pg.click('#fileBtn'); pg.click('#undoBtn'); pg.wait_for_timeout(300)
    check(pg.evaluate("window.__studio.store.d.layout.seating") == before, 'undo restores the last change')
    # render sheet, image, GLB
    pg.evaluate("window.__studio.pause(true)")
    t = time.time(); pg.evaluate("window.__studio.renderSheet()")
    src = pg.evaluate("document.getElementById('sheetImg').src")
    (out / 'sheet.png').write_bytes(base64.b64decode(src.split(',')[1]))
    check(src.startswith('data:image/png') and pg.evaluate("document.getElementById('sheetDlg').open"), f'render sheet ({round(time.time() - t)} s)')
    pg.evaluate("document.getElementById('sheetDlg').close()")
    pg.select_option('#renderSize', '1920x1080')
    with pg.expect_download() as d: pg.click('#renderBtn')
    check(d.value.suggested_filename.endswith('1920x1080.png'), 'render image downloads a PNG')
    pg.click('#fileBtn')
    with pg.expect_download(timeout=120000) as d: pg.click('#glbBtn')
    d.value.save_as(out / 'car.glb'); raw = (out / 'car.glb').read_bytes()
    check(raw[:4] == b'glTF' and len(raw) > 100000, f'GLB export ({len(raw) // 1024} KB)')
    # drive
    pg.click('#driveBtn'); pg.evaluate("window.__studio.pause(false)")
    pg.keyboard.down('w')
    for _ in range(8): pg.wait_for_timeout(5000)   # software rendering is slow: give the sim time
    pg.keyboard.up('w')
    moved = pg.evaluate("(()=>{const r=window.__studio.car.root.parent; return Math.hypot(r.position.x, r.position.z)})()")
    speed = float(pg.evaluate("document.getElementById('speedOut').textContent"))
    check(moved > 0.3 and speed <= 5.05, f'drive mode moves the car at no more than 5 mph (moved {moved:.2f} m)')
    pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    check(pg.evaluate("document.getElementById('hud').hidden"), 'park hides the HUD')
    print('\n'.join(errs) or 'no console errors')
    b.close()
sys.exit(1 if fails or errs else 0)
