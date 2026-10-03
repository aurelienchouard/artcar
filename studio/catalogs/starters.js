/* Starting points anyone can load. The first six reproduce the v1 presets; Pingüina is the reference build (section 6.6). */
import { starterDesign, kitDefaults } from '../engine/state.js';

export const STARTERS = [
  { id: 'haulster', label: 'Cushman Haulster cart, shade only', build: () => starterDesign('haulster') },
  { id: 'bigfoot', label: 'Taylor-Dunn Bigfoot cart, roof deck', build: () => starterDesign('bigfoot') },
  { id: 'mc480', label: 'Motrec MC-480 cart, shade only', build: () => starterDesign('mc480') },
  { id: 'npr', label: 'Isuzu NPR box truck, roof deck', build: () => starterDesign('npr') },
  { id: 'express', label: 'Chevy Express van, roof deck', build: () => starterDesign('express') },
  { id: 'f350', label: 'Ford F-350 pickup, roof deck', build: () => starterDesign('f350') },
  { id: 'pinguina', label: 'Pingüina (reference build)', reference: true, build: pinguina },
];

/* Pingüina: Express cutaway cut at the windshield base, full steel cage, a CNC plywood rib lattice on French cleats.
   Head 8′, driver area 4′, lounge 9.5′, rear bench and storage 4.5′; about 25.7′ long. */
export function pinguina() {
  const d = starterDesign('express');
  d.name = 'Pingüina (reference)';
  d.brief = { ...d.brief, ridersMin: 15, ridersMax: 20, budget: 3, effort: 3 };
  d.vehicle.wheelbase = 4.04;
  d.strip.level = 'cut';
  Object.assign(d.structure, { style: 'cage', roofSpan: 'driver-back', length: 6.93, width: 2.54, bodyFront: 1.03, posts: 5, powerBay: 'section', powerBaySize: 'medium' });   // rear end where the real one is; the structure wraps the engine
  Object.assign(d.upper, { kind: 'stand', headroom: 2.0, coverage: 'mid', shadeFront: 1.22, shadeRear: 1.22, railHeight: 0.95, railsRemovable: true, roofRemovable: false, access: 'ladder-front', hatchSide: 'passenger', roofShade: 'cloth' });
  Object.assign(d.layout, { seating: 'lshape', seatDepth: 0.66, standing: 'party', rear: 'panels', rearLen: 1.37, upperSeating: 'pillows', curtains: 'none', bikeRack: 'rear', bikes: 4, secondStep: 'passenger', secondStepPos: 0 });
  Object.assign(d.lights, { speakers: 'corners', power: 'generator' });
  d.kits.body = { id: 'penguin', p: { ...kitDefaults('penguin'), build: 'plywood', finish: 'lattice' } };
  d.transport.trailer = 'stepdeck';   // also hauled on a tow-truck tilt bed with a little overhang
  return d;
}
