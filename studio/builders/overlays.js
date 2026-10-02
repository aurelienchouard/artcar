/* Overlays: dimension lines, the driver's view cone, trailer models for the packed view, a reference silhouette. */
import { MAT } from './materials.js';
import { fmtLen } from '../engine/units.js';
const T = window.THREE;

function label(text, scale = 0.35) {
  const c = document.createElement('canvas'), ctx = c.getContext('2d');
  ctx.font = '600 44px "Barlow Condensed", "Arial Narrow", sans-serif';
  const w = Math.ceil(ctx.measureText(text).width) + 28;
  c.width = w; c.height = 64;
  ctx.font = '600 44px "Barlow Condensed", "Arial Narrow", sans-serif';
  ctx.fillStyle = 'rgba(28,33,48,.86)'; ctx.fillRect(0, 0, w, 64);
  ctx.fillStyle = '#ffd35a'; ctx.textBaseline = 'middle'; ctx.fillText(text, 14, 34);
  const tex = new T.CanvasTexture(c); tex.colorSpace = T.SRGBColorSpace;
  const sp = new T.Sprite(new T.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  sp.scale.set(scale * w / 64, scale, 1); sp.renderOrder = 20;
  return sp;
}
function seg(g, a, b) {
  const geo = new T.BufferGeometry().setFromPoints([new T.Vector3(...a), new T.Vector3(...b)]);
  const l = new T.Line(geo, MAT.overlay); l.renderOrder = 19; g.add(l);
}
function dim(g, a, b, text, tick = 0.12) {
  seg(g, a, b);
  const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const n = Math.abs(d[1]) > Math.abs(d[0]) ? [tick, 0, 0] : [0, tick, 0];
  for (const p of [a, b]) seg(g, [p[0] - n[0], p[1] - n[1], p[2] - n[2]], [p[0] + n[0], p[1] + n[1], p[2] + n[2]]);
  const sp = label(text); sp.position.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + 0.18, (a[2] + b[2]) / 2); g.add(sp);
}
/* Body-builder dimensions: wheelbase, bumper to axle (BA), cab to axle (CA), frame height, track. */
export function dimsOverlay(E, units) {
  const g = new T.Group(); g.name = 'Dimensions';
  const { fa, ra, cabBackX } = E.g, C = E.C, s = E.s, L = (m) => fmtLen(m, units);
  const z = -(s.track / 2 + 0.9), y = 0.05;
  dim(g, [ra, y, z], [fa, y, z], `Wheelbase ${L(fa - ra)}`);
  dim(g, [fa, y + 0.45, z], [fa + C.ba, y + 0.45, z], `BA ${L(C.ba)}`);
  if (C.style !== 'cart') dim(g, [ra, s.frameHeight + 0.35, z], [cabBackX, s.frameHeight + 0.35, z], `CA ${L(cabBackX - ra)}`);
  dim(g, [ra - 0.25, 0, z], [ra - 0.25, s.frameHeight, z], `Frame ${L(s.frameHeight)}`);
  dim(g, [fa + C.ba + 0.5, y, -s.track / 2], [fa + C.ba + 0.5, y, s.track / 2], `Track ${L(s.track)}`);
  return g;
}
/* The driver's view cone: its outline in green, and a red dot wherever a sight line is blocked. */
export function viewConeViz(view) {
  const g = new T.Group(); g.name = 'View cone';
  if (!view) return g;
  const [nH, nV] = view.grid, edge = [], hits = [];
  view.rays.forEach((r, k) => {
    const i = Math.floor(k / nH), j = k % nH;
    if (r.hit) hits.push(view.eye[0] + r.d[0] * r.t, view.eye[1] + r.d[1] * r.t, view.eye[2] + r.d[2] * r.t);
    const onEdge = i === 0 || i === nV - 1 || j === 0 || j === nH - 1;
    if (onEdge && (j === 0 || j === nH - 1 || j % 4 === 0)) { const t = Math.min(r.t, 5); edge.push(...view.eye, view.eye[0] + r.d[0] * t, view.eye[1] + r.d[1] * t, view.eye[2] + r.d[2] * t); }
  });
  if (edge.length) { const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.Float32BufferAttribute(edge, 3)); const l = new T.LineSegments(geo, MAT.rayClear); l.renderOrder = 18; g.add(l); }
  if (hits.length) {
    const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.Float32BufferAttribute(hits, 3));
    const pts = new T.Points(geo, new T.PointsMaterial({ color: 0xff5a4a, size: 9, sizeAttenuation: false, depthTest: false, transparent: true }));
    pts.renderOrder = 19; g.add(pts);
  }
  return g;
}
/* Simple trailer models: deck, wheels, and the gooseneck, tongue or tow-truck cab that tells them apart. */
export function trailerModel(id, tr, carLen, carRearX) {
  const g = new T.Group(); g.name = 'Trailer';
  if (id === 'drive') return g;
  const deckY = tr.deck, len = Number.isFinite(tr.len) ? Math.max(tr.len, carLen) : carLen + 1, w = Math.min(2.59, tr.width || 2.59);
  const x0 = carRearX - 0.3, x1 = x0 + len;
  const box = (sx, sy, sz, mat, x, y, z) => { const m = new T.Mesh(new T.BoxGeometry(sx, sy, sz), mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; g.add(m); return m; };
  const wheel = (x, z, r = 0.4) => { const m = new T.Mesh(new T.CylinderGeometry(r, r, 0.3, 24), MAT.rubber); m.rotation.x = Math.PI / 2; m.position.set(x, r, z); g.add(m); };
  box(len, 0.12, w, MAT.trailerDeck, (x0 + x1) / 2, deckY - 0.06, 0);
  box(len, Math.max(0.1, deckY - 0.35), 0.2, MAT.trailer, (x0 + x1) / 2, Math.max(0.3, deckY / 2 + 0.15), -w / 2 + 0.3);
  box(len, Math.max(0.1, deckY - 0.35), 0.2, MAT.trailer, (x0 + x1) / 2, Math.max(0.3, deckY / 2 + 0.15), w / 2 - 0.3);
  const r = Math.min(0.45, Math.max(0.28, deckY * 0.45));
  for (const x of [x0 + 0.8, x0 + 2.0]) for (const z of [-w / 2 + 0.25, w / 2 - 0.25]) wheel(x, z, id === 'lowboy' ? 0.38 : r);
  if (id === 'stepdeck' || id === 'lowboy') {
    const up = id === 'lowboy' ? 1.35 : 1.55;
    box(3.0, 0.15, w, MAT.trailerDeck, x1 + 1.5, up, 0);
    box(0.4, up - deckY, w - 0.4, MAT.trailer, x1 + 0.2, (up + deckY) / 2, 0);
    box(3.2, 2.6, 2.4, MAT.cab, x1 + 4.8, 1.8, 0);
    for (const x of [x1 + 2.5, x1 + 3.8, x1 + 6.0]) for (const z of [-0.95, 0.95]) wheel(x, z, 0.5);
  } else if (id === 'rollback') {
    box(2.2, 2.3, 2.3, MAT.cab, x1 + 1.3, 1.55, 0);
    for (const x of [x1 + 1.3, x0 + 1.4]) for (const z of [-0.95, 0.95]) wheel(x, z, 0.5);
  } else if (id === 'flatbed') {
    box(3.2, 2.6, 2.4, MAT.cab, x1 + 2.0, 2.0, 0);
  } else if (id === 'equipment') {
    const t = new T.Mesh(new T.CylinderGeometry(0.05, 0.05, 2.2, 8), MAT.trailer); t.rotation.z = Math.PI / 2; t.position.set(x1 + 1.1, deckY * 0.8, 0); g.add(t);
  }
  return g;
}
/* A side-view reference image, scaled to a given length, for checking proportions against a manufacturer drawing. */
export function silhouettePlane(url, lengthM, xCenter, yBase, opacity) {
  const tex = new T.TextureLoader().load(url);
  tex.colorSpace = T.SRGBColorSpace;
  const mat = new T.MeshBasicMaterial({ map: tex, transparent: true, opacity, depthWrite: false, side: T.DoubleSide });
  const m = new T.Mesh(new T.PlaneGeometry(1, 1), mat);
  m.name = 'Reference silhouette';
  m.userData.aspect = 1;
  const img = new Image();
  img.onload = () => { const h = lengthM * img.height / img.width; m.scale.set(lengthM, h, 1); m.position.set(xCenter, yBase + h / 2, 0); };
  img.src = url;
  m.scale.set(lengthM, lengthM * 0.3, 1); m.position.set(xCenter, yBase + lengthM * 0.15, 0);
  m.renderOrder = 15;
  return m;
}
