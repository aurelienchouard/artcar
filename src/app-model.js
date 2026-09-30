/* Art Car Studio — parametric model. See app-data.js for coordinates and the chassis catalog. */
/* ------------------------------------------------------------------ textures */
function playaTexture() {
  const N = 512, CELL = 32, G = N / CELL;
  const rnd = mulberry(7);
  const pts = [];
  for (let i = 0; i < G * G; i++) pts.push([0.05 + 0.9 * rnd(), 0.05 + 0.9 * rnd(), 0.965 + 0.05 * rnd()]);
  const cv = document.createElement('canvas'); cv.width = cv.height = N;
  const ctx = cv.getContext('2d');
  const img = ctx.createImageData(N, N);
  for (let y = 0; y < N; y++) {
    const cy = Math.floor(y / CELL);
    for (let x = 0; x < N; x++) {
      const cx = Math.floor(x / CELL);
      let f1 = 1e9, f2 = 1e9, shade = 1;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const gx = (cx + dx + G) % G, gy = (cy + dy + G) % G;
        const p = pts[gy * G + gx];
        const px = (cx + dx + p[0]) * CELL, py = (cy + dy + p[1]) * CELL;
        const d = Math.hypot(x - px, y - py);
        if (d < f1) { f2 = f1; f1 = d; shade = p[2]; } else if (d < f2) f2 = d;
      }
      const edge = f2 - f1;
      const crack = 1 - Math.min(1, edge / 1.6);
      const grain = (hash2(x, y) - 0.5) * 9;
      const v = shade * (1 - 0.13 * crack * crack);
      const i = (y * N + x) * 4;
      img.data[i] = clamp(205 * v + grain, 0, 255);
      img.data[i + 1] = clamp(190 * v + grain, 0, 255);
      img.data[i + 2] = clamp(167 * v + grain, 0, 255);
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new T.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = T.RepeatWrapping;
  tex.colorSpace = T.SRGBColorSpace;
  return tex;
}
function perforationTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, 64, 64);
  g.fillStyle = '#000'; g.beginPath(); g.arc(32, 32, 17, 0, TAU); g.fill();
  const t = new T.CanvasTexture(c);
  t.wrapS = t.wrapT = T.RepeatWrapping;
  return t;
}
function rugTexture() {
  const N = 256, cv = document.createElement('canvas'); cv.width = cv.height = N;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#e9e3d8'; ctx.fillRect(0, 0, N, N);
  for (let y = 0; y < N; y += 8) for (let x = 0; x < N; x += 8) {
    const odd = ((x + y) / 8) % 2;
    ctx.fillStyle = odd ? 'rgba(90,70,40,.16)' : 'rgba(255,255,255,.18)';
    ctx.fillRect(x + (odd ? 0 : 1), y + (odd ? 1 : 0), odd ? 8 : 6, odd ? 6 : 8);
  }
  ctx.strokeStyle = 'rgba(70,55,35,.28)'; ctx.lineWidth = 6; ctx.strokeRect(10, 10, N - 20, N - 20);
  const tex = new T.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = T.RepeatWrapping;
  tex.colorSpace = T.SRGBColorSpace;
  return tex;
}
function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function hash2(x, y) { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); }

/* ------------------------------------------------------------------ materials */
const LED_U = {
  uTime: { value: 0 }, uMode: { value: 0 }, uLevel: { value: 1 }, uLen: { value: 7 },
  uColorA: { value: new T.Color() }, uColorB: { value: new T.Color() }, uCarInv: { value: new T.Matrix4() },
};
const LED_MODES = { solid: 0, breathe: 1, chase: 2, sunset: 3, sparkle: 4, off: 5 };
const LED_GLSL = /* glsl */`
uniform float uTime; uniform float uMode; uniform float uLevel; uniform float uLen;
uniform vec3 uColorA; uniform vec3 uColorB;
varying vec3 vLedPos;
float ledHash(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
vec3 ledEmission(vec3 p){
  float x = p.x / max(uLen, 0.001);
  if (uMode < 0.5) return uColorA * uLevel;
  if (uMode < 1.5) return uColorA * uLevel * (0.3 + 0.7 * (0.5 + 0.5 * sin(uTime * 1.7)));
  if (uMode < 2.5) {
    float ph = fract(x * 2.2 - uTime * 0.5 + p.y * 0.04);
    float pulse = pow(smoothstep(0.55, 1.0, ph), 2.2) * (1.0 - smoothstep(0.985, 1.0, ph));
    return (uColorB * 0.22 + uColorA * 1.7 * pulse) * uLevel;
  }
  if (uMode < 3.5) {
    float g = 0.5 + 0.5 * sin(x * 7.5 - uTime * 0.6 + p.y * 0.9 + p.z * 0.5);
    return mix(uColorA, uColorB, smoothstep(0.15, 0.85, g)) * uLevel;
  }
  if (uMode < 4.5) {
    vec3 cell = floor(p * vec3(7.0, 12.0, 12.0));
    float r = ledHash(cell + 3.1);
    float tw = fract(r * 13.7 + uTime * (0.3 + 0.7 * r));
    float k = 0.16 + 2.8 * pow(max(0.0, 1.0 - abs(tw * 2.0 - 1.0)), 14.0);
    return mix(uColorA, vec3(1.0), 0.4 * step(0.86, r)) * k * uLevel;
  }
  return vec3(0.0);
}`;

function makeLedMaterial() {
  const m = new T.MeshStandardMaterial({ color: 0x1d1d1d, roughness: 0.35, metalness: 0.05, emissive: 0xffffff, emissiveIntensity: 1 });
  m.onBeforeCompile = (sh) => {
    for (const k of Object.keys(LED_U)) sh.uniforms[k] = LED_U[k];
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform mat4 uCarInv;\nvarying vec3 vLedPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvLedPos = (uCarInv * modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\n' + LED_GLSL)
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance = ledEmission(vLedPos);');
  };
  m.customProgramCacheKey = () => 'artcar-led-1';
  return m;
}

const MAT = {};
function makeMaterials() {
  const std = (o) => new T.MeshStandardMaterial(o);
  MAT.frame = std({ metalness: 0.55, roughness: 0.46 });
  MAT.floor = std({ metalness: 0.2, roughness: 0.85 });
  MAT.tube = std({ metalness: 0.62, roughness: 0.34, side: T.DoubleSide });
  MAT.tubeF = std({ metalness: 0.62, roughness: 0.34, side: T.DoubleSide, flatShading: true });
  MAT.ply = std({ metalness: 0, roughness: 0.78, side: T.DoubleSide });
  MAT.plyF = std({ metalness: 0, roughness: 0.78, side: T.DoubleSide, flatShading: true });
  MAT.plyRib = std({ metalness: 0, roughness: 0.8 });
  const perfTex = perforationTexture();
  MAT.perf = std({ metalness: 0.65, roughness: 0.38, side: T.DoubleSide, alphaMap: perfTex, alphaTest: 0.5 });
  MAT.perfF = std({ metalness: 0.65, roughness: 0.38, side: T.DoubleSide, alphaMap: perfTex, alphaTest: 0.5, flatShading: true });
  MAT.glowSkin = std({ color: 0xeee9e0, roughness: 0.55, emissive: 0xffffff, emissiveIntensity: 0.1, side: T.DoubleSide });
  MAT.glowSkinF = std({ color: 0xeee9e0, roughness: 0.55, emissive: 0xffffff, emissiveIntensity: 0.1, side: T.DoubleSide, flatShading: true });
  MAT.glowInner = std({ color: 0x050505, roughness: 1, emissive: 0xffffff, emissiveIntensity: 0.2 });
  MAT.shade = std({ roughness: 1, side: T.DoubleSide, transparent: true, opacity: 0.94 });
  MAT.puck = std({ color: 0xfff4e0, emissive: 0xffe2b0, emissiveIntensity: 0.2 });
  MAT.neon = std({ color: 0xffd35a, emissive: 0xffc23a, emissiveIntensity: 1 });
  MAT.rgb = std({ color: 0x111111, emissive: 0xff00ff, emissiveIntensity: 1.5 });
  MAT.beam = new T.MeshBasicMaterial({ color: 0xff00ff, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide });
  MAT.vent = std({ color: 0x1a1b1d, metalness: 0.6, roughness: 0.4 });
  MAT.panel = std({ metalness: 0.4, roughness: 0.55 });
  MAT.fabric = std({ roughness: 0.96 });
  MAT.plinth = std({ roughness: 0.9 });
  MAT.accent = std({ roughness: 0.95, side: T.DoubleSide });
  MAT.accent2 = std({ roughness: 0.95 });
  MAT.rug = std({ roughness: 1, map: rugTexture() });
  MAT.led = makeLedMaterial();
  MAT.ribSolid = std({ color: 0x1d1d1d, roughness: 0.35, metalness: 0.05, emissive: 0xffffff, emissiveIntensity: 1 });
  MAT.ribSolid2 = std({ color: 0x1d1d1d, roughness: 0.35, metalness: 0.05, emissive: 0xffffff, emissiveIntensity: 1 });
  MAT.rubber = std({ color: 0x1b1b1c, roughness: 0.92 });
  MAT.rim = std({ color: 0x8b8f95, metalness: 0.85, roughness: 0.3 });
  MAT.leather = std({ color: 0x1e1f22, roughness: 0.55 });
  MAT.speaker = std({ color: 0x131416, roughness: 0.82, side: T.DoubleSide });
  MAT.curtain = std({ color: 0xefe9df, roughness: 1, side: T.DoubleSide });
  MAT.tail = std({ color: 0x400808, emissive: 0xff1a12, emissiveIntensity: 2.2 });
  MAT.head = std({ color: 0x777777, emissive: 0xfff3dc, emissiveIntensity: 1.6 });
  MAT.screen = std({ color: 0x0b1320, emissive: 0x3a6ea8, emissiveIntensity: 0.9 });
  MAT.cab = std({ roughness: 0.32, metalness: 0.2 });
  MAT.grille = std({ color: 0x1a1b1d, metalness: 0.75, roughness: 0.32 });
  MAT.glass = std({ color: 0x1b2633, roughness: 0.05, metalness: 0.3, transparent: true, opacity: 0.4, depthWrite: false, side: T.DoubleSide });
  MAT.bowl = std({ color: 0xe6eef3, roughness: 0.05, transparent: true, opacity: 0.3, depthWrite: false });
  MAT.slush = ['#ff4d6d', '#8fe36b', '#ffb13b'].map((c) => std({ color: c, roughness: 0.55, emissive: c, emissiveIntensity: 0.35 }));
  MAT.bike = ['#e8463a', '#2fa6d8', '#f2c230', '#8c5cd6', '#39b56a', '#f07ab8'].map((c) => std({ color: c, metalness: 0.35, roughness: 0.45 }));
  MAT.skin = ['#7d6c5e', '#5f6f7c', '#9a7f64', '#667260', '#8b7f78', '#6d5a4c'].map((c) => std({ color: c, roughness: 0.85 }));
}
function shade(hex, f) { const c = new T.Color(hex); c.multiplyScalar(f); return c; }
function updateMaterialColors(s) {
  MAT.frame.color.set(s.frameColor);
  MAT.floor.color.copy(shade(s.frameColor, 0.8));
  MAT.tube.color.set(s.tubeColor); MAT.tubeF.color.set(s.tubeColor);
  MAT.ply.color.set(s.tubeColor); MAT.plyF.color.set(s.tubeColor);
  MAT.plyRib.color.copy(shade(s.tubeColor, 1.35));
  MAT.perf.color.set(s.tubeColor); MAT.perfF.color.set(s.tubeColor);
  MAT.glowSkin.emissive.set(s.ledColor); MAT.glowSkinF.emissive.set(s.ledColor); MAT.glowInner.emissive.set(s.ledColor);
  MAT.shade.color.set(s.shadeColor);
  MAT.panel.color.copy(shade(s.tubeColor, 1.12));
  MAT.fabric.color.set(s.fabricColor);
  MAT.plinth.color.copy(shade(s.fabricColor, 0.72));
  MAT.accent.color.set(s.accentColor);
  const hsl = {}; new T.Color(s.accentColor).getHSL(hsl);
  MAT.accent2.color.setHSL(hsl.h, hsl.s * 0.7, Math.min(0.8, hsl.l * 1.35));
  MAT.rug.color.set(s.rugColor);
  MAT.curtain.color.copy(shade(s.fabricColor, 1.08));
  if (s.cabMatch) MAT.cab.color.copy(shade(s.tubeColor, 1.12)); else MAT.cab.color.set(s.cabColor);
  MAT.led.color.copy(new T.Color(s.ledColor).multiplyScalar(0.18));
  MAT.led.emissive.set(s.ledColor);   // used by the GLB export; the viewer shader overrides it
  MAT.ribSolid.color.copy(new T.Color(s.ledColor).multiplyScalar(0.18));
  MAT.ribSolid.emissive.set(s.ledColor);
  MAT.ribSolid2.color.copy(new T.Color(s.ledColor2).multiplyScalar(0.18));
  MAT.ribSolid2.emissive.set(s.ledColor2);
}
function mesh(geo, mat, parent, shadow = true) {
  const m = new T.Mesh(geo, mat);
  m.castShadow = shadow; m.receiveShadow = true;
  parent.add(m);
  return m;
}
function box(w, h, d, mat, x, y, z, parent, shadow) {
  const m = mesh(new T.BoxGeometry(Math.max(w, 1e-3), Math.max(h, 1e-3), Math.max(d, 1e-3)), mat, parent, shadow);
  m.position.set(x, y, z);
  return m;
}
function rbox(w, h, d, r, mat, x, y, z, parent) {
  const rr = Math.min(r, w / 2 - 1e-3, h / 2 - 1e-3, d / 2 - 1e-3);
  const m = mesh(new T.RoundedBoxGeometry(w, h, d, 3, Math.max(0.002, rr)), mat, parent);
  m.position.set(x, y, z);
  return m;
}
function cylX(r, len, mat, x, y, z, parent, seg = 24, shadow = true, open = false) {
  const m = mesh(new T.CylinderGeometry(r, r, Math.max(len, 1e-3), seg, 1, open), mat, parent, shadow);
  m.rotation.z = Math.PI / 2;
  m.position.set(x, y, z);
  return m;
}
function ringX(r, tube, mat, x, y, z, parent, seg = 64, shadow = true) {
  const m = mesh(new T.TorusGeometry(r, tube, 8, seg), mat, parent, shadow);
  m.rotation.y = Math.PI / 2;
  m.position.set(x, y, z);
  return m;
}
const UP = new V3(0, 1, 0);
function rod(a, b, r, mat, parent, capsule = true, seg = 10) {
  const dir = b.clone().sub(a); const len = dir.length();
  const geo = capsule ? new T.CapsuleGeometry(r, Math.max(0.001, len), 4, seg) : new T.CylinderGeometry(r, r, len, seg);
  const m = mesh(geo, mat, parent);
  m.position.copy(a).add(b).multiplyScalar(0.5);
  if (len > 1e-6) m.quaternion.setFromUnitVectors(UP, dir.normalize());
  return m;
}

/* A scale figure. Origin is the hip point on the seat surface; the figure faces local +X. */
function mannequin(pose, mat, variant = 0) {
  const g = new T.Group();
  const P = (x, y, z) => new V3(x, y, z);
  const hip = 0.1;
  for (const sz of [-1, 1]) {
    const z = sz * 0.1;
    if (pose === 'stand') {
      const kx = variant % 2 ? 0.05 : -0.02;
      rod(P(0, hip, z), P(kx, hip - 0.42, z), 0.072, mat, g);
      rod(P(kx, hip - 0.42, z), P(0, hip - 0.84, z), 0.056, mat, g);
      rbox(0.2, 0.06, 0.09, 0.025, mat, 0.07, hip - 0.87, z, g);
    } else if (pose === 'floor') {
      rod(P(0, hip, z), P(0.36, hip + 0.1, z), 0.072, mat, g);
      rod(P(0.37, hip + 0.09, z), P(0.58, -0.22, z), 0.056, mat, g);
      rbox(0.2, 0.06, 0.09, 0.025, mat, 0.64, -0.245, z, g);
    } else if (pose === 'lounge') {
      rod(P(0, hip, z), P(0.34, hip + 0.24, z), 0.072, mat, g);
      rod(P(0.35, hip + 0.23, z), P(0.62, 0.0, z), 0.056, mat, g);
      rbox(0.2, 0.06, 0.09, 0.025, mat, 0.69, -0.02, z, g);
    } else {
      rod(P(0, hip, z), P(0.42, hip, z), 0.072, mat, g);
      rod(P(0.43, hip - 0.02, z), P(0.46, -0.3, z), 0.056, mat, g);
      rbox(0.2, 0.06, 0.09, 0.025, mat, 0.53, -0.335, z, g);
    }
  }
  const lean = pose === 'lounge' ? 0.42 : pose === 'floor' ? 0.36 : pose === 'drive' ? 0.1 : pose === 'stand' ? 0.03 : 0.16;
  const tb = P(-0.02, hip + 0.06, 0);
  const tdir = P(-Math.sin(lean), Math.cos(lean), 0);
  const tt = tb.clone().addScaledVector(tdir, 0.36);
  const torso = rod(tb, tt, 0.15, mat, g);
  torso.scale.set(1, 1, 1.18);
  const head = mesh(new T.SphereGeometry(0.1, 18, 12), mat, g);
  head.position.copy(tt).addScaledVector(tdir, 0.27);
  for (const sz of [-1, 1]) {
    const sh = tt.clone().add(P(0, -0.02, sz * 0.2));
    let el, hand;
    if (pose === 'drive') { el = sh.clone().add(P(0.2, -0.2, sz * 0.03)); hand = P(0.46, 0.55, sz * 0.16); }
    else if (pose === 'stand' && (variant + (sz > 0 ? 1 : 0)) % 3 !== 0) { el = sh.clone().add(P(0.06, 0.26, sz * 0.12)); hand = el.clone().add(P(0.04, 0.26, sz * 0.04)); }
    else if (pose === 'stand') { el = sh.clone().add(P(0.04, -0.28, sz * 0.05)); hand = el.clone().add(P(0.2, 0.08, -sz * 0.02)); }
    else if (pose === 'lounge' || pose === 'floor') { el = sh.clone().add(P(0.04, -0.26, sz * 0.07)); hand = P(0.2, 0.14, sz * 0.28); }
    else { el = sh.clone().add(P(0.08, -0.27, sz * 0.03)); hand = P(0.3, 0.2, sz * 0.17); }
    rod(sh, el, 0.047, mat, g);
    rod(el, hand, 0.043, mat, g);
  }
  return g;
}

/* Gathered, tied-back curtain panel. Hangs from y = height down to 0 and extends along +X from the post. */
function curtainGeometry(width, height) {
  const nu = 20, nv = 18, pos = [], uv = [], idx = [];
  const tie = 0.42;
  for (let j = 0; j <= nv; j++) {
    const v = j / nv;
    const w = v > tie ? width * (0.18 + 0.82 * Math.pow((v - tie) / (1 - tie), 1.4)) : width * (0.18 + 0.32 * Math.pow((tie - v) / tie, 0.8));
    const amp = 0.02 + 0.05 * (w / width);
    for (let i = 0; i <= nu; i++) {
      const u = i / nu;
      pos.push(u * w, v * height, amp * Math.sin(u * Math.PI * 7));
      uv.push(u, v);
    }
  }
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
    const a = j * (nu + 1) + i, b = a + 1, c = a + nu + 1, d = c + 1;
    idx.push(a, b, d, a, d, c);
  }
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/* ------------------------------------------------------------------ layout helpers */
function intervalsMinus(list, a, b) {
  const out = [];
  for (const [x0, x1] of list) {
    if (b <= x0 || a >= x1) { out.push([x0, x1]); continue; }
    if (a > x0) out.push([x0, a]);
    if (b < x1) out.push([b, x1]);
  }
  return out;
}
const overlap1 = (a0, a1, b0, b1) => a1 > b0 + 1e-6 && b1 > a0 + 1e-6;
/* Rectangle [x0, x1, z0, z1] minus holes, as a list of rectangles. */
function rectMinus(r, holes) {
  const hs = holes.filter((h) => overlap1(r[0], r[1], h[0], h[1]) && overlap1(r[2], r[3], h[2], h[3]));
  const xs = new Set([r[0], r[1]]);
  hs.forEach((h) => { xs.add(clamp(h[0], r[0], r[1])); xs.add(clamp(h[1], r[0], r[1])); });
  const xl = [...xs].sort((a, b) => a - b), out = [];
  for (let i = 0; i < xl.length - 1; i++) {
    const x0 = xl[i], x1 = xl[i + 1];
    if (x1 - x0 < 1e-3) continue;
    const xm = (x0 + x1) / 2;
    let zs = [[r[2], r[3]]];
    hs.forEach((h) => { if (xm > h[0] && xm < h[1]) zs = intervalsMinus(zs, h[2], h[3]); });
    zs.forEach(([z0, z1]) => { if (z1 - z0 > 1e-3) out.push([x0, x1, z0, z1]); });
  }
  return out;
}
/* A seat run has its back line at `c` on the cross axis, spans [s0, s1] along `axis`, and faces `dir` (±1) across. */
function splitRun(run, depth, rects) {
  const c0 = Math.min(run.c, run.c + run.dir * depth), c1 = Math.max(run.c, run.c + run.dir * depth);
  let parts = [[run.s0, run.s1]];
  for (const r of rects) {
    const [a0, a1, b0, b1] = run.axis === 'x' ? [r[0], r[1], r[2], r[3]] : [r[2], r[3], r[0], r[1]];
    if (overlap1(c0, c1, b0, b1)) parts = intervalsMinus(parts, a0, a1);
  }
  return parts.filter(([a, b]) => b - a > 0.55).map(([a, b]) => ({
    a: run.axis === 'x' ? [a, run.c] : [run.c, a],
    b: run.axis === 'x' ? [b, run.c] : [run.c, b],
    inward: run.axis === 'x' ? [0, run.dir] : [run.dir, 0],
    cornerA: run.cornerLo && Math.abs(a - run.s0) < 1e-6,
    cornerB: run.cornerHi && Math.abs(b - run.s1) < 1e-6,
    pillows: run.pillows,
  }));
}
function slabs(rects, y, t, mat, parent) {
  rects.forEach(([x0, x1, z0, z1]) => box(x1 - x0, t, z1 - z0, mat, (x0 + x1) / 2, y - t / 2, (z0 + z1) / 2, parent));
}
function group(name) { const g = new T.Group(); g.name = name; return g; }

/* ------------------------------------------------------------------ the car */
const LOCK = T.MathUtils.degToRad(35);   // front-wheel steering lock used for arch sizing
const BOLT = [[0, 1], [0.71, 1], [0.45, 0.64], [1, 0.62], [0.52, 0], [0.41, 0.45], [0, 0.45]];   // lightning bolt outline, u across, v up
const STAND_AREA = { comfortable: 0.84, party: 0.46, packed: 0.33 };   // m² per standing rider

function buildCar(s) {
  const C = chassisOf(s);
  const root = group(s.name || 'Art car');
  const body = group('Body'), tubesG = group('Tubes, steps and speakers'), roof = group('Canopy'), railsG = group('Roof deck fittings');
  const ridersLow = group('Riders lower deck'), ridersRoof = group('Riders roof deck');
  const wheelsG = group('Wheels'), chassisG = group('Chassis'), extras = group('Bikes');
  root.add(body, tubesG, roof, railsG, ridersLow, ridersRoof, wheelsG, chassisG, extras);
  let skinIdx = 0;
  const skin = () => MAT.skin[(skinIdx++) % MAT.skin.length];
  const F = (m) => { if (m) m.userData.frame = true; return m; };
  const bom = { deckArea: 0, post: 0, deckFrame: 0, roofFrame: 0, rail: 0, hoop: 0, stairs: 0, ply34: 0, ply12: 0, plyBend: 0, ribPly: 0,
    alu: 0, perf: 0, poly: 0, cloth: 0, tubeLen: 0, sections: 0 };

  /* chassis frame of reference */
  const wb = s.wheelbase, fa = wb / 2, ra = -wb / 2;
  const dh = s.frameHeight - C.spec.frameHeight;
  const deckY = s.frameHeight + C.buildup;
  const cab = C.cab, isCart = C.kind === 'cart', conv = C.kind === 'conventional';
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
  const W = s.width, D = Math.min(s.tubeDia, W * 0.42), R = D / 2;
  const floorW = W - D;
  const roofL = bodyL + 2 * s.roofOverhang, roofW = W + 2 * s.roofOverhang;
  const roofBottom = deckY + s.headroom, roofTop = roofBottom + 0.14;
  const tubeY = s.tubeLift + R;
  const tubeInnerAt = (y) => (Math.abs(y - tubeY) < R ? floorW / 2 - Math.sqrt(R * R - (y - tubeY) ** 2) : floorW / 2);
  const edge = Math.min(floorW / 2 - 0.1, tubeInnerAt(deckY + 0.3) - 0.03);   // tubes riding above the deck act as bolsters
  // the vehicle's own ends: cowl on carts, bumper with the cab, hood front or front panel without it
  const vehFront = isCart || hasCab ? fa + C.ba : conv ? fa + C.ba - 0.15 : fa + cab.front + 0.03;
  const vehRear = isCart ? fa + C.ba - C.length : xbR;
  const edgeF = Math.max(xbF, vehFront), edgeR = Math.min(xbR, vehRear);
  const txF = edgeF + s.tubeFront, txR = edgeR - s.tubeRear;
  const rEnd = R * (1 - s.tubeTaper);
  const rad = (x) => (x > edgeF ? T.MathUtils.lerp(R, rEnd, (x - edgeF) / Math.max(1e-4, s.tubeFront))
    : x < edgeR ? T.MathUtils.lerp(R, rEnd, (edgeR - x) / Math.max(1e-4, s.tubeRear)) : R);
  const depth = clamp(s.seatDepth, 0.45, Math.max(0.45, edge - 0.12));
  const slabT = 0.12;

  /* wheels, and where they cut through the tubes and low floors */
  const wr = s.wheelDia / 2, tireW = isCart ? 0.2 : 0.27, cutY = s.wheelDia + 0.1;
  const wheelZones = [[fa, true], [ra, false]].map(([ax, front]) => {
    const hw = tireW / 2 + (C.dual && !front ? 0.16 : 0), zc = s.track / 2;
    const zLock = front ? zc + wr * Math.sin(LOCK) + hw * Math.cos(LOCK) : zc + hw;
    const half = front ? Math.max(wr + 0.12, wr * Math.cos(LOCK) + hw * Math.sin(LOCK) + 0.1) : wr + 0.12;
    return { ax, front, x0: ax - half, x1: ax + half, zIn: zc - hw - 0.05, zOut: zLock + 0.05, zLock };
  });
  const bottomY = tubeY - R * (nSides ? Math.cos(Math.PI / nSides) : 1);
  const arches = wheelZones.filter((z) => z.zOut > W / 2 - D + 0.01 && z.zIn < W / 2 && bottomY < cutY);
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

  /* usable roof deck: always full width, shade-only roof ahead of and behind it */
  const xPostF = s.frontPosts ? xbF - 0.06 : Math.min(xbF - 0.06, hasCab ? cabBackX - 0.1 : driverX - 0.42);
  const rx0 = mid - roofL / 2, rx1 = Math.min(mid + roofL / 2, xPostF + 1.6), rzE = roofW / 2 - 0.06;
  const rLen = rx1 - rx0, rMid = (rx0 + rx1) / 2, hEnd = Math.min(xbF, rx1);
  const dF = s.roofDeck ? clamp(s.roofDeckFront, 0, Math.max(0, rLen - 1.6)) : 0;
  const dR = s.roofDeck ? clamp(s.roofDeckRear, 0, Math.max(0, rLen - 1.6 - dF)) : 0;
  const dx1Want = rx1 - dF, dx0 = rx0 + dR;
  const dx1 = s.roofDeck && !s.frontPosts ? Math.max(dx0 + 1.0, Math.min(dx1Want, xPostF + 0.5)) : dx1Want, X0 = dx0 + 0.06, X1 = dx1 - 0.06;
  const zR = s.rearStyle === 'daiquiri' && rearLen > 0 ? -floorW / 4 : 0;

  /* ladders */
  const ladderFront = s.roofDeck && s.ladder === 'front';
  const ladderRear = s.roofDeck && s.ladder === 'rear';
  const LADDER_TAN = Math.tan(T.MathUtils.degToRad(70));
  const loungeRects = [];
  let hatch = null, lad = null;
  if (ladderFront) {
    const zL = floorW / 2 - 0.42;
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
    lad = openFront && !isCart ? tryDir(1) : tryDir(-1);
    if (!lad.ok) lad = tryDir(-lad.dir);
    hatch = [xh - 0.42, xh + 0.42, zL - 0.36, zL + 0.36];
    if (lad.xb > lx0 - 0.4 && lad.xb < lx1 + 0.4) loungeRects.push([lad.xb - 0.6, lad.xb + 0.6, zL - 0.42, zL + 0.42]);
  }
  const ladderAtSeat = !!(lad && lad.dir > 0 && openFront && !isCart && lad.xb >= xfs);

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
  const lightDeck = isCart && s.layout === 'platform', frameKgM = isCart ? 2.4 : 3.2;
  const deckSlab = (rect, y, t) => {
    if (rect[1] - rect[0] < 0.02) return;
    const wh = wellHoles(y - t);
    slabs(rectMinus(rect, stepHoles.concat(wh)), y, t, MAT.floor, body);
    wh.forEach(([x0, x1, z0, z1]) => {
      const a = Math.max(x0, rect[0]), b = Math.min(x1, rect[1]), c = Math.max(z0, rect[2]), d = Math.min(z1, rect[3]);
      if (b - a > 0.02 && d - c > 0.02) {
        const top = Math.max(y, cutY + 0.03);
        box(b - a, top - (y - t), d - c, MAT.frame, (a + b) / 2, (top + y - t) / 2, (c + d) / 2, body);
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
    for (const sz of [-1, 1]) F(box(x1 - x0, 0.05, 0.05, MAT.frame, (x0 + x1) / 2, y, sz * (floorW / 2 - 0.03), body, false));
    const n = Math.max(1, Math.round((x1 - x0) / 0.6));
    for (let i = 0; i <= n; i++) F(box(0.05, 0.05, floorW - 0.06, MAT.frame, x0 + 0.04 + (x1 - x0 - 0.08) * i / n, y, 0, body, false));
    bom.deckFrame += 2 * (x1 - x0) + (n + 1) * floorW;
  };
  deckFrame(xbR, xfs, deckY - slabT - 0.025);
  deckFrame(xfs, xbF, frontFloorY - (openFront ? 0.06 : slabT) - 0.025);
  const subY0 = s.frameHeight - 0.02, subY1 = deckY - slabT;
  if (subY1 - subY0 > 0.03) {   // sub-frame: two rails on the chassis with crossmembers
    const sl = Math.max(0.2, xfs - xbR - 0.3), sw = Math.max(0.4, Math.min(floorW - 0.2, s.track - 0.3)), sx = (xbR + xfs) / 2, sy = (subY0 + subY1) / 2, sh = subY1 - subY0;
    for (const sz of [-1, 1]) F(box(sl, sh, 0.1, MAT.frame, sx, sy, sz * (sw / 2 - 0.05), body));
    const n = Math.max(1, Math.round(sl / 0.9));
    for (let k = 0; k <= n; k++) F(box(0.08, sh, sw - 0.2, MAT.frame, sx - sl / 2 + 0.04 + (sl - 0.08) * k / n, sy, 0, body));
    bom.deckFrame += 2 * sl + (n + 1) * sw;
  }
  const skirtHalf = Math.max(0.3, W / 2 - D + 0.03);
  const pY0 = s.tubeLift + 0.08, pH = deckY - slabT - pY0;
  if (pH > 0.05) {
    box(0.06, pH, skirtHalf * 2, MAT.frame, xbR + 0.03, pY0 + pH / 2, 0, body);
    if (s.power === 'generator') louver(body, xbR - 0.01, pY0 + pH * 0.5, 0, Math.min(0.9, skirtHalf * 1.2), pH * 0.6, 'x');
  }

  /* the vehicle itself */
  if (isCart) buildCartChassis(chassisG, s, C, fa, dh, cabFloor, seatY, driverX, xbR);
  else buildTruckChassis(chassisG, s, C, fa, dh, cabFloor, cabRoof, seatY, driverX, driverZ, xbR, hasCab, ladderAtSeat, conv && !hasCab);

  /* driver: seat position and steering are fixed by the chassis */
  const wc = new V3(driverX + C.steer.dx, seatY + C.steer.dy, driverZ);
  const tilt = T.MathUtils.degToRad(C.steer.tilt);
  const axis = new V3(-Math.cos(tilt), Math.sin(tilt), 0).normalize();
  const sw = mesh(new T.TorusGeometry(0.19, 0.022, 10, 40), MAT.leather, chassisG);
  sw.name = 'Steering wheel';
  sw.position.copy(wc); sw.quaternion.setFromUnitVectors(new V3(0, 0, 1), axis);
  rod(wc, wc.clone().addScaledVector(axis, -0.5), 0.022, MAT.rim, chassisG, false);
  const drv = mannequin('drive', skin());
  drv.position.set(driverX - 0.05, seatY, driverZ);
  ridersLow.add(drv);

  /* wheels */
  const wheels = [];
  for (const [ax, front] of [[fa, true], [ra, false]]) for (const sz of [-1, 1]) {
    const pivot = new T.Group(); pivot.position.set(ax, wr, sz * s.track / 2);
    const spin = new T.Group(); pivot.add(spin);
    const offs = C.dual && !front ? [-0.16, 0.16] : [0];
    for (const o of offs) {
      const tire = mesh(new T.CylinderGeometry(wr, wr, tireW, 36), MAT.rubber, spin); tire.rotation.x = Math.PI / 2; tire.position.z = o;
      const rim = mesh(new T.CylinderGeometry(wr * 0.58, wr * 0.58, tireW + 0.012, 24), MAT.rim, spin); rim.rotation.x = Math.PI / 2; rim.position.z = o;
      box(wr * 1.02, 0.06, tireW + 0.018, MAT.frame, 0, 0, o, spin);
      box(0.06, wr * 1.02, tireW + 0.018, MAT.frame, 0, 0, o, spin);
    }
    wheelsG.add(pivot);
    wheels.push({ pivot, spin, front });
  }

  /* tubes: sections on French cleats, split at steps (and at the wheels when the wheels stand taller than the tubes) */
  const tctx = { s, TB, nSides, tubeY, rad, xbF: edgeF, xbR: edgeR, txF, txR, ledOff, arches: archCut.filter((a) => !a.split).map((a) => a.zone), cutY, bom, F };
  for (const sgn of [-1, 1]) {
    const cz = sgn * (W / 2 - R);
    let chains = [[txR, txF]];
    steps.filter((t) => t.sgn === sgn).forEach((t) => {
      const a = Math.max(t.x - t.w / 2, xbR + 0.05), b = Math.min(t.x + t.w / 2, xbF - 0.05);
      if (b - a > 0.2) chains = intervalsMinus(chains, a, b);
    });
    archCut.filter((a) => a.split).forEach((a) => { chains = intervalsMinus(chains, a.zone.x0, a.zone.x1); });
    chains.forEach(([a, b]) => { if (b - a > 0.25) buildTubeChain(tubesG, a, b, cz, sgn, tctx); });
  }
  if (!hasCab && !isCart) {   // light covers that follow the engine's existing shapes, in the tube skin
    const mat = TB.skin ? { alu: MAT.tube, ply: MAT.ply, perf: MAT.perf, poly: MAT.glowSkin }[TB.skin] : MAT.perf;
    const cv = { mat, perf: mat === MAT.perf, bom, key: TB.skin ? { alu: 'alu', ply: 'plyBend', perf: 'perf', poly: 'poly' }[TB.skin] : 'perf' };
    const t = 0.03;   // clearance over the stock panels
    if (conv) {
      const hx1 = fa + C.ba - 0.18, hTop = cab.hoodTop + dh, hBot = 0.78 * (s.wheelDia / 0.8) + dh * 0.5, hw = cab.hoodW / 2;
      coverBox(tubesG, { ...cv, x0: cabFrontX - 0.05, x1: hx1 + 0.015, y0: hBot - t, y1: hTop + t, z0: -hw - t, z1: hw + t, back: cabFloor, front: false, leds: true });
      const fw = Math.max(0.12, (cab.width - cab.hoodW) / 2), fy = s.wheelDia + 0.08;
      for (const sz of [-1, 1]) {
        const zi = sz * (hw + t), zo = sz * (hw + fw + t);
        coverBox(tubesG, { ...cv, x0: fa - 0.55 - t, x1: fa + 0.55 + t, y0: fy - 0.11 - t, y1: fy + 0.11 + t, z0: Math.min(zi, zo), z1: Math.max(zi, zo), back: fy - 0.11 - t, front: true, inner: sz > 0 ? 'z0' : 'z1', leds: false });
      }
    }
    const dog = C.doghouse ? { x: cabFrontX - 0.4, l: 0.7, h: 0.36, w: 0.5, z: 0.02 } : !conv ? { x: cabFrontX - 0.95, l: 0.8, h: 0.42, w: 0.5, z: 0.05 } : null;
    if (dog) coverBox(tubesG, { ...cv, x0: dog.x - dog.l / 2 - t, x1: dog.x + dog.l / 2 + t, y0: cabFloor, y1: cabFloor + dog.h + t, z0: dog.z - dog.w / 2 - t, z1: dog.z + dog.w / 2 + t, back: cabFloor, front: true, leds: true });
  }

  for (const st of steps) {
    for (let i = 0; i < st.n; i++) {
      const top = st.rise * (i + 1);
      const zOut = W / 2 - i * st.run, zIn = W / 2 - (i + 1) * st.run;
      const y0 = Math.min(s.tubeLift * 0.6, top - 0.05);
      F(box(st.w - 0.08, top - y0, st.run, MAT.frame, st.x, (top + y0) / 2, st.sgn * (zOut + zIn) / 2, tubesG));
      box(st.w - 0.14, 0.018, 0.035, MAT.led, st.x, top - 0.012, st.sgn * (zOut - 0.02), tubesG, false);
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
    box(0.05, faceY1 - faceY0, z1 - z0, MAT.panel, xbF - 0.025, (faceY0 + faceY1) / 2, (z0 + z1) / 2, body);
    wallArea += (z1 - z0) * (faceY1 - faceY0);
  }

  /* back end: a low closed-off section with a lid that doubles as a counter */
  const REAR_H = 1.0;
  if (rearLen > 0) {
    for (const sgn of [-1, 1]) box(rearLen, REAR_H, 0.05, MAT.panel, (xbR + xrs) / 2, deckY + REAR_H / 2, sgn * (floorW / 2 - 0.03), body);
    box(0.05, REAR_H, floorW, MAT.panel, xbR + 0.025, deckY + REAR_H / 2, 0, body);
    box(0.05, REAR_H, floorW, MAT.panel, xrs, deckY + REAR_H / 2, 0, body);
    box(rearLen + 0.04, 0.04, floorW + 0.02, MAT.panel, (xbR + xrs) / 2, deckY + REAR_H + 0.02, 0, body);
    box(0.02, 0.02, floorW - 0.1, MAT.led, xrs + 0.035, deckY + REAR_H + 0.025, 0, body, false);
    wallArea += (2 * rearLen + 2 * floorW) * REAR_H + rearLen * floorW;
    if (s.power === 'generator') for (const sgn of [-1, 1]) louver(body, xbR + Math.min(0.4, rearLen / 2), deckY + 0.45, sgn * (floorW / 2 + 0.01), Math.min(0.5, rearLen - 0.1), 0.34, 'z');
  }
  bom.ply12 += wallArea;
  const daiquiriZ = ladderRear ? floorW / 4 : 0, daiquiriW = Math.min(1.35, floorW * 0.46);
  if (s.rearStyle === 'daiquiri' && rearLen > 0) buildDaiquiri(body, xbR, deckY + REAR_H + 0.04, floorW, daiquiriZ, roofBottom);

  /* canopy: posts, headers, roof frame, roof (solid or shade cloth), deck surface, lights */
  const pz = floorW / 2 - 0.04;
  const nPosts = clamp(Math.round(s.posts), 2, 9);
  const postXs = [];
  for (let i = 0; i < nPosts; i++) postXs.push(xbR + 0.06 + i * (xPostF - xbR - 0.06) / (nPosts - 1));
  let postCount = 0;
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
      F(box(0.08, s.headroom, 0.08, MAT.frame, x, deckY + s.headroom / 2, sgn * pz, roof));
      postCount++;
    }
    F(box(hEnd - xbR, 0.12, 0.08, MAT.frame, (xbR + hEnd) / 2, roofBottom - 0.06, sgn * pz, roof));
  }
  for (const x of [xbR + 0.06, hEnd - 0.06]) F(box(0.08, 0.12, floorW - 0.08, MAT.frame, x, roofBottom - 0.06, 0, roof));
  bom.post += postCount * s.headroom + 2 * (hEnd - xbR) + 2 * floorW;
  // roof frame: perimeter and joists every 2 ft
  const rfY = roofTop - 0.1;
  for (const sz of [-1, 1]) F(box(rLen, 0.06, 0.06, MAT.frame, rMid, rfY, sz * (roofW / 2 - 0.03), roof, false));
  const nJ = Math.max(1, Math.round(rLen / 0.6));
  for (let i = 0; i <= nJ; i++) F(box(0.06, 0.06, roofW - 0.06, MAT.frame, rx0 + 0.03 + (rLen - 0.06) * i / nJ, rfY, 0, roof, false));
  bom.roofFrame += 2 * rLen + (nJ + 1) * roofW;
  const holes = hatch ? [hatch] : [];
  const deckArea = s.roofDeck ? (dx1 - dx0) * roofW : 0;
  if (s.roofShade === 'solid') {
    slabs(rectMinus([rx0, rx1, -roofW / 2, roofW / 2], holes), roofTop, 0.14, MAT.frame, roof);
    bom.ply12 += rLen * roofW - deckArea;
  } else {
    if (s.roofDeck) slabs(rectMinus([dx0, dx1, -roofW / 2, roofW / 2], holes), roofTop, 0.14, MAT.frame, roof);
    const clothParts = s.roofDeck ? [[rx0, dx0], [dx1, rx1]] : [[rx0, rx1]];
    clothParts.forEach(([a, b]) => {
      if (b - a < 0.05) return;
      const pl = mesh(new T.PlaneGeometry(b - a, roofW), MAT.shade, roof, false);
      pl.rotation.x = -Math.PI / 2; pl.position.set((a + b) / 2, roofTop - 0.065, 0); pl.name = 'Shade cloth';
      bom.cloth += (b - a) * roofW;
    });
  }
  bom.ply34 += deckArea;
  for (const sgn of [-1, 1]) box(rLen - 0.02, 0.03, 0.012, MAT.led, rMid, roofBottom + 0.065, sgn * (roofW / 2 + 0.006), roof, false);
  for (const sx of [-1, 1]) box(0.012, 0.03, roofW - 0.02, MAT.led, rMid + sx * (rLen / 2 + 0.006), roofBottom + 0.065, 0, roof, false);
  // LED strip along the inside of the frame, and puck downlights
  for (const sgn of [-1, 1]) box(hEnd - xbR - 0.24, 0.022, 0.012, MAT.led, (xbR + hEnd) / 2, roofBottom - 0.07, sgn * (pz - 0.046), roof, false);
  for (const sx of [-1, 1]) box(0.012, 0.022, floorW - 0.24, MAT.led, (sx > 0 ? hEnd - 0.106 : xbR + 0.106), roofBottom - 0.07, 0, roof, false);
  const puckX0 = xbR + 0.5, puckX1 = hEnd - 0.5;
  const nP = Math.max(1, Math.round((puckX1 - puckX0) / 1.3));
  for (let i = 0; i <= nP; i++) for (const sz of [-1, 1]) {
    const pk = mesh(new T.CylinderGeometry(0.055, 0.055, 0.02, 20), MAT.puck, roof, false);
    pk.position.set(puckX0 + (puckX1 - puckX0) * i / nP, roofBottom - 0.01, sz * floorW / 4);
  }
  if (s.roofDeck) {
    slabs(rectMinus([dx0, dx1, -roofW / 2 + 0.01, roofW / 2 - 0.01], holes), roofTop + 0.03, 0.03, MAT.floor, roof);
    if (ladderRear && dR > 0.3) slabs([[rx0, dx0, zR - 0.46, zR + 0.46]], roofTop + 0.03, 0.03, MAT.floor, roof);
    if (hatch) {
      const [hx0, hx1, hz0, hz1] = hatch;
      box(hx1 - hx0, 0.08, 0.04, MAT.frame, (hx0 + hx1) / 2, roofTop + 0.07, hz0, roof);
      box(hx1 - hx0, 0.08, 0.04, MAT.frame, (hx0 + hx1) / 2, roofTop + 0.07, hz1, roof);
      for (const x of [hx0, hx1]) box(0.04, 0.08, hz1 - hz0, MAT.frame, x, roofTop + 0.07, (hz0 + hz1) / 2, roof);
    }
  }

  /* curtains: tied back at the lounge corners, or drawn closed along the lounge */
  if (s.curtains !== 'none' && loungeLen > 1) {
    const h = s.headroom - 0.14;
    if (s.curtainsDrawn) {
      const n = Math.max(1, Math.ceil(loungeLen / 1.6)), w = loungeLen / n;
      for (const sgn of [-1, 1]) for (let i = 0; i < n; i++) {
        const c = mesh(drawnCurtainGeometry(w - 0.02, h), MAT.curtain, roof);
        c.position.set(lx0 + i * w + 0.01, deckY + 0.02, sgn * (pz - 0.07));
      }
      if (!rearLen) {
        const c = mesh(drawnCurtainGeometry(2 * pz - 0.1, h), MAT.curtain, roof);
        c.position.set(xbR + 0.1, deckY + 0.02, -pz + 0.05); c.rotation.y = -Math.PI / 2;
      }
    } else {
      const cg = curtainGeometry(0.62, h);
      const ends = s.curtains === 'all' ? [[lx0 + 0.02, 0], [lx1 - 0.02, Math.PI]] : [[lx0 + 0.02, 0]];
      for (const [x, rot] of ends) for (const sgn of [-1, 1]) {
        const c = mesh(cg, MAT.curtain, roof);
        c.position.set(x, deckY + 0.02, sgn * (pz - 0.09));
        c.rotation.y = rot;
      }
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
    seatsLow += sofaRun(body, ridersLow, piece, deckY, depth, 'lounge', skin);
    seatRects.push(footprint(piece, depth));
  }
  if (lay === 'platform' && loungeLen > 0.6) {   // sit, lie and pile in: counted at about 4½ sq ft each
    const ph = Math.min(floorW / 2 - 0.05, tubeInnerAt(clamp(tubeY, deckY, deckY + 0.16)) - 0.03);
    rectMinus([lx0, lx1, -ph, ph], loungeRects).forEach(([a, b, c, d]) => {
      if (b - a > 0.2 && d - c > 0.2) rbox(b - a, 0.16, d - c, 0.06, MAT.fabric, (a + b) / 2, deckY + 0.08, (c + d) / 2, body);
    });
    for (const sgn of [-1, 1]) rbox(Math.max(0.3, loungeLen - 0.1), 0.24, 0.22, 0.1, sgn > 0 ? MAT.fabric : MAT.accent, (lx0 + lx1) / 2, deckY + 0.28, sgn * (ph - 0.11), body);
    const pts = packPoints(lx0 + 0.25, lx1 - 0.2, -ph + 0.25, ph - 0.25, 0.42 / 1.12, loungeRects, 0.1);
    pts.forEach(([x, z], n) => {
      const standUp = s.headroom >= 1.85 && n % 3 === 1;
      const m = standUp ? mannequin('stand', skin(), n) : mannequin('floor', skin());
      m.rotation.y = Math.abs(z) < 0.15 ? (n % 2 ? 0 : Math.PI) : z > 0 ? Math.PI / 2 : -Math.PI / 2;
      m.position.set(x, deckY + 0.16 + (standUp ? 0.8 : 0), z);
      if (standUp) m.userData.standing = true;
      ridersLow.add(m);
    });
    seatsLow += pts.length;
    seatRects.push([lx0, lx1, -ph, ph]);
  }
  spk.forEach((p) => buildSpeakerBox(p.hung ? tubesG : body, p, p.hung ? roofBottom - (p.out ? 0.06 : 0.04) - p.h : deckY));
  {
    let gx0 = lx0 + 0.05, gx1 = lx1 - 0.05, gz0 = -edge + 0.05, gz1 = edge - 0.05;
    if (lay === 'lshape') { gx0 = lx0 + depth; if (sideL < 0) gz0 = -edge + depth; else gz1 = edge - depth; }
    else if (retHalf > 0.28) {
      if (lay === 'ring') gx0 = lx0 + depth;
      if (lay === 'ring' || lay === 'ushape') gx1 = lx1 - depth;
      gz0 = -retHalf; gz1 = retHalf;
    }
    if (lay !== 'platform' && gx1 - gx0 > 0.3 && gz1 - gz0 > 0.3) {
      const rug = mesh(new T.PlaneGeometry(gx1 - gx0 - 0.08, gz1 - gz0 - 0.08), MAT.rug, body, false);
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
  const standLow = loungeLen > 0.8 && lay !== 'platform' && s.headroom >= 1.85 ? standGrid(lx0 + 0.1, lx1 - 0.1, -edge + 0.05, edge - 0.05, seatRects.concat(loungeRects), deckY, ridersLow, (lx0 + lx1) / 2) : 0;

  /* roof deck fittings: rails, seating, ladders, neon, projectors (removable for transport) */
  let seatsRoof = 0, standRoof = 0, railTop = roofTop, railRun = 0;
  if (s.roofDeck) {
    const dTop = roofTop + 0.03;
    railTop = dTop + s.railHeight;
    const railLine = (p0, p1, h = s.railHeight) => {
      const a = new V3(p0[0], dTop, p0[1]), b = new V3(p1[0], dTop, p1[1]);
      const len = a.distanceTo(b); if (len < 0.05) return;
      const n = Math.max(1, Math.ceil(len / 1.4));
      for (let i = 0; i <= n; i++) { const p = a.clone().lerp(b, i / n); F(box(0.045, h, 0.045, MAT.frame, p.x, dTop + h / 2, p.z, railsG)); }
      const alongX = Math.abs(p1[0] - p0[0]) > Math.abs(p1[1] - p0[1]);
      const bars = h > 0.6 ? [[h, 0.05], [h * 0.5, 0.035]] : [[h, 0.05]];
      for (const [yy, t] of bars) F(box(alongX ? len : t, t, alongX ? t : len, MAT.frame, (a.x + b.x) / 2, dTop + yy, (a.z + b.z) / 2, railsG));
      bom.rail += len * bars.length + (n + 1) * h;
      railRun += len;
    };
    railLine([X0, -rzE], [X1, -rzE]);
    railLine([X0, rzE], [X1, rzE]);
    railLine([X1, -rzE], [X1, rzE]);
    if (ladderRear) {
      railLine([X0, -rzE], [X0, zR - 0.36]); railLine([X0, zR + 0.36], [X0, rzE]);
      if (dR > 0.3) { railLine([rx0 + 0.06, zR - 0.46], [X0, zR - 0.46]); railLine([rx0 + 0.06, zR + 0.46], [X0, zR + 0.46]); }
    } else railLine([X0, -rzE], [X0, rzE]);

    const obstacles = [];
    if (hatch) obstacles.push([hatch[0] - 0.2, hatch[1] + 0.2, hatch[2] - 0.2, hatch[3] + 0.2]);
    if (ladderRear) obstacles.push([X0 - 0.1, X0 + 0.9, zR - 0.5, zR + 0.5]);
    const roofSeatRects = [];
    if (s.roofSeating === 'pillows') {
      const res = pillowSeats(railsG, ridersRoof, X0, X1, rzE, dTop, obstacles, skin);
      seatsRoof = res.n; roofSeatRects.push(...res.rects);
    } else if (s.roofSeating !== 'none') {
      const dd = clamp(1.05, 0.55, rzE - 0.4), back = rzE - 0.05, withFront = s.roofSeating === 'u';
      const rr = [];
      for (const sgn of [-1, 1]) rr.push({ axis: 'x', c: sgn * back, s0: X0 + 0.12, s1: X1 - 0.05, dir: -sgn, cornerLo: false, cornerHi: withFront, pillows: true });
      if (withFront && back - dd > 0.3) rr.push({ axis: 'z', c: X1 - 0.05, s0: -(back - dd), s1: back - dd, dir: -1, pillows: false });
      for (const r of rr) for (const piece of splitRun(r, dd, obstacles)) {
        seatsRoof += sofaRun(railsG, ridersRoof, piece, dTop, dd, 'daybed', skin);
        roofSeatRects.push(footprint(piece, dd));
      }
    }
    standRoof = standGrid(X0 + 0.15, X1 - 0.15, -rzE + 0.15, rzE - 0.15, roofSeatRects.concat(obstacles), dTop, ridersRoof, (X0 + X1) / 2);
    if (ladderRear) {
      const lxp = rx0 - 0.06, y0 = 0.22, y1 = dTop + Math.max(0.5, s.railHeight * 0.85);
      const g = group('Ladder'); railsG.add(g);
      for (const sz of [-1, 1]) F(box(0.05, y1 - y0, 0.05, MAT.rim, lxp, (y0 + y1) / 2, zR + sz * 0.25, g));
      for (let y = y0 + 0.25; y < roofTop - 0.05; y += 0.3) F(cylX(0.018, 0.5, MAT.rim, lxp, y, zR, g, 8)).rotation.set(Math.PI / 2, 0, 0);
    }
    if (lad) {
      const g = group('Ladder'); railsG.add(g);
      const topY = dTop + 0.95;
      const xAt = (y) => lad.cross + lad.dir * (roofBottom - y) / LADDER_TAN;
      for (const sz of [-1, 1]) F(rod(new V3(xAt(lad.yb), lad.yb, lad.zL + sz * 0.25), new V3(xAt(topY), topY, lad.zL + sz * 0.25), 0.026, MAT.rim, g, false, 8));
      for (let y = lad.yb + 0.28; y < roofTop; y += 0.3) F(rod(new V3(xAt(y), y, lad.zL - 0.25), new V3(xAt(y), y, lad.zL + 0.25), 0.018, MAT.rim, g, false, 8));
      const [hx0, hx1, hz0] = hatch;
      railLine([hx0 - 0.05, hz0 - 0.05], [hx1 + 0.05, hz0 - 0.05], Math.min(0.95, s.railHeight));
    }
    /* lightning bolt neon, hanging from the top of the front rail, facing forward */
    if (s.neon) {
      const h = clamp(s.neonSize, 0.2, s.railHeight - 0.03), w = h * 0.39;
      const topY = railTop - 0.035, xs = X1 + 0.055;
      const P = (u, v) => new V3(xs, topY - (1 - v) * h, (0.5 - u) * w);
      const g = group('Neon bolt'); railsG.add(g);
      const pts = BOLT.map(([u, v]) => P(u, v));
      const tr = Math.max(0.009, 0.016 * h / 0.8);
      pts.forEach((p, i) => {
        rod(p, pts[(i + 1) % pts.length], tr, MAT.neon, g, false, 8).castShadow = false;
        const j = mesh(new T.SphereGeometry(tr, 10, 8), MAT.neon, g, false); j.position.copy(p);
      });
      for (const u of [0.15, 0.6]) rod(new V3(xs, railTop, (0.5 - u) * w), P(u, 1), 0.005, MAT.rim, g, false, 6);
    }
    /* RGB projectors on the rail corners */
    for (const [x, sx] of [[X1, 1], [X0, -1]]) for (const sz of [-1, 1]) {
      const at = new V3(x, railTop + 0.06, sz * rzE);
      box(0.12, 0.09, 0.09, MAT.speaker, at.x, at.y, at.z, railsG);
      const dir = new V3(sx * 0.5, -0.78, sz * 0.5).normalize();
      const lens = mesh(new T.CylinderGeometry(0.035, 0.035, 0.02, 16), MAT.rgb, railsG, false);
      lens.position.copy(at).addScaledVector(dir, 0.07); lens.quaternion.setFromUnitVectors(new V3(0, 1, 0), dir);
      const hB = 2.8, beam = mesh(new T.ConeGeometry(0.6, hB, 20, 1, true), MAT.beam, railsG, false);
      beam.position.copy(at).addScaledVector(dir, hB / 2 + 0.06); beam.quaternion.setFromUnitVectors(new V3(0, -1, 0), dir);
      beam.name = 'Projector beam'; beam.userData.noBox = true;
    }
  }

  /* bikes, hung by the front wheel */
  let bikeCount = 0, bikesWanted = 0;
  const nb = clamp(Math.round(s.bikes), 1, 10);
  const yh = roofBottom - 0.08;
  const HANG = 0.87;
  const hang = (x, y, z, out, mat) => {
    const b = bikeModel(mat);
    const up = new V3(0, 1, 0), zz = new V3().crossVectors(up, out);
    b.quaternion.setFromRotationMatrix(new T.Matrix4().makeBasis(up, out, zz));
    b.position.set(x, y - HANG, z);
    extras.add(b); bikeCount++;
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
    use.forEach((z, i) => hang(xw, yh - (i % 2) * 0.22, z, new V3(-1, 0, 0), MAT.bike[i % MAT.bike.length]));
    if (use.length) {
      const z0 = use[0] - 0.2, z1 = use[use.length - 1] + 0.2;
      box(0.05, 0.05, z1 - z0, MAT.frame, xw + 0.02, yh + 0.03, (z0 + z1) / 2, extras);
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
      use.forEach((x, i) => hang(x, yh - (i % 2) * alt, zw, new V3(0, 0, sgn), MAT.bike[(i + (sgn > 0 ? 3 : 0)) % MAT.bike.length]));
      if (use.length) {
        const x0 = use[0] - 0.25, x1 = use[use.length - 1] + 0.25;
        box(x1 - x0, 0.05, 0.05, MAT.frame, (x0 + x1) / 2, yh + 0.03, zw, extras);
      }
    }
  }

  /* build weight from the bill of materials, kg */
  const kgSteel = bom.deckFrame * frameKgM + bom.post * 2.4 + bom.roofFrame * 2.0 + bom.rail * 1.6 + bom.hoop * 1.1 + bom.stairs * 9;
  const kgPly = (bom.ply34 + bom.ribPly) * 10.8 + bom.ply12 * 7.0 + bom.plyBend * 3.0;
  const kgSkins = bom.alu * 2.7 + bom.perf * 2.6 + bom.poly * 3.6 + bom.cloth * 0.3;
  const kg = {
    steel: kgSteel,
    plywood: kgPly,
    skins: kgSkins,
    cushions: seatsLow * 10 + seatsRoof * (s.roofSeating === 'pillows' ? 5 : 10) + (s.curtains !== 'none' ? 8 : 0),
    power: s.batteryKwh * 9 + 25 + (s.power === 'generator' ? 90 : 0),
    sound: s.speakers === 'tubes' ? 60 : s.speakers === 'corners' ? (isCart ? 52 : 74) : 120,
    extras: bikeCount * 15 + (s.rearStyle === 'daiquiri' && rearLen > 0 ? 90 : 0) + (s.roofDeck && s.neon ? 3 : 0) + (s.roofDeck ? 8 : 0),
    hardware: 0.06 * (kgSteel + kgPly + kgSkins),
  };
  const buildKg = Object.values(kg).reduce((a, b) => a + b, 0);
  const M = [];
  const add = (m, y) => { if (m > 0) M.push([m, y]); };
  const roofPly = deckArea * 10.8 + (s.roofShade === 'solid' ? Math.max(0, rLen * roofW - deckArea) * 7.0 : 0);
  add(bom.deckFrame * frameKgM + bom.deckArea * (lightDeck ? 7.0 : 10.8), deckY - 0.08);
  add(bom.post * 2.4, deckY + s.headroom / 2); add(wallArea * 7.0, deckY + 0.3);
  add(bom.roofFrame * 2.0 + roofPly + bom.cloth * 0.3, roofTop - 0.05);
  add(bom.rail * 1.6, roofTop + s.railHeight * 0.6);
  add(bom.hoop * 1.1 + bom.ribPly * 10.8 + bom.plyBend * 3.0 + kgSkins, tubeY);
  add(bom.stairs * 9, 0.4);
  add(seatsLow * 10, deckY + 0.2); add(kg.cushions - seatsLow * 10, roofTop + 0.15);
  add(kg.power, deckY - 0.25);
  add(kg.sound, s.speakers === 'corners' ? roofBottom - 0.35 : s.speakers === 'tubes' ? tubeY : deckY + 0.8);
  add(kg.extras, roofBottom - 0.6);
  const bm = M.reduce((a, [m]) => a + m, 0), by = M.reduce((a, [m, y]) => a + m * y, 0) / Math.max(1, bm);
  add(kg.hardware, by);
  add(C.curbLb / LB_PER_KG, (C.cgY || 0.5) + dh);
  add(RIDER_KG, seatY + 0.3);   // driver
  const payloadKg = C.payloadLb / LB_PER_KG;
  const cap = Math.max(0, Math.floor((payloadKg - buildKg) / RIDER_KG) - 1);
  const roofN = Math.min(seatsRoof + standRoof, cap), lowN = Math.min(seatsLow + standLow, cap - roofN);
  const roofY = seatsRoof + standRoof ? (seatsRoof * (roofTop + 0.6) + standRoof * (roofTop + 1.03)) / (seatsRoof + standRoof) : 0;
  const lowSeatY = lay === 'platform' ? deckY + 0.45 : deckY + 0.75;
  const lowY = seatsLow + standLow ? (seatsLow * lowSeatY + standLow * (deckY + 1.0)) / (seatsLow + standLow) : 0;
  add(roofN * RIDER_KG, roofY); add(lowN * RIDER_KG, lowY);
  const cgH = M.reduce((a, [m, y]) => a + m * y, 0) / M.reduce((a, [m]) => a + m, 0);
  const ssf = (s.track / 2) / cgH;
  const tip = { cgH, ssf, deg: T.MathUtils.radToDeg(Math.atan(ssf)), riders: roofN + lowN, margin: ssf / 0.127 };

  const cockpitCam = openFront
    ? { p: [driverX - 0.7, seatY + 1.1, driverZ * 0.55], t: [driverX + 4, seatY - 0.3, driverZ * 0.8] }
    : { p: [driverX + 0.02, Math.min(seatY + 0.8, cabRoof - 0.16), driverZ + 0.34], t: [driverX + 6, seatY + 0.1, driverZ + 0.15] };

  const info = {
    kind: C.kind, hasCab, openFront, deckY, floorY: deckY, W, D, bodyL, floorW, mid, roofL: rLen, roofW, roofBottom, roofTop, railTop,
    dx0, dx1, lx0, lx1, loungeLen, driverX, driverZ, seatY, cabRoof, cabWidth: cab.width,
    frontLen, frontMin, rearLen, seatsLow, seatsRoof, standLow, standRoof, depth, bikeCount, bikesWanted, buildKg, kg, bom,
    payloadKg: C.payloadLb / LB_PER_KG, curbKg: C.curbLb / LB_PER_KG,
    legroom: 2 * (edge - depth),
    rearOverhang: ra - xbR, rearMax: bodyLimits(s).rearMax, tubeRearOut: Math.max(0, xbR - txR),
    tip, riderCap: cap, lightDeck, cartFrame: isCart, deckFrontCapped: s.roofDeck && dx1 < dx1Want - 0.01,
    wheelR: wr, wheelbase: wb, cockpitCam,
    archInfo: archCut.map((a) => ({ front: a.zone.front, split: a.split, removed: a.removed, n: nSides })), pokeOut,
    roofDeckLen: s.roofDeck ? dx1 - dx0 : 0,
    neonH: s.roofDeck && s.neon ? clamp(s.neonSize, 0.2, s.railHeight - 0.03) : 0,
    railLow: s.roofDeck && roofTop >= DMV_DECK_HEIGHT && s.railHeight < DMV_RAIL_MIN - 1e-3,
    tooNarrow: hasCab && floorW < cab.width + 0.08,
  };
  return { group: root, parts: { body, tubesG, roof, railsG, ridersLow, ridersRoof, wheelsG, chassisG, extras }, wheels, info };
}

/* Big floor pillows with a lean-back bag, around the edge of the usable roof deck. */
function pillowSeats(parent, ridersParent, X0, X1, rzE, y, obstacles, skin) {
  const spots = [];
  const hit = (x, z) => obstacles.some((o) => x + 0.36 > o[0] && x - 0.36 < o[1] && z + 0.36 > o[2] && z - 0.36 < o[3]);
  const along = (a, b, pitch) => { const n = Math.max(0, Math.floor((b - a) / pitch)) + 1; const st = n > 1 ? (b - a) / (n - 1) : 0; return Array.from({ length: n }, (_, i) => (n > 1 ? a + i * st : (a + b) / 2)); };
  if (X1 - X0 > 0.8) for (const sgn of [-1, 1]) along(X0 + 0.45, X1 - 0.45, 0.82).forEach((x) => spots.push([x, sgn * (rzE - 0.56), -sgn, 'z']));
  if (2 * rzE - 1.7 > 0) for (const [x, d] of [[X1 - 0.56, -1], [X0 + 0.56, 1]]) {
    if (X1 - X0 < 1.8) continue;
    along(-rzE + 1.25, rzE - 1.25, 0.82).forEach((z) => spots.push([x, z, d, 'x']));
  }
  let n = 0;
  const rects = [];
  spots.forEach(([x, z, d, faceAxis], i) => {
    if (hit(x, z)) return;
    const g = new T.Group(); g.position.set(x, y, z);
    g.rotation.y = faceAxis === 'z' ? (d > 0 ? -Math.PI / 2 : Math.PI / 2) : (d > 0 ? 0 : Math.PI);
    parent.add(g);
    rbox(0.66, 0.24, 0.62, 0.1, MAT.fabric, 0.02, 0.12, 0, g);
    const bag = rbox(0.28, 0.52, 0.64, 0.13, i % 3 === 1 ? MAT.accent : MAT.fabric, -0.3, 0.32, 0, g); bag.rotation.z = 0.38;
    const m = mannequin('floor', skin());
    m.rotation.y = g.rotation.y;
    m.position.copy(g.position).add(new V3(-0.12, 0.24, 0).applyAxisAngle(new V3(0, 1, 0), g.rotation.y));
    ridersParent.add(m);
    rects.push([x - 0.45, x + 0.45, z - 0.45, z + 0.45]);
    n++;
  });
  return { n, rects };
}

/* ------------------------------------------------------------------ tube pieces */
function scaleUV(g, su, sv) {
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
  uv.needsUpdate = true;
}
/* Ring in the tube's cross-section plane covering angles p0..p1 (angle 0 points to +Z, π/2 up). Faceted when nSides > 0. */
function ringArc(r, tube, mat, x, y, z, parent, p0, p1, nSides, shadow = true) {
  const arc = p1 - p0; if (arc < 1e-3) return null;
  const n = nSides ? Math.max(1, Math.round(arc / (TAU / nSides))) : Math.max(8, Math.round(56 * arc / TAU));
  const m = mesh(new T.TorusGeometry(r, tube, 6, n, arc), mat, parent, shadow);
  m.position.set(x, y, z); m.rotation.set(0, Math.PI / 2, Math.PI - p1);
  return m;
}
/* Flat plywood rib: an annulus (or part of one) cut from sheet, `thick` along the tube. */
function finArc(rIn, rOut, p0, p1, nSides, thick, mat, x, y, z, parent) {
  const arc = p1 - p0; if (arc < 1e-3 || rOut - rIn < 1e-3) return null;
  const n = nSides ? Math.max(1, Math.round(arc / (TAU / nSides))) : Math.max(12, Math.round(64 * arc / TAU));
  const V = (r, a) => [r * Math.cos(a), r * Math.sin(a)];
  const shape = new T.Shape();
  if (arc >= TAU - 1e-4) {
    for (let i = 0; i < n; i++) { const [px, py] = V(rOut, p0 + i * arc / n); i ? shape.lineTo(px, py) : shape.moveTo(px, py); }
    shape.closePath();
    const hole = new T.Path();
    for (let i = 0; i < n; i++) { const [px, py] = V(rIn, p0 - i * arc / n); i ? hole.lineTo(px, py) : hole.moveTo(px, py); }
    hole.closePath(); shape.holes.push(hole);
  } else {
    for (let i = 0; i <= n; i++) { const [px, py] = V(rOut, p0 + i * arc / n); i ? shape.lineTo(px, py) : shape.moveTo(px, py); }
    for (let i = n; i >= 0; i--) { const [px, py] = V(rIn, p0 + i * arc / n); shape.lineTo(px, py); }
    shape.closePath();
  }
  const m = mesh(new T.ExtrudeGeometry(shape, { depth: thick, bevelEnabled: false, curveSegments: 1 }), mat, parent);
  m.rotation.y = -Math.PI / 2; m.position.set(x + thick / 2, y, z);
  return m;
}
/* Lengthwise plywood rib slotted into the rings; its outer edge follows the taper. */
function boardAlong(x0, r0, x1, r1, phi, dep, thick, mat, y, z, parent) {
  const g = new T.Group(); g.position.set((x0 + x1) / 2, y, z);
  g.rotation.x = Math.atan2(Math.cos(phi), Math.sin(phi));
  parent.add(g);
  const b = box(Math.hypot(x1 - x0, r1 - r0), dep, thick, mat, 0, (r0 + r1) / 2 - dep / 2, 0, g);
  b.rotation.z = Math.atan2(r1 - r0, x1 - x0);
  return b;
}

/* Faceted tubes sit on a flat face; round tubes are handled as 48 thin faces. */
function tubePhase(nSides) { return nSides ? -Math.PI / 2 + Math.PI / nSides : 0; }
/* Which faces of a tube survive over a wheel: a face goes when any point of it falls inside the wheel's swept box
   (steering lock, suspension travel and clearance included). Returns kept arcs as [from, to] angles, none if nothing survives. */
function keptArcs(r, cz, tubeY, zone, cutY, nSides) {
  const n = nSides || 48, step = TAU / n, ph = tubePhase(nSides);
  const zMin = cz > 0 ? zone.zIn : -zone.zOut, zMax = cz > 0 ? zone.zOut : -zone.zIn;
  const keep = [];
  for (let k = 0; k < n; k++) {
    const a0 = ph + k * step, c0 = Math.cos(a0), s0 = Math.sin(a0), c1 = Math.cos(a0 + step), s1 = Math.sin(a0 + step);
    let hit = false;
    for (let t = 0; t <= 10 && !hit; t++) {
      const z = cz + r * (c0 + (c1 - c0) * t / 10), y = tubeY + r * (s0 + (s1 - s0) * t / 10);
      hit = y < cutY && z > zMin && z < zMax;
    }
    keep.push(!hit);
  }
  if (keep.every(Boolean)) return [[ph, ph + TAU]];
  const start = keep.findIndex((k) => !k), arcs = [];
  let run = null;
  for (let i = 1; i <= n; i++) {
    if (keep[(start + i) % n]) { const a = ph + (start + i) * step; if (run) run[1] = a + step; else run = [a, a + step]; }
    else if (run) { arcs.push(run); run = null; }
  }
  if (run) arcs.push(run);
  return arcs;
}
/* Greedy packing of people at a given floor area each, avoiding blocked rectangles. */
function packPoints(x0, x1, z0, z1, area, blocked, pad = 0.14) {
  const p = Math.sqrt(area * 1.12), placed = [];
  for (let z = z0; z <= z1 + 1e-6; z += 0.08) for (let x = x0; x <= x1 + 1e-6; x += 0.08) {
    if (blocked.some((r) => x > r[0] - pad && x < r[1] + pad && z > r[2] - pad && z < r[3] + pad)) continue;
    if (placed.some(([px, pz]) => (px - x) ** 2 + (pz - z) ** 2 < p * p)) continue;
    placed.push([x, z]);
  }
  return placed;
}

function buildTubeChain(parent, a, b, cz, sgn, ctx) {
  const { s, TB, nSides, tubeY, rad, xbF, xbR, txF, txR, ledOff, arches, cutY, bom, F } = ctx;
  const step = nSides ? TAU / nSides : 0;
  const segs = nSides || 56;
  const phase = tubePhase(nSides), FULL = [phase, phase + TAU];
  const skinMat = TB.skin ? { alu: nSides ? MAT.tubeF : MAT.tube, ply: nSides ? MAT.plyF : MAT.ply, perf: nSides ? MAT.perfF : MAT.perf, poly: nSides ? MAT.glowSkinF : MAT.glowSkin }[TB.skin] : null;
  const bomSkin = { alu: 'alu', ply: 'plyBend', perf: 'perf', poly: 'poly' }[TB.skin];
  const archAt = (x) => arches.find((z) => x > z.x0 + 1e-6 && x < z.x1 - 1e-6);
  const snap = (lo, hi) => (nSides ? [phase + Math.ceil((lo - phase) / step - 1e-6) * step, phase + Math.floor((hi - phase) / step + 1e-6) * step] : [lo, hi]);
  const arcsAt = (r, zone) => (zone ? keptArcs(r, cz, tubeY, zone, cutY, nSides) : [FULL]);
  const inRange = (phi, [p0, p1]) => (((phi - p0) % TAU) + TAU) % TAU <= p1 - p0 + 1e-6;
  const intersect = ([a0, a1], [b0, b1]) => {
    for (const k of [-TAU, 0, TAU]) { const lo = Math.max(a0, b0 + k), hi = Math.min(a1, b1 + k); if (hi - lo > 1e-3) return snap(lo, hi); }
    return null;
  };
  const count = nSides || (TB.lengthwise ? Math.max(6, Math.round(s.ledLines)) : Math.round(s.ledLines));
  const angles = Array.from({ length: count }, (_, k) => phase + k * TAU / count);
  const ledOn = nSides ? true : s.ledLines > 0;
  const P = (x, rho, phi) => new V3(x, tubeY + rho * Math.sin(phi), cz + rho * Math.cos(phi));
  bom.tubeLen += b - a; bom.sections += Math.ceil((b - a) / 1.22 - 1e-6);

  const cutsArr = [a, b, xbR, xbF]; arches.forEach((z) => cutsArr.push(z.x0, z.x1));
  const cuts = [...new Set(cutsArr.filter((x) => x >= a && x <= b))].sort((p, q) => p - q);
  for (let i = 0; i < cuts.length - 1; i++) {
    const x0 = cuts[i], x1 = cuts[i + 1], len = x1 - x0;
    if (len < 1e-3) continue;
    const r0 = rad(x0), r1 = rad(x1), rm = (r0 + r1) / 2, xm = (x0 + x1) / 2;
    const arch = archAt(xm);
    const runs = arcsAt(rm, arch);
    if (!runs.length) continue;
    const kept = (phi) => runs.some((rg) => inRange(phi, rg));
    if (skinMat) {
      for (const [p0, p1] of runs) {
        const geo = new T.CylinderGeometry(r1, r0, len, segs, 1, true, -p1, p1 - p0);
        if (TB.skin === 'perf') scaleUV(geo, rm * (p1 - p0) / 0.045, len / 0.045);
        const m = mesh(geo, skinMat, parent); m.rotation.z = -Math.PI / 2; m.position.set(xm, tubeY, cz); m.name = 'Tube skin';
        bom[bomSkin] += len * rm * (p1 - p0);
        if (TB.skin === 'perf') {
          const mi = mesh(new T.CylinderGeometry(r1 * 0.9, r0 * 0.9, len, segs, 1, true, -p1, p1 - p0), MAT.glowInner, parent, false);
          mi.rotation.z = -Math.PI / 2; mi.position.set(xm, tubeY, cz);
        }
      }
      for (const phi of [Math.PI / 4, 3 * Math.PI / 4, 5 * Math.PI / 4, 7 * Math.PI / 4]) {
        if (arch && !kept(phi)) continue;
        F(rod(P(x0, r0 - 0.035, phi), P(x1, r1 - 0.035, phi), 0.012, TB.skin === 'ply' ? MAT.plyRib : MAT.frame, parent, false, 6)).castShadow = false;
        if (TB.skin === 'ply') bom.ribPly += len * 0.04; else bom.hoop += len;
      }
    }
    for (const phi of angles) {
      if (arch && !kept(phi)) continue;
      if (TB.lengthwise === 'ply') { F(boardAlong(x0, r0, x1, r1, phi, 0.08, 0.018, MAT.plyRib, tubeY, cz, parent)); bom.ribPly += len * 0.08; }
      else if (TB.lengthwise === 'steel') { F(rod(P(x0, r0, phi), P(x1, r1, phi), 0.016, MAT.frame, parent, false, 6)); bom.hoop += len; }
      if (ledOn) rod(P(x0, r0 + ledOff, phi), P(x1, r1 + ledOff, phi), 0.017, MAT.led, parent, false, 6).castShadow = false;
    }
  }

  /* ends: speaker, cap, or end rib */
  const openBuild = !TB.skin;
  const cageLen = Math.min(0.5, (b - a) * 0.22);
  for (const [x, dir, outer] of [[a, -1, Math.abs(a - txR) < 1e-6], [b, 1, Math.abs(b - txF) < 1e-6]]) {
    if (archAt(x - dir * 0.01)) continue;
    const r = rad(x);
    if (openBuild) F(finArc(r - 0.08, r, FULL[0], FULL[1], nSides, 0.018, TB.lengthwise === 'ply' ? MAT.plyRib : MAT.frame, x - dir * 0.013, tubeY, cz, parent));
    if (outer && s.speakers === 'tubes') {
      const face = mesh(new T.RingGeometry(r * 0.7, r * 1.005, segs, 1, dir > 0 ? Math.PI - phase : phase), openBuild ? MAT.speaker : skinMat, parent);
      face.rotation.y = dir * Math.PI / 2; face.position.set(x, tubeY, cz);
      const h = r * 0.36;
      const cone = mesh(new T.CylinderGeometry(r * 0.7, r * 0.22, h, 48, 1, true), MAT.speaker, parent);
      cone.rotation.z = -dir * Math.PI / 2; cone.position.set(x - dir * h / 2, tubeY, cz);
      cylX(r * 0.23, 0.02, MAT.speaker, x - dir * h, tubeY, cz, parent, 32).name = 'Speaker';
      const capS = mesh(new T.SphereGeometry(r * 0.15, 20, 12), MAT.speaker, parent);
      capS.scale.set(0.5, 1, 1); capS.position.set(x - dir * h * 0.92, tubeY, cz);
      ringArc(r * 0.86, 0.024, MAT.led, x + dir * 0.012, tubeY, cz, parent, FULL[0], FULL[1], nSides, false);
    } else if (!openBuild) {
      const disc = mesh(new T.CircleGeometry(r, segs, dir > 0 ? Math.PI - phase : phase), skinMat, parent);
      disc.rotation.y = dir * Math.PI / 2; disc.position.set(x, tubeY, cz);
      if (outer) ringArc(r * 0.86, 0.022, MAT.led, x + dir * 0.012, tubeY, cz, parent, FULL[0], FULL[1], nSides, false);
    }
    if (s.endCages && !openBuild) {
      const cageR = ledOff + 0.034;
      const ext = outer ? 0.07 : 0.015, x0 = x + dir * ext, x1 = x - dir * cageLen;
      for (const f of [0, 0.5, 1]) { const xx = x0 + (x1 - x0) * f; ringX(rad(clamp(xx, txR, txF)) + cageR, 0.021, MAT.frame, xx, tubeY, cz, parent, 48); }
      for (let k = 0; k < 12; k++) {
        const ang = (k + 0.5) * TAU / 12;
        const ra0 = rad(clamp(x0, txR, txF)) + cageR, ra1 = rad(x1) + cageR;
        rod(P(x0, ra0, ang), P(x1, ra1, ang), 0.016, MAT.frame, parent, false, 6);
      }
    }
  }

  /* rings: structure at every station, plus the chosen finish (under the LED lines) */
  const ribMat = { solid: MAT.ribSolid, second: MAT.ribSolid2, match: MAT.led }[s.ribStyle];
  const sp = Math.max(0.15, s.ribSpacing);
  const margin = TB.skin && s.endCages ? cageLen + 0.06 : 0.05;
  const origin = (xbF + xbR) / 2;
  const ARC = T.MathUtils.degToRad(200);
  const out = sgn > 0 ? [-ARC / 2, ARC / 2] : [Math.PI - ARC / 2, Math.PI + ARC / 2];
  for (let k = Math.ceil((a + margin - origin) / sp); origin + k * sp <= b - margin; k++) {
    const x = origin + k * sp;
    const r = rad(x), arch = archAt(x), inBody = x >= xbR - 1e-3 && x <= xbF + 1e-3;
    for (const full of arcsAt(r, arch)) {
      if (TB.hoop && TB.skin) { F(ringArc(r - 0.03, 0.013, MAT.frame, x, tubeY, cz, parent, full[0], full[1], nSides, false)); bom.hoop += (r - 0.03) * (full[1] - full[0]); }
      if (TB.lengthwise === 'steel') { F(ringArc(r, 0.018, MAT.frame, x, tubeY, cz, parent, full[0], full[1], nSides)); bom.hoop += r * (full[1] - full[0]); }
      let finOut = r;
      if (TB.ribs) {
        finOut = r + (TB.skin && s.ribStyle !== 'none' ? 0.03 : 0);
        const rIn = r - (TB.skin ? 0.09 : 0.08);
        F(finArc(rIn, finOut, full[0], full[1], nSides, 0.018, MAT.plyRib, x, tubeY, cz, parent));
        bom.ribPly += 0.5 * (finOut * finOut - rIn * rIn) * (full[1] - full[0]);
      }
      if (s.ribStyle === 'none') continue;
      const vis = TB.skin && TB.hoop && inBody ? intersect(out, full) : full;
      if (!vis) continue;
      if (TB.skin && TB.hoop) {
        const m = ringArc(r + 0.004, 0.02, ribMat || MAT.frame, x, tubeY, cz, parent, vis[0], vis[1], nSides, !ribMat);
        if (m) { m.scale.z = 1.6; m.name = 'Ring'; }
      } else if (ribMat) {
        ringArc((TB.ribs ? finOut : r) + (TB.lengthwise === 'steel' ? 0.03 : 0.006), 0.011, ribMat, x, tubeY, cz, parent, vis[0], vis[1], nSides, false);
      }
    }
  }
}

/* A thin cover over a box-shaped stock part: top, both sides, back and optionally front, in the tube skin.
   `back` is how low the back panel reaches (down to the floor at a firewall); `inner` skips the side that faces the hood. */
function coverBox(parent, o) {
  const panel = (w, h, x, y, z, rx, ry) => {
    const geo = new T.PlaneGeometry(w, h);
    if (o.perf) scaleUV(geo, w / 0.045, h / 0.045);
    const m = mesh(geo, o.mat, parent); m.rotation.set(rx, ry, 0); m.position.set(x, y, z); m.name = 'Engine cover';
    o.bom[o.key] += w * h;
  };
  const L = o.x1 - o.x0, Wd = o.z1 - o.z0, H = o.y1 - o.y0, xm = (o.x0 + o.x1) / 2, zm = (o.z0 + o.z1) / 2;
  panel(L, Wd, xm, o.y1, zm, -Math.PI / 2, 0);
  for (const zz of ['z0', 'z1']) if (o.inner !== zz) panel(L, H, xm, (o.y0 + o.y1) / 2, o[zz], 0, 0);
  const bh = o.y1 - o.back;
  panel(Wd, bh, o.x0, o.back + bh / 2, zm, 0, Math.PI / 2);
  if (o.front) panel(Wd, H, o.x1, (o.y0 + o.y1) / 2, zm, 0, Math.PI / 2);
  if (o.leds) for (const zz of [o.z0, o.z1]) box(L, 0.018, 0.018, MAT.led, xm, o.y1 + 0.009, zz, parent, false);
}

/* Louvered vent panel, facing along `axis` ('x' = on a face across the car, 'z' = on a side). */
function louver(parent, x, y, z, w, h, axis) {
  const g = group('Vent'); parent.add(g);
  const bx = axis === 'x' ? [0.02, h, w] : [w, h, 0.02];
  box(bx[0], bx[1], bx[2], MAT.vent, x, y, z, g, false);
  const n = Math.max(3, Math.round(h / 0.05));
  for (let i = 0; i < n; i++) {
    const yy = y - h / 2 + (i + 0.5) * h / n;
    const sl = axis === 'x' ? box(0.03, 0.012, w - 0.04, MAT.rim, x - 0.012, yy, z, g, false) : box(w - 0.04, 0.012, 0.03, MAT.rim, x, yy, z + Math.sign(z) * 0.012, g, false);
    sl.rotation[axis === 'x' ? 'z' : 'x'] = axis === 'x' ? 0.5 : -0.5 * Math.sign(z);
  }
}

/* Speaker box or tower standing in a lounge corner, drivers facing into the lounge. */
function buildSpeakerBox(parent, p, deckY) {
  const g = group('Speaker'); parent.add(g);
  const cone = (x, y, z, r) => {
    const c = mesh(new T.CylinderGeometry(r, r, 0.01, 28), MAT.grille, g); c.rotation.x = Math.PI / 2; c.position.set(x, y, z);
    const rim = mesh(new T.TorusGeometry(r, 0.01, 6, 28), MAT.rim, g, false); rim.position.set(x, y, z);
  };
  if (p.hung) {   // hung from the roof edge outside the posts, facing out and toed toward the front or back
    g.position.set(p.x, deckY, p.z); g.rotation.y = p.out ? Math.atan2(p.sx * 0.5, p.sgn) : Math.atan2(-p.sx * 0.4, -p.sgn);
    const dz = p.w * 0.8;
    box(p.w, p.h, dz, MAT.speaker, 0, p.h / 2, 0, g);
    box(0.05, 0.1, 0.05, MAT.rim, 0, p.h + 0.05, 0, g);
    (p.out ? [[0.36, 0.12], [0.8, 0.045]] : [[0.4, 0.075], [0.82, 0.03]]).forEach(([f, r]) => cone(0, p.h * f, dz / 2 + 0.006, r));
    return;
  }
  box(p.w, p.h, p.w, MAT.speaker, p.x, deckY + p.h / 2, p.z, g);
  const faceZ = p.z - p.sgn * (p.w / 2 + 0.004);
  const drivers = p.h > 1.2 ? [[0.25, 0.17], [0.58, 0.17], [0.86, 0.07]] : [[0.36, 0.17], [0.8, 0.07]];
  drivers.forEach(([f, r]) => cone(p.x, deckY + p.h * f, faceZ, r));
}

/* Frozen daiquiri machines on the lid of the low rear section, taps facing out the back, awning over them. */
function buildDaiquiri(parent, xbR, topY, floorW, zc, roofBottom) {
  const g = group('Daiquiri bar'); parent.add(g);
  const ww = Math.min(1.35, floorW * 0.46);
  box(0.24, 0.03, ww + 0.2, MAT.frame, xbR - 0.1, topY - 0.3, zc, g);   // drink shelf on the back face
  for (let i = 0; i < 3; i++) {
    const z = zc + (i - 1) * (ww / 3), x = xbR + 0.2;
    rbox(0.26, 0.3, 0.28, 0.03, MAT.rim, x, topY + 0.15, z, g);
    const bowl = mesh(new T.CylinderGeometry(0.115, 0.115, 0.36, 24), MAT.bowl, g, false); bowl.position.set(x, topY + 0.48, z);
    const sl = mesh(new T.CylinderGeometry(0.105, 0.105, 0.25, 20), MAT.slush[i], g); sl.position.set(x, topY + 0.425, z);
    cylX(0.02, 0.05, MAT.speaker, x - 0.155, topY + 0.2, z, g, 10);
  }
  const ang = -0.25, cx = xbR - 0.3, cy = roofBottom - 0.2;
  const aw = box(0.7, 0.03, ww + 0.34, MAT.accent, cx, cy, zc, g); aw.rotation.z = ang;
  box(0.03, 0.03, ww + 0.34, MAT.led, cx - 0.35 * Math.cos(ang), cy - 0.35 * Math.sin(ang) - 0.02, zc, g, false);
}

/* Bicycle, length along local X (front wheel at +X), wheels resting on y = 0. */
function bikeModel(mat) {
  const g = new T.Group(); g.name = 'Bike';
  const wr = 0.34, P = (x, y, z = 0) => new V3(x, y, z);
  for (const x of [-0.53, 0.53]) { const w = mesh(new T.TorusGeometry(wr, 0.028, 8, 36), MAT.rubber, g); w.position.set(x, wr, 0); }
  const bb = P(-0.03, 0.3), seat = P(-0.22, 0.88), head = P(0.36, 0.86), rearAx = P(-0.53, wr), frontAx = P(0.53, wr);
  [[bb, seat], [seat, head], [bb, head], [bb, rearAx], [seat, rearAx], [head, frontAx]].forEach(([p, q]) => rod(p, q, 0.021, mat, g, false, 6));
  rod(head, P(0.33, 1.02), 0.02, mat, g, false, 6);
  rod(P(0.31, 1.02, -0.3), P(0.31, 1.02, 0.3), 0.017, MAT.rim, g, false, 6);
  rbox(0.24, 0.05, 0.12, 0.02, MAT.leather, -0.24, 0.93, 0, g);
  return g;
}

/* Open utility vehicle (Bigfoot, MC-480): tub, front cowl with lights, two bucket seats. */
function buildCartChassis(g, s, C, fa, dh, cabFloor, seatY, driverX, xbR) {
  const bumper = fa + C.ba, rear = bumper - C.length;
  const y0 = 0.16, y1 = s.frameHeight - 0.02;
  box(C.length, y1 - y0, C.width - 0.1, MAT.cab, (bumper + rear) / 2, (y0 + y1) / 2, 0, g);
  rbox(0.5, 0.62, C.cab.width, 0.06, MAT.cab, bumper - 0.25, cabFloor + 0.31, 0, g);
  for (const sz of [-1, 1]) box(0.02, 0.08, 0.18, MAT.head, bumper + 0.005, cabFloor + 0.42, sz * C.cab.width * 0.34, g, false);
  box(0.25, 0.04, C.cab.width - 0.1, MAT.leather, bumper - 0.5, cabFloor + 0.64, 0, g);
  for (const sz of [-1, 1]) {
    rbox(0.48, 0.13, 0.46, 0.05, MAT.leather, driverX, seatY - 0.065, sz * Math.abs(C.seat.z), g);
    const b = rbox(0.1, 0.58, 0.44, 0.04, MAT.leather, driverX - 0.26, seatY + 0.26, sz * Math.abs(C.seat.z), g); b.rotation.z = 0.16;
    box(0.3, seatY - 0.13 - cabFloor, 0.3, MAT.frame, driverX, (seatY - 0.13 + cabFloor) / 2, sz * Math.abs(C.seat.z), g);
  }
}

/* Truck chassis. With the cab cut away (like the penguin), the factory dash, steering column, floor and driver's seat stay;
   conventional trucks keep the hood and fenders, the cab-over keeps its engine cover and gets a low front panel for the lights. */
function buildTruckChassis(g, s, C, fa, dh, cabFloor, cabRoof, seatY, driverX, driverZ, xbR, hasCab, noPassenger, shelled) {
  const cab = C.cab, conv = C.kind === 'conventional';
  const bumper = fa + C.ba, cb = fa + cab.back, cf = fa + cab.front, cw = cab.width;
  const belt = cabFloor + (conv ? 0.72 : 0.62), low = cabFloor - 0.3;
  const slant = conv ? 0.28 : 0.12;
  for (const sz of [-1, 1]) box(bumper - 0.2 - (xbR + 0.1), 0.26, 0.09, MAT.frame, (bumper - 0.2 + xbR + 0.1) / 2, s.frameHeight - 0.13, sz * 0.43, g);
  if (hasCab) box(0.22, 0.3, cw + 0.05, MAT.grille, bumper - 0.11, conv ? 0.62 + dh : low - 0.12, 0, g);   // no bumper once the cab is off
  if (hasCab) {
    rbox(cf - cb, belt - low, cw, 0.06, MAT.cab, (cb + cf) / 2, (belt + low) / 2, 0, g);
    const roofX0 = cb, roofX1 = cf - slant;
    rbox(roofX1 - roofX0, 0.1, cw, 0.04, MAT.cab, (roofX0 + roofX1) / 2, cabRoof - 0.05, 0, g);
    const wsH = cabRoof - 0.1 - belt, wsLen = Math.hypot(slant, wsH), wsAng = Math.atan2(slant, wsH);
    const ws = box(0.02, wsLen, cw - 0.12, MAT.glass, cf - slant / 2 - 0.02, belt + wsH / 2, 0, g, false); ws.rotation.z = wsAng;
    for (const sz of [-1, 1]) {
      const ap = box(0.07, wsLen, 0.07, MAT.cab, cf - slant / 2 - 0.02, belt + wsH / 2, sz * (cw / 2 - 0.035), g); ap.rotation.z = wsAng;
      box(0.09, cabRoof - belt, 0.07, MAT.cab, cb + 0.045, (cabRoof + belt) / 2, sz * (cw / 2 - 0.035), g);
      box(roofX1 - cb - 0.14, cabRoof - 0.12 - belt, 0.02, MAT.glass, (cb + 0.09 + roofX1 - 0.05) / 2, (cabRoof - 0.1 + belt) / 2, sz * (cw / 2 - 0.01), g, false);
    }
    box(0.02, cabRoof - 0.18 - belt, cw - 0.2, MAT.glass, cb + 0.01, (cabRoof - 0.12 + belt) / 2, 0, g, false);
    box(0.34, 0.38, cw - 0.16, MAT.leather, cf - (conv ? 0.36 : 0.3), belt - 0.12, 0, g);
  } else {
    if (conv) {
      if (!shelled) box(0.1, cab.hoodTop + dh + 0.06 - cabFloor, cw - 0.2, MAT.cab, cf + 0.05, (cab.hoodTop + dh + 0.06 + cabFloor) / 2, 0, g);   // cowl, the base of the old windshield
      if (C.doghouse) rbox(0.7, 0.36, 0.5, 0.08, MAT.cab, cf - 0.4, cabFloor + 0.18, 0.02, g);
    } else {
      const top = cabFloor + 0.42;
      box(0.08, top - low, cw - 0.1, MAT.cab, cf - 0.04, (top + low) / 2, 0, g);   // low front panel carrying the lights
      for (const sz of [-1, 1]) box(0.03, 0.12, 0.3, MAT.head, cf + 0.01, low + 0.15, sz * (cw / 2 - 0.3), g, false);
      rbox(0.8, 0.42, 0.5, 0.08, MAT.cab, cf - 0.95, cabFloor + 0.21, 0.05, g);   // engine cover between the seats
    }
    const dx = conv ? cf - 0.2 : cf - 0.32;
    const dy = conv ? Math.max(cabFloor + 0.62, cab.hoodTop + dh - 0.05) : cabFloor + 0.62;
    box(0.36, 0.24, cw - 0.28, MAT.leather, dx, dy, 0, g);   // factory dash
    box(0.2, Math.max(0.1, dy - 0.12 - cabFloor), cw - 0.5, MAT.leather, dx + 0.06, (dy - 0.12 + cabFloor) / 2, 0, g);
    rbox(0.14, 0.12, 0.36, 0.04, MAT.grille, dx - 0.12, dy + 0.1, driverZ, g);
  }
  for (const sz of [-1, 1]) {
    if (sz > 0 && noPassenger) continue;
    const z = sz > 0 ? Math.abs(driverZ) : driverZ;
    rbox(0.5, 0.14, 0.52, 0.05, MAT.leather, driverX, seatY - 0.07, z, g);
    const b = rbox(0.12, 0.72, 0.5, 0.05, MAT.leather, driverX - 0.28, seatY + 0.32, z, g); b.rotation.z = 0.14;
    if (!hasCab) box(0.34, seatY - 0.14 - cabFloor, 0.34, MAT.frame, driverX, (seatY - 0.14 + cabFloor) / 2, z, g);
  }
  if (conv) {
    const hx1 = bumper - 0.18, hLen = hx1 - cf, hTop = cab.hoodTop + dh, hBot = 0.78 * (s.wheelDia / 0.8) + dh * 0.5;
    rbox(hLen, hTop - hBot, cab.hoodW, 0.1, MAT.cab, (hx1 + cf) / 2, (hTop + hBot) / 2, 0, g);
    box(0.04, (hTop - hBot) * 0.8, cab.hoodW - 0.18, MAT.grille, hx1 + 0.01, hBot + (hTop - hBot) * 0.45, 0, g);
    for (const sz of [-1, 1]) {
      box(0.04, 0.12, 0.26, MAT.head, hx1 + 0.02, hBot + (hTop - hBot) * 0.62, sz * (cab.hoodW / 2 - 0.2), g, false);
      const fw = Math.max(0.12, (cw - cab.hoodW) / 2);
      rbox(1.1, 0.22, fw, 0.05, MAT.cab, fa, s.wheelDia + 0.08, sz * (cab.hoodW / 2 + fw / 2), g);
    }
  } else if (hasCab) {
    box(0.03, belt - low - 0.1, cw - 0.3, MAT.grille, cf + 0.005, (belt + low) / 2 - 0.05, 0, g);
    for (const sz of [-1, 1]) box(0.03, 0.12, 0.3, MAT.head, cf + 0.01, low + 0.15, sz * (cw / 2 - 0.3), g, false);
  }
}

function drawnCurtainGeometry(width, height) {
  const nu = Math.max(8, Math.round(width * 14)), nv = 6, pos = [], uv = [], idx = [];
  for (let j = 0; j <= nv; j++) {
    const v = j / nv;
    for (let i = 0; i <= nu; i++) {
      const u = i / nu;
      pos.push(u * width, v * height, (0.022 + 0.012 * (1 - v)) * Math.sin(u * width * Math.PI * 9));
      uv.push(u, v);
    }
  }
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
    const a = j * (nu + 1) + i, b = a + 1, c = a + nu + 1, d = c + 1;
    idx.push(a, b, d, a, d, c);
  }
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
function sofaRun(parent, ridersParent, run, baseY, depth, kind, skin) {
  let p0 = new V3(run.a[0], 0, run.a[1]), p1 = new V3(run.b[0], 0, run.b[1]);
  let cA = run.cornerA, cB = run.cornerB;
  let dir = p1.clone().sub(p0).normalize();
  if (-dir.z * run.inward[0] + dir.x * run.inward[1] < 0) { [p0, p1] = [p1, p0]; [cA, cB] = [cB, cA]; dir.negate(); }
  const len = p0.distanceTo(p1);
  const g = new T.Group();
  g.position.set(p0.x, baseY, p0.z);
  g.rotation.y = Math.atan2(-dir.z, dir.x);
  parent.add(g);

  const daybed = kind === 'daybed';
  const plinthH = daybed ? 0.1 : 0.16, cushH = daybed ? 0.18 : 0.2, backT = 0.2, backH = daybed ? 0.4 : 0.46;
  box(len, plinthH, depth - 0.02, MAT.plinth, len / 2, plinthH / 2, depth / 2, g);
  const n = Math.max(1, Math.round(len / (daybed ? 1.0 : 0.82)));
  const w = len / n;
  for (let i = 0; i < n; i++) {
    const cx = w * (i + 0.5);
    rbox(w - 0.025, cushH, depth - backT, 0.06, MAT.fabric, cx, plinthH + cushH / 2, backT + (depth - backT) / 2, g);
    const bc = rbox(w - 0.025, backH, backT, 0.07, MAT.fabric, cx, plinthH + cushH + backH / 2 - 0.02, backT / 2 + 0.01, g);
    bc.rotation.x = -0.12;
  }
  const seatTop = plinthH + cushH;
  if (run.pillows) {
    const ends = [[0.28, 1], [len - 0.28, -1]];
    ends.forEach(([px, sd], i) => {
      if (len < 0.9) return;
      const p = rbox(0.44, 0.42, 0.14, 0.06, i % 2 ? MAT.accent2 : MAT.accent, px, seatTop + 0.2, backT + 0.1, g);
      p.rotation.set(-0.3, sd * 0.25, sd * 0.12);
    });
    if (len > 3.2) {
      const p = rbox(0.42, 0.4, 0.13, 0.06, MAT.accent2, len * 0.5, seatTop + 0.19, backT + 0.1, g);
      p.rotation.set(-0.28, 0.1, -0.08);
    }
  }

  /* seats */
  const spacing = daybed ? 0.8 : 0.62;
  const o0 = cA ? depth + 0.08 : (run.pillows ? 0.46 : 0.34);
  const o1 = cB ? depth + 0.08 : (run.pillows ? 0.46 : 0.34);
  const usable = len - o0 - o1;
  let positions = [];
  if (usable >= 0) {
    const count = Math.floor(usable / spacing) + 1;
    const step = count > 1 ? usable / (count - 1) : 0;
    for (let i = 0; i < count; i++) positions.push(count > 1 ? o0 + i * step : o0 + usable / 2);
  } else if (len >= 0.58) positions = [len / 2];

  const hipZ = daybed ? 0.34 : 0.36;
  for (const px of positions) {
    const m = mannequin(daybed ? 'lounge' : 'seat', skin());
    const wp = p0.clone().addScaledVector(dir, px).add(new V3(run.inward[0] * hipZ, 0, run.inward[1] * hipZ));
    m.position.set(wp.x, baseY + seatTop, wp.z);
    m.rotation.y = g.rotation.y - Math.PI / 2;
    ridersParent.add(m);
  }
  return positions.length;
}

function disposeTree(obj) {
  obj.traverse((o) => { if (o.isMesh && o.geometry) o.geometry.dispose(); });
}
