import fs from 'node:fs';
import { buildCar } from '../engine/model/car.js';
import { boundsOf } from '../engine/scene.js';
import { VEHICLES } from '../catalogs/vehicles.js';
const fx = JSON.parse(fs.readFileSync(new URL('../test/fixtures/v1-parity.json', import.meta.url)));
let worst = 0, worstCase = '', n = 0;
const t0 = Date.now();
for (const c of fx.cases) {
  const s = c.state, C = VEHICLES[s.chassis];
  const { root } = buildCar(s, C);
  const skip = (o) => o.userData.layer === 'riders' || o.userData.noBox;
  const b = boundsOf(root, skip);
  for (let k = 0; k < 3; k++) for (const e of ['min', 'max']) {
    const d = Math.abs(b[e][k] - c.bbox[e][k]);
    if (d > worst) { worst = d; worstCase = `${c.case} ${e}[${k}] ${b[e][k].toFixed(4)} vs ${c.bbox[e][k].toFixed(4)}`; }
    if (d > 0.01) n++;
  }
}
console.log('worst', worst.toFixed(5), worstCase, 'over 1cm:', n, Date.now() - t0, 'ms');
