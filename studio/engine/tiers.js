/* Cost and effort tiers (section 4.9): every option carries points; totals map to bands from the rules table. */
import { R } from '../catalogs/rules.js';
import { POINTS } from '../catalogs/tiers.js';
import { TUBE_BUILDS, BUILDS } from '../catalogs/kits.js';
import { MATERIALS } from '../catalogs/materials.js';

const band = (list, v) => list.find(([lim]) => v <= lim)[1];
export const stepTier = (p) => (p <= 0 ? 0 : p === 1 ? 1 : p <= 3 ? 2 : 3);
export function bandOf(points, kind) {
  const b2 = R(kind === 'cost' ? 'costBand2' : 'effortBand2'), b3 = R(kind === 'cost' ? 'costBand3' : 'effortBand3');
  return points >= b3 ? 3 : points >= b2 ? 2 : 1;
}
export function tierTotals(d, s, C, g) {
  const steps = {};
  const lines = [];
  const add = (step, [c, e], label) => {
    if (!c && !e) return;
    steps[step] = steps[step] || [0, 0];
    steps[step][0] += c; steps[step][1] += e;
    lines.push({ step, label, cost: c, effort: e });
  };
  add(1, [C.costTier || 2, C.effortTier || 2], C.short);
  if (C.style === 'cart') { add(2, d.strip.rops ? POINTS.rops.kept : POINTS.rops.removed, d.strip.rops ? 'Keep the roll bar' : 'Remove the roll bar'); if (!d.strip.bed) add(2, [0, 1], 'Remove the cargo bed'); }
  else add(2, POINTS.strip[d.strip.level], { stock: 'Stock cab', cut: 'Cut at the windshield base', rails: 'Strip to frame rails' }[d.strip.level]);
  add(3, POINTS.structure[d.structure.style], 'Structure style');
  add(3, POINTS.material[d.structure.material], 'Aluminum secondary members');
  add(3, band(POINTS.size, g.bodyL * g.floorW), 'Deck size');
  if (s.roofDeck) {
    add(4, POINTS.upper[d.upper.kind], 'Upper deck');
    add(4, POINTS.access[d.upper.access], 'Access');
    add(4, POINTS.coverage[d.upper.coverage], 'Deck coverage');
  }
  add(5, POINTS.seating[d.layout.seating], 'Lower seating');
  if (g.rearLen > 0) add(5, POINTS.rear[d.layout.rear], 'Rear section');
  for (const z of g.zones) add(5, POINTS.zone, z.name);
  for (const k of s.kits || []) {
    if (k.id === 'side-tubes') { const tb = TUBE_BUILDS[k.p.build] || TUBE_BUILDS.sheet; add(6, [Math.max(k.def.costTier, tb.cost), Math.max(k.def.effortTier, tb.effort)], `Side tubes, ${tb.label.toLowerCase()}`); continue; }
    const m = MATERIALS[k.p.material] || buildOf(k.p);
    add(6, [Math.max(k.def.costTier, m ? m.cost : 0), Math.max(k.def.effortTier, m ? m.effort : 0)], k.def.name);
  }
  add(7, POINTS.leds, 'LED lines and edges');
  if (g.projectorCount) add(7, POINTS.projectors, 'Projectors');
  add(7, POINTS.speakers[s.speakers] || [0, 0], 'Speakers');
  if (s.speakers !== 'none' && s.speakerSize === 'large') add(7, POINTS.speakerLarge, 'Large speakers');
  add(8, band(POINTS.battery, s.batteryKwh), 'Battery bank');
  if (s.power === 'generator') add(8, POINTS.generator, 'Generator');
  const cost = Object.values(steps).reduce((a, v) => a + v[0], 0), effort = Object.values(steps).reduce((a, v) => a + v[1], 0);
  const perStep = Object.fromEntries(Object.entries(steps).map(([k, [c, e]]) => [k, { cost: stepTier(c), effort: stepTier(e), points: [c, e] }]));
  return { cost: bandOf(cost, 'cost'), effort: bandOf(effort, 'effort'), points: [cost, effort], perStep, lines };
}

/* What a cover kit is built from: metal, plywood (skinned or an open lattice) or fabric. */
export const buildOf = (p) => (p && p.build ? (p.build === 'plywood' && p.finish === 'lattice' ? BUILDS.lattice : BUILDS[p.build]) : null);
/* The crew skills this build needs, from the choices made: an output, never a brief input. */
export const SKILL_LABEL = { welding: 'Welding', cnc: 'CNC cutting', woodworking: 'Woodworking', electrical: 'Electrical', mechanical: 'Mechanical' };
export function requiredSkills(d, s) {
  const need = new Map();
  const want = (skill, what) => { if (!need.has(skill)) need.set(skill, []); if (!need.get(skill).includes(what)) need.get(skill).push(what); };
  if (d.strip.level !== 'stock' && s.strip !== 'cart') want('mechanical', d.strip.level === 'rails' ? 'stripping to the frame and moving the driver’s controls' : 'cutting the cab at the windshield base');
  want('welding', 'the steel structure');
  if (d.structure.material === 'alu') want('welding', 'aluminum secondary members (TIG)');
  if (d.upper.kind !== 'none' || d.layout.seating !== 'platform') want('woodworking', d.upper.kind !== 'none' ? 'decking, seating and the rear section' : 'seating and the rear section');
  want('electrical', 'lights, sound and power');
  for (const k of s.kits || []) {
    const skills = new Set(k.def.skills || []);
    if (k.id === 'side-tubes') (TUBE_BUILDS[k.p.build]?.skills || []).forEach((x) => skills.add(x));
    const m = MATERIALS[k.p.material] || buildOf(k.p); if (m) m.skills.forEach((x) => skills.add(x));
    for (const sk of skills) want(sk, k.def.name.toLowerCase());
  }
  const order = ['mechanical', 'welding', 'woodworking', 'cnc', 'electrical'];
  return [...need.entries()].sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0])).map(([skill, what]) => ({ skill, label: SKILL_LABEL[skill] || skill, what }));
}
