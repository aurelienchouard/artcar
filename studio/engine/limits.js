/* How far the body may grow on a given chassis (section 4.2). Rear overhang up to 60% of the wheelbase on trucks
   and 70% on carts (or the vehicle's own rear overhang plus 6″ if that's more), about 1′ past the vehicle front,
   and between 0.3 m and 1 m wider than the vehicle. */
import { R } from '../catalogs/rules.js';
import { clamp } from './math.js';
export function bodyLimits(s, C) {
  const ownRear = C.af;
  const rearMax = Math.max(ownRear + R('rearOverhangOwnPlus'), (C.style === 'cart' ? R('rearOverhangCart') : R('rearOverhangTruck')) * s.wheelbase);
  // without the hood and fenders the vehicle's front is the frame end, a little behind the old bumper line
  const frontMax = C.ba + R('bodyFrontPastBumper') + (s.strip === 'rails' && C.style === 'conventional' ? 0 : 0);
  const bf = clamp(s.bodyFront, -0.5, frontMax);
  return {
    bodyFront: [-0.5, frontMax],
    length: [3, Math.max(3, +(bf + s.wheelbase + rearMax).toFixed(2))],
    width: [Math.max(1.6, +(C.width + (C.family === 'reality-check' ? 0 : R('bodyWidthPlusMin'))).toFixed(2)), +(C.width + R('bodyWidthPlusMax')).toFixed(2)],
    rearMax,
  };
}
