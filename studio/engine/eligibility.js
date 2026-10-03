/* Option eligibility, decided by the engine (never the UI). An option that fails a hard limit on the chosen platform
   stays visible, greyed out, with its reason. The current choice is never greyed: it shows its problem instead. */
import { evaluate } from './evaluate.js';
import { setPath, getPath } from './fields.js';
import { bunkHeadroom } from './state.js';
import { KITS } from '../catalogs/kits.js';
import { R } from '../catalogs/rules.js';
import { fmtLen, fmtWeight } from './units.js';
import { riderKg } from './weight.js';

const clone = (o) => JSON.parse(JSON.stringify(o));
const memo = new Map();
const KIND_LABEL = { none: 'shade roof only', bunk: 'low bunk', stand: 'stand-under deck' };

function tryOption(d, path, value) {
  const key = JSON.stringify(d) + '|' + path + '|' + JSON.stringify(value);
  if (memo.has(key)) return memo.get(key);
  const t = clone(d);
  setPath(t, path, value);
  if (path === 'upper.kind') {
    if (value === 'bunk') t.upper.headroom = Math.min(t.upper.headroom, bunkHeadroom(t));
    if (value === 'stand' && t.upper.headroom < R('standHeadroom')) t.upper.headroom = 1.95;
  }
  const E = evaluate(t, { viewCone: false });
  const res = { E };
  if (memo.size > 400) memo.clear();
  memo.set(key, res);
  return res;
}
function hardLimits(E, label, base) {
  const u = E.d.view.units;
  if (E.tip.ssf < R('tipRed') && !(base && base.tip.ssf < R('tipRed'))) return `${label}: the ${E.C.short}’s ${fmtLen(E.s.track, u)} track tips at ${E.tip.ssf.toFixed(2)} g`;
  if (E.w.buildKg + riderKg() > E.rc.payloadKg && !(base && base.w.buildKg + riderKg() > base.rc.payloadKg)) return `${label}: the build alone is ${fmtWeight(E.w.buildKg + riderKg() - E.rc.payloadKg, u)} over the ${E.C.short}’s payload`;
  return null;
}

export function optionStatus(base, path, value) {
  const d = base.d, cur = getPath(d, path);
  const current = JSON.stringify(cur) === JSON.stringify(value);
  const out = (reason) => ({ disabled: !!reason && !current, reason: reason || null });
  const style = d.structure.style, cart = base.C.style === 'cart';
  switch (path) {
    case 'upper.kind': {
      if (value !== 'none' && style === 'barge') return out('A low party barge has no posts to carry an upper level');
      if (value === 'stand' && style === 'bed-ext') return out('The light bed-extension frame can’t carry a stand-under deck');
      if (value === 'none') return out(null);
      return out(hardLimits(tryOption(d, path, value).E, `${KIND_LABEL[value][0].toUpperCase()}${KIND_LABEL[value].slice(1)}`, current ? null : base));
    }
    case 'structure.style': {
      if (value === 'bed-ext' && !cart) return out('Carts only: it extends a cart’s stock bed');
      if (value === 'bed-ext' && !d.strip.bed) return out('Keep the stock cargo bed to extend it (step 2)');
      if (value === 'barge') return out(null);
      return out(hardLimits(tryOption(d, path, value).E, 'This structure', current ? null : base));
    }
    case 'structure.powerBay': return out(value === 'section' && d.layout.rear === 'none' ? 'Needs a rear section (step 5)' : null);
    case 'strip.level': return out(value === 'stock' && !base.C.removableCab ? null : null);
    case 'upper.access': {
      if (value === 'stairs' && d.upper.kind !== 'stand') return out('Stairs need a stand-under deck');
      if (value === 'stairs' && d.upper.kind === 'stand') { const E = tryOption(d, path, value).E; return out(E.g.stairsFailed ? 'Not enough lounge under the deck for a stair run; use a ladder' : null); }
      return out(null);
    }
    case 'layout.dj':
      if (value === 'upper') return out(!base.g.decks.length ? 'Needs a rideable upper deck (step 4)' : !base.g.decks.some((k) => k.X1 - k.X0 > 1.6) ? 'The upper deck is too short for a booth' : null);
      return out(value !== 'none' && base.g.loungeLen < 1.6 ? 'The lounge is too short for this zone' : null);
    case 'layout.bar': case 'layout.storage': return out(value !== 'none' && base.g.loungeLen < 1.6 ? 'The lounge is too short for this zone' : null);
    case 'lights.speakers':
      if (value === 'corners' && style === 'barge') return out('No roof to hang them from on a low barge');
      return out(null);
    case 'layout.bikeRack': return out(value !== 'none' && style === 'barge' ? 'Bikes hang from the roof beam; a barge has none' : null);
    default: return out(null);
  }
}

/* A design body on this platform: platform list, and any structure it needs. */
export function kitStatus(base, slot, id) {
  const d = base.d;
  if (id === 'none') return { disabled: false, reason: null };
  const k = KITS[id], C = base.C;
  const current = d.kits.body && d.kits.body.id === id;
  const out = (reason) => ({ disabled: !!reason && !current, reason: reason || null });
  if (!k.platforms.includes(C.family)) return out(`Not for ${C.family === 'cart' ? 'carts' : C.family === 'utility' ? 'UTVs' : 'this vehicle'}`);
  if (k.requires?.structure && !k.requires.structure.includes(d.structure.style)) return out('Needs the full cage for attachment points (step 3)');
  return out(null);
}
