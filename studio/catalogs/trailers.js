/* Ways to get the car to the playa. Deck heights, lengths and ratings are typical US figures (editable).
   difficulty: 1 easy (drive, or a trailer you tow with your own pickup), 2 moderate (hire a rollback or local hauler),
   3 hard (commercial step deck or lowboy, possibly permits). */
export const TRAILERS = {
  drive: { label: 'Drive it there on its own wheels', short: 'driving it', deck: 0, len: Infinity, width: Infinity, maxLb: Infinity, difficulty: 1,
    notes: 'Only if the vehicle is stock and road legal.', confidence: 'spec' },
  equipment: { label: '20′ equipment trailer', short: '20′ equipment trailer', deck: 0.56, len: 6.1, width: 2.59, maxLb: 7000, difficulty: 1,
    notes: 'Tow it with your own heavy pickup. Rating about 7,000 lb (est.).', confidence: 'estimate' },
  rollback: { label: 'Tow truck tilt bed, 22′', short: 'tow truck tilt bed', deck: 1.016, len: 6.7, width: 2.44, maxLb: 12000, difficulty: 2,
    notes: 'Hire a local rollback. Deck height about 3′4″ (est.); rated 10,000–12,000 lb.', confidence: 'estimate' },
  lowboy: { label: 'Lowboy, 2′ deck, 24′ well', short: 'lowboy', deck: 0.61, len: 7.3, width: 2.59, maxLb: 40000, difficulty: 3,
    notes: 'Commercial heavy haul. The lowest deck, so the most height to spare.', confidence: 'estimate' },
  stepdeck: { label: 'Step deck, 3′4″ deck, 37′ lower deck', short: 'step deck', deck: 1.016, len: 11.3, width: 2.59, maxLb: 45000, difficulty: 3,
    notes: 'Commercial freight. Common and cheaper than a lowboy.', confidence: 'estimate' },
  flatbed: { label: 'Flatbed, 48′, 5′ deck', short: '48′ flatbed', deck: 1.524, len: 14.6, width: 2.59, maxLb: 45000, difficulty: 3,
    notes: 'Commercial freight. The tallest deck: only low, packed cars fit.', confidence: 'estimate' },
};
