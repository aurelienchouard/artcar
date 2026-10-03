import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluate } from '../engine/evaluate.js';
import { starterDesign, sanitize, fromV1, activeKits, kitDefaults, params, bunkHeadroom } from '../engine/state.js';
import { optionStatus, kitStatus } from '../engine/eligibility.js';
import { fmtLen, fmtInches } from '../engine/units.js';
import { encodeDesign, decodeDesign } from '../engine/share.js';
import { STARTERS, pinguina } from '../catalogs/starters.js';
import { VEHICLE_IDS } from '../catalogs/vehicles.js';
import { R } from '../catalogs/rules.js';

test('4.6 worked example: 6′5″ headroom, rails off, on a 3′4″ step deck', () => {
  const want = { express: ['2′ 10″', '13′ 1″', 5], npr: ['3′ 2″', '13′ 5″', 1], f350: ['3′ 4″', '13′ 8″', -2] };
  for (const [id, [deck, height, margin]] of Object.entries(want)) {
    const d = starterDesign(id);
    Object.assign(d.upper, { kind: 'stand', headroom: 1.9558, railsRemovable: true, roofRemovable: false });
    d.transport.trailer = 'stepdeck';
    const E = evaluate(d, { viewCone: false });
    assert.equal(fmtLen(E.g.deckY), deck, `${id} deck`);
    assert.equal(fmtLen(E.tr.chosen.haulH), height, `${id} hauled height`);
    assert.equal(Math.round(E.tr.chosen.margins.height / 0.0254), margin, `${id} margin`);
  }
});

test('payload caps riders, and the cap formula matches section 4.3', () => {
  const d = starterDesign('haulster');
  d.structure.length = 99;   // the longest deck a small cart allows runs out of payload before it runs out of room
  const E = evaluate(d, { viewCone: false });
  const cap = Math.floor((E.rc.payloadKg - E.w.buildKg) / R('riderKg')) - 1;
  assert.equal(E.rc.cap, Math.max(0, cap));
  assert.equal(E.rc.riders, Math.min(E.rc.room, E.rc.cap));
  assert.ok(E.rc.capped, 'a long Haulster deck is payload-limited');
  const riders = E.score.find((l) => l.id === 'riders');
  assert.match(riders.value, /payload-limited, room for \d+/);
});

test('payload goes red when the build alone is over', () => {
  const d = starterDesign('haulster-old');
  d.lights.batteryKwh = 40;
  d.layout.bikeRack = 'both'; d.layout.bikes = 10;
  const E = evaluate(d, { viewCone: false });
  assert.equal(E.score.find((l) => l.id === 'payload').status, 'red');
});

test('tipping: (track / 2) / CG height, flagged red under 0.45 g', () => {
  const d = starterDesign('mc480');
  Object.assign(d.upper, { kind: 'stand', headroom: 2.3 });
  d.layout.upperSeating = 'none';
  const E = evaluate(d, { viewCone: false });
  assert.ok(Math.abs(E.tip.ssf - (E.s.track / 2) / E.tip.cgH) < 1e-9);
  assert.equal(E.score.find((l) => l.id === 'tipping').status, E.tip.ssf < 0.45 ? 'red' : E.tip.ssf < 0.5 ? 'amber' : 'ok');
});

test('a stand-under deck on the narrow MC-480 is greyed out with the reason', () => {
  const d = starterDesign('mc480');
  const E = evaluate(d, { viewCone: false });
  const st = optionStatus(E, 'upper.kind', 'stand');
  assert.ok(st.disabled, 'greyed out');
  assert.match(st.reason, /MC-480’s 3′ \d″ track tips at 0\.\d\d g/);
  assert.equal(optionStatus(E, 'upper.kind', 'none').disabled, false);
});

test('DMV rails: decks 84″ up need 36–48″ rails', () => {
  const d = starterDesign('express');
  d.upper.railHeight = 0.6;
  const E = evaluate(d, { viewCone: false });
  const l = E.score.find((x) => x.id === 'rails');
  assert.ok(E.g.dTop >= R('dmvDeckHeight'));
  assert.equal(l.status, 'red');
  d.upper.railHeight = 1.0;
  assert.equal(evaluate(d, { viewCone: false }).score.find((x) => x.id === 'rails').status, 'ok');
  const low = starterDesign('bigfoot');
  low.upper.kind = 'bunk'; low.upper.headroom = bunkHeadroom(low);
  assert.ok(evaluate(low, { viewCone: false }).dmv.levels.every((x) => !x.needsRails), 'a low bunk on a cart stays under 84″');
});

test('Limited City Use at 25′ long', () => {
  const E = evaluate(pinguina(), { viewCone: false });
  assert.ok(E.dmv.length >= 7.62);
  assert.equal(E.score.find((l) => l.id === 'length').status, 'info');
});

test('cost and effort calibration: Pingüina reads $$$ and heavy, a small cart with side tubes $ and light', () => {
  const P = evaluate(pinguina(), { viewCone: false });
  assert.equal(P.tiers.cost, 3); assert.equal(P.tiers.effort, 3);
  const c = starterDesign('haulster');
  const E = evaluate(c, { viewCone: false });
  assert.equal(E.tiers.cost, 1); assert.equal(E.tiers.effort, 1);
});

test('every vehicle evaluates at every strip level and structure style without errors', () => {
  for (const id of VEHICLE_IDS) for (const level of ['stock', 'cut', 'rails']) for (const style of ['deck-posts', 'cage', 'barge']) {
    const d = starterDesign(id);
    d.strip.level = level; d.structure.style = style;
    const E = evaluate(d, { viewCone: false });
    assert.ok(Number.isFinite(E.w.buildKg) && E.dims.playa.size()[0] > 1, `${id} ${level} ${style}`);
  }
});

test('opening a v1 save keeps its numbers', () => {
  const v1 = { chassis: 'npr', layout: 'ring', roofDeck: true, headroom: 1.95, tubeDia: 0.6, keepCab: false, ladder: 'front', name: 'old save' };
  const d = fromV1(v1);
  assert.equal(d.vehicle.id, 'npr'); assert.equal(d.upper.kind, 'stand'); assert.equal(d.upper.access, 'ladder-front'); assert.equal(d.kits.body.p.dia, 0.6);
});

test('sanitize never throws and clamps to the chassis', () => {
  for (const junk of [null, 42, 'x', { vehicle: { id: 'nope' } }, { structure: { length: 99, width: -3 } }, { kits: { side: { id: 'pink-fish' } } }]) {
    const d = sanitize(junk);
    assert.ok(d.schema === 2 && d.structure.length <= 12);
  }
});

test('one design body: a cover or a full shell; older designs with several kits migrate', () => {
  const d = starterDesign('express');
  assert.equal(d.kits.body.id, 'side-tubes');
  d.kits.body = { id: 'pink-fish', p: kitDefaults('pink-fish') };
  assert.deepEqual(activeKits(d).active.map((k) => k.id), ['pink-fish']);
  const old = { ...JSON.parse(JSON.stringify(d)), kits: { side: { id: 'side-tubes', p: {} }, full: { id: 'pinguina-ribs', p: {} }, front: { id: 'none' } } };
  assert.equal(sanitize(old).kits.body.id, 'penguin', 'a retired full-body kit maps to the nearest shape');
  const E = evaluate(d, { viewCone: false });
  assert.equal(kitStatus(E, 'body', 'rocket').disabled, false);
});

test('non-destructive: switching vehicles keeps later choices', async () => {
  const { switchVehicle } = await import('../engine/state.js');
  const d = starterDesign('express');
  d.layout.seating = 'ring'; d.lights.ledColor = '#123456';
  const { design, changes } = switchVehicle(d, 'haulster');
  assert.equal(design.vehicle.id, 'haulster');
  assert.equal(design.layout.seating, 'ring'); assert.equal(design.lights.ledColor, '#123456');
  assert.ok(changes.some((c) => c.path === 'structure.length'), 'body length clamped and listed');
});

test('power: the bank and the bay are sized from the loads; a battery-only bank can run out of room', () => {
  const d = starterDesign('express');
  d.lights.power = 'battery'; d.layout.rear = 'none'; d.lights.speakers = 'corners';
  let E = evaluate(d, { viewCone: false });
  assert.ok(E.power.auto && E.power.bankKwh >= 2 && E.power.hours >= E.power.need, 'a modest load gets a bank that lasts the night');
  assert.equal(E.s.batteryKwh, E.power.bankKwh, 'the weight uses the sized bank');
  d.layout.rear = 'daiquiri'; d.lights.speakerSize = 'large'; d.lights.speakers = 'towers';
  E = evaluate(d, { viewCone: false });
  assert.ok(E.flags.some((f) => f.id === 'power-heavy' || f.id === 'power'), 'frozen-drink machines on batteries alone need a huge bank');
  d.lights.power = 'generator';
  E = evaluate(d, { viewCone: false });
  assert.ok(E.power.genW > 0 && E.power.fuelLb > 0 && ['medium', 'large'].includes(E.power.bay));
});

test('teardown lists every removable piece with people to lift it', () => {
  const E = evaluate(starterDesign('express'), { viewCone: false });
  assert.ok(E.teardown.pieces.length > 5);
  assert.ok(E.teardown.pieces.every((p) => p.people === Math.max(1, Math.ceil(p.kg / R('liftPerPerson')))));
});

test('share links round-trip', async () => {
  const d = pinguina();
  const code = await encodeDesign(d);
  assert.ok(code.length < 3000, 'fits in a URL');
  assert.deepEqual(sanitize(await decodeDesign(code)), sanitize(d));
});

test('starters all evaluate', () => {
  for (const s of STARTERS) assert.ok(evaluate(s.build()).score.length === 12, s.id);
});

test('a blank design has no vehicle and evaluates to an empty state', async () => {
  const { blankDesign, switchVehicle } = await import('../engine/state.js');
  const d = blankDesign();
  assert.equal(d.vehicle.id, null);
  const E = evaluate(d);
  assert.ok(E.blank && E.score.length === 0 && E.flags.length === 0 && E.steps.length === 10);
  assert.equal(sanitize(JSON.parse(JSON.stringify(d))).vehicle.id, null, 'a blank design survives save and open');
  d.brief.ridersMax = 30; d.brief.budget = 3;
  const { design } = switchVehicle(d, 'npr');
  assert.equal(design.vehicle.id, 'npr'); assert.equal(design.brief.ridersMax, 30); assert.equal(design.brief.budget, 3);
  assert.ok(!evaluate(design, { viewCone: false }).blank);
});

test('crew skills are an output of the choices, not a brief input', () => {
  const d = starterDesign('express');
  assert.equal(d.brief.skills, undefined); assert.equal(d.brief.age, undefined);
  let E = evaluate(d, { viewCone: false });
  const ids = E.skills.map((k) => k.skill);
  assert.ok(ids.includes('welding') && ids.includes('electrical') && ids.includes('mechanical'));
  assert.ok(!E.flags.some((f) => f.id.startsWith('skill-')));
  d.kits.body = { id: 'penguin', p: { ...kitDefaults('penguin'), build: 'plywood' } };
  E = evaluate(d, { viewCone: false });
  assert.ok(E.skills.some((k) => k.skill === 'cnc'), 'plywood ribs add CNC');
});

test('structure styles run from the simplest to the full cage', async () => {
  const { FIELDS } = await import('../engine/fields.js');
  assert.deepEqual(FIELDS['structure.style'].options.map((o) => o[0]), ['barge', 'deck-posts', 'cage', 'bed-ext']);
  assert.equal(FIELDS['view.mood'].def, 'day');
});

test('the structure wraps the front of the engine and runs at least past the rear wheel', async () => {
  const { bodyLimits } = await import('../engine/limits.js');
  for (const id of ['express', 'f350', 'npr', 'haulster']) {
    const d = starterDesign(id), E = evaluate(d, { viewCone: false }), C = E.C;
    assert.ok(E.g.xbF >= E.g.fa + C.ba, `${id}: the body front is ahead of the bumper`);
    const lim = bodyLimits(E.s, C);
    assert.ok(lim.length[0] >= d.structure.bodyFront + E.s.wheelbase, `${id}: the minimum length covers the wheelbase`);
    assert.ok(Math.abs(d.structure.length - lim.ideal) < 0.02, `${id}: a new design starts at the ideal length`);
    const big = { ...d, structure: { ...d.structure, length: 99, bodyFront: -1 } };
    const s = sanitize(big);
    assert.ok(s.structure.length <= lim.length[1] + 1e-6 && s.structure.bodyFront >= C.ba, `${id}: clamped to the max and to the bumper`);
  }
});

test('roof span: over the entire length puts posts out front and a full deck; over the driver keeps the engine open', async () => {
  const { structureEffects } = await import('../engine/state.js');
  const d0 = starterDesign('f350'), d = JSON.parse(JSON.stringify(d0));
  d.structure.roofSpan = 'full'; structureEffects(d0, d, 'structure.roofSpan');
  assert.equal(d.upper.coverage, 'full');
  const E = evaluate(d, { viewCone: false });
  assert.ok(E.s.frontPosts && E.g.rx1 >= E.g.xbF - 0.01, 'the roof reaches the front');
  const F = evaluate(d0, { viewCone: false });
  assert.ok(F.g.rx1 < F.g.xbF - 0.5, 'Pingüina-style: the roof stops over the driver');
});

test('second step: every slider position moves it, front to back', () => {
  const xs = [-1, -0.5, 0, 0.5, 1].map((p) => { const d = starterDesign('express'); d.layout.secondStepPos = p; return evaluate(d, { viewCone: false }).g.steps.find((t) => t.kind === 'deck').x; });
  for (let i = 1; i < xs.length; i++) assert.ok(xs[i] > xs[i - 1] + 0.02, `position ${i} moves forward (${xs.map((x) => x.toFixed(2))})`);
});

test('DJ booth at the side or up top; storage keeps its name; no lightning bolt', () => {
  const d = starterDesign('express');
  d.layout.dj = 'side'; d.layout.storage = 'front';
  let E = evaluate(d, { viewCone: false });
  const dj = E.g.zones.find((z) => z.name === 'DJ booth');
  assert.ok(dj && dj.rect[3] > E.g.edge - 0.1, 'the side booth sits at the passenger edge');
  assert.ok(E.g.zones.some((z) => z.name === 'Storage'));
  d.layout.dj = 'upper';
  E = evaluate(d, { viewCone: false });
  assert.equal(E.g.zones.find((z) => z.name === 'DJ booth').level, 'upper');
  let neon = 0; E.model.root.traverse((o) => { if (o.name === 'Neon bolt') neon++; });
  assert.equal(neon, 0);
});

test('speakers face the lounge or the playa', () => {
  const zs = (facing) => { const d = starterDesign('express'); d.lights.speakers = 'corners'; d.lights.speakerFacing = facing; const E = evaluate(d, { viewCone: false }); const out = []; E.model.root.traverse((o) => { if (o.name === 'Speaker') out.push(Math.abs(o.position.z)); }); return { out, edge: E.g.floorW / 2 }; };
  const a = zs('lounge'), b = zs('playa');
  assert.ok(a.out.length === 4 && a.out.every((z) => z < a.edge), 'lounge-facing speakers hang inside the posts');
  assert.ok(b.out.length === 4 && b.out.every((z) => z > b.edge), 'playa-facing speakers hang outside');
});

test('transport: the skin comes off unless marked to stay; the pieces go in a container or on the vehicle', () => {
  const d = starterDesign('express');
  const off = evaluate(d, { viewCone: false });
  d.transport.skinOff = false;
  const on = evaluate(d, { viewCone: false });
  assert.ok(on.tr.packW > off.tr.packW + 0.1, 'side tubes left on pack wider');
  assert.ok(off.teardown.storage && ['vehicle', '20ft', '40ft', '40ft+'].includes(off.teardown.storage.where));
  assert.ok(on.teardown.pieces.every((p) => p.group !== 'Design'));
});
