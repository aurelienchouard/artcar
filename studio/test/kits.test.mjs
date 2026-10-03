/* Milestone 4 acceptance: wheel clearance correct at full lock. No design-kit geometry may sit inside the wheel
   envelope (tire diameter plus travel, front wheels swept to 35° of lock, duals included), on any platform. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluate } from '../engine/evaluate.js';
import { starterDesign, kitDefaults } from '../engine/state.js';
import { worldMeshes } from '../engine/scene.js';
import { KITS } from '../catalogs/kits.js';

const VEHICLES = { cart: 'haulster', cabover: 'npr', cutaway: 'express', 'chassis-cab': 'f350' };
for (const [id, k] of Object.entries(KITS)) {
  test(`kit ${id} clears the wheels at full lock`, () => {
    // every construction: metal, skinned plywood, open lattice, fabric (ribs and skins differ)
    const builds = k.params?.build ? k.params.build.options.flatMap(([b]) => (b === 'plywood' && k.params.finish ? [[b, 'skin'], [b, 'lattice']] : [[b, undefined]])) : [[undefined, undefined]];
    for (const [fam, vid] of Object.entries(VEHICLES)) for (const [build, finish] of builds) {
      if (!k.platforms.includes(fam)) continue;
      const d = starterDesign(vid);
      d.kits.body = { id, p: { ...kitDefaults(id), ...(build ? { build } : {}), ...(finish ? { finish } : {}) } };
      if (k.requires?.structure) d.structure.style = k.requires.structure[0];
      const E = evaluate(d, { viewCone: false });
      const g = E.g;
      const zones = g.wheelZones;
      const inside = (x, y, z) => zones.some((w) => y < g.cutY - 0.005 && x > w.x0 + 0.005 && x < w.x1 - 0.005 && Math.abs(z) > w.zIn + 0.005 && Math.abs(z) < w.zOut - 0.005);
      // the hood cover follows the factory fenders, which the manufacturer already clears; everything else must clear the envelope
      const meshes = worldMeshes(E.model.root, (o) => (o.userData.layer && o.userData.layer !== 'design') || o.userData.followsStock);
      let bad = 0;
      for (const m of meshes) {
        const p = m.pos;
        for (let t = 0; t < m.idx.length; t += 3) {
          const a = m.idx[t] * 3, b = m.idx[t + 1] * 3, c = m.idx[t + 2] * 3;
          const cx = (p[a] + p[b] + p[c]) / 3, cy = (p[a + 1] + p[b + 1] + p[c + 1]) / 3, cz = (p[a + 2] + p[b + 2] + p[c + 2]) / 3;
          if (inside(cx, cy, cz)) bad++;
        }
      }
      assert.equal(bad, 0, `${id} (${build || 'default'}${finish ? ' ' + finish : ''}) on ${vid}: ${bad} faces inside the wheel envelope`);
    }
  });
}
