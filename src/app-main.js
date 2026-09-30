/* Art Car Studio — scene, views, UI. */
const $ = (sel) => document.querySelector(sel);
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const STORE_KEY = 'artcar-studio-v2';

let state = loadState();

/* ------------------------------------------------------------------ renderer and scene */
const canvas = $('#gl');
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
let dragging = false;

/* sky */
const skyU = {
  uTop: { value: new T.Color() }, uHorizon: { value: new T.Color() }, uGround: { value: new T.Color() },
  uSunDir: { value: new V3(0, 1, 0) }, uSunColor: { value: new T.Color() },
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
const sunDir = new V3(0, 1, 0);

/* car */
const carRoot = new T.Group(); carRoot.name = 'Car';
scene.add(carRoot);
const LAMP_BASE = [5, 5, 3];
const lamps = LAMP_BASE.map(() => { const l = new T.PointLight(0xffaa55, 0, 10, 2); carRoot.add(l); return l; });
const car = { model: null, parts: null, wheels: [], info: null, bbox: new T.Box3() };

/* post */
const rt = new T.WebGLRenderTarget(1, 1, { type: T.HalfFloatType, samples: 4 });
const composer = new T.EffectComposer(renderer, rt);
composer.addPass(new T.RenderPass(scene, camera));
const bloom = new T.UnrealBloomPass(new T.Vector2(256, 256), 0.3, 0.5, 0.95);
composer.addPass(bloom);
composer.addPass(new T.OutputPass());

/* ------------------------------------------------------------------ moods */
const MOODS = {
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
function applyMood(name) {
  const m = MOODS[name] || MOODS.day;
  state.mood = MOODS[name] ? name : 'day';
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
  document.body.dataset.mood = state.mood;
  document.querySelectorAll('#moodSeg button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mood === state.mood)));
}

/* ------------------------------------------------------------------ build / rebuild */
function rebuild() {
  if (car.model) { carRoot.remove(car.model); disposeTree(car.model); }
  const b = buildCar(state);
  b.group.updateMatrixWorld(true);
  car.bbox.makeEmpty();
  car.boxes = {};
  ['body', 'tubesG', 'roof', 'railsG', 'wheelsG', 'chassisG', 'extras'].forEach((k) => { car.boxes[k] = boxOf(b.parts[k]); car.bbox.union(car.boxes[k]); });
  car.model = b.group; car.parts = b.parts; car.wheels = b.wheels; car.info = b.info;
  carRoot.add(b.group);
  const i = b.info, sz = car.bbox.getSize(new V3());
  i.lengthMax = sz.x; i.widthMax = sz.z;
  const lc = (i.lx0 + i.lx1) / 2;
  lamps[0].position.set(lc + i.loungeLen / 4, i.roofBottom - 0.3, 0);
  lamps[1].position.set(lc - i.loungeLen / 4, i.roofBottom - 0.3, 0);
  lamps[2].position.set(i.mid, Math.min(0.9, i.floorY - 0.2), 0);
  applyVisibility();
  updateStats();
  updateViewButtons();
}
/* Precise bounds of a group, leaving out light beams and other effects. */
function boxOf(obj) {
  const bx = new T.Box3();
  obj.updateMatrixWorld(true);
  obj.traverse((o) => { if (o.isMesh && !o.userData.noBox) bx.expandByObject(o, true); });
  return bx;
}
function applyVisibility() {
  if (!car.parts) return;
  const fv = !!state.frameView;
  car.model.traverse((o) => { if (o.isMesh) o.visible = !fv || !!o.userData.frame; });
  if (fv) [car.parts.wheelsG, car.parts.chassisG].forEach((g) => g.traverse((o) => { if (o.isMesh) o.visible = true; }));
  const cut = state.hideRoof || currentView === 'top';
  const packed = state.transportPreview;
  const roofOff = packed && state.removeRoof, railsOff = roofOff || (packed && state.removeRails);
  car.parts.roof.visible = !cut && !roofOff;
  car.parts.railsG.visible = !cut && !railsOff;
  car.parts.tubesG.visible = !packed;
  car.parts.extras.visible = !packed && !fv;
  car.parts.ridersRoof.visible = !cut && !railsOff && state.riders && !packed && !fv;
  car.parts.ridersLow.visible = state.riders && !packed && !fv;
  const lp = currentView === 'lounge' ? car.info.lx0 + 0.25 : null;   // keep dancers from standing in the lounge camera
  car.parts.ridersLow.children.forEach((m) => { if (m.userData.standing) m.visible = lp === null || Math.hypot(m.position.x - lp, m.position.z) > 1.1; });
}
let rebuildQueued = false;
function scheduleRebuild() {
  if (rebuildQueued) return;
  rebuildQueued = true;
  requestAnimationFrame(() => { rebuildQueued = false; rebuild(); });
}

/* per-frame LED + lamp state */
function ledAverage(mode, t) {
  switch (mode) {
    case 'breathe': return 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(t * 1.7));
    case 'chase': return 0.45;
    case 'sparkle': return 0.4;
    case 'off': return 0;
    default: return 1;
  }
}
const tmpColor = new T.Color();
function updateFrameUniforms() {
  carRoot.updateMatrixWorld(true);
  LED_U.uCarInv.value.copy(carRoot.matrixWorld).invert();
  LED_U.uLen.value = state.length;
  const m = MOODS[state.mood];
  LED_U.uLevel.value = state.ledLevel * m.led;
  LED_U.uMode.value = LED_MODES[state.ledMode] ?? 0;
  LED_U.uColorA.value.set(state.ledColor);
  LED_U.uColorB.value.set(state.ledColor2);
  const k = ledAverage(state.ledMode, LED_U.uTime.value) * m.lamps * state.ledLevel;
  tmpColor.set(state.ledColor);
  if (state.ledMode === 'sunset') tmpColor.lerp(new T.Color(state.ledColor2), 0.5);
  lamps.forEach((l, idx) => { l.intensity = LAMP_BASE[idx] * k; l.color.copy(tmpColor); });
  const ribK = state.ledMode === 'off' ? 0 : LED_U.uLevel.value;
  MAT.ribSolid.emissiveIntensity = ribK; MAT.ribSolid2.emissiveIntensity = ribK;
  const night = m.lamps, t = LED_U.uTime.value;
  const glow = state.ledMode === 'off' ? 0 : state.ledLevel * (0.06 + 0.45 * night);
  MAT.glowSkin.emissiveIntensity = glow; MAT.glowSkinF.emissiveIntensity = glow; MAT.glowInner.emissiveIntensity = glow * 1.3;
  MAT.puck.emissiveIntensity = 0.15 + 2.2 * night;
  MAT.neon.emissiveIntensity = 0.7 + 2.6 * night;
  MAT.rgb.emissive.setHSL((t * 0.08) % 1, 1, 0.55); MAT.rgb.emissiveIntensity = 0.6 + 2 * night;
  MAT.beam.color.copy(MAT.rgb.emissive); MAT.beam.opacity = 0.055 * night;
}

/* ------------------------------------------------------------------ views */
const VIEWS = [
  { id: 'hero', label: 'Three-quarter', caption: 'Three-quarter view' },
  { id: 'top', label: 'Top', caption: 'Top view, roof cut away' },
  { id: 'front', label: 'Front', caption: 'Front view' },
  { id: 'rear', label: 'Rear', caption: 'Rear view' },
  { id: 'left', label: 'Driver side', caption: 'Left side view, driver side' },
  { id: 'right', label: 'Passenger side', caption: 'Right side view, passenger side' },
  { id: 'lounge', label: 'Lounge', caption: 'Inside the lower lounge' },
  { id: 'cockpit', label: 'Driver', caption: 'From the driver’s seat' },
  { id: 'roof', label: 'Roof deck', caption: 'On the roof deck' },
];
let currentView = 'hero';

/* A frame is the usable half-extent of the image in tangent space: { tv, th }. */
function frameFor(fov, aspect) { const tv = Math.tan(T.MathUtils.degToRad(fov) / 2); return { tv, th: tv * aspect }; }
function screenFrame(fov) {
  const w = innerWidth, h = innerHeight, P = panelOffset(), B = bottomOffset();
  const t = Math.tan(T.MathUtils.degToRad(fov) / 2);
  return { tv: t * (h - B) / (h + B), th: t * (w - P) / (h + B) };
}
function fitDist(hExt, vExt, fr, margin) {
  return Math.max((vExt / 2) * margin / fr.tv, (hExt / 2) * margin / fr.th);
}
function viewPose(id, fr) {
  const b = car.bbox, c = b.getCenter(new V3()), sz = b.getSize(new V3()), i = car.info;
  switch (id) {
    case 'top': { const d = fitDist(sz.x, sz.z, fr, 1.06); return { p: new V3(c.x, i.floorY + d, c.z - 0.001), t: new V3(c.x, i.floorY, c.z) }; }
    case 'front': { const d = fitDist(sz.z, sz.y, fr, 1.2); return { p: new V3(b.max.x + d, c.y, c.z), t: c.clone() }; }
    case 'rear': { const d = fitDist(sz.z, sz.y, fr, 1.2); return { p: new V3(b.min.x - d, c.y, c.z), t: c.clone() }; }
    case 'left': { const d = fitDist(sz.x, sz.y, fr, 1.18); return { p: new V3(c.x, c.y, b.min.z - d), t: c.clone() }; }
    case 'right': { const d = fitDist(sz.x, sz.y, fr, 1.18); return { p: new V3(c.x, c.y, b.max.z + d), t: c.clone() }; }
    case 'lounge': return { p: new V3(i.lx0 + 0.25, i.floorY + 1.5, 0), t: new V3(i.lx1 + 0.8, i.floorY + 0.55, 0) };
    case 'cockpit': return { p: new V3(...i.cockpitCam.p), t: new V3(...i.cockpitCam.t) };
    case 'roof': return { p: new V3(i.dx0 - 1.7, i.roofTop + 2.9, 0), t: new V3(i.dx1 + 0.2, i.roofTop + 0.1, 0) };
    case 'chase': return { p: new V3(-15, 5.2, -5.5), t: new V3(0.5, 1.6, 0) };
    default: {
      const t = c.clone(); t.y *= 0.9;
      const dir = new V3(0.95, 0.2, -0.82).normalize();
      const d = (sz.length() / 2) / Math.sin(Math.atan(Math.min(fr.tv, fr.th))) * 0.8;
      return { p: t.clone().addScaledVector(dir, d), t };
    }
  }
}
const toWorld = (v) => carRoot.localToWorld(v.clone());
const WIDE = new Set(['lounge', 'cockpit', 'roof']);
const lensFor = (id) => (WIDE.has(id) ? 55 : 30);

let tween = null;
function flyTo(p, t, instant, fov = camera.fov) {
  if (instant || reduceMotion) {
    camera.position.copy(p); controls.target.copy(t); camera.fov = fov; camera.updateProjectionMatrix(); controls.update(); tween = null; return;
  }
  const fromT = controls.target.clone();
  const fromO = new T.Spherical().setFromVector3(camera.position.clone().sub(fromT));
  const toO = new T.Spherical().setFromVector3(p.clone().sub(t));
  let dTheta = toO.theta - fromO.theta;
  dTheta = ((dTheta + Math.PI) % TAU + TAU) % TAU - Math.PI;
  tween = { fromT, toT: t.clone(), fromO, toO, dTheta, fromF: camera.fov, toF: fov, t0: performance.now(), dur: 900 };
}
function stepTween(now) {
  if (!tween) return;
  const k = clamp((now - tween.t0) / tween.dur, 0, 1);
  const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
  controls.target.lerpVectors(tween.fromT, tween.toT, e);
  const r = tween.fromO.radius * Math.pow(tween.toO.radius / Math.max(1e-4, tween.fromO.radius), e);
  const s = new T.Spherical(r, T.MathUtils.lerp(tween.fromO.phi, tween.toO.phi, e), tween.fromO.theta + tween.dTheta * e);
  camera.position.setFromSpherical(s).add(controls.target);
  if (tween.fromF !== tween.toF) { camera.fov = T.MathUtils.lerp(tween.fromF, tween.toF, e); camera.updateProjectionMatrix(); }
  if (k >= 1) tween = null;
}
let userMoved = false;
function setView(id, instant) {
  if (id === 'roof' && !state.roofDeck) return;
  currentView = id;
  userMoved = false;
  const fov = lensFor(id);
  const pose = viewPose(id, screenFrame(fov));
  flyTo(toWorld(pose.p), toWorld(pose.t), instant, fov);
  applyVisibility();
  updateCaption();
  updateViewButtons();
}
function updateCaption() {
  const v = VIEWS.find((x) => x.id === currentView);
  $('#captionTitle').textContent = v ? v.caption : 'Driving';
}
function buildViewButtons() {
  const wrap = $('#viewButtons');
  VIEWS.forEach((v, n) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'v'; b.dataset.view = v.id;
    b.innerHTML = `${v.label}<kbd>${n + 1}</kbd>`;
    b.addEventListener('click', () => setView(v.id));
    wrap.appendChild(b);
  });
}
function updateViewButtons() {
  document.querySelectorAll('#viewButtons .v').forEach((b) => {
    b.setAttribute('aria-pressed', String(b.dataset.view === currentView));
    if (b.dataset.view === 'roof') b.disabled = !state.roofDeck;
  });
}
controls.addEventListener('start', () => { dragging = true; tween = null; userMoved = true; });
controls.addEventListener('end', () => { dragging = false; });

/* ------------------------------------------------------------------ layout */
function panelOffset() {
  if (document.body.classList.contains('panel-hidden') || innerWidth <= 900) return 0;
  return $('#panel').offsetWidth + 28;
}
function bottomOffset() {
  const el = drive.on ? $('#hud') : $('.bottom-left');
  return el && el.offsetHeight ? el.offsetHeight + 18 : 0;
}
/* Shift the optical center so the car frames into the area not covered by the panel and bottom bars. */
function onResize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h);
  composer.setPixelRatio(renderer.getPixelRatio());
  composer.setSize(w, h);
  const P = panelOffset(), B = bottomOffset();
  if (P > 0 || B > 0) { camera.aspect = (w + P) / (h + B); camera.setViewOffset(w + P, h + B, P, B, w, h); }
  else { camera.clearViewOffset(); camera.aspect = w / h; }
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', () => {
  onResize();
  if (!userMoved && !drive.on && currentView !== 'chase') setView(currentView, true);
});

/* ------------------------------------------------------------------ panel UI */
const ctrls = {};
let uid = 0;
function buildPanel() {
  const root = $('#panelScroll');
  root.innerHTML = '';
  for (const sec of SECTIONS) {
    const det = document.createElement('details');
    if (sec.open) det.open = true;
    const sum = document.createElement('summary'); sum.textContent = sec.title;
    const body = document.createElement('div'); body.className = 'sec-body';
    det.append(sum, body);
    for (const f of sec.fields) body.appendChild(buildField(f));
    root.appendChild(det);
  }
}
function buildField(f) {
  if (f.type === 'info') {
    const wrap = document.createElement('div');
    const dl = document.createElement('dl'); dl.className = 'stats'; dl.id = f.id;
    wrap.appendChild(dl);
    if (f.note) { const p = document.createElement('p'); p.className = 'stats-note'; p.id = f.note; wrap.appendChild(p); }
    return wrap;
  }
  const row = document.createElement('div'); row.className = 'row';
  const id = 'f' + (++uid);
  const c = { f, row };
  if (f.type === 'range') {
    row.innerHTML = `<div class="row-head"><label for="${id}">${f.label}</label><output for="${id}"></output></div><input type="range" id="${id}" min="${f.min}" max="${f.max}" step="${f.step}">`;
    c.input = row.querySelector('input'); c.out = row.querySelector('output');
    c.input.addEventListener('input', () => setValue(f.k, parseFloat(c.input.value)));
  } else if (f.type === 'toggle') {
    row.classList.add('toggle');
    row.innerHTML = `<label for="${id}"><span>${f.label}</span><input type="checkbox" id="${id}"></label>`;
    c.input = row.querySelector('input');
    c.input.addEventListener('change', () => setValue(f.k, c.input.checked));
  } else if (f.type === 'select') {
    row.innerHTML = `<div class="row-head"><label for="${id}">${f.label}</label></div><select id="${id}">${f.options.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select>`;
    c.input = row.querySelector('select');
    c.input.addEventListener('change', () => setValue(f.k, c.input.value));
  } else if (f.type === 'seg') {
    row.innerHTML = `<div class="row-head"><span id="${id}">${f.label}</span></div><div class="seg ${f.cls || ''}" role="group" aria-labelledby="${id}">${f.options.map(([v, l]) => `<button type="button" data-v="${v}">${l}</button>`).join('')}</div>`;
    c.buttons = [...row.querySelectorAll('button')];
    c.buttons.forEach((b) => b.addEventListener('click', () => setValue(f.k, b.dataset.v)));
  } else if (f.type === 'color') {
    row.classList.add('color');
    row.innerHTML = `<label for="${id}"><span>${f.label}</span><input type="color" id="${id}"></label>`;
    c.input = row.querySelector('input');
    c.input.addEventListener('input', () => setValue(f.k, c.input.value));
  }
  ctrls[f.k] = c;
  return row;
}
function refreshField(k) {
  const c = ctrls[k]; if (!c) return;
  const v = state[k], f = c.f;
  if (f.type === 'range') {
    let atMax = false;
    if (f.lim) { const [mn, mx] = f.lim(state); c.input.min = mn; c.input.max = mx; atMax = v >= mx - 0.005; }
    if (parseFloat(c.input.value) !== v) c.input.value = v;
    c.out.textContent = fmtField(f, v, state.units) + (atMax ? ', chassis max' : '');
  }
  else if (f.type === 'toggle') c.input.checked = !!v;
  else if (f.type === 'select' || f.type === 'color') { if (c.input.value !== v) c.input.value = v; }
  else if (f.type === 'seg') c.buttons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === v)));
}
function refreshWhen() {
  for (const k of Object.keys(ctrls)) {
    const c = ctrls[k];
    const on = !c.f.when || c.f.when(state);
    c.row.classList.toggle('disabled', !on);
    c.row.setAttribute('aria-disabled', String(!on));
  }
}
function refreshControls() {
  Object.keys(ctrls).forEach(refreshField);
  refreshWhen();
  $('#designName').value = state.name;
}
function setLedCss() {
  const root = document.documentElement.style;
  root.setProperty('--led', state.ledColor);
  const c = new T.Color(state.ledColor);
  const lum = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;   // linear
  root.setProperty('--on-led', lum > 0.18 ? '#1d160c' : '#f7f2ea');
}
/* Keep body length, width and front inside what the chassis can carry. */
function enforceLimits() {
  for (const k of ['bodyFront', 'length', 'width']) {
    const [mn, mx] = FIELD[k].lim(state);
    state[k] = clamp(state[k], mn, mx);
    refreshField(k);
  }
}
function setValue(k, v) {
  if (k === 'chassis') { applyChassis(v); return; }
  const lf = FIELD[k];
  if (lf && lf.lim && typeof v === 'number') v = clamp(v, ...lf.lim(state));
  state[k] = v;
  if (['wheelbase', 'bodyFront', 'length', 'width'].includes(k)) enforceLimits();
  const f = FIELD[k];
  refreshField(k);
  refreshWhen();
  if (k === 'units') Object.keys(ctrls).forEach(refreshField);
  if (/[cC]olor/.test(k) || k === 'cabMatch') updateMaterialColors(state);
  if (k === 'ledColor') setLedCss();
  if (k === 'tubeBuild' && TUBE_BUILDS[v]) { state.ribSpacing = TUBE_BUILDS[v].spacing; refreshField('ribSpacing'); refreshWhen(); }
  if (['riders', 'hideRoof', 'transportPreview', 'removeRoof', 'removeRails', 'frameView'].includes(k)) applyVisibility();
  if (k === 'roofDeck') updateViewButtons();
  if (f && f.rebuild === false) updateStats(); else scheduleRebuild();
  persist();
}

function applyChassis(id) {
  if (!CHASSIS[id]) return;
  const keep = { trailer: state.trailer };
  Object.assign(state, chassisDefaults(id));
  if (keep.trailer !== 'drive' && CHASSIS[id].kind !== 'cart') state.trailer = 'drive';
  refreshControls();
  rebuild();
  persist();
  if (!drive.on) setView(currentView === 'chase' ? 'hero' : (currentView === 'roof' && !state.roofDeck ? 'hero' : currentView));
  toast(`Switched to the ${CHASSIS[id].short}. The body was resized to suit it.`);
}

/* stats */
function archText(arr) {
  if (!arr || !arr.length) return 'tubes clear the wheels';
  const part = (front) => {
    const a = arr.find((x) => x.front === front);
    if (!a) return null;
    const where = front ? 'front' : 'rear';
    if (a.split) return `${where}: split around the wheel`;
    return a.n ? `${where}: ${a.removed} of ${a.n} faces open` : `${where}: cut to clear`;
  };
  return [part(true), part(false)].filter(Boolean).join('; ');
}
function updateStats() {
  if (!car.info) return;
  const i = car.info, u = state.units, L = (m) => fmtLen(m, u), Wt = (kg) => fmtWeight(kg, u);
  const C = chassisOf(state);
  const row = ([a, b, bad]) => `<dt>${a}</dt><dd class="${bad ? 'over' : ''}">${b}</dd>`;

  /* chassis readout */
  const ci = $('#chassisInfo');
  if (ci) {
    const tuned = ['wheelbase', 'track', 'wheelDia', 'frameHeight'].some((k) => Math.abs(state[k] - C.spec[k]) > 0.005);
    ci.innerHTML = [
      ['Deck height', `${L(i.deckY)}, set by the chassis`],
      ['Payload rating', Wt(i.payloadKg)],
      ['Driver sits', `${C.cabLabel.toLowerCase()}, seat ${L(i.seatY)} up`],
      ['Specs', tuned ? `tuned from ${C.short}` : C.summary],
    ].map(row).join('');
  }

  /* effective values the model had to adjust */
  const fc = ctrls.frontLen;
  if (fc) fc.out.textContent = fmtLen(i.frontLen, u) + (i.frontLen > state.frontLen + 0.01 ? (i.hasCab ? ', cab minimum' : ', seat minimum') : '');
  const rc = ctrls.rearLen;
  if (rc && state.rearStyle !== 'none') rc.out.textContent = fmtLen(i.rearLen, u) + (i.rearLen < state.rearLen - 0.01 ? ', limited by length' : '');
  const nc = ctrls.neonSize;
  if (nc && i.neonH) nc.out.textContent = fmtLen(i.neonH, u) + (i.neonH < state.neonSize - 0.01 ? ', capped by the rail' : '');
  const dfc = ctrls.roofDeckFront;
  if (dfc && state.roofDeck) dfc.out.textContent = fmtLen(state.roofDeckFront, u) + (i.deckFrontCapped ? ', more over the driver' : '');

  /* weight and riders */
  const dl = $('#stats');
  const seats = i.seatsLow + i.seatsRoof, standing = i.standLow + i.standRoof, room = seats + standing;
  const riders = Math.min(room, i.riderCap), capped = riders < room;   // payload decides when it runs out before space does
  const riderKg = (riders + 1) * RIDER_KG;
  const margin = i.payloadKg - i.buildKg - riderKg;
  const wb = i.wheelbase;
  const rows = [
    ['Riders', (riders >= state.riderTarget ? `${riders}, meets ${state.riderTarget}` : `${riders}, ${state.riderTarget - riders} short of ${state.riderTarget}`) + (capped ? `; payload-limited, room for ${room}` : ''), riders < state.riderTarget],
    [state.layout === 'platform' ? 'On the platform' : 'Seated below', `${i.seatsLow} plus driver`],
    ['On the roof', state.roofDeck ? `${i.seatsRoof} seated on ${L(i.roofDeckLen)} of deck` : 'no roof deck'],
  ];
  if (state.standing !== 'none') rows.push(['Standing', `${i.standLow} below, ${i.standRoof} on the roof`]);
  rows.push(
    ['Payload rating', Wt(i.payloadKg)],
    ['Build, rough', Wt(i.buildKg)],
    ['People', `${Wt(riderKg)} for ${riders + 1}`],
    ['Left over', margin >= 0 ? Wt(margin) : `${Wt(-margin)} over`, margin < 0],
    ['Rear overhang', `${L(i.rearOverhang)}, ${Math.round(i.rearOverhang / wb * 100)}% of wheelbase, limit ${L(i.rearMax)}${i.tubeRearOut > 0.01 ? `; tubes ${L(i.tubeRearOut)} more` : ''}`, i.rearOverhang > i.rearMax + 0.01],
    ['Wheel arches', archText(i.archInfo)],
    ['Steering', i.pokeOut ? 'front tires stick out past the tubes at full lock' : 'front wheels clear at full lock', i.pokeOut],
    ['Knee room', i.legroom > 0 ? (i.legroom < 0.45 ? `${L(i.legroom)}, tight` : L(i.legroom)) : 'n/a', i.legroom > 0 && i.legroom < 0.45],
    [state.headroom >= 1.85 ? 'Standing headroom' : 'Headroom below', state.headroom >= 1.85 ? L(state.headroom) : `${L(state.headroom)}, sit and lie below`],
    ['Tipping, loaded', `center of gravity ${L(i.tip.cgH)} up; tips at ${i.tip.ssf.toFixed(2)} g sideways or a ${Math.round(i.tip.deg)}° slope, ${i.tip.margin.toFixed(1)}× a tight 5 mph turn`, i.tip.ssf < 0.45],
  );
  if (state.roofDeck) rows.push(['Roof rails', i.railLow ? `${L(state.railHeight)}, below the DMV's 36″` : `${L(state.railHeight)}, meets the DMV's 36″`, i.railLow]);
  if (i.bikesWanted) rows.push(['Bikes carried', i.bikeCount < i.bikesWanted ? `${i.bikeCount} of ${i.bikesWanted}, no room for more` : `${i.bikeCount}`, i.bikeCount < i.bikesWanted]);
  if (i.tooNarrow) rows.push(['Cab fit', 'body is narrower than the cab', true]);
  if (dl) dl.innerHTML = rows.map(row).join('');
  const sn = $('#statsNote');
  if (sn) sn.textContent = `Payload is the chassis maker's rating. The build weight adds up the cut list below plus cushions, power, sound and extras; treat it as ±30% and weigh the real thing. People count at ${Wt(RIDER_KG)} each, driver included. Stiffer springs help the ride but don't raise the rating. When payload runs out before space does, the rider count stops at what the payload allows. Body length is limited per chassis: rear overhang up to 60% of the wheelbase on trucks and 70% on carts (or the vehicle's own plus 6″), and the body can grow about 1.6′ past the vehicle on each side. Tubes lose only the faces a tire reaches at 35° of steering lock plus suspension travel, and split only when nothing would be left. The tipping line is a rough static estimate with the roof filled first: it compares the track to a loaded center of gravity built from the chassis, the cut list and 175 lb riders, ignoring suspension roll and soft tires. I flag it under 0.45 g, my own rule of thumb rather than a standard; ruts and a wheel dropping into a hole eat into the margin fast. The DMV's 2024 handbook asks for 36–48″ guardrails on any deck 84″ or more above the playa.`;

  /* frame and cut list */
  const cl = $('#cutList');
  if (cl && i.bom) {
    const b = i.bom, ft = (m) => `${Math.round(m * 3.281).toLocaleString('en-US')} ft`;
    const sheets = (m2, waste) => Math.ceil(m2 * (1 + waste) / 2.973);
    const cut = [
      [i.cartFrame ? '1½″ square tube, 14 ga' : '2″ square tube, 14 ga', `${ft(b.deckFrame)} for the deck frame and sub-frame`],
      ['1½″ square tube, 14 ga', `${ft(b.post)} for posts, headers and storage`],
      ['1½″ square tube, 16 ga', `${ft(b.roofFrame)} for the roof frame`],
    ];
    if (b.rail) cut.push(['1¼″ tube, rails', ft(b.rail)]);
    if (b.hoop) cut.push(['1″ square tube, 16 ga', `${ft(b.hoop)} for tube hoops and stringers`]);
    if (b.stairs) cut.push(['Stair treads', `${b.stairs}`]);
    cut.push(['¾″ plywood', `${sheets(b.ply34, 0.1) + sheets(b.ribPly, 0.45)} sheets${b.ribPly ? `, ${sheets(b.ribPly, 0.45)} of them for tube ribs` : ''}`]);
    if (b.ply12) cut.push(['½″ plywood', `${sheets(b.ply12, 0.1)} sheets for ${i.lightDeck ? 'the platform, ' : ''}walls and roof`]);
    if (b.plyBend) cut.push(['¼″ bending plywood', `${sheets(b.plyBend, 0.15)} sheets for tube skin`]);
    if (b.alu) cut.push(['Aluminum sheet, 1 mm', `${sheets(b.alu, 0.15)} sheets`]);
    if (b.perf) cut.push(['Perforated aluminum', `${sheets(b.perf, 0.15)} sheets`]);
    if (b.poly) cut.push(['White polycarbonate, 3 mm', `${sheets(b.poly, 0.15)} sheets`]);
    if (b.cloth) cut.push(['Shade cloth', `${Math.round(b.cloth * 10.764)} sq ft`]);
    cut.push(['Tube sections', `${b.sections} on French cleats, about 4′ each`]);
    cut.push(['Frame and panels', Wt(i.kg.steel + i.kg.plywood + i.kg.skins + i.kg.hardware)]);
    cl.innerHTML = cut.map(row).join('');
    const cn = $('#cutNote');
    if (cn) cn.textContent = 'Rough quantities for planning and pricing, counted from the model: 4 × 8 ft sheets with waste allowed for, circular ribs nesting worst. Steel sizes are typical choices, not an engineered spec.';
  }

  /* transport: tubes always come off; bikes and riders don't travel on the car */
  const ti = $('#transportInfo');
  if (!ti || !car.boxes) return;
  const vb = new T.Box3();
  ['body', 'tubesG', 'roof', 'railsG', 'wheelsG', 'chassisG'].forEach((k) => vb.union(car.boxes[k]));
  const full = vb.getSize(new V3()), withBikes = car.bbox.getSize(new V3());
  const pk = new T.Box3();
  ['body', 'wheelsG', 'chassisG'].forEach((k) => pk.union(car.boxes[k]));
  if (!state.removeRoof) { pk.union(car.boxes.roof); if (!state.removeRails) pk.union(car.boxes.railsG); }
  const ps = pk.getSize(new V3()), packH = pk.max.y;
  const vehKg = i.curbKg + i.buildKg;
  const dmvLarge = full.x >= DMV_LONG - 1e-3 || full.z >= DMV_WIDE - 1e-3;
  const roadOk = C.kind !== 'cart' && i.hasCab;
  const fits = (id) => {
    const tr = TRAILERS[id];
    if (id === 'drive' && !roadOk) return false;
    return ps.z <= LIMIT_W + 1e-3 && tr.deck + packH <= LIMIT_H + 1e-3 && ps.x <= tr.len + 1e-3 && vehKg * LB_PER_KG <= tr.maxLb;
  };
  const SHORT = { drive: 'driving it', equipment: '20′ equipment trailer', rollback: 'tow truck tilt bed', lowboy: 'lowboy', stepdeck: 'step deck', flatbed: '48′ flatbed' };
  const tr = TRAILERS[state.trailer] || TRAILERS.drive;
  const haul = tr.deck + packH;
  const trows = [
    ['On the playa', `${L(full.x)} × ${L(full.z)} × ${L(full.y)} tall`],
    ...(i.bikeCount ? [['With bikes', `${L(withBikes.x)} × ${L(withBikes.z)}`]] : []),
    ['DMV size class', dmvLarge ? `playa only, limited city use (${full.x >= DMV_LONG - 1e-3 ? '25′ or longer' : '13′ or wider'})` : 'regular, under 25′ and 13′', dmvLarge],
    ['Packed', `${L(ps.x)} × ${L(ps.z)} × ${L(packH)} tall, tubes off`],
    ['Packed width', ps.z > LIMIT_W + 1e-3 ? `${L(ps.z)}, ${L(ps.z - LIMIT_W)} over 8′ 6″` : `${L(ps.z)}, fits 8′ 6″`, ps.z > LIMIT_W + 1e-3],
    ['Vehicle weight', `${Wt(vehKg)} empty, chassis plus build`],
  ];
  if (state.trailer === 'drive' && C.kind === 'cart') trows.push(['On the road', `not road legal, the ${C.short} is a low-speed vehicle`, true]);
  else if (state.trailer === 'drive' && !i.hasCab) trows.push(['On the road', 'cab and windshield removed, plan to haul it; rules vary by state', true]);
  else {
    trows.push([state.trailer === 'drive' ? 'Road height' : 'Hauled height', haul > LIMIT_H + 1e-3 ? `${L(haul)}, ${L(haul - LIMIT_H)} over 13′ 6″` : `${L(haul)}, fits 13′ 6″`, haul > LIMIT_H + 1e-3]);
    if (Number.isFinite(tr.len)) trows.push(['Deck length', ps.x > tr.len + 1e-3 ? `${L(ps.x)} on ${L(tr.len)}, ${L(ps.x - tr.len)} too long` : `${L(ps.x)} on ${L(tr.len)}, fits`, ps.x > tr.len + 1e-3]);
    if (Number.isFinite(tr.maxLb)) trows.push(['Deck rating', vehKg * LB_PER_KG > tr.maxLb ? `${Wt(vehKg)} on a ${Wt(tr.maxLb / LB_PER_KG)} rating, too heavy` : `${Wt(vehKg)} on a ${Wt(tr.maxLb / LB_PER_KG)} rating, fits`, vehKg * LB_PER_KG > tr.maxLb]);
  }
  const ok = Object.keys(TRAILERS).filter(fits).map((id) => SHORT[id]);
  trows.push(['Fits', ok.length ? ok.join(', ') : 'nothing yet, try removing more parts', !ok.length]);
  ti.innerHTML = trows.map(row).join('');
  const tn = $('#transportNote');
  if (tn) tn.textContent = 'Tubes come off in sections on French cleats, so packed size always leaves them off, along with bikes, riders and whatever else you mark as removable. Checks use common US road limits of 8′ 6″ wide and 13′ 6″ tall, measured from the road with the car on the trailer; some western states allow 14′, beyond that you need an oversize permit. Trailer deck heights, lengths and ratings are typical figures; the tow truck deck height is an estimate. The DMV licenses cars 25′ or longer, or 13′ or wider, as playa only with limited city use.';
}

/* ------------------------------------------------------------------ files */
const slug = () => (state.name || 'art-car').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'art-car';
function dataUrlToBlob(url) {
  const [head, b64] = url.split(',');
  const mime = head.match(/:(.*?);/)[1];
  const bin = atob(b64), arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}
function download(blobOrUrl, name) {
  const blob = typeof blobOrUrl === 'string' ? dataUrlToBlob(blobOrUrl) : blobOrUrl;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
let toastTimer;
function toast(msg, bad) {
  const el = $('#toast'); el.textContent = msg; el.classList.toggle('bad', !!bad); el.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}
function loadState() {
  try { const raw = localStorage.getItem(STORE_KEY); if (raw) return sanitize(JSON.parse(raw)); } catch (e) { /* storage unavailable */ }
  return { ...BASE };
}
let persistTimer;
function persist() {
  clearTimeout(persistTimer);
  persistTimer = setTimeout(() => { try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* ignore */ } }, 300);
}
function applyAll() {
  updateMaterialColors(state);
  setLedCss();
  applyMood(state.mood);
  refreshControls();
  rebuild();
  persist();
}

/* ------------------------------------------------------------------ rendering to files */
function withSize(w, h, fn) {
  const pr = renderer.getPixelRatio();
  renderer.setPixelRatio(1);
  renderer.setSize(w, h, false);
  composer.setPixelRatio(1);
  composer.setSize(w, h);
  camera.clearViewOffset();
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  try { return fn(); } finally { renderer.setPixelRatio(pr); onResize(); }
}
function renderImage() {
  const sel = $('#renderSize').value;
  let w, h;
  if (sel === 'screen') { const pr = renderer.getPixelRatio(); w = Math.round((innerWidth - panelOffset()) * pr); h = Math.round(innerHeight * pr); }
  else [w, h] = sel.split('x').map(Number);
  const saved = { p: camera.position.clone(), t: controls.target.clone() };
  const refit = !userMoved && !drive.on && VIEWS.some((v) => v.id === currentView);
  const url = withSize(w, h, () => {
    if (refit) {
      const pose = viewPose(currentView, frameFor(camera.fov, w / h));
      camera.position.copy(toWorld(pose.p)); camera.lookAt(toWorld(pose.t));
    }
    updateFrameUniforms(); composer.render();
    return renderer.domElement.toDataURL('image/png');
  });
  camera.position.copy(saved.p); controls.target.copy(saved.t); controls.update();
  download(url, `${slug()}-${currentView}-${w}x${h}.png`);
  toast(`Rendered a ${w} × ${h} image`);
}
let sheetUrl = null;
async function renderSheet() {
  document.body.classList.add('busy');
  try { if (document.fonts && document.fonts.load) await document.fonts.load('500 34px "Barlow Condensed"'); } catch (e) { /* offline fonts */ }
  const W = 3072, H = 2048, g = 12, FOV = 24;
  const topH = Math.round(H * 0.477), botH = H - topH - g;
  const tw = Math.round(W * 0.485), fw = Math.round(W * 0.257), rw = W - tw - fw - 2 * g;
  const lw = Math.round(W * 0.518), rw2 = W - lw - g;
  const panels = [
    { id: 'top', label: 'TOP VIEW', x: 0, y: 0, w: tw, h: topH },
    { id: 'front', label: 'FRONT VIEW', x: tw + g, y: 0, w: fw, h: topH },
    { id: 'rear', label: 'REAR VIEW', x: tw + fw + 2 * g, y: 0, w: rw, h: topH },
    { id: 'left', label: 'LEFT SIDE VIEW (DRIVER SIDE)', x: 0, y: topH + g, w: lw, h: botH },
    { id: 'right', label: 'RIGHT SIDE VIEW (PASSENGER SIDE)', x: lw + g, y: topH + g, w: rw2, h: botH },
  ];
  const board = document.createElement('canvas'); board.width = W; board.height = H;
  const ctx = board.getContext('2d');
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H);
  const saved = { p: camera.position.clone(), t: controls.target.clone(), fov: camera.fov, view: currentView };
  const m = MOODS[state.mood];
  try {
    for (const pn of panels) {
      currentView = pn.id; applyVisibility();
      withSize(pn.w, pn.h, () => {
        camera.fov = FOV; camera.aspect = pn.w / pn.h; camera.updateProjectionMatrix();
        const pose = viewPose(pn.id, frameFor(FOV, pn.w / pn.h));
        camera.position.copy(toWorld(pose.p));
        camera.lookAt(toWorld(pose.t));
        updateFrameUniforms();
        composer.render();
        ctx.drawImage(renderer.domElement, pn.x, pn.y, pn.w, pn.h);
      });
      const labelColor = pn.id === 'top' ? '#1f232b' : m.label;
      ctx.font = '500 34px "Barlow Condensed", "Arial Narrow", sans-serif';
      if ('letterSpacing' in ctx) ctx.letterSpacing = '1px';
      ctx.fillStyle = labelColor;
      ctx.fillText(pn.label, pn.x + 44, pn.y + 64);
    }
    const i = car.info;
    const cap = `${state.name}: ${fmtLen(i.lengthMax, state.units)} long, ${fmtLen(i.widthMax, state.units)} wide, ${fmtLen(car.bbox.max.y, state.units)} tall`;
    ctx.font = '500 26px "Barlow Condensed", "Arial Narrow", sans-serif';
    ctx.textAlign = 'right';
    ctx.fillStyle = m.label === '#1f232b' ? 'rgba(31,35,43,.75)' : 'rgba(243,237,228,.8)';
    ctx.fillText(cap, W - 40, H - 34);
    ctx.textAlign = 'left';
  } finally {
    currentView = saved.view; applyVisibility();
    camera.fov = saved.fov;
    camera.position.copy(saved.p); controls.target.copy(saved.t);
    onResize(); controls.update();
    document.body.classList.remove('busy');
  }
  sheetUrl = board.toDataURL('image/png');
  $('#sheetImg').src = sheetUrl;
  $('#sheetNote').textContent = `${W} × ${H} pixels, laid out like the concept board, rendered in ${state.mood} light.`;
  $('#sheetDlg').showModal();
}
function exportGLB() {
  if (!car.model) return;
  car.model.name = state.name || 'Art car';
  const exporter = new T.GLTFExporter();
  const fx = [];   // light beams are a render effect, not geometry
  car.model.traverse((o) => { if (o.isMesh && o.userData.noBox && o.visible) { o.visible = false; fx.push(o); } });
  const restore = () => fx.forEach((o) => { o.visible = true; });
  exporter.parse(car.model, (res) => {
    restore();
    download(new Blob([res], { type: 'model/gltf-binary' }), `${slug()}.glb`);
    toast(`Exported ${slug()}.glb`);
  }, (err) => { restore(); toast(`Export failed: ${(err && err.message) || err}`, true); }, { binary: true, onlyVisible: true });
}

/* ------------------------------------------------------------------ driving */
const drive = { on: false, v: 0, steer: 0, keys: new Set() };
const DRIVE_KEYS = new Set(['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright']);
function setDrive(on) {
  drive.on = on;
  document.body.classList.toggle('driving', on);
  $('#hud').hidden = !on;
  drive.keys.clear();
  onResize();
  if (on) {
    currentView = 'chase';
    applyVisibility();
    const pose = viewPose('chase', screenFrame(30));
    flyTo(toWorld(pose.p), toWorld(pose.t), false, 30);
    canvas.focus();
  } else {
    drive.v = 0; drive.steer = 0;
    car.wheels.forEach((w) => { if (w.front) w.pivot.rotation.y = 0; });
    setView('hero');
  }
  $('#speedOut').textContent = '0.0';
}
function updateDrive(dt) {
  const k = drive.keys;
  const fwd = k.has('w') || k.has('arrowup'), back = k.has('s') || k.has('arrowdown');
  const left = k.has('a') || k.has('arrowleft'), right = k.has('d') || k.has('arrowright');
  const VMAX = 2.2352, VREV = -1.0;   // 5 mph forward
  if (fwd) drive.v = Math.min(VMAX, drive.v + (drive.v < 0 ? 2.6 : 1.0) * dt);
  else if (back) drive.v = Math.max(VREV, drive.v - (drive.v > 0 ? 2.6 : 0.8) * dt);
  else { drive.v *= Math.pow(0.4, dt); if (Math.abs(drive.v) < 0.02) drive.v = 0; }
  const want = (left ? 1 : 0) - (right ? 1 : 0);
  drive.steer += (want * 0.5 - drive.steer) * Math.min(1, dt * 3.5);
  carRoot.rotation.y += drive.v * Math.tan(drive.steer) / car.info.wheelbase * dt;
  const h = carRoot.rotation.y;
  const delta = new V3(Math.cos(h), 0, -Math.sin(h)).multiplyScalar(drive.v * dt);
  carRoot.position.add(delta);
  if (tween) { tween.fromT.add(delta); tween.toT.add(delta); }
  else {
    camera.position.add(delta); controls.target.add(delta);
    if (!dragging && Math.abs(drive.v) > 0.05) {
      const sph = new T.Spherical().setFromVector3(camera.position.clone().sub(controls.target));
      const goal = Math.atan2(-Math.cos(h), Math.sin(h)) - 0.3;
      let d = goal - sph.theta; d = ((d + Math.PI) % TAU + TAU) % TAU - Math.PI;
      sph.theta += d * Math.min(1, dt * 0.9);
      camera.position.setFromSpherical(sph).add(controls.target);
    }
  }
  for (const w of car.wheels) {
    if (w.front) w.pivot.rotation.y = drive.steer;
    w.spin.rotation.z -= drive.v * dt / car.info.wheelR;
  }
  $('#speedOut').textContent = (Math.abs(drive.v) / 0.44704).toFixed(1);
}
const typing = (e) => /^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName) && e.target.type !== 'range' && e.target.type !== 'checkbox';
window.addEventListener('keydown', (e) => {
  if (typing(e)) return;
  const key = e.key.toLowerCase();
  if (drive.on) {
    if (DRIVE_KEYS.has(key)) { drive.keys.add(key); e.preventDefault(); }
    if (key === 'escape') setDrive(false);
    return;
  }
  if (/^[1-9]$/.test(e.key) && !e.metaKey && !e.ctrlKey && !e.altKey) {
    const v = VIEWS[parseInt(e.key, 10) - 1];
    if (v) setView(v.id);
  }
});
window.addEventListener('keyup', (e) => drive.keys.delete(e.key.toLowerCase()));
window.addEventListener('blur', () => drive.keys.clear());
document.querySelectorAll('#drivePad button').forEach((b) => {
  const on = (e) => { e.preventDefault(); drive.keys.add(b.dataset.key); b.classList.add('on'); };
  const off = () => { drive.keys.delete(b.dataset.key); b.classList.remove('on'); };
  b.addEventListener('pointerdown', on);
  ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => b.addEventListener(ev, off));
});

/* ------------------------------------------------------------------ wiring */
function wire() {
  const presetSel = $('#preset');
  PRESETS.forEach((p) => { const o = document.createElement('option'); o.value = p.id; o.textContent = p.label; presetSel.appendChild(o); });
  presetSel.addEventListener('change', () => {
    const p = PRESETS.find((x) => x.id === presetSel.value);
    presetSel.value = '';
    if (!p) return;
    const v = p.values();
    state = p.keep ? sanitize({ ...state, ...v }) : sanitize({ ...v, units: state.units, riderTarget: state.riderTarget, mood: v.mood || state.mood });
    applyAll();
    if (currentView !== 'chase') setView(currentView === 'roof' && !state.roofDeck ? 'hero' : currentView);
    toast(`Loaded ${p.label}`);
  });
  $('#designName').addEventListener('input', (e) => { state.name = e.target.value; persist(); });
  document.querySelectorAll('#moodSeg button').forEach((b) => b.addEventListener('click', () => { applyMood(b.dataset.mood); persist(); }));
  $('#panelToggle').addEventListener('click', () => {
    const hidden = document.body.classList.toggle('panel-hidden');
    $('#panelToggle').setAttribute('aria-expanded', String(!hidden));
    onResize();
    if (!userMoved && !drive.on && currentView !== 'chase') setView(currentView);
  });
  $('#renderBtn').addEventListener('click', renderImage);
  $('#sheetBtn').addEventListener('click', renderSheet);
  $('#driveBtn').addEventListener('click', () => setDrive(true));
  $('#parkBtn').addEventListener('click', () => setDrive(false));
  $('#glbBtn').addEventListener('click', exportGLB);
  $('#saveBtn').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify({ app: 'art-car-studio', version: 1, design: state }, null, 2)], { type: 'application/json' });
    download(blob, `${slug()}.artcar.json`);
    toast(`Saved ${slug()}.artcar.json`);
  });
  $('#openBtn').addEventListener('click', () => $('#openInput').click());
  $('#openInput').addEventListener('change', async (e) => {
    const file = e.target.files && e.target.files[0]; e.target.value = '';
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      state = sanitize(data.design || data);
      applyAll();
      setView('hero');
      toast(`Opened ${file.name}`);
    } catch (err) { toast(`Couldn’t open ${file.name}. Choose a .artcar.json file saved from this page.`, true); }
  });
  $('#sheetDownload').addEventListener('click', () => { if (sheetUrl) download(sheetUrl, `${slug()}-sheet.png`); });
  $('#conceptBtn').addEventListener('click', () => $('#conceptDlg').showModal());
  $('#conceptReplace').addEventListener('click', () => $('#conceptInput').click());
  $('#conceptInput').addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0]; if (!file) return;
    const r = new FileReader(); r.onload = () => { $('#conceptImg').src = r.result; }; r.readAsDataURL(file);
  });
  document.querySelectorAll('dialog').forEach((d) => {
    d.addEventListener('click', (e) => { if (e.target === d || e.target.hasAttribute('data-close')) d.close(); });
  });
  if (matchMedia('(pointer:coarse)').matches) $('#captionHint').textContent = 'Drag to orbit, pinch to zoom';
}

/* ------------------------------------------------------------------ boot */
makeMaterials();
buildPanel();
buildViewButtons();
wire();
if (innerWidth <= 900) { document.body.classList.add('panel-hidden'); $('#panelToggle').setAttribute('aria-expanded', 'false'); }
updateMaterialColors(state);
setLedCss();
applyMood(state.mood);
refreshControls();
rebuild();
onResize();
setView('hero', true);

let last = performance.now(), frames = 0, paused = false;
function frame(now) {
  if (paused) { requestAnimationFrame(frame); return; }
  const dt = Math.min(0.05, Math.max(0, (now - last) / 1000)); last = now;
  LED_U.uTime.value += dt;
  stepTween(now);
  if (drive.on) updateDrive(dt);
  controls.update();
  updateFrameUniforms();
  sky.position.copy(camera.position);
  stars.position.copy(camera.position);
  sun.target.position.copy(carRoot.position);
  sun.position.copy(carRoot.position).addScaledVector(sunDir, 45);
  sun.target.updateMatrixWorld();
  composer.render(dt);
  if (++frames === 2) $('#loading').classList.add('done');
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
window.__artcar = {
  state: () => state, setView, renderSheet, applyMood, car, setValue, rebuildNow: () => rebuild(),
  pause: (v) => { paused = v; },
  snap: (secs = 1.2) => {
    tween = null;
    const tpv = performance.now();
    controls.update(); updateFrameUniforms();
    sky.position.copy(camera.position); stars.position.copy(camera.position);
    sun.target.position.copy(carRoot.position); sun.position.copy(carRoot.position).addScaledVector(sunDir, 45); sun.target.updateMatrixWorld();
    composer.render(0.016);
    const url = renderer.domElement.toDataURL('image/png');
    return { url, ms: performance.now() - tpv };
  },
};
