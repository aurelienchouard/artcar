/* Formatting. Metric inside, imperial display by default. */
export const LB_PER_KG = 2.20462;
export function fmtLen(m, units = 'imperial') {
  if (!Number.isFinite(m)) return '—';
  if (units === 'metric') return m.toFixed(2) + ' m';
  const totalIn = Math.round(Math.abs(m) / 0.0254);
  const ft = Math.floor(totalIn / 12), inch = totalIn - ft * 12;
  return (m < 0 ? '−' : '') + (ft ? `${ft}′ ${inch}″` : `${inch}″`);
}
export function fmtInches(m, units = 'imperial') {
  if (units === 'metric') return `${Math.round(Math.abs(m) * 100)} cm`;
  return `${Math.round(Math.abs(m) / 0.0254)}″`;
}
export function fmtWeight(kg, units = 'imperial') {
  const v = units === 'metric' ? kg : kg * LB_PER_KG;
  const r = Math.abs(v) >= 1000 ? Math.round(v / 50) * 50 : Math.round(v / 10) * 10;
  return (v < 0 ? '−' : '') + Math.abs(r).toLocaleString('en-US') + (units === 'metric' ? ' kg' : ' lb');
}
export function fmtArea(m2, units = 'imperial') { return units === 'metric' ? `${m2.toFixed(1)} m²` : `${Math.round(m2 * 10.764)} sq ft`; }
export function fmtField(f, v, units) {
  switch (f.fmt) {
    case 'len': return fmtLen(v, units);
    case 'pct': return Math.round(v * 100) + '%';
    case 'taper': return v < 0.005 ? 'Straight' : `${Math.round(v * 100)}% narrower at the ends`;
    case 'kwh': return `${Math.round(v)} kWh`;
    case 'pos': return Math.abs(v) < 0.04 ? 'Middle of where it fits' : `${Math.round(Math.abs(v) * 100)}% toward the ${v > 0 ? 'front' : 'back'}`;
    default: return f.type === 'int' ? String(Math.round(v)) : String(v);
  }
}
export const TIER_COST = ['—', '$', '$$', '$$$'];
export const TIER_EFFORT = ['—', 'light', 'moderate', 'heavy'];
