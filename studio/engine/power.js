/* A rough power budget: lights plus sound against the battery bank and generator, for one night. */
import { R } from '../catalogs/rules.js';

const SPEAKER_W = { corners: { small: 4 * 30, medium: 4 * 60, large: 4 * 120 }, towers: { small: 2 * 120, medium: 2 * 250, large: 2 * 450 }, tubes: { small: 2 * 80, medium: 2 * 150, large: 2 * 300 }, none: { small: 0, medium: 0, large: 0 } };
const BAY = { small: { kwh: 6, gen: false }, medium: { kwh: 15, gen: true }, large: { kwh: 40, gen: true } };

export function ledLength(root) {
  let len = 0;
  root.traverse((o) => {
    if (!o.geo || o.mat !== 'led') return;
    const a = o.geo.args;
    if (o.geo.type === 'Box') len += Math.max(a[0], a[1], a[2]);
    else if (o.geo.type === 'Cylinder' || o.geo.type === 'Capsule') len += o.geo.type === 'Capsule' ? a[1] : a[2];
    else if (o.geo.type === 'Torus') len += (a[4] ?? Math.PI * 2) * a[0];
  });
  return len;
}

export function powerBudget(root, g, s) {
  const ledLen = ledLength(root);
  const modeK = { off: 0, chase: 0.45, sparkle: 0.4, breathe: 0.65 }[s.ledMode] ?? 1;
  const items = [
    { name: 'LED lines', w: ledLen * R('ledWattsPerM') * Math.min(1, s.ledLevel) * modeK, note: `${ledLen.toFixed(0)} m of strip` },
    { name: 'Puck downlights', w: (g.puckCount || 0) * 3 },
    { name: 'Neon', w: s.roofDeck && s.neon ? 25 : 0 },
    { name: 'Projectors', w: (g.projectorCount || 0) * 40 },
    { name: 'Speakers and amps', w: (SPEAKER_W[s.speakers] || SPEAKER_W.none)[s.speakerSize || 'medium'] },
    { name: 'DJ booth', w: s.dj && s.dj !== 'none' && g.zones.some((z) => z.name === 'DJ booth') ? 150 : 0 },
    { name: 'Daiquiri machines', w: g.daiquiri ? 900 : 0, note: 'three frozen-drink bowls' },
  ].filter((i) => i.w > 0);
  const loadW = items.reduce((a, i) => a + i.w, 0) / 0.9;   // inverter losses
  const usableKwh = s.batteryKwh * R('usableFraction');
  const genW = s.power === 'generator' ? R('generatorKw') * 1000 : 0;
  const net = loadW - genW;
  const hours = net <= 0 ? Infinity : usableKwh * 1000 / net;
  const need = R('nightHours');
  const recommendKwh = Math.ceil(Math.max(0, net) * need / 1000 / R('usableFraction'));
  const bay = BAY[s.powerBaySize || 'medium'];
  const bayProblems = [];
  if (s.batteryKwh > bay.kwh) bayProblems.push(`a ${s.powerBaySize} bay holds about ${bay.kwh} kWh`);
  if (s.power === 'generator' && !bay.gen) bayProblems.push('a small bay has no room for the generator and tanks');
  const status = hours >= need ? 'ok' : hours >= need / 2 ? 'amber' : 'red';
  return { items, loadW, usableKwh, genW, hours, need, recommendKwh, status, bayProblems, ledLen };
}
