/* Primitive emitters for the model. Same call shapes as the v1 helpers, but they build scene-description nodes. */
import { Node, geo } from '../scene.js';
import { Vec3 } from '../math.js';
export { geo, Node };
export const UP = new Vec3(0, 1, 0);
export function mesh(g, mat, parent, shadow = true) {
  const m = new Node(g, mat);
  m.castShadow = shadow; m.receiveShadow = true;
  parent.add(m);
  return m;
}
export function box(w, h, d, mat, x, y, z, parent, shadow) {
  const m = mesh(geo('Box', Math.max(w, 1e-3), Math.max(h, 1e-3), Math.max(d, 1e-3)), mat, parent, shadow);
  m.position.set(x, y, z);
  return m;
}
export function rbox(w, h, d, r, mat, x, y, z, parent) {
  const rr = Math.min(r, w / 2 - 1e-3, h / 2 - 1e-3, d / 2 - 1e-3);
  const m = mesh(geo('RoundedBox', w, h, d, 3, Math.max(0.002, rr)), mat, parent);
  m.position.set(x, y, z);
  return m;
}
export function cylX(r, len, mat, x, y, z, parent, seg = 24, shadow = true, open = false) {
  const m = mesh(geo('Cylinder', r, r, Math.max(len, 1e-3), seg, 1, open), mat, parent, shadow);
  m.rotation.z = Math.PI / 2;
  m.position.set(x, y, z);
  return m;
}
export function ringX(r, tube, mat, x, y, z, parent, seg = 64, shadow = true) {
  const m = mesh(geo('Torus', r, tube, 8, seg), mat, parent, shadow);
  m.rotation.y = Math.PI / 2;
  m.position.set(x, y, z);
  return m;
}
export function rod(a, b, r, mat, parent, capsule = true, seg = 10) {
  const dir = b.clone().sub(a); const len = dir.length();
  const g = capsule ? geo('Capsule', r, Math.max(0.001, len), 4, seg) : geo('Cylinder', r, r, len, seg);
  const m = mesh(g, mat, parent);
  m.position.copy(a).add(b).multiplyScalar(0.5);
  if (len > 1e-6) m.quaternion.setFromUnitVectors(UP, dir.normalize());
  return m;
}
export function group(name) { const g = new Node(); g.name = name; return g; }
/* Scale the texture coordinates of a geometry (perforated metal holes stay a constant size). */
export function scaleUV(g, su, sv) { g.uvScale = [su, sv]; return g; }
/* A mesh from explicit positions and triangle indices. */
export function meshGeo(pos, idx, uv) { return geo('Mesh', { pos, idx, uv }); }

/* A convex side profile [[x, y], ...] (counter-clockwise seen from +Z) extruded across Z with bevelled edges.
   Flat shaded: every face gets its own vertices. */
export function bevelSolid(profile, width, bevel = 0.04) {
  const n = profile.length, b = Math.min(bevel, width / 2 - 1e-3);
  const inset = profile.map((p, i) => {
    const a = profile[(i + n - 1) % n], c = profile[(i + 1) % n];
    const n1 = norm2([-(p[1] - a[1]), p[0] - a[0]]), n2 = norm2([-(c[1] - p[1]), c[0] - p[0]]);   // inward normals of a CCW outline
    const m = [n1[0] + n2[0], n1[1] + n2[1]], k = b / Math.max(0.3, 1 + n1[0] * n2[0] + n1[1] * n2[1]);
    return [p[0] + m[0] * k, p[1] + m[1] * k];
  });
  const layers = [[inset, -width / 2], [profile, -width / 2 + b], [profile, width / 2 - b], [inset, width / 2]];
  const pos = [], idx = [];
  const quad = (A, B, C, D) => { const s = pos.length / 3; pos.push(...A, ...B, ...C, ...D); idx.push(s, s + 1, s + 2, s, s + 2, s + 3); };
  for (let L = 0; L < 3; L++) {
    const [p0, z0] = layers[L], [p1, z1] = layers[L + 1];
    for (let i = 0; i < n; i++) { const j = (i + 1) % n; quad([...p0[i], z0], [...p0[j], z0], [...p1[j], z1], [...p1[i], z1]); }
  }
  for (const [pts, z, dir] of [[inset, width / 2, 1], [inset, -width / 2, -1]]) {
    const s = pos.length / 3; pts.forEach((p) => pos.push(p[0], p[1], z));
    for (let i = 1; i < n - 1; i++) idx.push(...(dir > 0 ? [s, s + i, s + i + 1] : [s, s + i + 1, s + i]));
  }
  return geo('Mesh', { pos, idx });
}
function norm2(v) { const l = Math.hypot(v[0], v[1]) || 1; return [v[0] / l, v[1] / l]; }
/* A surface of revolution around Z from a profile [[r, z], ...]; smooth shaded. */
export function latheZ(profile, seg = 32) {
  const pos = [], idx = [], m = profile.length;
  for (let k = 0; k <= seg; k++) {
    const a = k / seg * TAU2, c = Math.cos(a), s = Math.sin(a);
    for (const [r, z] of profile) pos.push(r * c, r * s, z);
  }
  for (let k = 0; k < seg; k++) for (let i = 0; i < m - 1; i++) {
    const a = k * m + i, b = a + 1, c = a + m, d = c + 1;
    idx.push(a, d, b, a, c, d);
  }
  return geo('Mesh', { pos, idx });
}
const TAU2 = Math.PI * 2;
/* Place a bevelled profile solid. */
export function profile(pts, width, bevel, mat, z, parent, shadow = true) {
  const m = mesh(bevelSolid(pts, width, bevel), mat, parent, shadow);
  m.position.set(0, 0, z);
  return m;
}
