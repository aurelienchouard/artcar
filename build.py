"""Build dist/index.html: one self-contained, offline page (three.js, the app and the concept image inlined)."""
import base64, pathlib
root = pathlib.Path(__file__).parent
src = root / 'src'
tpl = (src / 'index.template.html').read_text()
css = (src / 'style.css').read_text()
three = (root / 'vendor' / 'three-bundle.js').read_text().replace('</script', '<\\/script')
app = '(function(){\n' + (src / 'app-data.js').read_text() + '\n' + (src / 'app-model.js').read_text() + '\n' + (src / 'app-main.js').read_text() + '\n})();'
assert '</script' not in app
concept = 'data:image/jpeg;base64,' + base64.b64encode((root / 'assets' / 'concept.jpg').read_bytes()).decode()
out = tpl.replace('/*__CSS__*/', css).replace('__CONCEPT__', concept)
out = out.replace('<script>/*__THREE__*/</script>', '<script>' + three + '</script>')
out = out.replace('<script>/*__APP__*/</script>', '<script>' + app + '</script>')
(root / 'dist').mkdir(exist_ok=True)
(root / 'dist' / 'index.html').write_text(out)
# Same page at the repo root, so GitHub Pages serves the studio even when it deploys straight from the branch.
(root / 'index.html').write_text(out)
print('dist/index.html', len(out) // 1024, 'KB')
