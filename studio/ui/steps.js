/* The nine step panels. Each renders controls and live readouts from the engine's evaluation. */
import { h, range, toggle, choice, chips, color, stats, table, L } from './widgets.js';
import { store, setValue } from './store.js';
import { FIELDS, getPath } from '../engine/fields.js';
import { fmtWeight, fmtLen, fmtInches, fmtArea, TIER_COST, TIER_EFFORT } from '../engine/units.js';
import { evaluate, STEPS } from '../engine/evaluate.js';
import { starterDesign, activeKits, bunkHeadroom } from '../engine/state.js';
import { kitStatus, optionStatus } from '../engine/eligibility.js';
import { stepTier } from '../engine/tiers.js';
import { VEHICLES, VEHICLE_IDS, FAMILIES, SPEC_FIELDS } from '../catalogs/vehicles.js';
import { KITS, TUBE_BUILDS } from '../catalogs/kits.js';
import { TRAILERS } from '../catalogs/trailers.js';
import { MATERIALS } from '../catalogs/materials.js';
import { R, HANDBOOK_URL } from '../catalogs/rules.js';

const u = () => store.d.view.units;
const W = (kg) => fmtWeight(kg, u());
const IN = (m) => fmtInches(m, u());
const pct = (x) => `${Math.round(x * 100)}%`;
const statusTag = (st, text) => h('span', { class: 'tag ' + st }, text);
const box = (cls, ...kids) => h('div', { class: 'box ' + (cls || '') }, ...kids);
const stepFlags = (i) => (store.E.flags || []).filter((f) => f.step === i).map((f) => box(f.severity === 'red' ? 'bad' : 'warn', h('strong', {}, f.title), h('div', { class: 'note' }, f.detail)));

/* ------------------------------------------------------------------ vehicle fit, cached */
const fitCache = new Map();
export function vehicleFit(id, brief) {
  const key = id + '|' + JSON.stringify(brief);
  if (fitCache.has(key)) return fitCache.get(key);
  const d = starterDesign(id); d.brief = brief;
  const E = evaluate(d, { viewCone: false });
  const ok = (x) => x.tip.ssf >= R('tipRed') && x.w.buildKg + R('riderKg') <= x.rc.payloadKg;
  const sd = JSON.parse(JSON.stringify(d)); sd.upper.kind = 'stand'; sd.upper.headroom = Math.max(1.95, sd.upper.headroom);
  const bd = JSON.parse(JSON.stringify(d)); bd.upper.kind = 'bunk'; bd.upper.headroom = bunkHeadroom(bd);
  const deck = ok(evaluate(sd, { viewCone: false })) ? 'yes' : ok(evaluate(bd, { viewCone: false })) ? 'low bunk only' : 'no';
  const r = { riders: E.rc.cap, deck, typical: E };
  fitCache.set(key, r);
  return r;
}
function powertrainOk(C, pref) { return pref === 'either' || (pref === 'electric' ? C.powertrain === 'electric' : C.powertrain !== 'electric'); }

/* ------------------------------------------------------------------ step 0: brief */
function brief() {
  const b = store.d.brief;
  return [
    h('p', { class: 'note' }, 'The brief only sets targets. The scorecard compares the design against them.'),
    range('brief.ridersMin', { outFn: (x) => `${Math.round(x)}` }),
    range('brief.ridersMax', { outFn: (x) => `${Math.round(x)}` }),
    choice('brief.budget', { status: () => ({}) }),
    choice('brief.effort', { status: () => ({}) }),
    choice('brief.powertrain', { status: () => ({}), note: 'Vehicles that don’t match are hidden in the vehicle step.' }),
    choice('brief.age', { status: () => ({}) }),
    choice('brief.transport', { status: () => ({}) }),
    chips('brief.vibes', { note: 'Picking a vibe pre-selects matching layout options in step 5.' }),
    chips('brief.skills', { note: 'Kits that need a skill the crew doesn’t list get an amber note.' }),
    box('', h('strong', {}, `Targets: ${b.ridersMin === b.ridersMax ? b.ridersMax : `${b.ridersMin}–${b.ridersMax}`} riders, ${TIER_COST[b.budget]}, ${TIER_EFFORT[b.effort]} effort.`),
      h('div', { class: 'note' }, 'Cost and effort are relative tiers only, never dollars or hours.')),
  ];
}

/* ------------------------------------------------------------------ step 1: vehicle */
function vehicle(app) {
  const d = store.d, E = store.E, C = E.C, pref = d.brief.powertrain;
  const fam = app.ui.family || C.family;
  const inFam = VEHICLE_IDS.map((id) => VEHICLES[id]).filter((v) => v.family === fam);
  const shown = inFam.filter((v) => powertrainOk(v, pref) || v.id === C.id);
  const hidden = inFam.length - shown.length;
  const famSeg = h('div', { class: 'seg wide', role: 'group', 'aria-label': 'Vehicle family' }, FAMILIES.map((f) => h('button', { type: 'button', 'aria-pressed': String(f.id === fam), onclick: () => { app.ui.family = f.id; app.rerender(); } }, f.label)));
  const famNote = FAMILIES.find((f) => f.id === fam).note;
  const cards = h('div', { class: 'cards' }, shown.map((v) => {
    const fit = app.fitReady(v.id) ? vehicleFit(v.id, d.brief) : null;
    const tags = [{ text: v.powertrain }, { text: `${W(v.payloadLb / 2.20462)} payload`, cls: v.confidence.payloadLb || 'estimate' }];
    if (fit) tags.push({ text: `about ${fit.riders} riders after a typical build`, cls: fit.riders >= d.brief.ridersMin ? 'ok' : 'amber' }, { text: `upper deck: ${fit.deck}`, cls: fit.deck === 'yes' ? 'ok' : fit.deck === 'no' ? 'red' : 'amber' });
    if (!powertrainOk(v, pref)) tags.push({ text: 'doesn’t match the brief', cls: 'amber' });
    return h('button', { type: 'button', class: 'ocard', 'aria-pressed': String(v.id === C.id), onclick: () => { if (v.id !== C.id) { setValue('vehicle.id', v.id); app.afterVehicleSwitch(); } } },
      h('div', { class: 't' }, h('span', {}, v.short), h('span', { class: 'tag' }, `${v.wheelbaseOptions.map((w) => Math.round(w / 0.0254) + '″').join(' / ')} WB`)),
      h('div', { class: 'd' }, v.summary), h('div', { class: 'meta' }, tags.map((t) => h('span', { class: 'tag ' + (t.cls || '') }, t.text))));
  }));
  const ch = store.lastChanges;
  const spec = SPEC_FIELDS.map(([k, lab]) => {
    const conf = C.confidence[k] || 'estimate', src = C.sources[k] || 'Studio estimate, needs a source';
    const val = { payloadLb: W(C.payloadLb / 2.20462), gvwrLb: W(C.gvwrLb / 2.20462), curbLb: W(C.curbLb / 2.20462), wheelbase: L(E.s.wheelbase), track: C.track.front === C.track.rear ? L(C.track.front) : `${L(C.track.front)} front, ${L(C.track.rear)} rear`,
      tire: `${C.tire.size}, ${L(C.tire.diameter)}${C.tire.dualRear ? ', dual rear' : ''}`, frameHeight: L(C.frameHeight), ca: C.style === 'cart' ? 'n/a' : L(E.s.wheelbase + C.cab.back), ba: L(C.ba),
      length: L(C.ba + E.s.wheelbase + C.af), width: L(C.width), topSpeedMph: C.topSpeedMph ? `${C.topSpeedMph} mph` : '—', powertrain: C.powertrain }[k];
    return [lab, h('span', {}, val, ' ', h('span', { class: 'tag ' + conf, title: src }, conf))];
  });
  const fit = vehicleFit(C.id, d.brief);
  return [
    famSeg, h('p', { class: 'note' }, famNote),
    hidden ? box('warn', `${hidden} ${hidden === 1 ? 'vehicle is' : 'vehicles are'} hidden by the brief’s powertrain preference (${pref}). Change it in the brief to see them.`) : null,
    cards,
    h('h3', {}, C.label),
    ch.length ? box('warn', h('strong', {}, 'Switching kept your choices and changed:'), h('ul', {}, ch.map((c) => h('li', {}, `${FIELDS[c.path].label}: ${L(c.from)} → ${L(c.to)}${c.atMax ? ' (chassis max)' : ''}`)))) : null,
    C.wheelbaseOptions.length > 1 && !d.vehicle.whatIf ? choice('vehicle.wheelbase', { label: 'Wheelbase', options: C.wheelbaseOptions.map((w) => [w, `${Math.round(w / 0.0254)}″ (${L(w)})`]), status: () => ({}), select: true }) : null,
    box('', h('strong', {}, 'Fit to the brief'), stats([
      ['Riders', `payload allows about ${fit.riders} riders after a typical build`],
      ['Upper deck', `typical: ${fit.deck}`],
      ['Deck height', `${L(E.g.deckY)} (frame plus build-up)`],
    ])),
    h('h3', {}, 'Spec card'), h('p', { class: 'note' }, 'Every value carries a source (hover a badge) and a confidence: spec sheet, measured, or estimate.'),
    stats(spec),
    h('h3', {}, 'Buying notes'),
    stats([['New', C.buying.newAvailable ? 'available' : 'not sold new'], ['Used', C.buying.used], ['Service', C.buying.service], C.buying.knownIssues.length ? ['Known issues', C.buying.knownIssues.join('; ')] : null]),
    h('div', { class: 'chips' },
      h('button', { type: 'button', class: 'chip', 'aria-pressed': String(app.overlays.dims), onclick: () => app.toggleOverlay('dims') }, 'Dimensions overlay'),
      h('button', { type: 'button', class: 'chip', onclick: () => app.openVehicleTable(fam) }, 'Compare vehicles'),
      h('button', { type: 'button', class: 'chip', onclick: () => app.pickSilhouette() }, app.overlays.silhouette ? 'Replace reference image' : 'Reference silhouette…')),
    app.overlays.silhouette ? h('div', {}, range('vehicle.wheelbase', { label: 'Reference image length', lim: [2, 14], value: app.overlays.silLen, outFn: (x) => L(x), set: (x) => app.setSilhouette({ len: x }) }),
      range('vehicle.wheelbase', { label: 'Slide the image', lim: [-4, 4], value: app.overlays.silX, outFn: (x) => L(x), set: (x) => app.setSilhouette({ x }) }),
      h('button', { type: 'button', class: 'btn small', onclick: () => app.setSilhouette(null) }, 'Remove reference image')) : null,
    h('details', { class: 'more', open: d.vehicle.whatIf || null }, h('summary', {}, 'What-if: change the chassis numbers'),
      toggle('vehicle.whatIf', { note: 'Explore a configuration the catalog doesn’t list. The spec card keeps the catalog values.' }),
      d.vehicle.whatIf ? [range('vehicle.wheelbase'), range('vehicle.track'), range('vehicle.wheelDia'), range('vehicle.frameHeight')] : null),
    ...stepFlags(1),
  ];
}

/* ------------------------------------------------------------------ step 2: strip down */
function strip() {
  const d = store.d, E = store.E, C = E.C, cart = C.style === 'cart';
  const legal = E.tr.legal;
  if (cart) return [
    h('p', { class: 'note' }, `The ${C.short} is a low-speed vehicle: not road legal at any strip level, always hauled.`),
    toggle('strip.rops', { note: d.strip.rops ? 'The factory roll bar and canopy stay over the seats. The roof can’t cover the driver.' : 'Removed: the art structure must provide rollover protection for the driver.' }),
    toggle('strip.bed', { note: d.strip.bed ? 'The deck rides on the stock bed (the v1 assumption).' : 'Without the bed, the deck sits about 4″ lower on the frame and needs a heavier frame of its own.' }),
    box('', stats([['Road legal', 'no, low-speed vehicle', 'red'], ['Headlights', 'stay at the factory location in the cowl'], ['Deck height', L(E.g.deckY)], ['Teardown', `${TIER_COST[stepTier(E.tiers.perStep[2]?.points[0] || 0)]} cost, ${TIER_EFFORT[stepTier(E.tiers.perStep[2]?.points[1] || 0)]} effort`]])),
    ...stepFlags(2),
  ];
  const DESC = {
    stock: ['Stock', 'Cab, doors, windshield, mirrors and bumper stay. Road legal if lights and mirrors stay; you can drive it there. The cab limits the deck and the driver area.'],
    cut: ['Cut at the windshield base (Pingüina)', 'Cab shell off; hood, fenders, factory dash, steering column, floor pan and driver’s seat stay. The bumper goes. Not road legal: it must be hauled. The passenger seat goes if the front ladder needs its spot.'],
    rails: ['Strip to frame rails', 'Everything above the frame goes except the driver’s controls and seat on a new platform. Most freedom, most work. The engine needs its own cover.'],
  };
  return [
    choice('strip.level', { cards: true, options: Object.entries(DESC).map(([k, [t, desc]]) => [k, t, desc, { tags: [{ text: k === 'stock' ? 'drive it there' : 'must be hauled', cls: k === 'stock' ? 'ok' : 'amber' }] }]) }),
    box('', h('strong', {}, 'Consequences'), stats([
      ['Road legal', legal.ok ? 'yes: stock cab, lights and mirrors' : `no: ${legal.why}`, legal.ok ? '' : 'amber'],
      ['What remains', { stock: 'the whole cab', cut: 'hood, fenders, dash, steering, floor and seats', rails: 'frame, running gear, engine and the driver’s controls' }[d.strip.level]],
      ['Engine cover', d.strip.level === 'rails' ? 'needed: add a front kit in step 6' : 'not needed: the hood stays'],
      ['Headlights', 'stay at the factory location in every option'],
      ['Teardown', `${TIER_COST[stepTier(E.tiers.perStep[2]?.points[0] || 0)]} cost, ${TIER_EFFORT[stepTier(E.tiers.perStep[2]?.points[1] || 0)]} effort`],
    ])),
    ...stepFlags(2),
  ];
}

/* ------------------------------------------------------------------ step 3: structure */
function structure() {
  const d = store.d, E = store.E, g = E.g, lim = E.limits;
  const STY = {
    'deck-posts': ['Deck and posts', 'A flat deck on the frame with perimeter posts carrying a roof or upper deck. Slug-style scaffold.'],
    cage: ['Full cage (Pingüina)', 'A cage that wraps the whole vehicle including the front: attachment points everywhere for design structure.'],
    barge: ['Low party barge', 'A deck only, with rails: no posts, no roof.'],
    'bed-ext': ['Cart bed extension', 'A lighter frame extending a cart’s stock bed. Carts only.'],
  };
  const b = g.bom, ft = (m) => `${Math.round(m * 3.281).toLocaleString('en-US')} ft`, sheets = (m2, w) => Math.ceil(m2 * (1 + w) / 2.973);
  const frameKg = E.w.kg.steel;
  const cut = [
    [g.cartFrame ? '1½″ square tube, 14 ga' : '2″ square tube, 14 ga', `${ft(b.deckFrame)}, deck frame and sub-frame`],
    ['1½″ square tube, 14 ga', `${ft(b.post + (b.cage || 0))}, posts, headers${b.cage ? ', cage' : ''}`],
    b.roofFrame ? [`1½″ square tube, 16 ga${d.structure.material === 'alu' ? ' (aluminum)' : ''}`, `${ft(b.roofFrame)}, roof frame`] : null,
    b.rail ? ['1¼″ rail tube', ft(b.rail)] : null,
    b.stairs ? ['Stair treads', `${b.stairs}`] : null,
    ['¾″ plywood', `${sheets(b.ply34, 0.1)} sheets`],
    b.ply12 ? ['½″ plywood', `${sheets(b.ply12, 0.1)} sheets`] : null,
    b.cloth ? ['Shade cloth', fmtArea(b.cloth, u())] : null,
  ];
  return [
    box('', h('div', { class: 'note' }, 'Deck height, frame plus build-up: it drives the upper deck and transport.'), h('div', { class: 'big' }, L(g.deckY))),
    choice('structure.style', { cards: true, options: Object.entries(STY).map(([k, [t, desc]]) => [k, t, desc]) }),
    range('structure.length', { lim: lim.length }),
    range('structure.width', { lim: lim.width, note: E.s.hasTubes ? `The deck is ${L(g.floorW)} wide inside the side tubes.` : 'Without side tubes the deck takes the whole width.' }),
    range('structure.bodyFront', { lim: lim.bodyFront }),
    g.hasRoof ? range('structure.roofOverhang') : null,
    g.hasRoof ? range('structure.posts') : null,
    g.hasRoof && d.structure.style !== 'cage' ? toggle('structure.frontPosts', { note: 'Off by default: an open front like Pingüina. A pair always stands right behind the driver.' }) : null,
    choice('structure.material', { status: () => ({}) }),
    choice('structure.powerBay', { select: true }),
    choice('structure.powerBaySize', { status: () => ({}) }),
    box('', h('strong', {}, 'Output'), stats([
      ['Frame weight', `${W(frameKg)} of steel (±30%)`],
      ['Rear overhang', `${L(g.rearOverhang)} of ${L(lim.rearMax)} allowed (${pct(g.rearOverhang / E.s.wheelbase)} of wheelbase)`],
      ['Wheel wells', g.deckY - 0.12 < g.cutY ? 'humps where the floor sits below the tires plus travel' : 'not needed: the floor clears the tires'],
      ['Cost and effort', `${TIER_COST[stepTier(E.tiers.perStep[3]?.points[0] || 0)]}, ${TIER_EFFORT[stepTier(E.tiers.perStep[3]?.points[1] || 0)]}`],
    ])),
    h('h3', {}, 'Rough cut list'), stats(cut.filter(Boolean)),
    h('p', { class: 'note' }, 'Planning quantities counted from the model: 4 × 8 ft sheets with waste allowed. Steel sizes are typical choices, not an engineered spec.'),
    ...stepFlags(3),
  ];
}

/* ------------------------------------------------------------------ step 4: upper deck */
function segmentEditor() {
  const segs = store.d.upper.segments;
  const tot = segs.reduce((a, s) => a + s.len, 0);
  const set = (next) => setValue('upper.segments', next);
  return h('div', { class: 'row' },
    h('div', { class: 'row-head' }, h('span', { class: 'l' }, 'Segments, back to front')),
    h('div', { class: 'segbar' }, segs.map((s) => h('div', { class: s.kind, style: `flex:${s.len}` }, s.kind === 'deck' ? 'ride' : s.kind))),
    ...segs.map((s, i) => h('div', { class: 'row' },
      h('div', { class: 'seg wide' }, ['deck', 'shade', 'open'].map((k) => h('button', { type: 'button', 'aria-pressed': String(s.kind === k), onclick: () => set(segs.map((x, j) => (j === i ? { ...x, kind: k } : x))) }, { deck: 'Rideable', shade: 'Shade only', open: 'Open' }[k])),
        segs.length > 1 ? h('button', { type: 'button', onclick: () => set(segs.filter((_, j) => j !== i)) }, 'Remove') : null),
      range('upper.headroom', { label: `Segment ${i + 1} share`, lim: [0.3, 6], value: s.len, outFn: (x) => `${Math.round(x / tot * 100)}% of the roof`, set: (x, live) => setValue('upper.segments', segs.map((y, j) => (j === i ? { ...y, len: x } : y)), { live }) }))),
    segs.length < 8 ? h('button', { type: 'button', class: 'btn small', onclick: () => set([...segs, { kind: 'shade', len: 1 }]) }, 'Add a segment at the front') : null,
    h('div', { class: 'note' }, 'Rideable segments get decking and rails; shade segments get cloth or a solid roof; open segments keep only the frame. Pingüina is rideable in the middle with shade cloth at both ends.'));
}
function upper() {
  const d = store.d, E = store.E, g = E.g, kind = d.upper.kind;
  const KIND = {
    none: ['None', 'A roof or shade canopy only.'],
    bunk: ['Low bunk', 'A top deck to sit and lie on, over a lower level you sit under (about 3–4′ clear). On carts it keeps the deck floor under 84″.'],
    stand: ['Stand-under deck', 'Standing headroom below (about 6′5″). On trucks the deck lands near 10′: rails required, transport depends on removable rails.'],
  };
  const floor = g.decks.length ? g.dTop : g.deckY;
  const line = R('dmvDeckHeight');
  const span = Math.max(floor, line) * 1.15;
  const hr = d.upper.headroom;
  const hLim = kind === 'bunk' ? [0.9, 1.84] : kind === 'stand' ? [1.85, 2.5] : [1.1, 2.5];
  const rows = E.tr.options.filter((o) => o.id !== 'drive').map((o) => ({ cells: [o.short, L(o.haulH), { cls: o.status, text: o.margins.height >= 0 ? `${IN(o.margins.height)} to spare` : `${IN(-o.margins.height)} over` }], sel: o.id === d.transport.trailer }));
  return [
    choice('upper.kind', { cards: true, options: Object.entries(KIND).map(([k, [t, desc]]) => [k, t, desc]) }),
    g.hasRoof ? range('upper.headroom', { lim: hLim, label: kind === 'none' ? 'Clear height under the canopy' : 'Clear height below the deck' }) : null,
    kind !== 'none' && g.hasRoof ? h('div', {},
      h('div', { class: 'gauge', title: 'Deck floor height against the DMV’s 84″ line' },
        h('div', { class: 'fill', style: `width:${Math.min(100, floor / span * 100)}%;background:${floor >= line ? 'var(--amber)' : 'var(--ok)'}` }),
        h('div', { class: 'mark', style: `left:${line / span * 100}%` }, h('span', {}, '84″ line'))),
      h('div', { class: 'note' }, floor >= line ? `Deck floor ${L(floor)} up, ${IN(floor - line)} over the 84″ line: 36–48″ rails required.` : `Deck floor ${L(floor)} up, ${IN(line - floor)} under the 84″ line: rails not required (a low lip rail is still a good idea).`),
      choice('upper.coverage', { status: () => ({}) }),
      d.upper.coverage === 'mid' ? [range('upper.shadeFront'), range('upper.shadeRear')] : null,
      d.upper.coverage === 'modular' ? segmentEditor() : null,
      range('upper.railHeight'),
      choice('upper.access', { select: true }),
      d.upper.access === 'ladder-front' || d.upper.access === 'stairs' ? choice('upper.hatchSide', { status: () => ({}) }) : null,
    ) : null,
    g.hasRoof ? choice('upper.roofShade', { status: () => ({}) }) : null,
    g.hasRoof ? toggle('upper.railsRemovable') : null,
    g.hasRoof ? toggle('upper.roofRemovable') : null,
    h('h3', {}, 'Live checks'),
    stats([
      ['Tipping', `${E.tip.ssf.toFixed(2)} g, roof filled first`, E.tip.ssf < R('tipRed') ? 'red' : E.tip.ssf < R('tipAmber') ? 'amber' : ''],
      ['Payload left', `${W(E.rc.payloadKg - E.w.buildKg - (E.rc.riders + 1) * R('riderKg'))}`],
      ['Deck', g.decks.length ? `${g.decks.map((x) => L(x.dx1 - x.dx0)).join(' + ')} rideable` : 'none'],
    ]),
    h('div', { class: 'note' }, `Hauled height on each trailer${d.upper.railsRemovable ? ', rails off' : ''}${d.upper.roofRemovable ? ', roof off' : ''}:`),
    table(['Trailer', 'Height', 'Under 13′6″'], rows),
    ...stepFlags(4),
  ];
}

/* ------------------------------------------------------------------ step 5: layout */
function layout() {
  const d = store.d, E = store.E, g = E.g, rc = E.rc;
  return [
    h('h3', {}, 'Lower level'),
    choice('layout.seating', { select: true }),
    d.layout.seating !== 'platform' ? range('layout.seatDepth') : null,
    choice('layout.standing', { select: true, note: g.hasRoof && d.upper.headroom < R('standHeadroom') ? 'No standing below: the headroom is under 6′1″.' : null }),
    g.hasRoof ? choice('layout.curtains', { status: () => ({}) }) : null,
    g.hasRoof && d.layout.curtains !== 'none' ? toggle('layout.curtainsDrawn') : null,
    choice('layout.rear', { select: true }),
    d.layout.rear !== 'none' ? range('layout.rearLen') : null,
    h('h3', {}, 'Zones'),
    choice('layout.dj', {}), choice('layout.bar', {}), choice('layout.storage', {}),
    h('h3', {}, 'Entries and extras'),
    toggle('layout.driverStep'),
    choice('layout.secondStep', {}),
    d.layout.secondStep !== 'none' ? range('layout.secondStepPos') : null,
    choice('layout.bikeRack', { select: true }),
    d.layout.bikeRack !== 'none' ? range('layout.bikes') : null,
    g.decks.length ? [h('h3', {}, 'Upper level'), choice('layout.upperSeating', { select: true })] : null,
    box('', h('strong', {}, rc.capped ? `Riders ${rc.riders}, payload-limited, room for ${rc.room}` : `Riders ${rc.riders}`), stats([
      [d.layout.seating === 'platform' ? 'On the platform' : 'Seated below', `${g.seatsLow}`],
      ['Standing below', `${g.standLow}`],
      ['Upper level', `${g.seatsRoof} seated, ${g.standRoof} standing`],
      ['Payload allows', `${rc.cap} plus the driver`],
      g.zones.length ? ['Zones', g.zones.map((z) => z.name).join(', ')] : null,
    ]), h('div', { class: 'note' }, 'Seats, plus standing riders by open floor at the chosen density, plus platform riders at about 4½ sq ft each; then capped by payload.')),
    ...stepFlags(5),
  ];
}

/* ------------------------------------------------------------------ step 6: design */
const SLOT_LABEL = { front: 'Front kit', side: 'Side kit', full: 'Full-body shell', train: 'Train', theme: 'Theme kit' };
function kitParams(slot, k) {
  const def = KITS[k.id];
  return Object.entries(def.params || {}).map(([key, f]) => {
    const path = `kits.${slot}.p.${key}`;
    if (f.type === 'num' || f.type === 'int') return range(path, { ...f, value: k.p[key], set: (x, live) => setValue(path, f.type === 'int' ? Math.round(x) : x, { live }) });
    if (f.type === 'bool') return toggle(path, { label: f.label, value: k.p[key], set: (x) => setValue(path, x) });
    return choice(path, { label: f.label, options: f.options, value: k.p[key], status: () => ({}), set: (x) => setValue(path, x), select: f.options.length > 4 });
  });
}
function design(app) {
  const d = store.d, E = store.E, { inactive } = activeKits(d);
  const slots = ['front', 'side', 'full', 'train', 'theme'].map((slot) => {
    const cur = d.kits[slot];
    const ids = ['none', ...Object.values(KITS).filter((k) => k.category === slot).map((k) => k.id)];
    const opts = ids.map((id) => [id, id === 'none' ? 'None' : KITS[id].name]);
    const ina = inactive.find((x) => x.slot === slot);
    const res = E.g.kitResults.find((r) => r.id === cur.id);
    const def = KITS[cur.id];
    const m = def && MATERIALS[cur.p.material];
    const mods = [];
    if (def && !ina) {
      const tiers = def.builtin === 'tubes' ? TUBE_BUILDS[cur.p.build] : null;
      mods.push(box('', h('div', { class: 'note' }, def.explainer),
        stats([
          ['By day', m ? m.day : def.look.day],
          ['By night', m ? m.night : def.look.night],
          ['Weight', res ? `${W(res.kg)}` : def.builtin === 'tubes' ? `${E.g.bom.sections} sections` : 'part of the build'],
          ['Wheels', { 'face-cut': 'faces a tire reaches at full lock are left open', outboard: 'sits outboard of the wheels', 'skirt-above': 'steps up above the tire travel', 'none-needed': 'clear of the wheels' }[def.wheelClearance] + (res && (res.cut.front || res.cut.rear) ? ` (front: ${res.cut.front || 0} faces open, rear: ${res.cut.rear || 0})` : '')],
          ['Rider openings', def.riderOpenings],
          ['Transport', `${def.transport.removable ? 'comes off' : 'stays on'}: ${def.transport.note}`],
          ['Cost, effort', `${TIER_COST[Math.max(def.costTier, m ? m.cost : 0, tiers ? tiers.cost : 0)]}, ${TIER_EFFORT[Math.max(def.effortTier, m ? m.effort : 0, tiers ? tiers.effort : 0)]}`],
        ]),
        m && m.warning ? h('div', { class: 'why' }, m.warning) : null),
      ...kitParams(slot, cur));
    }
    return h('div', {}, h('h3', {}, SLOT_LABEL[slot]),
      choice(`kits.${slot}`, { label: SLOT_LABEL[slot], options: opts, value: cur.id, select: true, status: (id) => kitStatus(E, slot, id) }),
      ina ? box('warn', `Kept but not used: ${ina.reason}.`) : null, ...mods);
  });
  const arch = E.g.archInfo.map((a) => `${a.front ? 'front' : 'rear'}: ${a.split ? 'split around the wheel' : a.n ? `${a.removed} of ${a.n} faces open` : 'cut to clear'}`).join('; ');
  const v = E.view;
  return [
    h('p', { class: 'note' }, 'Design structure carries panels and lights and makes the shape. It never carries people, and the studio never counts it as structure.'),
    ...slots,
    h('h3', {}, 'Checks'),
    stats([
      ['Driver view', v ? `${pct(v.fraction)} of the view cone blocked${v.blockers.length ? `, mostly ${v.blockers[0].name.toLowerCase()}` : ''}` : '—', v && v.fraction > R('viewRed') ? 'red' : v && v.fraction > R('viewAmber') ? 'amber' : ''],
      ['Side tubes at the wheels', E.s.hasTubes ? arch || 'clear of the wheels' : 'no side tubes'],
      ['Width', `${L(E.dims.playa.size()[2])} on the playa, ${L(E.tr.packW)} packed`],
      ['Added weight', W((E.w.kg.design || 0) + E.w.kg.skins)],
    ]),
    h('button', { type: 'button', class: 'btn', onclick: () => app.setView('cockpit') }, 'See it from the driver’s seat'),
    h('h3', {}, 'Colors'),
    ...['frame', 'tube', 'shade', 'fabric', 'accent', 'rug'].map((k) => color('design.colors.' + k)),
    toggle('design.colors.cabMatch'),
    !d.design.colors.cabMatch ? color('design.colors.cab') : null,
    ...stepFlags(6),
  ];
}

/* ------------------------------------------------------------------ step 7: lights and sound */
function lights() {
  const d = store.d, E = store.E, p = E.power;
  return [
    h('h3', {}, 'Light'),
    E.s.hasTubes ? range('lights.ledLines') : null,
    E.s.hasTubes ? choice('lights.ribStyle', { select: true, status: () => ({}) }) : null,
    choice('lights.ledMode', { select: true, status: () => ({}) }),
    color('lights.ledColor'), color('lights.ledColor2'),
    range('lights.ledLevel'),
    E.g.hasRoof ? toggle('lights.pucks') : null,
    E.g.decks.length ? [toggle('lights.projectors'), toggle('lights.neon'), d.lights.neon ? range('lights.neonSize') : null] : null,
    h('h3', {}, 'Sound'),
    choice('lights.speakers', { select: true }),
    d.lights.speakers !== 'none' ? choice('lights.speakerSize', { status: () => ({}) }) : null,
    h('h3', {}, 'Power'),
    choice('lights.power', { status: () => ({}) }),
    range('lights.batteryKwh'),
    box(p.status === 'ok' ? '' : p.status === 'red' ? 'bad' : 'warn', h('strong', {}, 'Power budget, rough'),
      table(['Load', 'Watts'], p.items.map((i) => [i.name + (i.note ? ` (${i.note})` : ''), `${Math.round(i.w)}`])),
      stats([
        ['Total draw', `${Math.round(p.loadW)} W including inverter losses`],
        ['Bank', `${d.lights.batteryKwh} kWh, about ${p.usableKwh.toFixed(1)} usable`],
        p.genW ? ['Generator', `${(p.genW / 1000).toFixed(1)} kW continuous`] : null,
        ['Runtime', Number.isFinite(p.hours) ? `about ${p.hours.toFixed(1)} h per night (${p.need} h wanted)` : 'the generator carries the whole load', p.status === 'ok' ? '' : p.status],
        ['Bank for a full night', `about ${p.recommendKwh} kWh`],
      ])),
    box('', h('div', { class: 'note' }, 'The DMV licenses day and night separately; lighting decides night licensing. See the ', h('a', { href: HANDBOOK_URL, target: '_blank', rel: 'noopener' }, 'Mutant Vehicle Owner’s Handbook'), ' for the current rules.')),
    ...stepFlags(7),
  ];
}

/* ------------------------------------------------------------------ step 8: transport */
function transport(app) {
  const d = store.d, E = store.E, tr = E.tr;
  const diff = ['', 'easy', 'moderate', 'hard'];
  const m = (x, f) => (Number.isFinite(x) ? f(x) : null);
  const optCards = h('div', { class: 'cards' }, tr.options.map((o) => h('button', { type: 'button', class: 'ocard', 'aria-pressed': String(o.id === d.transport.trailer), onclick: () => setValue('transport.trailer', o.id) },
    h('div', { class: 't' }, h('span', {}, TRAILERS[o.id].label), h('span', { class: 'tag ' + (o.fits ? (o.status === 'amber' ? 'amber' : 'ok') : 'red') }, o.fits ? 'fits' : o.problems[0])),
    h('div', { class: 'meta' },
      h('span', { class: 'tag' }, `${diff[o.difficulty]}`),
      h('span', { class: 'tag ' + (o.margins.height < 0 ? 'red' : o.margins.height < R('haulAmberMargin') ? 'amber' : 'ok') }, o.margins.height >= 0 ? `height: ${IN(o.margins.height)} to spare` : `height: ${IN(-o.margins.height)} over`),
      h('span', { class: 'tag ' + (o.margins.width < 0 ? 'red' : 'ok') }, o.margins.width >= 0 ? 'width fits' : `${IN(-o.margins.width)} too wide`),
      m(o.margins.length, (x) => h('span', { class: 'tag ' + (x < 0 ? 'red' : 'ok') }, x >= 0 ? `deck: ${L(x)} spare` : `deck: ${L(-x)} too long`)),
      m(o.margins.weight, (x) => h('span', { class: 'tag ' + (x < 0 ? 'red' : 'ok') }, x >= 0 ? 'rating fits' : 'over the rating'))))));
  const groups = {};
  for (const p of E.teardown.pieces) { const k = p.group + '|' + p.name; groups[k] = groups[k] || { ...p, n: 0 }; groups[k].n++; }
  return [
    h('p', { class: 'note' }, 'Pick how it gets there. Every option shows its margins, not just pass or fail.'),
    optCards,
    h('div', { class: 'note' }, TRAILERS[d.transport.trailer].notes),
    h('button', { type: 'button', class: 'btn', onclick: () => app.setView('packed') }, 'Show it packed on the trailer'),
    stats([
      ['Packed', `${L(tr.packL)} × ${L(tr.packW)} × ${L(tr.packH)} tall, decorations off`],
      ['Vehicle weight', `${W(tr.vehKg)}, chassis plus build`],
    ]),
    h('p', { class: 'note' }, 'Limits: 8′6″ wide and 13′6″ tall, measured from the road with the car on the trailer. Some western states allow 14′; beyond that, oversize permits. Trailer figures are typical and editable in the catalog.'),
    toggle('upper.railsRemovable'), toggle('upper.roofRemovable'),
    h('h3', {}, `Teardown plan: ${TIER_EFFORT[E.teardown.tier]} effort`),
    table(['Piece', 'Count', 'Each', 'People'], Object.values(groups).map((p) => [p.name, `${p.n}`, W(p.kg), `${p.people}`])),
    h('p', { class: 'note' }, `${E.teardown.pieces.length} pieces, ${W(E.teardown.totalKg)} in all. One person lifts about 55 lb comfortably. Many builders store near Reno or the Bay Area between burns.`),
    ...stepFlags(8),
  ];
}

const RENDER = [brief, vehicle, strip, structure, upper, layout, design, lights, transport];
export function renderStep(i, app) {
  const kids = RENDER[i](app);
  return kids.flat().filter(Boolean);
}
export { STEPS };
