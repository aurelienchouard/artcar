/* The nine step panels. Each renders controls and live readouts from the engine's evaluation. */
import { h, range, toggle, choice, chips, color, stats, table, L } from './widgets.js';
import { store, setValue } from './store.js';
import { FIELDS, getPath } from '../engine/fields.js';
import { fmtWeight, fmtLen, fmtInches, fmtArea, TIER_COST, TIER_EFFORT } from '../engine/units.js';
import { evaluate, STEPS } from '../engine/evaluate.js';
import { measure } from '../engine/transport.js';
import { starterDesign, activeKits, bunkHeadroom } from '../engine/state.js';
import { kitStatus, optionStatus } from '../engine/eligibility.js';
import { stepTier, buildOf } from '../engine/tiers.js';
import { VEHICLES, VEHICLE_IDS, FAMILIES, SPEC_FIELDS } from '../catalogs/vehicles.js';
import { KITS, TUBE_BUILDS, BUILDS } from '../catalogs/kits.js';
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
function brief(app) {
  const b = store.d.brief, E = store.E;
  const skills = E.blank ? null : E.skills;
  return [
    E.blank ? box('', h('strong', {}, 'Nothing is built yet.'), h('div', { class: 'note' }, 'Set what you want here, then pick a vehicle in step 1. The 3D view shows only what each step adds: the stock vehicle first, then the structure, the upper deck, the layout, the design and the lights.'),
      app.saved ? h('div', { class: 'chips' }, h('button', { type: 'button', class: 'btn small', onclick: () => app.resume() }, `Resume “${app.saved.name}”`)) : null) : null,
    h('p', { class: 'note' }, 'The brief only sets targets. The scorecard compares the design against them.'),
    range('brief.ridersMin', { outFn: (x) => `${Math.round(x)}` }),
    range('brief.ridersMax', { outFn: (x) => `${Math.round(x)}` }),
    choice('brief.budget', { status: () => ({}) }),
    choice('brief.effort', { status: () => ({}) }),
    choice('brief.powertrain', { status: () => ({}), note: 'Vehicles that don’t match are hidden in the vehicle step.' }),
    choice('brief.transport', { status: () => ({}) }),
    chips('brief.vibes', { note: 'Picking a vibe pre-selects matching layout options in step 5.' }),
    box('', h('strong', {}, `Targets: ${b.ridersMin === b.ridersMax ? b.ridersMax : `${b.ridersMin}–${b.ridersMax}`} riders, ${TIER_COST[b.budget]}, ${TIER_EFFORT[b.effort]} effort.`),
      h('div', { class: 'note' }, 'Cost and effort are relative tiers only, never dollars or hours.')),
    box('', h('strong', {}, 'Crew skills this build needs'),
      skills ? stats(skills.map((k) => [k.label, k.what.join('; ')])) : h('div', { class: 'note' }, 'An output, not an input: it lists what your choices call for once a vehicle is picked.')),
  ];
}

/* ------------------------------------------------------------------ step 1: vehicle */
function vehicle(app) {
  const d = store.d, E = store.E, blank = !!E.blank, C = blank ? null : E.C, pref = d.brief.powertrain;
  const fam = app.ui.family || (C ? C.family : 'cutaway');
  const inFam = VEHICLE_IDS.map((id) => VEHICLES[id]).filter((v) => v.family === fam);
  const shown = inFam.filter((v) => powertrainOk(v, pref) || (C && v.id === C.id));
  const hidden = inFam.length - shown.length;
  const pick = (v) => { if (C && v.id === C.id) return; setValue('vehicle.id', v.id); app.afterVehicleSwitch(blank); };
  const fitTags = (v, fit) => {
    const tags = [{ text: v.powertrain }, { text: `${W(v.payloadLb / 2.20462)} payload`, cls: v.confidence.payloadLb || 'estimate' }];
    if (fit) tags.push({ text: `about ${fit.riders} riders`, cls: fit.riders >= d.brief.ridersMin ? 'ok' : 'amber' }, { text: `upper deck: ${fit.deck}`, cls: fit.deck === 'yes' ? 'ok' : fit.deck === 'no' ? 'red' : 'amber' });
    if (!powertrainOk(v, pref)) tags.push({ text: 'doesn’t match the brief', cls: 'amber' });
    return tags;
  };
  const tagRow = (tags) => h('div', { class: 'meta' }, tags.map((t) => h('span', { class: 'tag ' + (t.cls || '') }, t.text)));

  /* the chosen vehicle: everything about it in one place */
  let yours;
  if (blank) yours = [box('', h('strong', {}, 'Pick a vehicle to build on.'), h('div', { class: 'note' }, 'The 3D view shows it stock, exactly as you’d buy it. Nothing is added until the later steps.'))];
  else {
    const fit = vehicleFit(C.id, d.brief), ch = store.lastChanges;
    const spec = SPEC_FIELDS.map(([k, lab]) => {
      const conf = C.confidence[k] || 'estimate', src = C.sources[k] || 'Studio estimate, needs a source';
      const val = { payloadLb: W(C.payloadLb / 2.20462), gvwrLb: W(C.gvwrLb / 2.20462), curbLb: W(C.curbLb / 2.20462), wheelbase: L(E.s.wheelbase), track: C.track.front === C.track.rear ? L(C.track.front) : `${L(C.track.front)} front, ${L(C.track.rear)} rear`,
        tire: `${C.tire.size}, ${L(C.tire.diameter)}${C.tire.dualRear ? ', dual rear' : ''}`, frameHeight: L(C.frameHeight), ca: C.style === 'cart' ? 'n/a' : L(E.s.wheelbase + C.cab.back), ba: L(C.ba),
        length: L(C.ba + E.s.wheelbase + C.af), width: L(C.width), topSpeedMph: C.topSpeedMph ? `${C.topSpeedMph} mph` : '—', powertrain: C.powertrain }[k];
      return [lab, h('span', {}, val, ' ', h('span', { class: 'tag ' + conf, title: src }, conf))];
    });
    yours = [
      h('div', { class: 'yours' },
        h('div', { class: 'k note' }, 'Your vehicle'),
        h('h3', {}, C.label), h('p', { class: 'note' }, C.summary), tagRow(fitTags(C, fit)),
        C.wheelbaseOptions.length > 1 && !d.vehicle.whatIf ? choice('vehicle.wheelbase', { label: `Wheelbase: the ${C.short} comes in ${C.wheelbaseOptions.length} lengths`, options: C.wheelbaseOptions.map((w) => [w, `${Math.round(w / 0.0254)}″ (${L(w)})`]), status: () => ({}), seg: true, note: 'Pick the one you have or can find. A longer wheelbase gives a longer deck between the axles.' }) : null,
        ch.length ? box('warn', h('strong', {}, 'Switching kept your choices and changed:'), h('ul', {}, ch.map((c) => h('li', {}, `${FIELDS[c.path].label}: ${L(c.from)} → ${L(c.to)}${c.atMax ? ' (chassis max)' : c.ideal ? ' (ideal for this wheelbase)' : ''}`)))) : null,
        stats([
          ['Riders', `payload allows about ${fit.riders} after a typical build`],
          ['Upper deck', `typical build: ${fit.deck}`],
          ['Deck height', `${L(E.g.deckY)} (frame plus build-up)`],
        ])),
      h('details', { class: 'more' }, h('summary', {}, `Spec card and buying notes: ${C.short}`),
        h('p', { class: 'note' }, 'Every value carries a source (hover a badge) and a confidence: spec sheet, measured, or estimate.'),
        stats(spec),
        stats([['New', C.buying.newAvailable ? 'available' : 'not sold new'], ['Used', C.buying.used], ['Service', C.buying.service], C.buying.knownIssues.length ? ['Known issues', C.buying.knownIssues.join('; ')] : null]),
        h('div', { class: 'chips' },
          h('button', { type: 'button', class: 'chip', 'aria-pressed': String(app.overlays.dims), onclick: () => app.toggleOverlay('dims') }, 'Dimensions overlay'),
          h('button', { type: 'button', class: 'chip', onclick: () => app.pickSilhouette() }, app.overlays.silhouette ? 'Replace reference image' : 'Reference silhouette…')),
        app.overlays.silhouette ? h('div', {}, range('vehicle.wheelbase', { label: 'Reference image length', lim: [2, 14], value: app.overlays.silLen, outFn: (x) => L(x), set: (x) => app.setSilhouette({ len: x }) }),
          range('vehicle.wheelbase', { label: 'Slide the image', lim: [-4, 4], value: app.overlays.silX, outFn: (x) => L(x), set: (x) => app.setSilhouette({ x }) }),
          h('button', { type: 'button', class: 'btn small', onclick: () => app.setSilhouette(null) }, 'Remove reference image')) : null),
      h('details', { class: 'more', open: d.vehicle.whatIf || null }, h('summary', {}, 'What-if: change the chassis numbers'),
        toggle('vehicle.whatIf', { note: 'Explore a configuration the catalog doesn’t list. The spec card keeps the catalog values.' }),
        d.vehicle.whatIf ? [range('vehicle.wheelbase'), range('vehicle.track'), range('vehicle.wheelDia'), range('vehicle.frameHeight')] : null),
      ...stepFlags(1),
    ];
  }

  /* the catalog to browse */
  const famSeg = h('div', { class: 'seg wide fams', role: 'group', 'aria-label': 'Vehicle family' }, FAMILIES.map((f) => h('button', { type: 'button', 'aria-pressed': String(f.id === fam), onclick: () => { app.ui.family = f.id; app.rerender(); } }, f.label)));
  const cards = h('div', { class: 'cards' }, shown.map((v) => {
    const fit = app.fitReady(v.id) ? vehicleFit(v.id, d.brief) : null, sel = C && v.id === C.id;
    return h('button', { type: 'button', class: 'ocard', 'aria-pressed': String(!!sel), onclick: () => pick(v) },
      h('div', { class: 't' }, h('span', {}, v.short), h('span', { class: 'tag' }, sel ? 'your vehicle' : `${v.wheelbaseOptions.map((w) => Math.round(w / 0.0254) + '″').join(' / ')} WB`)),
      h('div', { class: 'd' }, v.summary), tagRow(fitTags(v, fit)));
  }));
  return [
    ...yours,
    h('h3', {}, blank ? 'Vehicles' : 'Switch to another vehicle'),
    h('p', { class: 'note' }, blank ? 'Browse by family. Tap a card to pick it.' : 'Switching keeps your later choices; the body is clamped to the new chassis.'),
    famSeg, h('p', { class: 'note' }, FAMILIES.find((f) => f.id === fam).note),
    h('p', { class: 'legend note' }, 'On each card: payload (badge color shows spec sheet, measured or estimate), about how many riders fit after a typical build, and whether it can carry an upper deck.'),
    hidden ? box('warn', `${hidden} ${hidden === 1 ? 'vehicle is' : 'vehicles are'} hidden by the brief’s powertrain preference (${pref}). Change it in the brief to see them.`) : null,
    cards,
    h('div', { class: 'chips' }, h('button', { type: 'button', class: 'chip', onclick: () => app.openVehicleTable(fam) }, 'Compare vehicles in a table')),
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
    cut: ['Cut at the windshield base', 'Cab shell off; hood, fenders, factory dash, steering column, floor pan and driver’s seat stay. The bumper goes. Not road legal: it must be hauled. The passenger seat goes if the front ladder needs its spot.'],
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
  const d = store.d, E = store.E, g = E.g, lim = E.limits, C = E.C;
  const SPAN = {
    full: ['Over the entire length', 'Like the pink fish: posts stand at the very front and the roof runs over the driver and the engine. The deck can run the full length.'],
    'driver-back': ['Over the driver and the rear', 'Like Pingüina: the last posts stand behind the driver and the roof reaches over the seat; the engine stays open to the sky. Deck in the middle, shade at the ends.'],
  };
  const atIdeal = Math.abs(d.structure.length - lim.ideal) < 0.03;
  const STY = {
    barge: ['Low party barge', 'A deck only, with rails: no posts, no roof. The simplest build.'],
    'deck-posts': ['Deck and posts', 'A flat deck on the frame with perimeter posts carrying a roof or an upper deck. Slug-style scaffold.'],
    cage: ['Full cage', 'A cage that wraps the whole vehicle including the front: attachment points everywhere for design structure.'],
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
    g.hasRoof ? choice('structure.roofSpan', { cards: true, options: Object.entries(SPAN).map(([k, [t, desc]]) => [k, t, desc]), status: () => ({}), note: 'This sets the upper deck’s starting layout in step 4.' }) : null,
    h('h3', {}, 'Size'),
    range('structure.length', { lim: lim.length, outFn: (x) => `${L(x)}${Math.abs(x - lim.ideal) < 0.03 ? ', ideal' : ''}`,
      note: `From ${L(lim.length[0])} (past the rear wheel) to ${L(lim.length[1])}: beyond that the rear overhang passes ${pct(lim.rearMax / E.s.wheelbase)} of the wheelbase. Ideal for this wheelbase: ${L(lim.ideal)}.` }),
    !atIdeal ? h('button', { type: 'button', class: 'btn small', onclick: () => setValue('structure.length', lim.ideal) }, `Back to the ideal length, ${L(lim.ideal)}`) : null,
    range('structure.width', { lim: lim.width, note: E.s.hasTubes ? `The deck is ${L(g.floorW)} wide inside the side tubes.` : 'Without side tubes the deck takes the whole width.' }),
    range('structure.bodyFront', { lim: lim.bodyFront, label: 'Past the front bumper', outFn: (x) => L(x - C.ba), note: 'The structure always wraps the front of the vehicle, engine included, so the design can cover it. Moving it keeps the rear end where it is.' }),
    g.hasRoof ? range('structure.roofOverhang') : null,
    g.hasRoof ? range('structure.posts') : null,
    choice('structure.material', { status: () => ({}) }),
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
    h('h3', {}, 'Live checks'),
    stats([
      ['Tipping', `${E.tip.ssf.toFixed(2)} g, roof filled first`, E.tip.ssf < R('tipRed') ? 'red' : E.tip.ssf < R('tipAmber') ? 'amber' : ''],
      ['Payload left', `${W(E.rc.payloadKg - E.w.buildKg - (E.rc.riders + 1) * R('riderKg'))}`],
      ['Deck', g.decks.length ? `${g.decks.map((x) => L(x.dx1 - x.dx0)).join(' + ')} rideable` : 'none'],
    ]),
    h('div', { class: 'note' }, `Hauled height on each trailer${d.upper.railsRemovable ? ', rails off' : ''}${d.upper.roofRemovable ? ', roof off' : ''} (what comes off is set in step 9):`),
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
    choice('layout.dj', { select: true, note: d.layout.dj === 'side' && !g.zones.some((z) => z.name === 'DJ booth') ? 'No room along the passenger side between the entries: move the second step or pick another spot.'
      : d.layout.dj === 'upper' ? 'Up top the DJ plays to the crowd outside; the booth comes off with the rails for transport.' : d.layout.dj === 'side' ? 'The DJ stands inside at the deck edge and plays out to the crowd.' : null }),
    choice('layout.bar', {}), choice('layout.storage', {}),
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
function kitParams(k, skip = []) {
  const def = KITS[k.id];
  return Object.entries(def.params || {}).filter(([key]) => !skip.includes(key)).map(([key, f]) => {
    const path = `kits.body.p.${key}`;
    if (f.type === 'num' || f.type === 'int') return range(path, { ...f, value: k.p[key], set: (x, live) => setValue(path, f.type === 'int' ? Math.round(x) : x, { live }) });
    if (f.type === 'bool') return toggle(path, { label: f.label, value: k.p[key], set: (x) => setValue(path, x) });
    return choice(path, { label: f.label, options: f.options, value: k.p[key], status: () => ({}), set: (x) => setValue(path, x), select: f.options.length > 4 });
  });
}
const FAMILY_FIRST = { metal: 'perforated', plywood: 'plyskin' };
function design(app) {
  const d = store.d, E = store.E, body = d.kits.body, def = KITS[body.id];
  app.ui.lastKit = app.ui.lastKit || {};
  if (def) app.ui.lastKit[def.category] = body.id;
  const full = !!def && def.category === 'full';
  const pick = (id) => setValue('kits.body', id);
  const shapes = (cat) => Object.values(KITS).filter((k) => k.category === cat);
  const res = def ? E.g.kitResults.find((r) => r.id === body.id) : null;
  const tubes = body.id === 'side-tubes';

  /* what it's built from: metal or plywood (fabric for some shapes), then the finer choice */
  let built = [];
  if (tubes) {
    const fam = TUBE_BUILDS[body.p.build]?.family || 'metal';
    built = [
      choice('kits.body.p.build', { label: 'Built from', value: fam, options: [['metal', 'Metal'], ['plywood', 'Plywood']], status: () => ({}), set: (v) => (v !== fam ? setValue('kits.body.p.build', FAMILY_FIRST[v]) : null) }),
      choice('kits.body.p.build', { label: 'Construction', value: body.p.build, options: Object.entries(TUBE_BUILDS).filter(([, t]) => t.family === fam).map(([k, t]) => [k, t.label]), status: () => ({}), select: true }),
    ];
  } else if (def && def.params.build) {
    built = [
      choice('kits.body.p.build', { label: 'Built from', value: body.p.build, options: def.params.build.options, status: () => ({}), note: BUILDS[body.p.build === 'plywood' && body.p.finish === 'lattice' ? 'lattice' : body.p.build]?.note }),
      body.p.build === 'plywood' && def.params.finish ? choice('kits.body.p.finish', { label: 'Plywood finish', value: body.p.finish, options: def.params.finish.options, status: () => ({}) }) : null,
    ];
  } else if (def && def.params.material) built = [choice('kits.body.p.material', { label: 'Skin', value: body.p.material, options: def.params.material.options, status: () => ({}) })];
  const m = def && (MATERIALS[body.p.material] || buildOf(body.p) || (tubes ? TUBE_BUILDS[body.p.build] : null));
  const about = def ? box('', h('div', { class: 'note' }, def.explainer),
    stats([
      ['By day', m && m.day ? m.day : def.look.day],
      ['By night', m && m.night ? m.night : def.look.night],
      ['Weight', res ? `${W(res.kg)}` : tubes ? `${E.g.bom.sections} tube sections` : 'part of the build'],
      ['Wheels', { 'face-cut': 'left open where a tire reaches at full lock', outboard: 'sits outboard of the wheels', 'skirt-above': 'steps up above the tire travel', 'none-needed': 'clear of the wheels' }[def.wheelClearance]],
      ['Rider openings', def.riderOpenings],
      ['Transport', `${def.transport.removable ? 'comes off' : 'stays on'}: ${def.transport.note}`],
      ['Cost, effort', `${TIER_COST[Math.max(def.costTier, m && m.cost ? m.cost : 0)]}, ${TIER_EFFORT[Math.max(def.effortTier, m && m.effort ? m.effort : 0)]}`],
    ]),
    m && m.warning ? h('div', { class: 'why' }, m.warning) : null) : null;
  const v = E.view;
  return [
    h('p', { class: 'note' }, 'The design never carries people: it hangs on the frame and makes the shape. Whatever you pick, the sides and the engine get covered.'),
    choice('kits.body', { label: 'Full body shell?', value: full ? 'full' : 'cover', status: () => ({}), cards: true,
      options: [['cover', 'No: cover the sides and the engine', 'A shape along both sides and over the front. The lounge and the roof stay open.'],
        ['full', 'Yes: one shell over everything', 'Like the pink fish: one skin wraps the sides, the front and the engine, with gills for the lounge and a mouth for the driver.']],
      set: (x) => { if ((x === 'full') !== full) pick(app.ui.lastKit[x] || (x === 'full' ? 'pink-fish' : 'side-tubes')); } }),
    body.id === 'none' ? box('warn', 'This preset has no design at all (a reality check). Pick a shape to cover the sides and the engine.') : null,
    choice('kits.body', { label: full ? 'Shape' : 'Shape over the sides and the engine', value: body.id, cards: true, set: pick, status: (id) => kitStatus(E, 'body', id),
      options: shapes(full ? 'full' : 'cover').map((k) => [k.id, k.name, k.description, { tags: [{ text: `${TIER_COST[k.costTier]}, ${TIER_EFFORT[k.effortTier]} effort` }] }]) }),
    ...built,
    about,
    def ? h('details', { class: 'more' }, h('summary', {}, 'Adjust the shape'), ...kitParams(body, tubes ? ['build'] : ['build', 'finish', 'material'])) : null,
    h('h3', {}, 'Checks'),
    stats([
      ['Driver view', v ? `${pct(v.fraction)} of the view cone blocked${v.blockers.length ? `, mostly ${v.blockers[0].name.toLowerCase()}` : ''}` : '—', v && v.fraction > R('viewRed') ? 'red' : v && v.fraction > R('viewAmber') ? 'amber' : ''],
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
    E.g.decks.length ? toggle('lights.projectors') : null,
    h('h3', {}, 'Sound'),
    choice('lights.speakers', { status: (v) => optionStatus(E, 'lights.speakers', v) }),
    d.lights.speakers !== 'none' ? choice('lights.speakerFacing', { cards: true, status: () => ({}), options: [
      ['lounge', 'Facing the lounge', 'For the riders: the sound stays on board and the car stays a good neighbor at art.'],
      ['playa', 'Facing the playa', 'For the crowd outside: speakers point out from the car, so people gather around it.'],
    ] }) : null,
    d.lights.speakers !== 'none' ? choice('lights.speakerSize', { status: () => ({}) }) : null,
    box('', h('div', { class: 'note' }, `Lights and sound draw about ${Math.round(p.loadW)} W. Step 8 sizes the power to run them all night.`)),
    box('', h('div', { class: 'note' }, 'The DMV licenses day and night separately; lighting decides night licensing. See the ', h('a', { href: HANDBOOK_URL, target: '_blank', rel: 'noopener' }, 'Mutant Vehicle Owner’s Handbook'), ' for the current rules.')),
    ...stepFlags(7),
  ];
}

/* ------------------------------------------------------------------ step 8: power */
function power() {
  const d = store.d, E = store.E, p = E.power, gen = d.lights.power === 'generator';
  const hrs = Number.isFinite(p.hours) ? `about ${p.hours.toFixed(1)} h` : 'all night: the generator carries the whole load';
  return [
    box('', h('strong', {}, 'Why power matters'),
      h('div', { class: 'note' }, 'Everything that glows or plays runs off this. If it runs out at 2 a.m., the car goes dark in deep playa: no lights means no night license, and a dark art car is a hazard. Batteries are heavy (about 20 lb per kWh) and they decide how big the power bay is; a generator carries big loads for less weight, but it needs propane and it makes noise.')),
    choice('lights.power', { cards: true, status: () => ({}), options: [
      ['battery', 'Lithium batteries only', 'Silent and simple. The bank is sized to run the whole night, so big loads mean a big, heavy bank.'],
      ['generator', 'Propane generator and batteries', 'A 2 kW inverter generator carries the load; a smaller bank covers peaks and quiet hours at art.'],
    ] }),
    choice('structure.powerBay', { select: true, label: 'Where the power bay goes' }),
    box(p.status === 'ok' ? '' : p.status === 'red' ? 'bad' : 'warn', h('strong', {}, 'What this build needs (an output of your choices)'),
      table(['Load', 'Watts'], p.items.map((i) => [i.name + (i.note ? ` (${i.note})` : ''), `${Math.round(i.w)}`])),
      stats([
        ['Total draw', `${Math.round(p.loadW)} W including inverter losses, about ${p.nightKwh.toFixed(1)} kWh over a ${p.need} h night`],
        ['Battery bank', `${p.bankKwh} kWh (${W(p.batteryKg)}), ${p.usableKwh.toFixed(1)} kWh usable`],
        gen ? ['Generator', `${(p.genW / 1000).toFixed(1)} kW continuous, about ${Math.round(p.fuelLb)} lb of propane a night`] : null,
        ['Runtime', hrs, p.status === 'ok' ? '' : p.status],
        ['Power bay', `${p.bay}: holds the bank${gen ? ', the generator and its tanks' : ''}`],
      ]),
      h('div', { class: 'note' }, 'Change the lights and sound (step 7) or the zones (step 5) and the bank and the bay follow.')),
    ...stepFlags(8),
  ];
}

/* ------------------------------------------------------------------ step 9: transport */
function transport(app) {
  const d = store.d, E = store.E, tr = E.tr;
  const diff = ['', 'easy', 'moderate', 'hard'];
  const m = (x, f) => (Number.isFinite(x) ? f(x) : null);
  // what each "comes off" choice is worth, from the packed bounds with and without it
  const packedIf = (patch) => measure(E.model.root, { ...E.s, ...patch }).packed;
  const gain = (patch) => {
    const a = packedIf(patch), b = E.dims.packed, dh = a.max[1] - b.max[1], dw = a.size()[2] - b.size()[2];   // the alternative against now
    const parts = [dh > 0.02 ? `${IN(dh)} taller` : dh < -0.02 ? `${IN(-dh)} lower` : null, dw > 0.02 ? `${IN(dw)} wider` : dw < -0.02 ? `${IN(-dw)} narrower` : null].filter(Boolean);
    return parts.length ? `it packs ${parts.join(' and ')}` : 'the packed size doesn’t change';
  };
  const offRow = (path, label, note, patchOn, patchOff) => {
    const on = !!getPath(d, path);
    return toggle(path, { label, note: `${note} ${on ? `Left on, ${gain(patchOff)}.` : `Taken off, ${gain(patchOn)}.`}` });
  };
  const optCards = h('div', { class: 'cards' }, tr.options.map((o) => h('button', { type: 'button', class: 'ocard', 'aria-pressed': String(o.id === d.transport.trailer), onclick: () => setValue('transport.trailer', o.id) },
    h('div', { class: 't' }, h('span', {}, TRAILERS[o.id].label), h('span', { class: 'tag ' + (o.fits ? (o.status === 'amber' ? 'amber' : 'ok') : 'red') }, o.fits ? 'fits' : o.problems[0].split(':')[0])),
    !o.fits && o.problems[0].includes(':') ? h('div', { class: 'd' }, o.problems[0].split(': ').slice(1).join(': ')) : null,
    h('div', { class: 'meta' },
      h('span', { class: 'tag' }, `${diff[o.difficulty]}`),
      h('span', { class: 'tag ' + (o.margins.height < 0 ? 'red' : o.margins.height < R('haulAmberMargin') ? 'amber' : 'ok') }, o.margins.height >= 0 ? `height: ${IN(o.margins.height)} to spare` : `height: ${IN(-o.margins.height)} over`),
      h('span', { class: 'tag ' + (o.margins.width < 0 ? 'red' : 'ok') }, o.margins.width >= 0 ? 'width fits' : `${IN(-o.margins.width)} too wide`),
      m(o.margins.length, (x) => h('span', { class: 'tag ' + (x < 0 ? 'red' : 'ok') }, x >= 0 ? `deck: ${L(x)} spare` : `deck: ${L(-x)} too long`)),
      m(o.margins.weight, (x) => h('span', { class: 'tag ' + (x < 0 ? 'red' : 'ok') }, x >= 0 ? 'rating fits' : 'over the rating'))))));
  const groups = {};
  for (const p of E.teardown.pieces) { const k = p.group + '|' + p.name; groups[k] = groups[k] || { ...p, n: 0 }; groups[k].n++; }
  const st = E.teardown.storage;
  return [
    h('h3', {}, 'What comes off'),
    offRow('transport.skinOff', 'The skin and design pieces come off', 'Almost always yes: the shape is the widest, most fragile part, and it stacks flat in a container.', { skinOff: true }, { skinOff: false }),
    E.g.decks.length ? offRow('upper.railsRemovable', 'Upper deck rails and cushions come off', d.upper.roofRemovable ? 'They come off with the roof anyway.' : 'Rails are usually what pushes a two-level car over 13′6″.', { removeRails: true }, { removeRails: false }) : null,
    E.g.hasRoof ? offRow('upper.roofRemovable', 'The roof and posts come off', 'Only worth it when the height still doesn’t fit: it’s the longest teardown.', { removeRoof: true }, { removeRoof: false }) : null,
    stats([
      ['Packed', `${L(tr.packL)} × ${L(tr.packW)} × ${L(tr.packH)} tall`],
      ['Vehicle weight', `${W(tr.vehKg)}, chassis plus build`],
    ]),
    h('h3', {}, 'Getting it there'),
    h('p', { class: 'note' }, `${tr.legal.ok ? 'It’s road legal, so it can be driven. Otherwise' : 'It isn’t road legal, so'} Peik Construction picks the vehicle up and hauls it to the playa and back. These are the trailers a hauler uses; the margins show which one it needs.`),
    optCards,
    h('div', { class: 'note' }, TRAILERS[d.transport.trailer].notes),
    h('button', { type: 'button', class: 'btn', onclick: () => app.setView('packed') }, 'Show it packed on the trailer'),
    h('p', { class: 'note' }, 'Limits: 8′6″ wide and 13′6″ tall, measured from the road with the car on the trailer. Some western states allow 14′; beyond that, oversize permits. Trailer figures are typical and editable in the catalog.'),
    h('h3', {}, 'Between burns'),
    box(st.where === '40ft+' ? 'warn' : '', h('strong', {}, `Everything that comes off: ${st.label.toLowerCase()}`),
      h('div', { class: 'note' }, `Peik Construction takes the vehicle back after the burn. ${st.note}`)),
    h('h3', {}, `Teardown plan: ${TIER_EFFORT[E.teardown.tier]} effort`),
    table(['Piece', 'Count', 'Each', 'People'], Object.values(groups).map((p) => [p.name, `${p.n}`, W(p.kg), `${p.people}`])),
    h('p', { class: 'note' }, `${E.teardown.pieces.length} pieces, ${W(E.teardown.totalKg)} in all. One person lifts about 55 lb comfortably.`),
    ...stepFlags(9),
  ];
}

const RENDER = [brief, vehicle, strip, structure, upper, layout, design, lights, power, transport];
export function renderStep(i, app) {
  const kids = RENDER[i](app);
  return kids.flat().filter(Boolean);
}
export { STEPS };
