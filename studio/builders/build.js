/* Turn the engine's scene description into three.js objects, one to one. Layer groups keep their tags
   (userData.layer, userData.pack) so the UI can toggle layers, x-ray the steel and pack the car. */
import { MAT } from './materials.js';
const T = window.THREE;

function makeGeometry(g) {
  const a = g.args;
  let geo;
  switch (g.type) {
    case 'Box': geo = new T.BoxGeometry(a[0], a[1], a[2]); break;
    case 'RoundedBox': geo = new T.RoundedBoxGeometry(a[0], a[1], a[2], a[3], a[4]); break;
    case 'Cylinder': geo = new T.CylinderGeometry(a[0], a[1], a[2], a[3] ?? 32, a[4] ?? 1, a[5] ?? false, a[6] ?? 0, a[7] ?? Math.PI * 2); break;
    case 'Cone': geo = new T.ConeGeometry(a[0], a[1], a[2] ?? 32, a[3] ?? 1, a[4] ?? false); break;
    case 'Torus': geo = new T.TorusGeometry(a[0], a[1], a[2] ?? 12, a[3] ?? 48, a[4] ?? Math.PI * 2); break;
    case 'Sphere': geo = new T.SphereGeometry(a[0], a[1] ?? 32, a[2] ?? 16, a[3] ?? 0, a[4] ?? Math.PI * 2, a[5] ?? 0, a[6] ?? Math.PI); break;
    case 'Capsule': geo = new T.CapsuleGeometry(a[0], a[1], a[2] ?? 4, a[3] ?? 8); break;
    case 'Plane': geo = new T.PlaneGeometry(a[0], a[1]); break;
    case 'Circle': geo = new T.CircleGeometry(a[0], a[1] ?? 32, a[2] ?? 0, a[3] ?? Math.PI * 2); break;
    case 'Ring': geo = new T.RingGeometry(a[0], a[1], a[2] ?? 32, a[3] ?? 1, a[4] ?? 0, a[5] ?? Math.PI * 2); break;
    case 'Mesh': {
      geo = new T.BufferGeometry();
      geo.setAttribute('position', new T.Float32BufferAttribute(a[0].pos, 3));
      if (a[0].uv) geo.setAttribute('uv', new T.Float32BufferAttribute(a[0].uv, 2));
      geo.setIndex(a[0].idx);
      geo.computeVertexNormals();
      const n = geo.attributes.normal;   // degenerate triangles leave zero normals; give them a unit vector
      for (let i = 0; i < n.count; i++) { const l = Math.hypot(n.getX(i), n.getY(i), n.getZ(i)); if (l < 1e-6) n.setXYZ(i, 0, 1, 0); else if (Math.abs(l - 1) > 1e-3) n.setXYZ(i, n.getX(i) / l, n.getY(i) / l, n.getZ(i) / l); }
      break;
    }
    default: throw new Error('unknown geometry ' + g.type);
  }
  if (g.uvScale && geo.attributes.uv) {
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * g.uvScale[0], uv.getY(i) * g.uvScale[1]);
    uv.needsUpdate = true;
  }
  return geo;
}

export function toThree(n, out) {
  const o = n.geo ? new T.Mesh(makeGeometry(n.geo), MAT[n.mat] || MAT.frame) : new T.Group();
  o.name = n.name || '';
  o.position.set(n.position.x, n.position.y, n.position.z);
  if (n.quaternion.used) o.quaternion.set(n.quaternion.x, n.quaternion.y, n.quaternion.z, n.quaternion.w);
  else o.rotation.set(n.rotation.x, n.rotation.y, n.rotation.z);
  o.scale.set(n.scale.x, n.scale.y, n.scale.z);
  if (n.geo) { o.castShadow = n.castShadow; o.receiveShadow = n.receiveShadow; }
  o.userData = { ...n.userData };
  if (n.userData.wheel) out.wheels.push({ pivot: o, spin: null, front: n.userData.wheel === 'front' });
  if (n.userData.spin && out.wheels.length) out.wheels[out.wheels.length - 1].spin = o;
  if (n.userData.layer) out.layers[n.userData.layer + ':' + n.userData.pack] = o;
  for (const c of n.children) o.add(toThree(c, out));
  return o;
}

/* Build the car. Returns the root, layer groups and wheels for driving. */
export function buildThree(model) {
  const out = { wheels: [], layers: {} };
  const root = toThree(model.root, out);
  return { root, ...out };
}
export function disposeTree(obj) { obj.traverse((o) => { if (o.isMesh && o.geometry) o.geometry.dispose(); }); }
