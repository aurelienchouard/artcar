/* Art Car Studio v2: the app. Wires the engine, the 3D view, the stepper, the scorecard and the step panels. */
import { renderer, scene, camera, controls, composer, bloom, carRoot, lamps, LAMP_BASE, sun, sunDir, sky, stars, applyMood, MOODS } from './scene3d.js';
import { makeMaterials, makeV2Materials, updateMaterialColors, updateV2Colors, LED_U, LED_MODES, MAT } from '../builders/materials.js';
import { buildThree, disposeTree } from '../builders/build.js';
import { dimsOverlay, viewConeViz, trailerModel, silhouettePlane } from '../builders/overlays.js';
import { store, setDesign, setValue, scheduleEval, undo, loadInitial, savedDesign, openFile } from './store.js';
import { renderStep, vehicleFit } from './steps.js';
import { renderScorecard, hideExplain } from './scorecard.js';
import { h } from './widgets.js';
import { evaluate, STEPS } from '../engine/evaluate.js';
import { sanitize, starterDesign, blankDesign, params } from '../engine/state.js';
import { buildCar } from '../engine/model/car.js';
import { boundsOf } from '../engine/scene.js';
import { encodeDesign, decodeDesign } from '../engine/share.js';
import { fmtLen, fmtWeight, TIER_COST, TIER_EFFORT } from '../engine/units.js';
import { stepTier } from '../engine/tiers.js';
import { STARTERS } from '../catalogs/starters.js';
import { CARDS } from '../catalogs/cards.js';
import { VEHICLES, VEHICLE_IDS, FAMILIES } from '../catalogs/vehicles.js';
import { TRAILERS } from '../catalogs/trailers.js';
import { R } from '../catalogs/rules.js';

const T = window.THREE;
const TAU = Math.PI * 2;
const $ = (s) => document.querySelector(s);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ------------------------------------------------------------------ app state */
const app = {
  ui: { family: null },
  layers: { vehicle: true, structure: true, upper: true, layout: true, riders: true, design: true, lights: true, xray: false },
  overlays: { dims: false, silhouette: null, silLen: 7, silX: 0 },
  view: 'hero', userMoved: false,
  compare: [], compareOn: false, card: null,
  fitDone: new Set(),
  saved: null,
};
/* Each step shows the build up to that step: the vehicle alone while picking it and stripping it, then the structure,
   the upper deck, the layout and riders, the design, the lights. The brief and transport steps show everything. */
const LAYER_KEYS = ['vehicle', 'structure', 'upper', 'layout', 'riders', 'design', 'lights'];
const STAGES = [null, ['vehicle'], ['vehicle'], ['vehicle', 'structure'], ['vehicle', 'structure', 'upper'],
  ['vehicle', 'structure', 'upper', 'layout', 'riders'], ['vehicle', 'structure', 'upper', 'layout', 'riders', 'design'], null, null, null];
function stageLayers() {
  const st = STAGES[store.step];
  for (const k of LAYER_KEYS) app.layers[k] = st ? st.includes(k) : true;
  app.layers.xray = false;
  document.querySelectorAll('#layerButtons .v').forEach((b) => b.setAttribute('aria-pressed', String(!!app.layers[b.dataset.layer])));
}
const isPreview = () => store.step === 1 && store.E && !store.E.blank;
let previewCache = { key: null, model: null };
/* The stock vehicle on its own, with nothing changed: what the vehicle step shows. */
function stockModel(E) {
  const key = JSON.stringify(E.d.vehicle);
  if (previewCache.key === key) return previewCache.model;
  const d = JSON.parse(JSON.stringify(E.d));
  d.strip.level = 'stock'; d.strip.rops = !!E.C.rops; d.strip.bed = true;
  const s = params(d); s.preview = true;
  previewCache = { key, model: buildCar(s, E.C) };
  return previewCache.model;
}
const car = { root: null, wheels: [], bbox: new T.Box3(), extras: new T.Group(), others: [] };
scene.add(car.extras);
carRoot.add(new T.Group());   // placeholder so carRoot always has children

/* ------------------------------------------------------------------ toast */
let toastTimer;
function toast(msg, bad) {
  const el = $('#toast'); el.textContent = msg; el.classList.toggle('bad', !!bad); el.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
}
window.__toast = toast;

/* ------------------------------------------------------------------ the car in 3D */
function rebuildCar() {
  const E = store.E;
  if (car.root) { carRoot.remove(car.root); disposeTree(car.root); car.root = null; car.wheels = []; }
  if (E.blank) {   // nothing picked yet: an empty patch of playa, framed as if a van stood there
    car.bbox.min.set(-3.2, 0, -1.3); car.bbox.max.set(3.2, 2.6, 1.3);
    rebuildOverlays();
    return;
  }
  const preview = isPreview();
  const model = preview ? stockModel(E) : E.model;
  const b = buildThree(model);
  car.root = b.root; car.wheels = b.wheels; car.layers = b.layers;
  carRoot.add(car.root);
  if (preview) {
    const pb = boundsOf(model.root, (o) => (o.userData.layer && o.userData.layer !== 'vehicle') || o.userData.noBox);
    car.bbox.min.set(pb.min[0], 0, pb.min[2]); car.bbox.max.set(pb.max[0], pb.max[1], pb.max[2]);
  } else {
    const pb = E.dims.withBikes;
    car.bbox.min.set(...pb.min); car.bbox.max.set(...pb.max);
  }
  updateMaterialColors(E.s); updateV2Colors(E.s);
  const g = E.g, lc = (g.lx0 + g.lx1) / 2;
  lamps[0].position.set(lc + g.loungeLen / 4, g.roofBottom - 0.3, 0);
  lamps[1].position.set(lc - g.loungeLen / 4, g.roofBottom - 0.3, 0);
  lamps[2].position.set(g.mid, Math.min(0.9, g.deckY - 0.2), 0);
  rebuildOverlays();
  applyVisibility();
  setLedCss();
}
function rebuildOverlays() {
  for (const c of [...car.extras.children]) { car.extras.remove(c); disposeTree(c); }
  const E = store.E;
  carRoot.position.y = 0;
  if (E.blank) return;
  if (app.overlays.dims) car.extras.add(dimsOverlay(E, store.d.view.units));
  if (app.view === 'cockpit' && E.view) car.extras.add(viewConeViz(E.view));
  if (app.overlays.silhouette) car.extras.add(silhouettePlane(app.overlays.silhouette, app.overlays.silLen, E.g.mid + app.overlays.silX, 0, 0.5)).position.z = -(E.g.W / 2 + 1.2);
  carRoot.position.y = 0;
  if (app.view === 'packed' && E.s.trailer !== 'drive') {
    const tr = TRAILERS[E.s.trailer];
    const pk = E.dims.packed;
    car.extras.add(trailerModel(E.s.trailer, tr, pk.size()[0], pk.min[0]));
    car.extras.children[car.extras.children.length - 1].position.y = 0;
    carRoot.position.y = tr.deck;
  }
  car.extras.position.copy(carRoot.position).setY(0);
}
function applyVisibility() {
  if (!car.root) return;
  const s = store.E.s, L = app.layers, v = app.view;
  const packed = v === 'packed', cut = v === 'top';
  const roofOff = packed && s.removeRoof, railsOff = roofOff || (packed && s.removeRails);
  for (const grp of car.root.children) {
    const { layer, pack } = grp.userData;
    let vis = L[layer] !== false;
    if (layer === 'riders') vis = L.riders && L.layout && !packed && v !== 'cockpit' && !(cut && pack === 'roof') && !(railsOff && pack === 'roof');
    if (packed && ((pack === 'off' && !(layer === 'design' && s.skinOff === false)) || (roofOff && pack === 'roof') || (railsOff && pack === 'rails'))) vis = false;
    if (cut && (pack === 'roof' || pack === 'rails')) vis = false;
    grp.visible = vis;
  }
  const xray = L.xray || v === 'frame';
  car.root.traverse((o) => {
    if (!o.isMesh) return;
    let on = true;
    if (xray) { let p = o, lay = null; while (p && !lay) { lay = p.userData.layer; p = p.parent; } on = !!o.userData.frame || lay === 'vehicle'; }
    if (!L.lights && o.material === MAT.led) on = false;
    o.visible = on;
  });
}

/* ------------------------------------------------------------------ per-frame lights */
function ledAverage(mode, t) { return { breathe: 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(t * 1.7)), chase: 0.45, sparkle: 0.4, off: 0 }[mode] ?? 1; }
const tmpColor = new T.Color();
function updateFrameUniforms() {
  if (store.E.blank) { lamps.forEach((l) => { l.intensity = 0; }); return; }
  const s = store.E.s;
  carRoot.updateMatrixWorld(true);
  LED_U.uCarInv.value.copy(carRoot.matrixWorld).invert();
  LED_U.uLen.value = s.length;
  const m = MOODS[store.d.view.mood];
  LED_U.uLevel.value = s.ledLevel * m.led;
  LED_U.uMode.value = LED_MODES[s.ledMode] ?? 0;
  LED_U.uColorA.value.set(s.ledColor); LED_U.uColorB.value.set(s.ledColor2);
  const k = ledAverage(s.ledMode, LED_U.uTime.value) * m.lamps * s.ledLevel;
  tmpColor.set(s.ledColor);
  if (s.ledMode === 'sunset') tmpColor.lerp(new T.Color(s.ledColor2), 0.5);
  lamps.forEach((l, i) => { l.intensity = LAMP_BASE[i] * k; l.color.copy(tmpColor); });
  const ribK = s.ledMode === 'off' ? 0 : LED_U.uLevel.value;
  MAT.ribSolid.emissiveIntensity = ribK; MAT.ribSolid2.emissiveIntensity = ribK;
  const night = m.lamps, t = LED_U.uTime.value;
  const glow = s.ledMode === 'off' ? 0 : s.ledLevel * (0.06 + 0.45 * night);
  MAT.glowSkin.emissiveIntensity = glow; MAT.glowSkinF.emissiveIntensity = glow; MAT.glowInner.emissiveIntensity = glow * 1.3;
  MAT.fabricGlow.emissiveIntensity = glow * 1.2;
  MAT.puck.emissiveIntensity = 0.15 + 2.2 * night;
  MAT.neon.emissiveIntensity = 0.7 + 2.6 * night;
  MAT.rgb.emissive.setHSL((t * 0.08) % 1, 1, 0.55); MAT.rgb.emissiveIntensity = 0.6 + 2 * night;
  MAT.beam.color.copy(MAT.rgb.emissive); MAT.beam.opacity = 0.055 * night;
}
function setLedCss() {
  if (store.E.blank) return;
  const s = store.E.s, root = document.documentElement.style;
  root.setProperty('--led', s.ledColor);
  const c = new T.Color(s.ledColor), lum = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
  root.setProperty('--on-led', lum > 0.18 ? '#1d160c' : '#f7f2ea');
}

/* ------------------------------------------------------------------ views */
const VIEWS = [
  { id: 'hero', label: 'Three-quarter', caption: 'Three-quarter view' },
  { id: 'left', label: 'Driver side', caption: 'Left side view, driver side' },
  { id: 'right', label: 'Passenger side', caption: 'Right side view, passenger side' },
  { id: 'front', label: 'Front', caption: 'Front view' },
  { id: 'rear', label: 'Rear', caption: 'Rear view' },
  { id: 'top', label: 'Top', caption: 'Top view, roof cut away' },
  { id: 'lounge', label: 'Lounge', caption: 'Inside the lower lounge' },
  { id: 'roof', label: 'Roof deck', caption: 'On the upper deck' },
  { id: 'cockpit', label: 'Driver’s seat', caption: 'From the driver’s seat: green lines mark the view cone, red dots are blocked sight lines' },
  { id: 'frame', label: 'Frame only', caption: 'Steel only: the load-bearing structure' },
  { id: 'packed', label: 'Packed', caption: 'Packed for transport on the chosen trailer' },
];
const WIDE = new Set(['lounge', 'cockpit', 'roof']);
function insets() {
  const narrow = innerWidth <= 900;
  const rect = (sel) => { const el = $(sel); if (!el || el.hidden || getComputedStyle(el).display === 'none') return null; const r = el.getBoundingClientRect(); return r.width ? r : null; };
  const panel = document.body.classList.contains('panel-hidden') ? null : rect('#panel');
  const score = rect('#scorecard'), step = rect('#stepper'), bottom = rect('#bottomBar');
  if (narrow) return { l: 0, r: 0, t: score ? score.bottom + 6 : 0, b: innerHeight - Math.min(bottom ? bottom.top : innerHeight, panel ? panel.top : innerHeight) + 6 };
  return { l: score ? score.right + 10 : 0, r: panel ? innerWidth - panel.left + 10 : 0, t: step ? step.bottom + 6 : 0, b: bottom ? innerHeight - bottom.top + 6 : 0 };
}
function onResize() {
  const w = innerWidth, hh = innerHeight;
  renderer.setSize(w, hh);
  composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(w, hh);
  const i = insets(), s = i.l - i.r, t = i.t - i.b;
  const FW = w + Math.abs(s), FH = hh + Math.abs(t);
  camera.aspect = FW / FH;
  camera.setViewOffset(FW, FH, s < 0 ? -s : 0, t < 0 ? -t : 0, w, hh);
  camera.updateProjectionMatrix();
}
function screenFrame(fov) {
  const i = insets(), w = innerWidth, hh = innerHeight, FH = hh + Math.abs(i.t - i.b);
  const tn = Math.tan(T.MathUtils.degToRad(fov) / 2);
  return { tv: tn * (hh - i.t - i.b) / FH, th: tn * (w - i.l - i.r) / FH };
}
function frameFor(fov, aspect) { const tv = Math.tan(T.MathUtils.degToRad(fov) / 2); return { tv, th: tv * aspect }; }
const fitDist = (hExt, vExt, fr, margin) => Math.max((vExt / 2) * margin / fr.tv, (hExt / 2) * margin / fr.th);
const BLANK_VIEWS = new Set(['hero', 'left', 'right', 'front', 'rear', 'top']);
function viewPose(id, fr) {
  const E = store.E, g = E.g || { deckY: 0 };
  if (E.blank && !BLANK_VIEWS.has(id)) id = 'hero';
  const b = car.bbox.clone();
  if (app.compareOn && car.others.length) for (const o of car.others) b.union(o.box);
  if (id === 'packed' && !E.blank) { const pk = E.dims.packed; b.min.set(pk.min[0] - 1, 0, pk.min[2]); b.max.set(pk.max[0] + 5, pk.max[1] + (TRAILERS[E.s.trailer]?.deck || 0), pk.max[2]); }
  const c = b.getCenter(new T.Vector3()), sz = b.getSize(new T.Vector3());
  switch (id) {
    case 'top': { const d = fitDist(sz.x, sz.z, fr, 1.06); return { p: new T.Vector3(c.x, g.deckY + d, c.z - 0.001), t: new T.Vector3(c.x, g.deckY, c.z) }; }
    case 'front': { const d = fitDist(sz.z, sz.y, fr, 1.2); return { p: new T.Vector3(b.max.x + d, c.y, c.z), t: c.clone() }; }
    case 'rear': { const d = fitDist(sz.z, sz.y, fr, 1.2); return { p: new T.Vector3(b.min.x - d, c.y, c.z), t: c.clone() }; }
    case 'left': { const d = fitDist(sz.x, sz.y, fr, 1.18); return { p: new T.Vector3(c.x, c.y, b.min.z - d), t: c.clone() }; }
    case 'right': { const d = fitDist(sz.x, sz.y, fr, 1.18); return { p: new T.Vector3(c.x, c.y, b.max.z + d), t: c.clone() }; }
    case 'lounge': return { p: new T.Vector3(g.lx0 + 0.25, g.deckY + 1.5, 0), t: new T.Vector3(g.lx1 + 0.8, g.deckY + 0.55, 0) };
    case 'cockpit': return { p: new T.Vector3(g.eye[0] - 0.12, g.eye[1] + 0.04, g.eye[2]), t: new T.Vector3(g.eye[0] + 8, g.eye[1] - 0.45, g.eye[2]) };
    case 'roof': return { p: new T.Vector3(g.dx0 - 1.7, g.roofTop + 2.9, 0), t: new T.Vector3(g.dx1 + 0.2, g.roofTop + 0.1, 0) };
    case 'chase': return { p: new T.Vector3(-15, 5.2, -5.5), t: new T.Vector3(0.5, 1.6, 0) };
    default: {
      const tt = c.clone(); tt.y *= 0.9;
      const dir = new T.Vector3(0.95, 0.2, -0.82).normalize();
      const d = (sz.length() / 2) / Math.sin(Math.atan(Math.min(fr.tv, fr.th))) * 0.8;
      return { p: tt.clone().addScaledVector(dir, d), t: tt };
    }
  }
}
const toWorld = (v) => carRoot.localToWorld(v.clone());
let tween = null;
function flyTo(p, t, instant, fov = camera.fov) {
  if (instant || reduceMotion) { camera.position.copy(p); controls.target.copy(t); camera.fov = fov; camera.updateProjectionMatrix(); controls.update(); tween = null; return; }
  const fromT = controls.target.clone();
  const fromO = new T.Spherical().setFromVector3(camera.position.clone().sub(fromT));
  const toO = new T.Spherical().setFromVector3(p.clone().sub(t));
  let dTheta = toO.theta - fromO.theta; dTheta = ((dTheta + Math.PI) % TAU + TAU) % TAU - Math.PI;
  tween = { fromT, toT: t.clone(), fromO, toO, dTheta, fromF: camera.fov, toF: fov, t0: performance.now(), dur: 900 };
}
function stepTween(now) {
  if (!tween) return;
  const k = clamp((now - tween.t0) / tween.dur, 0, 1), e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
  controls.target.lerpVectors(tween.fromT, tween.toT, e);
  const r = tween.fromO.radius * Math.pow(tween.toO.radius / Math.max(1e-4, tween.fromO.radius), e);
  camera.position.setFromSpherical(new T.Spherical(r, T.MathUtils.lerp(tween.fromO.phi, tween.toO.phi, e), tween.fromO.theta + tween.dTheta * e)).add(controls.target);
  if (tween.fromF !== tween.toF) { camera.fov = T.MathUtils.lerp(tween.fromF, tween.toF, e); camera.updateProjectionMatrix(); }
  if (k >= 1) tween = null;
}
function setView(id, instant) {
  if (store.E.blank ? !BLANK_VIEWS.has(id) : id === 'roof' && !store.E.g.decks.length) id = 'hero';
  if (isPreview() && ['packed', 'roof', 'lounge', 'top'].includes(id)) id = 'hero';
  const was = app.view;
  app.view = id; app.userMoved = false;
  if ((was === 'packed') !== (id === 'packed') || (was === 'cockpit') !== (id === 'cockpit')) rebuildOverlays();
  applyVisibility();
  const fov = WIDE.has(id) ? 55 : 30;
  const pose = viewPose(id, screenFrame(fov));
  flyTo(toWorld(pose.p), toWorld(pose.t), instant, fov);
  $('#captionTitle').textContent = VIEWS.find((v) => v.id === id)?.caption || 'Driving';
  updateViewButtons();
}
app.setView = setView;
function buildViewButtons() {
  const wrap = $('#viewButtons');
  VIEWS.forEach((v, n) => {
    const b = h('button', { type: 'button', class: 'v', 'data-view': v.id }, v.label, n < 9 ? h('kbd', {}, String(n + 1)) : null);
    b.addEventListener('click', () => setView(v.id));
    wrap.append(b);
  });
  const lw = $('#layerButtons');
  for (const [k, lab] of [['vehicle', 'Vehicle'], ['structure', 'Structure'], ['upper', 'Upper deck'], ['layout', 'Layout'], ['riders', 'Riders'], ['design', 'Design'], ['lights', 'Lights'], ['xray', 'X-ray']]) {
    const b = h('button', { type: 'button', class: 'v', 'data-layer': k, 'aria-pressed': String(k === 'xray' ? app.layers.xray : app.layers[k]) }, lab);
    b.addEventListener('click', () => { app.layers[k] = !app.layers[k]; b.setAttribute('aria-pressed', String(app.layers[k])); applyVisibility(); });
    lw.append(b);
  }
}
function updateViewButtons() {
  document.querySelectorAll('#viewButtons .v').forEach((b) => {
    b.setAttribute('aria-pressed', String(b.dataset.view === app.view));
    b.disabled = store.E.blank ? !BLANK_VIEWS.has(b.dataset.view) : b.dataset.view === 'roof' && !store.E.g.decks.length;
  });
}
controls.addEventListener('start', () => { tween = null; app.userMoved = true; drive.dragging = true; });
controls.addEventListener('end', () => { drive.dragging = false; });

/* ------------------------------------------------------------------ stepper and panel */
function renderStepper() {
  const nav = $('#stepper'); nav.innerHTML = '';
  store.E.steps.forEach((st, i) => {
    const locked = store.E.blank && i >= 2;
    const b = h('button', { type: 'button', class: 'step', disabled: locked, 'aria-current': i === store.step ? 'step' : null, title: locked ? 'Pick a vehicle first (step 1)' : `${st.q}${st.items.length ? ' · ' + st.items.map((x) => x.label || x.title).join(', ') : ''}` },
      h('span', { class: 'n' }, String(i)), h('span', {}, st.title), h('span', { class: 'dot ' + st.status, 'aria-label': st.status === 'ok' ? 'no conflicts' : `${st.status} flags` }));
    b.addEventListener('click', () => goStep(i));
    nav.append(b);
  });
}
function goStep(i) {
  if (store.E.blank && i >= 2) { toast('Pick a vehicle first: everything else builds on it.'); i = 1; }
  const wasPreview = isPreview();
  store.step = clamp(i, 0, STEPS.length - 1);
  hideExplain();
  stageLayers();
  if (wasPreview !== isPreview()) { rebuildCar(); if (!app.userMoved && !drive.on) setView(app.view); }
  else applyVisibility();
  renderStepper(); renderPanel(true);
  if (document.body.classList.contains('panel-hidden')) togglePanel(true);
  if (store.step === 1 && !app.overlays.dims && app.view === 'hero') { /* keep the view */ }
  const T = STEPS.findIndex((x) => x.id === 'transport');
  if (store.step === T && app.view !== 'packed') setView('packed');
  else if (store.step !== T && app.view === 'packed') setView('hero');
  if (store.step === 1) warmFits();
}
app.goStep = goStep;
let panelScroll = {};
function renderPanel(scrollTop) {
  const i = store.step, st = STEPS[i], E = store.E;
  const body = $('#panelBody');
  if (app.scrollTopNext) { scrollTop = true; app.scrollTopNext = false; }
  if (!scrollTop) panelScroll[i] = body.scrollTop;
  const pt = E.tiers.perStep[i];
  $('#panelHead').innerHTML = '';
  $('#panelHead').append(h('h2', {}, `${i}. ${st.title}`), h('div', { class: 'q' }, st.q),
    E.blank ? '' : h('div', { class: 'tiers' }, pt ? [h('span', { class: 'tag' }, `Cost here ${TIER_COST[pt.cost]}`), h('span', { class: 'tag' }, `Effort here ${TIER_EFFORT[pt.effort]}`)] : null,
      h('span', { class: 'tag' }, `Total ${TIER_COST[E.tiers.cost]}, ${TIER_EFFORT[E.tiers.effort]}`)));
  body.innerHTML = '';
  try { body.append(...renderStep(i, app)); } catch (err) { console.error(err); body.append(h('p', { class: 'why' }, `This step hit an error: ${err.message}`)); }
  body.scrollTop = scrollTop ? 0 : panelScroll[i] || 0;
  $('#prevBtn').disabled = i === 0;
  $('#nextBtn').textContent = i === STEPS.length - 1 ? 'Done' : `Next: ${STEPS[i + 1].title}`;
  $('#nextBtn').disabled = E.blank && i >= 1;
  $('#footTiers').textContent = '';
}
app.rerender = () => renderPanel(false);
app.toggleOverlay = (k) => { app.overlays[k] = !app.overlays[k]; rebuildOverlays(); renderPanel(false); if (k === 'dims' && app.overlays.dims) setView('left'); };
app.afterVehicleSwitch = (fromBlank) => {
  const C = VEHICLES[store.d.vehicle.id]; app.ui.family = C.family; app.scrollTopNext = true;
  toast(fromBlank ? `Picked the ${C.short}. Here it is stock; each step from here adds its layer.` : `Switched to the ${C.short}. Later choices were kept${store.lastChanges.length ? '; the body was clamped to the new chassis' : ''}.`);
};
app.resume = () => { if (app.saved) loadDesign(app.saved, `Resumed ${app.saved.name}`); };
app.newBlank = () => loadDesign(blankDesign(), 'Started a blank design: set the brief, then pick a vehicle');
app.fitReady = (id) => app.fitDone.has(id);
function warmFits() {
  const ids = VEHICLE_IDS.filter((id) => !app.fitDone.has(id));
  if (!ids.length) return;
  const next = () => {
    const id = ids.shift(); if (!id) { if (store.step === 1) renderPanel(false); return; }
    vehicleFit(id, store.d.brief); app.fitDone.add(id);
    setTimeout(next, 0);
  };
  setTimeout(next, 30);
}
app.openVehicleTable = (fam) => {
  const body = $('#tableBody'); body.innerHTML = '';
  let showFam = fam;
  const draw = () => {
    body.innerHTML = '';
    const units = store.d.view.units, L = (m) => fmtLen(m, units), Wt = (lb) => fmtWeight(lb / 2.20462, units);
    const list = VEHICLE_IDS.map((id) => VEHICLES[id]).filter((v) => showFam === 'all' || v.family === showFam);
    body.append(h('div', { class: 'seg wide' }, [['all', 'All'], ...FAMILIES.map((f) => [f.id, f.label])].map(([id, lab]) => h('button', { type: 'button', 'aria-pressed': String(id === showFam), onclick: () => { showFam = id; draw(); } }, lab))));
    const badge = (v, k, text) => h('span', {}, text, ' ', h('span', { class: 'tag ' + (v.confidence[k] || 'estimate'), title: v.sources[k] || 'Studio estimate, needs a source' }, (v.confidence[k] || 'estimate')[0].toUpperCase()));
    const rows = list.map((v) => {
      const fit = vehicleFit(v.id, store.d.brief);
      return { sel: v.id === store.d.vehicle.id, cells: [v.short, badge(v, 'payloadLb', Wt(v.payloadLb)), badge(v, 'gvwrLb', Wt(v.gvwrLb)), badge(v, 'curbLb', Wt(v.curbLb)),
        badge(v, 'wheelbase', v.wheelbaseOptions.map((w) => Math.round(w / 0.0254) + '″').join('/')), badge(v, 'track', L(v.track.rear)), badge(v, 'tire', v.tire.size + (v.tire.dualRear ? ' dual' : '')),
        badge(v, 'frameHeight', L(v.frameHeight)), v.style === 'cart' ? '—' : badge(v, 'ca', L(v.wheelbase + v.cab.back)), badge(v, 'ba', L(v.ba)), badge(v, 'length', L(v.ba + v.wheelbase + v.af)), badge(v, 'width', L(v.width)),
        v.topSpeedMph ? `${v.topSpeedMph} mph` : '—', v.powertrain,
        { cls: fit.riders >= store.d.brief.ridersMin ? 'ok' : 'amber', text: `about ${fit.riders}` }, { cls: fit.deck === 'yes' ? 'ok' : fit.deck === 'no' ? 'red' : 'amber', text: fit.deck },
        h('button', { type: 'button', class: 'btn small', onclick: () => { $('#tableDlg').close(); setValue('vehicle.id', v.id); app.afterVehicleSwitch(); } }, 'Use')] };
    });
    const t = document.createElement('table'); t.className = 't';
    t.append(h('thead', {}, h('tr', {}, ['Vehicle', 'Payload', 'GVWR', 'Curb', 'Wheelbase', 'Track', 'Tires', 'Frame', 'CA', 'BA', 'Length', 'Width', 'Top speed', 'Power', 'Riders, typical build', 'Upper deck', ''].map((x) => h('th', {}, x)))),
      h('tbody', {}, rows.map((r) => h('tr', { class: r.sel ? 'sel' : '' }, r.cells.map((c) => (c && c.cls ? h('td', { class: c.cls }, c.text) : h('td', {}, c)))))));
    body.append(h('p', { class: 'note' }, 'Badges: S spec sheet, M measured, E estimate (hover for the source). Riders and upper deck come from the engine running each vehicle’s typical build against your brief.'), t);
  };
  draw();
  $('#tableDlg').showModal();
};
app.pickSilhouette = () => {
  const inp = h('input', { type: 'file', accept: 'image/*' });
  inp.addEventListener('change', () => {
    const f = inp.files && inp.files[0]; if (!f) return;
    app.overlays.silhouette = URL.createObjectURL(f);
    app.overlays.silLen = store.E.C.ba + store.E.s.wheelbase + store.E.C.af;
    rebuildOverlays(); renderPanel(false); setView('left');
  });
  inp.click();
};
app.setSilhouette = (o) => { if (!o) app.overlays.silhouette = null; else { if (o.len != null) app.overlays.silLen = o.len; if (o.x != null) app.overlays.silX = o.x; } rebuildOverlays(); if (!o) renderPanel(false); };

/* ------------------------------------------------------------------ reacting to the store */
let lastVehicle = null;
store.subscribe((kind) => {
  if (kind === 'design' || kind === 'live') { $('#designName').value = store.d.name; refreshTopbar(); }
});
store.subscribe((kind) => {
  if (kind !== 'eval') return;
  rebuildCar();
  renderScorecard($('#scorecard'), goStep);
  renderStepper();
  if (!store.dragging) renderPanel(false);
  renderCardBanner();
  if (app.compareOn) renderCompare();
  if (lastVehicle !== store.d.vehicle.id) { lastVehicle = store.d.vehicle.id; if (!app.userMoved && !drive.on) setView(app.view, true); }
  if (store.step === 1) warmFits();
  $('#loading').classList.add('done');
});
function refreshTopbar() {
  document.querySelectorAll('#moodSeg button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mood === store.d.view.mood)));
  document.querySelectorAll('#unitSeg button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.units === store.d.view.units)));
  applyMood(store.d.view.mood);
}

/* ------------------------------------------------------------------ start screen, cards, compare */
function openStart(tab = 'starters') {
  const body = $('#startBody'); body.innerHTML = '';
  const tabs = h('div', { class: 'tabs seg' }, [['starters', 'Starters'], ['cards', 'Reality checks']].map(([id, lab]) => h('button', { type: 'button', 'aria-pressed': String(id === tab), onclick: () => openStart(id) }, lab)));
  body.append(tabs);
  if (tab === 'starters') {
    body.append(h('div', { class: 'start-grid' }, h('button', { type: 'button', class: 'ocard', onclick: () => { app.newBlank(); $('#startDlg').close(); } },
      h('div', { class: 't' }, 'Blank design'), h('div', { class: 'd' }, 'No vehicle, nothing built. Set the brief, pick a vehicle, then add one layer per step.'))));
    body.append(h('p', { class: 'note' }, 'Each starter is a complete design you can change step by step. Pingüina is the reference build: load it to see a real one.'),
      h('div', { class: 'start-grid' }, STARTERS.map((s) => h('button', { type: 'button', class: 'ocard', onclick: () => { loadDesign(s.build(), `Loaded ${s.label}`); $('#startDlg').close(); } },
        h('div', { class: 't' }, s.label, s.reference ? h('span', { class: 'tag' }, 'reference') : null),
        h('div', { class: 'd' }, VEHICLES[s.build().vehicle.id].summary)))));
  } else {
    body.append(h('p', { class: 'note' }, 'Campmates arrive with big ideas. Each card loads the dream, shows what breaks and why, and offers the nearest version that would actually work.'),
      h('div', { class: 'start-grid' }, CARDS.map((c) => h('button', { type: 'button', class: 'ocard', onclick: () => { loadCard(c, 'dream'); $('#startDlg').close(); } },
        h('div', { class: 't' }, c.title, c.template ? h('span', { class: 'tag' }, 'template') : null), h('div', { class: 'd' }, c.pitch),
        h('div', { class: 'meta' }, c.expect.map((x) => h('span', { class: 'tag red' }, x.id)))))));
  }
  $('#startDlg').showModal();
}
function loadDesign(d, msg) {
  app.card = null;
  store.step = 0; store.lastChanges = [];
  stageLayers();
  setDesign(d);
  app.ui.family = null;
  toast(msg);
  setTimeout(() => setView('hero'), 50);
}
function loadCard(c, which) {
  setDesign(which === 'dream' ? c.preset() : c.nearest.preset());
  app.card = { c, which };
  toast(which === 'dream' ? `Loaded the ${c.title} dream: see what breaks` : `Loaded the nearest buildable: ${c.nearest.title}`);
  setTimeout(() => setView('hero'), 50);
}
function renderCardBanner() {
  const el = $('#cardBanner');
  if (!app.card) { el.hidden = true; return; }
  const { c, which } = app.card, E = store.E;
  el.hidden = false; el.innerHTML = '';
  const add = (...kids) => el.append(...kids.flat().filter((k) => k != null && k !== false));
  const statusOf = (id) => { const l = E.score.find((x) => x.id === id); if (l) return l.status; const f = E.flags.find((x) => x.id === id); return f ? f.severity : 'ok'; };
  add(
    h('h2', {}, h('span', {}, `${c.title}: ${which === 'dream' ? 'the dream' : 'nearest buildable'}`), h('button', { type: 'button', class: 'chip', onclick: () => { app.card = null; renderCardBanner(); } }, 'Close')),
    which === 'dream' ? h('p', { class: 'note' }, c.pitch) : h('p', { class: 'note' }, c.nearest.summary),
    h('div', { class: 'k note' }, which === 'dream' ? 'What breaks' : 'The same checks now'),
    h('ul', {}, c.expect.map((x) => { const st = statusOf(x.id); return h('li', {}, h('span', { class: 'dot ' + (st === 'ok' || st === 'na' ? 'ok' : st) }), h('span', {}, h('strong', {}, `${E.score.find((l) => l.id === x.id)?.label || E.flags.find((f) => f.id === x.id)?.title || x.id}. `), x.why)); })),
    which === 'dream' ? null : h('ul', {}, c.talking.map((t) => h('li', {}, h('span', { class: 'dot info' }), t))),
    h('div', { class: 'chips' }, which === 'dream' ? h('button', { type: 'button', class: 'btn primary', onclick: () => loadCard(c, 'nearest') }, `Show the nearest buildable: ${c.nearest.title}`) : h('button', { type: 'button', class: 'btn', onclick: () => loadCard(c, 'dream') }, 'Back to the dream')),
  );
}
function renderCompare() {
  const bar = $('#compareBar');
  if (store.E.blank) app.compareOn = false;
  if (!app.compareOn) { bar.hidden = true; clearOthers(); return; }
  bar.hidden = false; bar.innerHTML = '';
  const list = app.compare.map((d) => ({ d, E: evaluate(d, { viewCone: true }) }));
  const cur = { d: store.d, E: store.E, current: true };
  const cols = [cur, ...list];
  const metrics = store.E.score.map((l) => l.id);
  bar.append(h('h2', {}, h('span', {}, 'Compare designs'), h('span', {},
    app.compare.length < 2 ? h('button', { type: 'button', class: 'btn small', onclick: () => { app.compare.push(JSON.parse(JSON.stringify(store.d))); renderCompare(); toast('Added a copy of this design to compare'); } }, 'Keep a copy of this design') : null,
    ' ', h('button', { type: 'button', class: 'chip', onclick: () => { app.compareOn = false; renderCompare(); setView(app.view); } }, 'Close'))));
  const t = document.createElement('table'); t.className = 't';
  t.append(h('thead', {}, h('tr', {}, h('th', {}, ''), cols.map((c, i) => h('th', {}, c.current ? `${c.d.name} (editing)` : c.d.name, c.current ? null : [' ', h('button', { type: 'button', class: 'btn small', onclick: () => { const d = c.d; app.compare.splice(i - 1, 1); app.compare.push(JSON.parse(JSON.stringify(store.d))); setDesign(d); } }, 'Edit'), ' ', h('button', { type: 'button', class: 'btn small', onclick: () => { app.compare.splice(i - 1, 1); renderCompare(); } }, 'Remove')])))),
    h('tbody', {}, metrics.map((id) => h('tr', {}, h('th', {}, store.E.score.find((l) => l.id === id).label), cols.map((c) => { const l = c.E.score.find((x) => x.id === id); return h('td', { class: l.status === 'ok' ? '' : l.status }, l.value); })))));
  bar.append(t, h('p', { class: 'note' }, 'All designs share the same scorecard and the same camera. Kept copies sit beside the one you are editing.'));
  buildOthers(list);
}
function clearOthers() { for (const o of car.others) { scene.remove(o.root); disposeTree(o.root); } car.others = []; }
function buildOthers(list) {
  clearOthers();
  let z = car.bbox.max.z + 1.5;
  for (const { E } of list) {
    const b = buildThree(E.model), w = E.dims.withBikes;
    const g = new T.Group(); g.add(b.root); g.position.z = z - w.min[2];
    scene.add(g);
    const box = new T.Box3(new T.Vector3(w.min[0], w.min[1], w.min[2] + g.position.z), new T.Vector3(w.max[0], w.max[1], w.max[2] + g.position.z));
    car.others.push({ root: g, box });
    z = box.max.z + 1.5;
  }
}

/* ------------------------------------------------------------------ files, share, render */
const slug = () => (store.d.name || 'art-car').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'art-car';
function dataUrlToBlob(url) { const [head, b64] = url.split(','); const mime = head.match(/:(.*?);/)[1]; const bin = atob(b64), arr = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i); return new Blob([arr], { type: mime }); }
function download(blobOrUrl, name) {
  const blob = typeof blobOrUrl === 'string' ? dataUrlToBlob(blobOrUrl) : blobOrUrl;
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: name }); document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
function withSize(w, hh, fn) {
  const pr = renderer.getPixelRatio();
  renderer.setPixelRatio(1); renderer.setSize(w, hh, false); composer.setPixelRatio(1); composer.setSize(w, hh);
  camera.clearViewOffset(); camera.aspect = w / hh; camera.updateProjectionMatrix();
  try { return fn(); } finally { renderer.setPixelRatio(pr); onResize(); }
}
function renderImage() {
  const sel = $('#renderSize').value;
  let w, hh;
  if (sel === 'screen') { const pr = renderer.getPixelRatio(); w = Math.round(innerWidth * pr); hh = Math.round(innerHeight * pr); } else [w, hh] = sel.split('x').map(Number);
  const saved = { p: camera.position.clone(), t: controls.target.clone() };
  const refit = !app.userMoved && !drive.on;
  const url = withSize(w, hh, () => {
    if (refit) { const pose = viewPose(app.view, frameFor(camera.fov, w / hh)); camera.position.copy(toWorld(pose.p)); camera.lookAt(toWorld(pose.t)); }
    updateFrameUniforms(); composer.render();
    return renderer.domElement.toDataURL('image/png');
  });
  camera.position.copy(saved.p); controls.target.copy(saved.t); controls.update();
  download(url, `${slug()}-${app.view}-${w}x${hh}.png`);
  toast(`Rendered a ${w} × ${hh} image`);
}
let sheetUrl = null;
async function renderSheet() {
  if (store.E.blank) { toast('Pick a vehicle first'); return; }
  document.body.classList.add('busy');
  try { if (document.fonts && document.fonts.load) await document.fonts.load('500 34px "Barlow Condensed"'); } catch (e) { /* offline fonts */ }
  const W = 3072, H = 2048, g = 12, FOV = 24;
  const topH = Math.round(H * 0.477), botH = H - topH - g;
  const tw = Math.round(W * 0.485), fw = Math.round(W * 0.257), rw = W - tw - fw - 2 * g, lw = Math.round(W * 0.518), rw2 = W - lw - g;
  const panels = [
    { id: 'top', label: 'TOP VIEW', x: 0, y: 0, w: tw, h: topH }, { id: 'front', label: 'FRONT VIEW', x: tw + g, y: 0, w: fw, h: topH },
    { id: 'rear', label: 'REAR VIEW', x: tw + fw + 2 * g, y: 0, w: rw, h: topH }, { id: 'left', label: 'LEFT SIDE VIEW (DRIVER SIDE)', x: 0, y: topH + g, w: lw, h: botH },
    { id: 'right', label: 'RIGHT SIDE VIEW (PASSENGER SIDE)', x: lw + g, y: topH + g, w: rw2, h: botH },
  ];
  const board = h('canvas', { width: W, height: H }), ctx = board.getContext('2d');
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H);
  const saved = { p: camera.position.clone(), t: controls.target.clone(), fov: camera.fov, view: app.view };
  const m = MOODS[store.d.view.mood];
  try {
    for (const pn of panels) {
      app.view = pn.id; applyVisibility();
      withSize(pn.w, pn.h, () => {
        camera.fov = FOV; camera.aspect = pn.w / pn.h; camera.updateProjectionMatrix();
        const pose = viewPose(pn.id, frameFor(FOV, pn.w / pn.h));
        camera.position.copy(toWorld(pose.p)); camera.lookAt(toWorld(pose.t));
        updateFrameUniforms(); composer.render();
        ctx.drawImage(renderer.domElement, pn.x, pn.y, pn.w, pn.h);
      });
      ctx.font = '500 34px "Barlow Condensed", "Arial Narrow", sans-serif';
      ctx.fillStyle = pn.id === 'top' ? '#1f232b' : m.label;
      ctx.fillText(pn.label, pn.x + 44, pn.y + 64);
    }
    const E = store.E, U = store.d.view.units, sz = E.dims.playa.size();
    const cap = `${store.d.name}: ${fmtLen(sz[0], U)} long, ${fmtLen(sz[2], U)} wide, ${fmtLen(E.dims.playa.max[1], U)} tall · ${E.rc.riders} riders · ${TIER_COST[E.tiers.cost]} · ${TIER_EFFORT[E.tiers.effort]} effort`;
    ctx.font = '500 26px "Barlow Condensed", "Arial Narrow", sans-serif'; ctx.textAlign = 'right';
    ctx.fillStyle = m.label === '#1f232b' ? 'rgba(31,35,43,.75)' : 'rgba(243,237,228,.8)';
    ctx.fillText(cap, W - 40, H - 34); ctx.textAlign = 'left';
  } finally {
    app.view = saved.view; applyVisibility();
    camera.fov = saved.fov; camera.position.copy(saved.p); controls.target.copy(saved.t);
    onResize(); controls.update();
    document.body.classList.remove('busy');
  }
  sheetUrl = board.toDataURL('image/png');
  $('#sheetImg').src = sheetUrl;
  $('#sheetNote').textContent = `${W} × ${H} pixels, five views, rendered in ${store.d.view.mood} light.`;
  $('#sheetDlg').showModal();
}
function exportGLB() {
  if (!car.root) return;
  car.root.name = store.d.name || 'Art car';
  const exporter = new T.GLTFExporter(), fx = [];
  car.root.traverse((o) => { if (o.isMesh && o.userData.noBox && o.visible) { o.visible = false; fx.push(o); } });
  const restore = () => fx.forEach((o) => { o.visible = true; });
  exporter.parse(car.root, (res) => { restore(); download(new Blob([res], { type: 'model/gltf-binary' }), `${slug()}.glb`); toast(`Exported ${slug()}.glb`); },
    (err) => { restore(); toast(`Export failed: ${(err && err.message) || err}`, true); }, { binary: true, onlyVisible: true });
}
async function shareLink() {
  const code = await encodeDesign(store.d);
  const url = `${location.href.split('#')[0]}#d=${code}`;
  history.replaceState(null, '', `#d=${code}`);
  try { await navigator.clipboard.writeText(url); toast('Share link copied. Anyone who opens it gets this exact design.'); }
  catch (e) { toast('Share link is in the address bar: copy it from there.'); }
  return url;
}
app.shareLink = shareLink;

/* ------------------------------------------------------------------ driving (ported from v1) */
const drive = { on: false, v: 0, steer: 0, keys: new Set(), dragging: false };
const DRIVE_KEYS = new Set(['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright']);
function setDrive(on) {
  if (on && store.E.blank) { toast('Pick a vehicle first'); return; }
  drive.on = on;
  document.body.classList.toggle('driving', on);
  $('#hud').hidden = !on;
  drive.keys.clear();
  onResize();
  if (on) {
    if (app.view === 'packed') { app.view = 'hero'; rebuildOverlays(); }
    app.view = 'chase'; applyVisibility();
    const pose = viewPose('chase', screenFrame(30));
    flyTo(toWorld(pose.p), toWorld(pose.t), false, 30);
    $('#gl').focus();
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
  const VMAX = R('playaSpeedMph') * 0.44704, VREV = -1.0;
  if (fwd) drive.v = Math.min(VMAX, drive.v + (drive.v < 0 ? 2.6 : 1.0) * dt);
  else if (back) drive.v = Math.max(VREV, drive.v - (drive.v > 0 ? 2.6 : 0.8) * dt);
  else { drive.v *= Math.pow(0.4, dt); if (Math.abs(drive.v) < 0.02) drive.v = 0; }
  const want = (left ? 1 : 0) - (right ? 1 : 0);
  drive.steer += (want * 0.5 - drive.steer) * Math.min(1, dt * 3.5);
  carRoot.rotation.y += drive.v * Math.tan(drive.steer) / store.E.g.wheelbase * dt;
  const hd = carRoot.rotation.y;
  const delta = new T.Vector3(Math.cos(hd), 0, -Math.sin(hd)).multiplyScalar(drive.v * dt);
  carRoot.position.add(delta); car.extras.position.add(delta);
  if (tween) { tween.fromT.add(delta); tween.toT.add(delta); }
  else {
    camera.position.add(delta); controls.target.add(delta);
    if (!drive.dragging && Math.abs(drive.v) > 0.05) {
      const sph = new T.Spherical().setFromVector3(camera.position.clone().sub(controls.target));
      let d = Math.atan2(-Math.cos(hd), Math.sin(hd)) - 0.3 - sph.theta; d = ((d + Math.PI) % TAU + TAU) % TAU - Math.PI;
      sph.theta += d * Math.min(1, dt * 0.9);
      camera.position.setFromSpherical(sph).add(controls.target);
    }
  }
  for (const w of car.wheels) { if (w.front) w.pivot.rotation.y = drive.steer; if (w.spin) w.spin.rotation.z -= drive.v * dt / store.E.g.wheelR; }
  $('#speedOut').textContent = (Math.abs(drive.v) / 0.44704).toFixed(1);
}

/* ------------------------------------------------------------------ wiring */
function togglePanel(force) {
  const hidden = force === true ? false : force === false ? true : !document.body.classList.contains('panel-hidden');
  document.body.classList.toggle('panel-hidden', hidden);
  $('#panelToggle').setAttribute('aria-expanded', String(!hidden));
  onResize();
  if (!app.userMoved && !drive.on) setView(app.view);
}
function wire() {
  $('#designName').addEventListener('input', (e) => { store.d.name = e.target.value; setValue('name', e.target.value, { live: true }); });
  $('#startBtn').addEventListener('click', () => openStart());
  const menu = $('#fileMenu');
  $('#fileBtn').addEventListener('click', (e) => { e.stopPropagation(); menu.hidden = !menu.hidden; $('#fileBtn').setAttribute('aria-expanded', String(!menu.hidden)); });
  document.addEventListener('click', (e) => { if (!menu.hidden && !menu.contains(e.target)) { menu.hidden = true; $('#fileBtn').setAttribute('aria-expanded', 'false'); } });
  $('#saveBtn').addEventListener('click', () => { download(new Blob([JSON.stringify({ app: 'art-car-studio', version: 2, design: store.d }, null, 2)], { type: 'application/json' }), `${slug()}.artcar.json`); toast(`Saved ${slug()}.artcar.json`); menu.hidden = true; });
  $('#openBtn').addEventListener('click', () => { $('#openInput').click(); menu.hidden = true; });
  $('#openInput').addEventListener('change', async (e) => {
    const file = e.target.files && e.target.files[0]; e.target.value = '';
    if (!file) return;
    try { loadDesign(openFile(JSON.parse(await file.text())), `Opened ${file.name}`); }
    catch (err) { toast(`Couldn’t open ${file.name}. Choose a .artcar.json file saved from the studio (v1 or v2).`, true); }
  });
  $('#shareBtn').addEventListener('click', () => { shareLink(); menu.hidden = true; });
  $('#glbBtn').addEventListener('click', () => { exportGLB(); menu.hidden = true; });
  $('#newBtn').addEventListener('click', () => { app.newBlank(); menu.hidden = true; });
  $('#undoBtn').addEventListener('click', () => { toast(undo() ? 'Undid the last change' : 'Nothing to undo'); menu.hidden = true; });
  $('#compareBtn').addEventListener('click', () => {
    app.compareOn = !app.compareOn;
    if (app.compareOn && !app.compare.length) app.compare.push(JSON.parse(JSON.stringify(store.d)));
    renderCompare(); setView(app.view);
  });
  document.querySelectorAll('#moodSeg button').forEach((b) => b.addEventListener('click', () => setValue('view.mood', b.dataset.mood)));
  document.querySelectorAll('#unitSeg button').forEach((b) => b.addEventListener('click', () => setValue('view.units', b.dataset.units)));
  $('#panelToggle').addEventListener('click', () => togglePanel());
  $('#prevBtn').addEventListener('click', () => goStep(store.step - 1));
  $('#nextBtn').addEventListener('click', () => (store.step === STEPS.length - 1 ? toast('That’s every step. Share the link or render a sheet to take it to camp.') : goStep(store.step + 1)));
  $('#renderBtn').addEventListener('click', renderImage);
  $('#sheetBtn').addEventListener('click', renderSheet);
  $('#sheetDownload').addEventListener('click', () => { if (sheetUrl) download(sheetUrl, `${slug()}-sheet.png`); });
  $('#driveBtn').addEventListener('click', () => setDrive(true));
  $('#parkBtn').addEventListener('click', () => setDrive(false));
  document.querySelectorAll('dialog').forEach((d) => d.addEventListener('click', (e) => { if (e.target === d || e.target.hasAttribute('data-close')) d.close(); }));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') hideExplain(); });
  const typing = (e) => /^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName) && e.target.type !== 'range' && e.target.type !== 'checkbox';
  window.addEventListener('keydown', (e) => {
    if (typing(e)) return;
    const key = e.key.toLowerCase();
    if (drive.on) { if (DRIVE_KEYS.has(key)) { drive.keys.add(key); e.preventDefault(); } if (key === 'escape') setDrive(false); return; }
    if (/^[1-9]$/.test(e.key) && !e.metaKey && !e.ctrlKey && !e.altKey) { const v = VIEWS[parseInt(e.key, 10) - 1]; if (v) setView(v.id); }
  });
  window.addEventListener('keyup', (e) => drive.keys.delete(e.key.toLowerCase()));
  window.addEventListener('blur', () => drive.keys.clear());
  document.querySelectorAll('#drivePad button').forEach((b) => {
    const on = (e) => { e.preventDefault(); drive.keys.add(b.dataset.key); b.classList.add('on'); };
    const off = () => { drive.keys.delete(b.dataset.key); b.classList.remove('on'); };
    b.addEventListener('pointerdown', on);
    ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => b.addEventListener(ev, off));
  });
  window.addEventListener('resize', () => { onResize(); if (!app.userMoved && !drive.on && app.view !== 'chase') setView(app.view, true); });
  window.addEventListener('hashchange', loadFromHash);
  if (matchMedia('(pointer:coarse)').matches) $('#captionHint').textContent = 'Drag to orbit, pinch to zoom';
}
async function loadFromHash() {
  const m = location.hash.match(/^#d=([A-Za-z0-9_-]+)/);
  if (!m) return false;
  try { const d = sanitize(await decodeDesign(m[1])); loadDesign(d, `Opened a shared design: ${d.name}`); return true; }
  catch (e) { toast('That share link didn’t decode. It may be cut off.', true); return false; }
}

/* ------------------------------------------------------------------ boot */
async function boot() {
  makeMaterials(); makeV2Materials();
  buildViewButtons();
  wire();
  if (innerWidth <= 900) document.body.classList.add('panel-hidden');
  store.d = loadInitial();
  app.saved = savedDesign();
  stageLayers();
  store.E = evaluate(store.d, { trusted: true });
  $('#designName').value = store.d.name;
  refreshTopbar();
  rebuildCar();
  renderScorecard($('#scorecard'), goStep);
  renderStepper(); renderPanel(true);
  onResize();
  setView('hero', true);
  lastVehicle = store.d.vehicle.id;
  await loadFromHash();
  requestAnimationFrame(frame);
}
let last = performance.now(), frames = 0, paused = false;
function frame(now) {
  if (paused) { requestAnimationFrame(frame); return; }
  const dt = Math.min(0.05, Math.max(0, (now - last) / 1000)); last = now;
  LED_U.uTime.value += dt;
  stepTween(now);
  if (drive.on) updateDrive(dt);
  controls.update();
  updateFrameUniforms();
  sky.position.copy(camera.position); stars.position.copy(camera.position);
  sun.target.position.copy(carRoot.position); sun.position.copy(carRoot.position).addScaledVector(sunDir, 45); sun.target.updateMatrixWorld();
  composer.render(dt);
  if (++frames === 2) $('#loading').classList.add('done');
  requestAnimationFrame(frame);
}
window.__studio = {
  store, app, setValue, setDesign, evaluate, setView, goStep, renderSheet, exportGLB, shareLink, setDrive, loadCard: (id, w) => loadCard(CARDS.find((c) => c.id === id), w),
  starters: STARTERS.map((s) => s.id), loadStarter: (id) => loadDesign(STARTERS.find((s) => s.id === id).build(), 'Loaded'), newBlank: () => app.newBlank(),
  pause: (v) => { paused = v; }, car,
  snap: () => {
    tween = null; controls.update(); updateFrameUniforms();
    sky.position.copy(camera.position); stars.position.copy(camera.position);
    composer.render(0.016);
    return renderer.domElement.toDataURL('image/png');
  },
  ready: false,
};
boot().then(() => { window.__studio.ready = true; }).catch((e) => { console.error(e); $('#loading').textContent = `The studio failed to start: ${e.message}`; });
