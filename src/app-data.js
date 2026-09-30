/* Art Car Studio — data.
   Units are meters. The car faces +X, origin midway between the axles. Driver side (left) is -Z. Y is up. */
'use strict';
const T = window.THREE;
const V3 = T.Vector3;
const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const LB_PER_KG = 2.20462;
const RIDER_KG = 79;   // 175 lb

/* ------------------------------------------------------------------ chassis catalog
   spec:   values the Chassis sliders start from (wheelbase, track, tire diameter, frame or cargo-deck height)
   ba:     bumper to front axle
   cab:    back/front are measured from the front axle (negative = behind it)
   seat:   driver hip point on the seat, relative to the front axle
   steer:  steering wheel center relative to the hip, and the column axis angle above horizontal
   buildup: art-car deck structure added on top of the frame height
   Numbers marked est. are typical values, not manufacturer data. */
const CHASSIS = {
  haulster: {
    label: 'Cushman Haulster, gas', short: 'Haulster', kind: 'cart',
    summary: '2012-generation heavy-duty utility truck: 2,400 lb capacity, 88″ wheelbase, 20.5″ tires, gas 3-cylinder, 20 mph. Older Haulsters are rated far lower (about 1,490 lb).',
    spec: { wheelbase: 2.24, track: 1.09, wheelDia: 0.52, frameHeight: 0.70 },   // 88.2″ WB, 42″/44″ track, 20.5×8-10; deck height est.
    dual: false, buildup: 0.12, ba: 0.55, length: 3.45, width: 1.35, cgY: 0.5,     // 136″ × 53″; BA and CG est.
    cab: { back: -0.8, front: 0.55, floorY: 0.40, roofY: 1.88, width: 1.30 },
    seat: { dx: -0.42, y: 0.80, z: -0.32 },
    steer: { dx: 0.42, dy: 0.46, tilt: 45 },
    payloadLb: 2400, curbLb: 1440, cabLabel: 'Open bench seat',
    body: {
      length: 4.3, width: 2.3, bodyFront: 0.8, headroom: 1.95, roofOverhang: 0.04, posts: 4, frontPosts: false,
      tubeDia: 0.5, tubeLift: 0.58, tubeFront: 0.61, tubeRear: 0.305, tubeTaper: 0.3,
      frontLen: 1.5, layout: 'platform', seatDepth: 0.55, rearStyle: 'none', rearLen: 0.5, curtains: 'all',
      roofDeck: false, roofSeating: 'none', roofDeckFront: 0, roofDeckRear: 0, railHeight: 0.95, ladder: 'rear', roofShade: 'cloth',
      bikeRack: 'rear', bikes: 2, driverStep: true, secondStep: 'none', secondStepPos: -0.5,
      trailer: 'equipment', removeRoof: false, removeRails: false, keepCab: false,
      tubeBuild: 'perforated', ribSpacing: 0.61, power: 'battery', batteryKwh: 3, speakers: 'corners', neon: true,
    },
  },
  bigfoot: {
    label: 'Taylor-Dunn Bigfoot XL', short: 'Bigfoot XL', kind: 'cart',
    summary: 'Electric utility vehicle, 3,000 lb load, open two-seat compartment, 18 mph.',
    spec: { wheelbase: 1.575, track: 1.17, wheelDia: 0.52, frameHeight: 0.70 },   // 62″ WB, 20.5″ tires, 27.5″ deck; track est.
    dual: false, buildup: 0.12, ba: 0.80, length: 3.31, width: 1.45, cgY: 0.45,              // BA est., 130.5″ × 57″
    cab: { back: -0.55, front: 0.8, floorY: 0.40, roofY: 1.32, width: 1.40 },
    seat: { dx: -0.22, y: 0.78, z: -0.33 },
    steer: { dx: 0.44, dy: 0.5, tilt: 50 },
    payloadLb: 3000, curbLb: 1965, cabLabel: 'Open operator seat',
    body: {
      length: 3.45, width: 2.3, bodyFront: 0.8, headroom: 1.2, roofOverhang: 0.04, posts: 3, frontPosts: false,
      tubeDia: 0.5, tubeLift: 0.58, tubeFront: 0.61, tubeRear: 0.305, tubeTaper: 0.3,
      frontLen: 1.5, layout: 'platform', seatDepth: 0.55, rearStyle: 'none', rearLen: 0.5, curtains: 'none',
      roofDeck: true, roofSeating: 'none', roofDeckFront: 0, roofDeckRear: 0, railHeight: 0.95, ladder: 'rear', roofShade: 'solid',
      bikeRack: 'rear', bikes: 2, driverStep: true, secondStep: 'none', secondStepPos: -0.7,
      trailer: 'equipment', removeRoof: false, removeRails: false, keepCab: false,
      tubeBuild: 'perforated', ribSpacing: 0.61, power: 'battery', batteryKwh: 3, speakers: 'corners', neon: true,
    },
  },
  mc480: {
    label: 'Motrec MC-480 48V HD', short: 'MC-480', kind: 'cart',
    summary: 'Electric burden carrier, 5,000 lb load, open two-seat compartment, 10 mph.',
    spec: { wheelbase: 1.42, track: 0.98, wheelDia: 0.46, frameHeight: 0.79 },    // 56″ WB, 31″ deck; track and tires est.
    dual: false, buildup: 0.12, ba: 0.68, length: 3.2, width: 1.14, cgY: 0.45,               // 126″ × 45″; BA est.
    cab: { back: -0.5, front: 0.68, floorY: 0.38, roofY: 1.37, width: 1.12 },
    seat: { dx: -0.18, y: 0.78, z: -0.28 },
    steer: { dx: 0.42, dy: 0.5, tilt: 55 },
    payloadLb: 5000, curbLb: 1700, cabLabel: 'Open operator seat',
    body: {
      length: 3.35, width: 2.14, bodyFront: 0.68, headroom: 1.95, roofOverhang: 0.04, posts: 3, frontPosts: false,
      tubeDia: 0.44, tubeLift: 0.52, tubeFront: 0.61, tubeRear: 0.305, tubeTaper: 0.3,
      frontLen: 1.5, layout: 'platform', seatDepth: 0.55, rearStyle: 'none', rearLen: 0.5, curtains: 'all',
      roofDeck: false, roofSeating: 'none', roofDeckFront: 0, roofDeckRear: 0, railHeight: 0.95, ladder: 'rear', roofShade: 'cloth',
      bikeRack: 'rear', bikes: 2, driverStep: true, secondStep: 'none', secondStepPos: -0.5,
      trailer: 'equipment', removeRoof: false, removeRails: false, keepCab: false,
      tubeBuild: 'perforated', ribSpacing: 0.61, power: 'battery', batteryKwh: 3, speakers: 'corners', neon: true,
    },
  },
  npr: {
    label: 'Isuzu NPR-HD, 176″ wheelbase', short: 'NPR-HD', kind: 'cabover', removableCab: true,
    summary: 'Class 4 low cab forward, 14,500 lb GVWR. The driver sits over the front axle, so the front section is short.',
    spec: { wheelbase: 4.47, track: 1.68, wheelDia: 0.81, frameHeight: 0.78 },    // 176″ WB, 225/70R19.5; track and frame est.
    dual: true, buildup: 0.18, ba: 1.22, length: 6.8, width: 2.04, cgY: 0.85,
    cab: { back: -0.58, front: 1.2, floorY: 1.0, roofY: 2.26, width: 2.04 },
    seat: { dx: 0.2, y: 1.32, z: -0.5 },
    steer: { dx: 0.44, dy: 0.52, tilt: 35 },
    payloadLb: 8000, curbLb: 6500, cabLabel: 'Low cab forward',
    body: {
      length: 6.6, width: 2.54, bodyFront: 1.22, headroom: 1.95, roofOverhang: 0, posts: 5, frontPosts: false,
      tubeDia: 0.6, tubeLift: 0.55, tubeFront: 0.61, tubeRear: 0.305, tubeTaper: 0.25,
      frontLen: 1.7, layout: 'ring', seatDepth: 0.6, rearStyle: 'panels', rearLen: 0.8,
      roofDeck: true, roofSeating: 'pillows', roofDeckFront: 1.8, roofDeckRear: 1.6, railHeight: 0.95, ladder: 'front',
      bikeRack: 'rear', bikes: 4, driverStep: true, secondStep: 'passenger', secondStepPos: 0,
      trailer: 'lowboy', removeRoof: false, removeRails: true, keepCab: false,
      tubeBuild: 'perforated', ribSpacing: 0.61, power: 'generator', batteryKwh: 10, speakers: 'corners', neon: true,
    },
  },
  express: {
    label: 'Chevrolet Express 3500 cutaway, 159″ wheelbase', short: 'Express 3500', kind: 'conventional', removableCab: true, doghouse: true,
    summary: 'Class 3 van cutaway, 12,300 lb GVWR, LT225/75R16 dual rear wheels. The penguin is built on one of these.',
    spec: { wheelbase: 4.04, track: 1.75, wheelDia: 0.74, frameHeight: 0.70 },    // 159″ WB, 225/75R16; track and frame est.
    dual: true, buildup: 0.16, ba: 0.93, length: 6.6, width: 2.02, cgY: 0.75,               // cab back 59″ behind the front axle; BA est.
    cab: { back: -1.50, front: -0.25, floorY: 0.62, roofY: 2.2, width: 2.0, hoodTop: 1.22, hoodW: 1.7 },
    seat: { dx: -1.15, y: 1.02, z: -0.45 },
    steer: { dx: 0.42, dy: 0.5, tilt: 32 },
    payloadLb: 6300, curbLb: 6000, cabLabel: 'Van cutaway',
    body: {
      length: 5.9, width: 2.84, bodyFront: 0.2, headroom: 2.1, roofOverhang: 0, posts: 5, frontPosts: false,
      tubeDia: 0.7, tubeLift: 0.4, tubeFront: 0.61, tubeRear: 0.305, tubeTaper: 0.4,
      frontLen: 1.85, layout: 'lshape', seatDepth: 0.66, rearStyle: 'panels', rearLen: 1.0,
      roofDeck: true, roofSeating: 'pillows', roofDeckFront: 1.6, roofDeckRear: 1.25, railHeight: 0.95, ladder: 'front',
      bikeRack: 'rear', bikes: 4, driverStep: true, secondStep: 'passenger', secondStepPos: 0.2,
      trailer: 'stepdeck', removeRoof: true, removeRails: true, keepCab: false,
      tubeBuild: 'perforated', ribSpacing: 0.61, power: 'generator', batteryKwh: 10, speakers: 'corners', neon: true,
    },
  },
  f350: {
    label: 'Ford F-350 DRW chassis cab, 169″ wheelbase', short: 'F-350', kind: 'conventional', removableCab: true,
    summary: 'Class 3 regular cab chassis, 14,000 lb GVWR, LT245/75R17 dual rear wheels. The long hood makes the front section long.',
    spec: { wheelbase: 4.29, track: 1.74, wheelDia: 0.80, frameHeight: 0.84 },    // 169″ WB, 84″ CA; track and frame est.
    dual: true, buildup: 0.18, ba: 0.97, length: 6.47, width: 2.03, cgY: 0.8,               // 38.3″ front overhang, 80″ wide
    cab: { back: -2.16, front: -0.66, floorY: 0.78, roofY: 2.04, width: 2.03, hoodTop: 1.48, hoodW: 1.1 },
    seat: { dx: -1.61, y: 1.1, z: -0.45 },
    steer: { dx: 0.44, dy: 0.52, tilt: 30 },
    payloadLb: 7000, curbLb: 7000, cabLabel: 'Conventional regular cab',
    body: {
      length: 6.6, width: 2.54, bodyFront: 0.97, headroom: 1.95, roofOverhang: 0, posts: 5, frontPosts: false,
      tubeDia: 0.62, tubeLift: 0.5, tubeFront: 0.61, tubeRear: 0.305, tubeTaper: 0.25,
      frontLen: 3.1, layout: 'ring', seatDepth: 0.6, rearStyle: 'panels', rearLen: 0.9,
      roofDeck: true, roofSeating: 'pillows', roofDeckFront: 1.2, roofDeckRear: 1.4, railHeight: 0.95, ladder: 'front',
      bikeRack: 'rear', bikes: 4, driverStep: true, secondStep: 'passenger', secondStepPos: 0,
      trailer: 'lowboy', removeRoof: false, removeRails: true, keepCab: false,
      tubeBuild: 'perforated', ribSpacing: 0.61, power: 'generator', batteryKwh: 10, speakers: 'corners', neon: true,
    },
  },
};

/* Tube construction: default ring spacing, what the skin is, and what the lengthwise members are. */
const TUBE_BUILDS = {
  sheet: { label: 'Thin sheet over hoops', spacing: 0.6, skin: 'alu', hoop: true },
  plyskin: { label: 'Plywood ribs and skin', spacing: 0.4, skin: 'ply', ribs: true },
  lattice: { label: 'Plywood lattice, no skin (penguin)', spacing: 0.61, ribs: true, lengthwise: 'ply' },
  perforated: { label: 'Perforated metal over hoops', spacing: 0.61, skin: 'perf', hoop: true },
  translucent: { label: 'Translucent panels, lit inside', spacing: 0.6, skin: 'poly', hoop: true },
  frame: { label: 'Open metal frame', spacing: 0.45, hoop: true, lengthwise: 'steel' },
};
const chassisOf = (s) => CHASSIS[s.chassis] || CHASSIS.bigfoot;

/* ------------------------------------------------------------------ design state */
const STYLE = {
  name: 'Double-decker lounge',
  // tubes
  ledLines: 9, ribStyle: 'metal', endCages: false, tubeShape: 'round', tubeSides: 5,
  // lower deck
  curtains: 'all', curtainsDrawn: false, riders: true, standing: 'comfortable',
  // roof
  hideRoof: false, roofShade: 'cloth', neonSize: 0.8,
  // frame view
  frameView: false,
  // transport
  transportPreview: false,
  // lighting
  ledMode: 'sunset', ledColor: '#ffae57', ledColor2: '#8fd3ff', ledLevel: 0.5,
  // finish
  frameColor: '#2b2d31', tubeColor: '#3a3d42', fabricColor: '#d9cfbf', accentColor: '#b8702c', rugColor: '#b19a77', cabColor: '#e9e7e2', cabMatch: true, shadeColor: '#34363a',
  // scene + checks
  mood: 'night', units: 'imperial', riderTarget: 20,
};
/* How far the body may grow on a given chassis: rear overhang up to 60% of the wheelbase on trucks and 70% on carts
   (or the vehicle's own rear overhang plus 6″ if that's more), about 1′ past the bumper, and 1.6′ past the vehicle on each side. */
function bodyLimits(s) {
  const C = chassisOf(s);
  const ownRear = C.length - C.ba - C.spec.wheelbase;
  const rearMax = Math.max(ownRear + 0.15, (C.kind === 'cart' ? 0.7 : 0.6) * s.wheelbase);
  const frontMax = C.ba + 0.3;
  const bf = clamp(s.bodyFront, -0.5, frontMax);
  return {
    bodyFront: [-0.5, frontMax],
    length: [3, Math.max(3, +(bf + s.wheelbase + rearMax).toFixed(2))],
    width: [Math.max(1.6, +(C.width + 0.3).toFixed(2)), +(C.width + 1.0).toFixed(2)],
    rearMax,
  };
}
function chassisDefaults(id) {
  const c = CHASSIS[id];
  return { chassis: id, ...c.spec, ...c.body };
}
const BASE = { ...STYLE, ...chassisDefaults('express'), name: 'Penguin-style Express' };

const PRESETS = [
  { id: 'haulster', label: 'Haulster, shade lounge', values: () => ({ ...STYLE, ...chassisDefaults('haulster'), name: 'Haulster shade lounge' }) },
  { id: 'bigfoot', label: 'Bigfoot XL, two-level', values: () => ({ ...STYLE, ...chassisDefaults('bigfoot'), name: 'Bigfoot XL two-level' }) },
  { id: 'mc480', label: 'MC-480, shade lounge', values: () => ({ ...STYLE, ...chassisDefaults('mc480'), name: 'MC-480 shade lounge' }) },
  { id: 'npr', label: 'NPR-HD, open cab', values: () => ({ ...STYLE, ...chassisDefaults('npr'), name: 'Open-cab NPR-HD' }) },
  { id: 'express', label: 'Express, penguin-style', values: () => ({ ...STYLE, ...chassisDefaults('express'), name: 'Penguin-style Express' }) },
  { id: 'f350', label: 'F-350, open cab', values: () => ({ ...STYLE, ...chassisDefaults('f350'), name: 'Open-cab F-350' }) },
];

/* Deck heights and usable deck lengths are typical US figures. */
const TRAILERS = {
  drive: { label: 'Drive it there on its own wheels', deck: 0, len: Infinity, maxLb: Infinity },
  equipment: { label: '20′ equipment trailer, 1′ 10″ deck', deck: 0.56, len: 6.1, maxLb: 7000 },
  rollback: { label: 'Tow truck tilt bed, 22′ bed', deck: 1.0, len: 6.7, maxLb: 12000 },
  lowboy: { label: 'Lowboy, 2′ deck, 24′ well', deck: 0.61, len: 7.3, maxLb: 40000 },
  stepdeck: { label: 'Step deck, 3′ 4″ deck, 37′ lower deck', deck: 1.016, len: 11.3, maxLb: 45000 },
  flatbed: { label: '48′ flatbed, 5′ deck', deck: 1.524, len: 14.6, maxLb: 45000 },
};
const DMV_RAIL_MIN = 0.914, DMV_DECK_HEIGHT = 2.134, DMV_LONG = 7.62, DMV_WIDE = 3.962;   // 36″, 84″, 25′, 13′

/* ------------------------------------------------------------------ panel schema
   `rebuild: false` keys only touch materials, lights or stats. `type: 'info'` blocks are read-only readouts. */
const SECTIONS = [
  { title: 'Chassis', open: true, fields: [
    { k: 'chassis', label: 'Vehicle, smallest to largest', type: 'select', options: Object.entries(CHASSIS).map(([id, c]) => [id, c.label]) },
    { type: 'info', id: 'chassisInfo' },
    { k: 'keepCab', label: 'Keep the cab and windshield', type: 'toggle', when: (s) => !!chassisOf(s).removableCab },
    { k: 'wheelbase', label: 'Wheelbase', type: 'range', min: 1.2, max: 6, step: 0.01, fmt: 'len' },
    { k: 'track', label: 'Track width', type: 'range', min: 0.8, max: 2.2, step: 0.01, fmt: 'len' },
    { k: 'wheelDia', label: 'Tire diameter', type: 'range', min: 0.4, max: 1.1, step: 0.01, fmt: 'len' },
    { k: 'frameHeight', label: 'Frame or cargo-deck height', type: 'range', min: 0.45, max: 1.2, step: 0.01, fmt: 'len' },
  ]},
  { title: 'Body', fields: [
    { k: 'length', label: 'Body length', type: 'range', min: 3, max: 11, step: 0.05, fmt: 'len', lim: (s) => bodyLimits(s).length },
    { k: 'width', label: 'Body width', type: 'range', min: 1.6, max: 4.2, step: 0.01, fmt: 'len', lim: (s) => bodyLimits(s).width },
    { k: 'bodyFront', label: 'Body front, ahead of front axle', type: 'range', min: -0.5, max: 2.5, step: 0.01, fmt: 'len', lim: (s) => bodyLimits(s).bodyFront },
    { k: 'headroom', label: 'Headroom below the roof or top deck', type: 'range', min: 1.1, max: 2.5, step: 0.01, fmt: 'len' },
    { k: 'roofOverhang', label: 'Roof overhang', type: 'range', min: 0, max: 0.4, step: 0.01, fmt: 'len' },
    { k: 'posts', label: 'Posts per side', type: 'range', min: 2, max: 8, step: 1, fmt: 'int' },
    { k: 'frontPosts', label: 'Posts ahead of the driver', type: 'toggle' },
  ]},
  { title: 'Tubes', fields: [
    { k: 'tubeBuild', label: 'Construction', type: 'select', options: Object.entries(TUBE_BUILDS).map(([id, t]) => [id, t.label]) },
    { k: 'tubeShape', label: 'Shape', type: 'seg', options: [['round', 'Round'], ['faceted', 'Faceted']] },
    { k: 'tubeSides', label: 'Sides', type: 'range', min: 5, max: 10, step: 1, fmt: 'int', when: (s) => s.tubeShape === 'faceted' },
    { k: 'tubeDia', label: 'Tube diameter', type: 'range', min: 0.4, max: 1.3, step: 0.01, fmt: 'len' },
    { k: 'tubeLift', label: 'Ground clearance', type: 'range', min: 0.1, max: 0.6, step: 0.01, fmt: 'len' },
    { k: 'tubeFront', label: 'Sticks out past the front', type: 'range', min: 0, max: 2.5, step: 0.01, fmt: 'len' },
    { k: 'tubeRear', label: 'Sticks out past the back', type: 'range', min: 0, max: 2.5, step: 0.01, fmt: 'len' },
    { k: 'tubeTaper', label: 'Taper past the body', type: 'range', min: 0, max: 0.45, step: 0.01, fmt: 'taper' },
    { k: 'ledLines', label: 'LED lines along each tube', type: 'range', min: 0, max: 16, step: 1, fmt: 'int', when: (s) => s.tubeShape !== 'faceted' },
    { k: 'ribStyle', label: 'Ring finish', type: 'select',
      options: [['solid', 'Solid LED color'], ['second', 'Solid second color'], ['match', 'Follow the LED pattern'], ['metal', 'Bare'], ['none', 'None showing']] },
    { k: 'ribSpacing', label: 'Ring spacing', type: 'range', min: 0.2, max: 2, step: 0.01, fmt: 'len' },
    { k: 'endCages', label: 'Caged tube ends', type: 'toggle', when: (s) => !!TUBE_BUILDS[s.tubeBuild]?.skin },
  ]},
  { title: 'Lower deck', fields: [
    { k: 'layout', label: 'Lounge seating', type: 'select', options: [['platform', 'One big cushioned platform'], ['lshape', 'L-shaped couch, open dance floor'], ['ring', 'Closed ring'], ['ushape', 'U, open at the rear'], ['facing', 'Facing benches']] },
    { k: 'seatDepth', label: 'Seat depth', type: 'range', min: 0.45, max: 0.95, step: 0.01, fmt: 'len' },
    { k: 'standing', label: 'Standing and dancing', type: 'select', options: [['none', 'Seats only'], ['comfortable', 'Comfortable, 9 sq ft each'], ['party', 'Party, 5 sq ft each'], ['packed', 'Packed, 3.5 sq ft each']] },
    { k: 'curtains', label: 'Curtains', type: 'select', options: [['rear', 'Rear corners of the lounge'], ['all', 'All lounge corners'], ['none', 'None']] },
    { k: 'curtainsDrawn', label: 'Curtains drawn against wind and dust', type: 'toggle', when: (s) => s.curtains !== 'none' },
    { k: 'riders', label: 'Show scale riders', type: 'toggle', rebuild: false },
  ]},
  { title: 'Back end', fields: [
    { k: 'rearStyle', label: 'Rear section', type: 'select',
      options: [['none', 'None, lounge runs to the back'], ['panels', 'Low closed-off section'], ['daiquiri', 'Low section with daiquiri bar']] },
    { k: 'rearLen', label: 'Rear section length', type: 'range', min: 0.3, max: 3.5, step: 0.01, fmt: 'len', when: (s) => s.rearStyle !== 'none' },
    { k: 'bikeRack', label: 'Bike racks, hung by the front wheel', type: 'select', options: [['none', 'None'], ['rear', 'On the back'], ['sides', 'On both sides'], ['both', 'Back and sides']] },
    { k: 'bikes', label: 'Bikes per rack', type: 'range', min: 1, max: 10, step: 1, fmt: 'int', when: (s) => s.bikeRack !== 'none' },
  ]},
  { title: 'Steps and ladder', fields: [
    { k: 'driverStep', label: 'Step beside the driver', type: 'toggle' },
    { k: 'secondStep', label: 'Second entry step', type: 'select', options: [['none', 'None'], ['driver', 'Driver side'], ['passenger', 'Passenger side']] },
    { k: 'secondStepPos', label: 'Second step position', type: 'range', min: -1, max: 1, step: 0.01, fmt: 'pos', when: (s) => s.secondStep !== 'none' },
    { k: 'ladder', label: 'Roof ladder', type: 'select', options: [['front', 'Front, angled beside the driver'], ['rear', 'Back, vertical'], ['none', 'None']], when: (s) => s.roofDeck },
  ]},
  { title: 'Roof', fields: [
    { k: 'roofShade', label: 'Roof outside the deck', type: 'seg', options: [['cloth', 'Shade cloth'], ['solid', 'Solid']] },
    { k: 'roofDeck', label: 'Rideable roof deck', type: 'toggle' },
    { k: 'roofDeckFront', label: 'Shade roof only, at the front', type: 'range', min: 0, max: 5, step: 0.01, fmt: 'len', when: (s) => s.roofDeck },
    { k: 'roofDeckRear', label: 'Shade roof only, at the back', type: 'range', min: 0, max: 5, step: 0.01, fmt: 'len', when: (s) => s.roofDeck },
    { k: 'roofSeating', label: 'Roof seating', type: 'select', options: [['pillows', 'Floor pillows'], ['u', 'U of daybeds'], ['sides', 'Daybeds along the sides'], ['none', 'Open deck']], when: (s) => s.roofDeck },
    { k: 'railHeight', label: 'Rail height', type: 'range', min: 0.3, max: 1.25, step: 0.01, fmt: 'len', when: (s) => s.roofDeck },
    { k: 'neon', label: 'Lightning bolt neon on the front rail', type: 'toggle', when: (s) => s.roofDeck },
    { k: 'neonSize', label: 'Neon height', type: 'range', min: 0.25, max: 1.25, step: 0.01, fmt: 'len', when: (s) => s.roofDeck && s.neon },
    { k: 'hideRoof', label: 'Hide roof to see inside', type: 'toggle', rebuild: false },
  ]},
  { title: 'Lighting', fields: [
    { k: 'ledMode', label: 'LED pattern', type: 'seg', cls: 'led', rebuild: false,
      options: [['solid', 'Solid'], ['breathe', 'Breathe'], ['chase', 'Chase'], ['sunset', 'Sunset'], ['sparkle', 'Sparkle'], ['off', 'Off']] },
    { k: 'ledColor', label: 'LED color', type: 'color', rebuild: false },
    { k: 'ledColor2', label: 'Second color', type: 'color', rebuild: false },
    { k: 'ledLevel', label: 'Brightness', type: 'range', min: 0, max: 2, step: 0.01, fmt: 'pct', rebuild: false },
  ]},
  { title: 'Power and sound', fields: [
    { k: 'power', label: 'Power', type: 'select', options: [['battery', 'Lithium batteries only'], ['generator', 'Propane generator and batteries']] },
    { k: 'batteryKwh', label: 'Battery bank', type: 'range', min: 2, max: 40, step: 1, fmt: 'kwh' },
    { k: 'speakers', label: 'Speakers', type: 'select', options: [['tubes', 'In the tube ends'], ['corners', 'Hung: two out on the passenger side, two small in on the driver side'], ['towers', 'Towers at the back of the lounge']] },
  ]},
  { title: 'Finish', fields: [
    { k: 'frameColor', label: 'Frame and roof', type: 'color', rebuild: false },
    { k: 'tubeColor', label: 'Tubes and panels', type: 'color', rebuild: false },
    { k: 'shadeColor', label: 'Shade cloth', type: 'color', rebuild: false },
    { k: 'fabricColor', label: 'Cushions and curtains', type: 'color', rebuild: false },
    { k: 'accentColor', label: 'Throw pillows and awning', type: 'color', rebuild: false },
    { k: 'rugColor', label: 'Rug', type: 'color', rebuild: false },
    { k: 'cabMatch', label: 'Cab paint matches the tubes', type: 'toggle', rebuild: false },
    { k: 'cabColor', label: 'Cab paint', type: 'color', rebuild: false, when: (s) => !s.cabMatch },
  ]},
  { title: 'Frame and cut list', fields: [
    { k: 'frameView', label: 'Show the bare frame', type: 'toggle', rebuild: false },
    { type: 'info', id: 'cutList', note: 'cutNote' },
  ]},
  { title: 'Weight and riders', fields: [
    { type: 'info', id: 'stats', note: 'statsNote' },
    { k: 'riderTarget', label: 'Rider target', type: 'range', min: 4, max: 40, step: 1, fmt: 'int', rebuild: false },
    { k: 'units', label: 'Units', type: 'seg', rebuild: false, options: [['imperial', 'Feet and pounds'], ['metric', 'Meters and kilograms']] },
  ]},
  { title: 'Transport', fields: [
    { type: 'info', id: 'transportInfo', note: 'transportNote' },
    { k: 'removeRoof', label: 'Roof and posts come off', type: 'toggle', rebuild: false },
    { k: 'removeRails', label: 'Roof rails and cushions come off', type: 'toggle', rebuild: false, when: (s) => s.roofDeck && !s.removeRoof },
    { k: 'trailer', label: 'Getting it there', type: 'select', rebuild: false, options: Object.entries(TRAILERS).map(([id, t]) => [id, t.label]) },
    { k: 'transportPreview', label: 'Show it packed for transport', type: 'toggle', rebuild: false },
  ]},
];
const FIELD = {};
SECTIONS.forEach((sec) => sec.fields.forEach((f) => { if (f.k) FIELD[f.k] = f; }));

const LIMIT_W = 2.5908;   // 8′ 6″
const LIMIT_H = 4.1148;   // 13′ 6″

function sanitize(input) {
  const src = input && typeof input === 'object' ? input : {};
  const chassis = CHASSIS[src.chassis] ? src.chassis : BASE.chassis;
  const out = { ...STYLE, ...chassisDefaults(chassis) };
  for (const k of Object.keys(BASE)) {
    const v = src[k];
    if (v === undefined || typeof v !== typeof BASE[k]) continue;
    const f = FIELD[k];
    if (typeof v === 'number') {
      if (!Number.isFinite(v)) continue;
      out[k] = f && f.type === 'range' ? clamp(v, f.min, f.max) : v;
    } else if (f && f.options) {
      if (f.options.some((o) => o[0] === v)) out[k] = v;
    } else if (typeof v === 'string' && /Color$/.test(k)) {
      if (/^#[0-9a-f]{6}$/i.test(v)) out[k] = v;
    } else out[k] = v;
  }
  if (!['day', 'dusk', 'night'].includes(out.mood)) out.mood = 'night';
  const lim = bodyLimits(out);
  out.bodyFront = clamp(out.bodyFront, ...lim.bodyFront);
  const lim2 = bodyLimits(out);
  out.length = clamp(out.length, ...lim2.length);
  out.width = clamp(out.width, ...lim2.width);
  return out;
}

/* ------------------------------------------------------------------ formatting */
function fmtLen(m, units) {
  if (units === 'metric') return m.toFixed(2) + ' m';
  const totalIn = Math.round(Math.abs(m) / 0.0254);
  const ft = Math.floor(totalIn / 12), inch = totalIn - ft * 12;
  return (m < 0 ? '−' : '') + (ft ? `${ft}′ ${inch}″` : `${inch}″`);
}
function fmtWeight(kg, units) {
  const v = units === 'metric' ? kg : kg * LB_PER_KG;
  const r = Math.abs(v) >= 1000 ? Math.round(v / 50) * 50 : Math.round(v / 10) * 10;
  return (v < 0 ? '−' : '') + Math.abs(r).toLocaleString('en-US') + (units === 'metric' ? ' kg' : ' lb');
}
function fmtField(f, v, units) {
  switch (f.fmt) {
    case 'len': return fmtLen(v, units);
    case 'int': return String(Math.round(v));
    case 'pct': return Math.round(v * 100) + '%';
    case 'taper': return v < 0.005 ? 'Straight' : `${Math.round(v * 100)}% narrower at the ends`;
    case 'kwh': return `${Math.round(v)} kWh`;
    case 'pos': return Math.abs(v) < 0.04 ? 'Middle of the lounge' : `${Math.round(Math.abs(v) * 100)}% toward the ${v > 0 ? 'front' : 'back'}`;
    default: return String(v);
  }
}
