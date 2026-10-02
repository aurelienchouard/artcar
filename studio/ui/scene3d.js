/* The 3D scene: renderer, sky, stars, playa, distant ranges, lights, bloom and the three moods (ported from v1). */
import { playaTexture, mulberry } from '../builders/materials.js';
const T = window.THREE;
const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
/* ------------------------------------------------------------------ renderer and scene */
const canvas = document.getElementById('gl');
const renderer = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = T.PCFSoftShadowMap;
renderer.toneMapping = T.ACESFilmicToneMapping;
renderer.outputColorSpace = T.SRGBColorSpace;

const scene = new T.Scene();
scene.fog = new T.FogExp2(0xd7dfe4, 0.0007);
const pmrem = new T.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new T.RoomEnvironment(), 0.04).texture;

const camera = new T.PerspectiveCamera(30, innerWidth / innerHeight, 0.05, 6000);
const controls = new T.OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 0.3;
controls.maxDistance = 90;
controls.maxPolarAngle = Math.PI * 0.495;

/* sky */
const skyU = {
  uTop: { value: new T.Color() }, uHorizon: { value: new T.Color() }, uGround: { value: new T.Color() },
  uSunDir: { value: new T.Vector3(0, 1, 0) }, uSunColor: { value: new T.Color() },
};
const sky = new T.Mesh(new T.SphereGeometry(3000, 48, 24), new T.ShaderMaterial({
  uniforms: skyU, side: T.BackSide, depthWrite: false, fog: false,
  vertexShader: `varying vec3 vDir;
    void main(){ vDir = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }`,
  fragmentShader: `uniform vec3 uTop; uniform vec3 uHorizon; uniform vec3 uGround; uniform vec3 uSunDir; uniform vec3 uSunColor;
    varying vec3 vDir;
    void main(){
      vec3 d = normalize(vDir); float h = d.y;
      vec3 c = mix(uHorizon, uTop, pow(clamp(h, 0.0, 1.0), 0.48));
      c = mix(c, uGround, smoothstep(0.0, -0.03, h));
      float s = max(dot(d, normalize(uSunDir)), 0.0);
      c += uSunColor * (pow(s, 1400.0) * 8.0 + pow(s, 14.0) * 0.28 + pow(s, 3.0) * 0.06);
      gl_FragColor = vec4(c, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
}));
sky.renderOrder = -10; sky.frustumCulled = false;
scene.add(sky);

/* stars */
const stars = (() => {
  const rnd = mulberry(11), pos = [];
  for (let i = 0; i < 1800; i++) {
    const y = 0.03 + Math.pow(rnd(), 0.8) * 0.97, a = rnd() * TAU, r = Math.sqrt(1 - y * y);
    pos.push(Math.cos(a) * r * 2800, y * 2800, Math.sin(a) * r * 2800);
  }
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
  const p = new T.Points(g, new T.PointsMaterial({ color: 0xffffff, size: 1.5, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.85, depthWrite: false }));
  p.frustumCulled = false; p.renderOrder = -9;
  scene.add(p);
  return p;
})();

/* playa */
const playaTex = playaTexture();
playaTex.repeat.set(8000 / 6, 8000 / 6);
playaTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
const groundMat = new T.MeshStandardMaterial({ map: playaTex, roughness: 1, metalness: 0 });
groundMat.onBeforeCompile = (sh) => {
  sh.vertexShader = sh.vertexShader
    .replace('#include <common>', '#include <common>\nvarying vec2 vGPos;')
    .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGPos = (modelMatrix * vec4(transformed, 1.0)).xz;');
  sh.fragmentShader = sh.fragmentShader
    .replace('#include <common>', `#include <common>
varying vec2 vGPos;
float gHash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float gNoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(gHash(i), gHash(i + vec2(1, 0)), f.x), mix(gHash(i + vec2(0, 1)), gHash(i + vec2(1, 1)), f.x), f.y); }`)
    .replace('#include <map_fragment>', `#include <map_fragment>
float gn = gNoise(vGPos * 0.035) * 0.6 + gNoise(vGPos * 0.21) * 0.3 + gNoise(vGPos * 1.3) * 0.1;
diffuseColor.rgb *= 0.9 + 0.16 * gn;`);
};
const ground = new T.Mesh(new T.PlaneGeometry(8000, 8000), groundMat);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

/* distant ranges */
function mountainRing(radius, minH, maxH, seed) {
  const rnd = mulberry(seed), N = 260, ph = [0, 0, 0, 0, 0].map(() => rnd() * TAU), pos = [], idx = [];
  for (let i = 0; i <= N; i++) {
    const a = i / N * TAU;
    let n = 0.5 + 0.26 * Math.sin(2 * a + ph[0]) + 0.16 * Math.sin(5 * a + ph[1]) + 0.1 * Math.sin(11 * a + ph[2]) + 0.05 * Math.sin(23 * a + ph[3]) + 0.03 * Math.sin(47 * a + ph[4]);
    n = Math.pow(clamp(n, 0, 1), 1.6);
    const r = radius * (1 + 0.07 * Math.sin(3 * a + ph[2]));
    const h = minH + (maxH - minH) * n;
    pos.push(Math.cos(a) * r, -12, Math.sin(a) * r, Math.cos(a) * r, h, Math.sin(a) * r);
    if (i < N) { const b = i * 2; idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); }
  }
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
  const m = new T.Mesh(g, new T.MeshBasicMaterial({ color: 0x8d99a8, fog: true, side: T.DoubleSide }));
  scene.add(m);
  return m;
}
const mtnNear = mountainRing(1150, 18, 115, 3);
const mtnFar = mountainRing(1750, 50, 230, 9);

/* lights */
const hemi = new T.HemisphereLight(0xffffff, 0xffffff, 1);
scene.add(hemi);
const sun = new T.DirectionalLight(0xffffff, 3);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12, near: 1, far: 100 });
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.03;
scene.add(sun, sun.target);
const sunDir = new T.Vector3(0, 1, 0);

/* car */
const carRoot = new T.Group(); carRoot.name = 'Car';
scene.add(carRoot);
const LAMP_BASE = [5, 5, 3];
const lamps = LAMP_BASE.map(() => { const l = new T.PointLight(0xffaa55, 0, 10, 2); carRoot.add(l); return l; });

/* post */
const rt = new T.WebGLRenderTarget(1, 1, { type: T.HalfFloatType, samples: 4 });
const composer = new T.EffectComposer(renderer, rt);
composer.addPass(new T.RenderPass(scene, camera));
const bloom = new T.UnrealBloomPass(new T.Vector2(256, 256), 0.3, 0.5, 0.95);
composer.addPass(bloom);
composer.addPass(new T.OutputPass());

/* ------------------------------------------------------------------ moods */
export const MOODS = {
  day: { top: '#5f90c2', horizon: '#cdd8e1', fog: '#d2d8dc', fogD: 0.0007, sunEl: 38, sunAz: -35, sunColor: '#fff0d8', sunI: 2.6,
    glow: '#fff3df', hemiSky: '#c9dbee', hemiGround: '#cdb996', hemiI: 0.8, env: 0.5, exposure: 0.85,
    bloom: [0.2, 0.35, 1.0], led: 1.7, lamps: 0, stars: false, mtn: ['#8f9cab', '#adb8c4'], label: '#1f232b' },
  dusk: { top: '#34456b', horizon: '#eda670', fog: '#d49d7b', fogD: 0.0008, sunEl: 5, sunAz: -150, sunColor: '#ffae6e', sunI: 2.4,
    glow: '#ffc58c', hemiSky: '#7887ae', hemiGround: '#7d5f4a', hemiI: 0.72, env: 0.3, exposure: 1.0,
    bloom: [0.6, 0.5, 0.85], led: 2.4, lamps: 0.45, stars: false, mtn: ['#5e4c60', '#8c6d74'], label: '#f3ede4' },
  night: { top: '#03060d', horizon: '#18213a', fog: '#121a2c', fogD: 0.0011, sunEl: 34, sunAz: 70, sunColor: '#9db2e4', sunI: 0.32,
    glow: '#3a4466', hemiSky: '#26314f', hemiGround: '#0e0c0a', hemiI: 0.32, env: 0.06, exposure: 1.15,
    bloom: [0.8, 0.5, 0.6], led: 2.6, lamps: 1, stars: true, mtn: ['#0b0f19', '#111827'], label: '#f3ede4' },
};
export function applyMood(name) {
  const m = MOODS[name] || MOODS.day;
  const mood = MOODS[name] ? name : 'day';
  const el = T.MathUtils.degToRad(m.sunEl), az = T.MathUtils.degToRad(m.sunAz);
  sunDir.set(Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az)).normalize();
  skyU.uTop.value.set(m.top); skyU.uHorizon.value.set(m.horizon); skyU.uGround.value.set(m.fog);
  skyU.uSunDir.value.copy(sunDir); skyU.uSunColor.value.set(m.glow);
  scene.fog.color.set(m.fog); scene.fog.density = m.fogD;
  sun.color.set(m.sunColor); sun.intensity = m.sunI;
  hemi.color.set(m.hemiSky); hemi.groundColor.set(m.hemiGround); hemi.intensity = m.hemiI;
  scene.environmentIntensity = m.env;
  renderer.toneMappingExposure = m.exposure;
  [bloom.strength, bloom.radius, bloom.threshold] = m.bloom;
  stars.visible = m.stars;
  mtnNear.material.color.set(m.mtn[0]); mtnFar.material.color.set(m.mtn[1]);
  document.body.dataset.mood = mood;
  return mood;
}


export { renderer, scene, camera, controls, composer, bloom, carRoot, lamps, LAMP_BASE, sun, sunDir, sky, stars };
