// Einführungs-Tour: führt neue Nutzer in wenigen Schritten durch BadTeam (übernommen aus BadPlan).
// Hebt Bereiche hervor (Rest abgedunkelt), funktioniert mit Touch und Tastatur.
// Tasten werden nur abgefangen, solange die Tour offen ist.
import { icon } from './icons.js';
import { t } from './i18n.js';

// Schritte: Texte stehen in i18n.js (tour.*), damit die Tour auch auf Englisch läuft
const STEPS = () => [
  { welcome: true, title: t('tour.welcomeT'), text: t('tour.welcome') },
  { icon: 'cloud', route: '#/backup', sel: ['#cl-dbx', '#cloud-panel'], title: t('tour.dbxT'), text: t('tour.dbx') },
  { icon: 'users', route: '#/groups', sel: ['#gr-add'], title: t('tour.grT'), text: t('tour.gr') },
  { icon: 'user', route: '#/players', sel: ['#pl-new'], title: t('tour.plT'), text: t('tour.pl') },
  { icon: 'check', route: '#/', sel: ['#home-today'], title: t('tour.trT'), text: t('tour.tr') },
  { icon: 'chart', route: '#/stats', sel: ['.stats'], title: t('tour.stT'), text: t('tour.st') },
  { done: true, title: t('tour.doneT'), text: t('tour.done') },
];

let open = false;
export const isTourOpen = () => open;

/** Startet die Tour. onClose wird beim Beenden (fertig oder übersprungen) aufgerufen. */
export function startTour({ onClose } = {}) {
  if (open) return;
  open = true;
  const startHash = location.hash;
  const lastFocus = document.activeElement;
  let i = 0, token = 0;
  const steps = STEPS();

  const root = document.createElement('div');
  root.className = 'tour';
  root.innerHTML = `
    <div class="tour-shield"></div>
    <div class="tour-spot"></div>
    <section class="tour-card" role="dialog" aria-modal="true" aria-labelledby="tour-title" aria-describedby="tour-text"></section>`;
  document.body.appendChild(root);
  const spot = root.querySelector('.tour-spot');
  const card = root.querySelector('.tour-card');
  const shield = root.querySelector('.tour-shield');
  shield.addEventListener('wheel', (e) => e.preventDefault(), { passive: false });
  shield.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });

  const goto = (hash) => new Promise((res) => {
    const cur = location.hash || '#/';
    if (!hash || cur === hash) return res();
    const done = () => { removeEventListener('hashchange', done); setTimeout(res, 40); };
    addEventListener('hashchange', done);
    location.hash = hash;
    setTimeout(done, 500);
  });
  const findTarget = (sel) => {
    for (const s of sel || []) {
      const el = document.querySelector(s);
      if (el && el.getClientRects().length && !el.closest('.hidden')) return el;
    }
    return null;
  };

  let current = null;
  function layout() {
    const vw = innerWidth, vh = innerHeight, m = 12, gap = 14, pad = 6;
    card.classList.toggle('center', !current);
    spot.classList.toggle('none', !current);
    if (!current) { card.style.left = card.style.top = ''; return; }
    const r = current.getBoundingClientRect();
    const top = Math.max(0, r.top - pad), bottom = Math.min(vh, r.bottom + pad);
    const left = Math.max(0, r.left - pad), right = Math.min(vw, r.right + pad);
    spot.style.cssText = `left:${left}px;top:${top}px;width:${right - left}px;height:${bottom - top}px`;
    const ch = card.offsetHeight, cw = card.offsetWidth;
    let y;
    if (vh - bottom - m >= ch + gap) y = bottom + gap;
    else if (top - m >= ch + gap) y = top - gap - ch;
    else y = (top + bottom) / 2 > vh / 2 ? m + 56 : vh - ch - m; // Ziel sehr groß: Karte an den Rand
    const x = Math.min(Math.max(m, (left + right) / 2 - cw / 2), vw - cw - m);
    card.style.left = `${x}px`;
    card.style.top = `${Math.max(m, y)}px`;
  }

  async function show(n) {
    const my = ++token;
    i = Math.max(0, Math.min(steps.length - 1, n));
    const s = steps[i];
    await goto(s.route);
    if (my !== token) return;
    current = findTarget(s.sel);
    if (current) {
      const r = current.getBoundingClientRect();
      const big = r.height > innerHeight * 0.5;
      current.scrollIntoView({ block: big ? 'start' : 'center', inline: 'nearest' });
      await new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)));
      if (my !== token) return;
    } else if (s.route) {
      window.scrollTo(0, 0);
    }
    const last = i === steps.length - 1;
    const dots = steps.map((_, k) => `<i class="${k === i ? 'on' : k < i ? 'seen' : ''}"></i>`).join('');
    card.className = `tour-card${s.welcome ? ' welcome' : ''}${s.done ? ' done' : ''}`;
    card.innerHTML = `
      <div class="tour-head">
        <span class="tour-badge">${icon(s.welcome || s.done ? 'logo' : s.icon, s.welcome ? 34 : 20)}</span>
        <span class="tour-count" aria-label="${t('tour.step', { n: i + 1, of: steps.length })}">${i + 1}/${steps.length}</span>
      </div>
      <h2 id="tour-title">${s.title}</h2>
      <p id="tour-text">${s.text}</p>
      <div class="tour-dots" aria-hidden="true">${dots}</div>
      <div class="tour-actions">
        ${last ? '' : `<button type="button" class="ghost" data-t="skip">${t('tour.skip')}</button>`}
        <span class="grow"></span>
        ${i > 0 ? `<button type="button" data-t="back">${icon('left', 16)}<span>${t('tour.back')}</span></button>` : ''}
        <button type="button" class="primary" data-t="next"><span>${last ? t('tour.finish') : s.welcome ? t('tour.go') : t('tour.next')}</span>${last ? '' : icon('right', 16)}</button>
      </div>`;
    layout();
    card.querySelector('[data-t="next"]').focus({ preventScroll: true });
  }

  function close() {
    if (!open) return;
    open = false; token++;
    removeEventListener('keydown', onKey, true);
    removeEventListener('resize', layout);
    removeEventListener('scroll', layout, true);
    root.remove();
    // Falls die Tour die Seite gewechselt hat: zurück dorthin, wo der Nutzer war
    if (startHash && startHash !== '#/' && (location.hash || '') !== startHash) location.hash = startHash;
    else if (!startHash && (location.hash || '#/') !== '#/') location.hash = '#/';
    try { lastFocus?.focus?.({ preventScroll: true }); } catch { /* egal */ }
    onClose?.();
  }
  const next = () => (i >= steps.length - 1 ? close() : show(i + 1));
  const back = () => show(i - 1);

  card.addEventListener('click', (e) => {
    const b = e.target.closest('[data-t]');
    if (!b) return;
    ({ next, back, skip: close })[b.dataset.t]();
  });

  function onKey(e) {
    if (e.ctrlKey || e.metaKey || e.altKey || /^F\d+$/.test(e.key)) return; // Browser-Kürzel (Neu laden usw.) bleiben
    e.stopImmediatePropagation(); // Player-Tastenkürzel ruhen, solange die Tour offen ist
    if (e.key === 'Tab') {
      const bs = [...card.querySelectorAll('button')];
      if (!bs.length) return e.preventDefault();
      const k = bs.indexOf(document.activeElement);
      const to = e.shiftKey ? (k <= 0 ? bs.length - 1 : k - 1) : (k === bs.length - 1 ? 0 : k + 1);
      e.preventDefault(); bs[to].focus();
      return;
    }
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (e.key === 'ArrowRight') { e.preventDefault(); next(); return; }
    if (e.key === 'ArrowLeft') { e.preventDefault(); if (i > 0) back(); return; }
    const onBtn = e.target.closest?.('.tour-card button');
    if ((e.key === 'Enter' || e.key === ' ') && onBtn) return; // Knopf löst selbst aus
    if (e.key === 'Enter') { e.preventDefault(); next(); return; }
    if (e.key.length === 1 || e.key.startsWith('Arrow') || e.key.startsWith('Page')) e.preventDefault();
  }
  addEventListener('keydown', onKey, true);
  addEventListener('resize', layout);
  addEventListener('scroll', layout, true);
  show(0);
}
