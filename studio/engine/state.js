/* The design state: one JSON object holding the brief and every step's choices (schema 2). It is what gets saved,
   opened, compared and encoded into share links. params() flattens it into the model's parameter object. */
import { FIELDS, KIT_SLOTS, getPath, setPath } from './fields.js';
import { VEHICLES, vehicleOf } from '../catalogs/vehicles.js';
import { KITS, TUBE_BUILDS } from '../catalogs/kits.js';
import { TRAILERS } from '../catalogs/trailers.js';
import { bodyLimits } from './limits.js';
import { clamp } from './math.js';
export const SCHEMA = 2;
const clone = (o) => JSON.parse(JSON.stringify(o));

export function kitDefaults(id) {
  const k = KITS[id]; if (!k) return {};
  return Object.fromEntries(Object.entries(k.params || {}).map(([key, f]) => [key, clone(f.def)]));
}
export function defaultDesign() {
  const d = { schema: SCHEMA, name: 'Untitled art car' };
  for (const [path, f] of Object.entries(FIELDS)) setPath(d, path, clone(f.def));
  d.kits = Object.fromEntries(KIT_SLOTS.map((slot) => [slot, { id: 'none', p: {} }]));
  d.kits.side = { id: 'side-tubes', p: kitDefaults('side-tubes') };
  d.kits.front = { id: 'hood-cover', p: kitDefaults('hood-cover') };
  return d;
}

/* v1 flat keys and where they live now. */
const V1_MAP = {
  wheelbase: 'vehicle.wheelbase', track: 'vehicle.track', wheelDia: 'vehicle.wheelDia', frameHeight: 'vehicle.frameHeight',
  length: 'structure.length', width: 'structure.width', bodyFront: 'structure.bodyFront', roofOverhang: 'structure.roofOverhang',
  posts: 'structure.posts', frontPosts: 'structure.frontPosts',
  headroom: 'upper.headroom', roofShade: 'upper.roofShade', roofDeckFront: 'upper.shadeFront', roofDeckRear: 'upper.shadeRear', railHeight: 'upper.railHeight',
  removeRails: 'upper.railsRemovable', removeRoof: 'upper.roofRemovable',
  layout: 'layout.seating', seatDepth: 'layout.seatDepth', standing: 'layout.standing', curtains: 'layout.curtains', curtainsDrawn: 'layout.curtainsDrawn',
  rearStyle: 'layout.rear', rearLen: 'layout.rearLen', roofSeating: 'layout.upperSeating', driverStep: 'layout.driverStep', secondStep: 'layout.secondStep',
  secondStepPos: 'layout.secondStepPos', bikeRack: 'layout.bikeRack', bikes: 'layout.bikes',
  ledLines: 'lights.ledLines', ribStyle: 'lights.ribStyle', ledMode: 'lights.ledMode', ledColor: 'lights.ledColor', ledColor2: 'lights.ledColor2', ledLevel: 'lights.ledLevel',
  neon: 'lights.neon', neonSize: 'lights.neonSize', speakers: 'lights.speakers', power: 'lights.power', batteryKwh: 'lights.batteryKwh',
  trailer: 'transport.trailer', mood: 'view.mood', units: 'view.units',
  frameColor: 'design.colors.frame', tubeColor: 'design.colors.tube', shadeColor: 'design.colors.shade', fabricColor: 'design.colors.fabric',
  accentColor: 'design.colors.accent', rugColor: 'design.colors.rug', cabColor: 'design.colors.cab', cabMatch: 'design.colors.cabMatch',
};
const V1_TUBES = { tubeBuild: 'build', tubeShape: 'shape', tubeSides: 'sides', tubeDia: 'dia', tubeLift: 'lift', tubeFront: 'front', tubeRear: 'rear', tubeTaper: 'taper', ribSpacing: 'spacing', endCages: 'endCages' };
const V1_LADDER = { front: 'ladder-front', rear: 'ladder-rear', none: 'none' };

/* Apply v1-style flat values (v1 saves, vehicle defaults) onto a design. */
export function applyFlat(d, f) {
  for (const [k, path] of Object.entries(V1_MAP)) if (f[k] !== undefined) setPath(d, path, k === 'removeRails' || k === 'removeRoof' ? !!f[k] : f[k]);
  if (f.chassis) d.vehicle.id = f.chassis;
  if (f.keepCab !== undefined) d.strip.level = f.keepCab ? 'stock' : 'cut';
  if (f.ladder !== undefined) d.upper.access = V1_LADDER[f.ladder] || 'none';
  if (f.roofDeck !== undefined || f.headroom !== undefined) {
    const deck = f.roofDeck !== undefined ? f.roofDeck : d.upper.kind !== 'none';
    d.upper.kind = !deck ? 'none' : d.upper.headroom < 1.85 ? 'bunk' : 'stand';
  }
  if (f.roofDeckFront !== undefined || f.roofDeckRear !== undefined) d.upper.coverage = 'mid';
  const tp = {};
  for (const [k, pk] of Object.entries(V1_TUBES)) if (f[k] !== undefined) tp[pk] = f[k];
  if (Object.keys(tp).length) d.kits.side = { id: 'side-tubes', p: { ...kitDefaults('side-tubes'), ...(d.kits.side.id === 'side-tubes' ? d.kits.side.p : {}), ...tp } };
  if (f.riderTarget !== undefined) { d.brief.ridersMax = f.riderTarget; d.brief.ridersMin = Math.min(d.brief.ridersMin, f.riderTarget); }
  if (f.name !== undefined) d.name = f.name;
  return d;
}

/* A starting design on a vehicle: the defaults plus the vehicle's own typical build. */
export function starterDesign(vehicleId, extra = {}) {
  const C = vehicleOf(vehicleId);
  const d = defaultDesign();
  d.vehicle.id = C.id;
  d.vehicle.wheelbase = C.wheelbase;
  Object.assign(d.vehicle, { track: Math.min(C.track.front, C.track.rear), wheelDia: C.tire.diameter, frameHeight: C.frameHeight });
  d.strip.level = C.style === 'cart' ? 'cut' : 'cut';
  d.strip.rops = false;
  applyFlat(d, typicalFlat(C));
  if (C.style === 'cart' || C.family === 'utility') d.kits.front = { id: 'none', p: {} };
  d.name = `${C.short}, ${d.upper.kind === 'none' ? 'shade only' : 'roof deck'}`;
  return sanitize(Object.assign(d, extra));
}
/* The vehicle's typical build in v1 keys: its catalog defaults, or one derived from its size. */
export function typicalFlat(C) {
  const def = C.defaults || {};
  const isCart = C.style === 'cart';
  const derived = {
    length: clamp(C.wheelbase + C.af + 0.8, 3.2, 8.5), width: clamp(C.width + 0.5, 2.0, 2.54), bodyFront: isCart ? C.ba : C.style === 'cabover' ? C.ba : Math.min(C.ba, 0.9),
    headroom: 1.95, posts: isCart ? 3 : 5, tubeDia: isCart ? 0.5 : 0.62, tubeLift: isCart ? 0.55 : 0.5, layout: isCart ? 'platform' : 'ring',
    seatDepth: isCart ? 0.55 : 0.6, rearStyle: isCart ? 'none' : 'panels', rearLen: isCart ? 0.5 : 0.9, roofDeck: !isCart, roofSeating: isCart ? 'none' : 'pillows',
    roofDeckFront: isCart ? 0 : 1.2, roofDeckRear: isCart ? 0 : 1.4, ladder: isCart ? 'rear' : 'front', bikeRack: 'rear', bikes: isCart ? 2 : 4,
    secondStep: isCart ? 'none' : 'passenger', secondStepPos: 0, trailer: isCart ? 'equipment' : 'lowboy', removeRoof: false, removeRails: !isCart,
    power: isCart ? 'battery' : 'generator', batteryKwh: isCart ? 3 : 10, tubeTaper: 0.3, roofOverhang: isCart ? 0.04 : 0, roofShade: 'cloth', curtains: 'all',
  };
  return { ...derived, ...def, chassis: C.id, wheelbase: C.wheelbase, track: Math.min(C.track.front, C.track.rear), wheelDia: C.tire.diameter, frameHeight: C.frameHeight };
}

/* Open a v1 save (or a v1 flat state). */
export function fromV1(flat) {
  const C = vehicleOf(flat.chassis);
  const d = defaultDesign();
  d.vehicle.id = C.id;
  applyFlat(d, flat);
  // v1 always dressed a cut truck front in the tube skin
  d.kits.front = C.style !== 'cart' && !flat.keepCab ? { id: 'hood-cover', p: kitDefaults('hood-cover') } : { id: 'none', p: {} };
  const specDiffers = ['wheelbase', 'track', 'wheelDia', 'frameHeight'].some((k) => flat[k] !== undefined && Math.abs(flat[k] - { wheelbase: C.wheelbase, track: Math.min(C.track.front, C.track.rear), wheelDia: C.tire.diameter, frameHeight: C.frameHeight }[k]) > 0.005)
    && !C.wheelbaseOptions.some((w) => Math.abs(w - flat.wheelbase) < 0.005 && ['track', 'wheelDia', 'frameHeight'].every((k) => flat[k] === undefined || Math.abs(flat[k] - { track: Math.min(C.track.front, C.track.rear), wheelDia: C.tire.diameter, frameHeight: C.frameHeight }[k]) < 0.005));
  d.vehicle.whatIf = specDiffers;
  return sanitize(d, { keepRaw: true });
}

function validField(f, v) {
  switch (f.type) {
    case 'num': case 'int': return typeof v === 'number' && Number.isFinite(v);
    case 'bool': return typeof v === 'boolean';
    case 'color': return typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v);
    case 'enum': return f.options.some((o) => o[0] === v);
    case 'set': return Array.isArray(v) && v.every((x) => f.options.some((o) => o[0] === x));
    case 'vehicle': return typeof v === 'string' && !!VEHICLES[v];
    case 'trailer': return typeof v === 'string' && !!TRAILERS[v];
    case 'segments': return Array.isArray(v) && v.length >= 1 && v.length <= 8 && v.every((sg) => sg && ['deck', 'shade', 'open'].includes(sg.kind) && Number.isFinite(sg.len) && sg.len > 0);
    default: return false;
  }
}
function fixField(f, v) {
  if (f.type === 'num') return clamp(v, f.min, f.max);
  if (f.type === 'int') return clamp(Math.round(v), f.min, f.max);
  if (f.type === 'segments') return v.map((sg) => ({ kind: sg.kind, len: clamp(sg.len, 0.3, 12) }));
  return v;
}
export function sanitizeKitParams(id, p) {
  const k = KITS[id], out = {};
  if (!k) return out;
  for (const [key, f] of Object.entries(k.params || {})) {
    const v = p ? p[key] : undefined;
    out[key] = v !== undefined && validField(f, v) ? fixField(f, v) : clone(f.def);
  }
  return out;
}
/* Fill gaps with defaults, validate every field, clamp the body to the chassis. Never throws. */
export function sanitize(input, opts = {}) {
  const src = input && typeof input === 'object' ? input : {};
  const d = defaultDesign();
  d.name = typeof src.name === 'string' ? src.name.slice(0, 120) : d.name;
  for (const [path, f] of Object.entries(FIELDS)) {
    const v = getPath(src, path);
    if (v !== undefined && validField(f, v)) setPath(d, path, fixField(f, clone(v)));
  }
  for (const slot of KIT_SLOTS) {
    const k = src.kits && src.kits[slot];
    if (k && (k.id === 'none' || (KITS[k.id] && KITS[k.id].category === slot))) d.kits[slot] = { id: k.id, p: k.id === 'none' ? {} : sanitizeKitParams(k.id, k.p) };
    else if (src.kits) d.kits[slot] = { id: 'none', p: {} };
  }
  const C = vehicleOf(d.vehicle.id);
  if (!d.vehicle.whatIf) {
    d.vehicle.wheelbase = nearest(C.wheelbaseOptions, d.vehicle.wheelbase);
    d.vehicle.track = Math.min(C.track.front, C.track.rear); d.vehicle.wheelDia = C.tire.diameter; d.vehicle.frameHeight = C.frameHeight;
  }
  if (d.brief.ridersMin > d.brief.ridersMax) d.brief.ridersMin = d.brief.ridersMax;
  clampBody(d);
  return d;
}
const nearest = (opts, v) => opts.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a), opts[0]);
/* Clamp body length, width and front to the chassis; returns what changed. */
export function clampBody(d) {
  const changes = [];
  const C = vehicleOf(d.vehicle.id);
  for (const k of ['bodyFront', 'length', 'width']) {
    const lim = bodyLimits(params(d), C)[k];
    const v = d.structure[k], nv = clamp(v, lim[0], lim[1]);
    if (Math.abs(nv - v) > 1e-6) { changes.push({ path: 'structure.' + k, from: v, to: nv, atMax: nv === lim[1] }); d.structure[k] = nv; }
  }
  return changes;
}

/* Active kits after precedence: a theme covers what it covers, then train, then a full shell, then front and side. */
export function activeKits(d) {
  const order = ['theme', 'train', 'full', 'front', 'side'];
  const covered = new Set(), active = [], inactive = [];
  for (const slot of order) {
    const k = d.kits[slot];
    if (!k || k.id === 'none' || !KITS[k.id]) continue;
    const def = KITS[k.id];
    const by = [...covered].find((c) => c.slots.includes(slot));
    if (by) { inactive.push({ slot, id: k.id, reason: `covered by the ${KITS[by.id].name.toLowerCase()}` }); continue; }
    active.push({ slot, id: k.id, p: k.p, def });
    covered.add({ id: k.id, slots: (def.covers || []).filter((c) => c !== slot) });
  }
  return { active, inactive };
}

/* Flatten into the model's parameter object (v1 key names plus the v2 additions). */
export function params(d) {
  const C = vehicleOf(d.vehicle.id);
  const s = { name: d.name, chassis: C.id };
  for (const [k, path] of Object.entries(V1_MAP)) s[k] = getPath(d, path);
  if (!d.vehicle.whatIf) { s.wheelbase = d.vehicle.wheelbase; s.track = Math.min(C.track.front, C.track.rear); s.wheelDia = C.tire.diameter; s.frameHeight = C.frameHeight; }
  s.removeRails = !!d.upper.railsRemovable; s.removeRoof = !!d.upper.roofRemovable;
  s.strip = C.style === 'cart' ? 'cart' : d.strip.level;
  s.keepCab = C.style !== 'cart' && d.strip.level === 'stock';
  s.rops = C.style === 'cart' && !!d.strip.rops; s.bed = C.style !== 'cart' || !!d.strip.bed;
  s.style = d.structure.style; s.material = d.structure.material; s.powerBay = d.structure.powerBay; s.powerBaySize = d.structure.powerBaySize;
  s.roofDeck = d.upper.kind !== 'none';
  s.coverage = d.upper.coverage; s.segments = d.upper.segments; s.hatchSide = d.upper.hatchSide;
  s.ladder = { 'ladder-front': 'front', 'ladder-rear': 'rear', stairs: 'stairs', none: 'none' }[d.upper.access];
  if (d.upper.coverage === 'full') { s.roofDeckFront = 0; s.roofDeckRear = 0; }
  s.dj = d.layout.dj; s.bar = d.layout.bar; s.storage = d.layout.storage;
  s.pucks = d.lights.pucks; s.projectors = d.lights.projectors; s.speakerSize = d.lights.speakerSize;
  const { active } = activeKits(d);
  s.kits = active;
  const tubes = active.find((k) => k.id === 'side-tubes');
  s.hasTubes = !!tubes;
  const tp = tubes ? tubes.p : kitDefaults('side-tubes');
  for (const [k, pk] of Object.entries(V1_TUBES)) s[k] = tp[pk];
  s.hoodCover = active.find((k) => k.id === 'hood-cover') || null;
  s.riderTarget = d.brief.ridersMax;
  return s;
}
export { TUBE_BUILDS };

/* Switch the base vehicle without resetting later choices (principle 5): the body is clamped to the new chassis
   and every change is listed. */
export function switchVehicle(d0, id) {
  const d = clone(d0), C = vehicleOf(id);
  d.vehicle.id = C.id;
  d.vehicle.whatIf = false;
  d.vehicle.wheelbase = C.wheelbaseOptions.find((w) => Math.abs(w - d0.vehicle.wheelbase) < 0.005) ?? C.wheelbase;
  d.vehicle.track = Math.min(C.track.front, C.track.rear); d.vehicle.wheelDia = C.tire.diameter; d.vehicle.frameHeight = C.frameHeight;
  const changes = clampBody(d);
  if (Math.abs(d.vehicle.wheelbase - d0.vehicle.wheelbase) > 0.005) changes.unshift({ path: 'vehicle.wheelbase', from: d0.vehicle.wheelbase, to: d.vehicle.wheelbase });
  return { design: sanitize(d), changes };
}

/* Headroom for a low bunk: keep the deck floor under the DMV's 84″ line where the chassis allows it. */
export function bunkHeadroom(d) {
  const C = vehicleOf(d.vehicle.id);
  const deckY = (d.vehicle.whatIf ? d.vehicle.frameHeight : C.frameHeight) + C.buildup - (C.style === 'cart' && !d.strip.bed ? 0.1 : 0);
  return clamp(2.1336 - deckY - 0.025 - 0.14 - 0.02, 0.9, 1.2);
}
