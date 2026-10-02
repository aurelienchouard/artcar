/* Side tubes: skins, rings, ribs, LED lines and the wheel cut-outs. */
import { Vec3, TAU, clamp, lerp, degToRad, radToDeg } from '../math.js';
import { mesh, box, rbox, cylX, ringX, rod, group, geo, Node, scaleUV, meshGeo, UP } from './prims.js';

/* Ring in the tube's cross-section plane covering angles p0..p1 (angle 0 points to +Z, π/2 up). Faceted when nSides > 0. */
export function ringArc(r, tube, mat, x, y, z, parent, p0, p1, nSides, shadow = true) {
  const arc = p1 - p0; if (arc < 1e-3) return null;
  const n = nSides ? Math.max(1, Math.round(arc / (TAU / nSides))) : Math.max(8, Math.round(56 * arc / TAU));
  const m = mesh(geo('Torus', r, tube, 6, n, arc), mat, parent, shadow);
  m.position.set(x, y, z); m.rotation.set(0, Math.PI / 2, Math.PI - p1);
  return m;
}
/* Flat plywood rib: an annulus (or part of one) cut from sheet, `thick` along the tube. */
export function finArc(rIn, rOut, p0, p1, nSides, thick, mat, x, y, z, parent) {
  const arc = p1 - p0; if (arc < 1e-3 || rOut - rIn < 1e-3) return null;
  const n = nSides ? Math.max(1, Math.round(arc / (TAU / nSides))) : Math.max(12, Math.round(64 * arc / TAU));
  const full = arc >= TAU - 1e-4, k = full ? n : n + 1;
  const pos = [], idx = [];
  for (const zz of [0, thick]) for (const r of [rOut, rIn]) for (let i = 0; i < k; i++) {
    const ang = p0 + i * arc / n; pos.push(r * Math.cos(ang), r * Math.sin(ang), zz);
  }
  const O0 = 0, I0 = k, O1 = 2 * k, I1 = 3 * k;
  const segs = full ? n : n;
  for (let i = 0; i < segs; i++) {
    const j = full ? (i + 1) % k : i + 1;
    idx.push(O0 + i, O0 + j, O1 + i, O0 + j, O1 + j, O1 + i);   // outer face
    idx.push(I0 + i, I1 + i, I0 + j, I0 + j, I1 + i, I1 + j);   // inner face
    idx.push(O0 + i, I0 + i, O0 + j, O0 + j, I0 + i, I0 + j);   // cap at z = 0
    idx.push(O1 + i, O1 + j, I1 + i, O1 + j, I1 + j, I1 + i);   // cap at z = thick
  }
  if (!full) for (const i of [0, k - 1]) idx.push(O0 + i, I0 + i, O1 + i, I0 + i, I1 + i, O1 + i);
  const m = mesh(meshGeo(pos, idx), mat, parent);
  m.rotation.y = -Math.PI / 2; m.position.set(x + thick / 2, y, z);
  return m;
}
/* Lengthwise plywood rib slotted into the rings; its outer edge follows the taper. */
export function boardAlong(x0, r0, x1, r1, phi, dep, thick, mat, y, z, parent) {
  const g = new Node(); g.position.set((x0 + x1) / 2, y, z);
  g.rotation.x = Math.atan2(Math.cos(phi), Math.sin(phi));
  parent.add(g);
  const b = box(Math.hypot(x1 - x0, r1 - r0), dep, thick, mat, 0, (r0 + r1) / 2 - dep / 2, 0, g);
  b.rotation.z = Math.atan2(r1 - r0, x1 - x0);
  return b;
}

/* Faceted tubes sit on a flat face; round tubes are handled as 48 thin faces. */
export function tubePhase(nSides) { return nSides ? -Math.PI / 2 + Math.PI / nSides : 0; }
/* Which faces of a tube survive over a wheel: a face goes when any point of it falls inside the wheel's swept box
   (steering lock, suspension travel and clearance included). Returns kept arcs as [from, to] angles, none if nothing survives. */
export function keptArcs(r, cz, tubeY, zone, cutY, nSides) {
  const n = nSides || 48, step = TAU / n, ph = tubePhase(nSides);
  const zMin = cz > 0 ? zone.zIn : -zone.zOut, zMax = cz > 0 ? zone.zOut : -zone.zIn;
  const keep = [];
  for (let k = 0; k < n; k++) {
    const a0 = ph + k * step, c0 = Math.cos(a0), s0 = Math.sin(a0), c1 = Math.cos(a0 + step), s1 = Math.sin(a0 + step);
    let hit = false;
    for (let t = 0; t <= 10 && !hit; t++) {
      const z = cz + r * (c0 + (c1 - c0) * t / 10), y = tubeY + r * (s0 + (s1 - s0) * t / 10);
      hit = y < cutY && z > zMin && z < zMax;
    }
    keep.push(!hit);
  }
  if (keep.every(Boolean)) return [[ph, ph + TAU]];
  const start = keep.findIndex((k) => !k), arcs = [];
  let run = null;
  for (let i = 1; i <= n; i++) {
    if (keep[(start + i) % n]) { const a = ph + (start + i) * step; if (run) run[1] = a + step; else run = [a, a + step]; }
    else if (run) { arcs.push(run); run = null; }
  }
  if (run) arcs.push(run);
  return arcs;
}
export function buildTubeChain(parent, a, b, cz, sgn, ctx) {
  const { s, TB, nSides, tubeY, rad, xbF, xbR, txF, txR, ledOff, arches, cutY, bom, F } = ctx;
  const step = nSides ? TAU / nSides : 0;
  const segs = nSides || 56;
  const phase = tubePhase(nSides), FULL = [phase, phase + TAU];
  const skinMat = TB.skin ? { alu: nSides ? 'tubeF' : 'tube', ply: nSides ? 'plyF' : 'ply', perf: nSides ? 'perfF' : 'perf', poly: nSides ? 'glowSkinF' : 'glowSkin' }[TB.skin] : null;
  const bomSkin = { alu: 'alu', ply: 'plyBend', perf: 'perf', poly: 'poly' }[TB.skin];
  const archAt = (x) => arches.find((z) => x > z.x0 + 1e-6 && x < z.x1 - 1e-6);
  const snap = (lo, hi) => (nSides ? [phase + Math.ceil((lo - phase) / step - 1e-6) * step, phase + Math.floor((hi - phase) / step + 1e-6) * step] : [lo, hi]);
  const arcsAt = (r, zone) => (zone ? keptArcs(r, cz, tubeY, zone, cutY, nSides) : [FULL]);
  /* Arcs kept at two radii at once: a part with thickness must clear the wheel at its inner and outer edge. */
  const both = (A, B) => {
    const out = [];
    for (const [a0, a1] of A) for (const [b0, b1] of B) for (const k of [-TAU, 0, TAU]) {
      const lo = Math.max(a0, b0 + k), hi = Math.min(a1, b1 + k);
      if (hi - lo > 1e-3) out.push([lo, hi]);
    }
    return out;
  };
  const inRange = (phi, [p0, p1]) => (((phi - p0) % TAU) + TAU) % TAU <= p1 - p0 + 1e-6;
  const intersect = ([a0, a1], [b0, b1]) => {
    for (const k of [-TAU, 0, TAU]) { const lo = Math.max(a0, b0 + k), hi = Math.min(a1, b1 + k); if (hi - lo > 1e-3) return snap(lo, hi); }
    return null;
  };
  const count = nSides || (TB.lengthwise ? Math.max(6, Math.round(s.ledLines)) : Math.round(s.ledLines));
  const angles = Array.from({ length: count }, (_, k) => phase + k * TAU / count);
  const ledOn = nSides ? true : s.ledLines > 0;
  const P = (x, rho, phi) => new Vec3(x, tubeY + rho * Math.sin(phi), cz + rho * Math.cos(phi));
  bom.tubeLen += b - a; bom.sections += Math.ceil((b - a) / 1.22 - 1e-6);

  const cutsArr = [a, b, xbR, xbF]; arches.forEach((z) => cutsArr.push(z.x0, z.x1));
  const cuts = [...new Set(cutsArr.filter((x) => x >= a && x <= b))].sort((p, q) => p - q);
  for (let i = 0; i < cuts.length - 1; i++) {
    const x0 = cuts[i], x1 = cuts[i + 1], len = x1 - x0;
    if (len < 1e-3) continue;
    const r0 = rad(x0), r1 = rad(x1), rm = (r0 + r1) / 2, xm = (x0 + x1) / 2;
    const arch = archAt(xm);
    const runs = arcsAt(rm, arch);
    if (!runs.length) continue;
    const kept = (phi) => runs.some((rg) => inRange(phi, rg));
    const runsIn = arch ? both(runs, arcsAt(Math.min(r0, r1) * 0.9, arch)) : runs;   // glow sleeve and stringers sit inside the skin
    const runsOut = arch ? arcsAt(Math.max(r0, r1) + ledOff + 0.02, arch) : [FULL];
    const keptIn = (phi) => runsIn.some((rg) => inRange(phi, rg));
    const keptOut = (phi) => runsOut.some((rg) => inRange(phi, rg));
    if (skinMat) {
      for (const [p0, p1] of runs) {
        const gg = geo('Cylinder', r1, r0, len, segs, 1, true, -p1, p1 - p0);
        if (TB.skin === 'perf') scaleUV(gg, rm * (p1 - p0) / 0.045, len / 0.045);
        const m = mesh(gg, skinMat, parent); m.rotation.z = -Math.PI / 2; m.position.set(xm, tubeY, cz); m.name = 'Tube skin';
        bom[bomSkin] += len * rm * (p1 - p0);
      }
      if (TB.skin === 'perf') for (const [p0, p1] of runsIn) {
        const mi = mesh(geo('Cylinder', r1 * 0.9, r0 * 0.9, len, segs, 1, true, -p1, p1 - p0), 'glowInner', parent, false);
        mi.rotation.z = -Math.PI / 2; mi.position.set(xm, tubeY, cz);
      }
      for (const phi of [Math.PI / 4, 3 * Math.PI / 4, 5 * Math.PI / 4, 7 * Math.PI / 4]) {
        if (arch && !(keptIn(phi) && keptIn(phi - 0.05) && keptIn(phi + 0.05))) continue;
        F(rod(P(x0, r0 - 0.035, phi), P(x1, r1 - 0.035, phi), 0.012, TB.skin === 'ply' ? 'plyRib' : 'frame', parent, false, 6)).castShadow = false;
        if (TB.skin === 'ply') bom.ribPly += len * 0.04; else bom.hoop += len;
      }
    }
    for (const phi of angles) {
      const ok = (f) => f(phi) && f(phi - 0.05) && f(phi + 0.05);   // members on a facet edge must clear on both sides
      if (arch && !(ok(kept) && ok(keptOut) && (!TB.lengthwise || ok(keptIn)))) continue;
      if (TB.lengthwise === 'ply') { F(boardAlong(x0, r0, x1, r1, phi, 0.08, 0.018, 'plyRib', tubeY, cz, parent)); bom.ribPly += len * 0.08; }
      else if (TB.lengthwise === 'steel') { F(rod(P(x0, r0, phi), P(x1, r1, phi), 0.016, 'frame', parent, false, 6)); bom.hoop += len; }
      if (ledOn) rod(P(x0, r0 + ledOff, phi), P(x1, r1 + ledOff, phi), 0.017, 'led', parent, false, 6).castShadow = false;
    }
  }

  /* ends: speaker, cap, or end rib */
  const openBuild = !TB.skin;
  const cageLen = Math.min(0.5, (b - a) * 0.22);
  for (const [x, dir, outer] of [[a, -1, Math.abs(a - txR) < 1e-6], [b, 1, Math.abs(b - txF) < 1e-6]]) {
    if (archAt(x - dir * 0.01)) continue;
    const r = rad(x);
    if (openBuild) F(finArc(r - 0.08, r, FULL[0], FULL[1], nSides, 0.018, TB.lengthwise === 'ply' ? 'plyRib' : 'frame', x - dir * 0.013, tubeY, cz, parent));
    if (outer && s.speakers === 'tubes') {
      const face = mesh(geo('Ring', r * 0.7, r * 1.005, segs, 1, dir > 0 ? Math.PI - phase : phase), openBuild ? 'speaker' : skinMat, parent);
      face.rotation.y = dir * Math.PI / 2; face.position.set(x, tubeY, cz);
      const h = r * 0.36;
      const cone = mesh(geo('Cylinder', r * 0.7, r * 0.22, h, 48, 1, true), 'speaker', parent);
      cone.rotation.z = -dir * Math.PI / 2; cone.position.set(x - dir * h / 2, tubeY, cz);
      cylX(r * 0.23, 0.02, 'speaker', x - dir * h, tubeY, cz, parent, 32).name = 'Speaker';
      const capS = mesh(geo('Sphere', r * 0.15, 20, 12), 'speaker', parent);
      capS.scale.set(0.5, 1, 1); capS.position.set(x - dir * h * 0.92, tubeY, cz);
      ringArc(r * 0.86, 0.024, 'led', x + dir * 0.012, tubeY, cz, parent, FULL[0], FULL[1], nSides, false);
    } else if (!openBuild) {
      const disc = mesh(geo('Circle', r, segs, dir > 0 ? Math.PI - phase : phase), skinMat, parent);
      disc.rotation.y = dir * Math.PI / 2; disc.position.set(x, tubeY, cz);
      if (outer) ringArc(r * 0.86, 0.022, 'led', x + dir * 0.012, tubeY, cz, parent, FULL[0], FULL[1], nSides, false);
    }
    if (s.endCages && !openBuild) {
      const cageR = ledOff + 0.034;
      const ext = outer ? 0.07 : 0.015, x0 = x + dir * ext, x1 = x - dir * cageLen;
      for (const f of [0, 0.5, 1]) { const xx = x0 + (x1 - x0) * f; ringX(rad(clamp(xx, txR, txF)) + cageR, 0.021, 'frame', xx, tubeY, cz, parent, 48); }
      for (let k = 0; k < 12; k++) {
        const ang = (k + 0.5) * TAU / 12;
        const ra0 = rad(clamp(x0, txR, txF)) + cageR, ra1 = rad(x1) + cageR;
        rod(P(x0, ra0, ang), P(x1, ra1, ang), 0.016, 'frame', parent, false, 6);
      }
    }
  }

  /* rings: structure at every station, plus the chosen finish (under the LED lines) */
  const ribMat = { solid: 'ribSolid', second: 'ribSolid2', match: 'led' }[s.ribStyle];
  const sp = Math.max(0.15, s.ribSpacing);
  const margin = TB.skin && s.endCages ? cageLen + 0.06 : 0.05;
  const origin = (xbF + xbR) / 2;
  const ARC = degToRad(200);
  const out = sgn > 0 ? [-ARC / 2, ARC / 2] : [Math.PI - ARC / 2, Math.PI + ARC / 2];
  for (let k = Math.ceil((a + margin - origin) / sp); origin + k * sp <= b - margin; k++) {
    const x = origin + k * sp;
    const r = rad(x), arch = archAt(x), inBody = x >= xbR - 1e-3 && x <= xbF + 1e-3;
    for (const full of arch ? both(arcsAt(r - 0.1, arch), arcsAt(r + 0.045, arch)) : [FULL]) {
      if (TB.hoop && TB.skin) { F(ringArc(r - 0.03, 0.013, 'frame', x, tubeY, cz, parent, full[0], full[1], nSides, false)); bom.hoop += (r - 0.03) * (full[1] - full[0]); }
      if (TB.lengthwise === 'steel') { F(ringArc(r, 0.018, 'frame', x, tubeY, cz, parent, full[0], full[1], nSides)); bom.hoop += r * (full[1] - full[0]); }
      let finOut = r;
      if (TB.ribs) {
        finOut = r + (TB.skin && s.ribStyle !== 'none' ? 0.03 : 0);
        const rIn = r - (TB.skin ? 0.09 : 0.08);
        F(finArc(rIn, finOut, full[0], full[1], nSides, 0.018, 'plyRib', x, tubeY, cz, parent));
        bom.ribPly += 0.5 * (finOut * finOut - rIn * rIn) * (full[1] - full[0]);
      }
      if (s.ribStyle === 'none') continue;
      const vis = TB.skin && TB.hoop && inBody ? intersect(out, full) : full;
      if (!vis) continue;
      if (TB.skin && TB.hoop) {
        const m = ringArc(r + 0.004, 0.02, ribMat || 'frame', x, tubeY, cz, parent, vis[0], vis[1], nSides, !ribMat);
        if (m) { m.scale.z = 1.6; m.name = 'Ring'; }
      } else if (ribMat) {
        ringArc((TB.ribs ? finOut : r) + (TB.lengthwise === 'steel' ? 0.03 : 0.006), 0.011, ribMat, x, tubeY, cz, parent, vis[0], vis[1], nSides, false);
      }
    }
  }
}

