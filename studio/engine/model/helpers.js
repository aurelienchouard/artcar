/* Layout helpers: interval and rectangle arithmetic, people packing, curtain meshes. */
import { Vec3, TAU, clamp, lerp, degToRad, radToDeg } from '../math.js';
import { mesh, box, rbox, cylX, ringX, rod, group, geo, Node, scaleUV, meshGeo, UP } from './prims.js';

/* ------------------------------------------------------------------ layout helpers */
export function intervalsMinus(list, a, b) {
  const out = [];
  for (const [x0, x1] of list) {
    if (b <= x0 || a >= x1) { out.push([x0, x1]); continue; }
    if (a > x0) out.push([x0, a]);
    if (b < x1) out.push([b, x1]);
  }
  return out;
}
export const overlap1 = (a0, a1, b0, b1) => a1 > b0 + 1e-6 && b1 > a0 + 1e-6;
/* Rectangle [x0, x1, z0, z1] minus holes, as a list of rectangles. */
export function rectMinus(r, holes) {
  const hs = holes.filter((h) => overlap1(r[0], r[1], h[0], h[1]) && overlap1(r[2], r[3], h[2], h[3]));
  const xs = new Set([r[0], r[1]]);
  hs.forEach((h) => { xs.add(clamp(h[0], r[0], r[1])); xs.add(clamp(h[1], r[0], r[1])); });
  const xl = [...xs].sort((a, b) => a - b), out = [];
  for (let i = 0; i < xl.length - 1; i++) {
    const x0 = xl[i], x1 = xl[i + 1];
    if (x1 - x0 < 1e-3) continue;
    const xm = (x0 + x1) / 2;
    let zs = [[r[2], r[3]]];
    hs.forEach((h) => { if (xm > h[0] && xm < h[1]) zs = intervalsMinus(zs, h[2], h[3]); });
    zs.forEach(([z0, z1]) => { if (z1 - z0 > 1e-3) out.push([x0, x1, z0, z1]); });
  }
  return out;
}
/* A seat run has its back line at `c` on the cross axis, spans [s0, s1] along `axis`, and faces `dir` (±1) across. */
export function splitRun(run, depth, rects) {
  const c0 = Math.min(run.c, run.c + run.dir * depth), c1 = Math.max(run.c, run.c + run.dir * depth);
  let parts = [[run.s0, run.s1]];
  for (const r of rects) {
    const [a0, a1, b0, b1] = run.axis === 'x' ? [r[0], r[1], r[2], r[3]] : [r[2], r[3], r[0], r[1]];
    if (overlap1(c0, c1, b0, b1)) parts = intervalsMinus(parts, a0, a1);
  }
  return parts.filter(([a, b]) => b - a > 0.55).map(([a, b]) => ({
    a: run.axis === 'x' ? [a, run.c] : [run.c, a],
    b: run.axis === 'x' ? [b, run.c] : [run.c, b],
    inward: run.axis === 'x' ? [0, run.dir] : [run.dir, 0],
    cornerA: run.cornerLo && Math.abs(a - run.s0) < 1e-6,
    cornerB: run.cornerHi && Math.abs(b - run.s1) < 1e-6,
    pillows: run.pillows,
  }));
}
export function slabs(rects, y, t, mat, parent) {
  rects.forEach(([x0, x1, z0, z1]) => box(x1 - x0, t, z1 - z0, mat, (x0 + x1) / 2, y - t / 2, (z0 + z1) / 2, parent));
}
/* Greedy packing of people at a given floor area each, avoiding blocked rectangles. */
export function packPoints(x0, x1, z0, z1, area, blocked, pad = 0.14) {
  const p = Math.sqrt(area * 1.12), placed = [];
  for (let z = z0; z <= z1 + 1e-6; z += 0.08) for (let x = x0; x <= x1 + 1e-6; x += 0.08) {
    if (blocked.some((r) => x > r[0] - pad && x < r[1] + pad && z > r[2] - pad && z < r[3] + pad)) continue;
    if (placed.some(([px, pz]) => (px - x) ** 2 + (pz - z) ** 2 < p * p)) continue;
    placed.push([x, z]);
  }
  return placed;
}

/* Gathered, tied-back curtain panel. Hangs from y = height down to 0 and extends along +X from the post. */
export function curtainGeometry(width, height) {
  const nu = 20, nv = 18, pos = [], uv = [], idx = [];
  const tie = 0.42;
  for (let j = 0; j <= nv; j++) {
    const v = j / nv;
    const w = v > tie ? width * (0.18 + 0.82 * Math.pow((v - tie) / (1 - tie), 1.4)) : width * (0.18 + 0.32 * Math.pow((tie - v) / tie, 0.8));
    const amp = 0.02 + 0.05 * (w / width);
    for (let i = 0; i <= nu; i++) {
      const u = i / nu;
      pos.push(u * w, v * height, amp * Math.sin(u * Math.PI * 7));
      uv.push(u, v);
    }
  }
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
    const a = j * (nu + 1) + i, b = a + 1, c = a + nu + 1, d = c + 1;
    idx.push(a, b, d, a, d, c);
  }
  return meshGeo(pos, idx, uv);
}

export function drawnCurtainGeometry(width, height) {
  const nu = Math.max(8, Math.round(width * 14)), nv = 6, pos = [], uv = [], idx = [];
  for (let j = 0; j <= nv; j++) {
    const v = j / nv;
    for (let i = 0; i <= nu; i++) {
      const u = i / nu;
      pos.push(u * width, v * height, (0.022 + 0.012 * (1 - v)) * Math.sin(u * width * Math.PI * 9));
      uv.push(u, v);
    }
  }
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
    const a = j * (nu + 1) + i, b = a + 1, c = a + nu + 1, d = c + 1;
    idx.push(a, b, d, a, d, c);
  }
  return meshGeo(pos, idx, uv);
}

/* Merge neighboring roof segments of the same kind and drop slivers. */
export function mergeSegs(segs) {
  const out = [];
  for (const g of segs) {
    if (g.x1 - g.x0 < 1e-3) continue;
    const last = out[out.length - 1];
    if (last && last.kind === g.kind && Math.abs(last.x1 - g.x0) < 1e-6) last.x1 = g.x1;
    else out.push({ ...g });
  }
  return out;
}

/* Drop every design part with a face inside the wheel envelope (tire plus travel, front wheels swept to full lock).
   Lofted shells are already culled face by face; this catches tube rings, LED lines and members on facet edges. */
import { eachWorldMesh, geoMesh } from '../scene.js';
import { Vec3 as V } from '../math.js';
export function pruneInEnvelope(root, zones, cutY) {
  const inside = (x, y, z) => zones.some((w) => y < cutY - 0.005 && x > w.x0 + 0.005 && x < w.x1 - 0.005 && Math.abs(z) > w.zIn + 0.005 && Math.abs(z) < w.zOut - 0.005);
  const xs = [Math.min(...zones.map((w) => w.x0)), Math.max(...zones.map((w) => w.x1))];
  const doomed = [];
  const v = new V();
  eachWorldMesh(root, (n, m) => {
    if (n.geo.type === 'Mesh' || n.userData.followsStock) return;
    const { pos, idx } = geoMesh(n.geo);
    const w = [];
    let lo = Infinity, hi = -Infinity, yLo = Infinity;
    for (let i = 0; i < pos.length; i += 3) { v.set(pos[i], pos[i + 1], pos[i + 2]).applyMatrix4(m); w.push(v.x, v.y, v.z); lo = Math.min(lo, v.x); hi = Math.max(hi, v.x); yLo = Math.min(yLo, v.y); }
    if (hi < xs[0] || lo > xs[1] || yLo > cutY) return;
    for (let t = 0; t < idx.length; t += 3) {
      const a = idx[t] * 3, b = idx[t + 1] * 3, c = idx[t + 2] * 3;
      if (inside((w[a] + w[b] + w[c]) / 3, (w[a + 1] + w[b + 1] + w[c + 1]) / 3, (w[a + 2] + w[b + 2] + w[c + 2]) / 3)) { doomed.push(n); return; }
    }
  });
  for (const n of doomed) { const p = n.parent; if (p) p.children.splice(p.children.indexOf(n), 1); }
  return doomed.length;
}
