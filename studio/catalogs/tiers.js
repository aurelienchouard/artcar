/* Cost and effort points per option, [cost, effort], each 0–3. Totals map to $, $$, $$$ and light, moderate,
   heavy with the bands in the rules table. No dollar or hour figures, ever. */
export const POINTS = {
  strip: { stock: [0, 0], cut: [1, 2], rails: [2, 3], cart: [0, 0] },
  rops: { kept: [0, 0], removed: [0, 1] },
  structure: { 'deck-posts': [2, 2], cage: [3, 3], barge: [1, 1], 'bed-ext': [1, 1] },
  material: { steel: [0, 0], alu: [1, 1] },
  size: [[14, [0, 0]], [22, [1, 1]], [Infinity, [2, 2]]],   // deck area in m²
  upper: { none: [0, 0], bunk: [1, 1], stand: [2, 2] },
  access: { 'ladder-front': [0, 0], 'ladder-rear': [0, 0], stairs: [1, 1], none: [0, 0] },
  coverage: { full: [0, 0], mid: [0, 0], modular: [0, 1] },
  seating: { platform: [1, 1], facing: [1, 1], lshape: [1, 1], ushape: [1, 1], ring: [2, 2] },
  rear: { none: [0, 0], panels: [1, 1], daiquiri: [2, 2] },
  zone: [1, 1],
  speakers: { none: [0, 0], corners: [1, 1], towers: [2, 1], tubes: [2, 2] },
  speakerLarge: [1, 0],
  battery: [[5, [1, 0]], [15, [2, 1]], [Infinity, [3, 1]]],
  generator: [1, 1],
  leds: [1, 1], neon: [1, 0], projectors: [1, 0],
};
export const STEP_OF = { vehicle: 1, strip: 2, structure: 3, upper: 4, layout: 5, design: 6, lights: 7, power: 8, transport: 9 };
