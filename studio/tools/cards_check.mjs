import { evaluate } from '../engine/evaluate.js';
import { CARDS } from '../catalogs/cards.js';
import { STARTERS } from '../catalogs/starters.js';
for (const c of CARDS) {
  const E = evaluate(c.preset()), N = evaluate(c.nearest.preset());
  const miss = c.expect.filter((x) => !E.flagIds.has(x.id)).map((x) => x.id);
  const nBad = c.expect.filter((x) => N.flagIds.has(x.id)).map((x) => x.id);
  console.log(c.id.padEnd(14), 'preset flags:', [...E.flagIds].join(','), '| missing:', miss.join(',') || '-');
  console.log(''.padEnd(14), 'nearest red:', N.red.join(',') || '-', '| nearest has listed:', nBad.join(',') || '-', '| flags:', [...N.flagIds].join(','));
}
const P = evaluate(STARTERS.find((s) => s.id === 'pinguina').build());
console.log('pinguina', 'len', P.dmv.length.toFixed(2), 'm =', (P.dmv.length / 0.3048).toFixed(1), 'ft; height', (P.dims.playa.max[1] / 0.3048).toFixed(1), 'ft; cost', P.tiers.cost, 'effort', P.tiers.effort, P.tiers.points, 'riders', P.rc.riders, 'red', P.red, 'flags', [...P.flagIds]);
