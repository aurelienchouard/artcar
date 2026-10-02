/* Furniture, people, speakers, the daiquiri bar and bikes. */
import { Vec3, TAU, clamp, lerp, degToRad, radToDeg } from '../math.js';
import { mesh, box, rbox, cylX, ringX, rod, group, geo, Node, scaleUV, meshGeo, UP } from './prims.js';
import { splitRun } from './helpers.js';

export function mannequin(pose, mat, variant = 0) {
  const g = new Node();
  const P = (x, y, z) => new Vec3(x, y, z);
  const hip = 0.1;
  for (const sz of [-1, 1]) {
    const z = sz * 0.1;
    if (pose === 'stand') {
      const kx = variant % 2 ? 0.05 : -0.02;
      rod(P(0, hip, z), P(kx, hip - 0.42, z), 0.072, mat, g);
      rod(P(kx, hip - 0.42, z), P(0, hip - 0.84, z), 0.056, mat, g);
      rbox(0.2, 0.06, 0.09, 0.025, mat, 0.07, hip - 0.87, z, g);
    } else if (pose === 'floor') {
      rod(P(0, hip, z), P(0.36, hip + 0.1, z), 0.072, mat, g);
      rod(P(0.37, hip + 0.09, z), P(0.58, -0.22, z), 0.056, mat, g);
      rbox(0.2, 0.06, 0.09, 0.025, mat, 0.64, -0.245, z, g);
    } else if (pose === 'lounge') {
      rod(P(0, hip, z), P(0.34, hip + 0.24, z), 0.072, mat, g);
      rod(P(0.35, hip + 0.23, z), P(0.62, 0.0, z), 0.056, mat, g);
      rbox(0.2, 0.06, 0.09, 0.025, mat, 0.69, -0.02, z, g);
    } else {
      rod(P(0, hip, z), P(0.42, hip, z), 0.072, mat, g);
      rod(P(0.43, hip - 0.02, z), P(0.46, -0.3, z), 0.056, mat, g);
      rbox(0.2, 0.06, 0.09, 0.025, mat, 0.53, -0.335, z, g);
    }
  }
  const lean = pose === 'lounge' ? 0.42 : pose === 'floor' ? 0.36 : pose === 'drive' ? 0.1 : pose === 'stand' ? 0.03 : 0.16;
  const tb = P(-0.02, hip + 0.06, 0);
  const tdir = P(-Math.sin(lean), Math.cos(lean), 0);
  const tt = tb.clone().addScaledVector(tdir, 0.36);
  const torso = rod(tb, tt, 0.15, mat, g);
  torso.scale.set(1, 1, 1.18);
  const head = mesh(geo('Sphere', 0.1, 18, 12), mat, g);
  head.position.copy(tt).addScaledVector(tdir, 0.27);
  for (const sz of [-1, 1]) {
    const sh = tt.clone().add(P(0, -0.02, sz * 0.2));
    let el, hand;
    if (pose === 'drive') { el = sh.clone().add(P(0.2, -0.2, sz * 0.03)); hand = P(0.46, 0.55, sz * 0.16); }
    else if (pose === 'stand' && (variant + (sz > 0 ? 1 : 0)) % 3 !== 0) { el = sh.clone().add(P(0.06, 0.26, sz * 0.12)); hand = el.clone().add(P(0.04, 0.26, sz * 0.04)); }
    else if (pose === 'stand') { el = sh.clone().add(P(0.04, -0.28, sz * 0.05)); hand = el.clone().add(P(0.2, 0.08, -sz * 0.02)); }
    else if (pose === 'lounge' || pose === 'floor') { el = sh.clone().add(P(0.04, -0.26, sz * 0.07)); hand = P(0.2, 0.14, sz * 0.28); }
    else { el = sh.clone().add(P(0.08, -0.27, sz * 0.03)); hand = P(0.3, 0.2, sz * 0.17); }
    rod(sh, el, 0.047, mat, g);
    rod(el, hand, 0.043, mat, g);
  }
  return g;
}

/* Big floor pillows with a lean-back bag, around the edge of the usable roof deck. */
export function pillowSeats(parent, ridersParent, X0, X1, rzE, y, obstacles, skin) {
  const spots = [];
  const hit = (x, z) => obstacles.some((o) => x + 0.36 > o[0] && x - 0.36 < o[1] && z + 0.36 > o[2] && z - 0.36 < o[3]);
  const along = (a, b, pitch) => { const n = Math.max(0, Math.floor((b - a) / pitch)) + 1; const st = n > 1 ? (b - a) / (n - 1) : 0; return Array.from({ length: n }, (_, i) => (n > 1 ? a + i * st : (a + b) / 2)); };
  if (X1 - X0 > 0.8) for (const sgn of [-1, 1]) along(X0 + 0.45, X1 - 0.45, 0.82).forEach((x) => spots.push([x, sgn * (rzE - 0.56), -sgn, 'z']));
  if (2 * rzE - 1.7 > 0) for (const [x, d] of [[X1 - 0.56, -1], [X0 + 0.56, 1]]) {
    if (X1 - X0 < 1.8) continue;
    along(-rzE + 1.25, rzE - 1.25, 0.82).forEach((z) => spots.push([x, z, d, 'x']));
  }
  let n = 0;
  const rects = [];
  spots.forEach(([x, z, d, faceAxis], i) => {
    if (hit(x, z)) return;
    const g = new Node(); g.position.set(x, y, z);
    g.rotation.y = faceAxis === 'z' ? (d > 0 ? -Math.PI / 2 : Math.PI / 2) : (d > 0 ? 0 : Math.PI);
    parent.add(g);
    rbox(0.66, 0.24, 0.62, 0.1, 'fabric', 0.02, 0.12, 0, g);
    const bag = rbox(0.28, 0.52, 0.64, 0.13, i % 3 === 1 ? 'accent' : 'fabric', -0.3, 0.32, 0, g); bag.rotation.z = 0.38;
    const m = mannequin('floor', skin());
    m.rotation.y = g.rotation.y;
    m.position.copy(g.position).add(new Vec3(-0.12, 0.24, 0).applyAxisAngle(new Vec3(0, 1, 0), g.rotation.y));
    ridersParent.add(m);
    rects.push([x - 0.45, x + 0.45, z - 0.45, z + 0.45]);
    n++;
  });
  return { n, rects };
}

/* A thin cover over a box-shaped stock part: top, both sides, back and optionally front, in the tube skin.
   `back` is how low the back panel reaches (down to the floor at a firewall); `inner` skips the side that faces the hood. */
export function coverBox(parent, o) {
  const panel = (w, h, x, y, z, rx, ry) => {
    const gg = geo('Plane', w, h);
    if (o.perf) scaleUV(gg, w / 0.045, h / 0.045);
    const m = mesh(gg, o.mat, parent); m.rotation.set(rx, ry, 0); m.position.set(x, y, z); m.name = 'Engine cover'; m.userData.followsStock = true;
    o.bom[o.key] += w * h;
  };
  const L = o.x1 - o.x0, Wd = o.z1 - o.z0, H = o.y1 - o.y0, xm = (o.x0 + o.x1) / 2, zm = (o.z0 + o.z1) / 2;
  panel(L, Wd, xm, o.y1, zm, -Math.PI / 2, 0);
  for (const zz of ['z0', 'z1']) if (o.inner !== zz) panel(L, H, xm, (o.y0 + o.y1) / 2, o[zz], 0, 0);
  const bh = o.y1 - o.back;
  panel(Wd, bh, o.x0, o.back + bh / 2, zm, 0, Math.PI / 2);
  if (o.front) panel(Wd, H, o.x1, (o.y0 + o.y1) / 2, zm, 0, Math.PI / 2);
  if (o.leds) for (const zz of [o.z0, o.z1]) box(L, 0.018, 0.018, 'led', xm, o.y1 + 0.009, zz, parent, false).userData.followsStock = true;
}

/* Louvered vent panel, facing along `axis` ('x' = on a face across the car, 'z' = on a side). */
export function louver(parent, x, y, z, w, h, axis) {
  const g = group('Vent'); parent.add(g);
  const bx = axis === 'x' ? [0.02, h, w] : [w, h, 0.02];
  box(bx[0], bx[1], bx[2], 'vent', x, y, z, g, false);
  const n = Math.max(3, Math.round(h / 0.05));
  for (let i = 0; i < n; i++) {
    const yy = y - h / 2 + (i + 0.5) * h / n;
    const sl = axis === 'x' ? box(0.03, 0.012, w - 0.04, 'rim', x - 0.012, yy, z, g, false) : box(w - 0.04, 0.012, 0.03, 'rim', x, yy, z + Math.sign(z) * 0.012, g, false);
    sl.rotation[axis === 'x' ? 'z' : 'x'] = axis === 'x' ? 0.5 : -0.5 * Math.sign(z);
  }
}

/* Speaker box or tower standing in a lounge corner, drivers facing into the lounge. */
export function buildSpeakerBox(parent, p, deckY) {
  const g = group('Speaker'); parent.add(g);
  const cone = (x, y, z, r) => {
    const c = mesh(geo('Cylinder', r, r, 0.01, 28), 'grille', g); c.rotation.x = Math.PI / 2; c.position.set(x, y, z);
    const rim = mesh(geo('Torus', r, 0.01, 6, 28), 'rim', g, false); rim.position.set(x, y, z);
  };
  if (p.hung) {   // hung from the roof edge outside the posts, facing out and toed toward the front or back
    g.position.set(p.x, deckY, p.z); g.rotation.y = p.out ? Math.atan2(p.sx * 0.5, p.sgn) : Math.atan2(-p.sx * 0.4, -p.sgn);
    const dz = p.w * 0.8;
    box(p.w, p.h, dz, 'speaker', 0, p.h / 2, 0, g);
    box(0.05, 0.1, 0.05, 'rim', 0, p.h + 0.05, 0, g);
    (p.out ? [[0.36, 0.12], [0.8, 0.045]] : [[0.4, 0.075], [0.82, 0.03]]).forEach(([f, r]) => cone(0, p.h * f, dz / 2 + 0.006, r));
    return;
  }
  box(p.w, p.h, p.w, 'speaker', p.x, deckY + p.h / 2, p.z, g);
  const faceZ = p.z - p.sgn * (p.w / 2 + 0.004);
  const drivers = p.h > 1.2 ? [[0.25, 0.17], [0.58, 0.17], [0.86, 0.07]] : [[0.36, 0.17], [0.8, 0.07]];
  drivers.forEach(([f, r]) => cone(p.x, deckY + p.h * f, faceZ, r));
}

/* Frozen daiquiri machines on the lid of the low rear section, taps facing out the back, awning over them. */
export function buildDaiquiri(parent, xbR, topY, floorW, zc, roofBottom) {
  const g = group('Daiquiri bar'); parent.add(g);
  const ww = Math.min(1.35, floorW * 0.46);
  box(0.24, 0.03, ww + 0.2, 'frame', xbR - 0.1, topY - 0.3, zc, g);   // drink shelf on the back face
  for (let i = 0; i < 3; i++) {
    const z = zc + (i - 1) * (ww / 3), x = xbR + 0.2;
    rbox(0.26, 0.3, 0.28, 0.03, 'rim', x, topY + 0.15, z, g);
    const bowl = mesh(geo('Cylinder', 0.115, 0.115, 0.36, 24), 'bowl', g, false); bowl.position.set(x, topY + 0.48, z);
    const sl = mesh(geo('Cylinder', 0.105, 0.105, 0.25, 20), ('slush' + (i)), g); sl.position.set(x, topY + 0.425, z);
    cylX(0.02, 0.05, 'speaker', x - 0.155, topY + 0.2, z, g, 10);
  }
  const ang = -0.25, cx = xbR - 0.3, cy = roofBottom - 0.2;
  const aw = box(0.7, 0.03, ww + 0.34, 'accent', cx, cy, zc, g); aw.rotation.z = ang;
  box(0.03, 0.03, ww + 0.34, 'led', cx - 0.35 * Math.cos(ang), cy - 0.35 * Math.sin(ang) - 0.02, zc, g, false);
}

/* Bicycle, length along local X (front wheel at +X), wheels resting on y = 0. */
export function bikeModel(mat) {
  const g = new Node(); g.name = 'Bike';
  const wr = 0.34, P = (x, y, z = 0) => new Vec3(x, y, z);
  for (const x of [-0.53, 0.53]) { const w = mesh(geo('Torus', wr, 0.028, 8, 36), 'rubber', g); w.position.set(x, wr, 0); }
  const bb = P(-0.03, 0.3), seat = P(-0.22, 0.88), head = P(0.36, 0.86), rearAx = P(-0.53, wr), frontAx = P(0.53, wr);
  [[bb, seat], [seat, head], [bb, head], [bb, rearAx], [seat, rearAx], [head, frontAx]].forEach(([p, q]) => rod(p, q, 0.021, mat, g, false, 6));
  rod(head, P(0.33, 1.02), 0.02, mat, g, false, 6);
  rod(P(0.31, 1.02, -0.3), P(0.31, 1.02, 0.3), 0.017, 'rim', g, false, 6);
  rbox(0.24, 0.05, 0.12, 0.02, 'leather', -0.24, 0.93, 0, g);
  return g;
}

export function sofaRun(parent, ridersParent, run, baseY, depth, kind, skin) {
  let p0 = new Vec3(run.a[0], 0, run.a[1]), p1 = new Vec3(run.b[0], 0, run.b[1]);
  let cA = run.cornerA, cB = run.cornerB;
  let dir = p1.clone().sub(p0).normalize();
  if (-dir.z * run.inward[0] + dir.x * run.inward[1] < 0) { [p0, p1] = [p1, p0]; [cA, cB] = [cB, cA]; dir.negate(); }
  const len = p0.distanceTo(p1);
  const g = new Node();
  g.position.set(p0.x, baseY, p0.z);
  g.rotation.y = Math.atan2(-dir.z, dir.x);
  parent.add(g);

  const daybed = kind === 'daybed';
  const plinthH = daybed ? 0.1 : 0.16, cushH = daybed ? 0.18 : 0.2, backT = 0.2, backH = daybed ? 0.4 : 0.46;
  box(len, plinthH, depth - 0.02, 'plinth', len / 2, plinthH / 2, depth / 2, g);
  const n = Math.max(1, Math.round(len / (daybed ? 1.0 : 0.82)));
  const w = len / n;
  for (let i = 0; i < n; i++) {
    const cx = w * (i + 0.5);
    rbox(w - 0.025, cushH, depth - backT, 0.06, 'fabric', cx, plinthH + cushH / 2, backT + (depth - backT) / 2, g);
    const bc = rbox(w - 0.025, backH, backT, 0.07, 'fabric', cx, plinthH + cushH + backH / 2 - 0.02, backT / 2 + 0.01, g);
    bc.rotation.x = -0.12;
  }
  const seatTop = plinthH + cushH;
  if (run.pillows) {
    const ends = [[0.28, 1], [len - 0.28, -1]];
    ends.forEach(([px, sd], i) => {
      if (len < 0.9) return;
      const p = rbox(0.44, 0.42, 0.14, 0.06, i % 2 ? 'accent2' : 'accent', px, seatTop + 0.2, backT + 0.1, g);
      p.rotation.set(-0.3, sd * 0.25, sd * 0.12);
    });
    if (len > 3.2) {
      const p = rbox(0.42, 0.4, 0.13, 0.06, 'accent2', len * 0.5, seatTop + 0.19, backT + 0.1, g);
      p.rotation.set(-0.28, 0.1, -0.08);
    }
  }

  /* seats */
  const spacing = daybed ? 0.8 : 0.62;
  const o0 = cA ? depth + 0.08 : (run.pillows ? 0.46 : 0.34);
  const o1 = cB ? depth + 0.08 : (run.pillows ? 0.46 : 0.34);
  const usable = len - o0 - o1;
  let positions = [];
  if (usable >= 0) {
    const count = Math.floor(usable / spacing) + 1;
    const step = count > 1 ? usable / (count - 1) : 0;
    for (let i = 0; i < count; i++) positions.push(count > 1 ? o0 + i * step : o0 + usable / 2);
  } else if (len >= 0.58) positions = [len / 2];

  const hipZ = daybed ? 0.34 : 0.36;
  for (const px of positions) {
    const m = mannequin(daybed ? 'lounge' : 'seat', skin());
    const wp = p0.clone().addScaledVector(dir, px).add(new Vec3(run.inward[0] * hipZ, 0, run.inward[1] * hipZ));
    m.position.set(wp.x, baseY + seatTop, wp.z);
    m.rotation.y = g.rotation.y - Math.PI / 2;
    ridersParent.add(m);
  }
  return positions.length;
}


