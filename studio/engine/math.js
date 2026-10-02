/* Small, dependency-free vector math. It mirrors the slice of the three.js API the model uses, so the engine runs in
   Node without three.js. Units are meters. X forward, Y up, Z toward the passenger side. */
export const TAU = Math.PI * 2;
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const degToRad = (d) => d * Math.PI / 180;
export const radToDeg = (r) => r * 180 / Math.PI;

export class Vec3 {
  constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
  set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
  clone() { return new Vec3(this.x, this.y, this.z); }
  copy(v) { this.x = v.x; this.y = v.y; this.z = v.z; return this; }
  add(v) { this.x += v.x; this.y += v.y; this.z += v.z; return this; }
  sub(v) { this.x -= v.x; this.y -= v.y; this.z -= v.z; return this; }
  multiplyScalar(s) { this.x *= s; this.y *= s; this.z *= s; return this; }
  addScaledVector(v, s) { this.x += v.x * s; this.y += v.y * s; this.z += v.z * s; return this; }
  dot(v) { return this.x * v.x + this.y * v.y + this.z * v.z; }
  lengthSq() { return this.dot(this); }
  length() { return Math.sqrt(this.lengthSq()); }
  normalize() { const l = this.length() || 1; return this.multiplyScalar(1 / l); }
  negate() { this.x = -this.x; this.y = -this.y; this.z = -this.z; return this; }
  distanceTo(v) { return Math.hypot(this.x - v.x, this.y - v.y, this.z - v.z); }
  lerp(v, t) { this.x += (v.x - this.x) * t; this.y += (v.y - this.y) * t; this.z += (v.z - this.z) * t; return this; }
  crossVectors(a, b) {
    const x = a.y * b.z - a.z * b.y, y = a.z * b.x - a.x * b.z, z = a.x * b.y - a.y * b.x;
    return this.set(x, y, z);
  }
  applyQuaternion(q) {
    const { x, y, z } = this, qx = q.x, qy = q.y, qz = q.z, qw = q.w;
    const tx = 2 * (qy * z - qz * y), ty = 2 * (qz * x - qx * z), tz = 2 * (qx * y - qy * x);
    this.x = x + qw * tx + qy * tz - qz * ty;
    this.y = y + qw * ty + qz * tx - qx * tz;
    this.z = z + qw * tz + qx * ty - qy * tx;
    return this;
  }
  applyAxisAngle(axis, angle) { return this.applyQuaternion(new Quat().setFromAxisAngle(axis, angle)); }
  applyMatrix4(m) {
    const e = m.e, { x, y, z } = this;
    this.x = e[0] * x + e[4] * y + e[8] * z + e[12];
    this.y = e[1] * x + e[5] * y + e[9] * z + e[13];
    this.z = e[2] * x + e[6] * y + e[10] * z + e[14];
    return this;
  }
  toArray() { return [this.x, this.y, this.z]; }
}

export class Quat {
  constructor(x = 0, y = 0, z = 0, w = 1) { this.x = x; this.y = y; this.z = z; this.w = w; this.used = false; }
  set(x, y, z, w) { this.x = x; this.y = y; this.z = z; this.w = w; this.used = true; return this; }
  copy(q) { return this.set(q.x, q.y, q.z, q.w); }
  setFromAxisAngle(axis, angle) {
    const s = Math.sin(angle / 2);
    return this.set(axis.x * s, axis.y * s, axis.z * s, Math.cos(angle / 2));
  }
  /* Same algorithm as three.js, so rotations match the v1 model exactly. */
  setFromUnitVectors(from, to) {
    let r = from.dot(to) + 1;
    let x, y, z, w;
    if (r < Number.EPSILON) {
      r = 0;
      if (Math.abs(from.x) > Math.abs(from.z)) { x = -from.y; y = from.x; z = 0; w = r; }
      else { x = 0; y = -from.z; z = from.y; w = r; }
    } else {
      x = from.y * to.z - from.z * to.y; y = from.z * to.x - from.x * to.z; z = from.x * to.y - from.y * to.x; w = r;
    }
    const l = Math.hypot(x, y, z, w) || 1;
    return this.set(x / l, y / l, z / l, w / l);
  }
  /* From a rotation matrix given as three basis columns (like Matrix4.makeBasis). */
  setFromBasis(xa, ya, za) {
    const m11 = xa.x, m12 = ya.x, m13 = za.x, m21 = xa.y, m22 = ya.y, m23 = za.y, m31 = xa.z, m32 = ya.z, m33 = za.z;
    const tr = m11 + m22 + m33;
    if (tr > 0) { const s = 0.5 / Math.sqrt(tr + 1); return this.set((m32 - m23) * s, (m13 - m31) * s, (m21 - m12) * s, 0.25 / s); }
    if (m11 > m22 && m11 > m33) { const s = 2 * Math.sqrt(1 + m11 - m22 - m33); return this.set(0.25 * s, (m12 + m21) / s, (m13 + m31) / s, (m32 - m23) / s); }
    if (m22 > m33) { const s = 2 * Math.sqrt(1 + m22 - m11 - m33); return this.set((m12 + m21) / s, 0.25 * s, (m23 + m32) / s, (m13 - m31) / s); }
    const s = 2 * Math.sqrt(1 + m33 - m11 - m22);
    return this.set((m13 + m31) / s, (m23 + m32) / s, 0.25 * s, (m21 - m12) / s);
  }
  /* Euler XYZ, the three.js default order. */
  setFromEuler(ex, ey, ez) {
    const c1 = Math.cos(ex / 2), c2 = Math.cos(ey / 2), c3 = Math.cos(ez / 2), s1 = Math.sin(ex / 2), s2 = Math.sin(ey / 2), s3 = Math.sin(ez / 2);
    this.x = s1 * c2 * c3 + c1 * s2 * s3; this.y = c1 * s2 * c3 - s1 * c2 * s3; this.z = c1 * c2 * s3 + s1 * s2 * c3; this.w = c1 * c2 * c3 - s1 * s2 * s3;
    return this;
  }
}

/* Column-major 4×4, like three.js Matrix4.elements. */
export class Mat4 {
  constructor() { this.e = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]; }
  compose(p, q, s) {
    const e = this.e, x = q.x, y = q.y, z = q.z, w = q.w;
    const x2 = x + x, y2 = y + y, z2 = z + z, xx = x * x2, xy = x * y2, xz = x * z2, yy = y * y2, yz = y * z2, zz = z * z2, wx = w * x2, wy = w * y2, wz = w * z2;
    e[0] = (1 - (yy + zz)) * s.x; e[1] = (xy + wz) * s.x; e[2] = (xz - wy) * s.x; e[3] = 0;
    e[4] = (xy - wz) * s.y; e[5] = (1 - (xx + zz)) * s.y; e[6] = (yz + wx) * s.y; e[7] = 0;
    e[8] = (xz + wy) * s.z; e[9] = (yz - wx) * s.z; e[10] = (1 - (xx + yy)) * s.z; e[11] = 0;
    e[12] = p.x; e[13] = p.y; e[14] = p.z; e[15] = 1;
    return this;
  }
  multiplyMatrices(a, b) {
    const ae = a.e, be = b.e, te = this.e.slice();
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
      te[j * 4 + i] = ae[i] * be[j * 4] + ae[4 + i] * be[j * 4 + 1] + ae[8 + i] * be[j * 4 + 2] + ae[12 + i] * be[j * 4 + 3];
    }
    this.e = te;
    return this;
  }
  clone() { const m = new Mat4(); m.e = this.e.slice(); return m; }
}

/* Axis-aligned box. */
export class Box {
  constructor() { this.min = [Infinity, Infinity, Infinity]; this.max = [-Infinity, -Infinity, -Infinity]; }
  empty() { return !(this.max[0] >= this.min[0]); }
  addPoint(x, y, z) {
    if (x < this.min[0]) this.min[0] = x; if (y < this.min[1]) this.min[1] = y; if (z < this.min[2]) this.min[2] = z;
    if (x > this.max[0]) this.max[0] = x; if (y > this.max[1]) this.max[1] = y; if (z > this.max[2]) this.max[2] = z;
    return this;
  }
  union(b) { if (!b.empty()) { this.addPoint(...b.min); this.addPoint(...b.max); } return this; }
  size() { return this.empty() ? [0, 0, 0] : [this.max[0] - this.min[0], this.max[1] - this.min[1], this.max[2] - this.min[2]]; }
  center() { return [0, 1, 2].map((i) => (this.min[i] + this.max[i]) / 2); }
  toJSON() { return { min: this.min, max: this.max }; }
}

/* Seeded random numbers, used for deterministic scenery and rider poses. */
export function mulberry(a) {
  return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
