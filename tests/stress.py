import pathlib
PAGE = (pathlib.Path(__file__).resolve().parent.parent / 'dist' / 'index.html').as_uri()
import itertools, json
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
    pg = b.new_page(viewport={'width':480,'height':320})
    errs=[]
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('console', lambda m: errs.append(m.text) if m.type=='error' and '403' not in m.text else None)
    pg.goto(PAGE)
    pg.wait_for_function('window.__artcar', timeout=120000)
    pg.evaluate("window.__artcar.pause(true)")
    rebuild = "(()=>{window.__artcar.rebuildNow(); const i=window.__artcar.car.info; const b=window.__artcar.car.bbox; return [i.seatsLow,i.seatsRoof,i.standLow+'+'+i.standRoof,i.arches+(i.archFull?'F':''),Math.round(i.buildKg*2.2),Math.round(i.payloadKg*2.2),+i.frontLen.toFixed(2),+i.lengthMax.toFixed(2),+i.widthMax.toFixed(2),+b.max.y.toFixed(2),i.bikeCount+'/'+i.bikesWanted]})()"
    for ch in ['haulster','bigfoot','mc480','npr','express','f350']:
        pg.evaluate(f"window.__artcar.setValue('chassis','{ch}')")
        print(ch.ljust(8), pg.evaluate(rebuild))
    combos = [
      dict(ladder='rear', bikeRack='both', rearStyle='daiquiri', roofDeckRear=2, keepCab=True, curtainsDrawn=True),
      dict(ladder='front', roofSeating='u', roofDeckFront=0, roofDeckRear=0, keepCab=True, railHeight=0.3, curtains='all'),
      dict(roofSeating='pillows', roofDeckFront=5, roofDeckRear=5, removeRoof=True, transportPreview=True, rearStyle='none', curtainsDrawn=True),
      dict(ladder='front', roofSeating='sides', secondStep='driver', secondStepPos=1),
      dict(rearStyle='none', layout='ushape', tubeTaper=0, ribStyle='metal', tubeFront=0, tubeRear=0),
      dict(rearStyle='panels', ribStyle='none', endCages=False, driverStep=False, secondStep='none'),
      dict(length=3, width=1.8, tubeDia=1.3, rearLen=3.5, rearStyle='panels', frontPosts=True, tubeShape='faceted', tubeSides=5),
      dict(length=12, width=4.4, tubeDia=0.4, bodyFront=-0.5, tubeFront=2.5, tubeRear=2.5, tubeTaper=0.45, ribSpacing=0.25, bikes=8, bikeRack='both'),
      dict(wheelbase=7, track=2.4, wheelDia=1.15, frameHeight=1.25, headroom=2.5, roofOverhang=0.4, posts=8),
      dict(wheelbase=1.2, track=0.9, wheelDia=0.4, frameHeight=0.45, headroom=1.7, posts=2, roofDeck=False),
      dict(tubeBuild='lattice', tubeShape='faceted', tubeSides=6, layout='lshape', standing='packed', speakers='corners', neon=True, neonSize=1.25, roofShade='solid'),
      dict(tubeBuild='plyskin', tubeShape='faceted', tubeSides=10, layout='lshape', secondStep='driver', speakers='towers', power='generator', batteryKwh=40, frameView=True),
      dict(tubeBuild='perforated', ribStyle='none', standing='party', roofDeck=False, roofShade='cloth', endCages=True),
      dict(tubeBuild='translucent', tubeShape='faceted', tubeSides=8, ribStyle='match', ledLines=0, trailer='rollback', transportPreview=True),
      dict(tubeBuild='frame', tubeLift=0.1, tubeDia=1.3, ribSpacing=0.2, neon=True, railHeight=0.3, neonSize=1.0),
      dict(tubeBuild='sheet', tubeLift=0.6, tubeDia=0.4, wheelDia=1.1, standing='comfortable', layout='facing', trailer='drive'),
      dict(keepCab=True, tubeFront=2.5, tubeTaper=0.45, bodyFront=-0.5, tubeShape='faceted', tubeSides=7, tubeBuild='lattice'),
      dict(keepCab=False, tubeFront=0, tubeRear=0, bodyFront=2.5, tubeBuild='translucent', tubeShape='faceted', tubeSides=10),
      dict(layout='platform', headroom=1.1, roofDeck=True, roofDeckFront=0, roofDeckRear=0, frontPosts=False, speakers='corners', tubeShape='faceted', tubeSides=5, tubeBuild='perforated', tubeLift=0.6),
      dict(layout='platform', headroom=2.5, roofDeck=False, tubeShape='round', tubeLift=0.1, tubeDia=1.3, frontPosts=True, rearStyle='daiquiri', rearLen=1.5),
    ]
    for ch in ['haulster','bigfoot','mc480','npr','express','f350']:
        for c in combos:
            pg.evaluate(f"window.__artcar.setValue('chassis','{ch}'); window.__artcar.setValue('frameView',false); window.__artcar.setValue('transportPreview',false)")
            pg.evaluate(f"Object.entries({json.dumps(c)}).forEach(([k,v])=>window.__artcar.setValue(k,v))")
            r = pg.evaluate(rebuild)
            if errs: print('ERR', ch, c, errs[:3]); errs.clear()
        print(ch, 'combos ok, last:', r)
    for pid in ['haulster','bigfoot','mc480','npr','express','f350','indigo']:
        pg.select_option('#preset', pid); pg.wait_for_timeout(200)
        print('preset', pid, pg.evaluate("window.__artcar.state().chassis"), pg.evaluate("window.__artcar.state().name"))
    for v in ['hero','top','front','rear','left','right','lounge','cockpit','roof']:
        pg.evaluate(f"window.__artcar.setView('{v}', true)")
    for ch in ['haulster','bigfoot','mc480','npr','express','f350']:
        pg.evaluate(f"window.__artcar.setValue('chassis','{ch}')"); pg.evaluate("window.__artcar.rebuildNow()")
        for sel in ['#stats','#cutList','#transportInfo']:
            print(ch, sel, pg.evaluate(f"[...document.querySelectorAll('{sel} dt')].map((d,i)=>d.textContent+': '+document.querySelectorAll('{sel} dd')[i].textContent).join(' | ')"))
    print('chassisInfo:', pg.evaluate("document.getElementById('chassisInfo').innerText.replace(/\\n/g,' | ')"))
    print(errs or 'no errors')
    b.close()
