/* Teardown plan: every piece that comes off for transport, its weight and how many people lift it. */
import { R } from '../catalogs/rules.js';
import { TUBE_BUILDS, KITS } from '../catalogs/kits.js';
import { kitPieces } from './model/kits.js';

const people = (kg) => Math.max(1, Math.ceil(kg / R('liftPerPerson')));
/* Where the pieces live between burns: strapped on the vehicle if they're few and it has the room, else a 20′ or a
   40′ shipping container (usable volume after packing loss). Peik Construction hauls the vehicle itself. */
const CONTAINERS = [['20ft', '20′ shipping container', 33.2], ['40ft', '40′ shipping container', 67.7]];
function storagePlan(pieces, g) {
  const vol = pieces.reduce((a, p) => a + (p.vol || 0), 0);
  const onboard = g.loungeLen > 1 ? g.loungeLen * g.floorW * Math.min(1.2, g.hasRoof ? g.roofBottom - g.deckY - 0.3 : 0.8) * 0.5 : 0;
  if (vol <= Math.min(onboard, 4)) return { vol, where: 'vehicle', label: 'On the vehicle', note: `About ${vol.toFixed(1)} m³ of pieces: they fit in the lounge if they’re strapped down well; check every strap before the haul.` };
  const pack = R('containerPacking');
  for (const [id, label, cap] of CONTAINERS) if (vol <= cap * pack) return { vol, where: id, label, note: `About ${vol.toFixed(1)} m³ of pieces: a ${label} holds about ${(cap * pack).toFixed(0)} m³ once packed with blankets and racks.` };
  return { vol, where: '40ft+', label: 'More than one 40′ container', note: `About ${vol.toFixed(1)} m³ of pieces: more than one 40′ container. Fewer, larger pieces or nesting sections would help.` };
}
function bomKg(b) {
  if (!b) return 0;
  return (b.hoop || 0) * R('steelHoop') + (b.ribPly || 0) * R('ply34') + (b.plyBend || 0) * R('plyBend') + (b.alu || 0) * R('skinAlu') + (b.perf || 0) * R('skinPerf')
    + (b.poly || 0) * R('skinPoly') + (b.acm || 0) * R('skinAcm');
}
export function teardownPlan(g, s, w) {
  const pieces = [];
  const push = (group, name, kg, count = 1, vol = 0) => { for (let i = 0; i < count; i++) pieces.push({ group, name, kg, people: people(kg), vol }); };
  const skinOff = s.skinOff !== false;
  if (g.hasTubes && skinOff) {
    const kg = bomKg(g.builtinBom.tubes) * (1 + R('hardware'));
    const n = Math.max(1, g.bom.sections), len = Math.max(0.6, (g.bodyL + s.tubeFront + s.tubeRear) / Math.max(1, n / 2));
    push('Design', `Side tube section (${(TUBE_BUILDS[s.tubeBuild] || TUBE_BUILDS.sheet).label.toLowerCase()})`, kg / n, n, Math.PI * (s.tubeDia / 2) ** 2 * len);
  }
  const coverKg = bomKg(g.builtinBom.covers);
  if (coverKg > 0.5 && skinOff) push('Design', 'Hood and fender cover panel', coverKg / 3, 3, 0.3);
  if (skinOff) for (const r of g.kitResults) {
    const area = Object.values(r.area).reduce((a, v) => a + v, 0), ps = kitPieces(r, KITS[r.id]);
    for (const p of ps) pieces.push({ group: 'Design', ...p, vol: area * R('skinStackDepth') / ps.length });
  }
  if (g.bikeCount) push('Extras', 'Bike', 15, g.bikeCount, 0.45);
  if (s.speakers === 'corners' && !g.barge) push('Sound', 'Hung speaker', w.kg.sound / 4, 4, 0.12);
  const stepTreads = g.bom.stairs - (g.stair ? g.stair.n : 0);
  if (stepTreads > 0) push('Structure', 'Entry step', R('stairKg') * stepTreads / Math.max(1, (s.driverStep ? 1 : 0) + (s.secondStep !== 'none' ? 1 : 0)), (s.driverStep ? 1 : 0) + (s.secondStep !== 'none' ? 1 : 0), 0.15);
  const roofOff = !!s.removeRoof, railsOff = roofOff || !!s.removeRails;
  if (railsOff && g.decks.length) {
    const railKg = g.bom.rail * R('steelRail') * (s.material === 'alu' ? R('aluSecondary') : 1);
    const n = Math.max(1, Math.round(g.railRun / 2.4));
    push('Upper deck', 'Rail section', railKg / n, n, 2.4 * s.railHeight * 0.1);
    if (g.seatsRoof) push('Upper deck', s.roofSeating === 'pillows' ? 'Floor pillow' : 'Daybed cushion', s.roofSeating === 'pillows' ? 5 : 10, g.seatsRoof, s.roofSeating === 'pillows' ? 0.08 : 0.25);
    if (s.ladder === 'front' || s.ladder === 'rear') push('Upper deck', 'Ladder', 18, 1, 0.15);
    for (const z of g.zones.filter((zz) => zz.level === 'upper')) push('Upper deck', z.name, z.kg, 1, 0.6);
    if (s.neon && s.v1) push('Lights', 'Neon sign', 3);
    if (g.projectorCount) push('Lights', 'Projector', 4, g.projectorCount);
  }
  if (roofOff && g.hasRoof) {
    const n = Math.max(1, Math.round(g.roofL / 1.22));
    const roofKg = g.bom.roofFrame * R('steel15in16') + g.deckArea * R('ply34') + g.bom.cloth * R('skinCloth');
    push('Roof', 'Roof panel with its frame', roofKg / n, n, 1.22 * g.roofW * 0.2);
    const posts = Math.round((g.bom.post - 2 * (g.roofL) - 2 * g.floorW) / Math.max(0.5, s.headroom));
    if (posts > 0) push('Roof', 'Post', s.headroom * R('steel15in14') + 2, posts, 0.02);
  }
  const totalKg = pieces.reduce((a, p) => a + p.kg, 0);
  const heavy = pieces.filter((p) => p.people >= 3).length;
  const tier = pieces.length <= 12 && heavy === 0 ? 1 : pieces.length <= 30 && heavy <= 4 ? 2 : 3;
  return { pieces, totalKg, tier, storage: storagePlan(pieces, g) };
}
