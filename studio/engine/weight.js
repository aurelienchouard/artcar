/* Build weight from the model's own bill of materials, and the mass list the tipping estimate uses.
   Constants come from the rules table. Build weight is ±30%. */
import { R } from '../catalogs/rules.js';
export const LB_PER_KG = 2.20462;
export const riderKg = () => R('riderKg');

const SOUND_KG = { none: 0, tubes: 60, corners: 74, cornersCart: 52, towers: 120 };

/* g: model geometry, s: flat params, C: vehicle. Returns kg by category, the build total, and [kg, height] items. */
export function buildWeights(g, s, C) {
  const b = g.bom, sec = s.material === 'alu' ? R('aluSecondary') : 1;
  const steelPost = R('steel15in14'), steelRoof = R('steel15in16') * sec, steelRail = R('steelRail') * sec, steelHoop = R('steelHoop');
  const kgSteel = b.deckFrame * g.frameKgM + b.post * steelPost + b.roofFrame * steelRoof + b.rail * steelRail + b.hoop * steelHoop + b.stairs * R('stairKg') + (b.cage || 0) * steelPost;
  const kgPly = (b.ply34 + b.ribPly) * R('ply34') + b.ply12 * R('ply12') + b.plyBend * R('plyBend');
  const kgSkins = b.alu * R('skinAlu') + b.perf * R('skinPerf') + b.poly * R('skinPoly') + b.cloth * R('skinCloth')
    + (b.acm || 0) * R('skinAcm') + (b.coroplast || 0) * R('skinCoroplast') + (b.eva || 0) * R('skinEva') + (b.fabric || 0) * R('skinFabric')
    + (b.conduit || 0) * R('conduit') + (b.hdpe || 0) * R('hdpe');
  const soundKg = s.speakers === 'corners' ? (g.isCart ? SOUND_KG.cornersCart : SOUND_KG.corners) : (SOUND_KG[s.speakers] ?? 0);
  const sizeK = { small: 0.6, medium: 1, large: 1.6 }[s.speakerSize || 'medium'];
  const kg = {
    steel: kgSteel,
    plywood: kgPly,
    skins: kgSkins,
    cushions: g.seatsLow * 10 + g.seatsRoof * (s.roofSeating === 'pillows' ? 5 : 10) + (s.curtains !== 'none' ? 8 : 0),
    power: s.batteryKwh * R('lithiumKgPerKwh') + R('powerElectronics') + (s.power === 'generator' ? R('generatorKg') : 0),
    sound: soundKg * sizeK,
    extras: g.bikeCount * 15 + (g.daiquiri ? 90 : 0) + (s.roofDeck && s.neon ? 3 : 0) + (s.roofDeck ? 8 : 0),
    hardware: R('hardware') * (kgSteel + kgPly + kgSkins),
  };
  for (const it of g.extraMass || []) kg[it.cat] = (kg[it.cat] || 0) + it.kg;
  const buildKg = Object.values(kg).reduce((a, v) => a + v, 0);

  const M = [];
  const add = (m, y, label) => { if (m > 0) M.push([m, y, label]); };
  const roofPly = g.deckArea * R('ply34') + (s.roofShade === 'solid' && g.hasRoof !== false ? Math.max(0, g.rLen * g.roofW - g.deckArea) * R('ply12') : 0);
  add(b.deckFrame * g.frameKgM + b.deckArea * (g.lightDeck ? R('ply12') : R('ply34')), g.deckY - 0.08, 'deck');
  add(b.post * steelPost + (b.cage || 0) * steelPost, g.deckY + s.headroom / 2, 'posts'); add(g.wallArea * R('ply12'), g.deckY + 0.3, 'walls');
  add(b.roofFrame * steelRoof + roofPly + b.cloth * R('skinCloth'), g.roofTop - 0.05, 'roof');
  add(b.rail * steelRail, g.railBaseY + s.railHeight * 0.6, 'rails');
  add(b.hoop * steelHoop + b.ribPly * R('ply34') + b.plyBend * R('plyBend') + kgSkins - (g.kitSkinKg || 0), g.tubeY, 'tubes');
  add(b.stairs * R('stairKg'), 0.4, 'steps');
  add(g.seatsLow * 10, g.deckY + 0.2, 'cushions'); add(kg.cushions - g.seatsLow * 10, g.roofTop + 0.15, 'roof cushions');
  add(kg.power, g.powerY ?? g.deckY - 0.25, 'power');
  add(kg.sound, s.speakers === 'corners' ? g.roofBottom - 0.35 : s.speakers === 'tubes' ? g.tubeY : g.deckY + 0.8, 'sound');
  add(kg.extras, g.roofBottom - 0.6, 'extras');
  for (const it of g.extraMass || []) add(it.kg, it.y, it.label);
  const bm = M.reduce((a, [m]) => a + m, 0), by = M.reduce((a, [m, y]) => a + m * y, 0) / Math.max(1, bm);
  add(kg.hardware, by, 'hardware');
  return { kg, buildKg, items: M };
}
