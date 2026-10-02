"""Shared Playwright setup for the v2 studio tests (dist/index.html)."""
import pathlib
from playwright.sync_api import sync_playwright
ROOT = pathlib.Path(__file__).resolve().parent.parent
PAGE = (ROOT / 'dist' / 'index.html').as_uri()
ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
IGNORE = ('ERR_CERT', 'net::ERR', '403', 'fonts.g', 'Creating normalized normal attribute')   # web fonts can't load offline; that's expected

def open_studio(p, width=1440, height=900, hash=''):
    b = p.chromium.launch(args=ARGS)
    ctx = b.new_context(viewport={'width': width, 'height': height}, accept_downloads=True)
    pg = ctx.new_page()
    errs = []
    pg.on('pageerror', lambda e: errs.append(f'PAGEERROR: {e}'))
    pg.on('console', lambda m: errs.append(f'{m.type}: {m.text}') if m.type in ('error', 'warning') and not any(s in m.text for s in IGNORE) else None)
    pg.goto(PAGE + hash)
    pg.wait_for_function('window.__studio && window.__studio.ready', timeout=180000)
    return b, pg, errs

def settle(pg, cond='true', ms=200):
    pg.wait_for_function(f"window.__studio.store.E && ({cond})", timeout=120000)
    pg.wait_for_timeout(ms)
