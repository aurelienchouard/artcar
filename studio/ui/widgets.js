/* Small controls bound to design paths. Every option list asks the engine whether each option is eligible:
   ineligible options stay visible, greyed out, with the reason. */
import { FIELDS, getPath } from '../engine/fields.js';
import { fmtField, fmtLen } from '../engine/units.js';
import { optionStatus } from '../engine/eligibility.js';
import { store, setValue } from './store.js';

export const h = (tag, attrs = {}, ...kids) => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) el.append(c.nodeType ? c : document.createTextNode(String(c)));
  return el;
};
let uid = 0;
const units = () => store.d.view.units;
const notify = (notes) => { if (notes && notes.length) window.__toast?.(`Pre-selected: ${notes.join('; ')}`); };

/* While a slider is held the panel isn't redrawn under the pointer. The flag always clears: on release anywhere,
   on blur, and after a short idle, so a lost 'change' event can never freeze the panel. */
let dragTimer;
function startDrag() { store.dragging = true; clearTimeout(dragTimer); dragTimer = setTimeout(endDrag, 1500); }
function endDrag() { clearTimeout(dragTimer); if (store.dragging) { store.dragging = false; setTimeout(() => window.__studio?.app?.rerender(), 0); } }
if (typeof window !== 'undefined') ['pointerup', 'pointercancel', 'keyup'].forEach((ev) => window.addEventListener(ev, () => { if (store.dragging) setTimeout(endDrag, 0); }, true));
/* Mark a choice right away, before the engine re-evaluates and the panel redraws. */
function pressNow(btn) { btn.parentElement?.querySelectorAll('[aria-pressed]').forEach((b) => b.setAttribute('aria-pressed', String(b === btn))); }

/* Range slider with live output; lim gives chassis limits; outFn customizes the readout. */
export function range(path, o = {}) {
  const f = { ...FIELDS[path], ...o };
  const id = 'f' + (++uid);
  const v = o.value ?? getPath(store.d, path);
  const [mn, mx] = o.lim || [f.min, f.max];
  const out = h('output', { for: id });
  const input = h('input', { type: 'range', id, min: mn, max: mx, step: f.step || 0.01, value: v });
  const show = (x) => { const atMax = o.lim && x >= mx - 0.005; out.textContent = (o.outFn ? o.outFn(x) : fmtField(f, x, units())) + (atMax ? ', chassis max' : ''); };
  show(v);
  const commit = (live) => { const x = parseFloat(input.value); (o.set || ((x2, l) => setValue(path, x2, { live: l })))(f.type === 'int' ? Math.round(x) : x, live); };
  input.addEventListener('input', () => { show(parseFloat(input.value)); startDrag(); commit(true); });
  input.addEventListener('change', () => { endDrag(); commit(false); });
  input.addEventListener('blur', endDrag);
  return h('div', { class: 'row' + (o.disabled ? ' disabled' : '') }, h('div', { class: 'row-head' }, h('label', { for: id }, o.label || f.label), out), input, o.note ? h('div', { class: 'note' }, o.note) : null, o.why ? h('div', { class: 'why' }, o.why) : null);
}
export function toggle(path, o = {}) {
  const f = FIELDS[path] || {};
  const id = 'f' + (++uid);
  const v = o.value ?? getPath(store.d, path);
  const input = h('input', { type: 'checkbox', id, checked: !!v, disabled: !!o.disabled });
  input.addEventListener('change', () => (o.set ? o.set(input.checked) : setValue(path, input.checked)));
  return h('div', { class: 'row toggle' + (o.disabled ? ' disabled' : '') }, h('label', { for: id }, h('span', {}, o.label || f.label), input), o.note ? h('div', { class: 'note' }, o.note) : null, o.why ? h('div', { class: 'why' }, o.why) : null);
}
/* Options with eligibility: a select for long lists, a segmented control for short ones, or option cards. */
export function choice(path, o = {}) {
  const f = { ...FIELDS[path], ...o };
  const options = o.options || f.options;
  const v = o.value ?? getPath(store.d, path);
  const status = (val) => (o.status ? o.status(val) : store.E && !store.E.blank ? optionStatus(store.E, path, val) : { disabled: false });
  const set = (val) => notify(o.set ? o.set(val) : setValue(path, val));
  const head = h('div', { class: 'row-head' }, h('span', { class: 'l' }, o.label || f.label));
  const sts = options.map(([val]) => status(val));
  const curWhy = sts[options.findIndex(([val]) => val === v)]?.reason;
  if (o.cards) {
    const cards = h('div', { class: 'cards' }, options.map(([val, lab, desc, meta], i) => {
      const st = sts[i];
      return h('button', { type: 'button', class: 'ocard', 'aria-pressed': String(val === v), disabled: st.disabled, title: st.reason || '', onclick: (e) => { pressNow(e.currentTarget); set(val); } },
        h('div', { class: 't' }, h('span', {}, lab), meta && meta.right ? h('span', { class: 'tag' }, meta.right) : null),
        desc ? h('div', { class: 'd' }, desc) : null,
        st.reason ? h('div', { class: 'why' }, (st.disabled ? '' : 'Current choice: ') + st.reason) : null,
        meta && meta.tags ? h('div', { class: 'meta' }, meta.tags.map((t) => h('span', { class: 'tag ' + (t.cls || '') }, t.text))) : null);
    }));
    return h('div', { class: 'row' }, head, cards, o.note ? h('div', { class: 'note' }, o.note) : null);
  }
  if (o.seg || options.length <= 4 && !o.select) {
    const seg = h('div', { class: 'seg wide', role: 'group' }, options.map(([val, lab], i) => h('button', { type: 'button', 'aria-pressed': String(val === v), disabled: sts[i].disabled, title: sts[i].reason || '', onclick: (e) => { pressNow(e.currentTarget); set(val); } }, lab)));
    const whys = options.map(([, lab], i) => (sts[i].disabled ? `${lab}: ${sts[i].reason}` : null)).filter(Boolean);
    return h('div', { class: 'row' }, head, seg, whys.length ? h('div', { class: 'why' }, whys.join('. ') + '.') : null, curWhy ? h('div', { class: 'why' }, curWhy) : null, o.note ? h('div', { class: 'note' }, o.note) : null);
  }
  const sel = h('select', { 'aria-label': o.label || f.label }, options.map(([val, lab], i) => h('option', { value: String(val), selected: val === v, disabled: sts[i].disabled }, lab + (sts[i].disabled ? ` (${sts[i].reason})` : ''))));
  sel.addEventListener('change', () => { const opt = options.find(([val]) => String(val) === sel.value); set(opt[0]); });
  return h('div', { class: 'row' }, head, sel, curWhy ? h('div', { class: 'why' }, curWhy) : null, o.note ? h('div', { class: 'note' }, o.note) : null);
}
export function chips(path, o = {}) {
  const f = FIELDS[path];
  const v = getPath(store.d, path) || [];
  return h('div', { class: 'row' }, h('div', { class: 'row-head' }, h('span', { class: 'l' }, o.label || f.label)),
    h('div', { class: 'chips' }, f.options.map(([val, lab]) => h('button', { type: 'button', class: 'chip', 'aria-pressed': String(v.includes(val)),
      onclick: (e) => { const b = e.currentTarget; b.setAttribute('aria-pressed', String(b.getAttribute('aria-pressed') !== 'true')); const cur = getPath(store.d, path) || []; notify(setValue(path, cur.includes(val) ? cur.filter((x) => x !== val) : [...cur, val])); } }, lab))),
    o.note ? h('div', { class: 'note' }, o.note) : null);
}
export function color(path, o = {}) {
  const id = 'f' + (++uid);
  const input = h('input', { type: 'color', id, value: getPath(store.d, path) });
  input.addEventListener('input', () => setValue(path, input.value, { live: true }));
  input.addEventListener('change', () => setValue(path, input.value));
  return h('div', { class: 'row color' }, h('label', { for: id }, h('span', {}, o.label || FIELDS[path].label), input));
}
export function stats(rows) {
  return h('dl', { class: 'stats' }, rows.filter(Boolean).flatMap(([a, b, cls]) => [h('dt', {}, a), h('dd', { class: cls || '' }, b)]));
}
export function table(head, rows, o = {}) {
  return h('table', { class: 't' }, h('thead', {}, h('tr', {}, head.map((x) => h('th', {}, x)))),
    h('tbody', {}, rows.map((r) => h('tr', { class: r.sel ? 'sel' : '' }, (r.cells || r).map((c) => (c && c.cls ? h('td', { class: c.cls }, c.text) : h('td', {}, c)))))));
}
export const L = (m) => fmtLen(m, units());
