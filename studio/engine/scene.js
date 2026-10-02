/* A three-free scene description. The model emits a tree of Nodes, each optionally carrying a geometry descriptor
   ({ type, args }) and a material key. Builders turn the tree into three.js objects one to one; the engine uses the
   same tree to measure bounds and cast view rays. Vertex layouts follow three.js r169 so bounds match the v1 model. */
import { Vec3, Quat, Mat4, Box, TAU } from './math.js';

class Euler {
  constructor() { this.x = 0; this.y = 0; this.z = 0; }
  set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
}

export class Node {
  constructor(geo = null, mat = null) {
    this.geo = geo; this.mat = mat; this.children = []; this.parent = null;
    this.position = new Vec3(); this.rotation = new Euler(); this.quaternion = new Quat(); this.scale = new Vec3(1, 1, 1);
    this.name = ''; this.userData = {}; this.castShadow = true; this.receiveShadow = true;
  }
  get isMesh() { return !!this.geo; }
  add(...cs) { for (const c of cs) { c.parent = this; this.children.push(c); } return this; }
  traverse(fn) { fn(this); for (const c of this.children) c.traverse(fn); }
  localMatrix() {
    const q = this.quaternion.used ? this.quaternion : new Quat().setFromEuler(this.rotation.x, this.rotation.y, this.rotation.z);
    return new Mat4().compose(this.position, q, this.scale);
  }
}
export const group = (name) => { const g = new Node(); g.name = name; return g; };
export const geo = (type, ...args) => ({ type, args });

/* ------------------------------------------------------------------ vertex generation */
function gridIdx(cols, rows, idx, wrap = false) {
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const a = j * (cols + 1) + i, b = a + 1, c = a + cols + 1, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  return idx;
}
function boxMesh(w, h, d) {
  const x = w / 2, y = h / 2, z = d / 2, pos = [];
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) pos.push(sx * x, sy * y, sz * z);
  const idx = [0, 1, 3, 0, 3, 2, 4, 6, 7, 4, 7, 5, 0, 4, 5, 0, 5, 1, 2, 3, 7, 2, 7, 6, 0, 2, 6, 0, 6, 4, 1, 5, 7, 1, 7, 3];
  return { pos, idx };
}
function cylinderMesh(rt, rb, h, rs = 32, hs = 1, open = false, t0 = 0, tl = TAU) {
  rs = Math.max(3, Math.floor(rs)); hs = Math.max(1, Math.floor(hs));
  const pos = [], idx = [];
  for (let y = 0; y <= hs; y++) {
    const v = y / hs, r = v * (rb - rt) + rt;
    for (let x = 0; x <= rs; x++) { const th = x / rs * tl + t0; pos.push(r * Math.sin(th), -v * h + h / 2, r * Math.cos(th)); }
  }
  gridIdx(rs, hs, idx);
  if (!open) for (const top of [true, false]) {
    const r = top ? rt : rb, yy = top ? h / 2 : -h / 2;
    if (r <= 0) continue;
    const c = pos.length / 3; pos.push(0, yy, 0);
    const s = pos.length / 3;
    for (let x = 0; x <= rs; x++) { const th = x / rs * tl + t0; pos.push(r * Math.sin(th), yy, r * Math.cos(th)); }
    for (let x = 0; x < rs; x++) idx.push(c, s + x, s + x + 1);
  }
  return { pos, idx };
}
function torusMesh(R, r, rs = 12, ts = 48, arc = TAU) {
  const pos = [], idx = [];
  for (let j = 0; j <= rs; j++) for (let i = 0; i <= ts; i++) {
    const u = i / ts * arc, v = j / rs * TAU;
    pos.push((R + r * Math.cos(v)) * Math.cos(u), (R + r * Math.cos(v)) * Math.sin(u), r * Math.sin(v));
  }
  return { pos, idx: gridIdx(ts, rs, idx) };
}
function sphereMesh(r, ws = 32, hs = 16, p0 = 0, pl = TAU, t0 = 0, tl = Math.PI) {
  ws = Math.max(3, Math.floor(ws)); hs = Math.max(2, Math.floor(hs));
  const pos = [], idx = [];
  for (let y = 0; y <= hs; y++) {
    const v = y / hs;
    for (let x = 0; x <= ws; x++) {
      const u = x / ws;
      pos.push(-r * Math.cos(p0 + u * pl) * Math.sin(t0 + v * tl), r * Math.cos(t0 + v * tl), r * Math.sin(p0 + u * pl) * Math.sin(t0 + v * tl));
    }
  }
  return { pos, idx: gridIdx(ws, hs, idx) };
}
function capsuleMesh(r, len, cs = 4, rs = 8) {
  const prof = [];   // [radius, y] from bottom to top, like three's lathe path
  for (let i = 0; i <= cs; i++) { const a = -Math.PI / 2 + (i / cs) * Math.PI / 2; prof.push([r * Math.cos(a), -len / 2 + r * Math.sin(a)]); }
  for (let i = 0; i <= cs; i++) { const a = (i / cs) * Math.PI / 2; prof.push([r * Math.cos(a), len / 2 + r * Math.sin(a)]); }
  const pos = [], idx = [];
  for (let j = 0; j < prof.length; j++) for (let i = 0; i <= rs; i++) {
    const th = i / rs * TAU; pos.push(prof[j][0] * Math.sin(th), prof[j][1], prof[j][0] * Math.cos(th));
  }
  return { pos, idx: gridIdx(rs, prof.length - 1, idx) };
}
function planeMesh(w, h) { return { pos: [-w / 2, h / 2, 0, w / 2, h / 2, 0, -w / 2, -h / 2, 0, w / 2, -h / 2, 0], idx: [0, 2, 1, 2, 3, 1] }; }
function circleMesh(r, segs = 32, t0 = 0, tl = TAU) {
  const pos = [0, 0, 0], idx = [];
  for (let s = 0; s <= segs; s++) { const a = t0 + s / segs * tl; pos.push(r * Math.cos(a), r * Math.sin(a), 0); }
  for (let s = 1; s <= segs; s++) idx.push(s, s + 1, 0);
  return { pos, idx };
}
function ringMesh(ri, ro, ts = 32, ps = 1, t0 = 0, tl = TAU) {
  const pos = [], idx = [];
  for (let j = 0; j <= ps; j++) {
    const r = ri + j / ps * (ro - ri);
    for (let i = 0; i <= ts; i++) { const a = t0 + i / ts * tl; pos.push(r * Math.cos(a), r * Math.sin(a), 0); }
  }
  return { pos, idx: gridIdx(ts, ps, idx) };
}
/* Extruded outline with an optional hole of the same point count (plywood ribs), depth along +Z. */
function extrudeMesh({ outer, hole, depth }) {
  const pos = [], idx = [], n = outer.length;
  const ring = (pts, z) => { const s = pos.length / 3; pts.forEach(([x, y]) => pos.push(x, y, z)); return s; };
  const o0 = ring(outer, 0), o1 = ring(outer, depth);
  for (let i = 0; i < n; i++) { const j = (i + 1) % n; idx.push(o0 + i, o0 + j, o1 + i, o0 + j, o1 + j, o1 + i); }
  if (hole && hole.length === n) {
    const h0 = ring(hole, 0), h1 = ring(hole, depth);
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      idx.push(h0 + i, h1 + i, h0 + j, h0 + j, h1 + i, h1 + j);
      idx.push(o0 + i, h0 + (n - 1 - i) % n, o0 + j, o1 + i, o1 + j, h1 + (n - 1 - i) % n);
    }
  } else for (let i = 1; i < n - 1; i++) idx.push(o0, o0 + i, o0 + i + 1, o1, o1 + i + 1, o1 + i);
  return { pos, idx };
}
/* Positions and triangle indices of a geometry descriptor, in its local frame. */
export function geoMesh(g) {
  const a = g.args;
  switch (g.type) {
    case 'Box': case 'RoundedBox': return boxMesh(a[0], a[1], a[2]);
    case 'Cylinder': return cylinderMesh(a[0], a[1], a[2], a[3], a[4], a[5], a[6], a[7]);
    case 'Cone': return cylinderMesh(0, a[0], a[1], a[2], a[3], a[4], a[5], a[6]);
    case 'Torus': return torusMesh(a[0], a[1], a[2], a[3], a[4]);
    case 'Sphere': return sphereMesh(a[0], a[1], a[2], a[3], a[4], a[5], a[6]);
    case 'Capsule': return capsuleMesh(a[0], a[1], a[2], a[3]);
    case 'Plane': return planeMesh(a[0], a[1]);
    case 'Circle': return circleMesh(a[0], a[1], a[2], a[3]);
    case 'Ring': return ringMesh(a[0], a[1], a[2], a[3], a[4], a[5]);
    case 'Extrude': return extrudeMesh(a[0]);
    case 'Mesh': return { pos: a[0].pos, idx: a[0].idx };
    default: throw new Error('unknown geometry ' + g.type);
  }
}

/* ------------------------------------------------------------------ world-space queries */
/* Visit every mesh with its world matrix. `skip(node)` prunes a subtree (or skips a mesh). */
export function eachWorldMesh(root, fn, skip = () => false, parentM = null) {
  if (skip(root)) return;
  const m = parentM ? new Mat4().multiplyMatrices(parentM, root.localMatrix()) : root.localMatrix();
  if (root.geo) fn(root, m);
  for (const c of root.children) eachWorldMesh(c, fn, skip, m);
}
export function boundsOf(root, skip) {
  const b = new Box(), v = new Vec3();
  eachWorldMesh(root, (n, m) => {
    const { pos } = geoMesh(n.geo);
    for (let i = 0; i < pos.length; i += 3) { v.set(pos[i], pos[i + 1], pos[i + 2]).applyMatrix4(m); b.addPoint(v.x, v.y, v.z); }
  }, skip);
  return b;
}
/* World-space triangle soups with bounds, for ray casts (driver view cone, wheel clearance tests). */
export function worldMeshes(root, skip) {
  const out = [], v = new Vec3();
  eachWorldMesh(root, (n, m) => {
    const { pos, idx } = geoMesh(n.geo);
    const w = new Float64Array(pos.length), b = new Box();
    for (let i = 0; i < pos.length; i += 3) {
      v.set(pos[i], pos[i + 1], pos[i + 2]).applyMatrix4(m);
      w[i] = v.x; w[i + 1] = v.y; w[i + 2] = v.z; b.addPoint(v.x, v.y, v.z);
    }
    out.push({ node: n, pos: w, idx, box: b });
  }, skip);
  return out;
}
function rayBox(o, d, b, tmax) {
  let t0 = 0, t1 = tmax;
  for (let i = 0; i < 3; i++) {
    const inv = 1 / d[i];
    let ta = (b.min[i] - o[i]) * inv, tb = (b.max[i] - o[i]) * inv;
    if (ta > tb) [ta, tb] = [tb, ta];
    t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
    if (t1 < t0) return false;
  }
  return true;
}
/* Nearest hit distance along a ray, or Infinity. Möller–Trumbore, both faces. */
export function raycast(meshes, o, d, tmax = 50) {
  let best = tmax;
  let hit = null;
  for (const m of meshes) {
    if (!rayBox(o, d, m.box, best)) continue;
    const p = m.pos, idx = m.idx;
    for (let k = 0; k < idx.length; k += 3) {
      const a = idx[k] * 3, b = idx[k + 1] * 3, c = idx[k + 2] * 3;
      const e1x = p[b] - p[a], e1y = p[b + 1] - p[a + 1], e1z = p[b + 2] - p[a + 2];
      const e2x = p[c] - p[a], e2y = p[c + 1] - p[a + 1], e2z = p[c + 2] - p[a + 2];
      const px = d[1] * e2z - d[2] * e2y, py = d[2] * e2x - d[0] * e2z, pz = d[0] * e2y - d[1] * e2x;
      const det = e1x * px + e1y * py + e1z * pz;
      if (Math.abs(det) < 1e-12) continue;
      const inv = 1 / det;
      const tx = o[0] - p[a], ty = o[1] - p[a + 1], tz = o[2] - p[a + 2];
      const u = (tx * px + ty * py + tz * pz) * inv; if (u < 0 || u > 1) continue;
      const qx = ty * e1z - tz * e1y, qy = tz * e1x - tx * e1z, qz = tx * e1y - ty * e1x;
      const vv = (d[0] * qx + d[1] * qy + d[2] * qz) * inv; if (vv < 0 || u + vv > 1) continue;
      const t = (e2x * qx + e2y * qy + e2z * qz) * inv;
      if (t > 1e-4 && t < best) { best = t; hit = m.node; }
    }
  }
  return { t: best, node: hit };
}
