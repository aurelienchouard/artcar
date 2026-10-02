/* Teardown plan: every piece that comes off for transport, its weight and how many people lift it. */
import { R } from '../catalogs/rules.js';
import { TUBE_BUILDS, KITS } from '../catalogs/kits.js';
import { kitPieces } from './model/kits.js';

const people = (kg) => Math.max(1, Math.ceil(kg / R('liftPerPerson')));
function bomKg(b) {
  if (!b) return 0;
  return (b.hoop || 0) * R('steelHoop') + (b.ribPly || 0) * R('ply34') + (b.plyBend || 0) * R('plyBend') + (b.alu || 0) * R('skinAlu') + (b.perf || 0) * R('skinPerf')
    + (b.poly || 0) * R('skinPoly') + (b.acm || 0) * R('skinAcm');
}
export function teardownPlan(g, s, w) {
  const pieces = [];
  const push = (group, name, kg, count = 1) => { for (let i = 0; i < count; i++) pieces.push({ group, name, kg, people: people(kg) }); };
  if (g.hasTubes) {
    const kg = bomKg(g.builtinBom.tubes) * (1 + R('hardware'));
    const n = Math.max(1, g.bom.sections);
    push('Design', `Side tube section (${(TUBE_BUILDS[s.tubeBuild] || TUBE_BUILDS.sheet).label.toLowerCase()})`, kg / n, n);
  }
  const coverKg = bomKg(g.builtinBom.covers);
  if (coverKg > 0.5) push('Design', 'Hood and fender cover panel', coverKg / 3, 3);
  for (const r of g.kitResults) for (const p of kitPieces(r, KITS[r.id])) pieces.push({ group: 'Design', ...p });
  if (g.bikeCount) push('Extras', 'Bike', 15, g.bikeCount);
  if (s.speakers === 'corners' && !g.barge) push('Sound', 'Hung speaker', w.kg.sound / 4, 4);
  const stepTreads = g.bom.stairs - (g.stair ? g.stair.n : 0);
  if (stepTreads > 0) push('Structure', 'Entry step', R('stairKg') * stepTreads / Math.max(1, (s.driverStep ? 1 : 0) + (s.secondStep !== 'none' ? 1 : 0)), (s.driverStep ? 1 : 0) + (s.secondStep !== 'none' ? 1 : 0));
  const roofOff = !!s.removeRoof, railsOff = roofOff || !!s.removeRails;
  if (railsOff && g.decks.length) {
    const railKg = g.bom.rail * R('steelRail') * (s.material === 'alu' ? R('aluSecondary') : 1);
    const n = Math.max(1, Math.round(g.railRun / 2.4));
    push('Upper deck', 'Rail section', railKg / n, n);
    if (g.seatsRoof) push('Upper deck', s.roofSeating === 'pillows' ? 'Floor pillow' : 'Daybed cushion', s.roofSeating === 'pillows' ? 5 : 10, g.seatsRoof);
    if (s.ladder === 'front' || s.ladder === 'rear') push('Upper deck', 'Ladder', 18);
    if (s.neon) push('Lights', 'Neon sign', 3);
    if (g.projectorCount) push('Lights', 'Projector', 4, g.projectorCount);
  }
  if (roofOff && g.hasRoof) {
    const n = Math.max(1, Math.round(g.roofL / 1.22));
    const roofKg = g.bom.roofFrame * R('steel15in16') + g.deckArea * R('ply34') + g.bom.cloth * R('skinCloth');
    push('Roof', 'Roof panel with its frame', roofKg / n, n);
    const posts = Math.round((g.bom.post - 2 * (g.roofL) - 2 * g.floorW) / Math.max(0.5, s.headroom));
    if (posts > 0) push('Roof', 'Post', s.headroom * R('steel15in14') + 2, posts);
  }
  const totalKg = pieces.reduce((a, p) => a + p.kg, 0);
  const heavy = pieces.filter((p) => p.people >= 3).length;
  const tier = pieces.length <= 12 && heavy === 0 ? 1 : pieces.length <= 30 && heavy <= 4 ? 2 : 3;
  return { pieces, totalKg, tier };
}
