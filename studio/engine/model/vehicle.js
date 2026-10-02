/* The base vehicle, built from body-builder style dimensions: bumper to axle (BA), cab position, frame height, track,
   wheel positions, hood and cab shape. Parts that explain constraints are modeled: frame rails and crossmembers, axles,
   fuel tank or EV battery boxes, exhaust, cab with doors, windshield and mirrors, hood, fenders, grille and headlights at
   the factory positions; on carts the tub, seats, roll bar and cargo bed. */
import { Vec3, TAU, clamp } from '../math.js';
import { mesh, box, rbox, cylX, rod, group, geo } from './prims.js';

/* ctx: { s, C, fa, ra, dh, cabFloor, cabRoof, seatY, driverX, driverZ, xbR, hasCab, noPassenger, strip, deckY } */
export function buildVehicle(g, ctx) {
  if (ctx.C.style === 'cart') buildCart(g, ctx); else buildTruck(g, ctx);
}

/* Utility cart: tub, front cowl with lights, two seats, optional roll bar and canopy, optional stock bed. */
function buildCart(g, x) {
  const { s, C, fa, ra, cabFloor, seatY, driverX } = x;
  const bumper = fa + C.ba, rear = bumper - C.length;
  const y0 = 0.16, y1 = s.frameHeight - 0.02 - (s.bed === false ? 0.1 : 0);
  box(C.length, y1 - y0, C.width - 0.1, 'cab', (bumper + rear) / 2, (y0 + y1) / 2, 0, g);
  rbox(0.5, 0.62, C.cab.width, 0.06, 'cab', bumper - 0.25, cabFloor + 0.31, 0, g);
  for (const sz of [-1, 1]) box(0.02, 0.08, 0.18, 'head', bumper + 0.005, cabFloor + 0.42, sz * C.cab.width * 0.34, g, false);
  box(0.25, 0.04, C.cab.width - 0.1, 'leather', bumper - 0.5, cabFloor + 0.64, 0, g);
  for (const sz of [-1, 1]) {
    rbox(0.48, 0.13, 0.46, 0.05, 'leather', driverX, seatY - 0.065, sz * Math.abs(C.seat.z), g);
    const b = rbox(0.1, 0.58, 0.44, 0.04, 'leather', driverX - 0.26, seatY + 0.26, sz * Math.abs(C.seat.z), g); b.rotation.z = 0.16;
    box(0.3, seatY - 0.13 - cabFloor, 0.3, 'frame', driverX, (seatY - 0.13 + cabFloor) / 2, sz * Math.abs(C.seat.z), g);
  }
  // axles
  for (const ax of [fa, ra]) cylX(0.035, s.track - 0.15, 'frame', ax, s.wheelDia / 2, 0, g, 10).rotation.set(Math.PI / 2, 0, 0);
  if (C.powertrain === 'electric') box(0.9, 0.28, 0.7, 'vent', (fa + ra) / 2 - 0.2, 0.36, 0, g);   // battery tray
  else box(0.5, 0.3, 0.5, 'grille', ra + 0.2, 0.38, 0, g);   // engine
  // stock cargo bed: steel deck with low sides behind the seats
  if (s.bed !== false && C.deck) {
    const bx1 = driverX - 0.4, bx0 = Math.max(rear, bx1 - C.deck.length);
    for (const sz of [-1, 1]) box(bx1 - bx0, 0.12, 0.03, 'grille', (bx0 + bx1) / 2, s.frameHeight + 0.04, sz * C.deck.width / 2, g, false);
  }
  // factory roll bar and canopy over the seats
  if (s.rops) {
    const top = C.cab.roofY + x.dh, xb = driverX - 0.35, xf = bumper - 0.35, w = C.cab.width / 2 - 0.04;
    const parts = group('Roll bar'); g.add(parts);
    for (const sz of [-1, 1]) {
      rod(new Vec3(xb, cabFloor, sz * w), new Vec3(xb, top, sz * w), 0.025, 'frame', parts, false, 8);
      rod(new Vec3(xf, cabFloor + 0.6, sz * w), new Vec3(xf - 0.25, top, sz * w), 0.025, 'frame', parts, false, 8);
      rod(new Vec3(xb, top, sz * w), new Vec3(xf - 0.25, top, sz * w), 0.025, 'frame', parts, false, 8);
    }
    box(xf - 0.25 - xb + 0.1, 0.03, w * 2 + 0.1, 'cab', (xb + xf - 0.25) / 2, top + 0.02, 0, parts);
  }
}

/* Truck chassis at three strip levels. Stock: cab, doors, windshield, mirrors and bumper. Cut at the windshield base
   (Pingüina): hood, fenders, dash, steering, floor and seats stay. Frame rails: only the frame, the running gear, an
   engine that needs its own cover, and the driver's controls on a new platform. */
function buildTruck(g, x) {
  const { s, C, fa, ra, dh, cabFloor, cabRoof, seatY, driverX, driverZ, xbR, hasCab, noPassenger } = x;
  const strip = s.strip === 'rails' ? 'rails' : hasCab ? 'stock' : 'cut';
  const cab = C.cab, conv = C.style === 'conventional';
  const bumper = fa + C.ba, cb = fa + cab.back, cf = fa + cab.front, cw = cab.width;
  const belt = cabFloor + (conv ? 0.72 : 0.62), low = cabFloor - 0.3;
  const slant = conv ? 0.28 : 0.12;
  const railX1 = bumper - 0.2, railX0 = xbR + 0.1, railY = s.frameHeight - 0.13;
  for (const sz of [-1, 1]) box(railX1 - railX0, 0.26, 0.09, 'frame', (railX1 + railX0) / 2, railY, sz * 0.43, g);
  const nCross = Math.max(2, Math.round((railX1 - railX0) / 0.9));
  for (let i = 0; i <= nCross; i++) box(0.07, 0.16, 0.77, 'frame', railX0 + 0.04 + (railX1 - railX0 - 0.08) * i / nCross, railY, 0, g, false);
  // axles and differential
  const wr = s.wheelDia / 2;
  cylX(0.06, s.track - 0.2, 'frame', fa, wr, 0, g, 12).rotation.set(Math.PI / 2, 0, 0);
  cylX(0.08, s.track - 0.2, 'frame', ra, wr, 0, g, 12).rotation.set(Math.PI / 2, 0, 0);
  const diff = mesh(geo('Sphere', 0.17, 16, 10), 'frame', g); diff.position.set(ra, wr, 0);
  if (C.axles === 3) cylX(0.08, s.track - 0.2, 'frame', ra - 1.3, wr, 0, g, 12).rotation.set(Math.PI / 2, 0, 0);
  // fuel tank or battery boxes between the axles, exhaust on the passenger side
  const midX = (fa + ra) / 2, under = (y, half) => Math.max(y, half + 0.12);   // keep underbody parts off the ground
  if (C.powertrain === 'electric') {
    box(Math.min(2.4, (fa - ra) * 0.55), 0.34, 0.74, 'vent', midX - 0.2, under(railY - 0.3, 0.17), 0, g);
    for (const sz of [-1, 1]) box(Math.min(1.6, (fa - ra) * 0.4), 0.36, 0.34, 'vent', midX - 0.3, under(railY - 0.1, 0.18), sz * 0.66, g);
  } else {
    const tank = mesh(geo('Cylinder', 0.24, 0.24, 0.8, 20), 'grille', g); tank.rotation.z = Math.PI / 2; tank.position.set(midX + 0.2, under(railY - 0.12, 0.24), -0.7);
    const exEnd = Math.max(ra - 0.6, xbR + 0.25), exY = under(railY - 0.25, 0.04), ex0 = new Vec3(fa - 0.6, exY, 0.3), ex1 = new Vec3(midX, exY, 0.62), ex2 = new Vec3(exEnd, exY, 0.62);
    rod(ex0, ex1, 0.035, 'rim', g, false, 8); rod(ex1, ex2, 0.035, 'rim', g, false, 8);
    const muff = mesh(geo('Cylinder', 0.12, 0.12, 0.6, 16), 'rim', g); muff.rotation.z = Math.PI / 2; muff.position.set(midX - 0.4, under(railY - 0.22, 0.12), 0.62);
  }
  if (C.drum) buildDrum(g, x);
  if (strip === 'stock') box(0.22, 0.3, cw + 0.05, 'grille', bumper - 0.11, conv ? 0.62 + dh : low - 0.12, 0, g);   // bumper, gone once the cab is cut
  if (strip === 'stock') {
    rbox(cf - cb, belt - low, cw, 0.06, 'cab', (cb + cf) / 2, (belt + low) / 2, 0, g);
    const roofX0 = cb, roofX1 = cf - slant;
    rbox(roofX1 - roofX0, 0.1, cw, 0.04, 'cab', (roofX0 + roofX1) / 2, cabRoof - 0.05, 0, g);
    const wsH = cabRoof - 0.1 - belt, wsLen = Math.hypot(slant, wsH), wsAng = Math.atan2(slant, wsH);
    const ws = box(0.02, wsLen, cw - 0.12, 'glass', cf - slant / 2 - 0.02, belt + wsH / 2, 0, g, false); ws.rotation.z = wsAng;
    for (const sz of [-1, 1]) {
      const ap = box(0.07, wsLen, 0.07, 'cab', cf - slant / 2 - 0.02, belt + wsH / 2, sz * (cw / 2 - 0.035), g); ap.rotation.z = wsAng;
      box(0.09, cabRoof - belt, 0.07, 'cab', cb + 0.045, (cabRoof + belt) / 2, sz * (cw / 2 - 0.035), g);
      box(roofX1 - cb - 0.14, cabRoof - 0.12 - belt, 0.02, 'glass', (cb + 0.09 + roofX1 - 0.05) / 2, (cabRoof - 0.1 + belt) / 2, sz * (cw / 2 - 0.01), g, false);
      // door seam, handle and mirror
      const dx0 = Math.max(cb + 0.15, cf - (conv ? 1.05 : 0.95)), dx1 = cf - (conv ? 0.08 : 0.05);
      for (const xx of [dx0, dx1]) box(0.012, belt - low - 0.08, 0.004, 'grille', xx, (belt + low) / 2, sz * (cw / 2 + 0.002), g, false);
      box(0.12, 0.03, 0.02, 'rim', dx0 + 0.12, belt - 0.12, sz * (cw / 2 + 0.01), g, false);
      const mz = sz * (cw / 2 + 0.2);
      // mirrors are exempt from width limits, so they stay out of the measured bounds
      rod(new Vec3(cf - 0.12, belt + 0.05, sz * (cw / 2)), new Vec3(cf - 0.12, belt + 0.12, mz), 0.012, 'grille', g, false, 6).userData.noBox = true;
      box(0.06, 0.32, 0.2, 'grille', cf - 0.12, belt + 0.22, mz, g).userData.noBox = true;
    }
    box(0.02, cabRoof - 0.18 - belt, cw - 0.2, 'glass', cb + 0.01, (cabRoof - 0.12 + belt) / 2, 0, g, false);
    box(0.34, 0.38, cw - 0.16, 'leather', cf - (conv ? 0.36 : 0.3), belt - 0.12, 0, g);
  } else if (strip === 'cut') {
    if (conv) {
      box(0.1, cab.hoodTop + dh + 0.06 - cabFloor, cw - 0.2, 'cab', cf + 0.05, (cab.hoodTop + dh + 0.06 + cabFloor) / 2, 0, g);   // cowl, the base of the old windshield
      if (C.doghouse) rbox(0.7, 0.36, 0.5, 0.08, 'cab', cf - 0.4, cabFloor + 0.18, 0.02, g);
    } else {
      const top = cabFloor + 0.42;
      box(0.08, top - low, cw - 0.1, 'cab', cf - 0.04, (top + low) / 2, 0, g);   // low front panel carrying the lights
      for (const sz of [-1, 1]) box(0.03, 0.12, 0.3, 'head', cf + 0.01, low + 0.15, sz * (cw / 2 - 0.3), g, false);
      rbox(0.8, 0.42, 0.5, 0.08, 'cab', cf - 0.95, cabFloor + 0.21, 0.05, g);   // engine cover between the seats
    }
    const dx = conv ? cf - 0.2 : cf - 0.32;
    const dy = conv ? Math.max(cabFloor + 0.62, cab.hoodTop + dh - 0.05) : cabFloor + 0.62;
    box(0.36, 0.24, cw - 0.28, 'leather', dx, dy, 0, g);   // factory dash
    box(0.2, Math.max(0.1, dy - 0.12 - cabFloor), cw - 0.5, 'leather', dx + 0.06, (dy - 0.12 + cabFloor) / 2, 0, g);
    rbox(0.14, 0.12, 0.36, 0.04, 'grille', dx - 0.12, dy + 0.1, driverZ, g);
  } else {
    // frame rails only: engine block and radiator need their own cover; a small platform carries the driver
    const ex = conv ? fa + 0.15 : fa - 0.1, eTop = conv ? (cab.hoodTop || 1.3) + dh - 0.12 : cabFloor + 0.4;
    box(0.9, eTop - railY, 0.62, 'grille', ex, (eTop + railY) / 2, 0, g);
    box(0.08, eTop - railY + 0.1, 0.75, 'vent', bumper - 0.3, (eTop + railY) / 2 + 0.05, 0, g);   // radiator
    for (const sz of [-1, 1]) box(0.04, 0.12, 0.26, 'head', bumper - 0.27, railY + 0.25, sz * 0.55, g, false);   // headlights on brackets, factory height
    box(Math.max(0.6, driverX + 0.6 - (cb - 0.1)), 0.04, cw - 0.2, 'frame', (driverX + 0.6 + cb - 0.1) / 2, cabFloor - 0.02, 0, g);
    box(0.25, 0.5, 0.25, 'leather', driverX + 0.55, cabFloor + 0.25, driverZ, g);   // pedal box and column base
  }
  for (const sz of [-1, 1]) {
    if (sz > 0 && (noPassenger || strip === 'rails')) continue;
    const z = sz > 0 ? Math.abs(driverZ) : driverZ;
    rbox(0.5, 0.14, 0.52, 0.05, 'leather', driverX, seatY - 0.07, z, g);
    const b = rbox(0.12, 0.72, 0.5, 0.05, 'leather', driverX - 0.28, seatY + 0.32, z, g); b.rotation.z = 0.14;
    if (strip !== 'stock') box(0.34, seatY - 0.14 - cabFloor, 0.34, 'frame', driverX, (seatY - 0.14 + cabFloor) / 2, z, g);
  }
  if (conv && strip !== 'rails') {
    const hx1 = bumper - 0.18, hLen = hx1 - cf, hTop = cab.hoodTop + dh, hBot = 0.78 * (s.wheelDia / 0.8) + dh * 0.5;
    rbox(hLen, hTop - hBot, cab.hoodW, 0.1, 'cab', (hx1 + cf) / 2, (hTop + hBot) / 2, 0, g);
    box(0.04, (hTop - hBot) * 0.8, cab.hoodW - 0.18, 'grille', hx1 + 0.01, hBot + (hTop - hBot) * 0.45, 0, g);
    for (const sz of [-1, 1]) {
      box(0.04, 0.12, 0.26, 'head', hx1 + 0.02, hBot + (hTop - hBot) * 0.62, sz * (cab.hoodW / 2 - 0.2), g, false);
      const fw = Math.max(0.12, (cw - cab.hoodW) / 2);
      rbox(1.1, 0.22, fw, 0.05, 'cab', fa, s.wheelDia + 0.08, sz * (cab.hoodW / 2 + fw / 2), g);
    }
  } else if (!conv && strip === 'stock') {
    box(0.03, belt - low - 0.1, cw - 0.3, 'grille', cf + 0.005, (belt + low) / 2 - 0.05, 0, g);
    for (const sz of [-1, 1]) box(0.03, 0.12, 0.3, 'head', cf + 0.01, low + 0.15, sz * (cw / 2 - 0.3), g, false);
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
  box(0.4, 0.5, 0.5, 'grille', x1 - 0.2, s.frameHeight + 0.5, 0, g);
}
export function drumFootprint(C, fa) {
  if (!C.drum) return null;
  const cb = fa + C.cab.back - 0.3;
  return [cb - C.drum.length - 0.2, cb + 0.1, -C.drum.dia / 2 - 0.1, C.drum.dia / 2 + 0.1];
}
