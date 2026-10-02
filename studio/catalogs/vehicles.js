/* Vehicle catalog. Metric (m, but weights in lb as published). X forward, front axle at x = wheelbase / 2.
   Every badged field carries a source and a confidence: spec (manufacturer sheet), measured, or estimate.
   Fields not listed in `facts` are estimates that still need a source ("verify").

   Geometry fields used by the 3D model and the engine:
   style:      body style of the base vehicle: cart | cabover | conventional
   ba:         bumper (front edge) to front axle
   af:         rear axle to the frame or tub end (rear overhang of the stock vehicle)
   length:     stock overall length at the default wheelbase
   frameHeight: top of frame rails or cargo deck; buildup is what the art-car deck adds on top
   cab:        back/front measured from the front axle (negative = behind it); floorY/roofY heights;
               hoodTop/hoodW for conventional hoods
   seat:       driver hip point relative to the front axle; steer: wheel center relative to the hip, column tilt
   extends:    copy every field from another entry, then override */

const EST = 'Studio estimate, needs a source';
function facts(map) {
  const sources = {}, confidence = {};
  for (const [k, [c, s]] of Object.entries(map)) { confidence[k] = c; sources[k] = s; }
  return { sources, confidence };
}
const SPEC_PAGE = (s) => ['spec', s];
const ESTIMATE = (s = EST) => ['estimate', s];

export const FAMILIES = [
  { id: 'cart', label: 'Utility carts', note: 'Low-speed burden carriers. Not road legal: always hauled.' },
  { id: 'utility', label: 'Small UTVs', note: 'Reference only: too small for a 15–20 rider target.' },
  { id: 'cabover', label: 'Cab-over trucks', note: 'Driver sits over the front axle, so the front section is short.' },
  { id: 'cutaway', label: 'Van cutaways', note: 'Van front, bare frame behind. The usual art car base.' },
  { id: 'chassis-cab', label: 'Chassis-cab pickups and trucks', note: 'Pickup-style cab and a long hood.' },
  { id: 'reality-check', label: 'Reality checks', note: 'Vehicles from the reality-check cards. Here to show what breaks.' },
];

const RAW = [
  /* ------------------------------------------------------------------ utility carts */
  {
    id: 'haulster', family: 'cart', style: 'cart', make: 'Cushman', model: 'Haulster', variant: '2012 generation, gas', short: 'Cushman Haulster',
    powertrain: 'gas', wheelbaseOptions: [2.24], track: { front: 1.09, rear: 1.09 }, tire: { size: '20.5×8-10', diameter: 0.52, dualRear: false },
    frameHeight: 0.70, buildup: 0.12, ba: 0.55, af: 0.66, length: 3.45, width: 1.35, cgY: 0.5,
    cab: { back: -0.8, front: 0.55, floorY: 0.40, roofY: 1.88, width: 1.30 }, seat: { dx: -0.42, y: 0.80, z: -0.32 }, steer: { dx: 0.42, dy: 0.46, tilt: 45 },
    gvwrLb: 3840, payloadLb: 2400, curbLb: 1440, topSpeedMph: 20, axles: 2, cabLabel: 'Open bench seat',
    deck: { length: 1.83, width: 1.20 },
    summary: 'Heavy-duty utility truck: 2,400 lb capacity, 88″ wheelbase, gas 3-cylinder, governed to 20 mph. Older Haulsters are rated far lower.',
    buying: { newAvailable: true, used: 'Common from universities, resorts and municipal fleets', knownIssues: ['Older Haulsters share the name but are rated about 1,490 lb'], service: 'Cushman and Club Car dealers' },
    ...facts({ wheelbase: SPEC_PAGE('Cushman Haulster spec sheet (2012 generation)'), track: SPEC_PAGE('Spec sheet: 42″ front, 44″ rear'), tire: SPEC_PAGE('Spec sheet'),
      length: SPEC_PAGE('Spec sheet: 136″'), width: SPEC_PAGE('Spec sheet: 53″'), curbLb: SPEC_PAGE('Spec sheet'), payloadLb: SPEC_PAGE('Spec sheet: 2,400 lb capacity'),
      topSpeedMph: SPEC_PAGE('Spec sheet: governed'), powertrain: SPEC_PAGE('Spec sheet: gas 3-cylinder'), frameHeight: ESTIMATE('Deck height needs measuring (verify)'), ba: ESTIMATE(), cgY: ESTIMATE() }),
    costTier: 1, effortTier: 1,
    defaults: { length: 4.3, width: 2.3, bodyFront: 0.8, headroom: 1.95, posts: 4, tubeDia: 0.5, tubeLift: 0.58, layout: 'platform', seatDepth: 0.55, rearStyle: 'none', rearLen: 0.5, curtains: 'all', roofDeck: false, roofSeating: 'none', roofDeckFront: 0, roofDeckRear: 0, ladder: 'rear', roofShade: 'cloth', bikeRack: 'rear', bikes: 2, secondStep: 'none', secondStepPos: -0.5, trailer: 'equipment', removeRoof: false, removeRails: false, power: 'battery', batteryKwh: 3, tubeTaper: 0.3, roofOverhang: 0.04 },
  },
  {
    id: 'haulster-old', extends: 'haulster', variant: 'older generation', short: 'Cushman Haulster (older)', wheelbaseOptions: [1.98],
    length: 3.2, af: 0.67, payloadLb: 1490, curbLb: 1200, gvwrLb: 2690,
    summary: 'Older Haulster: about 1,490 lb rated capacity on a 78″ wheelbase. Most other figures need checking.',
    buying: { newAvailable: false, used: 'Cheap and common, often tired', knownIssues: ['Much lower capacity than the 2012 generation'], service: 'Parts through Cushman dealers' },
    ...facts({ wheelbase: SPEC_PAGE('Maintenance manual: 78″'), payloadLb: SPEC_PAGE('Maintenance manual: about 1,490 lb rated capacity') }),
  },
  {
    id: 'bigfoot', family: 'cart', style: 'cart', make: 'Taylor-Dunn', model: 'Bigfoot XL', variant: 'electric', short: 'Taylor-Dunn Bigfoot XL',
    powertrain: 'electric', wheelbaseOptions: [1.575], track: { front: 1.17, rear: 1.17 }, tire: { size: '20.5×8-10', diameter: 0.52, dualRear: false },
    frameHeight: 0.70, buildup: 0.12, ba: 0.80, af: 0.935, length: 3.31, width: 1.45, cgY: 0.45,
    cab: { back: -0.55, front: 0.8, floorY: 0.40, roofY: 1.32, width: 1.40 }, seat: { dx: -0.22, y: 0.78, z: -0.33 }, steer: { dx: 0.44, dy: 0.5, tilt: 50 },
    gvwrLb: 4965, payloadLb: 3000, curbLb: 1965, topSpeedMph: 18, axles: 2, cabLabel: 'Open operator seat',
    summary: 'Electric utility vehicle, 3,000 lb load, open two-seat compartment, 18 mph.',
    buying: { newAvailable: true, used: 'Industrial auctions and plant surplus', knownIssues: ['Battery pack condition decides the price'], service: 'Taylor-Dunn dealers' },
    ...facts({ wheelbase: SPEC_PAGE('Taylor-Dunn Bigfoot XL spec sheet: 62″'), frameHeight: SPEC_PAGE('Spec sheet: 27.5″ deck'), payloadLb: SPEC_PAGE('Spec sheet: 3,000 lb load'),
      curbLb: SPEC_PAGE('Spec sheet: about 1,965 lb'), powertrain: SPEC_PAGE('Spec sheet'), length: SPEC_PAGE('Spec sheet: 130.5″'), width: SPEC_PAGE('Spec sheet: 57″'),
      topSpeedMph: SPEC_PAGE('Spec sheet'), tire: SPEC_PAGE('Spec sheet'), track: ESTIMATE(), ba: ESTIMATE(), cgY: ESTIMATE() }),
    costTier: 1, effortTier: 1,
    defaults: { length: 3.45, width: 2.3, bodyFront: 0.8, headroom: 1.2, posts: 3, tubeDia: 0.5, tubeLift: 0.58, layout: 'platform', seatDepth: 0.55, rearStyle: 'none', rearLen: 0.5, curtains: 'none', roofDeck: true, roofSeating: 'none', roofDeckFront: 0, roofDeckRear: 0, ladder: 'rear', roofShade: 'solid', bikeRack: 'rear', bikes: 2, secondStep: 'none', secondStepPos: -0.7, trailer: 'equipment', removeRoof: false, removeRails: false, power: 'battery', batteryKwh: 3, tubeTaper: 0.3, roofOverhang: 0.04 },
  },
  {
    id: 'td-heavy', extends: 'bigfoot', model: 'heavy-duty custom', variant: 'electric', short: 'Taylor-Dunn heavy custom',
    wheelbaseOptions: [1.83], track: { front: 1.22, rear: 1.22 }, tire: { size: '6.00-9 (est.)', diameter: 0.56, dualRear: false },
    frameHeight: 0.75, ba: 0.85, af: 1.12, length: 3.8, width: 1.5, payloadLb: 6400, curbLb: 2600, gvwrLb: 9000, topSpeedMph: 15,
    summary: 'Custom heavy Taylor-Dunn builds go up to about 6,400 lb. Every figure here needs a source.',
    buying: { newAvailable: true, used: 'Rare; mostly built to order', knownIssues: [], service: 'Taylor-Dunn dealers' },
    ...facts({ payloadLb: ESTIMATE('Up to about 6,400 lb on custom builds (verify)'), wheelbase: ESTIMATE(), frameHeight: ESTIMATE(), curbLb: ESTIMATE(), length: ESTIMATE(), width: ESTIMATE(), tire: ESTIMATE(), topSpeedMph: ESTIMATE(), powertrain: SPEC_PAGE('Taylor-Dunn') }),
    costTier: 2, effortTier: 1, defaults: { roofDeck: false, headroom: 1.95, length: 4.6, roofShade: 'cloth' },
  },
  {
    id: 'mc480', family: 'cart', style: 'cart', make: 'Motrec', model: 'MC-480', variant: '48 V HD, electric', short: 'Motrec MC-480',
    powertrain: 'electric', wheelbaseOptions: [1.42], track: { front: 0.98, rear: 0.98 }, tire: { size: '18×8.5-8 (est.)', diameter: 0.46, dualRear: false },
    frameHeight: 0.79, buildup: 0.12, ba: 0.68, af: 1.10, length: 3.2, width: 1.14, cgY: 0.45,
    cab: { back: -0.5, front: 0.68, floorY: 0.38, roofY: 1.37, width: 1.12 }, seat: { dx: -0.18, y: 0.78, z: -0.28 }, steer: { dx: 0.42, dy: 0.5, tilt: 55 },
    gvwrLb: 6700, payloadLb: 5000, curbLb: 1700, topSpeedMph: 10, axles: 2, cabLabel: 'Open operator seat',
    summary: 'Electric burden carrier, 5,000 lb load, open two-seat compartment, 10 mph. A narrow track for its capacity.',
    buying: { newAvailable: true, used: 'Factory and airport surplus', knownIssues: ['Narrow track limits how tall you can build'], service: 'Motrec dealers' },
    ...facts({ wheelbase: SPEC_PAGE('Motrec MC-480 spec sheet: 56″'), frameHeight: SPEC_PAGE('Spec sheet: 31″ deck'), payloadLb: SPEC_PAGE('Spec sheet: 5,000 lb'),
      length: SPEC_PAGE('Spec sheet: 126″'), width: SPEC_PAGE('Spec sheet: 45″'), powertrain: SPEC_PAGE('Spec sheet'), track: ESTIMATE('About 3′2″ (verify)'), tire: ESTIMATE(), ba: ESTIMATE(), curbLb: ESTIMATE(), topSpeedMph: ESTIMATE(), cgY: ESTIMATE() }),
    costTier: 1, effortTier: 1,
    defaults: { length: 3.35, width: 2.14, bodyFront: 0.68, headroom: 1.95, posts: 3, tubeDia: 0.44, tubeLift: 0.52, layout: 'platform', seatDepth: 0.55, rearStyle: 'none', rearLen: 0.5, curtains: 'all', roofDeck: false, roofSeating: 'none', roofDeckFront: 0, roofDeckRear: 0, ladder: 'rear', roofShade: 'cloth', bikeRack: 'rear', bikes: 2, secondStep: 'none', secondStepPos: -0.5, trailer: 'equipment', removeRoof: false, removeRails: false, power: 'battery', batteryKwh: 3, tubeTaper: 0.3, roofOverhang: 0.04 },
  },
  {
    id: 'mc660', extends: 'mc480', model: 'MC-660', variant: 'electric', short: 'Motrec MC-660',
    wheelbaseOptions: [1.63], track: { front: 1.02, rear: 1.02 }, length: 3.5, af: 1.19, width: 1.2, payloadLb: 6000, curbLb: 2000, gvwrLb: 8000,
    summary: 'A larger Motrec burden carrier. Every figure here needs a source.',
    ...facts({ powertrain: SPEC_PAGE('Motrec') }),
    defaults: { length: 3.8 },
  },
  {
    id: 'ranger-kinetic', family: 'utility', style: 'cart', make: 'Polaris', model: 'Ranger XP Kinetic', variant: 'electric UTV', short: 'Polaris Ranger XP Kinetic',
    powertrain: 'electric', wheelbaseOptions: [2.06], track: { front: 1.37, rear: 1.37 }, tire: { size: '27″ (est.)', diameter: 0.69, dualRear: false },
    frameHeight: 0.86, buildup: 0.12, ba: 0.62, af: 0.37, length: 3.05, width: 1.59, cgY: 0.6,
    cab: { back: -1.35, front: 0.15, floorY: 0.45, roofY: 1.95, width: 1.5 }, seat: { dx: -1.0, y: 0.85, z: -0.36 }, steer: { dx: 0.4, dy: 0.5, tilt: 50 },
    gvwrLb: 3850, payloadLb: 1250, curbLb: 2600, topSpeedMph: 50, axles: 2, cabLabel: 'UTV cab with roll cage', rops: true,
    summary: 'Reference only: a strong UTV, but its payload carries about a handful of riders after any build.',
    buying: { newAvailable: true, used: 'Dealer trade-ins', knownIssues: [], service: 'Polaris dealers' },
    ...facts({ powertrain: SPEC_PAGE('Polaris') }),
    costTier: 2, effortTier: 1, defaults: { length: 3.3, roofDeck: false, layout: 'facing', headroom: 1.95 },
  },
  {
    id: 'gem-elxd', extends: 'ranger-kinetic', make: 'GEM', model: 'eL XD', variant: 'electric low-speed utility', short: 'GEM eL XD',
    wheelbaseOptions: [2.6], track: { front: 1.25, rear: 1.25 }, tire: { size: '12″ wheel (est.)', diameter: 0.58, dualRear: false },
    frameHeight: 0.72, ba: 0.55, af: 0.71, length: 3.86, width: 1.4, payloadLb: 1250, curbLb: 1600, gvwrLb: 2850, topSpeedMph: 25,
    cab: { back: -1.6, front: 0.1, floorY: 0.38, roofY: 1.85, width: 1.38 }, seat: { dx: -1.25, y: 0.78, z: -0.34 },
    summary: 'Reference only: a street-legal low-speed vehicle in some places, but far too small for the rider target.',
    ...facts({ powertrain: SPEC_PAGE('GEM') }),
  },
  {
    id: 'gator', extends: 'ranger-kinetic', powertrain: 'gas', make: 'John Deere', model: 'Gator XUV', variant: 'gas UTV', short: 'John Deere Gator',
    wheelbaseOptions: [2.07], track: { front: 1.3, rear: 1.3 }, tire: { size: '26″ (est.)', diameter: 0.66, dualRear: false }, frameHeight: 0.82,
    length: 3.1, af: 0.41, width: 1.6, payloadLb: 1400, curbLb: 1900, gvwrLb: 3300, topSpeedMph: 44,
    summary: 'Reference only: the classic farm UTV. Too small for the rider target.',
    ...facts({ powertrain: SPEC_PAGE('John Deere') }),
  },

  /* ------------------------------------------------------------------ cab-over trucks */
  {
    id: 'npr', family: 'cabover', style: 'cabover', make: 'Isuzu', model: 'NPR-HD', variant: 'gas, dual rear', short: 'Isuzu NPR-HD',
    powertrain: 'gas', wheelbaseOptions: [4.47], track: { front: 1.68, rear: 1.68 }, tire: { size: '225/70R19.5', diameter: 0.81, dualRear: true },
    frameHeight: 0.78, buildup: 0.18, ba: 1.22, af: 1.11, length: 6.8, width: 2.04, cgY: 0.85,
    cab: { back: -0.58, front: 1.2, floorY: 1.0, roofY: 2.26, width: 2.04 }, seat: { dx: 0.2, y: 1.32, z: -0.5 }, steer: { dx: 0.44, dy: 0.52, tilt: 35 },
    gvwrLb: 14500, payloadLb: 8000, curbLb: 6500, topSpeedMph: null, axles: 2, cabLabel: 'Low cab forward', removableCab: true,
    summary: 'Class 4 low cab forward, 14,500 lb GVWR. The driver sits over the front axle, so the front section is short.',
    buying: { newAvailable: true, used: 'Very common: ex-box trucks and landscapers', knownIssues: ['Box removal leaves a bare frame: plan for it'], service: 'Isuzu truck dealers' },
    ...facts({ wheelbase: SPEC_PAGE('Isuzu NPR-HD: 176″ (other wheelbases verify)'), gvwrLb: SPEC_PAGE('Isuzu: 14,500 lb'), tire: SPEC_PAGE('Isuzu'), powertrain: SPEC_PAGE('Isuzu'),
      payloadLb: ESTIMATE('About 8,000 lb as a bare chassis (est.)'), track: ESTIMATE(), frameHeight: ESTIMATE(), curbLb: ESTIMATE(), ba: ESTIMATE(), cgY: ESTIMATE() }),
    costTier: 2, effortTier: 2,
    defaults: { length: 6.6, width: 2.54, bodyFront: 1.22, headroom: 1.95, posts: 5, tubeDia: 0.6, tubeLift: 0.55, layout: 'ring', seatDepth: 0.6, rearStyle: 'panels', rearLen: 0.8, curtains: 'all', roofDeck: true, roofSeating: 'pillows', roofDeckFront: 1.8, roofDeckRear: 1.6, ladder: 'front', roofShade: 'cloth', bikeRack: 'rear', bikes: 4, secondStep: 'passenger', secondStepPos: 0, trailer: 'lowboy', removeRoof: false, removeRails: true, power: 'generator', batteryKwh: 10, tubeTaper: 0.25, roofOverhang: 0 },
  },
  {
    id: 'nrr-ev', extends: 'npr', powertrain: 'electric', model: 'NRR EV', variant: 'electric, dual rear', short: 'Isuzu NRR EV',
    wheelbaseOptions: [3.37, 3.81, 4.47, 5.08], gvwrLb: 19500, payloadLb: 9000, curbLb: 10500, cgY: 0.78,
    summary: 'Class 5 battery-electric low cab forward. Production started late 2024, so there is no real used market yet.',
    buying: { newAvailable: true, used: 'None to speak of yet', knownIssues: ['Charging on playa needs a big generator or a long wait'], service: 'Isuzu EV-certified dealers' },
    ...facts({ powertrain: SPEC_PAGE('Isuzu'), gvwrLb: ESTIMATE('Class 5, 19,500 lb (verify)') }),
    costTier: 3, effortTier: 2, defaults: { length: 6.6 },
  },
  {
    id: 'ecanter', extends: 'npr', powertrain: 'electric', make: 'Fuso', model: 'eCanter', variant: 'electric', short: 'Fuso eCanter',
    wheelbaseOptions: [3.39, 3.87, 4.38], gvwrLb: 15995, payloadLb: 6500, curbLb: 9500, width: 2.0, cgY: 0.78, tire: { size: '205/75R17.5 (est.)', diameter: 0.76, dualRear: true },
    summary: 'Battery-electric light cab-over. Figures need checking against the current US model.',
    buying: { newAvailable: true, used: 'Few, mostly ex-fleet pilots', knownIssues: [], service: 'Fuso dealers' },
    ...facts({ powertrain: SPEC_PAGE('Fuso') }),
    costTier: 3, effortTier: 2, defaults: { length: 6.0 },
  },

  /* ------------------------------------------------------------------ cutaways */
  {
    id: 'express', family: 'cutaway', style: 'conventional', make: 'Chevrolet', model: 'Express 3500 cutaway', variant: '159″ WB, dual rear, gas', short: 'Chevy Express',
    powertrain: 'gas', wheelbaseOptions: [3.53, 4.04, 4.50], track: { front: 1.75, rear: 1.75 }, tire: { size: 'LT225/75R16', diameter: 0.74, dualRear: true },
    frameHeight: 0.70, buildup: 0.16, ba: 0.93, af: 1.63, length: 6.6, width: 2.02, cgY: 0.75,
    cab: { back: -1.50, front: -0.25, floorY: 0.62, roofY: 2.2, width: 2.0, hoodTop: 1.22, hoodW: 1.7 }, seat: { dx: -1.15, y: 1.02, z: -0.45 }, steer: { dx: 0.42, dy: 0.5, tilt: 32 },
    gvwrLb: 12300, payloadLb: 6300, curbLb: 6000, topSpeedMph: null, axles: 2, cabLabel: 'Van cutaway', removableCab: true, doghouse: true,
    summary: 'Class 3 van cutaway, 12,300 lb GVWR, LT225/75R16 dual rear wheels. Pingüina is built on one of these.',
    buying: { newAvailable: true, used: 'Common: ex-shuttle buses and box vans from fleet and government auctions', knownIssues: ['GM is ending some cutaway variants after September 30, 2026 (verify)'], service: 'Any GM dealer' },
    ...facts({ wheelbase: SPEC_PAGE('Chevrolet: 139, 159 or 177″'), gvwrLb: SPEC_PAGE('Chevrolet: up to 12,300 lb with dual rear wheels'), tire: SPEC_PAGE('Chevrolet'), powertrain: SPEC_PAGE('Chevrolet'),
      ca: SPEC_PAGE('Cab back 59″ behind the front axle (80″ CA on 139″)'), payloadLb: ESTIMATE('About 6,300 lb (est.)'), track: ESTIMATE(), frameHeight: ESTIMATE(), ba: ESTIMATE(), curbLb: ESTIMATE(), cgY: ESTIMATE() }),
    costTier: 2, effortTier: 2,
    defaults: { length: 5.9, width: 2.84, bodyFront: 0.2, headroom: 2.1, posts: 5, tubeDia: 0.7, tubeLift: 0.4, layout: 'lshape', seatDepth: 0.66, rearStyle: 'panels', rearLen: 1.0, curtains: 'all', roofDeck: true, roofSeating: 'pillows', roofDeckFront: 1.6, roofDeckRear: 1.25, ladder: 'front', roofShade: 'cloth', bikeRack: 'rear', bikes: 4, secondStep: 'passenger', secondStepPos: 0.2, trailer: 'stepdeck', removeRoof: true, removeRails: true, power: 'generator', batteryKwh: 10, tubeTaper: 0.4, roofOverhang: 0 },
  },
  {
    id: 'express-4500', extends: 'express', model: 'Express 4500 cutaway', variant: 'dual rear, gas', short: 'Chevy Express 4500',
    wheelbaseOptions: [4.04, 4.50], gvwrLb: 14200, payloadLb: 7800, curbLb: 6400, frameHeight: 0.74, tire: { size: 'LT225/75R16 (est.)', diameter: 0.75, dualRear: true },
    summary: 'One class up from the 3500, same van front.',
    buying: { newAvailable: true, used: 'Ex-shuttle and ambulance chassis', knownIssues: ['GM is ending some cutaway variants after September 30, 2026 (verify)'], service: 'Any GM dealer' },
    ...facts({ wheelbase: ESTIMATE(), gvwrLb: ESTIMATE(), tire: ESTIMATE(), ca: ESTIMATE() }),
  },
  {
    id: 'e350', extends: 'express', make: 'Ford', model: 'E-350 cutaway', variant: 'dual rear, gas', short: 'Ford E-350',
    wheelbaseOptions: [3.51, 4.01, 4.47], cab: { back: -1.45, front: -0.30, floorY: 0.64, roofY: 2.2, width: 2.0, hoodTop: 1.25, hoodW: 1.65 },
    seat: { dx: -1.12, y: 1.04, z: -0.45 }, ba: 0.95, af: 1.54, length: 6.5, gvwrLb: 12500, payloadLb: 6000, curbLb: 6500, doghouse: true,
    summary: 'Ford’s van cutaway. Used ex-shuttle buses are the cheap route to one.',
    buying: { newAvailable: true, used: 'Very common: ex-shuttle buses, U-Haul and ambulance chassis', knownIssues: ['Spark plug blowout on pre-2008 two-valve V10 heads', 'Exhaust manifold studs break'], service: 'Any Ford dealer; Ford is building these through at least 2028 (verify)' },
    ...facts({ wheelbase: ESTIMATE('138–176″ (verify)'), gvwrLb: ESTIMATE(), tire: ESTIMATE(), ca: ESTIMATE(), powertrain: SPEC_PAGE('Ford') }),
  },
  {
    id: 'e450', extends: 'e350', model: 'E-450 cutaway', short: 'Ford E-450', wheelbaseOptions: [4.01, 4.47], gvwrLb: 14500, payloadLb: 8000, curbLb: 6500,
    frameHeight: 0.74, tire: { size: '225/70R19.5 (est.)', diameter: 0.80, dualRear: true },
    summary: 'The heavier E-Series cutaway. The usual shuttle-bus chassis.',
  },
  {
    id: 'etransit-cutaway', extends: 'express', powertrain: 'electric', make: 'Ford', model: 'E-Transit cutaway', variant: 'electric', short: 'Ford E-Transit cutaway',
    wheelbaseOptions: [3.96, 4.52], cab: { back: -1.25, front: 0.05, floorY: 0.60, roofY: 2.25, width: 2.0, hoodTop: 1.15, hoodW: 1.6 },
    seat: { dx: -0.85, y: 1.0, z: -0.45 }, ba: 0.95, af: 1.3, length: 6.3, gvwrLb: 9500, payloadLb: 4300, curbLb: 5200, cgY: 0.65, doghouse: false,
    summary: 'Battery-electric cutaway. Likely undersized on payload for a big build.',
    buying: { newAvailable: true, used: 'Few, mostly fleet', knownIssues: ['Payload is tight once a body goes on'], service: 'Ford EV-certified dealers' },
    ...facts({ powertrain: SPEC_PAGE('Ford'), wheelbase: ESTIMATE(), gvwrLb: ESTIMATE(), ca: ESTIMATE() }),
    costTier: 3, effortTier: 2,
  },

  /* ------------------------------------------------------------------ chassis-cab pickups and others */
  {
    id: 'f350', family: 'chassis-cab', style: 'conventional', make: 'Ford', model: 'F-350 chassis cab', variant: 'dual rear, gas or diesel', short: 'Ford F-350',
    powertrain: 'gas', wheelbaseOptions: [4.29], track: { front: 1.74, rear: 1.74 }, tire: { size: 'LT245/75R17', diameter: 0.80, dualRear: true },
    frameHeight: 0.84, buildup: 0.18, ba: 0.97, af: 1.21, length: 6.47, width: 2.03, cgY: 0.8,
    cab: { back: -2.16, front: -0.66, floorY: 0.78, roofY: 2.04, width: 2.03, hoodTop: 1.48, hoodW: 1.1 }, seat: { dx: -1.61, y: 1.1, z: -0.45 }, steer: { dx: 0.44, dy: 0.52, tilt: 30 },
    gvwrLb: 14000, payloadLb: 7000, curbLb: 7000, topSpeedMph: null, axles: 2, cabLabel: 'Conventional regular cab', removableCab: true,
    summary: 'Class 3 regular cab chassis, 14,000 lb GVWR, LT245/75R17 dual rear wheels. The long hood eats lounge length.',
    buying: { newAvailable: true, used: 'Common: ex-utility and contractor trucks', knownIssues: ['The long hood eats lounge length'], service: 'Any Ford dealer' },
    ...facts({ wheelbase: SPEC_PAGE('Ford body builder layout book: 169″'), ca: SPEC_PAGE('Ford: 84″ CA'), gvwrLb: SPEC_PAGE('Ford: 14,000 lb'), tire: SPEC_PAGE('Ford'),
      ba: SPEC_PAGE('Ford: 38.3″ front overhang'), width: SPEC_PAGE('Ford: 80″'), powertrain: SPEC_PAGE('Ford'),
      payloadLb: ESTIMATE('About 7,000 lb as a bare chassis (est.)'), track: ESTIMATE(), frameHeight: ESTIMATE(), curbLb: ESTIMATE(), cgY: ESTIMATE() }),
    costTier: 2, effortTier: 2,
    defaults: { length: 6.6, width: 2.54, bodyFront: 0.97, headroom: 1.95, posts: 5, tubeDia: 0.62, tubeLift: 0.5, layout: 'ring', seatDepth: 0.6, rearStyle: 'panels', rearLen: 0.9, curtains: 'all', roofDeck: true, roofSeating: 'pillows', roofDeckFront: 1.2, roofDeckRear: 1.4, ladder: 'front', roofShade: 'cloth', bikeRack: 'rear', bikes: 4, secondStep: 'passenger', secondStepPos: 0, trailer: 'lowboy', removeRoof: false, removeRails: true, power: 'generator', batteryKwh: 10, tubeTaper: 0.25, roofOverhang: 0 },
  },
  {
    id: 'f450', extends: 'f350', model: 'F-450 chassis cab', short: 'Ford F-450', wheelbaseOptions: [3.69, 4.29, 4.90], gvwrLb: 16500, payloadLb: 9000, curbLb: 7500,
    tire: { size: '225/70R19.5 (est.)', diameter: 0.81, dualRear: true }, track: { front: 1.78, rear: 1.78 },
    summary: 'The heavier Super Duty chassis cab: more payload, same long hood.',
    ...facts({ wheelbase: ESTIMATE(), gvwrLb: ESTIMATE(), tire: ESTIMATE(), ca: ESTIMATE() }),
  },
  {
    id: 'ram-3500cc', extends: 'f350', make: 'Ram', model: '3500 chassis cab', variant: 'dual rear', short: 'Ram 3500 chassis cab', wheelbaseOptions: [3.65, 4.26, 4.86],
    gvwrLb: 14000, payloadLb: 7000, curbLb: 7000, cab: { back: -2.12, front: -0.62, floorY: 0.80, roofY: 2.06, width: 2.03, hoodTop: 1.50, hoodW: 1.15 },
    summary: 'Ram’s chassis cab, similar in shape to the F-350.',
    buying: { newAvailable: true, used: 'Common: utility and contractor trucks', knownIssues: [], service: 'Any Ram dealer' },
    ...facts({ wheelbase: ESTIMATE(), gvwrLb: ESTIMATE(), ca: ESTIMATE(), tire: ESTIMATE(), ba: ESTIMATE(), width: ESTIMATE(), powertrain: SPEC_PAGE('Ram') }),
  },
  {
    id: 'ram-4500cc', extends: 'ram-3500cc', model: '4500 chassis cab', short: 'Ram 4500 chassis cab', gvwrLb: 16000, payloadLb: 9000, curbLb: 7000,
    tire: { size: '225/70R19.5 (est.)', diameter: 0.81, dualRear: true }, summary: 'One class up from the 3500.',
  },
  {
    id: 'bollinger-b4', family: 'chassis-cab', extends: 'npr', powertrain: 'electric', make: 'Bollinger', model: 'B4', variant: 'electric chassis cab', short: 'Bollinger B4',
    wheelbaseOptions: [4.04], gvwrLb: 15500, payloadLb: 7000, curbLb: 8500, cgY: 0.75, cabLabel: 'Cab-forward',
    summary: 'Electric Class 4 chassis cab with 7,000+ lb payload. The company ceased operations in late 2025: no factory support.',
    buying: { newAvailable: false, used: 'A handful of fleet units', knownIssues: ['No factory support or parts pipeline'], service: 'None from the factory' },
    ...facts({ gvwrLb: SPEC_PAGE('Bollinger: 15,500 lb'), payloadLb: SPEC_PAGE('Bollinger: 7,000+ lb'), powertrain: SPEC_PAGE('Bollinger'), wheelbase: ESTIMATE(), tire: ESTIMATE() }),
    costTier: 3, effortTier: 3,
  },
  {
    id: 'intl-emv', extends: 'f350', powertrain: 'electric', make: 'International', model: 'eMV', variant: 'electric medium duty', short: 'International eMV',
    wheelbaseOptions: [4.6, 5.3], track: { front: 2.0, rear: 1.85 }, tire: { size: '11R22.5 (est.)', diameter: 1.03, dualRear: true },
    frameHeight: 1.05, buildup: 0.2, ba: 1.05, af: 1.6, length: 7.9, width: 2.45, cgY: 0.95,
    cab: { back: -2.35, front: -0.75, floorY: 1.15, roofY: 2.75, width: 2.3, hoodTop: 1.85, hoodW: 1.3 }, seat: { dx: -1.8, y: 1.55, z: -0.5 },
    gvwrLb: 26000, payloadLb: 14000, curbLb: 12000,
    summary: 'A larger class of electric truck. Big payload, big price, and a tall frame that pushes every deck up.',
    buying: { newAvailable: true, used: 'Rare', knownIssues: ['Expensive', 'Tall frame raises the deck'], service: 'International dealers' },
    ...facts({ powertrain: SPEC_PAGE('International') }),
    costTier: 3, effortTier: 3,
  },

  /* ------------------------------------------------------------------ reality checks */
  {
    id: 'cement-mixer', family: 'reality-check', extends: 'intl-emv', powertrain: 'diesel', make: 'Generic', model: 'concrete mixer truck', variant: 'tri-axle', short: 'Cement mixer',
    wheelbaseOptions: [5.6], axles: 3, track: { front: 2.05, rear: 1.85 }, tire: { size: '11R22.5', diameter: 1.05, dualRear: true },
    frameHeight: 1.15, ba: 1.3, af: 2.9, length: 9.8, width: 2.5, gvwrLb: 66000, payloadLb: 30000, curbLb: 30000, cgY: 1.6,
    drum: { length: 5.0, dia: 2.3, tilt: 12 },
    summary: 'A tri-axle mixer: over 30′ long, heavy, and the drum takes the deck where riders would go.',
    buying: { newAvailable: true, used: 'Retired mixers turn up at heavy-equipment auctions', knownIssues: ['A mixer drum is not food-safe'], service: 'Heavy truck shops' },
    flags: [{ id: 'food-safe', severity: 'red', title: 'Drum isn’t food-safe', detail: 'A concrete drum is coated in cement residue and hydraulic grease. Serving drinks from it is a health problem; build a real bar instead.' }],
    ...facts({}),
    costTier: 3, effortTier: 3, defaults: { length: 8.5, roofDeck: false, layout: 'facing' },
  },
  {
    id: 'school-bus', family: 'reality-check', extends: 'f350', powertrain: 'diesel', make: 'Generic', model: 'Type C school bus', variant: '72-passenger', short: 'School bus',
    wheelbaseOptions: [6.1], track: { front: 2.0, rear: 1.85 }, tire: { size: '11R22.5', diameter: 1.03, dualRear: true }, frameHeight: 0.95, buildup: 0.15,
    ba: 1.2, af: 3.4, length: 10.7, width: 2.44, gvwrLb: 29000, payloadLb: 10000, curbLb: 19000, cgY: 1.2,
    summary: 'A full-size school bus: over 25′ long, and a roof deck lands near 10′ up.',
    buying: { newAvailable: false, used: 'District surplus auctions', knownIssues: ['The steel body is heavy before you add anything'], service: 'Heavy truck shops' },
    ...facts({}), costTier: 3, effortTier: 3, defaults: { length: 9.0 },
  },
  {
    id: 'double-decker', family: 'reality-check', extends: 'npr', powertrain: 'diesel', make: 'Generic', model: 'London double-decker', variant: 'two-axle', short: 'Double-decker bus',
    wheelbaseOptions: [5.9], track: { front: 2.1, rear: 1.95 }, tire: { size: '275/70R22.5', diameter: 1.0, dualRear: true }, frameHeight: 0.4, buildup: 0.1,
    ba: 2.3, af: 2.5, length: 10.7, width: 2.55, gvwrLb: 40000, payloadLb: 14000, curbLb: 26000, cgY: 1.3,
    cab: { back: -0.7, front: 2.28, floorY: 0.45, roofY: 2.4, width: 2.5 }, seat: { dx: 1.3, y: 0.95, z: -0.6 },
    summary: 'A double-decker stands about 14′4″ tall before anything goes on the roof.',
    buying: { newAvailable: false, used: 'Imported tour buses', knownIssues: ['Too tall to haul under 13′6″'], service: 'Specialist' },
    ...facts({}), costTier: 3, effortTier: 3, defaults: { length: 9.5, headroom: 1.95 },
  },
];

/* Resolve `extends`, fill derived fields, and index by id. */
function resolve(raw) {
  const byId = {};
  const get = (id) => {
    if (byId[id]) return byId[id];
    const r = raw.find((v) => v.id === id);
    if (!r) throw new Error('unknown vehicle ' + id);
    let v = { ...r };
    if (r.extends) {
      const base = get(r.extends);
      v = { ...base, buying: base.buying, defaults: { ...base.defaults }, flags: undefined, drum: undefined, ...r,
        sources: { ...base.sources, ...(r.sources || {}) }, confidence: { ...base.confidence, ...(r.confidence || {}) } };
      v.defaults = { ...base.defaults, ...(r.defaults || {}) };
      // facts are never inherited as confirmed: anything the child doesn't source itself is an assumption from the base
      for (const k of Object.keys(base.confidence)) if (!(r.confidence && r.confidence[k])) {
        v.confidence[k] = 'estimate'; v.sources[k] = `Assumed from the ${base.short} (verify)`;
      }
      delete v.extends;
    }
    v.wheelbase = v.wheelbaseOptions[Math.min(v.wheelbaseOptions.length - 1, v.defaultWbIndex ?? Math.floor((v.wheelbaseOptions.length - 1) / 2))];
    v.axles = v.axles || 2;
    v.label = `${v.make} ${v.model}${v.variant ? `, ${v.variant}` : ''}`;
    byId[id] = v;
    return v;
  };
  raw.forEach((r) => get(r.id));
  return byId;
}
export const VEHICLES = resolve(RAW);
/* v1 used these exact default wheelbases. */
VEHICLES.express.wheelbase = 4.04; VEHICLES.npr.wheelbase = 4.47; VEHICLES.f350.wheelbase = 4.29;
export const VEHICLE_IDS = RAW.map((r) => r.id);
export const vehicleOf = (id) => VEHICLES[id] || VEHICLES.express;
/* Fields shown on the spec card, with how to read them. */
export const SPEC_FIELDS = [
  ['payloadLb', 'Payload'], ['gvwrLb', 'GVWR'], ['curbLb', 'Curb weight'], ['wheelbase', 'Wheelbase'], ['track', 'Track'], ['tire', 'Tires'],
  ['frameHeight', 'Frame or deck height'], ['ca', 'Cab to axle (CA)'], ['ba', 'Bumper to axle (BA)'], ['length', 'Overall length'], ['width', 'Overall width'],
  ['topSpeedMph', 'Top speed'], ['powertrain', 'Powertrain'],
];
