/* The scorecard (section 3) and the other flags. Every line has a status (ok, amber, red, info, na), a value, and an
   explainer: what failed, by how much, why the rule exists, and what would fix it. Thresholds come from the rules table. */
import { R, RULES, HANDBOOK_URL } from '../catalogs/rules.js';
import { fmtLen, fmtWeight, fmtInches, TIER_COST, TIER_EFFORT } from './units.js';
import { riderKg } from './weight.js';
import { buildOf } from './tiers.js';
import { MATERIALS } from '../catalogs/materials.js';

export const METRICS = [
  ['riders', 'Riders', 5], ['payload', 'Payload', 1], ['tipping', 'Tipping', 4], ['heightPlaya', 'Height on playa', 4], ['heightHauled', 'Height hauled', 9],
  ['width', 'Width', 3], ['length', 'Length and DMV class', 3], ['rails', 'Upper deck rails', 4], ['view', 'Driver view', 6], ['road', 'Road legal', 2],
  ['cost', 'Cost', 0], ['effort', 'Effort', 0],
];

export function scorecard(E, d) {
  const u = d.view.units, L = (m) => fmtLen(m, u), Wt = (kg) => fmtWeight(kg, u), IN = (m) => fmtInches(m, u);
  const { s, C, g, w, rc, tip, dims, tr, dmv, view, tiers } = E;
  const out = [];
  const line = (id, status, value, explain = {}) => {
    const m = METRICS.find((x) => x[0] === id);
    out.push({ id, label: m[1], step: m[2], status, value, explain });
  };

  /* riders */
  const tMin = d.brief.ridersMin, tMax = d.brief.ridersMax, target = tMin === tMax ? `${tMax}` : `${tMin}–${tMax}`;
  line('riders', rc.riders < tMin ? 'amber' : 'ok', `${rc.riders} of ${target}${rc.capped ? `, payload-limited, room for ${rc.room}` : ''}`, {
    what: rc.riders < tMin ? `${rc.riders} riders, ${tMin - rc.riders} short of the brief's ${tMin}.` : `${rc.riders} riders meets the brief.`,
    by: `Seats ${rc.seats} (${g.seatsLow} below, ${g.seatsRoof} on top) and standing room for ${rc.standing}; payload allows ${rc.cap} plus the driver.`,
    why: 'Riders are counted from the layout: seats, plus standing riders by open floor area at the chosen density, then capped by payload at 175 lb each.',
    fix: rc.capped ? ['Payload runs out first: lighten the build or pick a chassis with more payload.'] : rc.riders < tMin ? ['Add standing room (party density), a roof deck, or a longer body.', 'An L couch or a cushion platform seats more than facing benches.'] : [],
    rules: ['riderKg', 'standComfortable', 'standParty', 'standPacked', 'platformArea'],
  });

  /* payload */
  const people = (rc.riders + 1) * riderKg();
  const margin = rc.payloadKg - w.buildKg - people;
  const pStatus = w.buildKg + riderKg() > rc.payloadKg ? 'red' : margin < R('payloadAmber') * rc.payloadKg ? 'amber' : 'ok';
  line('payload', pStatus, pStatus === 'red' ? `${Wt(w.buildKg + riderKg() - rc.payloadKg)} over before riders` : `${Wt(margin)} left`, {
    what: `Payload ${Wt(rc.payloadKg)}. Build ${Wt(w.buildKg)} (±30%), people ${Wt(people)} for ${rc.riders + 1} including the driver.`,
    by: pStatus === 'red' ? `The build and driver alone are ${Wt(w.buildKg + riderKg() - rc.payloadKg)} over.` : `${Math.round(Math.max(0, margin) / rc.payloadKg * 100)}% of payload left after riders.`,
    why: 'Payload is the chassis maker’s rating: GVWR minus curb weight. Over it, brakes, tires and axles run past what they were built for. Stiffer springs help the ride but don’t raise the rating.',
    fix: ['Lighten the heaviest items in the weight breakdown.', 'Aluminum secondary members save about half their weight.', 'Pick a chassis with more payload.'],
    rules: ['riderKg', 'payloadAmber', 'buildTolerance'],
  });

  /* tipping */
  const tStatus = tip.ssf < R('tipRed') ? 'red' : tip.ssf < R('tipAmber') ? 'amber' : 'ok';
  line('tipping', tStatus, `${tip.ssf.toFixed(2)} g, ${Math.round(tip.deg)}°`, {
    what: `Tips at ${tip.ssf.toFixed(2)} g sideways or a ${Math.round(tip.deg)}° slope, ${tip.margin.toFixed(1)}× a tight 5 mph turn. Loaded center of gravity ${L(tip.cgH)} up on a ${L(s.track)} track.`,
    by: tStatus === 'ok' ? 'Above the amber line.' : `${(R(tStatus === 'red' ? 'tipRed' : 'tipAmber') - tip.ssf).toFixed(2)} g below the ${tStatus} line.`,
    why: 'A static estimate: (track ÷ 2) ÷ loaded center-of-gravity height, with the roof filled first. It ignores suspension roll and soft tires, which make the real margin smaller. The 0.45 g line is a rule of thumb, not a standard; ruts and a wheel dropping into a hole eat the margin fast.',
    fix: tStatus === 'ok' ? [] : ['Lower the upper deck (a low bunk) or drop it.', 'Move heavy items low: batteries under the deck, speakers on the floor.', 'Pick a chassis with a wider track.'],
    rules: ['tipAmber', 'tipRed', 'tightTurn'],
  });

  /* heights */
  const playaH = dims.playa.max[1];
  line('heightPlaya', 'ok', L(playaH), { what: `${L(playaH)} tall on the playa, rails and decorations on.`, why: 'Informational: wires and overhead structures on the playa are rare, but camp shade and gates aren’t.', rules: [] });
  const ch = tr.chosen;
  const hStatus = ch.margins.height < -1e-3 ? 'red' : ch.margins.height < R('haulAmberMargin') ? 'amber' : 'ok';
  const others = tr.options.filter((o) => o.fits && o.id !== ch.id).map((o) => `${o.short} (${IN(o.margins.height)} to spare)`);
  line('heightHauled', hStatus, ch.margins.height < 0 ? `${L(ch.haulH)}, ${IN(-ch.margins.height)} over` : `${L(ch.haulH)}, ${IN(ch.margins.height)} to spare`, {
    what: `Packed ${L(tr.packH)} tall ${ch.id === 'drive' ? 'on its own wheels' : `on a ${ch.short} with a ${L(ch.haulH - tr.packH)} deck`}: ${L(ch.haulH)} from the road.`,
    by: ch.margins.height < 0 ? `${IN(-ch.margins.height)} over 13′6″${ch.westOk ? '; under the 14′ some western states allow' : ''}.` : `${IN(ch.margins.height)} under 13′6″.`,
    why: 'Most US states cap loads at 13′6″ measured from the road with the car on the trailer; some western states allow 14′; beyond that you need oversize permits. Bridges and power lines don’t negotiate.',
    fix: [...(s.removeRails ? [] : ['Make the rails removable.']), ...(s.removeRoof ? [] : ['Make the roof and posts removable.']), ...(others.length ? [`It fits ${others.join(', ')}.`] : [])],
    rules: ['roadHeight', 'roadHeightWest', 'haulAmberMargin'],
  });

  /* width */
  const playaW = dims.playa.size()[2], packW = tr.packW;
  line('width', packW > R('roadWidth') + 1e-3 ? 'red' : 'ok', `${L(playaW)} playa, ${L(packW)} packed`, {
    what: `${L(playaW)} wide on the playa; ${L(packW)} packed with the decorations off.`,
    by: packW > R('roadWidth') + 1e-3 ? `Packed ${IN(packW - R('roadWidth'))} over 8′6″.` : `Packed ${IN(R('roadWidth') - packW)} under 8′6″.`,
    why: '8′6″ is the US width limit without an oversize permit. Mirrors don’t count.',
    fix: packW > R('roadWidth') + 1e-3 ? ['Narrow the body, or make the widest parts removable.'] : [],
    rules: ['roadWidth'],
  });

  /* length and DMV class */
  const lenStatus = dmv.lcu ? 'info' : dmv.length > R('dmvLong') - R('lengthAmber') ? 'amber' : 'ok';
  line('length', lenStatus, `${L(dmv.length)}, ${dmv.lcu ? 'Limited City Use' : 'regular'}`, {
    what: `${L(dmv.length)} long and ${L(dmv.width)} wide on the playa.`,
    by: dmv.lcu ? `${dmv.long ? `${IN(dmv.length - R('dmvLong'))} past 25′` : ''}${dmv.long && dmv.wide ? ' and ' : ''}${dmv.wide ? `${IN(dmv.width - R('dmvWide'))} past 13′ wide` : ''}.` : `${IN(R('dmvLong') - dmv.length)} under 25′.`,
    why: 'The DMV designates any vehicle 25′ or longer, or 13′ or wider, as Limited City Use: in the city it may only take the shortest route between camp and the open playa.',
    fix: dmv.lcu ? ['Shorten the body or the tube ends to get under 25′, if driving in the city matters.'] : [],
    rules: ['dmvLong', 'dmvWide', 'lengthAmber'], link: HANDBOOK_URL,
  });

  /* rails */
  const needs = dmv.levels.filter((l) => l.needsRails);
  const low = needs.find((l) => l.low), high = needs.find((l) => l.high);
  const top = dmv.levels[dmv.levels.length - 1];
  line('rails', low ? 'red' : high ? 'amber' : needs.length ? 'ok' : 'ok',
    needs.length ? (low ? `${low.name}: ${low.rails == null ? 'no rails' : `${IN(low.rails)} rails`}, needs 36–48″` : `${IN(needs[0].rails)} rails, deck ${L(needs[0].y)} up`) : `deck ${L(top.y)}, under 84″`, {
      what: dmv.levels.map((l) => `${l.name} floor ${L(l.y)} up${l.needsRails ? ', at or over 84″' : ''}`).join('; ') + '.',
      by: low ? `${low.rails == null ? 'No rails' : `Rails ${IN(R('dmvRailMin') - low.rails)} short of 36″`}.` : high ? `Rails ${IN(high.rails - R('dmvRailMax'))} over 48″.` : needs.length ? 'Rails within 36–48″.' : `${IN(R('dmvDeckHeight') - top.y)} under the 84″ line: rails not required (a low lip rail is still a good idea).`,
      why: 'The DMV asks for 36–48″ guardrails around any level 84″ or more above the playa, with at most a 36″ gap for access.',
      fix: low ? ['Raise the rails to at least 36″.', 'Or keep the deck under 84″ with a low bunk.'] : [],
      rules: ['dmvDeckHeight', 'dmvRailMin', 'dmvRailMax'], link: HANDBOOK_URL,
    });

  /* driver view */
  if (view) {
    const vStatus = view.fraction > R('viewRed') ? 'red' : view.fraction > R('viewAmber') ? 'amber' : 'ok';
    line('view', vStatus, `${Math.round(view.fraction * 100)}% of the view blocked`, {
      what: `${Math.round(view.fraction * 100)}% of the forward view cone is blocked${view.blockers.length ? `, mostly by ${view.blockers.slice(0, 2).map((b) => `${b.name.toLowerCase()} (${Math.round(b.share * 100)}%)`).join(' and ')}` : ''}.`,
      by: vStatus === 'ok' ? 'Within the amber line.' : `${Math.round((view.fraction - R(vStatus === 'red' ? 'viewRed' : 'viewAmber')) * 100)} points over the ${vStatus} line.`,
      why: 'The cone runs 50° to each side and 12° up and down from the driver’s eye, 20 m out. It is our proxy: the DMV checks visibility itself at inspection.',
      fix: vStatus === 'ok' ? [] : ['Shorten or lower whatever sits in front of the driver, or cut a window in it.', 'Use the driver’s seat view to see the blocked area.'],
      rules: ['viewAmber', 'viewRed', 'viewConeH', 'viewConeUp', 'viewConeDown'],
    });
  } else line('view', 'na', 'not checked', { what: 'The view check runs on the full evaluation.', rules: [] });

  /* road legal */
  const wantsDrive = d.brief.transport === 'drive' || s.trailer === 'drive';
  line('road', wantsDrive && !tr.legal.ok ? 'red' : 'ok', tr.legal.ok ? 'yes' : 'no', {
    what: tr.legal.ok ? 'It can be driven there: stock cab, lights and mirrors.' : `Not road legal: ${tr.legal.why}.`,
    by: wantsDrive && !tr.legal.ok ? 'The plan is to drive it there, but it can’t be.' : '',
    why: 'Only a stock, licensed vehicle with its lights and mirrors can drive on public roads. Carts and cut-cab trucks are hauled.',
    fix: wantsDrive && !tr.legal.ok ? ['Pick a trailer in the transport step, or keep the cab stock.'] : [],
    rules: [],
  });

  /* cost and effort */
  for (const [id, key, names] of [['cost', 'budget', TIER_COST], ['effort', 'effort', TIER_EFFORT]]) {
    const have = tiers[id], want = d.brief[key], over = have - want;
    line(id, over >= 2 ? 'red' : over === 1 ? 'amber' : 'ok', `${names[have]} vs ${names[want]}`, {
      what: `${id === 'cost' ? 'Cost' : 'Effort'} reads ${names[have]} against a brief of ${names[want]}.`,
      by: over > 0 ? `${over} tier${over > 1 ? 's' : ''} over.` : 'Within the brief.',
      why: 'Relative tiers only: every option carries points, and the total maps to a band. A Pingüina-class build reads $$$ and heavy; a small cart with simple side tubes reads $ and light. No dollar or hour figures.',
      fix: over > 0 ? tiers.lines.slice().sort((a, b) => (id === 'cost' ? b.cost - a.cost : b.effort - a.effort)).slice(0, 3).map((l) => `${l.label} adds ${id === 'cost' ? l.cost : l.effort}.`) : [],
      rules: [id === 'cost' ? 'costBand2' : 'effortBand2', id === 'cost' ? 'costBand3' : 'effortBand3'],
    });
  }
  return out;
}

/* Everything else worth flagging, each tied to the step where it can be fixed. */
export function collectFlags(E, d) {
  const u = d.view.units, L = (m) => fmtLen(m, u);
  const { s, C, g, power, tr, rc } = E;
  const f = [];
  const flag = (id, step, severity, title, detail) => f.push({ id, step, severity, title, detail });
  for (const vf of C.flags || []) flag(vf.id, 1, vf.severity, vf.title, vf.detail);
  if (d.brief.powertrain !== 'either' && C.powertrain !== d.brief.powertrain && !(d.brief.powertrain === 'gas' && C.powertrain === 'diesel'))
    flag('powertrain', 1, 'amber', 'Powertrain doesn’t match the brief', `The brief asks for ${d.brief.powertrain}; the ${C.short} is ${C.powertrain}.`);
  if (C.buying && C.buying.newAvailable && /^none|^few|^rare/i.test(C.buying.used || '')) flag('used-market', 1, 'amber', 'Hard to find used', `${C.buying.used}.`);
  if (C.style === 'cart' && !s.rops) flag('rops', 2, g.barge ? 'red' : 'amber', 'No factory roll bar', g.barge ? 'The low barge has no posts, so nothing protects the driver in a rollover. Keep the factory roll bar or add posts.' : 'With the factory canopy gone, the posts right behind the driver must be built and braced as a roll bar.');
  if (s.strip === 'rails' && !(s.kits || []).length)
    flag('engine-cover', 6, 'amber', 'The engine needs a cover', 'Stripped to the frame rails, the engine and radiator are open. Add a front kit; keep the radiator’s airflow and the headlights clear.');
  if (g.tooNarrow) flag('cab-fit', 3, 'red', 'Body narrower than the cab', 'The body must be at least as wide as the cab it wraps around.');
  if (g.pokeOut) flag('poke-out', 6, 'amber', 'Front tires stick out at full lock', 'At full steering lock the front tires swing past the body side. Widen the body or accept the bare tire.');
  if (g.legroom > 0 && g.legroom < 0.45) flag('knees', 5, 'amber', 'Tight knee room', `Facing seats leave ${L(g.legroom)} between them.`);
  if (g.bikesWanted && g.bikeCount < g.bikesWanted) flag('bikes', 5, 'amber', 'Not every bike fits', `${g.bikeCount} of ${g.bikesWanted} bikes have a spot.`);
  if (g.stairsFailed) flag('stairs', 4, 'red', 'Stairs don’t fit', 'Stairs need a long enough lounge under a rideable deck and a stand-under height. Use a ladder instead.');
  if (g.deckFrontCapped) flag('deck-cap', 4, 'info', 'Deck stops short of the front', 'Without posts ahead of the driver, the deck can only reach about 1.6′ past the last post. The rest stays shade.');
  if (power.status !== 'ok') flag('power', 8, power.status, 'Power won’t last the night', `Even the biggest bank (${power.bankKwh} kWh) runs about ${Number.isFinite(power.hours) ? power.hours.toFixed(1) : '∞'} h at this load; a night is ${power.need} h.${s.power === 'generator' ? ' Cut the load: fewer LEDs, smaller speakers, no frozen drinks.' : ' Add the generator, or cut the load.'}`);
  if (power.auto && !power.genW && power.bankKwh > 15) flag('power-heavy', 8, 'amber', 'A big, heavy battery bank', `Running this load all night on batteries takes about ${power.bankKwh} kWh, roughly ${fmtWeight(power.batteryKg, u)} of lithium. The generator would carry most of it.`);
  for (const p of power.bayProblems) flag('bay', 8, 'amber', 'Power bay too small', `${p[0].toUpperCase()}${p.slice(1)}.`);
  for (const k of s.kits || []) {
    const warn = MATERIALS[k.p.material]?.warning || buildOf(k.p)?.warning;
    if (warn) flag('fabric-day', 6, 'amber', 'Fabric looks bad by day', `${k.def.name}: ${warn}`);
    if (k.def.expects?.axles && C.axles < k.def.expects.axles) flag('axles', 6, 'amber', 'Wrong axle count', `${k.def.name}: ${k.def.expects.why}`);
  }
  const allow = { any: 3, drive: 1, tow: 1, hauler: 3 }[d.brief.transport];
  if (tr.chosen.difficulty > allow) flag('transport-brief', 9, 'amber', 'Harder transport than the brief', `A ${tr.chosen.short} is a ${['', 'easy', 'moderate', 'hard'][tr.chosen.difficulty]} haul; the brief says ${({ drive: 'drive it', tow: 'tow it ourselves', hauler: 'hire a hauler', any: 'any' })[d.brief.transport]}.`);
  if (!tr.chosen.fits && tr.chosen.problems.some((p) => !p.startsWith('too tall'))) flag('transport-fit', 9, 'red', `Doesn’t fit the ${tr.chosen.short}`, `${tr.chosen.problems.join(', ')}.`);
  if (rc.cap === 0) flag('no-riders', 5, 'red', 'No riders fit', 'The build uses all the payload before anyone climbs on.');
  return f;
}
