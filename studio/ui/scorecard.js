/* The always-visible scorecard and its one-tap explainers. */
import { h } from './widgets.js';
import { store } from './store.js';
import { RULES } from '../catalogs/rules.js';
import { STEPS } from '../engine/evaluate.js';

let openId = null;
export function renderScorecard(host, onStep) {
  const E = store.E;
  host.innerHTML = '';
  const red = E.score.filter((l) => l.status === 'red').length + E.flags.filter((f) => f.severity === 'red').length;
  const amber = E.score.filter((l) => l.status === 'amber').length + E.flags.filter((f) => f.severity === 'amber').length;
  host.append(h('div', { class: 'score-head' }, h('h2', {}, 'Scorecard'), h('span', {}, red ? `${red} red, ${amber} amber` : amber ? `${amber} amber` : 'all clear')));
  for (const l of E.score) {
    const b = h('button', { type: 'button', class: 'sline ' + l.status, 'aria-expanded': String(openId === l.id), 'aria-controls': 'explain', title: 'Why?' },
      h('span', { class: 'dot ' + l.status }), h('span', { class: 'lab' }, l.label), h('span', { class: 'val' }, l.value));
    b.addEventListener('click', () => showExplain(l, b, onStep));
    host.append(b);
  }
  const flags = E.flags.filter((f) => f.severity !== 'info');
  if (flags.length) host.append(h('div', { class: 'flags' }, h('h3', {}, 'Also flagged'), flags.map((f) => {
    const b = h('button', { type: 'button', class: 'flag' }, h('span', { class: 'dot ' + f.severity }), h('span', {}, `${f.title} `, h('span', { class: 'note' }, `· ${STEPS[f.step].title}`)));
    b.addEventListener('click', () => showExplain({ id: f.id, label: f.title, status: f.severity, value: '', step: f.step, explain: { what: f.detail, rules: [] } }, b, onStep));
    return b;
  })));
}
export function showExplain(l, anchor, onStep) {
  const pop = document.getElementById('explain');
  if (openId === l.id && !pop.hidden) { hideExplain(); return; }
  openId = l.id;
  const x = l.explain || {};
  pop.innerHTML = '';
  pop.append(
    h('button', { type: 'button', class: 'chip close', onclick: hideExplain }, 'Close'),
    h('h2', {}, h('span', { class: 'dot ' + l.status }), l.label),
    l.value ? h('p', {}, h('strong', {}, l.value)) : null,
    x.what ? [h('div', { class: 'k' }, 'What'), h('p', {}, x.what)] : null,
    x.by ? [h('div', { class: 'k' }, 'By how much'), h('p', {}, x.by)] : null,
    x.why ? [h('div', { class: 'k' }, 'Why the rule exists'), h('p', {}, x.why)] : null,
    x.fix && x.fix.length ? [h('div', { class: 'k' }, 'What would fix it'), h('ul', {}, x.fix.map((f) => h('li', {}, f)))] : null,
    x.rules && x.rules.length ? [h('div', { class: 'k' }, 'Rules and sources'), ...x.rules.map((id) => { const r = RULES[id]; return h('p', { class: 'src' }, `${r.label}: ${r.value} ${r.unit}. ${r.source}, checked ${r.verified}. ${r.note}`); })] : null,
    x.link ? h('p', { class: 'src' }, h('a', { href: x.link, target: '_blank', rel: 'noopener' }, 'Mutant Vehicle Owner’s Handbook')) : null,
    l.step != null ? h('button', { type: 'button', class: 'btn small', onclick: () => { hideExplain(); onStep(l.step); } }, `Go to ${STEPS[l.step].title}`) : null,
  );
  pop.hidden = false;
  const r = anchor.getBoundingClientRect();
  const narrow = innerWidth <= 900;
  pop.style.left = narrow ? '8px' : `${Math.min(innerWidth - pop.offsetWidth - 12, r.right + 10)}px`;
  pop.style.top = narrow ? `${r.bottom + 8}px` : `${Math.max(12, Math.min(innerHeight - pop.offsetHeight - 12, r.top - 20))}px`;
  document.querySelectorAll('.sline').forEach((b) => b.setAttribute('aria-expanded', 'false'));
  anchor.setAttribute('aria-expanded', 'true');
}
export function hideExplain() { openId = null; const p = document.getElementById('explain'); p.hidden = true; document.querySelectorAll('.sline').forEach((b) => b.setAttribute('aria-expanded', 'false')); }
