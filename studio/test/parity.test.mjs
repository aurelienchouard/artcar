/* Milestone 1 acceptance: v1 starters (and every v1 stress combo) reproduce their v1 numbers. The model runs in v1
   mode here (s.v1): it keeps the few behaviors v2 changed on purpose, which have tests of their own. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildCar } from '../engine/model/car.js';
import { buildWeights } from '../engine/weight.js';
import { riderCount } from '../engine/riders.js';
import { tipping } from '../engine/tipping.js';
import { boundsOf } from '../engine/scene.js';
import { VEHICLES } from '../catalogs/vehicles.js';
import { fromV1, params } from '../engine/state.js';

const fx = JSON.parse(fs.readFileSync(new URL('./fixtures/v1-parity.json', import.meta.url)));
for (const c of fx.cases) {
  test(`v1 parity ${c.case}`, () => {
    // v1 mode keeps the behaviors v2 deliberately changed (front frame, hatch spot, entry steps, speakers, neon)
    const s = { ...params(fromV1(c.state)), v1: true }, C = VEHICLES[s.chassis];
    const { root, geom: g } = buildCar(s, C);
    const w = buildWeights(g, s, C), rc = riderCount(g, C, w.buildKg), tip = tipping(g, s, C, w.items, rc);
    const i = c.info;
    assert.equal(g.seatsLow, i.seatsLow, 'seats below');
    assert.equal(g.seatsRoof, i.seatsRoof, 'seats on the roof');
    assert.equal(g.standLow, i.standLow, 'standing below');
    assert.equal(g.standRoof, i.standRoof, 'standing on the roof');
    assert.equal(g.bikeCount, i.bikeCount, 'bikes');
    // v2 drops tube rings and LED lines that v1 let clip the wheel envelope, so tube weight may be a hair lighter
    const tol = c.case.startsWith('starter') ? 0.01 : 0.03;   // stress combos include giant tubes hugging the ground
    assert.ok(Math.abs(w.buildKg - i.buildKg) <= tol * i.buildKg, `build ${w.buildKg} vs ${i.buildKg}`);
    for (const k of Object.keys(i.kg)) assert.ok(Math.abs(w.kg[k] - i.kg[k]) <= 0.03 * Math.max(1, i.kg[k]), `kg.${k} ${w.kg[k]} vs ${i.kg[k]}`);
    assert.ok(Math.abs(rc.cap - i.riderCap) <= 1, `rider cap ${rc.cap} vs ${i.riderCap}`);
    assert.ok(Math.abs(tip.ssf - i.tip.ssf) < 2e-3, `tipping ${tip.ssf} vs ${i.tip.ssf}`);
    const b = boundsOf(root, (o) => o.userData.layer === 'riders' || o.userData.noBox);
    for (let k = 0; k < 3; k++) for (const e of ['min', 'max']) assert.ok(Math.abs(b[e][k] - c.bbox[e][k]) < 0.01, `bounds ${e}[${k}] ${b[e][k]} vs ${c.bbox[e][k]}`);
  });
}
