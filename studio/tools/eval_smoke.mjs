import { evaluate } from '../engine/evaluate.js';
import { starterDesign } from '../engine/state.js';
import { VEHICLE_IDS } from '../catalogs/vehicles.js';
const t0 = Date.now();
for (const id of VEHICLE_IDS) {
  const t = Date.now();
  const E = evaluate(starterDesign(id));
  const sc = E.score.map((l) => `${l.id}:${l.status[0]}`).join(' ');
  console.log(id.padEnd(16), `${Date.now() - t}ms`.padEnd(6), `riders ${E.rc.riders} build ${Math.round(E.w.buildKg * 2.2)}lb tip ${E.tip.ssf.toFixed(2)} view ${Math.round(E.view.fraction * 100)}% $${E.tiers.points.join('/')} ${E.tiers.cost}/${E.tiers.effort}`, '|', sc, '|', E.flags.map((f) => f.id).join(','));
}
console.log('total', Date.now() - t0, 'ms');
