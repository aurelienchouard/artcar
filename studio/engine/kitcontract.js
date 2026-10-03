/* The kit contract (section 5.6), evaluated by the engine for any kit on any design:
   envelope (the boxes it occupies), weight, driverView (blocked share with only this kit), transport pieces. */
import { evaluate } from './evaluate.js';
import { boundsOf } from './scene.js';
import { kitDefaults } from './state.js';
import { KITS } from '../catalogs/kits.js';
import { viewCone } from './viewcone.js';
import { kitPieces } from './model/kits.js';
import { MATERIALS } from '../catalogs/materials.js';
import { TUBE_BUILDS, BUILDS } from '../catalogs/kits.js';

const clone = (o) => JSON.parse(JSON.stringify(o));
function withKit(design, id, p) {
  const k = KITS[id], d = clone(design);
  d.kits = { body: { id, p: { ...kitDefaults(id), ...(p || {}) } } };
  if (k.requires?.structure && !k.requires.structure.includes(d.structure.style)) d.structure.style = k.requires.structure[0];
  return d;
}
export function kitContract(id) {
  const k = KITS[id];
  const run = (design, p) => evaluate(withKit(design, id, p), { viewCone: false });
  const result = (E) => (k.builtin ? null : E.g.kitResults.find((r) => r.id === id));
  return {
    envelope(design, p) {
      const E = run(design, p);
      if (k.builtin) {
        let node = null;
        E.model.root.traverse((o) => { if (!node && o.userData.kit === id) node = o; });
        const b = node ? boundsOf(node) : null;
        return b && !b.empty() ? [{ min: b.min, max: b.max }] : [];
      }
      const r = result(E);
      return r && !r.bounds.empty() ? [{ min: r.bounds.min, max: r.bounds.max }] : [];
    },
    weight(design, p) {
      const E = run(design, p);
      if (k.builtin) {
        const b = k.builtin === 'tubes' ? E.g.builtinBom.tubes : E.g.builtinBom.covers;
        return Object.entries(b).reduce((a, [key, v]) => a + v * ({ hoop: 1.1, ribPly: 10.8, plyBend: 3.0, alu: 2.7, perf: 2.6, poly: 3.6, acm: 3.8 }[key] || 0), 0) * 1.06;
      }
      return result(E)?.kg || 0;
    },
    driverView(design, p) {
      const E = run(design, p);
      const v = viewCone(E.model.root, E.g, { only: true });
      return { blocked: v.fraction };
    },
    pieces(design, p) {
      const E = run(design, p);
      if (k.builtin) return E.teardown.pieces.filter((x) => x.group === 'Design');
      const r = result(E);
      return r ? kitPieces(r, k) : [];
    },
    materials: k.materials,
    tiers(p) {
      const m = MATERIALS[(p || {}).material] || BUILDS[(p || {}).build], tb = k.builtin === 'tubes' ? TUBE_BUILDS[(p || {}).build] : null;
      return { cost: Math.max(k.costTier, m ? m.cost : 0, tb ? tb.cost : 0), effort: Math.max(k.effortTier, m ? m.effort : 0, tb ? tb.effort : 0) };
    },
  };
}
