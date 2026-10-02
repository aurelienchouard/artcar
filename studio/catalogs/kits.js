/* Design kits: decorative structure that carries panels and lights and makes the shape. Never load-bearing. */
import { geo } from '../engine/scene.js';
const TAU = Math.PI * 2;
/* Side-tube constructions (v1): default ring spacing, what the skin is, and what the lengthwise members are. */
export const TUBE_BUILDS = {
  sheet: { label: 'Thin sheet over hoops', spacing: 0.6, skin: 'alu', hoop: true, cost: 2, effort: 2, skills: ['welding'] },
  plyskin: { label: 'Plywood ribs and skin', spacing: 0.4, skin: 'ply', ribs: true, cost: 2, effort: 3, skills: ['cnc', 'woodworking'] },
  lattice: { label: 'Plywood lattice, no skin (Pingüina)', spacing: 0.61, ribs: true, lengthwise: 'ply', cost: 2, effort: 3, skills: ['cnc', 'woodworking'] },
  perforated: { label: 'Perforated metal over hoops', spacing: 0.61, skin: 'perf', hoop: true, cost: 2, effort: 2, skills: ['welding'] },
  translucent: { label: 'Translucent panels, lit inside', spacing: 0.6, skin: 'poly', hoop: true, cost: 3, effort: 2, skills: ['welding'] },
  frame: { label: 'Open metal frame', spacing: 0.45, hoop: true, lengthwise: 'steel', cost: 1, effort: 2, skills: ['welding'] },
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
const TRUCKS = ['cabover', 'cutaway', 'chassis-cab', 'reality-check'];

/* ------------------------------------------------------------------ side: tubes (v1) */
defineKit({
  id: 'side-tubes', category: 'side', name: 'Side tubes (rockets)', builtin: 'tubes',
  description: 'A long tube down each side, on French cleats. Round or faceted, skinned or open.',
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
  platforms: ALL_PLATFORMS, covers: ['side'], costTier: 2, effortTier: 2,
  explainer: 'The classic art-car side tube. It never carries people: it hangs off the deck edge on French cleats and comes off in sections for transport. Faces a front tire would hit at full steering lock are left open.',
});

/* ------------------------------------------------------------------ front: hood and fender cover (v1) */
defineKit({
  id: 'hood-cover', category: 'front', name: 'Simple hood and fender cover', builtin: 'covers',
  description: 'Light panels that follow the stock hood, fenders and engine cover. Grille and headlights stay open.',
  params: { material: pick('Skin', [['match', 'Match the side tubes'], ['alu', 'Aluminum sheet'], ['perf', 'Perforated metal'], ['acm', 'ACM panel'], ['poly', 'Translucent polycarbonate']], 'match') },
  materials: ['aluminum', 'perforated', 'ACM', 'polycarbonate'],
  wheelClearance: 'outboard', riderOpenings: 'n/a',
  transport: { removable: true, note: 'Panels lift off for engine access' },
  look: { day: 'Panels in the body color', night: 'LED edge lines along the hood' },
  platforms: TRUCKS, requires: { open: true }, covers: ['front'], costTier: 1, effortTier: 1,
  explainer: 'Dresses the stock front once the cab is cut away. It follows the factory shapes, keeps the grille and headlights open, and lifts off for engine access.',
});

/* ------------------------------------------------------------------ helpers shared by the kit shapes */
const SKIN_OPTS = (ids) => ids.map((id) => [id, { alu: 'Sheet aluminum', acm: 'ACM panels', perf: 'Perforated metal', coroplast: 'Coroplast', eva: 'EVA foam', poly: 'Translucent polycarbonate', fabric: 'Stretch fabric' }[id]]);
const skinParam = (ids, def) => pick('Skin', SKIN_OPTS(ids), def);
/* Front edge of the vehicle and the top of whatever sits ahead of the driver. */
const frontX = (c) => Math.max(c.xbF, c.vehFront);
const hoodTop = (c) => (c.conv ? c.hoodTop : c.cabFloor + 0.45);
const lerpN = (a, b, t) => a + (b - a) * t;
const smooth = (t) => t * t * (3 - 2 * t);
const clampR = (r) => Math.max(0.22, r);

/* ------------------------------------------------------------------ front kits */
defineKit({
  id: 'three-rockets', category: 'front', name: 'Three-rocket front',
  description: 'Three short rockets over the front: one on the centerline above the hood and one each side.',
  params: { dia: num('Rocket diameter', 0.3, 0.7, 0.42), reach: num('Reach past the front', 0, 1.5, 0.6), spread: num('Side rockets apart', 1.0, 2.6, 1.7), material: skinParam(['alu', 'acm', 'perf', 'poly'], 'alu') },
  materials: ['aluminum', 'ACM', 'perforated', 'polycarbonate'], wheelClearance: 'face-cut', riderOpenings: 'n/a', driverWindow: false,
  transport: { removable: true, note: 'Each rocket lifts off its saddle' }, look: { day: 'Three metal noses', night: 'LED rings at each nose' },
  platforms: ALL_PLATFORMS, covers: ['front'], costTier: 2, effortTier: 2,
  explainer: 'Three rockets over the hood and fenders. They sit on saddles so the hood still opens and the grille stays clear. Keep the center one low or it blocks the driver.',
  parts(T, p) {
    const c = T.car, r = p.dia / 2, x0 = c.xfs + 0.1, x1 = frontX(c) + p.reach, y = hoodTop(c) + r + 0.04;
    for (const z of [0, -p.spread / 2, p.spread / 2]) {
      const yy = z === 0 ? y : Math.max(c.cutY + r + 0.05, y - 0.15);
      T.shell({ name: 'Rocket', material: p.material, x0, x1, step: 0.15, facets: 20, section: (t) => { const k = t > 0.75 ? Math.sqrt(Math.max(0, 1 - ((t - 0.75) / 0.25) ** 2)) : 1; return { zc: z, yc: yy, a: r * Math.max(0.05, k), b: r * Math.max(0.05, k) }; } });
      T.led([[x1 - 0.25, yy + r * 0.66, z], [x1 - 0.25, yy + r * 0.66 + 0.001, z + 0.001]]);
    }
  },
});
defineKit({
  id: 'front-bridge', category: 'front', name: 'Front bridge',
  description: 'Ties the two side tubes together across the front: a flat wing, an arched cowl, or a third intake.',
  params: { variant: pick('Shape', [['wing', 'Flat wing'], ['cowl', 'Arched cowl'], ['intake', 'Third intake']], 'wing'), material: skinParam(['alu', 'acm', 'perf', 'poly'], 'acm') },
  materials: ['aluminum', 'ACM', 'perforated', 'polycarbonate'], wheelClearance: 'outboard', riderOpenings: 'n/a',
  transport: { removable: true, note: 'One piece, two people' }, look: { day: 'A bold front edge', night: 'LED edge along the bridge' },
  platforms: TRUCKS, requires: { kits: ['side-tubes'] }, covers: [], costTier: 2, effortTier: 2,
  explainer: 'A front bridge spans between the side tubes ahead of the hood. It must stay clear of the grille and come off for engine access.',
  parts(T, p) {
    const c = T.car, x = frontX(c) + 0.1, zs = c.W / 2 - c.D / 2, y = c.tubeY + c.D / 2 * 0.6;
    if (p.variant === 'wing') {
      T.panel([[x - 0.45, y, -zs], [x + 0.25, y + 0.02, -zs], [x + 0.25, y + 0.12, 0], [x + 0.25, y + 0.02, zs], [x - 0.45, y, zs], [x - 0.45, y + 0.08, 0]], p.material, 'Wing');
      T.led([[x + 0.26, y + 0.02, -zs], [x + 0.26, y + 0.12, 0], [x + 0.26, y + 0.02, zs]]);
    } else if (p.variant === 'cowl') {
      const yTop = Math.max(hoodTop(c) + 0.25, y + 0.4);
      T.shell({ name: 'Cowl', material: p.material, x0: x - 0.5, x1: x + 0.15, stations: 3, facets: 22, section: () => ({ zc: 0, yc: y - 0.1, a: zs, b: yTop - y + 0.1, th0: 0, th1: Math.PI }) });
    } else {
      const r = Math.min(0.32, c.D / 2 + 0.05), yc = hoodTop(c) + r + 0.05;
      T.shell({ name: 'Intake', material: p.material, x0: x - 0.7, x1: x + 0.3, stations: 4, facets: 22, section: () => ({ zc: 0, yc, a: r, b: r }) });
      T.panel([[x - 0.3, y, -zs], [x - 0.3, yc, -r], [x - 0.3, yc, r], [x - 0.3, y, zs]], p.material, 'Bridge web');
    }
  },
});
defineKit({
  id: 'bullet-nose', category: 'front', name: 'Faceted bullet nose',
  description: 'A faceted nose of flat ACM panels over the whole front, with a window cut for the driver.',
  params: { length: num('Nose length past the front', 0.2, 2.0, 0.7), facets: int('Facets', 6, 12, 8), height: num('Nose height', 0.8, 2.2, 1.35), material: skinParam(['acm', 'alu', 'coroplast', 'poly'], 'acm') },
  materials: ['ACM', 'aluminum', 'coroplast', 'polycarbonate'], wheelClearance: 'face-cut', riderOpenings: 'Window cut in the driver’s sight line', driverWindow: true,
  transport: { removable: true, note: 'Two or three panel sections' }, look: { day: 'Clean faceted planes', night: 'LED lines along every crease' },
  platforms: TRUCKS, covers: ['front'], costTier: 2, effortTier: 2,
  explainer: 'Flat panels folded into facets read as a smooth nose from a distance but are buildable: every panel is a flat cut. Keep the nose short so the driver can see the ground ahead.',
  parts(T, p) {
    const c = T.car, x0 = c.xfs, x1 = frontX(c) + p.length, base = c.groundClear + 0.05, top = Math.min(p.height, c.eye[1] + 0.25);
    const r = T.shell({ name: 'Nose', material: p.material, x0, x1, step: 0.2, facets: p.facets, driverWindow: true, openings: T.openings({ lounge: false }),
      section: (t) => { const k = Math.sqrt(Math.max(0.02, 1 - Math.pow(Math.max(0, t - 0.35) / 0.65, 2))); const h = (top - base) / 2; return { zc: 0, yc: base + h, a: (c.W / 2) * k, b: h * (0.35 + 0.65 * k), e: 2, th0: -Math.PI / 2 + Math.PI / p.facets, th1: 1.5 * Math.PI + Math.PI / p.facets }; } });
    const ridge = r.pts.map((row) => row[Math.round(row.length / 4)]);
    T.led(ridge);
  },
});

/* ------------------------------------------------------------------ side kits */
defineKit({
  id: 'outrigger-pods', category: 'side', name: 'Outrigger pods',
  description: 'Two long pods on struts beside the body, like a catamaran.',
  params: { length: num('Pod length', 1.5, 6, 3.2), dia: num('Pod diameter', 0.3, 0.9, 0.55), gap: num('Gap from the body', 0.05, 0.6, 0.15), material: skinParam(['alu', 'acm', 'poly', 'fabric'], 'alu') },
  materials: ['aluminum', 'ACM', 'polycarbonate', 'fabric'], wheelClearance: 'outboard', riderOpenings: 'n/a',
  transport: { removable: true, note: 'Each pod unpins from its struts' }, look: { day: 'Sleek pods off the sides', night: 'Lit from inside or along the seams' },
  platforms: ALL_PLATFORMS, covers: [], costTier: 2, effortTier: 2,
  explainer: 'Pods sit outboard of the wheels, so they never touch a tire, but they add to the playa width. They come off for transport.',
  parts(T, p) {
    const c = T.car, r = p.dia / 2, xm = (c.lx0 + c.lx1) / 2, y = Math.max(c.groundClear + r + 0.1, c.cutY + 0.05 + r);
    for (const sgn of [-1, 1]) {
      const z = sgn * (c.W / 2 + p.gap + r);
      T.shell({ name: 'Pod', material: p.material, x0: xm - p.length / 2, x1: xm + p.length / 2, step: 0.2, facets: 20, section: (t) => { const k = Math.sqrt(Math.max(0.01, 1 - Math.pow(2 * t - 1, 8))); return { zc: z, yc: y, a: r * k, b: r * k }; } });
      for (const f of [-0.3, 0.3]) T.polyline([[xm + f * p.length, y, z - sgn * r * 0.8], [xm + f * p.length, c.deckY - 0.1, sgn * (c.floorW / 2)]], 0.025, 'steel');
      T.led([[xm - p.length / 2 + 0.2, y + r * 0.7, z], [xm + p.length / 2 - 0.2, y + r * 0.7, z]]);
    }
  },
});
defineKit({
  id: 'skirts', category: 'side', name: 'Skirts',
  description: 'Panels from the deck edge down toward the ground, stepped up over each wheel.',
  params: { clear: num('Ground clearance', 0.2, 0.6, 0.3), flare: num('Flare out at the bottom', 0, 0.3, 0.08), material: skinParam(['coroplast', 'acm', 'alu', 'perf'], 'coroplast') },
  materials: ['coroplast', 'ACM', 'aluminum', 'perforated'], wheelClearance: 'skirt-above', riderOpenings: 'n/a',
  transport: { removable: true, note: 'Panels about 4′ long on clips' }, look: { day: 'A clean hovering base', night: 'Ground glow from LEDs under the edge' },
  platforms: ALL_PLATFORMS, covers: [], costTier: 1, effortTier: 1,
  explainer: 'Skirts hide the frame and wheels and make the car float. Over each wheel the skirt steps up above the tire’s full travel and steering sweep.',
  parts(T, p) {
    const c = T.car, x0 = c.xbR, x1 = frontX(c), yT = c.deckY - 0.04;
    for (const sgn of [-1, 1]) {
      const z = sgn * (c.W / 2 - 0.02), zb = sgn * (c.W / 2 - 0.02 + p.flare);
      let spans = [[x0, x1]];
      const wheelSpans = c.wheelZones.map((w) => [w.x0 - 0.05, w.x1 + 0.05]);
      const cuts = [x0, x1, ...wheelSpans.flat()].filter((x) => x >= x0 && x <= x1).sort((a, b) => a - b);
      for (let i = 0; i < cuts.length - 1; i++) {
        const a = cuts[i], b = cuts[i + 1], xm = (a + b) / 2;
        if (b - a < 0.05) continue;
        const overWheel = wheelSpans.some(([u, v]) => xm > u && xm < v);
        const yb = overWheel ? Math.min(yT - 0.05, c.cutY + 0.04) : p.clear;
        if (yT - yb < 0.05) continue;
        T.panel([[a, yb, overWheel ? z : zb], [b, yb, overWheel ? z : zb], [b, yT, z], [a, yT, z]], p.material, 'Skirt');
      }
      T.led([[x0 + 0.1, p.clear + 0.02, zb], [x1 - 0.1, p.clear + 0.02, zb]]);
    }
  },
});
defineKit({
  id: 'ribcage', category: 'side', name: 'Ribcage hoops',
  description: 'Curved ribs along both sides of the lounge, bowing out from the deck edge to the roof.',
  params: { spacing: num('Rib spacing', 0.3, 1.2, 0.55), bow: num('Bow outward', 0.05, 0.6, 0.3), material: pick('Ribs', [['conduit', 'Bent conduit'], ['steel', 'Steel tube'], ['plywood', 'CNC plywood ribs'], ['hdpe', 'HDPE tube']], 'conduit') },
  materials: ['bent conduit', 'steel', 'CNC plywood ribs', 'HDPE tube'], wheelClearance: 'face-cut', riderOpenings: 'Open between ribs',
  transport: { removable: true, note: 'Each rib unbolts at deck and roof' }, look: { day: 'A skeleton along the sides', night: 'Every rib an LED line' },
  platforms: ALL_PLATFORMS, covers: [], costTier: 1, effortTier: 2,
  explainer: 'Ribs bolt to the deck edge and the roof frame but carry nothing. Riders see out between them.',
  parts(T, p) {
    const c = T.car, top = c.hasRoof ? c.roofBottom : c.deckY + 1.9, xs0 = c.xbR + 0.15, xs1 = c.xfs - 0.1;
    const n = Math.max(2, Math.round((xs1 - xs0) / p.spacing));
    for (let i = 0; i <= n; i++) {
      const x = xs0 + (xs1 - xs0) * i / n;
      for (const sgn of [-1, 1]) {
        const line = [];
        for (let k = 0; k <= 10; k++) {
          const t = k / 10, y = lerpN(c.deckY - 0.05, top, t), bow = Math.sin(Math.PI * t) * p.bow;
          line.push([x, y, sgn * (c.W / 2 + bow - (c.hasRoof ? 0 : t * t * 0.4))]);
        }
        if (p.material === 'plywood') T.band(line, { material: 'plywood', width: 0.08 });
        else { T.polyline(line, 0.016, p.material); T.led(line, 0.008); }
      }
    }
  },
});

/* ------------------------------------------------------------------ full-body shells */
/* A body-hugging loft: half width hw, from bottom yb to top yt, with a profile k(t) along the length. */
function bodyShell(T, p, o) {
  const c = T.car;
  return T.shell({ name: o.name, material: p.material, x0: o.x0, x1: o.x1, step: 0.2, facets: o.facets || 30, driverWindow: true,
    openings: T.openings(), ribs: o.ribs, stringers: o.stringers,
    section: (t) => { const k = o.k(t), h = (o.yt - o.yb) / 2; return { zc: 0, yc: o.yb + h + (o.lift ? o.lift(t) : 0), a: (c.W / 2 + 0.08) * k.w, b: h * k.h, e: o.e || 2.2 }; } });
}
defineKit({
  id: 'pink-fish', category: 'full', name: 'Pink fish',
  description: 'Hoops and a skin over everything: a fat fish body with a tail fin, eyes and a mouth for the driver to see through.',
  params: { tail: num('Tail length past the back', 0.5, 3, 1.4), nose: num('Head past the front', 0, 1.5, 0.5), material: skinParam(['fabric', 'poly', 'eva', 'coroplast'], 'fabric'), color: pick('Hue', [['pink', 'Pink'], ['gold', 'Gold'], ['blue', 'Blue']], 'pink') },
  materials: ['stretch fabric', 'polycarbonate', 'EVA foam', 'coroplast', 'bent conduit hoops'], wheelClearance: 'face-cut', riderOpenings: 'Gills open along the lounge, the back opens over the roof deck, mouth open for the driver', driverWindow: true,
  transport: { removable: true, note: 'Skin unzips; hoops nest' }, look: { day: 'A big friendly fish', night: 'Glows from inside' },
  platforms: ALL_PLATFORMS, covers: ['front', 'side'], costTier: 2, effortTier: 3,
  explainer: 'A full-body shell carried by light hoops on the cage or posts. It covers the whole height, so the rider openings and the driver’s mouth window are cut out of it.',
  parts(T, p) {
    const c = T.car, x0 = c.xbR - p.tail, x1 = frontX(c) + p.nose, yb = c.groundClear, yt = (c.hasRoof ? c.roofTop : c.deckY + 1.6) + 0.25;
    const L = x1 - x0, tailF = p.tail / L;
    const k = (t) => (t < tailF ? { w: 0.15 + 0.85 * smooth(t / tailF), h: 0.25 + 0.75 * smooth(t / tailF) } : { w: Math.sqrt(Math.max(0.02, 1 - Math.pow(Math.max(0, t - 0.82) / 0.18, 2))), h: Math.sqrt(Math.max(0.05, 1 - Math.pow(Math.max(0, t - 0.86) / 0.14, 2))) });
    bodyShell(T, p, { name: 'Fish skin', x0, x1, yb, yt, k, ribs: { every: 0.6, material: 'conduit' } });
    const ym = (yb + yt) / 2;
    T.panel([[x0 + 0.1, ym, 0], [x0 - 1.0, yt + 0.2, 0], [x0 - 0.7, ym, 0], [x0 - 1.0, yb + 0.1, 0]], p.material, 'Tail fin');
    for (const sgn of [-1, 1]) T.solid(geo('Sphere', 0.22, 16, 12), 'eva', x1 - 0.6, ym + 0.35, sgn * (c.W / 2 * 0.62), 3, 'Eye');
  },
});
defineKit({
  id: 'bio-slug', category: 'full', name: 'Bioluminescent slug',
  description: 'Bent conduit hoops with stretched fabric and LEDs behind; the driver looks out through the mouth.',
  params: { head: num('Head height over the roof', 0.2, 1.5, 0.6), tail: num('Tail past the back', 0.5, 3, 1.5), material: skinParam(['fabric', 'poly'], 'fabric') },
  materials: ['bent conduit hoops', 'stretch fabric', 'polycarbonate'], wheelClearance: 'face-cut', riderOpenings: 'Open flanks along the lounge, open back over the roof deck, mouth window for the driver', driverWindow: true,
  transport: { removable: true, note: 'Hoops pull out of sockets; fabric rolls up' }, look: { day: 'A soft draped creature', night: 'A glowing slug with LEDs pulsing under the skin' },
  platforms: ALL_PLATFORMS, covers: ['front', 'side'], costTier: 1, effortTier: 2,
  explainer: 'Conduit hoops bent on a jig, fabric stretched over them, LEDs behind. Light and cheap; the fabric needs a night-first attitude.',
  parts(T, p) {
    const c = T.car, x0 = c.xbR - p.tail, x1 = frontX(c) + 0.3, yb = c.groundClear, top = (c.hasRoof ? c.roofTop : c.deckY + 1.6);
    const L = x1 - x0, tf = p.tail / L;
    const k = (t) => ({ w: t < tf ? 0.2 + 0.8 * smooth(t / tf) : 1 - 0.25 * smooth(Math.max(0, t - 0.85) / 0.15), h: t < tf ? 0.2 + 0.8 * smooth(t / tf) : 1 });
    const yt = (t) => top + 0.15 + (t > 0.7 ? p.head * smooth((t - 0.7) / 0.3) : 0);
    T.shell({ name: 'Slug skin', material: p.material, x0, x1, step: 0.2, facets: 26, driverWindow: true, openings: T.openings(), ribs: { every: 0.5, material: 'conduit' },
      section: (t) => { const kk = k(t), h = (yt(t) - yb) / 2; return { zc: 0, yc: yb + h, a: (c.W / 2 + 0.06) * kk.w, b: h * kk.h, th0: -0.15, th1: Math.PI + 0.15 }; } });
    for (const sgn of [-1, 1]) {
      const bx = x1 - 0.5, by = yt(1) - 0.05, line = [];
      for (let i = 0; i <= 6; i++) { const t = i / 6; line.push([bx + 0.4 * t, by + 0.9 * t, sgn * (0.3 + 0.25 * t)]); }
      T.polyline(line, 0.02, 'hdpe'); T.solid(geo('Sphere', 0.08, 12, 8), 'neon', line[6][0], line[6][1], line[6][2], 0.3, 'Antenna tip');
    }
  },
});
defineKit({
  id: 'pinguina-ribs', category: 'full', name: 'Pingüina-style ribs',
  description: 'CNC plywood ribs hung on French cleats over the full cage, no skin: a lattice you can see through. The head comes off.',
  params: { spacing: num('Rib spacing', 0.3, 0.8, 0.4), head: num('Head length', 0.8, 3, 2.4), belly: num('Belly bulge', 0, 0.5, 0.25) },
  materials: ['CNC plywood ribs'], wheelClearance: 'face-cut', riderOpenings: 'Lattice: riders see out between ribs; open over the roof deck; driver window in the neck', driverWindow: true,
  transport: { removable: true, note: 'Head comes off for engine access and transport; ribs lift off French cleats' }, look: { day: 'A wooden penguin lattice', night: 'LEDs on every rib edge' },
  platforms: TRUCKS, requires: { structure: ['cage'] }, covers: ['front', 'side'], costTier: 3, effortTier: 3, skills: ['cnc', 'woodworking'],
  explainer: 'Pingüina’s construction: a steel cage carries everything, and CNC-cut plywood ribs hang on French cleats to make the shape. The ribs carry nothing but themselves.',
  parts(T, p) {
    const c = T.car, x0 = c.xbR, xHead = frontX(c) - p.head * 0.4, x1 = frontX(c) + p.head * 0.35, yb = c.groundClear + 0.05;
    const top = (c.hasRoof ? c.roofTop : c.deckY + 1.6) + 0.1;
    const body = (t) => ({ w: 1 + p.belly * Math.sin(Math.PI * t) * 0.3, h: 1 });
    const n = Math.max(3, Math.round((xHead - x0) / p.spacing));
    for (let i = 0; i <= n; i++) {
      const t = i / n, x = x0 + (xHead - x0) * t, k = body(t), h = (top - yb) / 2;
      const row = [];
      for (let j = 0; j <= 30; j++) { const th = -0.1 + (Math.PI + 0.2) * j / 30; row.push([x, Math.max(yb, yb + h + h * Math.sin(th)), (c.W / 2 + 0.06) * k.w * Math.cos(th) * (Math.sin(th) < 0 ? 1 : 1 - 0.15 * Math.sin(th))]); }
      T.band(row, { material: 'plywood', width: 0.09 }, T.openings({ lounge: false }), true);
    }
    // head: smaller ribs tapering forward to the beak, removable
    const Th = T.sub('Head');
    const hn = Math.max(3, Math.round((x1 - xHead) / p.spacing));
    for (let i = 0; i <= hn; i++) {
      const t = i / hn, x = xHead + (x1 - xHead) * t, s = Math.sqrt(Math.max(0.05, 1 - t * t)), h = (top - yb) / 2 * (0.55 + 0.45 * s);
      const yc = yb + (top - yb) * 0.62, row = [];
      for (let j = 0; j <= 24; j++) { const th = (TAU) * j / 24; row.push([x, yc + h * 0.6 * Math.sin(th), (c.W / 2) * 0.62 * s * Math.cos(th)]); }
      Th.band(row, { material: 'plywood', width: 0.08 }, [], true);
    }
    Th.solid(geo('Cone', 0.16, 0.4, 12), 'eva', x1 + 0.15, yb + (top - yb) * 0.6, 0, 6, 'Beak', [0, 0, -Math.PI / 2]);
  },
});

/* ------------------------------------------------------------------ train */
defineKit({
  id: 'train', category: 'train', name: 'Locomotive and false cars',
  description: 'A locomotive front, then false car segments with windows and couplings down each side.',
  params: { cars: int('Car segments', 1, 5, 3), style: pick('Locomotive', [['diesel', 'Diesel hood'], ['bullet', 'Rounded streamliner']], 'diesel'), material: skinParam(['alu', 'acm', 'coroplast'], 'acm') },
  materials: ['aluminum', 'ACM', 'coroplast'], wheelClearance: 'skirt-above', riderOpenings: 'Car windows are open; the roof deck stays open', driverWindow: true,
  transport: { removable: true, note: 'Locomotive hood in two pieces, car sides in panels' }, look: { day: 'A little train', night: 'Lit windows and a headlight' },
  platforms: TRUCKS, covers: ['front', 'side'], costTier: 2, effortTier: 2,
  explainer: 'A locomotive hood over the front and car sides along the lounge. The fake bogies sit above the real wheels’ travel.',
  parts(T, p) {
    const c = T.car, xL1 = frontX(c) + 0.4, xL0 = c.xfs - 0.1, yb = c.groundClear + 0.1, yt = Math.max(c.eye[1] - 0.12, hoodTop(c) + 0.3);
    T.shell({ name: 'Locomotive', material: p.material, x0: xL0, x1: xL1, step: 0.2, facets: 20, driverWindow: true, openings: T.openings({ lounge: false }),
      section: (t) => { const k = p.style === 'bullet' ? Math.sqrt(Math.max(0.05, 1 - Math.pow(Math.max(0, t - 0.5) / 0.5, 2))) : t > 0.9 ? 0.85 : 1; const h = (yt - yb) / 2; return { zc: 0, yc: yb + h, a: (c.W / 2) * (p.style === 'bullet' ? k : 1), b: h * (p.style === 'bullet' ? 0.5 + 0.5 * k : 1), e: p.style === 'bullet' ? 2.5 : 6 }; } });
    T.solid(geo('Cylinder', 0.16, 0.16, 0.05, 20), 'head', xL1 + 0.02, (yb + yt) / 2 + 0.2, 0, 1, 'Headlight', [0, 0, Math.PI / 2]);
    const x0 = c.xbR, x1 = c.xfs - 0.15, segL = (x1 - x0) / p.cars, top = c.hasRoof ? c.roofBottom + 0.1 : c.deckY + 1.4;
    for (let i = 0; i < p.cars; i++) {
      const a = x0 + i * segL + 0.08, b = a + segL - 0.16;
      for (const sgn of [-1, 1]) {
        const z = sgn * (c.W / 2);
        T.panel([[a, c.deckY - 0.3, z], [b, c.deckY - 0.3, z], [b, c.deckY + 0.45, z], [a, c.deckY + 0.45, z]], p.material, 'Car side');
        T.panel([[a, top - 0.25, z], [b, top - 0.25, z], [b, top, z], [a, top, z]], p.material, 'Car top');
        for (let k2 = 0; k2 < 2; k2++) { const xb = lerpN(a + 0.3, b - 0.3, k2); if (c.wheelZones.some((w) => xb > w.x0 - 0.3 && xb < w.x1 + 0.3)) continue; T.solid(geo('Cylinder', 0.22, 0.22, 0.04, 18), 'grille', xb, Math.max(c.groundClear + 0.22, 0.3), z, 2, 'Bogie wheel', [Math.PI / 2, 0, 0]); }
      }
      if (i > 0) T.solid(geo('Box', 0.25, 0.12, 0.2), 'frame', a - 0.08, c.deckY - 0.2, 0, 4, 'Coupling');
    }
  },
});

/* ------------------------------------------------------------------ themes */
const THEME_BASE = { platforms: ALL_PLATFORMS, wheelClearance: 'face-cut', transport: { removable: true, note: 'Comes off in sections' }, driverWindow: true };
function theme(k) { return defineKit({ ...THEME_BASE, category: 'theme', covers: ['front', 'side', 'full', 'train'], ...k }); }
theme({
  id: 'centipede', name: 'Centipede', description: 'Segmented body rings down the length, dozens of legs, and a head with antennae.',
  params: { segments: int('Body segments', 4, 14, 8), legs: int('Legs per segment, each side', 1, 3, 2), material: skinParam(['eva', 'coroplast', 'acm', 'fabric'], 'eva') },
  materials: ['EVA foam', 'coroplast', 'ACM', 'fabric', 'HDPE tube legs'], riderOpenings: 'Segments are open hoops over the lounge; roof deck open', look: { day: 'A long armored bug', night: 'Each segment edge lit' },
  costTier: 2, effortTier: 2, explainer: 'Stacked segment hoops and HDPE legs. Legs stay above playa ruts and clear of the wheels.',
  parts(T, p) {
    const c = T.car, x0 = c.xbR, x1 = frontX(c), yb = c.groundClear + 0.15, yt = (c.hasRoof ? c.roofTop : c.deckY + 1.5) + 0.15, seg = (x1 - x0) / p.segments;
    for (let i = 0; i < p.segments; i++) {
      const a = x0 + i * seg + 0.05, b = a + seg - 0.12;
      T.shell({ name: 'Segment', material: p.material, x0: a, x1: b, stations: 3, facets: 22, driverWindow: true, openings: T.openings(), section: (t) => ({ zc: 0, yc: (yb + yt) / 2, a: c.W / 2 + 0.1 + 0.08 * Math.sin(Math.PI * t), b: (yt - yb) / 2 + 0.05 * Math.sin(Math.PI * t), th0: -0.25, th1: Math.PI + 0.25 }) });
      for (const sgn of [-1, 1]) for (let l = 0; l < p.legs; l++) {
        const x = a + (b - a) * (l + 0.5) / p.legs;
        T.polyline([[x, c.deckY - 0.1, sgn * c.W / 2], [x + 0.1, c.deckY + 0.15, sgn * (c.W / 2 + 0.45)], [x + 0.2, c.groundClear + 0.05, sgn * (c.W / 2 + 0.7)]], 0.025, 'hdpe');
      }
    }
    for (const sgn of [-1, 1]) T.polyline([[x1 - 0.2, yt - 0.2, sgn * 0.4], [x1 + 0.4, yt + 0.5, sgn * 0.7], [x1 + 0.9, yt + 0.6, sgn * 0.9]], 0.02, 'hdpe');
  },
});
theme({
  id: 'jellyfish', name: 'Jellyfish', description: 'A glowing translucent bell over the whole car, with tentacles hanging around the edge.',
  params: { tentacles: int('Tentacles', 6, 30, 16), length: num('Tentacle length', 0.4, 1.8, 1.0), material: skinParam(['poly', 'fabric'], 'fabric') },
  materials: ['stretch fabric', 'polycarbonate', 'HDPE tube'], riderOpenings: 'The bell is open at the sides of the lounge; tentacles part for entries', look: { day: 'A big translucent dome', night: 'A pulsing glowing bell' },
  costTier: 2, effortTier: 2, explainer: 'A dome on light hoops, tentacles of HDPE with LED strip inside. Tentacles stop above the ground and away from the wheels.',
  parts(T, p) {
    const c = T.car, x0 = c.xbR - 0.2, x1 = frontX(c) + 0.2, base = c.hasRoof ? c.roofBottom - 0.1 : c.deckY + 1.2, top = (c.hasRoof ? c.roofTop : c.deckY + 1.3) + 1.2;
    T.shell({ name: 'Bell', material: p.material, x0, x1, step: 0.2, facets: 24, driverWindow: true, openings: c.decks.map((d) => [d.dx0 + 0.3, d.dx1 - 0.3, base + 0.6, 50, -(c.W / 2 - 0.4), c.W / 2 - 0.4]), ribs: { every: 0.8, material: 'conduit' },
      section: (t) => { const k = Math.sqrt(Math.max(0.05, 1 - Math.pow(2 * t - 1, 2))); return { zc: 0, yc: base, a: (c.W / 2 + 0.25) * (0.5 + 0.5 * k), b: (top - base) * (0.3 + 0.7 * k), th0: 0, th1: Math.PI }; } });
    for (let i = 0; i < p.tentacles; i++) {
      const u = i / p.tentacles, ang = u * TAU, xm = (x0 + x1) / 2, rx = (x1 - x0) / 2, rz = c.W / 2 + 0.2;
      const x = xm + rx * Math.cos(ang) * 0.95, z = rz * Math.sin(ang);
      if (Math.abs(z) < c.W / 2 - 0.3 && Math.cos(ang) > 0.5) continue;   // keep the driver's view open
      const line = []; for (let k = 0; k <= 6; k++) { const t = k / 6; line.push([x + 0.1 * Math.sin(t * 6 + i), Math.max(c.groundClear + 0.3, base - p.length * t), z * (1 + 0.05 * t)]); }
      T.polyline(line, 0.02, 'hdpe'); T.led(line, 0.008);
    }
  },
});
theme({
  id: 'rhino-beetle', name: 'Rhino beetle', description: 'A glossy split shell over the body and a great horn curving up from the front.',
  params: { horn: num('Horn length', 0.5, 2.5, 1.4), material: skinParam(['acm', 'alu', 'coroplast', 'eva'], 'acm') },
  materials: ['ACM', 'aluminum', 'coroplast', 'EVA foam'], riderOpenings: 'Shell halves part over the lounge sides and roof deck', look: { day: 'Glossy dark shell', night: 'LED seam down the back' },
  costTier: 3, effortTier: 3, explainer: 'Two shell halves on the posts with a seam down the middle. The horn is light foam over conduit and must not cross the driver’s view.',
  parts(T, p) {
    const c = T.car, x0 = c.xbR - 0.3, x1 = frontX(c) + 0.2, yb = c.groundClear + 0.1, yt = (c.hasRoof ? c.roofTop : c.deckY + 1.5) + 0.3;
    for (const sgn of [-1, 1]) T.shell({ name: 'Shell half', material: p.material, x0, x1, step: 0.2, facets: 14, driverWindow: true, openings: T.openings(),
      section: (t) => { const k = Math.sqrt(Math.max(0.03, 1 - Math.pow(2 * t - 1, 4))); const h = (yt - yb) / 2; return { zc: 0, yc: yb + h, a: (c.W / 2 + 0.12) * k, b: h * (0.4 + 0.6 * k), th0: sgn > 0 ? -0.2 : Math.PI / 2 + 0.03, th1: sgn > 0 ? Math.PI / 2 - 0.03 : Math.PI + 0.2 }; } });
    const hx = x1 - 0.3, hy = hoodTop(c) + 0.1, line = [];
    for (let i = 0; i <= 8; i++) { const t = i / 8; line.push([hx + p.horn * 0.6 * t, hy + p.horn * 0.8 * t * t, c.eye[2] > 0 ? -0.4 : 0.4]); }
    T.polyline(line, 0.09, 'eva');
  },
});
theme({
  id: 'anglerfish', name: 'Anglerfish', description: 'A fat-headed fish with a toothy jaw and a glowing lure dangling ahead of the car.',
  params: { lure: num('Lure reach', 0.5, 2.5, 1.5), material: skinParam(['eva', 'fabric', 'coroplast', 'poly'], 'eva') },
  materials: ['EVA foam', 'stretch fabric', 'coroplast', 'polycarbonate'], riderOpenings: 'Gill openings along the lounge; open over the roof deck; the mouth is the driver window', look: { day: 'A grumpy deep-sea fish', night: 'Only the lure glows: very dramatic' },
  costTier: 2, effortTier: 3, explainer: 'The lure hangs above and ahead of the driver; keep it high enough that it never drops into the sight line.',
  parts(T, p) {
    const c = T.car, x0 = c.xbR - 0.6, x1 = frontX(c) + 0.3, yb = c.groundClear + 0.05, yt = (c.hasRoof ? c.roofTop : c.deckY + 1.5) + 0.35;
    bodyShell(T, p, { name: 'Fish skin', x0, x1, yb, yt, k: (t) => ({ w: 0.35 + 0.65 * smooth(Math.min(1, t * 1.6)), h: 0.3 + 0.7 * smooth(Math.min(1, t * 1.4)) }) });
    for (let i = 0; i < 9; i++) { const z = -0.8 + 1.6 * i / 8; T.solid(geo('Cone', 0.05, 0.22, 8), 'eva', x1 - 0.05, c.eye[1] - 0.35, z, 0.2, 'Tooth', [Math.PI, 0, 0]); }
    const line = [[x1 - 0.8, yt, 0], [x1 - 0.2, yt + 0.6, 0], [x1 + p.lure * 0.6, yt + 0.7, 0], [x1 + p.lure, yt + 0.2, 0]];
    T.polyline(line, 0.02, 'steel');
    T.solid(geo('Sphere', 0.14, 16, 12), 'neon', x1 + p.lure, yt + 0.05, 0, 0.5, 'Lure');
  },
});
theme({
  id: 'hover-skiff', name: 'Hover skiff', description: 'An inflated-looking bumper ring around the base, stubby fins at the back: the car floats.',
  params: { ring: num('Ring thickness', 0.2, 0.6, 0.38), material: skinParam(['eva', 'coroplast', 'fabric'], 'eva') },
  materials: ['EVA foam', 'coroplast', 'fabric'], riderOpenings: 'Nothing above the deck', look: { day: 'Cartoon hovercraft', night: 'A ring of ground glow' },
  costTier: 1, effortTier: 1, explainer: 'The skirt ring stays above the wheels’ travel and steps up over the arches.',
  parts(T, p) {
    const c = T.car, x0 = c.xbR - 0.1, x1 = frontX(c) + 0.25, r = p.ring / 2, y = Math.max(c.groundClear + r, c.deckY - r - 0.05);
    for (const sgn of [-1, 1]) T.shell({ name: 'Bumper ring', material: p.material, x0, x1, step: 0.15, facets: 14, section: () => ({ zc: sgn * (c.W / 2 + r * 0.3), yc: y, a: r, b: r }) });
    for (const x of [x0 + 0.05, x1 - 0.05]) T.shell({ name: 'Bumper ring end', material: p.material, x0: x - 0.01, x1: x + 0.01, stations: 1, facets: 14, section: () => ({ zc: 0, yc: y, a: c.W / 2, b: r }) });
    for (const sgn of [-1, 1]) T.panel([[x0, c.deckY, sgn * (c.W / 2 - 0.1)], [x0 - 0.6, c.deckY + 1.0, sgn * (c.W / 2 - 0.2)], [x0 - 0.5, c.deckY + 1.0, sgn * (c.W / 2 - 0.2)], [x0 + 0.5, c.deckY, sgn * (c.W / 2 - 0.1)]], 'acm', 'Fin');
  },
});
theme({
  id: 'moon-lander', name: 'Moon lander', description: 'Four splayed landing legs with footpads, gold foil panels and a dish antenna.',
  params: { legs: num('Leg splay', 0.3, 1.2, 0.7), material: skinParam(['alu', 'acm', 'coroplast'], 'alu') },
  materials: ['aluminum', 'ACM', 'coroplast', 'steel legs'], riderOpenings: 'Panels stop below the lounge openings', look: { day: 'Gold foil and struts', night: 'Landing lights under each pad' },
  costTier: 2, effortTier: 2, explainer: 'Legs are decorative and stop above the ground; they come off for transport.',
  parts(T, p) {
    const c = T.car, xs = [c.xbR + 0.3, frontX(c) - 0.4], top = c.deckY - 0.05;
    for (const x of xs) for (const sgn of [-1, 1]) {
      const foot = [x + (x > c.mid ? 0.4 : -0.4), c.groundClear + 0.05, sgn * (c.W / 2 + p.legs)];
      if (T.inWheel(...foot)) foot[0] += x > c.mid ? 0.6 : -0.6;
      T.polyline([[x, top, sgn * c.W / 2], foot], 0.04, 'steel');
      T.solid(geo('Cylinder', 0.2, 0.25, 0.06, 16), 'rim', foot[0], foot[1], foot[2], 3, 'Footpad');
    }
    for (const sgn of [-1, 1]) T.panel([[c.xbR, c.groundClear + 0.15, sgn * c.W / 2], [c.xfs, c.groundClear + 0.15, sgn * c.W / 2], [c.xfs, c.deckY + 0.35, sgn * c.W / 2], [c.xbR, c.deckY + 0.35, sgn * c.W / 2]], p.material, 'Foil panel');
    if (c.hasRoof) { T.polyline([[c.xbR + 0.3, c.roofTop, 0], [c.xbR + 0.3, c.roofTop + 0.8, 0]], 0.02, 'steel'); T.solid(geo('Sphere', 0.45, 18, 8, 0, TAU, 0, Math.PI / 2.5), 'rim', c.xbR + 0.3, c.roofTop + 0.9, 0, 4, 'Dish', [Math.PI, 0, 0]); }
  },
});
theme({
  id: 'steam-locomotive', name: 'Steam locomotive', description: 'A boiler over the hood, a flared smokestack, a cowcatcher and big fake driving wheels.',
  params: { stack: num('Stack height over the boiler', 0.3, 1.2, 0.7), material: skinParam(['alu', 'acm', 'coroplast'], 'alu') },
  materials: ['aluminum', 'ACM', 'coroplast'], riderOpenings: 'Open cars behind the engine; roof deck open', look: { day: 'Brass and black', night: 'Firebox glow and a headlamp' },
  costTier: 2, effortTier: 3, explainer: 'The boiler sits low over the hood so the driver sees over it; the stack goes on the side away from the driver’s sight line.',
  parts(T, p) {
    // the boiler sits low on the hood, on the passenger side, so its top stays under the driver's eye line
    const c = T.car, x0 = c.xfs + 0.2, x1 = frontX(c) + 0.5, r = clampR(Math.min(0.5, (c.eye[1] - 0.25 - hoodTop(c)) / 1.6)), yc = hoodTop(c) + r * 0.6;
    T.shell({ name: 'Boiler', material: p.material, x0, x1, step: 0.15, facets: 22, section: () => ({ zc: 0.3, yc, a: r, b: r }) });
    T.solid(geo('Cylinder', r * 0.55, r * 0.3, p.stack, 18, 1, true), 'grille', x1 - 0.35, yc + r + p.stack / 2, 0.3, 6, 'Smokestack');
    T.panel([[x1, c.groundClear + 0.05, -c.W / 2 * 0.8], [x1 + 0.6, c.groundClear + 0.05, 0], [x1, c.groundClear + 0.05, c.W / 2 * 0.8], [x1, c.deckY - 0.1, 0]], 'steel', 'Cowcatcher');
    for (const sgn of [-1, 1]) for (let i = 0; i < 3; i++) {
      const x = c.xbR + 0.8 + i * 1.1;
      if (c.wheelZones.some((w) => x > w.x0 - 0.5 && x < w.x1 + 0.5)) continue;
      T.solid(geo('Torus', 0.42, 0.04, 6, 24), 'rim', x, 0.55, sgn * (c.W / 2 + 0.02), 3, 'Driving wheel');
    }
  },
});
theme({
  id: 'viking-longship', name: 'Viking longship', description: 'A planked hull down the sides, a dragon prow and tail, round shields and oars.',
  params: { shields: int('Shields per side', 0, 12, 7), prow: num('Prow height', 0.5, 2.5, 1.6), material: skinParam(['coroplast', 'acm', 'alu', 'eva'], 'coroplast') },
  materials: ['coroplast', 'ACM', 'aluminum', 'EVA foam', 'plywood shields'], riderOpenings: 'The hull stops at the gunwale below the lounge openings', look: { day: 'Planked hull and painted shields', night: 'LED gunwale and a glowing dragon eye' },
  costTier: 2, effortTier: 2, explainer: 'The hull is a skirt shaped like a boat: it stays below the riders and steps up over the wheels.',
  parts(T, p) {
    const c = T.car, x0 = c.xbR - 0.5, x1 = frontX(c) + 0.6, yg = c.deckY + 0.4;
    for (const sgn of [-1, 1]) T.shell({ name: 'Hull', material: p.material, x0, x1, step: 0.2, facets: 8, section: (t) => { const k = Math.sqrt(Math.max(0.02, 1 - Math.pow(2 * t - 1, 6))); return { zc: 0, yc: yg, a: (c.W / 2 + 0.1) * k, b: yg - c.groundClear - 0.05, th0: sgn > 0 ? -Math.PI / 2 : Math.PI, th1: sgn > 0 ? 0 : 1.5 * Math.PI }; } });
    const prow = []; for (let i = 0; i <= 8; i++) { const t = i / 8; prow.push([x1 + 0.4 * t, yg + p.prow * t, 0]); }
    T.polyline(prow, 0.12, 'eva'); T.solid(geo('Sphere', 0.22, 14, 10), 'eva', x1 + 0.45, yg + p.prow + 0.1, 0, 2, 'Dragon head');
    const tail = []; for (let i = 0; i <= 6; i++) { const t = i / 6; tail.push([x0 - 0.3 * t, yg + 1.0 * t * t, 0]); }
    T.polyline(tail, 0.1, 'eva');
    for (const sgn of [-1, 1]) for (let i = 0; i < p.shields; i++) {
      const x = c.xbR + 0.4 + (c.xfs - c.xbR - 0.8) * (i + 0.5) / p.shields;
      T.solid(geo('Cylinder', 0.3, 0.3, 0.03, 20), 'ply', x, yg - 0.1, sgn * (c.W / 2 + 0.12), 2.5, 'Shield', [Math.PI / 2, 0, 0]);
    }
  },
});
theme({
  id: 'stealth-wedge', name: 'Stealth wedge', description: 'Flat angled panels: a low faceted wedge over the front and sides.',
  params: { rake: num('Wedge rake', 0.2, 0.9, 0.5), material: skinParam(['acm', 'alu', 'coroplast'], 'acm') },
  materials: ['ACM', 'aluminum', 'coroplast'], riderOpenings: 'Wedge stops below the lounge openings and the roof deck', look: { day: 'Matte black planes', night: 'Thin LED lines on every edge' },
  costTier: 2, effortTier: 2, explainer: 'Every panel is a flat cut: cheap to make, crisp to look at. Faces over the wheels are left out.',
  parts(T, p) {
    const c = T.car, x0 = c.xbR - 0.1, x1 = frontX(c) + 0.9, y0 = c.groundClear + 0.05, y1 = c.deckY + 0.4;
    T.shell({ name: 'Wedge', material: p.material, x0, x1, step: 0.3, facets: 6, driverWindow: true, openings: T.openings(),
      section: (t) => { const k = t > 0.7 ? 1 - (t - 0.7) / 0.3 * (1 - p.rake * 0.3) : 1; const h = (y1 - y0) / 2 * (t > 0.7 ? Math.max(0.15, 1 - (t - 0.7) / 0.3) : 1); return { zc: 0, yc: y0 + h, a: (c.W / 2 + 0.05) * k, b: h, e: 1.2, th0: -Math.PI / 2 + Math.PI / 6, th1: 1.5 * Math.PI + Math.PI / 6 }; } });
  },
});
theme({
  id: 'saucer-rim', name: 'Saucer rim', description: 'A flying-saucer rim all the way around the car at deck height.',
  params: { out: num('Rim reach past the body', 0.1, 0.8, 0.45), material: skinParam(['alu', 'acm', 'poly'], 'alu') },
  materials: ['aluminum', 'ACM', 'polycarbonate'], riderOpenings: 'Below the riders', look: { day: 'Chrome rim', night: 'Chasing lights around the rim' },
  costTier: 2, effortTier: 2, explainer: 'The rim widens the car on the playa; it comes off in sections to pack under 8′6″.',
  parts(T, p) {
    const c = T.car, xm = (c.xbR + frontX(c)) / 2, rx = (frontX(c) - c.xbR) / 2 + p.out, rz = c.W / 2 + p.out, y = c.deckY - 0.05;
    const ring = (ox, oy) => { const pts = []; for (let i = 0; i <= 48; i++) { const a = i / 48 * TAU; pts.push([xm + (rx - ox) * Math.cos(a), y + oy, (rz - ox) * Math.sin(a)]); } return pts; };
    const outer = ring(0, 0), top = ring(p.out, 0.18), bot = ring(p.out, -0.18);
    for (let i = 0; i < 48; i++) {
      T.panel([top[i], top[i + 1], outer[i + 1], outer[i]], p.material, 'Rim');
      T.panel([outer[i], outer[i + 1], bot[i + 1], bot[i]], p.material, 'Rim');
    }
    T.led(outer, 0.012);
  },
});
theme({
  id: 'shinkansen', name: 'Shinkansen', description: 'A long smooth bullet-train nose over the front and streamlined sides.',
  params: { nose: num('Nose length past the front', 0.5, 6, 3.5), height: num('Nose height', 1.0, 3.0, 2.3), material: skinParam(['fabric', 'poly', 'acm', 'alu'], 'fabric'), window: flag('Cut a driver window', false) },
  materials: ['stretch fabric', 'polycarbonate', 'ACM', 'aluminum'], riderOpenings: 'Open along the lounge and over the roof deck', look: { day: 'Long white nose and a blue stripe', night: 'Glowing nose and stripe' },
  expects: { axles: 4, why: 'A Shinkansen car rides on two bogies, four axles; a two-axle truck under it looks wrong and the overhangs grow huge.' },
  costTier: 3, effortTier: 3, explainer: 'The real thing is a smooth compound curve: very hard to build. A long, tall nose also puts the whole front in the driver’s face.',
  parts(T, p) {
    const c = T.car, x0 = c.xbR - 0.4, x1 = frontX(c) + p.nose, yb = c.groundClear + 0.05, yt = Math.max(p.height, (c.hasRoof ? c.roofBottom : c.deckY + 1.2));
    const front0 = (c.xfs - x0) / (x1 - x0);
    T.shell({ name: 'Nose and body', material: p.material, x0, x1, step: 0.2, facets: 26, driverWindow: !!p.window, openings: T.openings(),
      section: (t) => { const u = Math.max(0, (t - front0) / (1 - front0)); const k = 1 - smooth(u) * 0.97; const h = (yt - yb) / 2; return { zc: 0, yc: yb + h * (1 - 0.55 * smooth(u)), a: (c.W / 2 + 0.06) * Math.sqrt(k), b: h * k, e: 2.4 }; } });
    for (const sgn of [-1, 1]) T.led([[x0, c.deckY + 0.1, sgn * (c.W / 2 + 0.07)], [c.xfs, c.deckY + 0.1, sgn * (c.W / 2 + 0.07)]], 0.03);
  },
});
theme({
  id: 'mixer-drum', name: 'Drum lounge', description: 'A light barrel-shaped shell around the lounge, painted with a spiral: the cement-mixer look without the cement truck.',
  params: { tilt: num('Tilt toward the back', 0, 0.4, 0.15), material: skinParam(['alu', 'coroplast', 'acm', 'poly'], 'coroplast') },
  materials: ['coroplast', 'aluminum', 'ACM', 'polycarbonate'], riderOpenings: 'Wide windows along both sides of the lounge; open over the roof deck', look: { day: 'A big striped drum', night: 'A glowing spiral' },
  costTier: 2, effortTier: 2, explainer: 'The drum is a skin on hoops around the lounge, not a real mixer drum: it weighs a fraction and riders sit inside it.',
  parts(T, p) {
    const c = T.car, x0 = c.xbR + 0.1, x1 = c.xfs, yb = c.deckY - 0.1, yt = (c.hasRoof ? c.roofTop : c.deckY + 1.9) + 0.1;
    // a band of windows along each side keeps the drum shape while riders see out
    const big = 50, wy0 = c.deckY + 0.75, wy1 = Math.min(yt - 0.5, c.deckY + 1.6), side = c.floorW / 2 - 0.3;
    const win = [[c.lx0 + 0.3, c.lx1 - 0.3, wy0, wy1, -big, -side], [c.lx0 + 0.3, c.lx1 - 0.3, wy0, wy1, side, big], ...c.decks.map((dk) => [dk.dx0, dk.dx1, c.roofTop - 0.06, big, -big, big])];
    const r = T.shell({ name: 'Drum', material: p.material, x0, x1, step: 0.2, facets: 28, driverWindow: true, openings: win.concat(T.openings({ lounge: false })), ribs: { every: 0.9, material: 'conduit' },
      section: (t) => { const k = 0.85 + 0.15 * Math.sin(Math.PI * t); const h = (yt - yb) / 2; return { zc: 0, yc: yb + h + p.tilt * (0.5 - t), a: (c.W / 2 + 0.08) * k, b: h * k, th0: -0.3, th1: Math.PI + 0.3 }; } });
    const spiral = []; for (let i = 0; i <= 80; i++) { const t = i / 80, th = -0.3 + (Math.PI + 0.6) * ((t * 5) % 1); const row = r.pts[Math.min(r.pts.length - 1, Math.round(t * (r.pts.length - 1)))]; const j = Math.round((th + 0.3) / (Math.PI + 0.6) * (row.length - 1)); spiral.push(row[j]); }
    T.led(spiral, 0.015);
  },
});
