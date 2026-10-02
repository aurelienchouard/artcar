/* Section 9: each card's preset raises its listed flags; each nearest buildable raises no red flags. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluate } from '../engine/evaluate.js';
import { CARDS } from '../catalogs/cards.js';
for (const c of CARDS) {
  test(`card ${c.id}: preset shows what breaks`, () => {
    const E = evaluate(c.preset());
    for (const x of c.expect) assert.ok(E.flagIds.has(x.id), `${c.id} should flag ${x.id}`);
  });
  test(`card ${c.id}: nearest buildable has no red flags`, () => {
    const E = evaluate(c.nearest.preset());
    assert.deepEqual(E.red, []);
  });
}
