/* The base vehicle, built from body-builder style dimensions: bumper to axle (BA), cab position, frame height, track,
   wheel positions, hood and cab shape. Parts that explain constraints are modeled: frame rails and crossmembers, axles,
   fuel tank or EV battery boxes, exhaust, cab with doors, windshield and mirrors, hood, fenders, grille and headlights at
   the factory positions; on carts the tub, seats, roll bar and cargo bed. */
import { Vec3, TAU, clamp } from '../math.js';
import { mesh, box, rbox, cylX, rod, group, geo, profile } from './prims.js';

/* ctx: { s, C, fa, ra, dh, cabFloor, cabRoof, seatY, driverX, driverZ, xbR, hasCab, noPassenger, strip, deckY } */
export function buildVehicle(g, ctx) {
  if (ctx.C.style === 'cart') buildCart(g, ctx); else buildTruck(g, ctx);
}

/* A wheel-arch lip in the XY plane over a wheel at (x, r), on the body side at z. */
function archLip(x, wr, z, mat, g, tube = 0.035) {
  const R = wr + 0.07, a0 = Math.acos(Math.min(1, (wr - 0.01) / (R + tube)));   // ends stay within the tire's own length
  const m = mesh(geo('Torus', R, tube, 6, 28, Math.PI - 2 * a0), mat, g);
  m.position.set(x, wr, z); m.rotation.z = a0;
  return m;
}

/* Utility cart: frame, floorboard, front cowl with lights, body and fenders above the wheels, two seats,
   optional roll bar and canopy, optional stock bed. */
function buildCart(g, x) {
  const { s, C, fa, ra, cabFloor, seatY, driverX } = x;
  const bumper = fa + C.ba, rear = bumper - C.length;
  const wr = s.wheelDia / 2, wTop = s.wheelDia + 0.02;
  const y0 = 0.16, y1 = s.frameHeight - 0.02 - (s.bed === false ? 0.1 : 0);
  const bw = C.width - 0.1, cw = C.cab.width;
  box(C.length - 0.4, 0.12, Math.max(0.4, bw * 0.45), 'chassis', (bumper + rear) / 2, y0 + 0.1, 0, g);   // ladder frame
  // body above the wheels, skirts between and behind them
  const bodyBot = Math.min(y1 - 0.04, Math.max(y0 + 0.1, wTop));
  profile([[rear, bodyBot], [bumper - 0.5, bodyBot], [bumper - 0.5, y1], [rear + 0.04, y1], [rear, y1 - 0.04]], bw, 0.03, 'cab', 0, g);
  const skirt = (xa, xb) => { if (xb - xa > 0.08) rbox(xb - xa, bodyBot - y0 - 0.04, bw - 0.04, 0.02, 'cab', (xa + xb) / 2, (bodyBot + y0 + 0.04) / 2, 0, g); };
  skirt(ra + wr + 0.07, fa - wr - 0.07); skirt(rear, ra - wr - 0.07);
  for (const ax of [fa, ra]) for (const sz of [-1, 1]) archLip(ax, wr, sz * (bw / 2 - 0.03), 'trim', g, 0.03);
  // front cowl with headlights, the floorboard and dash
  const cowlY = Math.max(0.14, cabFloor - 0.1);
  profile([[bumper - 0.62, cowlY], [bumper, cowlY], [bumper, cabFloor + 0.42], [bumper - 0.13, cabFloor + 0.6], [bumper - 0.62, cabFloor + 0.64]], cw, 0.06, 'cab', 0, g);
  for (const sz of [-1, 1]) {
    rbox(0.03, 0.09, 0.18, 0.012, 'head', bumper + 0.005, cabFloor + 0.4, sz * cw * 0.32, g);
    box(0.02, 0.05, 0.1, 'amber', bumper + 0.004, cabFloor + 0.27, sz * cw * 0.38, g, false);
  }
  rbox(0.08, 0.16, cw - 0.06, 0.03, 'trim', bumper - 0.02, cowlY + 0.06, 0, g);   // front bumper
  box(Math.max(0.3, bumper - 0.6 - (driverX - 0.25)), 0.03, bw - 0.08, 'trim', (bumper - 0.6 + driverX - 0.25) / 2, cabFloor - 0.015, 0, g);
  box(0.25, 0.04, cw - 0.1, 'leather', bumper - 0.5, cabFloor + 0.64, 0, g);
  for (const sz of [-1, 1]) {
    rbox(0.48, 0.13, 0.46, 0.05, 'leather', driverX, seatY - 0.065, sz * Math.abs(C.seat.z), g);
    const b = rbox(0.1, 0.58, 0.44, 0.04, 'leather', driverX - 0.26, seatY + 0.26, sz * Math.abs(C.seat.z), g); b.rotation.z = 0.16;
    box(0.3, seatY - 0.13 - cabFloor, 0.3, 'cab', driverX, (seatY - 0.13 + cabFloor) / 2, sz * Math.abs(C.seat.z), g);
    box(0.02, 0.07, 0.12, 'tail', rear - 0.004, y1 - 0.08, sz * (bw / 2 - 0.1), g, false);
  }
  // axles
  for (const ax of [fa, ra]) cylX(0.035, s.track - 0.15, 'chassis', ax, s.wheelDia / 2, 0, g, 10).rotation.set(Math.PI / 2, 0, 0);
  if (C.powertrain === 'electric') box(0.9, 0.28, 0.7, 'vent', (fa + ra) / 2 - 0.2, 0.36, 0, g);   // battery tray
  else box(0.5, 0.3, 0.5, 'grille', ra + 0.2, 0.38, 0, g);   // engine
  // stock cargo bed: steel deck with low sides behind the seats
  if (s.bed !== false && C.deck) {
    const bx1 = driverX - 0.4, bx0 = Math.max(rear, bx1 - C.deck.length);
    for (const sz of [-1, 1]) box(bx1 - bx0, 0.12, 0.03, 'chassis', (bx0 + bx1) / 2, s.frameHeight + 0.04, sz * C.deck.width / 2, g, false);
    box(0.03, 0.12, C.deck.width, 'chassis', bx0 + 0.015, s.frameHeight + 0.04, 0, g, false);
  }
  // factory roll bar and canopy over the seats
  if (s.rops) {
    const top = C.cab.roofY + x.dh, xb = driverX - 0.35, xf = bumper - 0.35, w = C.cab.width / 2 - 0.04;
    const parts = group('Roll bar'); g.add(parts);
    for (const sz of [-1, 1]) {
      rod(new Vec3(xb, cabFloor, sz * w), new Vec3(xb, top, sz * w), 0.025, 'chassis', parts, false, 8);
      rod(new Vec3(xf, cabFloor + 0.6, sz * w), new Vec3(xf - 0.25, top, sz * w), 0.025, 'chassis', parts, false, 8);
      rod(new Vec3(xb, top, sz * w), new Vec3(xf - 0.25, top, sz * w), 0.025, 'chassis', parts, false, 8);
    }
    rbox(xf - 0.25 - xb + 0.1, 0.03, w * 2 + 0.1, 0.012, 'cab', (xb + xf - 0.25) / 2, top + 0.02, 0, parts);
  }
}

/* Truck chassis at three strip levels. Stock: cab, doors, windshield, mirrors and bumper. Cut at the windshield base:
   hood, fenders, dash, steering, floor and seats stay. Frame rails: only the frame, the running gear, an engine that
   needs its own cover, and the driver's controls on a new platform. Body shapes follow the family: a van nose on
   cutaways, a long flat hood on chassis cabs, a flat-faced cab over the front axle on cab-overs. */
function buildTruck(g, x) {
  const { s, C, fa, ra, dh, cabFloor, cabRoof, seatY, driverX, driverZ, xbR, hasCab, noPassenger } = x;
  const strip = s.strip === 'rails' ? 'rails' : hasCab ? 'stock' : 'cut';
  const cab = C.cab, conv = C.style === 'conventional', van = conv && C.family === 'cutaway';
  const bumper = fa + C.ba, cb = fa + cab.back, cf = fa + cab.front, cw = cab.width;
  const belt = cabFloor + (conv ? 0.72 : 0.62), low = cabFloor - 0.3;
  const slant = conv ? (van ? 0.45 : 0.28) : 0.12;
  const wr = s.wheelDia / 2, wTop = s.wheelDia + 0.03;
  // frame rails run to the factory frame end, or to the body's rear end where the build is shorter
  const frameEnd = ra - C.af + 0.02;
  const railX1 = bumper - 0.2, railX0 = s.preview ? frameEnd : Math.max(frameEnd, xbR + 0.1), railY = s.frameHeight - 0.13;
  for (const sz of [-1, 1]) box(railX1 - railX0, 0.26, 0.09, 'chassis', (railX1 + railX0) / 2, railY, sz * 0.43, g);
  const nCross = Math.max(2, Math.round((railX1 - railX0) / 0.9));
  for (let i = 0; i <= nCross; i++) box(0.07, 0.16, 0.77, 'chassis', railX0 + 0.04 + (railX1 - railX0 - 0.08) * i / nCross, railY, 0, g, false);
  for (const sz of [-1, 1]) box(0.03, 0.08, 0.16, 'tail', railX0 - 0.01, railY - 0.02, sz * 0.62, g, false);   // temporary tail lamps on a bracket
  box(0.05, 0.05, 1.4, 'chassis', railX0 + 0.03, railY - 0.02, 0, g, false);
  // axles and differential
  cylX(0.06, s.track - 0.2, 'chassis', fa, wr, 0, g, 12).rotation.set(Math.PI / 2, 0, 0);
  cylX(0.08, s.track - 0.2, 'chassis', ra, wr, 0, g, 12).rotation.set(Math.PI / 2, 0, 0);
  const diff = mesh(geo('Sphere', 0.17, 16, 10), 'chassis', g); diff.position.set(ra, wr, 0);
  if (C.axles === 3) cylX(0.08, s.track - 0.2, 'chassis', ra - 1.3, wr, 0, g, 12).rotation.set(Math.PI / 2, 0, 0);
  for (const ax of C.axles === 3 ? [fa, ra, ra - 1.3] : [fa, ra]) for (const sz of [-1, 1]) {   // leaf springs, within the frame
    const a = Math.max(railX0, ax - 0.55), b = Math.min(railX1, ax + 0.55);
    if (b - a > 0.2) box(b - a, 0.05, 0.08, 'chassis', (a + b) / 2, wr + 0.12, sz * 0.43, g, false);
  }
  // fuel tank or battery boxes between the axles, exhaust on the passenger side
  const midX = (fa + ra) / 2, under = (y, half) => Math.max(y, half + 0.12);   // keep underbody parts off the ground
  if (C.powertrain === 'electric') {
    box(Math.min(2.4, (fa - ra) * 0.55), 0.34, 0.74, 'vent', midX - 0.2, under(railY - 0.3, 0.17), 0, g);
    for (const sz of [-1, 1]) box(Math.min(1.6, (fa - ra) * 0.4), 0.36, 0.34, 'vent', midX - 0.3, under(railY - 0.1, 0.18), sz * 0.66, g);
  } else {
    const tank = mesh(geo('Cylinder', 0.24, 0.24, 0.8, 20), 'trim', g); tank.rotation.z = Math.PI / 2; tank.position.set(midX + 0.2, under(railY - 0.12, 0.24), -0.7);
    const exEnd = Math.max(ra - 0.6, xbR + 0.25), exY = under(railY - 0.25, 0.04), ex0 = new Vec3(fa - 0.6, exY, 0.3), ex1 = new Vec3(midX, exY, 0.62), ex2 = new Vec3(exEnd, exY, 0.62);
    rod(ex0, ex1, 0.035, 'rim', g, false, 8); rod(ex1, ex2, 0.035, 'rim', g, false, 8);
    const muff = mesh(geo('Cylinder', 0.12, 0.12, 0.6, 16), 'rim', g); muff.rotation.z = Math.PI / 2; muff.position.set(midX - 0.4, under(railY - 0.22, 0.12), 0.62);
  }
  if (C.drum) buildDrum(g, x);
  const yBump = conv ? 0.62 + dh : low - 0.12;
  if (strip === 'stock') rbox(0.22, 0.3, cw + 0.05, 0.05, conv && !van ? 'chrome' : 'trim', bumper - 0.11, yBump, 0, g);   // bumper, gone once the cab is cut
  if (strip === 'stock') {
    // cab shell: a bevelled side profile, the lower front corner cut back where the front wheel tucks under it
    const yb = conv ? low : Math.max(low, wTop);
    const wheelRear = fa - wr - 0.06, tuck = conv && cf > wheelRear;
    const pts = [[cb, yb], ...(tuck ? [[Math.max(cb + 0.3, wheelRear), yb], [cf, Math.min(belt - 0.1, Math.max(yb, wTop))]] : [[cf - 0.04, yb], [cf, yb + 0.06]]),
      [cf, belt], [cf - slant, cabRoof - 0.03], [cf - slant - 0.06, cabRoof], [cb + 0.04, cabRoof], [cb, cabRoof - 0.04]];
    profile(pts, cw, 0.07, 'cab', 0, g);
    if (!conv) {   // cab-over: skirts in front of and behind the front wheel, under the cab
      const skirt = (xa, xb) => { if (xb - xa > 0.08) rbox(xb - xa, yb - low + 0.02, cw - 0.04, 0.03, 'cab', (xa + xb) / 2, (yb + low) / 2, 0, g); };
      skirt(fa + wr + 0.07, cf - 0.01); skirt(cb, fa - wr - 0.07);
      for (const sz of [-1, 1]) {
        archLip(fa, wr, sz * (cw / 2 - 0.02), 'trim', g);
        box(0.3, 0.04, 0.22, 'trim', fa - wr - 0.25, low + 0.18, sz * (cw / 2 - 0.08), g, false);   // entry step
      }
    }
    // windshield, side and rear glass sit just proud of the shell
    const wsH = cabRoof - 0.06 - belt, wsLen = Math.hypot(slant, wsH), wsAng = Math.atan2(slant, wsH), nx = wsH / wsLen, ny = slant / wsLen;
    const ws = box(0.012, wsLen - 0.1, cw - 0.2, 'tint', cf - slant / 2 + nx * 0.008, belt + wsH / 2 + ny * 0.008, 0, g, false); ws.rotation.z = wsAng;
    const xe = (y) => cf - slant * (y - belt) / wsH;
    const gy0 = belt + 0.05, gy1 = cabRoof - 0.12, gx0 = cb + (conv && !van ? 0.14 : 0.18);
    for (const sz of [-1, 1]) {
      profile([[gx0, gy0], [xe(gy0) - 0.1, gy0], [xe(gy1) - 0.1, gy1], [gx0, gy1]], 0.01, 0.003, 'tint', sz * (cw / 2 + 0.002), g, false);
      // door seam, handle and mirror
      const dx0 = Math.max(cb + 0.15, cf - (conv ? 1.05 : 0.95)), dx1 = cf - (conv ? 0.08 : 0.05);
      for (const xx of [dx0, dx1]) box(0.012, belt - yb - 0.08, 0.004, 'grille', xx, (belt + yb) / 2, sz * (cw / 2 + 0.002), g, false);
      box(0.12, 0.03, 0.02, 'chrome', dx0 + 0.12, belt - 0.12, sz * (cw / 2 + 0.01), g, false);
      const mz = sz * (cw / 2 + 0.2);
      // mirrors are exempt from width limits, so they stay out of the measured bounds
      rod(new Vec3(cf - 0.12, belt + 0.05, sz * (cw / 2)), new Vec3(cf - 0.12, belt + 0.12, mz), 0.012, 'trim', g, false, 6).userData.noBox = true;
      rbox(0.06, 0.32, 0.2, 0.02, 'trim', cf - 0.12, belt + 0.22, mz, g).userData.noBox = true;
      box(0.025, 0.045, 0.08, 'amber', cf - 0.03, belt - 0.05, sz * (cw / 2 - 0.02), g, false);   // side marker
    }
    if (!van) box(0.012, cabRoof - 0.26 - belt, cw - 0.5, 'tint', cb - 0.004, (cabRoof - 0.14 + belt) / 2 + 0.02, 0, g, false);   // rear window
    box(0.34, 0.38, cw - 0.16, 'leather', cf - (conv ? 0.36 : 0.3), belt - 0.12, 0, g);   // dash
    if (!conv) {   // cab-over face: grille, headlights at the lower corners, badge bar
      rbox(0.03, (belt - low) * 0.45, cw - 0.7, 0.01, 'grille', cf + 0.006, low + (belt - low) * 0.42, 0, g);
      box(0.02, 0.05, cw - 0.4, 'chrome', cf + 0.012, belt - 0.12, 0, g, false);
      for (const sz of [-1, 1]) {
        rbox(0.03, 0.14, 0.32, 0.02, 'head', cf + 0.008, low + 0.17, sz * (cw / 2 - 0.3), g);
        box(0.02, 0.06, 0.12, 'amber', cf + 0.006, low + 0.17, sz * (cw / 2 - 0.08), g, false);
      }
    }
  } else if (strip === 'cut') {
    if (conv) {
      box(0.1, cab.hoodTop + dh + 0.06 - cabFloor, cw - 0.2, 'cab', cf + 0.05, (cab.hoodTop + dh + 0.06 + cabFloor) / 2, 0, g);   // cowl, the base of the old windshield
      if (C.doghouse) rbox(0.7, 0.36, 0.5, 0.08, 'cab', cf - 0.4, cabFloor + 0.18, 0.02, g);
    } else {
      const top = cabFloor + 0.42;
      rbox(0.08, top - low, cw - 0.1, 0.02, 'cab', cf - 0.04, (top + low) / 2, 0, g);   // low front panel carrying the lights
      for (const sz of [-1, 1]) rbox(0.03, 0.12, 0.3, 0.02, 'head', cf + 0.01, low + 0.15, sz * (cw / 2 - 0.3), g);
      rbox(0.8, 0.42, 0.5, 0.08, 'cab', cf - 0.95, cabFloor + 0.21, 0.05, g);   // engine cover between the seats
    }
    const dx = conv ? cf - 0.2 : cf - 0.32;
    const dy = conv ? Math.max(cabFloor + 0.62, cab.hoodTop + dh - 0.05) : cabFloor + 0.62;
    box(0.36, 0.24, cw - 0.28, 'leather', dx, dy, 0, g);   // factory dash
    box(0.2, Math.max(0.1, dy - 0.12 - cabFloor), cw - 0.5, 'leather', dx + 0.06, (dy - 0.12 + cabFloor) / 2, 0, g);
    rbox(0.14, 0.12, 0.36, 0.04, 'grille', dx - 0.12, dy + 0.1, driverZ, g);
    box(Math.max(0.3, (conv ? cf : cf - 0.1) - (cb + 0.1)), 0.03, cw - 0.12, 'trim', ((conv ? cf : cf - 0.1) + cb + 0.1) / 2, cabFloor - 0.015, 0, g);   // floor pan
  } else {
    // frame rails only: engine block and radiator need their own cover; a small platform carries the driver
    const ex = conv ? fa + 0.15 : fa - 0.1, eTop = conv ? (cab.hoodTop || 1.3) + dh - 0.12 : cabFloor + 0.4;
    box(0.9, eTop - railY, 0.62, 'grille', ex, (eTop + railY) / 2, 0, g);
    box(0.08, eTop - railY + 0.1, 0.75, 'vent', bumper - 0.3, (eTop + railY) / 2 + 0.05, 0, g);   // radiator
    for (const sz of [-1, 1]) box(0.04, 0.12, 0.26, 'head', bumper - 0.27, railY + 0.25, sz * 0.55, g, false);   // headlights on brackets, factory height
    box(Math.max(0.6, driverX + 0.6 - (cb - 0.1)), 0.04, cw - 0.2, 'chassis', (driverX + 0.6 + cb - 0.1) / 2, cabFloor - 0.02, 0, g);
    box(0.25, 0.5, 0.25, 'leather', driverX + 0.55, cabFloor + 0.25, driverZ, g);   // pedal box and column base
  }
  for (const sz of [-1, 1]) {
    if (sz > 0 && (noPassenger || strip === 'rails')) continue;
    const z = sz > 0 ? Math.abs(driverZ) : driverZ;
    rbox(0.5, 0.14, 0.52, 0.05, 'leather', driverX, seatY - 0.07, z, g);
    const b = rbox(0.12, 0.72, 0.5, 0.05, 'leather', driverX - 0.28, seatY + 0.32, z, g); b.rotation.z = 0.14;
    if (strip !== 'stock') box(0.34, seatY - 0.14 - cabFloor, 0.34, 'chassis', driverX, (seatY - 0.14 + cabFloor) / 2, z, g);
  }
  if (conv && strip !== 'rails') {
    // hood: long and flat on a chassis cab, a short sloping van nose on a cutaway
    const hx1 = bumper - 0.18, hTop = cab.hoodTop + dh, hBot = 0.78 * (s.wheelDia / 0.8) + dh * 0.5;
    const fTop = van ? hBot + (hTop - hBot) * 0.55 : hTop - 0.03;
    profile([[cf, hBot], [hx1, hBot], [hx1, fTop - 0.05], [hx1 - (van ? 0.14 : 0.1), fTop], [cf, hTop]], cab.hoodW, van ? 0.09 : 0.05, 'cab', 0, g);
    const gH = (fTop - hBot) * (van ? 0.5 : 0.62), gY = hBot + (fTop - hBot) * (van ? 0.42 : 0.5);
    rbox(0.04, gH + 0.06, cab.hoodW - (van ? 0.5 : 0.3), 0.02, van ? 'trim' : 'chrome', hx1 + 0.006, gY, 0, g);   // grille surround
    box(0.04, gH, cab.hoodW - (van ? 0.58 : 0.38), 'grille', hx1 + 0.012, gY, 0, g);
    for (const sz of [-1, 1]) {
      rbox(0.04, van ? 0.14 : 0.2, van ? 0.24 : 0.2, 0.02, 'head', hx1 + 0.01, van ? gY + 0.02 : gY + 0.02, sz * (cab.hoodW / 2 - (van ? 0.16 : 0.1)), g);
      box(0.02, 0.05, 0.12, 'amber', hx1 + 0.008, hBot + 0.06, sz * (cab.hoodW / 2 - 0.12), g, false);
      // fender over the front wheel, panels ahead of and behind it, and the arch lip
      const fw = Math.max(0.12, (cw - cab.hoodW) / 2), zf = sz * (cab.hoodW / 2 + fw / 2);
      const fx0 = Math.max(cf, fa - wr - 0.3), fx1 = hx1 - 0.02, fy1 = Math.max(wTop + 0.12, van ? fTop : hBot + (hTop - hBot) * 0.55);
      profile([[fx0, wTop], [fx1, wTop], [fx1, fy1 - 0.05], [fx1 - 0.1, fy1], [fx0, fy1]], fw, 0.04, 'cab', zf, g);
      if (fx1 - (fa + wr + 0.07) > 0.08) rbox(fx1 - (fa + wr + 0.07), wTop - yBump + 0.02, fw, 0.02, 'cab', (fx1 + fa + wr + 0.07) / 2, (wTop + yBump) / 2, zf, g);
      if (fa - wr - 0.07 - cf > 0.08) rbox(fa - wr - 0.07 - cf, wTop - low + 0.02, fw, 0.02, 'cab', (fa - wr - 0.07 + cf) / 2, (wTop + low) / 2, zf, g);
      archLip(fa, wr, sz * (cw / 2 - 0.03), van ? 'cab' : 'trim', g);
    }
  }
}

/* A concrete mixer drum on the frame, tilted up toward the back. */
function buildDrum(g, x) {
  const { s, C, fa } = x;
  const d = C.drum, cb = fa + C.cab.back - 0.3;
  const x1 = cb, x0 = cb - d.length, yc = s.frameHeight + 0.25 + d.dia / 2;
  const dg = group('Mixer drum'); g.add(dg);
  dg.position.set((x0 + x1) / 2, yc, 0);
  dg.rotation.z = -d.tilt * Math.PI / 180;
  const body = mesh(geo('Cylinder', d.dia * 0.42, d.dia / 2, d.length * 0.6, 28), 'rim', dg); body.rotation.z = Math.PI / 2; body.position.x = -d.length * 0.05;
  const cone = mesh(geo('Cylinder', d.dia * 0.2, d.dia * 0.42, d.length * 0.4, 28), 'rim', dg); cone.rotation.z = Math.PI / 2; cone.position.x = -d.length * 0.55;
  // stands from the frame up to the drum's underside, front and rear
  const t = d.tilt * Math.PI / 180, xc = (x0 + x1) / 2;
  for (const [u, r] of [[d.length * 0.2, d.dia * 0.49], [-d.length * 0.45, d.dia * 0.365]]) {
    const sx = xc + u * Math.cos(t) - r * Math.sin(t), top = yc - u * Math.sin(t) - r * Math.cos(t);
    if (top - s.frameHeight > 0.05) box(0.25, top - s.frameHeight + 0.06, 0.9, 'chassis', sx, (top + s.frameHeight) / 2, 0, g);
  }
}
export function drumFootprint(C, fa) {
  if (!C.drum) return null;
  const cb = fa + C.cab.back - 0.3;
  return [cb - C.drum.length - 0.2, cb + 0.1, -C.drum.dia / 2 - 0.1, C.drum.dia / 2 + 0.1];
}
