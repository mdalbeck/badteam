// Bad-Apps-Familie: App-Wechsler (kleiner Kreis-Knopf oben rechts).
// Diese Datei ist in allen Bad Apps gleich (BadClip, BadPlan, BadTeam, BadPlayer, Startseite) – bei Änderungen überall kopieren.

export const HOME_URL = 'https://badapps.mpdalbeck.workers.dev/';

// Reihenfolge = Farbkreis (Platz im Kreis). url = gibt es schon.
export const APPS = [
  { id: 'badclip', name: 'BadClip', color: '#e8193c', glyph: 'play', url: 'https://badclip.mpdalbeck.workers.dev/',
    text: { de: 'Videobibliothek für Trainer', en: 'Video library for coaches' } },
  { id: 'badscore', name: 'BadScore', color: '#ff8a1f', glyph: 'cup',
    text: { de: 'Spielstand, Turniere, Ranglisten', en: 'Scores, tournaments, rankings' } },
  { id: 'badplan', name: 'BadPlan', color: '#c6f432', glyph: 'clock', url: 'https://badplan.mpdalbeck.workers.dev/',
    text: { de: 'Trainings planen und in der Halle durchführen', en: 'Plan sessions and run them in the hall' } },
  { id: 'free1', color: '#2ee69b', free: true, text: { de: 'Platz für eine neue App', en: 'Room for a new app' } },
  { id: 'badmove', name: 'BadMove', color: '#22d3ee', glyph: 'zigzag',
    text: { de: 'Laufwege und Footwork-Muster', en: 'Footwork patterns' } },
  { id: 'badteam', name: 'BadTeam', color: '#4f7bff', glyph: 'team', url: 'https://badteam.mpdalbeck.workers.dev/',
    text: { de: 'Gruppen, Anwesenheit, Mannschaften', en: 'Groups, attendance, teams' } },
  { id: 'badfit', name: 'BadFit', color: '#b07cff', glyph: 'pulse',
    text: { de: 'Athletik, Kraft und Prehab', en: 'Fitness, strength and prehab' } },
  { id: 'badplayer', name: 'BadPlayer', color: '#ff4fd8', glyph: 'player', url: 'https://badplayer.mpdalbeck.workers.dev/',
    text: { de: 'Tagebuch, Aufgaben und Clips für Spieler', en: 'Diary, tasks and clips for players' } },
];

const INK = '#0b0d10';
const L = {
  de: { title: 'Bad Apps', btn: 'Andere Bad Apps', soon: 'bald', here: 'Du bist hier', all: 'Alle Bad Apps' },
  en: { title: 'Bad Apps', btn: 'Other Bad Apps', soon: 'soon', here: 'You are here', all: 'All Bad Apps' },
};

const st = `fill="none" stroke="${INK}" stroke-width="22" stroke-linecap="round" stroke-linejoin="round"`;
export function glyph(app) {
  switch (app.glyph) {
    case 'play': return `<path d="M-28 -46L46 0L-28 46Z" fill="${INK}" stroke="${INK}" stroke-width="12" stroke-linejoin="round"/>`;
    case 'clock': return `<path d="M0 -54V0l40 24" ${st}/>`;
    case 'cup': return `<path d="M-46 -54H46V-16A46 46 0 0 1 -46 -16Z" fill="${INK}"/><path d="M0 30V48M-30 54H30" ${st}/>`;
    case 'zigzag': return `<path d="M-52 42L-16 -6L14 22L48 -30" ${st}/><path d="M18 -36H52V-2" ${st}/>`;
    case 'pulse': return `<path d="M-64 4H-34L-15 -40L8 44L27 4H64" ${st} stroke-width="19"/>`;
    case 'player': return `<g fill="${INK}"><circle cx="0" cy="-28" r="25"/><path d="M-47 52a47 47 0 0 1 94 0z"/></g>`;
    case 'team': return `<g fill="${INK}"><circle cx="-40" cy="16" r="21"/><circle cx="40" cy="16" r="21"/><circle cx="0" cy="-26" r="23"/></g>`;
  }
  return `<path d="M0 -38V38M-38 0H38" fill="none" stroke="${app.color}" stroke-width="18" stroke-linecap="round"/>`;
}

// Federball: Kork in (0,0), Federn nach oben. glyphRot dreht das Zeichen wieder gerade.
export function shuttle(app, glyphRot = 0) {
  const c = app.free ? '#2a2f38' : app.color;
  const cork = app.free
    ? `<circle r="98" fill="#1a1e25"/><circle r="88" fill="none" stroke="${app.color}" stroke-width="12" stroke-dasharray="22 18" opacity=".8"/>`
    : `<circle r="98" fill="${c}"/>`;
  return `<g fill="none" stroke="${c}" stroke-width="22" stroke-linecap="round" stroke-linejoin="round">
      <path d="M-44 -84L-104 -290M44 -84L104 -290"/>
      <path d="M-104 -290q26 22 52 0q26 22 52 0q26 22 52 0q26 22 52 0"/>
      <path d="M-16 -84L-30 -280M16 -84L30 -280"/>
      <path d="M-78 -188h156"/></g>${cork}
    <g transform="rotate(${glyphRot})">${glyph(app)}</g>`;
}

// App-Symbol: dunkles Quadrat mit schrägem Federball (wie icon.svg der Apps)
export function appIcon(app, size) {
  return `<svg viewBox="0 0 512 512" width="${size}" height="${size}" aria-hidden="true"><rect width="512" height="512" rx="112" fill="${INK}"/>
    <g transform="translate(298 351) rotate(-24)">${shuttle(app, 24)}</g></svg>`;
}

// Kleine Version: nur farbige Punkte im Kreis (für Knöpfe, Tabs)
export function dots(size, bg = false) {
  const n = APPS.length;
  const d = APPS.map((app, i) => {
    const a = (i * 2 * Math.PI) / n;
    return app.free ? '' : `<circle cx="${(62 * Math.sin(a)).toFixed(1)}" cy="${(-62 * Math.cos(a)).toFixed(1)}" r="21" fill="${app.color}"/>`;
  }).join('');
  return `<svg viewBox="-100 -100 200 200" width="${size}" height="${size}" aria-hidden="true">${bg ? `<rect x="-100" y="-100" width="200" height="200" rx="44" fill="${INK}"/>` : ''}${d}</svg>`;
}

// Ladekreis: das Punkte-Logo dreht sich, die Punkte pulsieren nacheinander
export function loader(size = 40) {
  const n = APPS.length;
  let k = 0;
  const d = APPS.map((app, i) => {
    if (app.free) return '';
    const a = (i * 2 * Math.PI) / n;
    return `<circle cx="${(62 * Math.sin(a)).toFixed(1)}" cy="${(-62 * Math.cos(a)).toFixed(1)}" r="21" fill="${app.color}" style="animation-delay:${(k++ * 0.12).toFixed(2)}s"/>`;
  }).join('');
  ensureCss();
  return `<svg class="bf-loader" viewBox="-100 -100 200 200" width="${size}" height="${size}" role="img" aria-label="…">${d}</svg>`;
}

const CSS = `
.bf-loader { animation: bf-spin 1.6s linear infinite; }
.bf-loader circle { transform-box: fill-box; transform-origin: center; animation: bf-pulse 1.2s ease-in-out infinite; }
@keyframes bf-spin { to { transform: rotate(360deg); } }
@keyframes bf-pulse { 0%, 100% { transform: scale(.65); opacity: .55; } 40% { transform: scale(1); opacity: 1; } }
.bf-loading { display: flex; align-items: center; gap: 12px; color: var(--muted, #95a0ae); }
@media (prefers-reduced-motion: reduce) { .bf-loader, .bf-loader circle { animation-duration: 3s; } }
.bf-wrap { position: relative; display: flex; margin-left: 2px; }
.bf-btn { width: 38px; height: 38px; padding: 0; display: grid; place-items: center; background: transparent; border: 0; border-radius: 10px; cursor: pointer; transition: transform .2s; }
.bf-btn:hover { background: var(--surface2, rgb(127 127 127 / .12)); }
.bf-btn svg { transition: transform .35s ease; }
.bf-btn:hover svg, .bf-btn[aria-expanded="true"] svg { transform: rotate(45deg); }
.bf-pop { position: absolute; top: calc(100% + 8px); right: -6px; z-index: 60; width: min(320px, calc(100vw - 20px)); padding: 14px; border-radius: 16px;
  background: var(--surface, #14171c); color: var(--text, #edf0f4); border: 1px solid var(--line2, #2f3540); box-shadow: 0 18px 48px rgb(0 0 0 / .32);
  opacity: 0; transform: translateY(-6px) scale(.98); transform-origin: top right; pointer-events: none; transition: opacity .15s, transform .15s; }
.bf-pop.on { opacity: 1; transform: none; pointer-events: auto; }
.bf-hd { font: 800 13px/1 var(--display, sans-serif); letter-spacing: .08em; text-transform: uppercase; color: var(--muted, #95a0ae); margin: 2px 2px 12px; }
.bf-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
.bf-it { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 10px 4px 8px; border-radius: 12px; color: var(--text, #edf0f4); text-decoration: none; font: 600 12.5px/1.15 var(--font, sans-serif); text-align: center; border: 1px solid transparent; }
.bf-it svg { border-radius: 11px; }
a.bf-it:hover { background: var(--surface2, #1b1f26); }
.bf-it.cur { border-color: var(--line2, #2f3540); background: var(--surface2, #1b1f26); cursor: default; }
.bf-it small { font-weight: 500; font-size: 10.5px; color: var(--muted, #95a0ae); }
.bf-it.soon { opacity: .5; cursor: default; }
.bf-it.soon svg { filter: grayscale(1); }
.bf-all { display: flex; align-items: center; justify-content: center; gap: 8px; margin-top: 10px; padding: 10px; border-radius: 10px; border-top: 1px solid var(--line, #232831);
  color: var(--text, #edf0f4); text-decoration: none; font: 600 13px/1 var(--font, sans-serif); }
.bf-all:hover { background: var(--surface2, #1b1f26); }
@media (prefers-reduced-motion: reduce) { .bf-btn svg, .bf-pop { transition: none; } }
`;

let cssDone = false;
function ensureCss() {
  if (cssDone || typeof document === 'undefined') return;
  cssDone = true;
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.append(style);
}

/** Startbildschirm (#boot in index.html) ausblenden, sobald die App steht */
export function hideBoot() {
  const b = document.getElementById('boot');
  if (!b) return;
  b.classList.add('done');
  setTimeout(() => b.remove(), 300);
}

/**
 * Hängt den Wechsel-Knopf ans Ende der Kopfzeile.
 * @param {object} o  current: App-ID, header: Element, lang: () => 'de' | 'en'
 */
export function mountSwitcher({ current, header = document.querySelector('header.top'), lang = () => 'de' }) {
  if (!header) return;
  const old = header.querySelector('.bf-wrap');
  if (old) return old.bfRender(); // erneut aufgerufen (z. B. Sprache gewechselt): nur Texte auffrischen
  ensureCss();

  const wrap = document.createElement('div');
  wrap.className = 'bf-wrap';
  wrap.innerHTML = `<button class="bf-btn" type="button" aria-haspopup="true" aria-expanded="false">${dots(26)}</button><div class="bf-pop" role="menu"></div>`;
  header.append(wrap);
  const btn = wrap.querySelector('.bf-btn');
  const pop = wrap.querySelector('.bf-pop');

  const render = () => {
    const lg = L[lang()] ? lang() : 'de';
    const tx = L[lg];
    btn.title = tx.btn;
    btn.setAttribute('aria-label', tx.btn);
    const items = APPS.filter((a) => !a.free).map((a) => {
      if (a.id === current) return `<div class="bf-it cur" title="${tx.here}">${appIcon(a, 46)}<span>${a.name}</span><small>${tx.here}</small></div>`;
      if (a.url) return `<a class="bf-it" role="menuitem" href="${a.url}" title="${a.text[lg]}">${appIcon(a, 46)}<span>${a.name}</span></a>`;
      return `<div class="bf-it soon" title="${a.text[lg]}">${appIcon(a, 46)}<span>${a.name}</span><small>${tx.soon}</small></div>`;
    }).join('');
    pop.innerHTML = `<div class="bf-hd">${tx.title}</div><div class="bf-grid">${items}</div>
      ${HOME_URL ? `<a class="bf-all" role="menuitem" href="${HOME_URL}">${dots(18, true)}<span>${tx.all}</span></a>` : ''}`;
  };
  const open = (on) => {
    if (on) render();
    pop.classList.toggle('on', on);
    btn.setAttribute('aria-expanded', String(on));
  };
  btn.addEventListener('click', (e) => { e.stopPropagation(); open(!pop.classList.contains('on')); });
  document.addEventListener('click', (e) => { if (!wrap.contains(e.target)) open(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && pop.classList.contains('on')) { e.stopPropagation(); open(false); btn.focus(); } }, true);
  window.addEventListener('hashchange', () => open(false));
  wrap.bfRender = render;
  render();
}
