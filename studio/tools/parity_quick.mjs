import fs from 'node:fs';
import { buildCar } from '../engine/model/car.js';
import { buildWeights } from '../engine/weight.js';
import { riderCount } from '../engine/riders.js';
import { tipping } from '../engine/tipping.js';
import { VEHICLES } from '../catalogs/vehicles.js';
import { fromV1, params } from '../engine/state.js';
const VIA = process.argv.includes('--via-state');
const fx = JSON.parse(fs.readFileSync(new URL('../test/fixtures/v1-parity.json', import.meta.url)));
let bad = 0;
const t0 = Date.now();
for (const c of fx.cases) {
  const s = VIA ? params(fromV1(c.state)) : c.state, C = VEHICLES[s.chassis];
  const { geom: g } = buildCar(s, C);
  const w = buildWeights(g, s, C), rc = riderCount(g, C, w.buildKg), tip = tipping(g, s, C, w.items, rc);
  const i = c.info;
  const got = { seatsLow: g.seatsLow, seatsRoof: g.seatsRoof, standLow: g.standLow, standRoof: g.standRoof, buildKg: +w.buildKg.toFixed(3), cap: rc.cap, ssf: +tip.ssf.toFixed(4), bikes: g.bikeCount };
  const want = { seatsLow: i.seatsLow, seatsRoof: i.seatsRoof, standLow: i.standLow, standRoof: i.standRoof, buildKg: +i.buildKg.toFixed(3), cap: i.riderCap, ssf: +i.tip.ssf.toFixed(4), bikes: i.bikeCount };
  const diff = Object.keys(got).filter((k) => Math.abs(got[k] - want[k]) > (k === 'buildKg' ? 0.01 : k === 'ssf' ? 2e-4 : 0));
  if (diff.length) { bad++; if (bad < 8) console.log(c.case, diff.map((k) => `${k} ${got[k]} vs ${want[k]}`).join('; ')); }
}
console.log(fx.cases.length - bad, '/', fx.cases.length, 'match;', Date.now() - t0, 'ms');
