/* Transport: packed size and the fit on every way of getting there, with margins (section 4.6).
   Packed: the design comes off unless marked to stay, and so do the roof, posts and rails when marked removable. */
import { R } from '../catalogs/rules.js';
import { TRAILERS } from '../catalogs/trailers.js';
import { boundsOf } from './scene.js';
import { LB_PER_KG } from './units.js';

export function measure(root, s) {
  const isRider = (o) => o.userData.layer === 'riders';
  const isBike = (o) => o.userData.layer === 'layout' && o.userData.pack === 'off';
  const noBox = (o) => !!o.userData.noBox;
  const playa = boundsOf(root, (o) => isRider(o) || isBike(o) || noBox(o));
  const withBikes = boundsOf(root, (o) => isRider(o) || noBox(o));
  const roofOff = !!s.removeRoof, railsOff = roofOff || !!s.removeRails;
  const skinStays = s.skinOff === false;   // the design stays on when its pieces don't come off
  const off = (o) => o.userData.pack === 'off' && !(skinStays && o.userData.layer === 'design');
  const packed = boundsOf(root, (o) => isRider(o) || noBox(o) || off(o) || (roofOff && o.userData.pack === 'roof') || (railsOff && o.userData.pack === 'rails'));
  const vehicle = boundsOf(root, (o) => (o.userData.layer && o.userData.layer !== 'vehicle') || noBox(o));
  return { playa, withBikes, packed, vehicle };
}

export function roadLegal(s, C, g) {
  if (C.style === 'cart' || C.family === 'utility') return { ok: false, why: `the ${C.short} is a low-speed vehicle, not road legal` };
  if (s.strip === 'rails') return { ok: false, why: 'stripped to the frame rails: no cab, lights or mirrors' };
  if (!g.hasCab) return { ok: false, why: 'cab and windshield cut away; plan to haul it (rules vary by state)' };
  return { ok: true, why: 'stock cab, lights and mirrors' };
}

export function transportCheck(dims, s, C, g, buildKg) {
  const pk = dims.packed, size = pk.size();
  const packH = pk.max[1], packL = size[0], packW = size[2];
  const vehKg = C.curbLb / LB_PER_KG + buildKg;
  const legal = roadLegal(s, C, g);
  const options = Object.entries(TRAILERS).map(([id, tr]) => {
    const haulH = tr.deck + packH;
    const m = {
      height: R('roadHeight') - haulH,
      width: R('roadWidth') - packW,
      length: Number.isFinite(tr.len) ? tr.len - packL : Infinity,
      weight: Number.isFinite(tr.maxLb) ? tr.maxLb / LB_PER_KG - vehKg : Infinity,
    };
    const problems = [];
    if (id === 'drive' && !legal.ok) problems.push(`not road legal: ${legal.why}`);
    if (m.height < -1e-3) problems.push('too tall');
    if (m.width < -1e-3) problems.push('too wide');
    if (m.length < -1e-3) problems.push('too long for the deck');
    if (m.weight < -1e-3) problems.push('over the deck rating');
    const fits = problems.length === 0;
    const status = !fits ? 'red' : m.height < R('haulAmberMargin') ? 'amber' : 'ok';
    return { id, label: tr.label, short: tr.short, difficulty: tr.difficulty, haulH, margins: m, fits, status, problems, westOk: haulH <= R('roadHeightWest') + 1e-3 };
  });
  return { packH, packL, packW, vehKg, legal, options, chosen: options.find((o) => o.id === s.trailer) || options[0] };
}
