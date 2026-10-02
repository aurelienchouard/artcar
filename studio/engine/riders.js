/* Riders: counted from the layout (seats plus standing room), then capped by payload. */
import { LB_PER_KG, riderKg } from './weight.js';
export function riderCount(g, C, buildKg) {
  const payloadKg = C.payloadLb / LB_PER_KG;
  const cap = Math.max(0, Math.floor((payloadKg - buildKg) / riderKg()) - 1);   // the driver always rides
  const seats = g.seatsLow + g.seatsRoof, standing = g.standLow + g.standRoof, room = seats + standing;
  const riders = Math.min(room, cap);
  const roofN = Math.min(g.seatsRoof + g.standRoof, cap), lowN = Math.min(g.seatsLow + g.standLow, cap - roofN);
  return { payloadKg, cap, seats, standing, room, riders, capped: riders < room, roofN, lowN };
}
