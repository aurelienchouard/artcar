import test from 'node:test';
import assert from 'node:assert/strict';
import { validateCatalogs } from '../catalogs/schema.js';
import { KITS } from '../catalogs/kits.js';
import { kitContract } from '../engine/kitcontract.js';
import { starterDesign } from '../engine/state.js';

test('every catalog entry passes the schema', () => {
  const errs = validateCatalogs();
  assert.deepEqual(errs, []);
});

test('every kit declares the full kit contract and it evaluates', () => {
  for (const [id, k] of Object.entries(KITS)) {
    const vid = k.platforms.includes('cutaway') ? 'express' : 'haulster';
    const d = starterDesign(vid);
    const c = kitContract(id);
    const env = c.envelope(d, {});
    assert.ok(Array.isArray(env) && env.length >= 1, `${id} envelope`);
    const kg = c.weight(d, {});
    assert.ok(kg > 0 && kg < 1500, `${id} weight ${kg}`);
    const v = c.driverView(d, {});
    assert.ok(v.blocked >= 0 && v.blocked <= 1, `${id} driver view`);
    const pieces = c.pieces(d, {});
    assert.ok(pieces.length >= 1 && pieces.every((p) => p.kg >= 0 && p.people >= 1 && p.name), `${id} pieces`);
    assert.ok(c.materials.length >= 1 && k.look.day && k.look.night && k.riderOpenings && k.wheelClearance, `${id} data fields`);
    const t = c.tiers({});
    assert.ok(t.cost >= 1 && t.cost <= 3 && t.effort >= 1 && t.effort <= 3, `${id} tiers`);
  }
});
