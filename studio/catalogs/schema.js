/* Schema checks for every catalog entry. Run at build time and in the tests: adding a vehicle or a kit is data entry,
   and a bad entry should fail loudly with a readable message. */
import { VEHICLES, FAMILIES } from './vehicles.js';
import { KITS, TUBE_BUILDS } from './kits.js';
import { TRAILERS } from './trailers.js';
import { RULES } from './rules.js';
import { MATERIALS } from './materials.js';
import { CARDS } from './cards.js';
import { STARTERS } from './starters.js';

const num = (v) => typeof v === 'number' && Number.isFinite(v);
const str = (v) => typeof v === 'string' && v.length > 0;
const tier = (v) => Number.isInteger(v) && v >= 1 && v <= 3;
const CONF = ['spec', 'measured', 'estimate'];

export function validateCatalogs() {
  const errs = [];
  const req = (cond, where, what) => { if (!cond) errs.push(`${where}: ${what}`); };
  const families = FAMILIES.map((f) => f.id);
  for (const [id, v] of Object.entries(VEHICLES)) {
    const w = `vehicle ${id}`;
    req(v.id === id, w, 'id mismatch');
    req(families.includes(v.family), w, 'family must be one of ' + families.join(', '));
    req(['cart', 'cabover', 'conventional'].includes(v.style), w, 'style must be cart, cabover or conventional');
    for (const k of ['make', 'model', 'short', 'summary']) req(str(v[k]), w, `${k} is required`);
    req(['gas', 'diesel', 'electric'].includes(v.powertrain), w, 'powertrain must be gas, diesel or electric');
    req(Array.isArray(v.wheelbaseOptions) && v.wheelbaseOptions.length && v.wheelbaseOptions.every((x) => num(x) && x > 1 && x < 8), w, 'wheelbaseOptions must be meters');
    req(num(v.track?.front) && num(v.track?.rear), w, 'track.front and track.rear in meters');
    req(num(v.tire?.diameter) && typeof v.tire?.dualRear === 'boolean' && str(v.tire?.size), w, 'tire needs size, diameter, dualRear');
    for (const k of ['frameHeight', 'buildup', 'ba', 'af', 'length', 'width', 'cgY']) req(num(v[k]) && v[k] >= 0, w, `${k} must be a number of meters`);
    for (const k of ['back', 'front', 'floorY', 'roofY', 'width']) req(num(v.cab?.[k]), w, `cab.${k} required`);
    if (v.style === 'conventional') req(num(v.cab.hoodTop) && num(v.cab.hoodW), w, 'conventional cabs need hoodTop and hoodW');
    for (const k of ['dx', 'y', 'z']) req(num(v.seat?.[k]), w, `seat.${k} required`);
    for (const k of ['dx', 'dy', 'tilt']) req(num(v.steer?.[k]), w, `steer.${k} required`);
    for (const k of ['gvwrLb', 'payloadLb', 'curbLb']) req(num(v[k]) && v[k] > 0, w, `${k} required`);
    req(v.topSpeedMph === null || num(v.topSpeedMph), w, 'topSpeedMph is a number or null');
    req(v.buying && typeof v.buying.newAvailable === 'boolean' && str(v.buying.used) && Array.isArray(v.buying.knownIssues) && str(v.buying.service), w, 'buying needs newAvailable, used, knownIssues, service');
    req(v.sources && v.confidence, w, 'sources and confidence maps required');
    for (const [k, c] of Object.entries(v.confidence || {})) { req(CONF.includes(c), w, `confidence.${k} must be spec, measured or estimate`); req(str(v.sources[k]), w, `sources.${k} missing`); }
    req(tier(v.costTier) && tier(v.effortTier), w, 'costTier and effortTier 1–3');
    req(Number.isInteger(v.axles) && v.axles >= 2, w, 'axles');
  }
  for (const [id, k] of Object.entries(KITS)) {
    const w = `kit ${id}`;
    req(k.id === id, w, 'id mismatch');
    req(['cover', 'full'].includes(k.category), w, 'category');
    for (const f of ['name', 'description', 'riderOpenings', 'explainer']) req(str(k[f]), w, `${f} required`);
    req(Array.isArray(k.materials) && k.materials.length, w, 'materials list required');
    req(['face-cut', 'outboard', 'skirt-above', 'none-needed'].includes(k.wheelClearance), w, 'wheelClearance');
    req(k.transport && typeof k.transport.removable === 'boolean', w, 'transport.removable');
    req(k.look && str(k.look.day) && str(k.look.night), w, 'look.day and look.night');
    req(Array.isArray(k.platforms) && k.platforms.every((p) => families.includes(p)), w, 'platforms must be vehicle families');
    req(tier(k.costTier) && tier(k.effortTier), w, 'costTier and effortTier 1–3');
    req(typeof k.parts === 'function' || !!k.builtin, w, 'parts(T, p) required');
    for (const [pk, f] of Object.entries(k.params || {})) {
      req(['num', 'int', 'enum', 'bool'].includes(f.type) && str(f.label), w, `param ${pk} type and label`);
      if (f.type === 'enum') req(f.options.some((o) => o[0] === f.def), w, `param ${pk} default must be an option`);
      if (f.type === 'num' || f.type === 'int') req(f.def >= f.min && f.def <= f.max, w, `param ${pk} default in range`);
      if (pk === 'material' && f.type === 'enum') for (const [m] of f.options) req(m === 'match' || !!MATERIALS[m], w, `material ${m} unknown`);
    }
  }
  for (const [id, t] of Object.entries(TUBE_BUILDS)) req(str(t.label) && num(t.spacing) && tier(t.cost) && tier(t.effort), `tube build ${id}`, 'label, spacing, tiers');
  for (const [id, t] of Object.entries(TRAILERS)) {
    const w = `trailer ${id}`;
    for (const k of ['deck', 'len', 'width', 'maxLb']) req(typeof t[k] === 'number' && t[k] >= 0, w, `${k} required`);
    req([1, 2, 3].includes(t.difficulty), w, 'difficulty 1–3');
    req(str(t.label) && str(t.short) && str(t.notes), w, 'label, short, notes');
  }
  for (const [id, r] of Object.entries(RULES)) {
    const w = `rule ${id}`;
    req(num(r.value) && str(r.unit) && str(r.label) && str(r.source), w, 'value, unit, label, source');
    req(/^\d{4}-\d{2}-\d{2}$/.test(r.verified), w, 'verified date YYYY-MM-DD');
    req(typeof r.note === 'string', w, 'note');
  }
  for (const [id, m] of Object.entries(MATERIALS)) req(str(m.label) && RULES[m.rule] && str(m.mat) && tier(m.cost) && tier(m.effort), `material ${id}`, 'label, rule, mat, tiers');
  for (const c of CARDS) {
    const w = `card ${c.id}`;
    req(str(c.title) && typeof c.preset === 'function' && Array.isArray(c.expect) && c.expect.length, w, 'title, preset, expect');
    req(c.expect.every((e) => str(e.id) && str(e.why)), w, 'each expected flag needs id and why');
    req(c.nearest && typeof c.nearest.preset === 'function' && str(c.nearest.summary), w, 'nearest preset and summary');
    req(Array.isArray(c.talking), w, 'talking points');
  }
  for (const s of STARTERS) req(str(s.id) && str(s.label) && typeof s.build === 'function', `starter ${s.id}`, 'id, label, build');
  return errs;
}
