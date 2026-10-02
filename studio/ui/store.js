/* The design store: one design object, an undo stack, side effects of each change, and persistence. */
import { sanitize, blankDesign, switchVehicle, clampBody, kitDefaults, bunkHeadroom, fromV1 } from '../engine/state.js';
import { getPath, setPath, FIELDS } from '../engine/fields.js';
import { evaluate } from '../engine/evaluate.js';
import { R } from '../catalogs/rules.js';
import { TUBE_BUILDS } from '../catalogs/kits.js';

const KEY = 'artcar-studio-v2-design';
const clone = (o) => JSON.parse(JSON.stringify(o));
const listeners = new Set();
export const store = {
  d: null, E: null, step: 0, undo: [], lastChanges: [], dragging: false,
  subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
};

/* What a vibe pre-selects in the layout step. */
const VIBES = {
  lounge: { 'layout.seating': 'ring', 'layout.upperSeating': 'pillows', 'layout.curtains': 'all' },
  dance: { 'layout.seating': 'lshape', 'layout.standing': 'party' },
  bar: { 'layout.rear': 'daiquiri' },
  sound: { 'lights.speakers': 'towers', 'lights.speakerSize': 'large' },
  chill: { 'layout.seating': 'platform', 'layout.standing': 'none', 'layout.curtains': 'all' },
};

/* Every visit opens on a blank design; the last design worked on (if it has a vehicle) can be resumed from the brief. */
export function loadInitial() { return blankDesign(); }
export function savedDesign() {
  try { const raw = localStorage.getItem(KEY); if (raw) { const d = sanitize(JSON.parse(raw)); if (d.vehicle.id) return d; } } catch (e) { /* storage unavailable */ }
  return null;
}
let persistTimer;
function persist() {
  clearTimeout(persistTimer);
  if (!store.d.vehicle.id) return;   // a blank design never overwrites the one to resume
  persistTimer = setTimeout(() => { try { localStorage.setItem(KEY, JSON.stringify(store.d)); } catch (e) { /* ignore */ } }, 300);
}

/* Evaluations are coalesced. A discrete change (a click) runs on the next task so the panel answers at once;
   a slider drag runs once per frame. */
let evalQueued = false, wantFull = false;
export function scheduleEval(full = true) {
  wantFull = wantFull || full;
  if (evalQueued) return;
  evalQueued = true;
  const run = () => {
    const vc = wantFull;
    evalQueued = false; wantFull = false;
    store.E = evaluate(store.d, { trusted: true, viewCone: vc });
    listeners.forEach((fn) => fn('eval'));
  };
  if (full) setTimeout(run, 0); else requestAnimationFrame(run);
}
export function setDesign(d, { keepUndo = false, silent = false } = {}) {
  if (store.d && !keepUndo) pushUndo();
  store.d = sanitize(d);
  persist();
  scheduleEval();
  if (!silent) listeners.forEach((fn) => fn('design'));
}
function pushUndo() { store.undo.push(clone(store.d)); if (store.undo.length > 40) store.undo.shift(); }
export function undo() { if (!store.undo.length) return false; store.d = store.undo.pop(); persist(); scheduleEval(); listeners.forEach((fn) => fn('design')); return true; }

/* Set one design value. Returns notes about knock-on changes for a toast. */
export function setValue(path, value, { live = false } = {}) {
  if (!live) pushUndo();
  const d = clone(store.d);
  const notes = [];
  store.lastChanges = path === 'vehicle.id' ? [] : store.lastChanges;
  if (path === 'vehicle.id') {
    const fromBlank = !d.vehicle.id;
    const { design, changes } = switchVehicle(d, value);
    store.lastChanges = changes;
    // picked from a blank design: the brief's vibes pre-select layout options, as they would have in step 0
    if (fromBlank) for (const v of design.brief.vibes) for (const [p, x] of Object.entries(VIBES[v] || {})) setPath(design, p, x);
    store.d = fromBlank ? sanitize(design) : design;
  } else if (path.startsWith('kits.')) {
    const [, slot, ...rest] = path.split('.');
    if (!rest.length) d.kits[slot] = { id: value, p: value === 'none' ? {} : kitDefaults(value) };
    else {
      d.kits[slot].p[rest[1]] = value;
      if (d.kits[slot].id === 'side-tubes' && rest[1] === 'build' && TUBE_BUILDS[value]) d.kits[slot].p.spacing = TUBE_BUILDS[value].spacing;
    }
    store.d = sanitize(d);
  } else {
    const before = getPath(d, path);
    setPath(d, path, value);
    if (path === 'upper.kind') {
      if (value === 'bunk' && (d.upper.headroom >= R('standHeadroom') || d.upper.headroom > bunkHeadroom(d) + 0.3)) d.upper.headroom = bunkHeadroom(d);
      if (value === 'stand' && d.upper.headroom < R('standHeadroom')) d.upper.headroom = 1.95;
    }
    if (path === 'brief.vibes') {
      const added = value.filter((v) => !(before || []).includes(v));
      for (const v of added) for (const [p, x] of Object.entries(VIBES[v] || {})) {
        if (JSON.stringify(getPath(d, p)) !== JSON.stringify(x)) { setPath(d, p, x); notes.push(`${FIELDS[p].label}: ${FIELDS[p].options.find((o) => o[0] === x)[1].toLowerCase()}`); }
      }
    }
    if (path === 'brief.ridersMin' && d.brief.ridersMax < value) d.brief.ridersMax = value;
    if (path === 'brief.ridersMax' && d.brief.ridersMin > value) d.brief.ridersMin = value;
    if (path.startsWith('structure.') || path.startsWith('vehicle.')) clampBody(d);
    store.d = sanitize(d);
  }
  persist();
  scheduleEval(!live);
  listeners.forEach((fn) => fn(live ? 'live' : 'design', path));
  return notes;
}
export function openFile(data) {
  if (data && data.app === 'art-car-studio' && data.version === 1) return fromV1(data.design);
  if (data && data.design && data.design.schema === 2) return sanitize(data.design);
  if (data && data.schema === 2) return sanitize(data);
  if (data && (data.chassis || (data.design && data.design.chassis))) return fromV1(data.design || data);
  throw new Error('not a design file');
}
