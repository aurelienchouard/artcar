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
