/* Driver view: cast a grid of rays from the driver's eye across the forward view cone and count how many are
   blocked by anything the build adds (structure, upper deck, layout, design, lights). The vehicle's own pillars,
   glass and the riders don't count. Our proxy, not the DMV's rule: the DMV checks visibility at inspection. */
import { R } from '../catalogs/rules.js';
import { worldMeshes, raycast } from './scene.js';
import { degToRad } from './math.js';

const SKIP_MATS = new Set(['glass', 'beam', 'bowl']);
export function viewCone(root, g, opts = {}) {
  const eye = g.eye;
  const half = R('viewConeH'), up = R('viewConeUp'), down = R('viewConeDown'), range = R('viewConeRange');
  const skip = (o) => o.userData.layer === 'vehicle' || o.userData.layer === 'riders' || o.userData.noBox || o.userData.followsStock || (o.geo && SKIP_MATS.has(o.mat))
    || (opts.only && o.userData.layer && o.userData.layer !== 'design' && !o.userData.kit);
  const meshes = worldMeshes(root, skip).filter((m) => m.box.max[0] > eye[0] - 0.3 && m.box.min[0] < eye[0] + range);
  const rays = [];
  let blocked = 0;
  const by = {};
  const nH = 21, nV = 9;
  for (let i = 0; i < nV; i++) for (let j = 0; j < nH; j++) {
    const el = degToRad(-down + (up + down) * i / (nV - 1)), az = degToRad(-half + 2 * half * j / (nH - 1));
    const d = [Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az)];
    // rays that reach the ground before the range end stop there
    const tGround = d[1] < 0 ? eye[1] / -d[1] : Infinity;
    const tmax = Math.min(range, tGround);
    const hit = raycast(meshes, eye, d, tmax);
    // a cover hugging the stock hood only blocks what the hood already blocks: not counted
    const hugY = hit.node && hugOf(hit.node);
    const isHit = hit.t < tmax - 1e-6 && hit.t > 0.12 && !(hugY != null && eye[1] + d[1] * hit.t <= hugY + 0.08);
    if (isHit) {
      blocked++;
      const owner = ownerOf(hit.node);
      by[owner] = (by[owner] || 0) + 1;
    }
    rays.push({ d, t: isHit ? hit.t : tmax, hit: isHit });
  }
  const total = nH * nV;
  const blockers = Object.entries(by).sort((a, b) => b[1] - a[1]).map(([name, n]) => ({ name, share: n / total }));
  return { eye, fraction: blocked / total, rays, blockers, grid: [nH, nV] };
}
function hugOf(n) { for (let o = n; o; o = o.parent) if (o.userData.hugY != null) return o.userData.hugY; return null; }
function ownerOf(n) {
  let o = n;
  while (o) {
    if (o.userData.kit) return o.name || o.userData.kit;
    if (o.userData.layer) return { structure: 'structure', upper: 'upper deck', layout: 'layout', design: 'design', lights: 'lights and sound' }[o.userData.layer] || o.userData.layer;
    o = o.parent;
  }
  return 'build';
}
