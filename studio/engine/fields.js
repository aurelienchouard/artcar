/* Every design field: where it lives in the design state, its type, range or options, and its label.
   The UI builds controls from these; sanitize() clamps and validates against them. Lengths in meters. */
const opt = (...pairs) => pairs;
export const FIELDS = {
  /* step 0: brief */
  'brief.ridersMin': { type: 'int', min: 1, max: 60, step: 1, label: 'Riders, at least', def: 15 },
  'brief.ridersMax': { type: 'int', min: 1, max: 60, step: 1, label: 'Riders, ideally', def: 20 },
  'brief.budget': { type: 'enum', label: 'Budget', options: opt([1, '$'], [2, '$$'], [3, '$$$']), def: 2 },
  'brief.effort': { type: 'enum', label: 'Build effort the crew can handle', options: opt([1, 'Light'], [2, 'Moderate'], [3, 'Heavy']), def: 2 },
  'brief.powertrain': { type: 'enum', label: 'Powertrain', options: opt(['either', 'Either'], ['electric', 'Electric'], ['gas', 'Gas or diesel']), def: 'either' },
  'brief.transport': { type: 'enum', label: 'Getting it there', options: opt(['any', 'Any way'], ['drive', 'Drive it'], ['tow', 'Tow it ourselves'], ['hauler', 'Hire a hauler']), def: 'any' },
  'brief.vibes': { type: 'set', label: 'Vibe', options: opt(['lounge', 'Lounge'], ['dance', 'Dance floor'], ['bar', 'Bar'], ['sound', 'Sound camp'], ['chill', 'Quiet chill']), def: [] },

  /* step 1: vehicle */
  'vehicle.id': { type: 'vehicle', label: 'Vehicle', def: null },   // null: a blank design, nothing picked yet
  'vehicle.wheelbase': { type: 'num', min: 1.2, max: 7, step: 0.01, fmt: 'len', label: 'Wheelbase', def: 4.04 },
  'vehicle.whatIf': { type: 'bool', label: 'What-if: change the chassis numbers', def: false },
  'vehicle.track': { type: 'num', min: 0.8, max: 2.4, step: 0.01, fmt: 'len', label: 'Track width', def: 1.75 },
  'vehicle.wheelDia': { type: 'num', min: 0.4, max: 1.15, step: 0.01, fmt: 'len', label: 'Tire diameter', def: 0.74 },
  'vehicle.frameHeight': { type: 'num', min: 0.4, max: 1.25, step: 0.01, fmt: 'len', label: 'Frame or cargo-deck height', def: 0.70 },

  /* step 2: strip down */
  'strip.level': { type: 'enum', label: 'How much of the vehicle stays', options: opt(['stock', 'Stock'], ['cut', 'Cut at the windshield base'], ['rails', 'Strip to frame rails']), def: 'cut' },
  'strip.rops': { type: 'bool', label: 'Keep the factory canopy and roll bar', def: false },
  'strip.bed': { type: 'bool', label: 'Keep the stock cargo bed', def: true },

  /* step 3: structure */
  'structure.style': { type: 'enum', label: 'Structure style', options: opt(['barge', 'Low party barge'], ['deck-posts', 'Deck and posts'], ['cage', 'Full cage'], ['bed-ext', 'Cart bed extension']), def: 'deck-posts' },
  'structure.roofSpan': { type: 'enum', label: 'Roof and upper deck', options: opt(['full', 'Over the entire length'], ['driver-back', 'Over the driver and the rear']), def: 'driver-back' },
  'structure.length': { type: 'num', min: 2.5, max: 12, step: 0.05, fmt: 'len', label: 'Body length', def: 5.9, lim: 'length' },
  'structure.width': { type: 'num', min: 1.4, max: 4.4, step: 0.01, fmt: 'len', label: 'Body width', def: 2.84, lim: 'width' },
  'structure.bodyFront': { type: 'num', min: -0.5, max: 2.6, step: 0.01, fmt: 'len', label: 'Structure past the front bumper', def: 1.03, lim: 'bodyFront' },   // stored from the front axle
  'structure.roofOverhang': { type: 'num', min: 0, max: 0.4, step: 0.01, fmt: 'len', label: 'Roof overhang', def: 0 },
  'structure.posts': { type: 'int', min: 2, max: 8, step: 1, label: 'Posts per side', def: 5 },
  'structure.material': { type: 'enum', label: 'Material', options: opt(['steel', 'All steel'], ['alu', 'Steel load path, aluminum secondary']), def: 'steel' },
  'structure.powerBay': { type: 'enum', label: 'Power bay', options: opt(['rear', 'Under the rear'], ['under', 'Under the deck'], ['section', 'In the rear section']), def: 'rear' },
  'structure.powerBaySize': { type: 'enum', label: 'Power bay size', options: opt(['small', 'Small'], ['medium', 'Medium'], ['large', 'Large']), def: 'medium' },

  /* step 4: upper deck */
  'upper.kind': { type: 'enum', label: 'Upper level', options: opt(['none', 'None: shade roof only'], ['bunk', 'Low bunk'], ['stand', 'Stand-under deck']), def: 'stand' },
  'upper.headroom': { type: 'num', min: 0.9, max: 2.5, step: 0.01, fmt: 'len', label: 'Clear height below the roof', def: 2.1 },
  'upper.roofShade': { type: 'enum', label: 'Roof outside the deck', options: opt(['cloth', 'Shade cloth'], ['solid', 'Solid']), def: 'cloth' },
  'upper.coverage': { type: 'enum', label: 'Deck coverage', options: opt(['full', 'Full length'], ['mid', 'Middle, shade at the ends'], ['modular', 'Modular segments']), def: 'mid' },
  'upper.shadeFront': { type: 'num', min: 0, max: 5, step: 0.01, fmt: 'len', label: 'Shade only, at the front', def: 1.6 },
  'upper.shadeRear': { type: 'num', min: 0, max: 5, step: 0.01, fmt: 'len', label: 'Shade only, at the back', def: 1.25 },
  'upper.segments': { type: 'segments', label: 'Segments, back to front', def: [{ kind: 'shade', len: 1.25 }, { kind: 'deck', len: 3 }, { kind: 'shade', len: 1.6 }] },
  'upper.railHeight': { type: 'num', min: 0.3, max: 1.25, step: 0.01, fmt: 'len', label: 'Rail height', def: 0.95 },
  'upper.railsRemovable': { type: 'bool', label: 'Rails and roof cushions come off for transport', def: true },
  'upper.roofRemovable': { type: 'bool', label: 'Roof and posts come off for transport', def: false },
  'upper.access': { type: 'enum', label: 'Access', options: opt(['ladder-front', 'Ladder at the front, angled beside the driver'], ['ladder-rear', 'Ladder at the back, vertical'], ['stairs', 'Stairs inside the lounge'], ['none', 'None']), def: 'ladder-front' },
  'upper.hatchSide': { type: 'enum', label: 'Hatch side', options: opt(['passenger', 'Passenger side'], ['driver', 'Driver side']), def: 'passenger' },

  /* step 5: layout */
  'layout.seating': { type: 'enum', label: 'Lower seating', options: opt(['lshape', 'L-shaped couch, open dance floor'], ['ring', 'Closed ring'], ['ushape', 'U, open at the rear'], ['facing', 'Facing benches'], ['platform', 'One big cushioned platform']), def: 'lshape' },
  'layout.seatDepth': { type: 'num', min: 0.45, max: 0.95, step: 0.01, fmt: 'len', label: 'Seat depth', def: 0.66 },
  'layout.standing': { type: 'enum', label: 'Standing and dancing', options: opt(['none', 'Seats only'], ['comfortable', 'Comfortable, 9 sq ft each'], ['party', 'Party, 5 sq ft each'], ['packed', 'Packed, 3½ sq ft each']), def: 'comfortable' },
  'layout.curtains': { type: 'enum', label: 'Curtains', options: opt(['all', 'All lounge corners'], ['rear', 'Rear corners'], ['none', 'None']), def: 'all' },
  'layout.curtainsDrawn': { type: 'bool', label: 'Curtains drawn against wind and dust', def: false },
  'layout.rear': { type: 'enum', label: 'Rear section', options: opt(['none', 'None, lounge runs to the back'], ['panels', 'Low closed-off section, lid doubles as counter'], ['daiquiri', 'Low section with daiquiri bar']), def: 'panels' },
  'layout.rearLen': { type: 'num', min: 0.3, max: 3.5, step: 0.01, fmt: 'len', label: 'Rear section length', def: 1.0 },
  'layout.upperSeating': { type: 'enum', label: 'Upper seating', options: opt(['pillows', 'Floor pillows'], ['u', 'U of daybeds'], ['sides', 'Daybeds along the sides'], ['none', 'Open standing deck']), def: 'pillows' },
  'layout.driverStep': { type: 'bool', label: 'Step beside the driver', def: true },
  'layout.secondStep': { type: 'enum', label: 'Second entry step', options: opt(['passenger', 'Passenger side'], ['driver', 'Driver side'], ['none', 'None']), def: 'passenger' },
  'layout.secondStepPos': { type: 'num', min: -1, max: 1, step: 0.01, fmt: 'pos', label: 'Second step position, along the room between the wheels and other entries', def: 0.2 },
  'layout.dj': { type: 'enum', label: 'DJ booth', options: opt(['none', 'None'], ['front', 'Front of the lounge, facing riders'], ['rear', 'Back of the lounge, facing riders'], ['side', 'Passenger side, facing the crowd outside'], ['upper', 'Upper deck, passenger side, facing the crowd']), def: 'none' },
  'layout.bar': { type: 'enum', label: 'Bar counter in the lounge', options: opt(['none', 'None'], ['side', 'Along the driver side']), def: 'none' },
  'layout.storage': { type: 'enum', label: 'Storage', options: opt(['none', 'None'], ['front', 'Front of the lounge'], ['rear', 'Back of the lounge']), def: 'none' },
  'layout.bikeRack': { type: 'enum', label: 'Bike racks, hung by the front wheel', options: opt(['none', 'None'], ['rear', 'On the back'], ['sides', 'On both sides'], ['both', 'Back and sides']), def: 'rear' },
  'layout.bikes': { type: 'int', min: 1, max: 10, step: 1, label: 'Bikes per rack', def: 4 },

  /* step 6: design */
  'design.colors.frame': { type: 'color', label: 'Frame and roof', def: '#1c1d20' },
  'design.colors.tube': { type: 'color', label: 'Panels and skins', def: '#3a3d42' },
  'design.colors.shade': { type: 'color', label: 'Shade cloth', def: '#34363a' },
  'design.colors.fabric': { type: 'color', label: 'Cushions and curtains', def: '#d9cfbf' },
  'design.colors.accent': { type: 'color', label: 'Throw pillows and awning', def: '#b8702c' },
  'design.colors.rug': { type: 'color', label: 'Rug', def: '#b19a77' },
  'design.colors.cabMatch': { type: 'bool', label: 'Vehicle paint matches the panels', def: false },
  'design.colors.cab': { type: 'color', label: 'Vehicle paint', def: '#e9e7e2' },

  /* step 7: lights and sound */
  'lights.ledLines': { type: 'int', min: 0, max: 16, step: 1, label: 'LED lines along each tube', def: 9 },
  'lights.ribStyle': { type: 'enum', label: 'Ring finish', options: opt(['solid', 'Solid LED color'], ['second', 'Solid second color'], ['match', 'Follow the LED pattern'], ['metal', 'Bare'], ['none', 'None showing']), def: 'metal' },
  'lights.ledMode': { type: 'enum', label: 'LED pattern', options: opt(['solid', 'Solid'], ['breathe', 'Breathe'], ['chase', 'Chase'], ['sunset', 'Sunset'], ['sparkle', 'Sparkle'], ['off', 'Off']), def: 'sunset' },
  'lights.ledColor': { type: 'color', label: 'LED color', def: '#ffae57' },
  'lights.ledColor2': { type: 'color', label: 'Second color', def: '#8fd3ff' },
  'lights.ledLevel': { type: 'num', min: 0, max: 2, step: 0.01, fmt: 'pct', label: 'Brightness', def: 0.5 },
  'lights.pucks': { type: 'bool', label: 'Puck downlights under the roof', def: true },
  'lights.projectors': { type: 'bool', label: 'Projectors on the rail corners', def: true },
  'lights.neon': { type: 'bool', label: 'Lightning bolt neon on the front rail (v1 only)', def: false },
  'lights.neonSize': { type: 'num', min: 0.25, max: 1.25, step: 0.01, fmt: 'len', label: 'Neon height', def: 0.8 },
  'lights.speakers': { type: 'enum', label: 'Speakers', options: opt(['corners', 'Hung at the lounge corners'], ['towers', 'Towers at the back of the lounge'], ['none', 'None']), def: 'corners' },
  'lights.speakerFacing': { type: 'enum', label: 'Speakers face', options: opt(['lounge', 'The lounge: riders hear it'], ['playa', 'The playa: the crowd outside hears it']), def: 'lounge' },
  'lights.speakerSize': { type: 'enum', label: 'Speaker size', options: opt(['small', 'Small'], ['medium', 'Medium'], ['large', 'Large']), def: 'medium' },
  'lights.power': { type: 'enum', label: 'Power', options: opt(['battery', 'Lithium batteries only'], ['generator', 'Propane generator and batteries']), def: 'generator' },
  'lights.batteryKwh': { type: 'int', min: 2, max: 40, step: 1, fmt: 'kwh', label: 'Battery bank', def: 10 },   // v1 only: v2 sizes the bank from the loads

  /* step 8: transport */
  'transport.skinOff': { type: 'bool', label: 'Skin and design pieces come off', def: true },
  'transport.trailer': { type: 'trailer', label: 'Getting it there', def: 'stepdeck' },

  /* view preferences saved with the design */
  'view.mood': { type: 'enum', label: 'Light', options: opt(['day', 'Day'], ['dusk', 'Dusk'], ['night', 'Night']), def: 'day' },
  'view.units': { type: 'enum', label: 'Units', options: opt(['imperial', 'Feet and pounds'], ['metric', 'Meters and kilograms']), def: 'imperial' },
};
export const KIT_SLOTS = ['body'];   // one design body: a cover for the sides and engine, or a full shell
export const getPath = (o, path) => path.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
export function setPath(o, path, v) {
  const ks = path.split('.'); let a = o;
  for (let i = 0; i < ks.length - 1; i++) { if (a[ks[i]] == null || typeof a[ks[i]] !== 'object') a[ks[i]] = {}; a = a[ks[i]]; }
  a[ks[ks.length - 1]] = v;
}
