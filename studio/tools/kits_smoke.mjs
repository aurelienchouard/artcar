import { buildCar } from '../engine/model/car.js';
import { starterDesign, params, kitDefaults } from '../engine/state.js';
import { VEHICLES } from '../catalogs/vehicles.js';
import { KITS } from '../catalogs/kits.js';
const t0 = Date.now(); let n = 0; const rows = [];
for (const kit of Object.values(KITS)) {
  if (kit.builtin) continue;
  const line = [];
  for (const vid of ['haulster', 'express', 'npr', 'f350', 'mc480']) {
    const d = starterDesign(vid);
    d.kits[kit.category] = { id: kit.id, p: kitDefaults(kit.id) };
    if (kit.requires?.structure) d.structure.style = kit.requires.structure[0];
    const s = params(d);
    const { geom } = buildCar(s, VEHICLES[vid]);
    const r = geom.kitResults.find((k) => k.id === kit.id);
    if (!r) { line.push(`${vid}:inactive`); continue; }
    let meshes = 0; r.node.traverse((o) => { if (o.geo) meshes++; });
    line.push(`${vid}:${Math.round(r.kg)}kg/${meshes}`);
    n++;
  }
  rows.push(kit.id.padEnd(18) + line.join('  '));
}
console.log(rows.join('\n')); console.log(n, 'builds', Date.now() - t0, 'ms');
