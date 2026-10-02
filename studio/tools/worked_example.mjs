import { evaluate } from '../engine/evaluate.js';
import { starterDesign } from '../engine/state.js';
import { fmtLen, fmtInches } from '../engine/units.js';
for (const id of ['express', 'npr', 'f350']) {
  const d = starterDesign(id);
  Object.assign(d.upper, { kind: 'stand', headroom: 1.9558, railsRemovable: true, roofRemovable: false });
  d.transport.trailer = 'stepdeck';
  const E = evaluate(d, { viewCone: false });
  const o = E.tr.chosen;
  console.log(id, 'deck', fmtLen(E.g.deckY), 'haul', fmtLen(o.haulH), o.margins.height >= 0 ? fmtInches(o.margins.height) + ' to spare' : fmtInches(-o.margins.height) + ' over', 'packH', E.tr.packH.toFixed(4));
}
