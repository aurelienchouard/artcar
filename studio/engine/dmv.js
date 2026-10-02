/* DMV checks from the Mutant Vehicle Owner's Handbook (see the rules table for wording and dates). */
import { R } from '../catalogs/rules.js';
export function dmvCheck(g, dims, s) {
  const levels = [];
  levels.push({ name: 'Lower deck', y: g.deckY, rails: g.barge ? g.railTop - g.deckY : null });
  if (g.decks && g.decks.length) levels.push({ name: 'Upper deck', y: g.dTop, rails: s.railHeight });
  for (const l of levels) {
    l.needsRails = l.y >= R('dmvDeckHeight') - 1e-3;
    l.low = l.needsRails && (l.rails == null || l.rails < R('dmvRailMin') - 1e-3);
    l.high = l.needsRails && l.rails != null && l.rails > R('dmvRailMax') + 1e-3;
  }
  const size = dims.playa.size();
  const long = size[0] >= R('dmvLong') - 1e-3, wide = size[2] >= R('dmvWide') - 1e-3;
  return { levels, lcu: long || wide, long, wide, length: size[0], width: size[2] };
}
