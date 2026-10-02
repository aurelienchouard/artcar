/* Static tipping estimate: loaded center of gravity from the chassis, every build item at its height, riders at
   seat, platform or standing heights with the roof filled first (worst case), capped by payload.
   Tip threshold (lateral g) = (track / 2) / CG height. Ignores suspension roll and soft tires. */
import { R } from '../catalogs/rules.js';
import { LB_PER_KG, riderKg } from './weight.js';
import { radToDeg } from './math.js';
export function tipping(g, s, C, items, rc) {
  const M = items.map(([m, y]) => [m, y]);
  M.push([C.curbLb / LB_PER_KG, (C.cgY || 0.5) + g.dh]);
  M.push([riderKg(), g.seatY + 0.3]);   // driver
  const roofY = g.seatsRoof + g.standRoof ? (g.seatsRoof * (g.roofTop + 0.6) + g.standRoof * (g.roofTop + 1.03)) / (g.seatsRoof + g.standRoof) : 0;
  const lowSeatY = s.layout === 'platform' ? g.deckY + 0.45 : g.deckY + 0.75;
  const lowY = g.seatsLow + g.standLow ? (g.seatsLow * lowSeatY + g.standLow * (g.deckY + 1.0)) / (g.seatsLow + g.standLow) : 0;
  if (rc.roofN > 0) M.push([rc.roofN * riderKg(), roofY]);
  if (rc.lowN > 0) M.push([rc.lowN * riderKg(), lowY]);
  const cgH = M.reduce((a, [m, y]) => a + m * y, 0) / M.reduce((a, [m]) => a + m, 0);
  const ssf = (s.track / 2) / cgH;
  return { cgH, ssf, deg: radToDeg(Math.atan(ssf)), riders: rc.roofN + rc.lowN, margin: ssf / R('tightTurn') };
}
