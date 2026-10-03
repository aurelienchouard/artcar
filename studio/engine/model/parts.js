/* Generic parts that design kits are made of: lofted shells, ribs and hoops, tubes, flat panels and solids.
   Every part culls the faces a wheel reaches at full steering lock plus travel (face-cut), keeps the standard rider
   and driver openings clear when asked, and books its area or length per material so kits get real weights. */
import { Vec3, TAU, clamp, degToRad } from '../math.js';
import { mesh, rod, group, geo, meshGeo } from './prims.js';
import { MATERIALS } from '../../catalogs/materials.js';
import { R as rule } from '../../catalogs/rules.js';

const sgnPow = (v, p) => Math.sign(v) * Math.pow(Math.abs(v), p);

export function makeToolbox(car, parent, acc) {
  /* acc: { area: {mat: m²}, length: {mat: m}, kg, pieces } for the kit being built */
  const inWheel = (x, y, z) => car.wheelZones.some((w) => y < car.cutY && x > w.x0 && x < w.x1 && Math.abs(z) > w.zIn && Math.abs(z) < w.zOut);
  const inBoxes = (p, boxes) => boxes.some((b) => p[0] > b[0] && p[0] < b[1] && p[1] > b[2] && p[1] < b[3] && p[2] > b[4] && p[2] < b[5]);
  const eye = car.eye;
  /* hug: parts that sit just over the stock hood or cowl stay even in the sight line (the hood blocks it already). */
  const hugs = (p, hugY) => hugY != null && p[1] <= hugY + 0.08;
  const inDriverCone = (p) => {
    const dx = p[0] - eye[0], dy = p[1] - eye[1], dz = p[2] - eye[2];
    if (dx < 0.25) return false;
    const az = Math.atan2(Math.abs(dz), dx), el = Math.atan2(dy, Math.hypot(dx, dz));
    return az < degToRad(rule('viewConeH') + 3) && el > degToRad(-rule('viewConeDown') - 3) && el < degToRad(Math.max(22, rule('viewConeUp') + 3));
  };
  const bookArea = (mat, a) => { acc.area[mat] = (acc.area[mat] || 0) + a; };
  const bookLen = (mat, l) => { acc.length[mat] = (acc.length[mat] || 0) + l; };
  const renderMat = (mat) => (MATERIALS[mat] ? MATERIALS[mat].mat : mat);
  const tri = (a, b, c) => { const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]]; return 0.5 * Math.hypot(u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]); };

  const T = {
    car, parent,
    group(name, p = parent) { const g = group(name); p.add(g); return g; },
    /* A toolbox that builds into a named sub-group (a separately removable piece) and books into the same kit. */
    sub(name) { const g = group(name); g.userData.piece = name; parent.add(g); return makeToolbox(car, g, acc); },
    /* Standard openings: lounge side windows, the space above each rideable deck, entry steps and the driver's door. */
    openings(opts = {}) {
      const big = 50, out = [];
      const sideIn = car.floorW / 2 - 0.35;
      const top = car.hasRoof ? car.roofBottom - 0.08 : car.deckY + 1.9;
      if (car.loungeLen > 0.8 && opts.lounge !== false) {
        out.push([car.lx0 + 0.15, car.lx1 - 0.15, car.deckY + 0.45, top, -big, -sideIn], [car.lx0 + 0.15, car.lx1 - 0.15, car.deckY + 0.45, top, sideIn, big]);
      }
      for (const d of car.decks) out.push([d.dx0, d.dx1, car.roofTop - 0.06, big, -big, big]);
      if (!car.hasRoof && opts.top !== false) out.push([car.xbR - 1, car.xfs, car.deckY + 1.2, big, -big, big]);
      for (const st of car.steps) out.push([st.x - st.w / 2 - 0.05, st.x + st.w / 2 + 0.05, -1, car.deckY + 2.0, st.sgn > 0 ? sideIn - 0.2 : -big, st.sgn > 0 ? big : -(sideIn - 0.2)]);
      out.push([car.driverX - 0.55, car.driverX + 0.65, car.cabFloor - 0.5, car.seatY + 1.35, -big, -(car.floorW / 2 - 0.45)]);
      if (car.ladderRear) out.push([car.rx0 - 1, car.rx0 + 0.6, -1, big, car.zR - 0.5, car.zR + 0.5]);
      return out.concat(opts.extra || []);
    },
    /* A lofted surface. section(t, x) returns { zc, yc, a, b, e, th0, th1 }: a superellipse arc in the cross-section
       (a: half width, b: half height, e: 2 round, 4 boxy, th from +Z going up). facets: points per section. */
    shell(spec) {
      const n = spec.stations || Math.max(4, Math.ceil((spec.x1 - spec.x0) / (spec.step || 0.25)));
      const m = spec.facets || 28;
      const minY = spec.minY ?? car.groundClear;
      const open = spec.openings || [];
      const pts = [];
      for (let i = 0; i <= n; i++) {
        const t = i / n, x = spec.x0 + (spec.x1 - spec.x0) * t, sc = spec.section(t, x);
        const row = [];
        const th0 = sc.th0 ?? 0, th1 = sc.th1 ?? TAU, closed = Math.abs(th1 - th0 - TAU) < 1e-6;
        for (let j = 0; j <= m; j++) {
          const th = th0 + (th1 - th0) * j / m, e = sc.e || 2;
          const z = (sc.zc || 0) + sc.a * sgnPow(Math.cos(th), 2 / e), y = Math.max(minY, sc.yc + sc.b * sgnPow(Math.sin(th), 2 / e));
          row.push([x + (sc.dx ? sc.dx(th) : 0), y, z]);
        }
        if (closed) row[m] = row[0];
        pts.push(row);
      }
      const pos = [], idx = [];
      let area = 0, cut = 0;
      for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) {
        const q = [pts[i][j], pts[i + 1][j], pts[i + 1][j + 1], pts[i][j + 1]];
        const c = [0, 1, 2].map((k) => (q[0][k] + q[1][k] + q[2][k] + q[3][k]) / 4);
        const tc = (a, b, d) => [0, 1, 2].map((k) => (a[k] + b[k] + d[k]) / 3);
        if (spec.cutWheels !== false && (q.some((p) => inWheel(...p)) || inWheel(...c) || inWheel(...tc(q[0], q[1], q[2])) || inWheel(...tc(q[0], q[2], q[3])))) {
          cut++;
          const zone = car.wheelZones.find((w) => c[0] > w.x0 - 0.2 && c[0] < w.x1 + 0.2);
          if (zone) acc.cut[zone.front ? 'front' : 'rear'] = (acc.cut[zone.front ? 'front' : 'rear'] || 0) + 1;
          continue;
        }
        if (inBoxes(c, open)) continue;
        if (spec.driverWindow && inDriverCone(c) && !hugs(c, spec.hugY)) continue;
        const a = tri(q[0], q[1], q[2]) + tri(q[0], q[2], q[3]);
        if (a < 1e-6) continue;
        const b = pos.length / 3;
        q.forEach((p) => pos.push(...p));
        idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
        area += a;
      }
      if (pos.length && spec.material) {   // no material: ribs only (an open lattice)
        const node = mesh(meshGeo(pos, idx), spec.render || renderMat(spec.material), spec.parent || parent);
        node.name = spec.name || 'Shell'; node.userData.kitSkin = true;
        if (spec.hugY != null) node.userData.hugY = spec.hugY;
        if (spec.uv) node.geo.uvScale = spec.uv;
      }
      if (spec.material) bookArea(spec.material, area * (spec.layers || 1));
      // hoops or ribs at intervals, and stringers along the length
      if (spec.ribs) {
        const every = spec.ribs.every || 0.6, k = Math.max(1, Math.round((spec.x1 - spec.x0) / every));
        for (let r = 0; r <= k; r++) {
          const i = Math.round(r * n / k), row = pts[i];
          T.band(row, spec.ribs, spec.openings, spec.driverWindow, spec.hugY);
        }
      }
      if (spec.stringers) for (const jj of spec.stringers.at) {
        const j = Math.round(jj * m);
        const line = pts.map((row) => row[j]);
        T.polyline(line, spec.stringers.r || 0.015, spec.stringers.material || 'conduit', spec.openings, spec.driverWindow, false, spec.hugY);
      }
      return { area, cut, pts };
    },
    /* A rib or hoop following a polyline of points: plywood ribs as flat bands, everything else as round tube. */
    band(row, rib, openings = [], driverWindow = false, hugY = null) {
      if (rib.material === 'plywood') {
        const w = rib.width || 0.09, th = 0.018, pos = [], idx = [];
        const cx = row.reduce((a, p) => a + p[1], 0) / row.length, cz = row.reduce((a, p) => a + p[2], 0) / row.length;
        let area = 0;
        for (let j = 0; j < row.length - 1; j++) {
          const p = row[j], q = row[j + 1];
          const inward = (r) => { const dy = cx - r[1], dz = cz - r[2], l = Math.hypot(dy, dz) || 1; return [r[0], r[1] + dy / l * w, r[2] + dz / l * w]; };
          const pi = inward(p), qi = inward(q);
          const mids = [[p, q], [pi, qi], [p, qi], [pi, q]].map(([u, v]) => [(u[0] + v[0]) / 2, (u[1] + v[1]) / 2, (u[2] + v[2]) / 2]);
          if ([p, q, pi, qi, ...mids].some((r) => inWheel(...r)) || inBoxes(p, openings) || inBoxes(q, openings) || (driverWindow && inDriverCone(p) && !hugs(p, hugY))) continue;
          const b = pos.length / 3;
          for (const dx of [-th / 2, th / 2]) [p, q, qi, pi].forEach((r) => pos.push(r[0] + dx, r[1], r[2]));
          idx.push(b, b + 1, b + 2, b, b + 2, b + 3, b + 4, b + 6, b + 5, b + 4, b + 7, b + 6, b, b + 4, b + 5, b, b + 5, b + 1);
          area += Math.hypot(q[1] - p[1], q[2] - p[2]) * w;
        }
        if (pos.length) { const node = mesh(meshGeo(pos, idx), 'plyRib', parent); node.name = 'Rib'; node.userData.frame = true; if (hugY != null) node.userData.hugY = hugY; }
        bookArea('plywood', area);
      } else T.polyline(row, rib.r || 0.012, rib.material || 'conduit', openings, driverWindow, true, hugY);
    },
    /* Round tube along a polyline, culled where it crosses the wheel envelope or an opening. */
    polyline(line, r, material, openings = [], driverWindow = false, frame = false, hugY = null) {
      let len = 0;
      for (let j = 0; j < line.length - 1; j++) {
        const p = line[j], q = line[j + 1];
        const mid = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2, (p[2] + q[2]) / 2];
        if (inWheel(...p) || inWheel(...q) || inWheel(...mid) || inBoxes(mid, openings) || (driverWindow && inDriverCone(mid) && !hugs(mid, hugY))) continue;
        const a = new Vec3(...p), b = new Vec3(...q);
        if (a.distanceTo(b) < 1e-3) continue;
        const node = rod(a, b, r, renderMat(material), parent, false, 6);
        if (frame || material === 'conduit' || material === 'steel') node.userData.frame = true;
        if (hugY != null) node.userData.hugY = hugY;
        len += a.distanceTo(b);
      }
      bookLen(material, len);
      return len;
    },
    /* Flat convex panel from 3D points (fan), double sided. Faces in the wheel envelope are dropped. */
    panel(points, material, name = 'Panel', render = null) {
      const pos = [], idx = [];
      let area = 0;
      for (let k = 1; k < points.length - 1; k++) {
        const a = points[0], b = points[k], c = points[k + 1];
        const cen = [0, 1, 2].map((i) => (a[i] + b[i] + c[i]) / 3);
        if ([a, b, c, cen].some((p) => inWheel(...p))) continue;
        const base = pos.length / 3; pos.push(...a, ...b, ...c); idx.push(base, base + 1, base + 2);
        area += tri(a, b, c);
      }
      if (pos.length) { const node = mesh(meshGeo(pos, idx), render || renderMat(material), parent); node.name = name; node.userData.kitSkin = true; }
      bookArea(material, area);
      return area;
    },
    /* Solid primitives with a known weight (kg) for horns, eyes, lenses, stacks. */
    solid(g, material, x, y, z, kg, name, rot) {
      const node = mesh(g, renderMat(material), parent); node.position.set(x, y, z); node.name = name || 'Part';
      if (rot) node.rotation.set(...rot);
      acc.kg += kg;
      return node;
    },
    led(points, r = 0.012) {
      for (let j = 0; j < points.length - 1; j++) {
        const a = new Vec3(...points[j]), b = new Vec3(...points[j + 1]);
        if (a.distanceTo(b) < 1e-3 || inWheel(...points[j])) continue;
        rod(a, b, r, 'led', parent, false, 6).castShadow = false;
        acc.ledLen += a.distanceTo(b);
      }
    },
    inWheel, inDriverCone,
  };
  return T;
}

/* Turn a kit's booked areas and lengths into kg with the rules table. */
export function kitKg(acc) {
  let kg = acc.kg;
  for (const [m, a] of Object.entries(acc.area)) kg += a * rule(MATERIALS[m] ? MATERIALS[m].rule : 'skinAlu');
  for (const [m, l] of Object.entries(acc.length)) kg += l * rule(MATERIALS[m] ? MATERIALS[m].rule : 'conduit');
  return kg * (1 + rule('hardware'));
}
