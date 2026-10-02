/* Materials, textures and the LED shader (ported from v1). */
const T = window.THREE;
const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
/* ------------------------------------------------------------------ textures */
export function playaTexture() {
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
export function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function hash2(x, y) { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); }

/* ------------------------------------------------------------------ materials */
export const LED_U = {
  uTime: { value: 0 }, uMode: { value: 0 }, uLevel: { value: 1 }, uLen: { value: 7 },
  uColorA: { value: new T.Color() }, uColorB: { value: new T.Color() }, uCarInv: { value: new T.Matrix4() },
};
export const LED_MODES = { solid: 0, breathe: 1, chase: 2, sunset: 3, sparkle: 4, off: 5 };
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

export const MAT = {};
export function makeMaterials() {
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
  MAT.chassis = std({ color: 0x8c9096, metalness: 0.45, roughness: 0.5 });   // the vehicle's own frame: lighter than the build's black steel
  MAT.trim = std({ color: 0x2a2b2e, roughness: 0.72, metalness: 0.05 });
  MAT.tint = std({ color: 0x27303c, metalness: 0.4, roughness: 0.08 });   // vehicle glass: opaque and dark so it reads as glass against the paint
  MAT.chrome = std({ color: 0xd8dade, metalness: 0.95, roughness: 0.18 });
  MAT.amber = std({ color: 0x7a4a08, emissive: 0xff9a1a, emissiveIntensity: 0.9 });
  MAT.grille = std({ color: 0x1a1b1d, metalness: 0.75, roughness: 0.32 });
  MAT.glass = std({ color: 0x1b2633, roughness: 0.05, metalness: 0.3, transparent: true, opacity: 0.4, depthWrite: false, side: T.DoubleSide });
  MAT.bowl = std({ color: 0xe6eef3, roughness: 0.05, transparent: true, opacity: 0.3, depthWrite: false });
  MAT.slush = ['#ff4d6d', '#8fe36b', '#ffb13b'].map((c) => std({ color: c, roughness: 0.55, emissive: c, emissiveIntensity: 0.35 }));
  MAT.bike = ['#e8463a', '#2fa6d8', '#f2c230', '#8c5cd6', '#39b56a', '#f07ab8'].map((c) => std({ color: c, metalness: 0.35, roughness: 0.45 }));
  MAT.skin = ['#7d6c5e', '#5f6f7c', '#9a7f64', '#667260', '#8b7f78', '#6d5a4c'].map((c) => std({ color: c, roughness: 0.85 }));
}
function shade(hex, f) { const c = new T.Color(hex); c.multiplyScalar(f); return c; }
export function updateMaterialColors(s) {
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

/* v2 additions: flat keys for the indexed v1 materials, and skins used by design kits. */
export function makeV2Materials() {
  const std = (o) => new T.MeshStandardMaterial(o);
  MAT.slush.forEach((m, i) => { MAT['slush' + i] = m; });
  MAT.bike.forEach((m, i) => { MAT['bike' + i] = m; });
  MAT.skin.forEach((m, i) => { MAT['skin' + i] = m; });
  MAT.acm = std({ metalness: 0.3, roughness: 0.45, side: T.DoubleSide, flatShading: true });
  MAT.coro = std({ metalness: 0, roughness: 0.7, side: T.DoubleSide, flatShading: true });
  MAT.eva = std({ metalness: 0, roughness: 0.95, side: T.DoubleSide });
  MAT.fabricGlow = std({ color: 0xf2ebe2, roughness: 0.95, emissive: 0xffffff, emissiveIntensity: 0.15, side: T.DoubleSide, transparent: true, opacity: 0.92 });
  MAT.hdpe = std({ color: 0xe8e6df, roughness: 0.6, emissive: 0xffffff, emissiveIntensity: 0.05 });
  MAT.overlay = new T.LineBasicMaterial({ color: 0xffd35a, depthTest: false, transparent: true });
  MAT.rayHit = new T.LineBasicMaterial({ color: 0xff5a4a, transparent: true, opacity: 0.85, depthTest: false });
  MAT.rayClear = new T.LineBasicMaterial({ color: 0x7ee0a1, transparent: true, opacity: 0.35, depthTest: false });
  MAT.trailer = std({ color: 0x3b3f46, metalness: 0.5, roughness: 0.5 });
  MAT.trailerDeck = std({ color: 0x6d5a45, metalness: 0.1, roughness: 0.85 });
  MAT.ghost = std({ color: 0x8fd3ff, transparent: true, opacity: 0.18, depthWrite: false, side: T.DoubleSide });
}
export function updateV2Colors(s) {
  MAT.acm.color.copy(shade(s.tubeColor, 1.25));
  MAT.coro.color.copy(shade(s.tubeColor, 1.5));
  MAT.eva.color.copy(shade(s.accentColor, 1.0));
  MAT.fabricGlow.emissive.set(s.ledColor);
}
export { shade };
