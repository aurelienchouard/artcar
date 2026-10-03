/* Design kits: decorative structure that carries panels and lights and makes the shape. Never load-bearing. */
import { geo } from '../engine/scene.js';
import { R } from './rules.js';
const TAU = Math.PI * 2;
/* Side-tube constructions (v1): default ring spacing, what the skin is, and what the lengthwise members are. */
export const TUBE_BUILDS = {   // family: metal or plywood, for the design step's first choice
  sheet: { family: 'metal', label: 'Thin sheet over hoops', spacing: 0.6, skin: 'alu', hoop: true, cost: 2, effort: 2, skills: ['welding'] },
  plyskin: { family: 'plywood', label: 'Plywood ribs and skin', spacing: 0.4, skin: 'ply', ribs: true, cost: 2, effort: 3, skills: ['cnc', 'woodworking'] },
  lattice: { family: 'plywood', label: 'Plywood lattice, no skin', spacing: 0.61, ribs: true, lengthwise: 'ply', cost: 2, effort: 3, skills: ['cnc', 'woodworking'] },
  perforated: { family: 'metal', label: 'Perforated metal over hoops', spacing: 0.61, skin: 'perf', hoop: true, cost: 2, effort: 2, skills: ['welding'] },
  translucent: { family: 'metal', label: 'Translucent panels, lit inside', spacing: 0.6, skin: 'poly', hoop: true, cost: 3, effort: 2, skills: ['welding'] },
  frame: { family: 'metal', label: 'Open metal frame', spacing: 0.45, hoop: true, lengthwise: 'steel', cost: 1, effort: 2, skills: ['welding'] },
};

/* Kit parameter helpers. */
const num = (label, min, max, def, step = 0.01, fmt = 'len') => ({ type: 'num', label, min, max, def, step, fmt });
const int = (label, min, max, def) => ({ type: 'int', label, min, max, def, step: 1 });
const pick = (label, options, def) => ({ type: 'enum', label, options, def });
const flag = (label, def) => ({ type: 'bool', label, def });
export const P = { num, int, pick, flag };

/* The catalog. Each kit declares the full kit contract (see engine/kits.js for how it is evaluated):
   category, params, materials, wheelClearance, riderOpenings, transport, look, platforms, cost and effort tiers,
   explainer, and parts(car, p): the generic parts it is made of. */
export const KITS = {};
export function defineKit(k) { KITS[k.id] = k; return k; }

const ALL_PLATFORMS = ['cart', 'utility', 'cabover', 'cutaway', 'chassis-cab', 'reality-check'];

/* ------------------------------------------------------------------ cover: side tubes (v1), with the hood cover on trucks */
defineKit({
  id: 'side-tubes', category: 'cover', name: 'Side tubes', builtin: 'tubes',
  description: 'The classic art car: a long tube down each side on French cleats, and light panels over the hood and fenders on a truck.',
  params: {
    build: pick('Construction', Object.entries(TUBE_BUILDS).map(([k, t]) => [k, t.label]), 'perforated'),
    shape: pick('Shape', [['round', 'Round'], ['faceted', 'Faceted']], 'round'),
    sides: int('Sides', 5, 10, 5),
    dia: num('Tube diameter', 0.4, 1.3, 0.7),
    lift: num('Ground clearance', 0.1, 0.6, 0.4),
    front: num('Sticks out past the front', 0, 2.5, 0.61),
    rear: num('Sticks out past the back', 0, 2.5, 0.305),
    taper: num('Taper past the body', 0, 0.45, 0.4, 0.01, 'taper'),
    spacing: num('Ring spacing', 0.2, 2, 0.61),
    endCages: flag('Caged tube ends', false),
  },
  materials: ['aluminum', 'perforated', 'plywood ribs', 'polycarbonate', 'steel frame'],
  wheelClearance: 'face-cut', riderOpenings: 'Sits below the rider openings; acts as a bolster beside the lounge.',
  transport: { removable: true, note: 'Sections about 4′ long on French cleats' },
  look: { day: 'Metal or wood skin with bare rings', night: 'LED lines along each tube, glowing rings' },
  platforms: ALL_PLATFORMS, costTier: 2, effortTier: 2,
  explainer: 'The classic art-car side tube. It never carries people: it hangs off the deck edge on French cleats and comes off in sections for transport. On a truck, light panels follow the hood and fenders so the engine is covered too. Faces a front tire would hit at full steering lock are left open.',
});


/* ------------------------------------------------------------------ helpers shared by the shapes */
const lerpN = (a, b, t) => a + (b - a) * t;
const smooth = (t) => t * t * (3 - 2 * t);
/* What a cover is built from: the skin, and the hoops or ribs that carry it. */
export const BUILDS = {
  metal: { label: 'Metal', skin: 'alu', ribs: { every: 0.6, material: 'conduit' }, cost: 2, effort: 2, skills: ['welding'], note: 'Aluminum sheet on bent steel hoops: durable, rattles a little, shines at night.' },
  plywood: { label: 'Plywood', skin: 'plyskin', ribs: { every: 0.4, material: 'plywood', width: 0.09 }, cost: 2, effort: 3, skills: ['cnc', 'woodworking'], note: 'CNC-cut plywood ribs on French cleats with a bent plywood skin: warm, paintable, heavier.' },
  lattice: { label: 'Plywood lattice', skin: null, ribs: { every: 0.32, material: 'plywood', width: 0.09 }, cost: 2, effort: 3, skills: ['cnc', 'woodworking'], note: 'CNC plywood ribs with no skin, like Pingüina: you see through it, and LEDs trace every rib.' },
  fabric: { label: 'Stretch fabric', skin: 'fabric', ribs: { every: 0.6, material: 'conduit' }, cost: 1, effort: 2, skills: [], note: 'Fabric over conduit hoops: the easiest curves, but it sags and dusts up by day.',
    warning: 'Fabric looks bad by day: it sags, flaps and collects dust. Fine for a night-only look; otherwise pick a rigid skin.' },
};
const buildParam = (ids, def) => pick('Built from', ids.map((id) => [id, BUILDS[id].label]), def);
/* Where a car's front cover starts and how high it may go: over the engine and below the driver's sight line. */
const frontX = (c) => Math.max(c.xbF, c.vehFront);
export function noseStart(c) {
  if (c.isCart) return c.bumperX - 0.7;
  if (c.conv) return Math.max(c.xfs, c.cabFrontX - 0.05);
  return c.hasCab ? c.cabFrontX - 0.05 : Math.max(c.xfs, c.driverX + 0.5);
}
export function frontTop(c) {
  if (c.isCart) return c.cabFloor + 0.74;
  if (c.conv) return c.hoodTop + 0.16;
  return c.cabFloor + 0.55;
}
const sideTop = (c) => c.deckY + 0.45;
/* The driver's lowest sight line ahead (the view cone's bottom edge): fronts slope under it instead of being cut. */
export const sightY = (c, x) => c.eye[1] - Math.tan((R('viewConeDown') + 4) * Math.PI / 180) * Math.max(0, x - c.eye[0]) - 0.05;   // a little under the cone's edge
const hugTop = (c) => frontTop(c) - 0.12;   // just over the hood, cowl or front panel
const noseTop = (c, x, top) => Math.max(hugTop(c), Math.min(top, sightY(c, x)));
/* Sides: one open-topped hull per side (vertical at the rail line, rounding under toward the frame). */
function sideHulls(T, o) {
  const c = T.car, yb = c.groundClear, e = o.e || 4;
  const bands = o.bands || [[0, 1, o.skin, o.render]];   // [from, to] share of the section from the rail line down, skin, render
  for (const sgn of [-1, 1]) {
    const lo = -Math.PI / 2 + 0.55, span = Math.PI / 2 - 0.55;   // +Z side: from under the hull up to the rail line
    let top = null;
    for (const [f0, f1, skin, render] of bands) {
      const a0 = -f1 * span, a1 = -f0 * span;   // angles below the rail line
      const r = T.shell({ name: o.name, material: skin, render, x0: o.x0, x1: o.x1, step: 0.2, facets: Math.max(3, Math.round(12 * (f1 - f0))), openings: T.openings(), driverWindow: true, ribs: f0 === 0 ? o.ribs : null,
        hugY: hugTop(c), stringers: !skin && o.ribs ? { at: [0.08, 0.3, 0.55, 0.8, 1], material: 'plyslat', r: 0.02 } : null,
        section: (t, x) => { const tp = o.top(x), k = o.k ? o.k(t) : 1; return { zc: 0, yc: tp, a: o.a(x) * k, b: (tp - yb) * (o.kb ? o.kb(t) : 1), e,
          th0: sgn > 0 ? Math.max(lo, a0) : Math.PI - a1, th1: sgn > 0 ? a1 : Math.min(1.5 * Math.PI - 0.55, Math.PI - a0) }; } });
      if (f0 === 0) top = r;
    }
    if (o.led !== false && top) T.led(top.pts.map((row) => row[sgn > 0 ? row.length - 1 : 0]).map((p) => [p[0], p[1] + 0.01, p[2]]));
  }
}
/* A closed piece over the front: from the driver area forward, the engine fully covered, a window cut for the driver. */
function nose(T, o) {
  const c = T.car, yb = c.groundClear;
  return T.shell({ name: o.name || 'Nose', material: o.skin, render: o.render, x0: o.x0, x1: o.x1, step: 0.15, facets: o.facets || 26, driverWindow: o.window !== false, openings: T.openings({ lounge: false }), ribs: o.ribs,
    hugY: hugTop(c), stringers: !o.skin && o.ribs ? { at: [0.2, 0.35, 0.5, 0.65, 0.8], material: 'plyslat', r: 0.02 } : null,
    section: (t, x) => { const top = o.top(t, x), k = o.k(t), h = (top - yb) / 2; return { zc: 0, yc: yb + h + (o.dy ? o.dy(t) : 0), a: o.a * k, b: h * (o.kb ? o.kb(t) : k), e: o.e || 3, th0: o.th0, th1: o.th1 }; } });
}
/* A closed tail behind the body. */
function tail(T, o) {
  const c = T.car, yb = c.groundClear;
  return T.shell({ name: 'Tail', material: o.skin, x0: o.x0, x1: o.x1, step: 0.15, facets: 22, ribs: o.ribs,
    section: (t) => { const k = 0.25 + 0.75 * smooth(t), h = (o.top - yb) / 2; return { zc: 0, yc: yb + h, a: o.a * k, b: h * (0.45 + 0.55 * k), e: o.e || 3 }; } });
}
const skinOf = (p) => (BUILDS[p.build] && p.finish !== 'lattice' ? BUILDS[p.build].skin : null);
const ribsOf = (p) => (p.build === 'plywood' && p.finish === 'lattice' ? BUILDS.lattice.ribs : (BUILDS[p.build] || BUILDS.metal).ribs);
const finishParam = pick('Plywood finish', [['skin', 'Skinned'], ['lattice', 'Open lattice, no skin']], 'skin');
/* Portholes or windows along each side, clear of the wheels, steps and entries. */
function along(c, x0, x1, every, pad = 0.3) {
  const xs = [];
  for (let x = x0; x <= x1 + 1e-6; x += every) {
    if (c.wheelZones.some((w) => x > w.x0 - pad && x < w.x1 + pad)) continue;
    if (c.steps.some((st) => Math.abs(x - st.x) < st.w / 2 + pad)) continue;
    xs.push(x);
  }
  return xs;
}

/* ------------------------------------------------------------------ cover: rocket ship */
defineKit({
  id: 'rocket', category: 'cover', name: 'Rocket ship',
  description: 'The car is the rocket: a rounded hull down both sides, a nose cone over the engine, portholes, fins and glowing nozzles at the back.',
  params: { build: buildParam(['metal', 'plywood'], 'metal'), finish: finishParam, nose: num('Nose cone past the front', 0.3, 1.8, 0.9), tail: num('Tail past the back', 0.4, 2, 1.0), portholes: flag('Portholes', true) },
  materials: ['aluminum sheet', 'plywood', 'bent conduit or CNC ribs'], wheelClearance: 'face-cut', riderOpenings: 'The hull stops at the rail line; the lounge and roof stay open; a window is cut in the nose for the driver', driverWindow: true,
  transport: { removable: true, note: 'Hull sections about 4′ long on French cleats; the nose cone lifts off for engine access' },
  look: { day: 'A silver or painted rocket', night: 'LED lines along the hull edge, glowing nozzles' },
  platforms: ALL_PLATFORMS, costTier: 2, effortTier: 2,
  explainer: 'A hull down each side up to the rail line, a nose cone that wraps the whole front including the engine, and a tapered tail with fins. It hangs on the frame; it never carries people.',
  parts(T, p) {
    const c = T.car, skin = skinOf(p), ribs = ribsOf(p), xn = noseStart(c), x1 = frontX(c) + p.nose, x0 = c.xbR - p.tail, yb = c.groundClear;
    const a = c.W / 2 + 0.04, top = sideTop(c), fTop = Math.max(frontTop(c), top);
    sideHulls(T, { name: 'Hull', skin, ribs, x0: c.xbR, x1: xn + 0.3, top: () => top, a: () => a });
    nose(T, { name: 'Nose cone', skin, ribs, x0: xn, x1, a, top: (t, x) => noseTop(c, x, fTop), k: (t) => (t < 0.35 ? 1 : Math.sqrt(Math.max(0.01, 1 - Math.pow((t - 0.35) / 0.65, 2)))) });
    const Tt = T.sub('Tail');
    tail(Tt, { skin, ribs, x0, x1: c.xbR + 0.02, a, top });
    const ym = (yb + top) / 2;
    for (const sgn of [-1, 1]) {   // fins: one out to each side, one down-and-out
      Tt.panel([[c.xbR - 0.1, ym + 0.05, sgn * a * 0.8], [x0 + 0.1, ym, sgn * a * 0.5], [x0 - 0.35, ym - 0.05, sgn * (a + 0.35)], [c.xbR - 0.5, ym + 0.02, sgn * (a + 0.15)]], skin || 'acm', 'Fin');
      Tt.panel([[c.xbR - 0.1, ym - 0.15, sgn * a * 0.6], [x0 + 0.1, ym - 0.1, sgn * a * 0.3], [x0 - 0.3, yb + 0.02, sgn * (a * 0.55)], [c.xbR - 0.45, yb + 0.05, sgn * a * 0.7]], skin || 'acm', 'Fin');
      const nz = Tt.solid(geo('Cone', 0.2, 0.42, 18, 1, true), 'rim', x0 - 0.05, ym, sgn * a * 0.38, 4, 'Nozzle', [0, 0, -Math.PI / 2]);
      nz.position.x = x0 + 0.12;
      Tt.solid(geo('Circle', 0.17, 18), 'neon', x0 - 0.09, ym, sgn * a * 0.38, 0.2, 'Nozzle glow', [0, -Math.PI / 2, 0]);
    }
    if (p.portholes) for (const x of along(c, c.xbR + 0.5, xn - 0.4, 1.0)) for (const sgn of [-1, 1]) {
      const y = ym + 0.1, z = sgn * (a * Math.pow(Math.max(0, 1 - Math.pow((top - y) / (top - yb), 4)), 0.25) + 0.02);
      T.solid(geo('Torus', 0.15, 0.03, 8, 20), 'chrome', x, y, z, 0.6, 'Porthole');
      T.solid(geo('Circle', 0.15, 20), 'tint', x, y, z + sgn * 0.005, 0.3, 'Porthole glass', [0, sgn > 0 ? 0 : Math.PI, 0]);
    }
  },
});

/* ------------------------------------------------------------------ cover: penguin (Pingüina-like) */
defineKit({
  id: 'penguin', category: 'cover', name: 'Penguin',
  description: 'A tobogganing penguin, like Pingüina: a ribbed body up the sides, a round head over the engine with eyes and an orange beak, flippers and feet.',
  params: { build: buildParam(['plywood', 'metal'], 'plywood'), finish: pick('Plywood finish', [['skin', 'Skinned'], ['lattice', 'Open lattice, no skin']], 'lattice'), belly: num('Belly bulge', 0, 0.35, 0.18), head: num('Head past the front', 0.2, 1.2, 0.5) },
  materials: ['CNC plywood ribs', 'plywood or aluminum skin', 'white panels', 'EVA beak'], wheelClearance: 'face-cut', riderOpenings: 'Open along the lounge; the head stays below the driver’s eye line with a window cut where it rises', driverWindow: true,
  transport: { removable: true, note: 'The head lifts off for engine access; ribs come off their French cleats' },
  look: { day: 'A wooden or painted penguin', night: 'LEDs trace the ribs; glowing eyes' },
  platforms: ALL_PLATFORMS, costTier: 3, effortTier: 3,
  explainer: 'Pingüina’s approach: the steel frame carries everything; ribs hang on French cleats to make the body, and a separate head covers the engine. The ribs carry nothing but themselves.',
  parts(T, p) {
    const c = T.car, skin = skinOf(p), ribs = ribsOf(p), xn = noseStart(c), yb = c.groundClear;
    const top = c.hasRoof ? Math.min(c.roofBottom - 0.12, c.deckY + 1.3) : c.deckY + 0.9, a0 = c.W / 2 + 0.04;
    const xb0 = c.xbR - 0.35, xb1 = xn + 0.3;
    sideHulls(T, { name: 'Body', skin, ribs, x0: xb0, x1: xb1, top: () => top, e: 3, a: (x) => a0 + p.belly * Math.sin(Math.PI * Math.min(1, Math.max(0, (x - xb0) / (xb1 - xb0)))), k: (t) => (t < 0.08 ? 0.75 + 0.25 * smooth(t / 0.08) : 1),
      bands: skin ? [[0, 0.45, skin], [0.45, 1, 'white']] : null });
    const H = T.sub('Head');
    const hx1 = frontX(c) + p.head, hTop = Math.max(frontTop(c) + 0.15, sideTop(c)), ha = c.W / 2 * 0.86;
    const headSpec = { skin, ribs, x0: xn - 0.1, x1: hx1, a: ha, top: (t, x) => noseTop(c, x, hTop), e: 2.4, k: (t) => (t < 0.45 ? 0.9 + 0.1 * smooth(t / 0.45) : Math.sqrt(Math.max(0.02, 1 - Math.pow((t - 0.45) / 0.55, 2)))), kb: (t) => (t < 0.45 ? 1 : 0.35 + 0.65 * Math.sqrt(Math.max(0, 1 - Math.pow((t - 0.45) / 0.55, 2)))) };
    const r = nose(H, { ...headSpec, name: 'Head', th0: -0.35, th1: Math.PI + 0.35 });   // black crown
    if (skin) nose(H, { ...headSpec, name: 'Chest', skin: 'white', ribs: null, th0: Math.PI + 0.35, th1: 2 * Math.PI - 0.35 });   // white chest underneath
    const hy = (yb + noseTop(c, hx1 - 0.4, hTop)) / 2 + 0.05;
    H.solid(geo('Cone', 0.17, 0.5, 14), 'accent', hx1 + 0.12, hy, 0, 5, 'Beak', [0, 0, -Math.PI / 2]);
    const ex = hx1 - 0.55;
    for (const sgn of [-1, 1]) {
      H.solid(geo('Sphere', 0.15, 16, 12), 'hdpe', ex, hy + 0.18, sgn * ha * 0.62, 1, 'Eye');
      H.solid(geo('Sphere', 0.07, 12, 8), 'speaker', ex + 0.09, hy + 0.2, sgn * ha * 0.66, 0.2, 'Pupil');
      // flippers at the front of the lounge, feet under the tail
      const fx = Math.min(c.lx1 - 0.3, xn - 0.6), fy = c.deckY + 0.25;
      if (!c.wheelZones.some((w) => fx > w.x0 - 0.2 && fx - 1.0 < w.x1 + 0.2 && fy - 0.3 < c.cutY)) T.panel([[fx, fy + 0.15, sgn * (a0 + 0.02)], [fx - 1.0, fy - 0.3, sgn * (a0 + 0.42)], [fx - 0.7, fy + 0.1, sgn * (a0 + 0.08)]], skin || 'acm', 'Flipper');
      T.panel([[c.xbR - 0.1, yb + 0.03, sgn * 0.2], [c.xbR - 0.8, yb + 0.03, sgn * 0.05], [c.xbR - 0.8, yb + 0.03, sgn * 0.6]], 'accent', 'Foot');
    }
    tail(T, { skin, ribs, x0: c.xbR - 0.6, x1: xb0 + 0.05, a: a0 * 0.75, top: top * 0.8 });
    if (!skin) H.led(r.pts.map((row) => row[Math.round(row.length / 4)]));
  },
});

/* ------------------------------------------------------------------ cover: bullet train */
defineKit({
  id: 'bullet-train', category: 'cover', name: 'Bullet train',
  description: 'A TGV or Shinkansen: a long smooth nose over the engine, slab sides with a color stripe, and a train-car band along the roof edge.',
  params: { build: buildParam(['metal', 'plywood', 'fabric'], 'metal'), finish: finishParam, nose: num('Nose past the front', 0.4, 3.5, 1.1), height: num('Nose height', 0.6, 2.4, 0.6), band: flag('Train-car band along the roof edge', true), window: flag('Window cut for the driver', true) },
  materials: ['aluminum sheet', 'plywood', 'stretch fabric', 'ACM stripe'], wheelClearance: 'face-cut', riderOpenings: 'The lounge is the window band; the nose has a window cut for the driver', driverWindow: true,
  transport: { removable: true, note: 'Nose in two pieces; side panels about 4′ long; the roof band unbolts' },
  look: { day: 'A clean white train with a stripe', night: 'LED line along the stripe and a lit nose' },
  platforms: ALL_PLATFORMS, costTier: 2, effortTier: 3,
  explainer: 'The nose is the hard part: a long compound curve. Keep it low so the driver sees the ground ahead; the stripe and the roof band sell the train look more than the nose does.',
  parts(T, p) {
    const c = T.car, skin = skinOf(p), ribs = ribsOf(p), xn = noseStart(c), x1 = frontX(c) + p.nose, yb = c.groundClear;
    const a = c.W / 2 + 0.03, top = sideTop(c), fTop = Math.max(frontTop(c), top, yb + p.height);
    sideHulls(T, { name: 'Side', skin, ribs, x0: c.xbR, x1: xn + 0.3, top: () => top, a: () => a, e: 7, led: false });
    const r = nose(T, { name: 'Nose', skin, ribs, x0: xn, x1, a, e: 3, window: p.window,
      top: (t, x) => { const tt = t < 0.25 ? fTop : lerpN(fTop, yb + 0.32, Math.pow((t - 0.25) / 0.75, 1.4)); return p.window === false ? tt : Math.max(Math.min(tt, hugTop(c)), Math.min(tt, sightY(c, x))); },
      k: (t) => (t < 0.3 ? 1 : Math.pow(Math.max(0.02, 1 - Math.pow((t - 0.3) / 0.7, 2)), 0.6)), kb: () => 1 });
    tail(T, { skin, ribs, x0: c.xbR - 0.45, x1: c.xbR + 0.02, a, top, e: 5 });
    for (const sgn of [-1, 1]) {   // stripe along each side, split at the entries
      let spans = [[c.xbR - 0.3, xn + 0.2]];
      for (const st of c.steps.filter((s) => s.sgn === sgn)) spans = spans.flatMap(([u, v]) => (st.x + st.w / 2 < u || st.x - st.w / 2 > v ? [[u, v]] : [[u, st.x - st.w / 2 - 0.05], [st.x + st.w / 2 + 0.05, v]]).filter(([q, w]) => w - q > 0.1));
      for (const [u, v] of spans) {
        T.panel([[u, c.deckY + 0.06, sgn * (a + 0.012)], [v, c.deckY + 0.06, sgn * (a + 0.012)], [v, c.deckY + 0.22, sgn * (a + 0.012)], [u, c.deckY + 0.22, sgn * (a + 0.012)]], 'accent', 'Stripe');
        T.led([[u + 0.05, c.deckY + 0.04, sgn * (a + 0.02)], [v - 0.05, c.deckY + 0.04, sgn * (a + 0.02)]]);
      }
      T.solid(geo('Circle', 0.08, 16), 'head', x1 - 0.35, yb + 0.3, sgn * 0.32, 0.3, 'Headlight', [0, Math.PI / 2, 0]);
      if (p.band && c.hasRoof) {
        const zb = sgn * (Math.max(c.W, c.roofW) / 2 + 0.012);
        T.panel([[c.rx0, c.roofBottom - 0.22, zb], [c.rx1, c.roofBottom - 0.22, zb], [c.rx1, c.roofTop + 0.03, zb], [c.rx0, c.roofTop + 0.03, zb]], skin || 'acm', 'Roof band');
      }
    }
    if (p.band && c.hasRoof) T.panel([[c.rx1 + 0.01, c.roofBottom - 0.22, -c.roofW / 2], [c.rx1 + 0.01, c.roofBottom - 0.22, c.roofW / 2], [c.rx1 + 0.01, c.roofTop + 0.03, c.roofW / 2], [c.rx1 + 0.01, c.roofTop + 0.03, -c.roofW / 2]], skin || 'acm', 'Roof band front');
    T.led(r.pts.map((row) => row[Math.round(row.length / 4)]));
  },
});

/* ------------------------------------------------------------------ full body shells */
const SKIN_OPTS = (ids) => ids.map((id) => [id, { alu: 'Sheet aluminum', acm: 'ACM panels', coroplast: 'Coroplast', eva: 'EVA foam', poly: 'Translucent polycarbonate', fabric: 'Stretch fabric' }[id]]);
const skinParam = (ids, def) => pick('Skin', SKIN_OPTS(ids), def);
/* The mouth of a full shell: a wide slot in front of the driver from just over the hood up past the eye line, so
   the driver looks out of it the way they'd look through a windshield. */
export function mouth(c, x1) {
  const bottom = Math.min(hugTop(c) + 0.04, sightY(c, x1) - 0.1);
  return [c.driverX + 0.25, x1 + 2, bottom, c.eye[1] + 0.5, -(c.floorW / 2 - 0.15), c.floorW / 2 - 0.15];
}
/* One loft over everything: from the ground clearance to above the roof, wide enough to clear the roof edge, with
   the lounge gills, the decks and the driver's mouth cut out. Hoops every 0.6 m carry it. */
function wholeShell(T, p, o) {
  const c = T.car, yb = c.groundClear, e = 3;
  const yt = (c.hasRoof ? c.roofTop : c.deckY + 1.6) + 0.3, h = (yt - yb) / 2, yc = yb + h;
  const need = Math.max(c.W, c.roofW || 0) / 2 + 0.1, q = c.hasRoof ? Math.min(0.92, (c.roofTop + 0.04 - yc) / h) : 0;
  const a = need / Math.pow(1 - Math.pow(q, e), 1 / e);
  return T.shell({ name: o.name, material: p.material, render: o.render, x0: o.x0, x1: o.x1, step: 0.2, facets: 34, driverWindow: false,
    openings: T.openings({ extra: [mouth(c, o.x1)] }), ribs: { every: 0.6, material: 'conduit' },
    section: (t) => { const k = o.k(t); return { zc: 0, yc: yc + (o.lift ? o.lift(t) : 0), a: a * k.w, b: h * k.h, e }; } });
}
defineKit({
  id: 'pink-fish', category: 'full', name: 'Pink fish',
  description: 'One skin over everything, sides, front and engine included: a fat fish with a tail fin, big eyes and a mouth the driver looks out of.',
  params: { tail: num('Tail past the back', 0.5, 3, 1.4), nose: num('Head past the front', 0, 1.5, 0.5), material: skinParam(['coroplast', 'poly', 'eva', 'fabric'], 'coroplast'), color: pick('Hue', [['pink', 'Pink'], ['gold', 'Gold'], ['blue', 'Blue']], 'pink') },
  materials: ['coroplast', 'polycarbonate', 'EVA foam', 'stretch fabric', 'bent conduit hoops'], wheelClearance: 'face-cut', riderOpenings: 'Gills open along the lounge, the top opens over the roof deck, the mouth opens for the driver', driverWindow: true,
  transport: { removable: true, note: 'Skin panels unclip; hoops nest' }, look: { day: 'A big friendly fish', night: 'Glows from inside' },
  platforms: ALL_PLATFORMS, costTier: 2, effortTier: 3,
  explainer: 'A full-body shell: hoops on the frame and posts carry one skin over the whole car, front and engine included, wide enough to clear the roof. The lounge gills, the roof deck and the driver’s mouth are cut out of it.',
  parts(T, p) {
    const c = T.car, x0 = c.xbR - p.tail, x1 = frontX(c) + p.nose, L = x1 - x0, tailF = p.tail / L;
    const k = (t) => (t < tailF ? { w: 0.15 + 0.85 * smooth(t / tailF), h: 0.25 + 0.75 * smooth(t / tailF) } : { w: Math.sqrt(Math.max(0.02, 1 - Math.pow(Math.max(0, t - 0.84) / 0.16, 2))), h: Math.sqrt(Math.max(0.05, 1 - Math.pow(Math.max(0, t - 0.88) / 0.12, 2))) });
    const hue = p.material === 'fabric' || p.material === 'poly' ? null : { pink: 'huePink', gold: 'hueGold', blue: 'hueBlue' }[p.color];   // painted skins take the fish's hue
    const r = wholeShell(T, p, { name: 'Fish skin', x0, x1, k, render: hue });
    const yb = c.groundClear, yt = (c.hasRoof ? c.roofTop : c.deckY + 1.6) + 0.3, ym = (yb + yt) / 2;
    T.panel([[x0 + 0.1, ym, 0], [x0 - 1.0, yt + 0.2, 0], [x0 - 0.7, ym, 0], [x0 - 1.0, yb + 0.1, 0]], p.material, 'Tail fin', hue);
    const row = r.pts[Math.max(0, r.pts.length - 1 - Math.round(0.9 / 0.2))], eyeY = mouth(c, x1)[3] + 0.2;
    const at = row.filter((q) => q[2] > 0).reduce((m, q) => (Math.abs(q[1] - eyeY) < Math.abs(m[1] - eyeY) ? q : m), row[0]);
    for (const sgn of [-1, 1]) {
      T.solid(geo('Sphere', 0.26, 16, 12), 'hdpe', at[0], at[1], sgn * (Math.abs(at[2]) - 0.05), 3, 'Eye');
      T.solid(geo('Sphere', 0.12, 12, 8), 'speaker', at[0] + 0.08, at[1] + 0.03, sgn * (Math.abs(at[2]) + 0.12), 0.3, 'Pupil');
    }
  },
});
defineKit({
  id: 'bio-slug', category: 'full', name: 'Glowing slug',
  description: 'Bent conduit hoops with stretched fabric and LEDs behind, over the whole car; the head rises at the front and the driver looks out through the mouth.',
  params: { head: num('Head height over the roof', 0.2, 1.2, 0.5), tail: num('Tail past the back', 0.5, 3, 1.5), material: skinParam(['fabric', 'poly'], 'fabric') },
  materials: ['bent conduit hoops', 'stretch fabric', 'polycarbonate'], wheelClearance: 'face-cut', riderOpenings: 'Open flanks along the lounge, open over the roof deck, mouth window for the driver', driverWindow: true,
  transport: { removable: true, note: 'Hoops pull out of sockets; fabric rolls up' }, look: { day: 'A soft draped creature', night: 'A glowing slug with LEDs pulsing under the skin' },
  platforms: ALL_PLATFORMS, costTier: 1, effortTier: 2,
  explainer: 'Conduit hoops bent on a jig, fabric stretched over them, LEDs behind. Light and cheap; fabric needs a night-first attitude.',
  parts(T, p) {
    const c = T.car, x0 = c.xbR - p.tail, x1 = frontX(c) + 0.3, L = x1 - x0, tf = p.tail / L;
    const k = (t) => ({ w: t < tf ? 0.2 + 0.8 * smooth(t / tf) : 1 - 0.25 * smooth(Math.max(0, t - 0.85) / 0.15), h: t < tf ? 0.2 + 0.8 * smooth(t / tf) : 1 });
    wholeShell(T, p, { name: 'Slug skin', x0, x1, k, lift: (t) => (t > 0.7 ? p.head * smooth((t - 0.7) / 0.3) * 0.5 : 0) });
    const yt = (c.hasRoof ? c.roofTop : c.deckY + 1.6) + 0.3;
    for (const sgn of [-1, 1]) {
      const bx = x1 - 0.5, by = yt + p.head * 0.5, line = [];
      for (let i = 0; i <= 6; i++) { const t = i / 6; line.push([bx + 0.4 * t, by + 0.9 * t, sgn * (0.3 + 0.25 * t)]); }
      T.polyline(line, 0.02, 'hdpe'); T.solid(geo('Sphere', 0.08, 12, 8), 'neon', line[6][0], line[6][1], line[6][2], 0.3, 'Antenna tip');
    }
  },
});
