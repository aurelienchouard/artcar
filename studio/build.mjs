/* Build the v2 studio: validate every catalog, bundle the ES modules with esbuild, and inline three.js, the CSS and
   the app into one self-contained, offline HTML file. Writes dist/index.html and index.html (for Pages served
   straight from the branch); /v2/ redirects to the root so old links keep working. Run from the repo root:
   node studio/build.mjs */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';
import { validateCatalogs } from './catalogs/schema.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const errs = validateCatalogs();
if (errs.length) { console.error('Catalog errors:\n' + errs.map((e) => '  ' + e).join('\n')); process.exit(1); }

const res = await esbuild.build({ entryPoints: [path.join(here, 'main.js')], bundle: true, format: 'iife', write: false, target: ['es2020'], minify: process.argv.includes('--minify'), legalComments: 'none' });
const app = res.outputFiles[0].text.replace(/<\/script/g, '<\\/script');
const three = fs.readFileSync(path.join(root, 'vendor', 'three-bundle.js'), 'utf8').replace(/<\/script/g, '<\\/script');
const css = fs.readFileSync(path.join(here, 'style.css'), 'utf8');
let html = fs.readFileSync(path.join(here, 'index.html'), 'utf8');
html = html.replace('/*__CSS__*/', () => css).replace('<script>/*__THREE__*/</script>', () => `<script>${three}</script>`).replace('<script>/*__APP__*/</script>', () => `<script>${app}</script>`);
const redirect = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Art Car Studio</title>
<meta http-equiv="refresh" content="0; url=../"><script>location.replace('../' + location.hash)</script></head>
<body><p>Art Car Studio moved to <a href="../">the main address</a>.</p></body></html>
`;
for (const dir of [path.join(root, 'dist'), root]) {
  fs.mkdirSync(path.join(dir, 'v2'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), html);
  fs.writeFileSync(path.join(dir, 'v2', 'index.html'), redirect);
}
console.log('dist/index.html', Math.round(html.length / 1024), 'KB (app', Math.round(app.length / 1024), 'KB)');
