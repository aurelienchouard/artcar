/* How far the body may grow on a given chassis (section 4.2, revised). The structure always wraps the front of the
   vehicle: it starts a little past the front bumper so a skin can cover the engine. Its length runs at least past the
   rear wheel, defaults to an ideal rear overhang of about 45% of the wheelbase (kept under about 21′8″ so the car stays under the DMV's 25′ line with side
   tubes on and fits common trailers), and stops at 60% of the wheelbase on
   trucks and 70% on carts (or the vehicle's own rear overhang plus 6″ if that's more). Width is 0.3–1 m over the
   vehicle's. */
import { R } from '../catalogs/rules.js';
import { clamp } from './math.js';
export function bodyLimits(s, C) {
  const ownRear = C.af;
  const rearMax = Math.max(ownRear + R('rearOverhangOwnPlus'), (C.style === 'cart' ? R('rearOverhangCart') : R('rearOverhangTruck')) * s.wheelbase);
  const rearMin = Math.min(rearMax, s.wheelDia / 2 + 0.15);   // past the rear tire
  const rearIdeal = clamp(R('rearOverhangIdeal') * s.wheelbase, Math.max(rearMin, Math.min(ownRear, rearMax)), rearMax);
  const frontMin = C.ba + R('bodyFrontMinPastBumper'), frontMax = C.ba + R('bodyFrontPastBumper');
  const bf = clamp(s.bodyFront, frontMin, frontMax);
  const len = (rear) => +(bf + s.wheelbase + rear).toFixed(2);
  return {
    bodyFront: [+frontMin.toFixed(3), +frontMax.toFixed(3)],
    length: [len(rearMin), len(rearMax)],
    ideal: Math.min(len(rearIdeal), Math.max(len(rearMin), R('idealMaxLength'))),
    width: [Math.max(1.6, +(C.width + (C.family === 'reality-check' ? 0 : R('bodyWidthPlusMin'))).toFixed(2)), +(C.width + R('bodyWidthPlusMax')).toFixed(2)],
    rearMax, rearMin, rearIdeal,
  };
}
