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
  d.kits = { body: { id: 'side-tubes', p: kitDefaults('side-tubes') } };
  return d;
}

/* A blank design: the brief's defaults and no vehicle. Nothing is built until a vehicle is picked. */
export function blankDesign() { return defaultDesign(); }

/* v1 flat keys and where they live now. */
const V1_MAP = {
  wheelbase: 'vehicle.wheelbase', track: 'vehicle.track', wheelDia: 'vehicle.wheelDia', frameHeight: 'vehicle.frameHeight',
  length: 'structure.length', width: 'structure.width', bodyFront: 'structure.bodyFront', roofOverhang: 'structure.roofOverhang',
  posts: 'structure.posts',
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
  if (f.frontPosts !== undefined) d.structure.roofSpan = f.frontPosts ? 'full' : 'driver-back';
  if (f.keepCab !== undefined) d.strip.level = f.keepCab ? 'stock' : 'cut';
  if (f.ladder !== undefined) d.upper.access = V1_LADDER[f.ladder] || 'none';
  if (f.roofDeck !== undefined || f.headroom !== undefined) {
    const deck = f.roofDeck !== undefined ? f.roofDeck : d.upper.kind !== 'none';
    d.upper.kind = !deck ? 'none' : d.upper.headroom < 1.85 ? 'bunk' : 'stand';
  }
  if (f.roofDeckFront !== undefined || f.roofDeckRear !== undefined) d.upper.coverage = 'mid';
  const tp = {};
  for (const [k, pk] of Object.entries(V1_TUBES)) if (f[k] !== undefined) tp[pk] = f[k];
  if (Object.keys(tp).length) d.kits.body = { id: 'side-tubes', p: { ...kitDefaults('side-tubes'), ...(d.kits.body.id === 'side-tubes' ? d.kits.body.p : {}), ...tp } };
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
  // the structure wraps the front of the vehicle and runs to the ideal length for this wheelbase
  d.structure.bodyFront = C.ba + 0.1;
  d.structure.length = bodyLimits(params(d), C).ideal;
  applyRoofSpan(d);
  d.name = `${C.short}, ${d.upper.kind === 'none' ? 'shade only' : 'roof deck'}`;
  for (const [k, v] of Object.entries(extra)) if (v !== undefined) d[k] = v;
  return sanitize(d);
}
/* What each roof span means for the upper deck: over the entire length, the deck runs full length; over the driver
   and the rear (Pingüina), the deck sits in the middle with shade over the driver and at the back. */
export function applyRoofSpan(d) {
  if (d.structure.roofSpan === 'full') d.upper.coverage = 'full';
  else Object.assign(d.upper, { coverage: 'mid', shadeFront: 1.22, shadeRear: 1.22 });
  return d;
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
  // v1 always had side tubes, and dressed a cut truck front in the tube skin: the side-tubes cover does both
  const specDiffers = ['wheelbase', 'track', 'wheelDia', 'frameHeight'].some((k) => flat[k] !== undefined && Math.abs(flat[k] - { wheelbase: C.wheelbase, track: Math.min(C.track.front, C.track.rear), wheelDia: C.tire.diameter, frameHeight: C.frameHeight }[k]) > 0.005)
    && !C.wheelbaseOptions.some((w) => Math.abs(w - flat.wheelbase) < 0.005 && ['track', 'wheelDia', 'frameHeight'].every((k) => flat[k] === undefined || Math.abs(flat[k] - { track: Math.min(C.track.front, C.track.rear), wheelDia: C.tire.diameter, frameHeight: C.frameHeight }[k]) < 0.005));
  d.vehicle.whatIf = specDiffers;
  return sanitize(d, { keepRaw: true });   // keeps v1's body numbers as they were; the studio clamps them once edited
}

function validField(f, v) {
  switch (f.type) {
    case 'num': case 'int': return typeof v === 'number' && Number.isFinite(v);
    case 'bool': return typeof v === 'boolean';
    case 'color': return typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v);
    case 'enum': return f.options.some((o) => o[0] === v);
    case 'set': return Array.isArray(v) && v.every((x) => f.options.some((o) => o[0] === x));
    case 'vehicle': return v === null || (typeof v === 'string' && !!VEHICLES[v]);
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
  if (src.structure && src.structure.frontPosts !== undefined && !src.structure.roofSpan) d.structure.roofSpan = src.structure.frontPosts ? 'full' : 'driver-back';   // saved before the roof span choice
  if (src.kits) {
    const k = src.kits.body || legacyBody(src.kits);
    d.kits.body = k && k.id === 'none' ? { id: 'none', p: {} }   // no design at all: only the reality-check dreams use it
      : k && KITS[k.id] ? { id: k.id, p: sanitizeKitParams(k.id, k.p) } : { id: 'side-tubes', p: kitDefaults('side-tubes') };
  }
  if (!d.vehicle.id) { if (d.brief.ridersMin > d.brief.ridersMax) d.brief.ridersMin = d.brief.ridersMax; return d; }   // blank: nothing to clamp to yet
  const C = vehicleOf(d.vehicle.id);
  if (!d.vehicle.whatIf) {
    d.vehicle.wheelbase = nearest(C.wheelbaseOptions, d.vehicle.wheelbase);
    d.vehicle.track = Math.min(C.track.front, C.track.rear); d.vehicle.wheelDia = C.tire.diameter; d.vehicle.frameHeight = C.frameHeight;
  }
  if (d.brief.ridersMin > d.brief.ridersMax) d.brief.ridersMin = d.brief.ridersMax;
  if (!opts.keepRaw) clampBody(d);
  return d;
}
const nearest = (opts, v) => opts.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a), opts[0]);
/* Clamp body length, width and front to the chassis; returns what changed. */
export function clampBody(d) {
  const changes = [];
  if (!d.vehicle.id) return changes;
  const C = vehicleOf(d.vehicle.id);
  for (const k of ['bodyFront', 'length', 'width']) {
    const lim = bodyLimits(params(d), C)[k];
    const v = d.structure[k], nv = clamp(v, lim[0], lim[1]);
    if (Math.abs(nv - v) > 1e-6) {
      changes.push({ path: 'structure.' + k, from: v, to: nv, atMax: nv === lim[1] }); d.structure[k] = nv;
      if (k === 'bodyFront') d.structure.length += nv - v;   // the front moved: the rear end stays where it was
    }
  }
  return changes;
}

/* Designs saved before the single design body (front, side, full, train and theme slots): keep the most complete
   choice, mapping retired kits to the nearest current shape. */
const LEGACY = { 'pinguina-ribs': ['penguin', { build: 'plywood', finish: 'lattice' }], shinkansen: ['bullet-train', {}], train: ['bullet-train', {}], 'bullet-nose': ['bullet-train', {}],
  'three-rockets': ['rocket', {}], 'pink-fish': ['pink-fish', {}], 'bio-slug': ['bio-slug', {}], jellyfish: ['bio-slug', {}], anglerfish: ['pink-fish', {}], 'mixer-drum': ['rocket', {}] };
function legacyBody(kits) {
  for (const slot of ['theme', 'train', 'full', 'front', 'side']) {
    const k = kits[slot];
    if (!k || k.id === 'none') continue;
    if (k.id === 'side-tubes') return k;
    if (LEGACY[k.id]) return { id: LEGACY[k.id][0], p: { ...kitDefaults(LEGACY[k.id][0]), ...LEGACY[k.id][1] } };
  }
  return Object.values(kits).every((k) => !k || k.id === 'none') ? { id: 'none' } : null;
}
/* The active design body (a list, so the engine can carry more than one later). */
export function activeKits(d) {
  const k = d.kits && d.kits.body;
  return { active: k && KITS[k.id] ? [{ slot: 'body', id: k.id, p: k.p, def: KITS[k.id] }] : [], inactive: [] };
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
  s.roofSpan = d.structure.roofSpan; s.frontPosts = d.structure.roofSpan === 'full';
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
  s.hoodCover = tubes ? { p: { material: 'match' } } : null;   // the side-tubes cover dresses a cut truck's hood and fenders
  s.speakerFacing = d.lights.speakerFacing; s.skinOff = d.transport.skinOff !== false;
  s.riderTarget = d.brief.ridersMax;
  return s;
}
export { TUBE_BUILDS };

/* Switch the base vehicle without resetting later choices (principle 5): the body is clamped to the new chassis
   and every change is listed. */
export function switchVehicle(d0, id) {
  // from a blank design: the vehicle's own typical build, keeping the brief and the view
  if (!d0.vehicle.id) return { design: starterDesign(id, { brief: clone(d0.brief), view: clone(d0.view), name: d0.name === defaultDesign().name ? undefined : d0.name }), changes: [] };
  const d = clone(d0), C = vehicleOf(id), C0 = vehicleOf(d0.vehicle.id);
  d.vehicle.id = C.id;
  d.vehicle.whatIf = false;
  if (d.name.startsWith(`${C0.short}, `)) d.name = C.short + d.name.slice(C0.short.length);   // an automatic name follows the vehicle
  d.vehicle.wheelbase = C.wheelbaseOptions.find((w) => Math.abs(w - d0.vehicle.wheelbase) < 0.005) ?? C.wheelbase;
  d.vehicle.track = Math.min(C.track.front, C.track.rear); d.vehicle.wheelDia = C.tire.diameter; d.vehicle.frameHeight = C.frameHeight;
  // the structure keeps its reach past the bumper, and a body at its ideal length stays at the ideal for the new chassis
  const atIdeal = Math.abs(d0.structure.length - bodyLimits(params(d0), C0).ideal) < 0.06;
  d.structure.bodyFront = C.ba + (d0.structure.bodyFront - C0.ba);
  if (atIdeal) d.structure.length = bodyLimits(params(d), C).ideal;
  const changes = clampBody(d).filter((c) => c.path !== 'structure.bodyFront');
  if (atIdeal && Math.abs(d.structure.length - d0.structure.length) > 0.01) changes.unshift({ path: 'structure.length', from: d0.structure.length, to: d.structure.length, ideal: true });
  if (Math.abs(d.vehicle.wheelbase - d0.vehicle.wheelbase) > 0.005) changes.unshift({ path: 'vehicle.wheelbase', from: d0.vehicle.wheelbase, to: d.vehicle.wheelbase });
  return { design: sanitize(d), changes };
}
/* Knock-on changes of a structure edit: the front reach keeps the rear end where it is, a new wheelbase keeps a body
   at its ideal length, and the roof span sets the upper deck's defaults. Returns the design. */
export function structureEffects(d0, d, path) {
  const C = vehicleOf(d.vehicle.id);
  if (!C || !d.vehicle.id) return d;
  if (path === 'structure.bodyFront') d.structure.length += d.structure.bodyFront - d0.structure.bodyFront;
  if (path === 'vehicle.wheelbase' && Math.abs(d0.structure.length - bodyLimits(params(d0), C).ideal) < 0.06) d.structure.length = bodyLimits(params(d), C).ideal;
  if (path === 'structure.roofSpan') applyRoofSpan(d);
  return d;
}

/* Headroom for a low bunk: keep the deck floor under the DMV's 84″ line where the chassis allows it. */
export function bunkHeadroom(d) {
  const C = vehicleOf(d.vehicle.id);
  const deckY = (d.vehicle.whatIf ? d.vehicle.frameHeight : C.frameHeight) + C.buildup - (C.style === 'cart' && !d.strip.bed ? 0.1 : 0);
  return clamp(2.1336 - deckY - 0.025 - 0.14 - 0.02, 0.9, 1.2);
}
