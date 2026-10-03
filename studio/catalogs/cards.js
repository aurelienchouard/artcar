/* Reality-check cards (section 9). Each loads a preset, lists the red flags it should raise with an explanation,
   and offers a nearest buildable preset plus talking points. Add cards as data: `expect` lists flag ids the engine
   must produce for the preset; the nearest buildable must produce no red flags and none of those ids. */
import { starterDesign, kitDefaults } from '../engine/state.js';

const kit = (id, p = {}) => ({ id, p: { ...kitDefaults(id), ...p } });

export const CARDS = [
  {
    id: 'shinkansen', title: 'Shinkansen',
    pitch: 'A bullet train for the playa: long white nose, smooth curves, the works.',
    preset: () => {
      const d = starterDesign('e450');
      d.name = 'Shinkansen, as dreamed';
      d.brief = { ...d.brief, effort: 1, budget: 2 };
      d.kits.body = kit('bullet-train', { nose: 3.5, height: 2.3, build: 'fabric', window: false });
      d.structure.width = 2.5;
      return d;
    },
    expect: [
      { id: 'view', why: 'The long nose rises into the driver’s sight line: most of the forward view is blocked.' },
      { id: 'effort', why: 'Smooth compound curves are the hardest thing to build; the brief says light effort.' },
      { id: 'fabric-day', why: 'Fabric is the only easy way to get those curves, and fabric looks bad by day.' },
    ],
    nearest: {
      title: 'Short bullet nose on a cutaway',
      preset: () => {
        const d = starterDesign('e450');
        d.name = 'Shinkansen, buildable';
        d.brief = { ...d.brief, effort: 2, budget: 2 };
        d.kits.body = kit('bullet-train', { nose: 0.9, height: 0.6, build: 'metal' });
        d.structure.width = 2.5;   // no side tubes: the deck takes the whole width
        d.upper.coverage = 'mid';
        return d;
      },
      summary: 'An E-450 or Express cutaway with a short metal nose below the eye line, slab sides with a stripe, and a train-car band along the roof.',
    },
    talking: ['A short nose keeps the ground ahead visible: the DMV checks that at inspection.', 'The stripe and the roof band sell the train look more than the nose does.', 'Metal over hoops holds its shape by day; fabric doesn’t.'],
  },
  {
    id: 'cement-mixer', title: 'Cement-mixer daiquiri bar',
    pitch: 'A real concrete mixer truck that spins out frozen daiquiris.',
    preset: () => {
      const d = starterDesign('cement-mixer');
      d.name = 'Cement-mixer daiquiri bar, as dreamed';
      d.layout.rear = 'daiquiri';
      d.kits.body = { id: 'none', p: {} };
      return d;
    },
    expect: [
      { id: 'length', why: 'A tri-axle mixer is over 30′ long: the DMV makes anything 25′ or longer Limited City Use.' },
      { id: 'riders', why: 'The drum takes the deck where riders would go.' },
      { id: 'food-safe', why: 'A concrete drum isn’t food-safe: serving drinks from it is a health problem.' },
    ],
    nearest: {
      title: 'Rocket cutaway with a real bar',
      preset: () => {
        const d = starterDesign('express');
        d.name = 'Rocket lounge with a daiquiri bar';
        d.kits.body = kit('rocket', { build: 'metal' });
        d.structure.width = 2.5;
        d.layout.rear = 'daiquiri';
        d.layout.rearLen = 1.0;
        d.transport.trailer = 'stepdeck';
        return d;
      },
      summary: 'A cutaway with a light rocket hull around the lounge, plus a real daiquiri bar in the low rear section.',
    },
    talking: ['A hull on hoops is a fraction of a drum’s weight, and riders sit inside it.', 'Frozen-drink machines pull serious power: plan the generator.', 'Under 25′ keeps full city access.'],
  },
  {
    id: 'school-bus', title: 'School bus', template: true,
    pitch: 'A full-size school bus with a party on the roof.',
    preset: () => {
      const d = starterDesign('school-bus');
      d.name = 'School bus, as dreamed';
      d.strip.level = 'stock';
      d.kits.body = { id: 'none', p: {} };
      d.structure.width = 2.44;
      d.upper.railsRemovable = false;
      d.transport.trailer = 'drive';
      d.brief.transport = 'drive';
      return d;
    },
    expect: [
      { id: 'length', why: 'At 35′ a bus is Limited City Use.' },
      { id: 'heightHauled', why: 'A roof deck with fixed rails on top of a 10′ bus is well over 13′6″, even driven on its own wheels.' },
    ],
    nearest: {
      title: 'Shuttle-bus cutaway with a low roof deck',
      preset: () => {
        const d = starterDesign('e450');
        d.name = 'Shuttle bus, buildable';
        d.upper.railsRemovable = true;
        d.kits.body = kit('bullet-train', { nose: 0.7 });
        d.structure.width = 2.5;
        d.transport.trailer = 'stepdeck';
        return d;
      },
      summary: 'An E-450 shuttle-bus chassis under 25′, with removable rails so it hauls under 13′6″.',
    },
    talking: ['Ex-shuttle E-450s are cheap and already have dual rear wheels.', 'Removable rails are what makes the height work.'],
  },
  {
    id: 'double-decker', title: 'London double-decker', template: true,
    pitch: 'A red double-decker with an open top deck.',
    preset: () => {
      const d = starterDesign('double-decker');
      d.name = 'Double-decker, as dreamed';
      d.strip.level = 'stock';
      d.kits.body = { id: 'none', p: {} };
      d.structure.width = 2.55;
      Object.assign(d.upper, { kind: 'stand', headroom: 2.3, railHeight: 1.2, railsRemovable: false });
      d.transport.trailer = 'drive';
      return d;
    },
    expect: [
      { id: 'heightHauled', why: 'A double-decker stands over 14′ before anything goes on top: too tall to move without permits.' },
      { id: 'length', why: 'Over 25′: Limited City Use.' },
    ],
    nearest: {
      title: 'Open-top bus look on a cab-over',
      preset: () => {
        const d = starterDesign('npr');
        d.name = 'Open-top bus, buildable';
        d.upper.railsRemovable = true;
        d.transport.trailer = 'lowboy';
        return d;
      },
      summary: 'An NPR with a stand-under deck and removable rails: the two-level feel, hauled under 13′6″ on a lowboy.',
    },
    talking: ['The upper deck is the point; a cab-over gives the flat front of a bus.', 'A lowboy buys the most height.'],
  },
];
