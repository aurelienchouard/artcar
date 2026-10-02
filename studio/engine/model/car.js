import { Vec3, TAU, clamp, lerp, degToRad, radToDeg } from '../math.js';
import { mesh, box, rbox, cylX, ringX, rod, group, geo, Node, scaleUV, meshGeo, UP } from './prims.js';
import { R as rule } from '../../catalogs/rules.js';
import { TUBE_BUILDS } from '../../catalogs/kits.js';
import { intervalsMinus, overlap1, rectMinus, splitRun, slabs, packPoints, curtainGeometry, drawnCurtainGeometry, mergeSegs, pruneInEnvelope } from './helpers.js';
import { mannequin, pillowSeats, coverBox, louver, buildSpeakerBox, buildDaiquiri, bikeModel, sofaRun } from './props.js';
import { keptArcs, buildTubeChain } from './tubes.js';
import { buildVehicle, drumFootprint } from './vehicle.js';
import { buildKits } from './kits.js';

/* ------------------------------------------------------------------ the car */
const LOCK = degToRad(rule('steeringLock'));   // front-wheel steering lock used for arch sizing
const BOLT = [[0, 1], [0.71, 1], [0.45, 0.64], [1, 0.62], [0.52, 0], [0.41, 0.45], [0, 0.45]];   // lightning bolt outline, u across, v up
const STAND_AREA = { comfortable: rule('standComfortable'), party: rule('standParty'), packed: rule('standPacked') };   // m² per standing rider

export function buildCar(s, C) {
  const root = group(s.name || 'Art car');
  /* Every mesh lands in a layer group, split by what happens to it when the car is packed for transport:
     keep (stays on), roof (comes off when the roof and posts are removable), rails (comes off with the rails), off (always off). */
  const layerGroups = {};
  const G = (layer, pack) => {
    const key = layer + ':' + pack;
    if (!layerGroups[key]) {
      const g = group(key); g.userData.layer = layer; g.userData.pack = pack;
      layerGroups[key] = g; root.add(g);
    }
    return layerGroups[key];
  };
  const vehG = G('vehicle', 'keep'), deckG = G('structure', 'keep'), stepsG = G('structure', 'off'), postG = G('structure', 'roof');
  const roofG = G('upper', 'roof'), railsG = G('upper', 'rails');
  const layoutG = G('layout', 'keep'), curtainsG = G('layout', 'roof'), roofSeatG = G('layout', 'rails'), bikesG = G('layout', 'off');
  const designG = G('design', 'off');
  const soundG = G('lights', 'keep'), soundOffG = G('lights', 'off'), lightsRoofG = G('lights', 'roof'), lightsRailsG = G('lights', 'rails');
  const ridersLowG = G('riders', 'low'), ridersRoofG = G('riders', 'roof');
  const style = s.style || 'deck-posts', barge = style === 'barge', cageStyle = style === 'cage', bedExt = style === 'bed-ext';
  const hasRoof = !barge, hasTubes = s.hasTubes !== false;
  const DECK_T = 0.025;   // decking on the upper deck
  let skinIdx = 0, puckCount = 0, projectorCount = 0;
  const extraMass = [], zones = [];
  const skin = () => ('skin' + ((skinIdx++) % 6));
  const F = (m) => { if (m) m.userData.frame = true; return m; };
  const bom = { deckArea: 0, post: 0, deckFrame: 0, roofFrame: 0, rail: 0, hoop: 0, stairs: 0, ply34: 0, ply12: 0, plyBend: 0, ribPly: 0,
    alu: 0, perf: 0, poly: 0, cloth: 0, tubeLen: 0, sections: 0 };

  /* chassis frame of reference */
  const wb = s.wheelbase, fa = wb / 2, ra = -wb / 2;
  const dh = s.frameHeight - C.frameHeight;
  const bedDrop = C.style === 'cart' && s.bed === false ? 0.1 : 0;   // without the stock bed the deck sits on the frame
  const deckY = s.frameHeight + C.buildup - bedDrop;
  const cab = C.cab, isCart = C.style === 'cart', conv = C.style === 'conventional';
  const hasCab = !isCart && (!C.removableCab || s.keepCab);
  const openFront = !hasCab;
  const cabFloor = cab.floorY + dh, cabRoof = cab.roofY + dh, seatY = C.seat.y + dh;
  const cabBackX = fa + cab.back, cabFrontX = fa + cab.front;
  const driverX = fa + C.seat.dx, driverZ = C.seat.z;
  const frontFloorY = openFront ? cabFloor : deckY;
  const TB = TUBE_BUILDS[s.tubeBuild] || TUBE_BUILDS.sheet;
  const nSides = s.tubeShape === 'faceted' ? clamp(Math.round(s.tubeSides), 5, 10) : 0;
  const ledOff = TB.skin ? (s.ribStyle !== 'none' ? 0.036 : 0.006) : TB.lengthwise === 'steel' ? 0.03 : 0.012;

  /* body */
  const bodyL = s.length, xbF = fa + s.bodyFront, xbR = xbF - bodyL, mid = (xbF + xbR) / 2;
  const W = s.width, D = hasTubes ? Math.min(s.tubeDia, W * 0.42) : 0.06, R = D / 2;
  const lift = hasTubes ? s.tubeLift : 0.3;
  const floorW = W - D;
  const roofL = bodyL + 2 * s.roofOverhang, roofW = W + 2 * s.roofOverhang;
  const roofBottom = deckY + s.headroom, roofTop = roofBottom + 0.14;
  const tubeY = lift + R;
  const tubeInnerAt = (y) => (Math.abs(y - tubeY) < R ? floorW / 2 - Math.sqrt(R * R - (y - tubeY) ** 2) : floorW / 2);
  const edge = Math.min(floorW / 2 - 0.1, tubeInnerAt(deckY + 0.3) - 0.03);   // tubes riding above the deck act as bolsters
  // the vehicle's own ends: cowl on carts, bumper with the cab, hood front or front panel without it
  const vehFront = isCart || hasCab ? fa + C.ba : conv ? fa + C.ba - 0.15 : fa + cab.front + 0.03;
  const vehRear = isCart ? fa + C.ba - C.length : xbR;
  const edgeF = Math.max(xbF, vehFront), edgeR = Math.min(xbR, vehRear);
  const txF = edgeF + s.tubeFront, txR = edgeR - s.tubeRear;
  const rEnd = R * (1 - s.tubeTaper);
  const rad = (x) => (x > edgeF ? lerp(R, rEnd, (x - edgeF) / Math.max(1e-4, s.tubeFront))
    : x < edgeR ? lerp(R, rEnd, (edgeR - x) / Math.max(1e-4, s.tubeRear)) : R);
  const depth = clamp(s.seatDepth, 0.45, Math.max(0.45, edge - 0.12));
  const slabT = 0.12;

  /* wheels, and where they cut through the tubes and low floors */
  const wr = s.wheelDia / 2, tireW = isCart ? 0.2 : 0.27, cutY = s.wheelDia + 0.1;
  const wheelZones = [[fa, true], [ra, false]].map(([ax, front]) => {
    const hw = tireW / 2 + (C.tire.dualRear && !front ? 0.16 : 0), zc = s.track / 2;
    const zLock = front ? zc + wr * Math.sin(LOCK) + hw * Math.cos(LOCK) : zc + hw;
    const half = front ? Math.max(wr + 0.12, wr * Math.cos(LOCK) + hw * Math.sin(LOCK) + 0.1) : wr + 0.12;
    return { ax, front, x0: ax - half, x1: ax + half, zIn: zc - hw - 0.05, zOut: zLock + 0.05, zLock };
  });
  const bottomY = tubeY - R * (nSides ? Math.cos(Math.PI / nSides) : 1);
  const arches = !hasTubes ? [] : wheelZones.filter((z) => z.zOut > W / 2 - D + 0.01 && z.zIn < W / 2 && bottomY < cutY);
  const archCut = arches.map((z) => {
    const n = nSides || 48;
    const kept = keptArcs(R, W / 2 - R, tubeY, z, cutY, nSides).reduce((acc, [p0, p1]) => acc + Math.round((p1 - p0) / (TAU / n)), 0);
    return { zone: z, split: kept === 0, removed: n - kept, n };
  });
  const wellHoles = (yBottom) => (yBottom < cutY ? wheelZones.flatMap((z) => [[z.x0, z.x1, z.zIn, z.zOut], [z.x0, z.x1, -z.zOut, -z.zIn]]) : []);
  const pokeOut = wheelZones[0].zLock > W / 2;

  /* sections: open driver area, lounge, optional rear block */
  const frontMin = hasCab ? xbF - (cabBackX - 0.12) : xbF - (driverX - 0.48);
  const frontLen = clamp(frontMin, 0.3, Math.max(0.3, bodyL - 1.4));
  const xfs = xbF - frontLen;
  const rearLen = s.rearStyle === 'none' ? 0 : clamp(s.rearLen, 0.3, Math.max(0.3, bodyL - frontLen - 1.4));
  const xrs = xbR + rearLen;
  const lx0 = xrs + (rearLen ? 0.04 : 0.08), lx1 = xfs - 0.04;
  const loungeLen = Math.max(0, lx1 - lx0);

  /* roof and upper deck: the roof spans [rx0, rx1]; segments along it are rideable deck, shade only, or open.
     Decks are always full width and may reach 0.5 m past the last post. */
  const xPostF = s.frontPosts ? xbF - 0.06 : Math.min(xbF - 0.06, hasCab ? cabBackX - 0.1 : driverX - 0.42);
  const rx0 = mid - roofL / 2, rzE = roofW / 2 - 0.06;
  let rx1 = Math.min(mid + roofL / 2, xPostF + 1.6);
  if (isCart && s.rops) rx1 = Math.min(rx1, Math.max(rx0 + 1, fa + cab.back - 0.05));   // the factory canopy stays over the driver
  const rLen = rx1 - rx0, rMid = (rx0 + rx1) / 2, hEnd = Math.min(xbF, rx1);
  const capX = s.frontPosts ? Infinity : xPostF + 0.5;
  let segs = [], dx1Want = rx1;
  if (hasRoof && !s.roofDeck) segs = [{ x0: rx0, x1: rx1, kind: 'shade' }];
  else if (hasRoof && s.coverage === 'modular' && Array.isArray(s.segments) && s.segments.length) {
    const tot = s.segments.reduce((a, g) => a + g.len, 0) || 1;
    let x = rx0;
    segs = s.segments.map((g) => { const x0 = x; x += g.len / tot * rLen; return { x0, x1: x, kind: g.kind }; });
    const deckEnds = segs.filter((g) => g.kind === 'deck').map((g) => g.x1);
    dx1Want = deckEnds.length ? Math.max(...deckEnds) : rx1;
    segs = segs.flatMap((g) => (g.kind !== 'deck' || g.x1 <= capX ? [g] : g.x0 >= capX - 1e-6 ? [{ ...g, kind: 'shade' }] : [{ ...g, x1: capX }, { x0: capX, x1: g.x1, kind: 'shade' }]));
    segs = mergeSegs(segs).map((g) => (g.kind === 'deck' && g.x1 - g.x0 < 1.0 ? { ...g, kind: 'shade' } : g));
  } else if (hasRoof) {
    const dF = clamp(s.roofDeckFront, 0, Math.max(0, rLen - 1.6));
    const dR = clamp(s.roofDeckRear, 0, Math.max(0, rLen - 1.6 - dF));
    dx1Want = rx1 - dF;
    const a = rx0 + dR, b = !s.frontPosts ? Math.max(a + 1.0, Math.min(dx1Want, xPostF + 0.5)) : dx1Want;
    segs = [{ x0: rx0, x1: a, kind: 'shade' }, { x0: a, x1: b, kind: 'deck' }, { x0: b, x1: rx1, kind: 'shade' }];
  }
  segs = mergeSegs(segs);
  const decks = segs.filter((g) => g.kind === 'deck').map((g) => ({ dx0: g.x0, dx1: g.x1, X0: g.x0 + 0.06, X1: g.x1 - 0.06 }));
  s = { ...s, roofDeck: decks.length > 0 };
  const mainDeck = decks.reduce((a, b) => (!a || b.dx1 - b.dx0 > a.dx1 - a.dx0 ? b : a), null);
  const frontDeck = decks[decks.length - 1], rearDeck = decks[0];
  const dx0 = mainDeck ? mainDeck.dx0 : rx0, dx1 = mainDeck ? mainDeck.dx1 : rx1;
  const X0 = frontDeck ? frontDeck.X0 : dx0 + 0.06, X1 = frontDeck ? frontDeck.X1 : dx1 - 0.06;
  const dTop = roofTop + DECK_T;
  const zR = s.rearStyle === 'daiquiri' && rearLen > 0 ? -floorW / 4 : 0;
  const hs = s.hatchSide === 'driver' ? -1 : 1;

  /* ladders */
  const ladderFront = s.roofDeck && s.ladder === 'front';
  const stairsOn = s.roofDeck && s.ladder === 'stairs';
  const ladderRear = s.roofDeck && s.ladder === 'rear';
  const LADDER_TAN = Math.tan(degToRad(70));
  const loungeRects = [];
  let hatch = null, lad = null;
  if (ladderFront) {
    const zL = hs * (floorW / 2 - 0.42);
    const xh = X1 - 0.48;
    const floorAt = (x) => (x >= xfs ? frontFloorY : deckY);
    const tryDir = (dir) => {
      const cross = xh + dir * 0.15;
      let yb = dir > 0 ? frontFloorY : deckY;
      let xb = cross + dir * (roofBottom - yb) / LADDER_TAN;
      if (floorAt(xb) !== yb) { yb = floorAt(xb); xb = cross + dir * (roofBottom - yb) / LADDER_TAN; }
      const maxX = conv && openFront ? cabFrontX - 0.3 : xbF - 0.3;
      const ok = xb <= maxX && xb >= xbR + 0.3 && !(hasCab && xb > cabBackX - 0.1);
      return { cross, xb, yb, zL, dir, ok };
    };
    lad = openFront && !isCart && hs > 0 ? tryDir(1) : tryDir(-1);
    if (!lad.ok && !(hs < 0 && lad.dir < 0)) lad = tryDir(-lad.dir);
    hatch = [xh - 0.42, xh + 0.42, zL - 0.36, zL + 0.36];
    if (lad.xb > lx0 - 0.4 && lad.xb < lx1 + 0.4) loungeRects.push([lad.xb - 0.6, lad.xb + 0.6, zL - 0.42, zL + 0.42]);
  }
  const ladderAtSeat = !!(lad && lad.dir > 0 && openFront && !isCart && lad.xb >= xfs);
  /* stairs: a straight run along the hatch side of the lounge, rising toward the front deck */
  let stair = null, stairsFailed = false;
  if (stairsOn) {
    const rise = dTop - deckY, run = rise / Math.tan(degToRad(40)), zS = hs * Math.max(0.3, edge - 0.42);
    const xTop = Math.min(X1 - 0.3, lx1 - 0.05), xBot = xTop - run;
    const hx0 = xTop - Math.min(1.3, run * 0.55), inDeck = decks.some((d) => hx0 >= d.dx0 && xTop <= d.dx1);
    if (xBot >= lx0 + 0.15 && inDeck && rise > 1.2) {
      stair = { xBot, xTop, zS, rise, run, n: Math.max(4, Math.ceil(rise / 0.2)) };
      hatch = [hx0, xTop + 0.05, zS - 0.4, zS + 0.4];
      loungeRects.push([xBot - 0.35, xTop + 0.1, zS - 0.45, zS + 0.45]);
    } else stairsFailed = true;
  }

  /* entry steps, kept clear of the wheels */
  const steps = [];
  const stairFor = (st) => {
    const avail = Math.max(0.25, W / 2 - st.zIn);
    st.n = clamp(Math.round(st.topY / 0.26) - 1, 1, Math.max(1, Math.floor(avail / 0.24)));
    st.run = Math.min(0.3, avail / st.n);
    st.rise = st.topY / (st.n + 1);
    st.zInner = W / 2 - st.n * st.run;
    return st;
  };
  const clearWheels = (x, w, zInner) => {
    for (let pass = 0; pass < 2; pass++) for (const z of wheelZones) {
      if (x + w / 2 > z.x0 - 0.05 && x - w / 2 < z.x1 + 0.05 && zInner < z.zOut) x = z.front ? z.x0 - w / 2 - 0.06 : z.x1 + w / 2 + 0.06;
    }
    return x;
  };
  if (s.driverStep) {
    const st = stairFor({ w: 0.9, sgn: -1, topY: cabFloor, zIn: hasCab ? cab.width / 2 + 0.03 : floorW / 2, kind: 'driver' });
    st.x = clamp(clearWheels(driverX + 0.1, st.w, st.zInner), xbR + 0.55, xbF - 0.45);
    steps.push(st);
  }
  if (s.secondStep !== 'none' && loungeLen > 1.2) {
    const sgn = s.secondStep === 'driver' ? -1 : 1;
    const half = Math.max(0, loungeLen / 2 - 0.85);
    const st = stairFor({ w: 1.0, sgn, topY: deckY, zIn: edge - depth - 0.05, kind: 'deck' });
    let x = (lx0 + lx1) / 2 + clamp(s.secondStepPos, -1, 1) * half;
    const near = steps.find((t) => t.sgn === sgn && Math.abs(t.x - x) < 1.0);
    if (near) x = near.x - 1.0;
    if (lad && sgn > 0 && Math.abs(lad.xb - x) < 1.1) x = lad.xb - 1.15;
    st.x = clamp(clearWheels(x, st.w, st.zInner), lx0 + 0.5, lx1 - 0.5);
    steps.push(st);
  }
  const stepHoles = steps.map((st) => (st.sgn > 0 ? [st.x - st.w / 2, st.x + st.w / 2, st.zInner, W] : [st.x - st.w / 2, st.x + st.w / 2, -W, -st.zInner]));
  steps.filter((st) => st.kind === 'deck').forEach((st) => loungeRects.push(st.sgn > 0
    ? [st.x - st.w / 2, st.x + st.w / 2, edge - depth - 0.05, W] : [st.x - st.w / 2, st.x + st.w / 2, -W, -(edge - depth - 0.05)]));

  /* speakers: hung high at the lounge corners, or towers standing at the back of the lounge */
  const pz0 = floorW / 2 - 0.04;
  const spk = [];
  if (s.speakers === 'corners' && loungeLen > 1.2) for (const [x, sx] of [[lx0 + 0.25, -1], [lx1 - 0.25, 1]]) {
    spk.push({ x, z: pz0 + 0.25, h: 0.55, w: 0.36, sgn: 1, sx, hung: true, out: true });
    spk.push({ x: x - sx * 0.1, z: -(pz0 - 0.16), h: 0.3, w: 0.24, sgn: -1, sx, hung: true, out: false });
  }
  if (s.speakers === 'towers' && loungeLen > 1.2) for (const sgn of [-1, 1]) spk.push({ x: lx0 + 0.3, z: sgn * (edge - 0.22), h: Math.min(1.75, s.headroom - 0.2), w: 0.5, sgn });
  spk.filter((p) => !p.hung).forEach((p) => loungeRects.push([p.x - p.w / 2 - 0.04, p.x + p.w / 2 + 0.04, p.z - p.w / 2 - 0.04, p.z + p.w / 2 + 0.04]));

  /* decks, with wheel-well humps where a floor sits below the tire tops. On carts the deck rides on the vehicle's own bed:
     a 1½″ frame, and ½″ plywood under a platform mattress. */
  const lightDeck = isCart && s.layout === 'platform' && s.bed !== false;
  const frameKgM = bedExt ? rule('steel15in16') : isCart && s.bed !== false ? rule('steel15in14') : rule('steel2in14');
  const deckSlab = (rect, y, t) => {
    if (rect[1] - rect[0] < 0.02) return;
    const wh = wellHoles(y - t);
    slabs(rectMinus(rect, stepHoles.concat(wh)), y, t, 'floor', deckG);
    wh.forEach(([x0, x1, z0, z1]) => {
      const a = Math.max(x0, rect[0]), b = Math.min(x1, rect[1]), c = Math.max(z0, rect[2]), d = Math.min(z1, rect[3]);
      if (b - a > 0.02 && d - c > 0.02) {
        const top = Math.max(y, cutY + 0.03);
        box(b - a, top - (y - t), d - c, 'frame', (a + b) / 2, (top + y - t) / 2, (c + d) / 2, deckG);
      }
    });
    const ar = (rect[1] - rect[0]) * (rect[3] - rect[2]);
    bom.deckArea += ar; bom[lightDeck ? 'ply12' : 'ply34'] += ar;
  };
  deckSlab([xbR, xfs, -floorW / 2, floorW / 2], deckY, slabT);
  if (openFront) {
    deckSlab([xfs, conv ? Math.min(xbF - 0.055, cabFrontX) : xbF - 0.055, -floorW / 2, floorW / 2], cabFloor, 0.06);
  } else {
    const cw = cab.width / 2 + 0.03;
    if (cabBackX - 0.05 > xfs + 0.05) deckSlab([xfs, cabBackX - 0.05, -floorW / 2, floorW / 2], deckY, slabT);
    if (floorW / 2 > cw + 0.05) {
      const a = Math.max(xfs, Math.min(cabBackX - 0.05, xbF));
      deckSlab([a, xbF - 0.055, cw, floorW / 2], deckY, slabT);
      deckSlab([a, xbF - 0.055, -floorW / 2, -cw], deckY, slabT);
    }
  }
  /* steel deck frame: perimeter and joists (visible in the frame view) */
  const deckFrame = (x0, x1, y) => {
    if (x1 - x0 < 0.1) return;
    for (const sz of [-1, 1]) F(box(x1 - x0, 0.05, 0.05, 'frame', (x0 + x1) / 2, y, sz * (floorW / 2 - 0.03), deckG, false));
    const n = Math.max(1, Math.round((x1 - x0) / 0.6));
    for (let i = 0; i <= n; i++) F(box(0.05, 0.05, floorW - 0.06, 'frame', x0 + 0.04 + (x1 - x0 - 0.08) * i / n, y, 0, deckG, false));
    bom.deckFrame += 2 * (x1 - x0) + (n + 1) * floorW;
  };
  deckFrame(xbR, xfs, deckY - slabT - 0.025);
  deckFrame(xfs, xbF, frontFloorY - (openFront ? 0.06 : slabT) - 0.025);
  const subY0 = s.frameHeight - 0.02, subY1 = deckY - slabT;
  if (subY1 - subY0 > 0.03) {   // sub-frame: two rails on the chassis with crossmembers
    const sl = Math.max(0.2, xfs - xbR - 0.3), sw = Math.max(0.4, Math.min(floorW - 0.2, s.track - 0.3)), sx = (xbR + xfs) / 2, sy = (subY0 + subY1) / 2, sh = subY1 - subY0;
    for (const sz of [-1, 1]) F(box(sl, sh, 0.1, 'frame', sx, sy, sz * (sw / 2 - 0.05), deckG));
    const n = Math.max(1, Math.round(sl / 0.9));
    for (let k = 0; k <= n; k++) F(box(0.08, sh, sw - 0.2, 'frame', sx - sl / 2 + 0.04 + (sl - 0.08) * k / n, sy, 0, deckG));
    bom.deckFrame += 2 * sl + (n + 1) * sw;
  }
  const skirtHalf = Math.max(0.3, W / 2 - D + 0.03);
  const pY0 = lift + 0.08, pH = deckY - slabT - pY0;
  if (pH > 0.05) {
    box(0.06, pH, skirtHalf * 2, 'frame', xbR + 0.03, pY0 + pH / 2, 0, deckG);
    if (s.power === 'generator' && (s.powerBay || 'rear') === 'rear') louver(deckG, xbR - 0.01, pY0 + pH * 0.5, 0, Math.min(0.9, skirtHalf * 1.2), pH * 0.6, 'x');
  }

  /* the vehicle itself */
  buildVehicle(vehG, { s, C, fa, ra, dh, cabFloor, cabRoof, seatY, driverX, driverZ, xbR, hasCab, noPassenger: ladderAtSeat, deckY });

  /* driver: seat position and steering are fixed by the chassis */
  const wc = new Vec3(driverX + C.steer.dx, seatY + C.steer.dy, driverZ);
  const tilt = degToRad(C.steer.tilt);
  const axis = new Vec3(-Math.cos(tilt), Math.sin(tilt), 0).normalize();
  const sw = mesh(geo('Torus', 0.19, 0.022, 10, 40), 'leather', vehG);
  sw.name = 'Steering wheel';
  sw.position.copy(wc); sw.quaternion.setFromUnitVectors(new Vec3(0, 0, 1), axis);
  rod(wc, wc.clone().addScaledVector(axis, -0.5), 0.022, 'rim', vehG, false);
  const drv = mannequin('drive', skin());
  drv.position.set(driverX - 0.05, seatY, driverZ);
  ridersLowG.add(drv);

  /* wheels */
  const wheels = [];
  for (const [ax, front] of [[fa, true], [ra, false]]) for (const sz of [-1, 1]) {
    const pivot = new Node(); pivot.position.set(ax, wr, sz * s.track / 2); pivot.name = 'Wheel'; pivot.userData.wheel = front ? 'front' : 'rear';
    const spin = new Node(); spin.userData.spin = true; pivot.add(spin);
    const offs = C.dual && !front ? [-0.16, 0.16] : [0];
    for (const o of offs) {
      const tire = mesh(geo('Cylinder', wr, wr, tireW, 36), 'rubber', spin); tire.rotation.x = Math.PI / 2; tire.position.z = o;
      const rim = mesh(geo('Cylinder', wr * 0.58, wr * 0.58, tireW + 0.012, 24), 'rim', spin); rim.rotation.x = Math.PI / 2; rim.position.z = o;
      box(wr * 1.02, 0.06, tireW + 0.018, 'frame', 0, 0, o, spin);
      box(0.06, wr * 1.02, tireW + 0.018, 'frame', 0, 0, o, spin);
    }
    vehG.add(pivot);
    wheels.push({ pivot, spin, front });
  }

  /* tubes: sections on French cleats, split at steps (and at the wheels when the wheels stand taller than the tubes) */
  const tctx = { s, TB, nSides, tubeY, rad, xbF: edgeF, xbR: edgeR, txF, txR, ledOff, arches: archCut.filter((a) => !a.split).map((a) => a.zone), cutY, bom, F };
  const bomBeforeTubes = { ...bom };
  const tubesG = hasTubes ? group('Side tubes') : null;
  if (tubesG) { tubesG.userData.kit = 'side-tubes'; designG.add(tubesG); }
  if (hasTubes) for (const sgn of [-1, 1]) {
    const cz = sgn * (W / 2 - R);
    let chains = [[txR, txF]];
    steps.filter((t) => t.sgn === sgn).forEach((t) => {
      const a = Math.max(t.x - t.w / 2, xbR + 0.05), b = Math.min(t.x + t.w / 2, xbF - 0.05);
      if (b - a > 0.2) chains = intervalsMinus(chains, a, b);
    });
    archCut.filter((a) => a.split).forEach((a) => { chains = intervalsMinus(chains, a.zone.x0, a.zone.x1); });
    chains.forEach(([a, b]) => { if (b - a > 0.25) buildTubeChain(tubesG, a, b, cz, sgn, tctx); });
  }
  const bomAfterTubes = { ...bom };
  const coversOn = s.hoodCover === undefined ? (!hasCab && !isCart) : (!!s.hoodCover && !hasCab && !isCart);
  const coverG = group('Hood and fender cover'); coverG.userData.kit = 'hood-cover';
  if (coversOn) designG.add(coverG);
  if (coversOn) {   // light covers that follow the engine's existing shapes, in the tube skin or the chosen panel
    const hm = s.hoodCover && s.hoodCover.p && s.hoodCover.p.material !== 'match' ? s.hoodCover.p.material : null;
    const mat = hm ? { alu: 'tube', perf: 'perf', acm: 'acm', poly: 'glowSkin' }[hm] : TB.skin ? { alu: 'tube', ply: 'ply', perf: 'perf', poly: 'glowSkin' }[TB.skin] : 'perf';
    const cv = { mat, perf: mat === 'perf', bom, key: hm ? { alu: 'alu', perf: 'perf', acm: 'acm', poly: 'poly' }[hm] : TB.skin ? { alu: 'alu', ply: 'plyBend', perf: 'perf', poly: 'poly' }[TB.skin] : 'perf' };
    const t = 0.03;   // clearance over the stock panels
    if (conv) {
      const hx1 = fa + C.ba - 0.18, hTop = cab.hoodTop + dh, hBot = 0.78 * (s.wheelDia / 0.8) + dh * 0.5, hw = cab.hoodW / 2;
      coverBox(coverG, { ...cv, x0: cabFrontX - 0.05, x1: hx1 + 0.015, y0: hBot - t, y1: hTop + t, z0: -hw - t, z1: hw + t, back: cabFloor, front: false, leds: true });
      const fw = Math.max(0.12, (cab.width - cab.hoodW) / 2), fy = s.wheelDia + 0.08;
      for (const sz of [-1, 1]) {
        const zi = sz * (hw + t), zo = sz * (hw + fw + t);
        coverBox(coverG, { ...cv, x0: fa - 0.55 - t, x1: fa + 0.55 + t, y0: fy - 0.11 - t, y1: fy + 0.11 + t, z0: Math.min(zi, zo), z1: Math.max(zi, zo), back: fy - 0.11 - t, front: true, inner: sz > 0 ? 'z0' : 'z1', leds: false });
      }
    }
    const dog = C.doghouse ? { x: cabFrontX - 0.4, l: 0.7, h: 0.36, w: 0.5, z: 0.02 } : !conv ? { x: cabFrontX - 0.95, l: 0.8, h: 0.42, w: 0.5, z: 0.05 } : null;
    if (dog) coverBox(coverG, { ...cv, x0: dog.x - dog.l / 2 - t, x1: dog.x + dog.l / 2 + t, y0: cabFloor, y1: cabFloor + dog.h + t, z0: dog.z - dog.w / 2 - t, z1: dog.z + dog.w / 2 + t, back: cabFloor, front: true, leds: true });
  }

  /* design kits beyond the built-in tubes and hood cover */
  const kitCar = {
    xbF, xbR, mid, vehFront, W, D, floorW, deckY, roofBottom, roofTop, hasRoof, decks, lx0, lx1, xfs, loungeLen, steps,
    eye: [driverX + 0.02, seatY + 0.72, driverZ], driverX, seatY, cabFloor, conv, hoodTop: conv ? cab.hoodTop + dh : cabFloor + 0.45,
    cutY, wheelZones, groundClear: rule('kitGroundClear'), tubeY, rx0, zR, ladderRear, isCart, track: s.track,
  };
  const kitResults = buildKits(designG, (s.kits || []).filter((k) => !k.def.builtin), kitCar);
  const prunedParts = pruneInEnvelope(designG, wheelZones, cutY);
  for (const r of kitResults) extraMass.push({ cat: 'design', kg: r.kg, y: r.y, label: r.id });
  const bomDelta = (a, b) => Object.fromEntries(Object.keys(b).map((k) => [k, (b[k] || 0) - (a[k] || 0)]));
  const builtinBom = { tubes: bomDelta(bomBeforeTubes, bomAfterTubes), covers: bomDelta(bomAfterTubes, bom) };

  for (const st of steps) {
    for (let i = 0; i < st.n; i++) {
      const top = st.rise * (i + 1);
      const zOut = W / 2 - i * st.run, zIn = W / 2 - (i + 1) * st.run;
      const y0 = Math.min(lift * 0.6, top - 0.05);
      F(box(st.w - 0.08, top - y0, st.run, 'frame', st.x, (top + y0) / 2, st.sgn * (zOut + zIn) / 2, stepsG));
      box(st.w - 0.14, 0.018, 0.035, 'led', st.x, top - 0.012, st.sgn * (zOut - 0.02), stepsG, false);
      bom.stairs++;
    }
  }

  /* driver area: open at the sides and to the lounge, just a low face at the front */
  let wallArea = 0;
  const faceY0 = isCart ? 0.3 : deckY - 0.35;
  const faceY1 = isCart ? deckY + 0.12 : hasCab ? deckY + 0.45 : deckY + 0.3;
  const opening = isCart ? 0 : conv ? (hasCab ? cab.hoodW / 2 + 0.08 : cab.width / 2 + 0.06) : cab.width / 2 + 0.06;
  for (const [z0, z1] of intervalsMinus([[-floorW / 2, floorW / 2]], -opening, opening)) {
    if (z1 - z0 < 0.05) continue;
    box(0.05, faceY1 - faceY0, z1 - z0, 'panel', xbF - 0.025, (faceY0 + faceY1) / 2, (z0 + z1) / 2, deckG);
    wallArea += (z1 - z0) * (faceY1 - faceY0);
  }

  /* back end: a low closed-off section with a lid that doubles as a counter */
  const REAR_H = 1.0;
  if (rearLen > 0) {
    for (const sgn of [-1, 1]) box(rearLen, REAR_H, 0.05, 'panel', (xbR + xrs) / 2, deckY + REAR_H / 2, sgn * (floorW / 2 - 0.03), layoutG);
    box(0.05, REAR_H, floorW, 'panel', xbR + 0.025, deckY + REAR_H / 2, 0, layoutG);
    box(0.05, REAR_H, floorW, 'panel', xrs, deckY + REAR_H / 2, 0, layoutG);
    box(rearLen + 0.04, 0.04, floorW + 0.02, 'panel', (xbR + xrs) / 2, deckY + REAR_H + 0.02, 0, layoutG);
    box(0.02, 0.02, floorW - 0.1, 'led', xrs + 0.035, deckY + REAR_H + 0.025, 0, layoutG, false);
    wallArea += (2 * rearLen + 2 * floorW) * REAR_H + rearLen * floorW;
    if (s.power === 'generator' && s.powerBay !== 'under') for (const sgn of [-1, 1]) louver(deckG, xbR + Math.min(0.4, rearLen / 2), deckY + 0.45, sgn * (floorW / 2 + 0.01), Math.min(0.5, rearLen - 0.1), 0.34, 'z');
  }
  bom.ply12 += wallArea;
  const daiquiriZ = ladderRear ? floorW / 4 : 0, daiquiriW = Math.min(1.35, floorW * 0.46);
  if (s.rearStyle === 'daiquiri' && rearLen > 0) buildDaiquiri(layoutG, xbR, deckY + REAR_H + 0.04, floorW, daiquiriZ, roofBottom);

  /* canopy: posts, headers, roof frame, roof (per segment), deck surface, lights */
  const pz = floorW / 2 - 0.04;
  let deckArea = 0;
  const holes = hatch ? [hatch] : [];
  if (hasRoof) {
    const nPosts = clamp(Math.round(s.posts), 2, 9);
    const postXs = [];
    for (let i = 0; i < nPosts; i++) postXs.push(xbR + 0.06 + i * (xPostF - xbR - 0.06) / (nPosts - 1));
    let postCount = 0;
    const placedBySide = {};
    for (const sgn of [-1, 1]) {
      const gaps = steps.filter((t) => t.sgn === sgn);
      const xs = postXs.slice();
      gaps.filter((t) => t.kind === 'deck').forEach((t) => [t.x - t.w / 2 - 0.05, t.x + t.w / 2 + 0.05].forEach((x) => { if (!xs.some((p) => Math.abs(p - x) < 0.3)) xs.push(x); }));
      const placed = [];
      for (let x of xs.sort((p, q) => q - p)) {
        const g = gaps.find((t) => x > t.x - t.w / 2 - 0.02 && x < t.x + t.w / 2 + 0.02);
        if (g) x = g.x - g.w / 2 - 0.06;   // a post landing in a step opening moves to just behind it
        if (x < xbR + 0.03 || placed.some((p) => Math.abs(p - x) < 0.3)) continue;
        placed.push(x);
        F(box(0.08, s.headroom, 0.08, 'frame', x, deckY + s.headroom / 2, sgn * pz, postG));
        postCount++;
      }
      placedBySide[sgn] = placed.sort((p, q) => p - q);
      F(box(hEnd - xbR, 0.12, 0.08, 'frame', (xbR + hEnd) / 2, roofBottom - 0.06, sgn * pz, postG));
    }
    for (const x of [xbR + 0.06, hEnd - 0.06]) F(box(0.08, 0.12, floorW - 0.08, 'frame', x, roofBottom - 0.06, 0, postG));
    bom.post += postCount * s.headroom + 2 * (hEnd - xbR) + 2 * floorW;
    /* full cage: a mid-height side rail and diagonals in every bay give attachment points everywhere, plus a front hoop */
    if (cageStyle) {
      const yM = deckY + s.headroom * 0.5;
      for (const sgn of [-1, 1]) {
        const xs = placedBySide[sgn];
        F(box(hEnd - xbR, 0.05, 0.05, 'frame', (xbR + hEnd) / 2, yM, sgn * pz, postG)); bom.cage = (bom.cage || 0) + (hEnd - xbR);
        for (let i = 0; i < xs.length - 1; i++) {
          if (xs[i + 1] - xs[i] < 0.5) continue;
          const a = new Vec3(xs[i], deckY + 0.05, sgn * pz), b = new Vec3(xs[i + 1], roofBottom - 0.12, sgn * pz);
          if (steps.some((t) => t.sgn === sgn && t.kind === 'deck' && t.x + t.w / 2 > xs[i] && t.x - t.w / 2 < xs[i + 1])) continue;   // keep entries open
          F(rod(a, b, 0.022, 'frame', postG, false, 6)); bom.cage += a.distanceTo(b);
        }
      }
      const fx = xbF - 0.06;
      // front hoop: a header under the roof and a low bar below the dash, so the driver's sight line stays open
      F(box(0.05, 0.05, floorW - 0.08, 'frame', fx, roofBottom - 0.2, 0, postG)); bom.cage += floorW;
      F(box(0.05, 0.05, floorW - 0.08, 'frame', fx, frontFloorY + 0.45, 0, postG)); bom.cage += floorW;
    }
    // roof frame: perimeter and joists every 2 ft
    const rfY = roofTop - 0.1;
    for (const sz of [-1, 1]) F(box(rLen, 0.06, 0.06, 'frame', rMid, rfY, sz * (roofW / 2 - 0.03), postG, false));
    const nJ = Math.max(1, Math.round(rLen / 0.6));
    for (let i = 0; i <= nJ; i++) F(box(0.06, 0.06, roofW - 0.06, 'frame', rx0 + 0.03 + (rLen - 0.06) * i / nJ, rfY, 0, postG, false));
    bom.roofFrame += 2 * rLen + (nJ + 1) * roofW;
    for (const g of segs) {
      const len = g.x1 - g.x0;
      if (len < 0.05) continue;
      if (g.kind === 'deck') { slabs(rectMinus([g.x0, g.x1, -roofW / 2, roofW / 2], holes), roofTop, 0.14, 'frame', roofG); deckArea += len * roofW; }
      else if (g.kind === 'shade' && s.roofShade === 'solid') { slabs(rectMinus([g.x0, g.x1, -roofW / 2, roofW / 2], holes), roofTop, 0.14, 'frame', roofG); bom.ply12 += len * roofW; }
      else if (g.kind === 'shade') {
        const pl = mesh(geo('Plane', len, roofW), 'shade', roofG, false);
        pl.rotation.x = -Math.PI / 2; pl.position.set((g.x0 + g.x1) / 2, roofTop - 0.065, 0); pl.name = 'Shade cloth';
        bom.cloth += len * roofW;
      }
    }
    bom.ply34 += deckArea;
    for (const sgn of [-1, 1]) box(rLen - 0.02, 0.03, 0.012, 'led', rMid, roofBottom + 0.065, sgn * (roofW / 2 + 0.006), lightsRoofG, false);
    for (const sx of [-1, 1]) box(0.012, 0.03, roofW - 0.02, 'led', rMid + sx * (rLen / 2 + 0.006), roofBottom + 0.065, 0, lightsRoofG, false);
    // LED strip along the inside of the frame, and puck downlights
    for (const sgn of [-1, 1]) box(hEnd - xbR - 0.24, 0.022, 0.012, 'led', (xbR + hEnd) / 2, roofBottom - 0.07, sgn * (pz - 0.046), lightsRoofG, false);
    for (const sx of [-1, 1]) box(0.012, 0.022, floorW - 0.24, 'led', (sx > 0 ? hEnd - 0.106 : xbR + 0.106), roofBottom - 0.07, 0, lightsRoofG, false);
    if (s.pucks !== false) {
      const puckX0 = xbR + 0.5, puckX1 = hEnd - 0.5;
      const nP = Math.max(1, Math.round((puckX1 - puckX0) / 1.3));
      for (let i = 0; i <= nP; i++) for (const sz of [-1, 1]) {
        const pk = mesh(geo('Cylinder', 0.055, 0.055, 0.02, 20), 'puck', lightsRoofG, false);
        pk.position.set(puckX0 + (puckX1 - puckX0) * i / nP, roofBottom - 0.01, sz * floorW / 4);
        puckCount++;
      }
    }
    for (const dk of decks) slabs(rectMinus([dk.dx0, dk.dx1, -roofW / 2 + 0.01, roofW / 2 - 0.01], holes), dTop, DECK_T, 'floor', roofG);
    if (ladderRear && rearDeck && rearDeck.dx0 - rx0 > 0.3) slabs([[rx0, rearDeck.dx0, zR - 0.46, zR + 0.46]], dTop, DECK_T, 'floor', roofG);
    if (hatch && s.roofDeck) {
      const [hx0, hx1, hz0, hz1] = hatch;
      box(hx1 - hx0, 0.08, 0.04, 'frame', (hx0 + hx1) / 2, roofTop + 0.07, hz0, railsG);
      box(hx1 - hx0, 0.08, 0.04, 'frame', (hx0 + hx1) / 2, roofTop + 0.07, hz1, railsG);
      for (const x of [hx0, hx1]) box(0.04, 0.08, hz1 - hz0, 'frame', x, roofTop + 0.07, (hz0 + hz1) / 2, railsG);
    }
  }

  /* curtains: tied back at the lounge corners, or drawn closed along the lounge */
  if (s.curtains !== 'none' && loungeLen > 1) {
    const h = s.headroom - 0.14;
    if (s.curtainsDrawn) {
      const n = Math.max(1, Math.ceil(loungeLen / 1.6)), w = loungeLen / n;
      for (const sgn of [-1, 1]) for (let i = 0; i < n; i++) {
        const c = mesh(drawnCurtainGeometry(w - 0.02, h), 'curtain', curtainsG);
        c.position.set(lx0 + i * w + 0.01, deckY + 0.02, sgn * (pz - 0.07));
      }
      if (!rearLen) {
        const c = mesh(drawnCurtainGeometry(2 * pz - 0.1, h), 'curtain', curtainsG);
        c.position.set(xbR + 0.1, deckY + 0.02, -pz + 0.05); c.rotation.y = -Math.PI / 2;
      }
    } else {
      const cg = curtainGeometry(0.62, h);
      const ends = s.curtains === 'all' ? [[lx0 + 0.02, 0], [lx1 - 0.02, Math.PI]] : [[lx0 + 0.02, 0]];
      for (const [x, rot] of ends) for (const sgn of [-1, 1]) {
        const c = mesh(cg, 'curtain', curtainsG);
        c.position.set(x, deckY + 0.02, sgn * (pz - 0.09));
        c.rotation.y = rot;
      }
    }
  }

  const drum = drumFootprint(C, fa);
  if (drum) loungeRects.push(drum);

  /* power bay: under the rear (v1), under the deck between the rails, or inside the low rear section */
  const BAY = { small: [0.6, 0.3, 0.5], medium: [1.0, 0.35, 0.7], large: [1.4, 0.4, 0.9] }[s.powerBaySize || 'medium'];
  const bayIn = s.powerBay === 'section' && rearLen > 0.3 ? 'section' : s.powerBay === 'under' ? 'under' : 'rear';
  const powerY = bayIn === 'section' ? deckY + 0.35 : deckY - 0.25;
  if (bayIn === 'under') {
    const bx = mid - 0.2, by = deckY - slabT - BAY[1] / 2 - 0.02;
    if (by - BAY[1] / 2 > cutY * 0.4) {
      box(BAY[0], BAY[1], Math.min(BAY[2], s.track - 0.5), 'vent', bx, by, 0, deckG);
      if (s.power === 'generator') for (const sgn of [-1, 1]) louver(deckG, bx, by, sgn * (Math.min(BAY[2], s.track - 0.5) / 2 + 0.01), BAY[0] * 0.8, BAY[1] * 0.7, 'z');
    }
  } else if (bayIn === 'section') {
    box(Math.min(BAY[0], rearLen - 0.1), Math.min(0.8, BAY[1] * 2), Math.min(BAY[2], floorW - 0.2), 'vent', xbR + Math.min(BAY[0], rearLen - 0.1) / 2 + 0.06, deckY + Math.min(0.8, BAY[1] * 2) / 2, 0, layoutG);
  }

  /* zones placed in the lounge: DJ booth, bar counter, storage lockers. Each takes floor that seats and dancers lose. */
  if (loungeLen > 1.6) {
    const zoneBox = (name, rect, h, kg, build) => {
      const [x0, x1, z0, z1] = rect;
      loungeRects.push(rect);
      const g = group(name); layoutG.add(g);
      box(x1 - x0, h, z1 - z0, 'panel', (x0 + x1) / 2, deckY + h / 2, (z0 + z1) / 2, g);
      box(x1 - x0 + 0.04, 0.04, z1 - z0 + 0.04, 'plinth', (x0 + x1) / 2, deckY + h + 0.02, (z0 + z1) / 2, g);
      if (build) build(g, x0, x1, z0, z1, deckY + h + 0.04);
      extraMass.push({ cat: 'zones', kg, y: deckY + h / 2, label: name });
      zones.push({ name, rect, kg });
    };
    if (s.dj && s.dj !== 'none') {
      const x0 = s.dj === 'front' ? lx1 - 0.75 : lx0 + 0.05;
      zoneBox('DJ booth', [x0, x0 + 0.7, -0.8, 0.8], 0.95, 70, (g, a, b, c, d, top) => {
        for (const z of [-0.45, 0.45]) { const t = mesh(geo('Cylinder', 0.17, 0.17, 0.03, 28), 'grille', g); t.position.set((a + b) / 2, top + 0.02, z); }
        box(0.3, 0.06, 0.35, 'speaker', (a + b) / 2, top + 0.03, 0, g);
        box(0.02, 0.03, d - c, 'led', s.dj === 'front' ? a - 0.01 : b + 0.01, top - 0.08, 0, g, false);
      });
    }
    if (s.bar && s.bar !== 'none') {
      const len = Math.max(1.2, loungeLen * 0.5), xm = (lx0 + lx1) / 2;
      zoneBox('Bar counter', [xm - len / 2, xm + len / 2, -edge + 0.02, -edge + 0.52], 1.05, 60, (g, a, b, c, d, top) => {
        for (let x = a + 0.15; x < b - 0.1; x += 0.22) { const bt = mesh(geo('Cylinder', 0.035, 0.04, 0.28, 10), 'glass', g, false); bt.position.set(x, top + 0.14, c + 0.15); }
        box(b - a, 0.025, 0.02, 'led', (a + b) / 2, top - 0.1, d + 0.012, g, false);
      });
    }
    if (s.storage && s.storage !== 'none') {
      const x0 = s.storage === 'front' ? lx1 - 0.58 : lx0 + 0.03;
      zoneBox('Storage lockers', [x0, x0 + 0.55, -edge + 0.02, edge - 0.02], 1.1, 45, (g, a, b, c, d) => {
        const n = Math.max(2, Math.round((d - c) / 0.5));
        for (let i = 1; i < n; i++) box(0.012, 1.0, 0.012, 'frame', s.storage === 'front' ? a - 0.007 : b + 0.007, deckY + 0.55, c + (d - c) * i / n, g, false);
      });
    }
  }

  /* lower lounge */
  const lay = s.layout;
  const retHalf = edge - depth;
  const sideL = s.secondStep === 'driver' ? 1 : -1;   // the L couch takes the side without the entry step
  const runs = [];
  if (loungeLen > 0.6) {
    if (lay === 'lshape') {
      runs.push({ axis: 'x', c: sideL * edge, s0: lx0, s1: lx1, dir: -sideL, cornerLo: retHalf > 0.28, cornerHi: false, pillows: true });
      if (retHalf > 0.28) runs.push({ axis: 'z', c: lx0, s0: sideL < 0 ? -retHalf : -(edge - 0.05), s1: sideL < 0 ? edge - 0.05 : retHalf, dir: 1, pillows: true });
    } else if (lay !== 'platform') {
      const hasFront = lay === 'ring' || lay === 'ushape', hasRear = lay === 'ring';
      for (const sgn of [-1, 1]) runs.push({ axis: 'x', c: sgn * edge, s0: lx0, s1: lx1, dir: -sgn, cornerLo: hasRear && retHalf > 0.28, cornerHi: hasFront && retHalf > 0.28, pillows: true });
      if (retHalf > 0.28) {
        if (hasFront) runs.push({ axis: 'z', c: lx1, s0: -retHalf, s1: retHalf, dir: -1, pillows: false });
        if (hasRear) runs.push({ axis: 'z', c: lx0, s0: -retHalf, s1: retHalf, dir: 1, pillows: false });
      }
    }
  }
  let seatsLow = 0;
  const seatRects = [];
  const footprint = (p, d) => (p.inward[0] === 0
    ? [Math.min(p.a[0], p.b[0]), Math.max(p.a[0], p.b[0]), Math.min(p.a[1], p.a[1] + p.inward[1] * d), Math.max(p.a[1], p.a[1] + p.inward[1] * d)]
    : [Math.min(p.a[0], p.a[0] + p.inward[0] * d), Math.max(p.a[0], p.a[0] + p.inward[0] * d), Math.min(p.a[1], p.b[1]), Math.max(p.a[1], p.b[1])]);
  for (const r of runs) for (const piece of splitRun(r, depth, loungeRects)) {
    seatsLow += sofaRun(layoutG, ridersLowG, piece, deckY, depth, 'lounge', skin);
    seatRects.push(footprint(piece, depth));
  }
  if (lay === 'platform' && loungeLen > 0.6) {   // sit, lie and pile in: counted at about 4½ sq ft each
    const ph = Math.min(floorW / 2 - 0.05, tubeInnerAt(clamp(tubeY, deckY, deckY + 0.16)) - 0.03);
    rectMinus([lx0, lx1, -ph, ph], loungeRects).forEach(([a, b, c, d]) => {
      if (b - a > 0.2 && d - c > 0.2) rbox(b - a, 0.16, d - c, 0.06, 'fabric', (a + b) / 2, deckY + 0.08, (c + d) / 2, layoutG);
    });
    for (const sgn of [-1, 1]) rbox(Math.max(0.3, loungeLen - 0.1), 0.24, 0.22, 0.1, sgn > 0 ? 'fabric' : 'accent', (lx0 + lx1) / 2, deckY + 0.28, sgn * (ph - 0.11), layoutG);
    const pts = packPoints(lx0 + 0.25, lx1 - 0.2, -ph + 0.25, ph - 0.25, 0.42 / 1.12, loungeRects, 0.1);
    pts.forEach(([x, z], n) => {
      const standUp = s.headroom >= 1.85 && n % 3 === 1;
      const m = standUp ? mannequin('stand', skin(), n) : mannequin('floor', skin());
      m.rotation.y = Math.abs(z) < 0.15 ? (n % 2 ? 0 : Math.PI) : z > 0 ? Math.PI / 2 : -Math.PI / 2;
      m.position.set(x, deckY + 0.16 + (standUp ? 0.8 : 0), z);
      if (standUp) m.userData.standing = true;
      ridersLowG.add(m);
    });
    seatsLow += pts.length;
    seatRects.push([lx0, lx1, -ph, ph]);
  }
  spk.forEach((p) => buildSpeakerBox(p.hung ? soundOffG : soundG, p, p.hung ? roofBottom - (p.out ? 0.06 : 0.04) - p.h : deckY));
  {
    let gx0 = lx0 + 0.05, gx1 = lx1 - 0.05, gz0 = -edge + 0.05, gz1 = edge - 0.05;
    if (lay === 'lshape') { gx0 = lx0 + depth; if (sideL < 0) gz0 = -edge + depth; else gz1 = edge - depth; }
    else if (retHalf > 0.28) {
      if (lay === 'ring') gx0 = lx0 + depth;
      if (lay === 'ring' || lay === 'ushape') gx1 = lx1 - depth;
      gz0 = -retHalf; gz1 = retHalf;
    }
    if (lay !== 'platform' && gx1 - gx0 > 0.3 && gz1 - gz0 > 0.3) {
      const rug = mesh(geo('Plane', gx1 - gx0 - 0.08, gz1 - gz0 - 0.08), 'rug', layoutG, false);
      rug.rotation.x = -Math.PI / 2; rug.position.set((gx0 + gx1) / 2, deckY + 0.004, (gz0 + gz1) / 2);
    }
  }

  /* standing and dancing riders on open floor */
  const AREA = STAND_AREA[s.standing] || 0;
  const standGrid = (x0, x1, z0, z1, blocked, y, parent, cx) => {
    if (!AREA || x1 - x0 < 0.35 || z1 - z0 < 0.35) return 0;
    const p = Math.sqrt(AREA * 1.12), step = 0.08;   // hex-ish packing at the chosen floor area per person
    const placed = [];
    for (let z = z0 + 0.2; z <= z1 - 0.2 + 1e-6; z += step) for (let x = x0 + 0.2; x <= x1 - 0.2 + 1e-6; x += step) {
      if (blocked.some((r) => x > r[0] - 0.14 && x < r[1] + 0.14 && z > r[2] - 0.14 && z < r[3] + 0.14)) continue;
      if (placed.some(([px, pz]) => (px - x) ** 2 + (pz - z) ** 2 < p * p)) continue;
      placed.push([x, z]);
    }
    placed.forEach(([x, z], n) => {
      const m = mannequin('stand', skin(), n);
      m.position.set(x, y + 0.8, z); m.userData.standing = true;
      m.rotation.y = Math.atan2(z, cx - x + 0.001) + ((n % 3) - 1) * 0.5;
      parent.add(m);
    });
    return placed.length;
  };
  const standLow = loungeLen > 0.8 && lay !== 'platform' && s.headroom >= 1.85 ? standGrid(lx0 + 0.1, lx1 - 0.1, -edge + 0.05, edge - 0.05, seatRects.concat(loungeRects), deckY, ridersLowG, (lx0 + lx1) / 2) : 0;

  /* upper deck fittings: rails, seating, ladders, stairs, neon, projectors (removable for transport) */
  let seatsRoof = 0, standRoof = 0, railTop = roofTop, railRun = 0;
  const railLine = (p0, p1, h, y0, parent) => {
    const a = new Vec3(p0[0], y0, p0[1]), b = new Vec3(p1[0], y0, p1[1]);
    const len = a.distanceTo(b); if (len < 0.05) return;
    const n = Math.max(1, Math.ceil(len / 1.4));
    for (let i = 0; i <= n; i++) { const p = a.clone().lerp(b, i / n); F(box(0.045, h, 0.045, 'frame', p.x, y0 + h / 2, p.z, parent)); }
    const alongX = Math.abs(p1[0] - p0[0]) > Math.abs(p1[1] - p0[1]);
    const bars = h > 0.6 ? [[h, 0.05], [h * 0.5, 0.035]] : [[h, 0.05]];
    for (const [yy, t] of bars) F(box(alongX ? len : t, t, alongX ? t : len, 'frame', (a.x + b.x) / 2, y0 + yy, (a.z + b.z) / 2, parent));
    bom.rail += len * bars.length + (n + 1) * h;
    railRun += len;
  };
  if (s.roofDeck) {
    railTop = dTop + s.railHeight;
    const rl = (p0, p1, h = s.railHeight) => railLine(p0, p1, h, dTop, railsG);
    decks.forEach((dk, i) => {
      const { X0: x0, X1: x1 } = dk, isRear = i === 0;
      rl([x0, -rzE], [x1, -rzE]);
      rl([x0, rzE], [x1, rzE]);
      rl([x1, -rzE], [x1, rzE]);
      if (ladderRear && isRear) {
        rl([x0, -rzE], [x0, zR - 0.36]); rl([x0, zR + 0.36], [x0, rzE]);
        if (dk.dx0 - rx0 > 0.3) { rl([rx0 + 0.06, zR - 0.46], [x0, zR - 0.46]); rl([rx0 + 0.06, zR + 0.46], [x0, zR + 0.46]); }
      } else rl([x0, -rzE], [x0, rzE]);
      const obstacles = [];
      if (hatch && hatch[1] > dk.dx0 && hatch[0] < dk.dx1) obstacles.push([hatch[0] - 0.2, hatch[1] + 0.2, hatch[2] - 0.2, hatch[3] + 0.2]);
      if (ladderRear && isRear) obstacles.push([x0 - 0.1, x0 + 0.9, zR - 0.5, zR + 0.5]);
      const roofSeatRects = [];
      if (s.roofSeating === 'pillows') {
        const res = pillowSeats(roofSeatG, ridersRoofG, x0, x1, rzE, dTop, obstacles, skin);
        seatsRoof += res.n; roofSeatRects.push(...res.rects);
      } else if (s.roofSeating !== 'none') {
        const dd = clamp(1.05, 0.55, rzE - 0.4), back = rzE - 0.05, withFront = s.roofSeating === 'u';
        const rr = [];
        for (const sgn of [-1, 1]) rr.push({ axis: 'x', c: sgn * back, s0: x0 + 0.12, s1: x1 - 0.05, dir: -sgn, cornerLo: false, cornerHi: withFront, pillows: true });
        if (withFront && back - dd > 0.3) rr.push({ axis: 'z', c: x1 - 0.05, s0: -(back - dd), s1: back - dd, dir: -1, pillows: false });
        for (const r of rr) for (const piece of splitRun(r, dd, obstacles)) {
          seatsRoof += sofaRun(roofSeatG, ridersRoofG, piece, dTop, dd, 'daybed', skin);
          roofSeatRects.push(footprint(piece, dd));
        }
      }
      standRoof += standGrid(x0 + 0.15, x1 - 0.15, -rzE + 0.15, rzE - 0.15, roofSeatRects.concat(obstacles), dTop, ridersRoofG, (x0 + x1) / 2);
    });
    if (ladderRear) {
      const lxp = rx0 - 0.06, y0 = 0.22, y1 = dTop + Math.max(0.5, s.railHeight * 0.85);
      const g = group('Ladder'); railsG.add(g);
      for (const sz of [-1, 1]) F(box(0.05, y1 - y0, 0.05, 'rim', lxp, (y0 + y1) / 2, zR + sz * 0.25, g));
      for (let y = y0 + 0.25; y < roofTop - 0.05; y += 0.3) F(cylX(0.018, 0.5, 'rim', lxp, y, zR, g, 8)).rotation.set(Math.PI / 2, 0, 0);
    }
    const hatchRail = () => {
      const [hx0, hx1, hz0, hz1] = hatch;
      const zi = hs > 0 ? hz0 - 0.05 : hz1 + 0.05;
      rl([hx0 - 0.05, zi], [hx1 + 0.05, zi], Math.min(0.95, s.railHeight));
    };
    if (lad) {
      const g = group('Ladder'); railsG.add(g);
      const topY = dTop + 0.95;
      const xAt = (y) => lad.cross + lad.dir * (roofBottom - y) / LADDER_TAN;
      for (const sz of [-1, 1]) F(rod(new Vec3(xAt(lad.yb), lad.yb, lad.zL + sz * 0.25), new Vec3(xAt(topY), topY, lad.zL + sz * 0.25), 0.026, 'rim', g, false, 8));
      for (let y = lad.yb + 0.28; y < roofTop; y += 0.3) F(rod(new Vec3(xAt(y), y, lad.zL - 0.25), new Vec3(xAt(y), y, lad.zL + 0.25), 0.018, 'rim', g, false, 8));
      hatchRail();
    }
    if (stair) {   // stairs stay with the structure; only the hatch rail comes off
      const g = group('Stairs'); deckG.add(g);
      const { xBot, xTop, zS, rise, n } = stair;
      for (const sz of [-1, 1]) F(rod(new Vec3(xBot, deckY, zS + sz * 0.36), new Vec3(xTop, dTop - 0.05, zS + sz * 0.36), 0.03, 'frame', g, false, 8));
      for (let k = 1; k < n; k++) {
        const f = k / n;
        F(box(0.26, 0.04, 0.68, 'frame', xBot + (xTop - xBot) * f, deckY + rise * f - 0.02, zS, g));
        box(0.2, 0.012, 0.6, 'led', xBot + (xTop - xBot) * f + 0.02, deckY + rise * f + 0.002, zS, g, false);
      }
      bom.stairs += n;
      const hr = new Vec3(0, 0.95, 0);
      for (const sz of [-1, 1]) F(rod(new Vec3(xBot, deckY, zS + sz * 0.38).add(hr), new Vec3(xTop, dTop, zS + sz * 0.38).add(hr), 0.018, 'rim', g, false, 6));
      hatchRail();
    }
    /* lightning bolt neon, hanging from the top of the front rail, facing forward */
    if (s.neon) {
      const h = clamp(s.neonSize, 0.2, s.railHeight - 0.03), w = h * 0.39;
      const topY = railTop - 0.035, xs = X1 + 0.055;
      const P = (u, v) => new Vec3(xs, topY - (1 - v) * h, (0.5 - u) * w);
      const g = group('Neon bolt'); lightsRailsG.add(g);
      const pts = BOLT.map(([u, v]) => P(u, v));
      const tr = Math.max(0.009, 0.016 * h / 0.8);
      pts.forEach((p, i) => {
        rod(p, pts[(i + 1) % pts.length], tr, 'neon', g, false, 8).castShadow = false;
        const j = mesh(geo('Sphere', tr, 10, 8), 'neon', g, false); j.position.copy(p);
      });
      for (const u of [0.15, 0.6]) rod(new Vec3(xs, railTop, (0.5 - u) * w), P(u, 1), 0.005, 'rim', g, false, 6);
    }
    /* RGB projectors on the rail corners */
    if (s.projectors !== false) for (const [x, sx] of [[frontDeck.X1, 1], [rearDeck.X0, -1]]) for (const sz of [-1, 1]) {
      const at = new Vec3(x, railTop + 0.06, sz * rzE);
      box(0.12, 0.09, 0.09, 'speaker', at.x, at.y, at.z, lightsRailsG);
      const dir = new Vec3(sx * 0.5, -0.78, sz * 0.5).normalize();
      const lens = mesh(geo('Cylinder', 0.035, 0.035, 0.02, 16), 'rgb', lightsRailsG, false);
      lens.position.copy(at).addScaledVector(dir, 0.07); lens.quaternion.setFromUnitVectors(new Vec3(0, 1, 0), dir);
      const hB = 2.8, beam = mesh(geo('Cone', 0.6, hB, 20, 1, true), 'beam', lightsRailsG, false);
      beam.position.copy(at).addScaledVector(dir, hB / 2 + 0.06); beam.quaternion.setFromUnitVectors(new Vec3(0, -1, 0), dir);
      beam.name = 'Projector beam'; beam.userData.noBox = true;
      projectorCount++;
    }
  }
  /* low party barge: a lip rail around the open deck (DMV rails if the deck is 84″ or higher) */
  if (barge) {
    const need = deckY >= rule('dmvDeckHeight') - 1e-3;
    const h = need ? Math.max(s.railHeight, rule('dmvRailMin')) : 0.45;
    const zE = floorW / 2 - 0.03, gx = (st) => [st.x - st.w / 2, st.x + st.w / 2];
    for (const sgn of [-1, 1]) {
      let runs = [[xbR + 0.05, xfs - 0.05]];
      steps.filter((t) => t.sgn === sgn).forEach((t) => { runs = intervalsMinus(runs, ...gx(t)); });
      runs.forEach(([a, b]) => railLine([a, sgn * zE], [b, sgn * zE], h, deckY, deckG));
    }
    if (!rearLen) railLine([xbR + 0.05, -zE], [xbR + 0.05, zE], h, deckY, deckG);
    railTop = deckY + h;
  }

  /* bikes, hung by the front wheel */
  let bikeCount = 0, bikesWanted = 0;
  const nb = clamp(Math.round(s.bikes), 1, 10);
  const yh = roofBottom - 0.08;
  const HANG = 0.87;
  const hang = (x, y, z, out, mat) => {
    const b = bikeModel(mat);
    const up = new Vec3(0, 1, 0), zz = new Vec3().crossVectors(up, out);
    b.quaternion.setFromBasis(up, out, zz);
    b.position.set(x, y - HANG, z);
    bikesG.add(b); bikeCount++;
  };
  if (s.bikeRack === 'rear' || s.bikeRack === 'both') {
    bikesWanted += nb;
    const xw = rx0 - (ladderRear ? 0.12 : 0.03);
    const blocked = [];
    if (ladderRear) blocked.push([zR - 0.5, zR + 0.5]);
    if (s.rearStyle === 'daiquiri' && rearLen > 0) blocked.push([daiquiriZ - daiquiriW / 2 - 0.15, daiquiriZ + daiquiriW / 2 + 0.15]);
    let free = [[-floorW / 2 + 0.2, floorW / 2 - 0.2]];
    blocked.forEach(([a, b]) => { free = intervalsMinus(free, a, b); });
    const slots = [];
    free.forEach(([a, b]) => { for (let z = a + 0.05; z <= b - 0.05 + 1e-6; z += 0.32) slots.push(z); });
    slots.sort((p, q) => Math.abs(p) - Math.abs(q));
    const use = slots.slice(0, nb).sort((p, q) => p - q);
    use.forEach((z, i) => hang(xw, yh - (i % 2) * 0.22, z, new Vec3(-1, 0, 0), ('bike' + (i % 6))));
    if (use.length) {
      const z0 = use[0] - 0.2, z1 = use[use.length - 1] + 0.2;
      box(0.05, 0.05, z1 - z0, 'frame', xw + 0.02, yh + 0.03, (z0 + z1) / 2, bikesG);
    }
  }
  if (s.bikeRack === 'sides' || s.bikeRack === 'both') {
    bikesWanted += 2 * nb;
    const tubeTop = tubeY + R + 0.03;
    const alt = clamp(yh - 2 * HANG - tubeTop, 0, 0.22);
    const pitch = alt > 0.1 ? 0.34 : 0.62;
    for (const sgn of [-1, 1]) {
      let free = [[xbR + 0.15, xfs - 0.2]];
      steps.filter((t) => t.sgn === sgn).forEach((t) => { free = intervalsMinus(free, t.x - t.w / 2 - 0.35, t.x + t.w / 2 + 0.35); });
      if (lad && sgn > 0) free = intervalsMinus(free, lad.xb - 0.5, lad.xb + 0.5);
      spk.filter((p) => p.hung && p.sgn === sgn).forEach((p) => { free = intervalsMinus(free, p.x - 0.45, p.x + 0.45); });
      const slots = [];
      free.forEach(([a, b]) => { for (let x = a + 0.05; x <= b - 0.05 + 1e-6; x += pitch) slots.push(x); });
      const use = slots.slice(0, nb);
      const zw = sgn * (floorW / 2 + 0.06);
      use.forEach((x, i) => hang(x, yh - (i % 2) * alt, zw, new Vec3(0, 0, sgn), ('bike' + ((i + (sgn > 0 ? 3 : 0)) % 6))));
      if (use.length) {
        const x0 = use[0] - 0.25, x1 = use[use.length - 1] + 0.25;
        box(x1 - x0, 0.05, 0.05, 'frame', (x0 + x1) / 2, yh + 0.03, zw, bikesG);
      }
    }
  }

  const cockpitCam = openFront
    ? { p: [driverX - 0.7, seatY + 1.1, driverZ * 0.55], t: [driverX + 4, seatY - 0.3, driverZ * 0.8] }
    : { p: [driverX + 0.02, Math.min(seatY + 0.8, cabRoof - 0.16), driverZ + 0.34], t: [driverX + 6, seatY + 0.1, driverZ + 0.15] };

  const geom = {
    style: C.style, kind: C.style, hasCab, openFront, isCart, conv, deckY, floorY: deckY, W, D, bodyL, floorW, mid, roofL: rLen, roofW, roofBottom, roofTop, railTop,
    dx0, dx1, lx0, lx1, loungeLen, driverX, driverZ, seatY, cabRoof, cabWidth: cab.width, xbF, xbR, fa, ra, dh, tubeY, wallArea, deckArea, rLen,
    frontLen, frontMin, rearLen, seatsLow, seatsRoof, standLow, standRoof, depth, bikeCount, bikesWanted, bom, frameKgM, lightDeck, cartFrame: isCart,
    legroom: 2 * (edge - depth), rearOverhang: ra - xbR, tubeRearOut: Math.max(0, xbR - txR),
    deckFrontCapped: !!(s.roofDeck && frontDeck && frontDeck.dx1 < dx1Want - 0.01), wheelR: wr, wheelbase: wb, cockpitCam, wheelZones, cutY,
    archInfo: archCut.map((a) => ({ front: a.zone.front, split: a.split, removed: a.removed, n: nSides })), pokeOut,
    roofDeckLen: s.roofDeck ? dx1 - dx0 : 0, railBaseY: roofTop,
    neonH: s.roofDeck && s.neon ? clamp(s.neonSize, 0.2, s.railHeight - 0.03) : 0,
    tooNarrow: hasCab && floorW < cab.width + (C.family === 'reality-check' ? -0.15 : 0.08),
    daiquiri: s.rearStyle === 'daiquiri' && rearLen > 0,
    kitResults, builtinBom, kitCar, prunedParts, hasTubes, tubeGroup: tubesG, hasRoof, barge, style, segs, decks, stair, stairsFailed, hatch, dTop, deckT: DECK_T, railRun, puckCount, projectorCount, extraMass, zones, powerY, bayIn,
    lift, edge, hs, xfs, xrs, xPostF, rx0, rx1, cabFloor, cabFrontX, cabBackX, frontFloorY, eye: [driverX + 0.02, seatY + 0.72, driverZ],
  };
  return { root, wheels, geom };
}