/* The rules table: every threshold and constant the engine uses, each with a source, when it was last checked, and a note.
   Explainers in the UI read from here. Edit values here, not in code. Lengths in meters, weights in kg unless noted. */
const HANDBOOK = 'https://burningman.org/black-rock-city/bring-your-mutant-vehicle/mutant-vehicle-owners-handbook/';
const EST = 'Studio estimate';
const THUMB = 'Studio rule of thumb';
const V1 = 'Art Car Studio v1 constants';
export const HANDBOOK_URL = HANDBOOK;

export const RULES = {
  /* people */
  riderKg: { value: 79, unit: 'kg', label: 'Weight per rider, driver included (175 lb)', source: V1, verified: '2026-10-02', note: 'A planning average. Weigh your crew if you are near the limit.' },
  standComfortable: { value: 0.84, unit: 'm²', label: 'Standing, comfortable (9 sq ft each)', source: V1, verified: '2026-10-02', note: 'Room to dance.' },
  standParty: { value: 0.46, unit: 'm²', label: 'Standing, party (5 sq ft each)', source: V1, verified: '2026-10-02', note: '' },
  standPacked: { value: 0.33, unit: 'm²', label: 'Standing, packed (3½ sq ft each)', source: V1, verified: '2026-10-02', note: 'Shoulder to shoulder. Not a comfortable ride.' },
  platformArea: { value: 0.42, unit: 'm²', label: 'Cushion platform, per person (about 4½ sq ft)', source: V1, verified: '2026-10-02', note: 'Sitting and lying in a pile.' },
  standHeadroom: { value: 1.85, unit: 'm', label: 'Minimum headroom for standing riders below', source: THUMB, verified: '2026-10-02', note: 'About 6′1″. Below this the lower level is sit-and-lie only.' },

  /* steel, wood, skins */
  steel2in14: { value: 3.2, unit: 'kg/m', label: '2″ square tube, 14 ga', source: V1, verified: '2026-10-02', note: 'Deck frame and sub-frame on trucks.' },
  steel15in14: { value: 2.4, unit: 'kg/m', label: '1½″ square tube, 14 ga', source: V1, verified: '2026-10-02', note: 'Posts and headers; deck frame on carts.' },
  steel15in16: { value: 2.0, unit: 'kg/m', label: '1½″ square tube, 16 ga', source: V1, verified: '2026-10-02', note: 'Roof frame.' },
  steelRail: { value: 1.6, unit: 'kg/m', label: '1¼″ rail tube', source: V1, verified: '2026-10-02', note: '' },
  steelHoop: { value: 1.1, unit: 'kg/m', label: '1″ square tube, hoops and stringers', source: V1, verified: '2026-10-02', note: '' },
  stairKg: { value: 9, unit: 'kg', label: 'Steel stair tread with its riser', source: V1, verified: '2026-10-02', note: '' },
  aluSecondary: { value: 0.5, unit: '×', label: 'Aluminum secondary members, weight vs steel', source: EST, verified: '2026-10-02', note: 'Aluminum is a third of steel by density but needs thicker walls; half the weight is a fair planning figure.' },
  ply34: { value: 10.8, unit: 'kg/m²', label: '¾″ plywood', source: V1, verified: '2026-10-02', note: '' },
  ply12: { value: 7.0, unit: 'kg/m²', label: '½″ plywood', source: V1, verified: '2026-10-02', note: '' },
  plyBend: { value: 3.0, unit: 'kg/m²', label: '¼″ bending plywood', source: V1, verified: '2026-10-02', note: '' },
  skinAlu: { value: 2.7, unit: 'kg/m²', label: 'Aluminum sheet, 1 mm', source: V1, verified: '2026-10-02', note: '' },
  skinPerf: { value: 2.6, unit: 'kg/m²', label: 'Perforated aluminum', source: V1, verified: '2026-10-02', note: '' },
  skinPoly: { value: 3.6, unit: 'kg/m²', label: 'Polycarbonate, 3 mm', source: V1, verified: '2026-10-02', note: '' },
  skinCloth: { value: 0.3, unit: 'kg/m²', label: 'Shade cloth', source: V1, verified: '2026-10-02', note: '' },
  skinAcm: { value: 3.8, unit: 'kg/m²', label: 'Aluminum composite panel (ACM), 3 mm', source: EST, verified: '2026-10-02', note: 'Typical 3 mm panels run 3.5–4.5 kg/m².' },
  skinCoroplast: { value: 0.7, unit: 'kg/m²', label: 'Coroplast, 4 mm', source: EST, verified: '2026-10-02', note: '' },
  skinEva: { value: 1.0, unit: 'kg/m²', label: 'EVA foam, 12 mm', source: EST, verified: '2026-10-02', note: '' },
  skinFabric: { value: 0.3, unit: 'kg/m²', label: 'Stretch fabric', source: EST, verified: '2026-10-02', note: '' },
  conduit: { value: 0.75, unit: 'kg/m', label: '¾″ EMT conduit hoops', source: EST, verified: '2026-10-02', note: 'About ½ lb per foot.' },
  hdpe: { value: 0.6, unit: 'kg/m', label: 'HDPE tube, 2″', source: EST, verified: '2026-10-02', note: '' },
  hardware: { value: 0.06, unit: '×', label: 'Hardware allowance on frame, wood and skins', source: V1, verified: '2026-10-02', note: 'Bolts, brackets, cleats, fasteners.' },
  buildTolerance: { value: 0.30, unit: '±', label: 'Build weight uncertainty', source: THUMB, verified: '2026-10-02', note: 'Counted from the model’s own cut list; weigh the real thing.' },

  /* power and sound */
  lithiumKgPerKwh: { value: 9, unit: 'kg/kWh', label: 'Lithium battery bank', source: V1, verified: '2026-10-02', note: '' },
  powerElectronics: { value: 25, unit: 'kg', label: 'Inverter, charger and wiring', source: V1, verified: '2026-10-02', note: '' },
  generatorKg: { value: 90, unit: 'kg', label: 'Propane generator with two tanks', source: V1, verified: '2026-10-02', note: '' },
  generatorKw: { value: 2.0, unit: 'kW', label: 'Generator continuous output', source: EST, verified: '2026-10-02', note: 'A 2,200 W inverter generator on propane.' },
  usableFraction: { value: 0.8, unit: '×', label: 'Usable share of a lithium bank', source: THUMB, verified: '2026-10-02', note: 'Leave headroom for cold mornings and battery life.' },
  nightHours: { value: 8, unit: 'h', label: 'Hours of running per night', source: THUMB, verified: '2026-10-02', note: 'Dusk to sunrise is about 11 hours in late August; most cars run 6–8.' },
  ledWattsPerM: { value: 12, unit: 'W/m', label: 'LED strip at full brightness', source: EST, verified: '2026-10-02', note: 'Typical 60 LED/m 12 V strip.' },

  /* body limits */
  rearOverhangTruck: { value: 0.6, unit: '× WB', label: 'Rear overhang limit on trucks', source: V1, verified: '2026-10-02', note: 'Rear axle to body rear. Past this the front axle goes light and the frame needs an engineer.' },
  rearOverhangCart: { value: 0.7, unit: '× WB', label: 'Rear overhang limit on carts', source: V1, verified: '2026-10-02', note: '' },
  rearOverhangOwnPlus: { value: 0.15, unit: 'm', label: 'Or the vehicle’s own rear overhang plus 6″', source: V1, verified: '2026-10-02', note: '' },
  bodyFrontPastBumper: { value: 0.3, unit: 'm', label: 'Body front past the bumper', source: V1, verified: '2026-10-02', note: 'About 1′.' },
  bodyWidthPlusMax: { value: 1.0, unit: 'm', label: 'Body width over the vehicle, maximum', source: V1, verified: '2026-10-02', note: 'About 1.6′ per side.' },
  bodyWidthPlusMin: { value: 0.3, unit: 'm', label: 'Body width over the vehicle, minimum', source: V1, verified: '2026-10-02', note: '' },

  /* stability and payload */
  tipAmber: { value: 0.5, unit: 'g', label: 'Tipping, amber below', source: THUMB, verified: '2026-10-02', note: 'Proposal; tune with experience.' },
  tipRed: { value: 0.45, unit: 'g', label: 'Tipping, red below', source: THUMB, verified: '2026-10-02', note: 'A rule of thumb, not a standard. Ruts and a wheel dropping into a hole eat the margin fast.' },
  tightTurn: { value: 0.127, unit: 'g', label: 'A tight turn at 5 mph', source: EST, verified: '2026-10-02', note: '5 mph around a 13′ radius.' },
  payloadAmber: { value: 0.10, unit: '× payload', label: 'Payload margin, amber below', source: THUMB, verified: '2026-10-02', note: 'Proposal.' },

  /* wheels */
  steeringLock: { value: 35, unit: '°', label: 'Front-wheel steering lock used for clearance', source: EST, verified: '2026-10-02', note: '' },
  wheelClearance: { value: 0.1, unit: 'm', label: 'Added to tire diameter for travel and clearance', source: V1, verified: '2026-10-02', note: '' },

  kitGroundClear: { value: 0.25, unit: 'm', label: 'Design kits stop this far above the ground', source: THUMB, verified: '2026-10-02', note: 'Playa ruts and whoops; about 10″.' },

  /* transport */
  roadWidth: { value: 2.5908, unit: 'm', label: 'Legal width without a permit (8′6″)', source: 'US federal width limit', verified: '2026-10-02', note: '' },
  roadHeight: { value: 4.1148, unit: 'm', label: 'Height measured from the road (13′6″)', source: 'Common US state limit', verified: '2026-10-02', note: 'Some western states allow 14′; beyond that, oversize permits.' },
  roadHeightWest: { value: 4.2672, unit: 'm', label: 'Western-state height limit (14′)', source: 'Several western states', verified: '2026-10-02', note: 'Check every state on the route.' },
  haulAmberMargin: { value: 0.1016, unit: 'm', label: 'Hauled height, amber with less than 4″ to spare', source: THUMB, verified: '2026-10-02', note: 'Proposal: trailers sag and loads shift.' },
  liftPerPerson: { value: 25, unit: 'kg', label: 'Lift per person for teardown', source: THUMB, verified: '2026-10-02', note: 'About 55 lb, a comfortable two-hand carry.' },

  /* DMV */
  dmvDeckHeight: { value: 2.1336, unit: 'm', label: 'Decks this high need guardrails (84″)', source: HANDBOOK, verified: '2026-10-02', note: 'Mutant Vehicle Owner’s Handbook: “All vehicle levels located 84 inches or more above the playa surface should have guardrails around their perimeter.”' },
  dmvRailMin: { value: 0.9144, unit: 'm', label: 'Guardrail height, minimum (36″)', source: HANDBOOK, verified: '2026-10-02', note: '“36–48 inches above the floor surface.” A gap of no more than 36″ is allowed for access.' },
  dmvRailMax: { value: 1.2192, unit: 'm', label: 'Guardrail height, maximum (48″)', source: HANDBOOK, verified: '2026-10-02', note: '' },
  dmvLong: { value: 7.62, unit: 'm', label: 'Limited City Use at this length (25′)', source: HANDBOOK, verified: '2026-10-02', note: '“Any vehicle 13 feet wide or more OR 25 feet or longer will be designated Limited City Use”: shortest route between camp and the open playa only.' },
  dmvWide: { value: 3.9624, unit: 'm', label: 'Limited City Use at this width (13′)', source: HANDBOOK, verified: '2026-10-02', note: '' },
  lengthAmber: { value: 0.3048, unit: 'm', label: 'Length, amber within 1′ of the 25′ line', source: THUMB, verified: '2026-10-02', note: 'Proposal.' },
  playaSpeedMph: { value: 5, unit: 'mph', label: 'Playa speed limit', source: HANDBOOK, verified: '2026-10-02', note: '' },

  /* driver view */
  viewAmber: { value: 0.05, unit: '× cone', label: 'Driver view, amber above this blocked share', source: THUMB, verified: '2026-10-02', note: 'Our proxy; the DMV checks visibility at inspection.' },
  viewRed: { value: 0.2, unit: '× cone', label: 'Driver view, red above this blocked share', source: THUMB, verified: '2026-10-02', note: '' },
  viewConeH: { value: 50, unit: '°', label: 'View cone, half-width to each side', source: THUMB, verified: '2026-10-02', note: '' },
  viewConeUp: { value: 12, unit: '°', label: 'View cone, above the eye line', source: THUMB, verified: '2026-10-02', note: '' },
  viewConeDown: { value: 12, unit: '°', label: 'View cone, below the eye line', source: THUMB, verified: '2026-10-02', note: '' },
  viewConeRange: { value: 20, unit: 'm', label: 'View cone, how far it looks', source: THUMB, verified: '2026-10-02', note: '' },

  /* cost and effort bands: totals of option points, see engine/tiers.js */
  costBand2: { value: 11, unit: 'points', label: 'Cost reads $$ from this total', source: THUMB, verified: '2026-10-02', note: 'Calibrated so a small cart with side tubes reads $ and a Pingüina-class build reads $$$.' },
  costBand3: { value: 16, unit: 'points', label: 'Cost reads $$$ from this total', source: THUMB, verified: '2026-10-02', note: '' },
  effortBand2: { value: 11, unit: 'points', label: 'Effort reads moderate from this total', source: THUMB, verified: '2026-10-02', note: '' },
  effortBand3: { value: 16, unit: 'points', label: 'Effort reads heavy from this total', source: THUMB, verified: '2026-10-02', note: '' },
};
export const R = (id) => {
  const r = RULES[id];
  if (!r) throw new Error('unknown rule ' + id);
  return r.value;
};
