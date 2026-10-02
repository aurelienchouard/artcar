/* Skin and frame materials for design kits. kg comes from the rules table. `mat` is the render material. */
export const MATERIALS = {
  alu: { label: 'Sheet aluminum', rule: 'skinAlu', per: 'm²', mat: 'tube', cost: 2, effort: 2, skills: ['welding'], day: 'Bare or painted metal', night: 'Reflects the LEDs' },
  acm: { label: 'Aluminum composite panel (ACM)', rule: 'skinAcm', per: 'm²', mat: 'acm', cost: 2, effort: 2, skills: ['cnc'], day: 'Crisp painted facets', night: 'Edge-lit facets' },
  perf: { label: 'Perforated metal', rule: 'skinPerf', per: 'm²', mat: 'perf', cost: 2, effort: 2, skills: ['welding'], day: 'Metal mesh', night: 'Glows from inside' },
  coroplast: { label: 'Coroplast', rule: 'skinCoroplast', per: 'm²', mat: 'coro', cost: 1, effort: 1, skills: [], day: 'Flat plastic color', night: 'Lit from behind, a little translucent' },
  eva: { label: 'EVA foam', rule: 'skinEva', per: 'm²', mat: 'eva', cost: 1, effort: 1, skills: [], day: 'Soft, sculpted color', night: 'Opaque; light it from outside' },
  poly: { label: 'Translucent polycarbonate', rule: 'skinPoly', per: 'm²', mat: 'glowSkin', cost: 3, effort: 2, skills: [], day: 'Milky white panels', night: 'Glows evenly from inside' },
  fabric: { label: 'Stretch fabric', rule: 'skinFabric', per: 'm²', mat: 'fabricGlow', cost: 1, effort: 1, skills: [],
    day: 'Sags, flaps and dusts up by day', night: 'Glows beautifully with LEDs behind',
    warning: 'Fabric looks bad by day: it sags, flaps and collects dust. Fine for a night-only look; otherwise pick a rigid skin.' },
  plywood: { label: 'CNC plywood ribs', rule: 'ply34', per: 'm²', mat: 'plyRib', cost: 2, effort: 3, skills: ['cnc', 'woodworking'], day: 'Warm wood lattice', night: 'LED edges trace every rib' },
  conduit: { label: 'Bent conduit hoops', rule: 'conduit', per: 'm', mat: 'frame', cost: 1, effort: 2, skills: [], day: 'Thin metal hoops', night: 'LED strips along the hoops' },
  hdpe: { label: 'HDPE tube', rule: 'hdpe', per: 'm', mat: 'hdpe', cost: 1, effort: 1, skills: [], day: 'Bendy plastic tube', night: 'Diffuses LED strip inside' },
  steel: { label: 'Steel tube', rule: 'steelHoop', per: 'm', mat: 'frame', cost: 2, effort: 2, skills: ['welding'], day: 'Welded steel', night: 'LED strips along it' },
};
export const SKINS = ['alu', 'acm', 'perf', 'coroplast', 'eva', 'poly', 'fabric'];
