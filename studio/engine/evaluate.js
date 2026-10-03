/* One call that runs the whole engine on a design: model, weights, riders, tipping, transport, DMV, driver view,
   power, tiers, teardown, scorecard and flags. Pure: no three.js, no DOM. */
import { params, sanitize } from './state.js';
import { vehicleOf } from '../catalogs/vehicles.js';
import { buildCar } from './model/car.js';
import { buildWeights } from './weight.js';
import { riderCount } from './riders.js';
import { tipping } from './tipping.js';
import { measure, transportCheck } from './transport.js';
import { dmvCheck } from './dmv.js';
import { viewCone } from './viewcone.js';
import { powerBudget } from './power.js';
import { tierTotals, requiredSkills } from './tiers.js';
import { teardownPlan } from './teardown.js';
import { bodyLimits } from './limits.js';
import { scorecard, collectFlags } from './scorecard.js';

export const STEPS = [
  { id: 'brief', title: 'Brief', q: 'What do we want?' },
  { id: 'vehicle', title: 'Vehicle', q: 'What are we building on?' },
  { id: 'strip', title: 'Strip down', q: 'How much of the base vehicle do we keep?' },
  { id: 'structure', title: 'Structure', q: 'What steel carries everything?' },
  { id: 'upper', title: 'Upper deck', q: 'Is there a second level, and what kind?' },
  { id: 'layout', title: 'Layout', q: 'What happens on each level?' },
  { id: 'design', title: 'Design', q: 'What shape does it take?' },
  { id: 'lights', title: 'Lights and sound', q: 'How does it glow and sound?' },
  { id: 'power', title: 'Power', q: 'How does it run all night?' },
  { id: 'transport', title: 'Transport', q: 'What comes off, and how does it get to the playa?' },
];
const RANK = { ok: 0, info: 0, na: 0, amber: 1, red: 2 };

/* A blank design (no vehicle yet) has nothing to measure: an empty evaluation the UI knows how to show. */
function blankEvaluation(d) {
  return { d, blank: true, score: [], flags: [], red: [], flagIds: new Set(), skills: [],
    tiers: { cost: 0, effort: 0, points: [0, 0], perStep: {}, lines: [] },
    steps: STEPS.map((st) => ({ ...st, status: 'ok', items: [] })) };
}
export function evaluate(design, opts = {}) {
  const d = opts.trusted ? design : sanitize(design);
  if (!d.vehicle.id) return blankEvaluation(d);
  const s = params(d), C = vehicleOf(d.vehicle.id);
  // the bank and the bay are outputs: size them from the loads, and rebuild once if the bay changed size
  let model = buildCar(s, C), power = powerBudget(model.root, model.geom, s, { auto: true });
  s.batteryKwh = power.bankKwh;
  if (power.bay !== s.powerBaySize) { s.powerBaySize = power.bay; model = buildCar(s, C); power = powerBudget(model.root, model.geom, s, { auto: true }); }
  const g = model.geom;
  const w = buildWeights(g, s, C);
  const rc = riderCount(g, C, w.buildKg);
  const tip = tipping(g, s, C, w.items, rc);
  const dims = measure(model.root, s);
  const tr = transportCheck(dims, s, C, g, w.buildKg);
  const dmv = dmvCheck(g, dims, s);
  const view = opts.viewCone === false ? null : viewCone(model.root, g);
  const tiers = tierTotals(d, s, C, g);
  const skills = requiredSkills(d, s);
  const teardown = teardownPlan(g, s, w);
  const limits = bodyLimits(s, C);
  const E = { d, s, C, model, g, w, rc, tip, dims, tr, dmv, view, power, tiers, skills, teardown, limits };
  E.score = scorecard(E, d);
  E.flags = collectFlags(E, d);
  E.steps = STEPS.map((st, i) => {
    const items = [...E.score.filter((l) => l.step === i && l.id !== 'cost' && l.id !== 'effort'), ...E.flags.filter((f) => f.step === i).map((f) => ({ ...f, status: f.severity }))];
    const worst = items.reduce((a, x) => (RANK[x.status] > RANK[a] ? x.status : a), 'ok');
    return { ...st, status: worst, items };
  });
  E.red = [...E.score.filter((l) => l.status === 'red').map((l) => l.id), ...E.flags.filter((f) => f.severity === 'red').map((f) => f.id)];
  E.flagIds = new Set([...E.score.filter((l) => l.status !== 'ok' && l.status !== 'na').map((l) => l.id), ...E.flags.map((f) => f.id)]);
  return E;
}
