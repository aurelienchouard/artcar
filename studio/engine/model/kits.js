/* Build the active design kits (other than the two built into the v1 model: side tubes and the hood cover). */
import { group } from './prims.js';
import { makeToolbox, kitKg } from './parts.js';
import { boundsOf } from '../scene.js';
import { R } from '../../catalogs/rules.js';

export function buildKits(parent, kits, car) {
  const out = [];
  for (const k of kits) {
    if (k.def.builtin) continue;
    const g = group(k.def.name); g.userData.kit = k.id; parent.add(g);
    const acc = { area: {}, length: {}, kg: 0, ledLen: 0, cut: {} };
    const T = makeToolbox(car, g, acc);
    k.def.parts(T, k.p);
    const kg = kitKg(acc);
    const b = boundsOf(g);
    const y = b.empty() ? car.deckY : (b.min[1] + b.max[1]) / 2;
    out.push({ id: k.id, slot: k.slot, kg, y, area: acc.area, length: acc.length, ledLen: acc.ledLen, cut: acc.cut, node: g, bounds: b });
  }
  return out;
}
/* Removable pieces of a kit for the teardown plan: named sub-groups, else sections about 4′ long. */
export function kitPieces(r, def) {
  const named = r.node.children.filter((c) => c.userData.piece);
  const pieces = [];
  let rest = r.kg;
  for (const c of named) {
    const share = Math.min(rest, r.kg * 0.25);
    pieces.push({ name: `${def.name}: ${c.userData.piece.toLowerCase()}`, kg: share, people: Math.max(1, Math.ceil(share / R('liftPerPerson'))) });
    rest -= share;
  }
  const len = r.bounds.empty() ? 1 : r.bounds.max[0] - r.bounds.min[0];
  const n = Math.max(1, Math.round(len / 1.22));
  for (let i = 0; i < n; i++) pieces.push({ name: `${def.name}, section ${i + 1} of ${n}`, kg: rest / n, people: Math.max(1, Math.ceil(rest / n / R('liftPerPerson'))) });
  return pieces;
}
