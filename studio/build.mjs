/* Build the v2 studio: validate every catalog, bundle the ES modules with esbuild, and inline three.js, the CSS and
   the app into one self-contained, offline HTML file. Writes dist/v2/index.html and v2/index.html (for Pages served
   straight from the branch). Run from the repo root: node studio/build.mjs */
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
for (const dir of [path.join(root, 'dist', 'v2'), path.join(root, 'v2')]) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), html);
}
console.log('dist/v2/index.html', Math.round(html.length / 1024), 'KB (app', Math.round(app.length / 1024), 'KB)');
