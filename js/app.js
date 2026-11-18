import * as St from './store.js';
import { icon } from './icons.js';
import { t, lang, setLang, fmtDateTime } from './i18n.js';
import { $, $$, esc, toast, modal, closeModal, dlg } from './ui.js';
import { playersView, playerView, playerFormView, birthdaysSoon } from './players.js';
import { groupsView, groupView } from './groups.js';
import { trainingsView, trainingView, trainingFormView, trainingRow, openTrainings } from './trainings.js';
import { statsView } from './stats.js';
import { printView } from './print.js';
import * as Sync from './sync.js';
import * as BP from './badplan.js';
import { startTour, isTourOpen } from './tour.js';
import { mountSwitcher } from './family.js';

// ================= Hilfsfunktionen =================
const root = () => $('#view');
let view = null;
dlg().addEventListener('click', (e) => { if (e.target === dlg()) closeModal(); });

// ================= Seiten =================
const PAGES = [
  // [Adresse, Navigationsname, Icon]
  ['home', 'nav.home', 'home'],
  ['players', 'nav.players', 'user'],
  ['groups', 'nav.groups', 'users'],
  ['trainings', 'nav.trainings', 'check'],
  ['stats', 'nav.stats', 'chart'],
];

/** Startseite: heutiges Training mit Anwesenheit, offene Trainings, Geburtstage. Ohne Daten: Anleitung. */
function homeView(el) {
  const render = () => {
    const d = St.S.data;
    const steps = [
      ['players', 'user', d.players.length],
      ['groups', 'users', d.groups.length && d.players.some((p) => p.groups.length)],
      ['trainings', 'check', d.trainings.some((x) => Object.keys(x.att).length)],
    ];
    const allDone = steps.every((s) => s[2]);
    const today = St.todayIso();
    const now = BP.trainingsBetween(today, today);
    const next = now.length ? null : BP.trainingsBetween(BP.addDays(today, 1), BP.addDays(today, 14))[0];
    const open = openTrainings();
    const bdays = birthdaysSoon(7);
    el.innerHTML = `
      <div class="pagehead"><h1><span class="eyebrow">${esc(t('home.eyebrow'))}</span>${esc(t('home.title'))}</h1></div>
      ${allDone ? '' : `<p class="lead muted">${esc(t('home.lead'))} <button class="sm ghost" id="home-tour">${icon('help', 16)}<span>${esc(t('tour.btn'))}</span></button></p>
      <div class="howto">${steps.map(([p, ic, n], i) => `
        <a class="howto-step ${n ? 'done' : ''}" href="#/${p}">
          <span class="howto-num">${n ? icon('check', 18) : i + 1}</span>
          <span class="howto-b"><b>${esc(t(`home.s${i + 1}`))}</b><span class="muted small">${esc(t(`home.s${i + 1}t`))}</span></span>
          ${icon(ic, 22, 'howto-ic')}
        </a>`).join('')}</div>`}
      <section class="panel home-next" id="home-today">
        <h2>${icon('calendar', 20)} ${esc(t(now.length ? 'home.today' : 'home.next'))}</h2>
        ${now.length ? `<div class="dlist">${now.map((x) => trainingRow(x, true)).join('')}</div>`
          : next ? `<div class="dlist">${trainingRow(next)}</div>`
          : `<p class="muted">${esc(t('home.none'))}</p><div class="dlg-actions"><a class="btn" href="#/training/new">${icon('plus', 18)}<span>${esc(t('tr.new'))}</span></a></div>`}
      </section>
      ${open.length ? `<section class="panel home-missing"><h2>${icon('alert', 20)} ${esc(t('home.open'))}</h2><p class="muted small">${esc(t('home.openText'))}</p>
        <div class="dlist">${open.slice(0, 5).map((x) => trainingRow(x)).join('')}</div>
        ${open.length > 5 ? `<p class="small"><a href="#/trainings">${esc(t('home.openMore', { n: open.length - 5 }))}</a></p>` : ''}</section>` : ''}
      ${bdays.length ? `<section class="panel"><h2>${icon('cake', 20)} ${esc(t('home.bdays'))}</h2>
        <div class="dlist">${bdays.map(({ p, day, turns }) => `<a class="drow" href="#/player/${p.id}"><span class="dday"><b>${esc(fmtShort(day))}</b><span>${esc(day === St.todayIso() ? t('home.todayShort') : weekdayShort(day))}</span></span>
          <span class="exrow-b"><b>${esc(p.name)}</b><span class="exmeta"><span>${esc(t('pl.turns', { n: turns }))}</span></span></span></a>`).join('')}</div></section>` : ''}`;
    $('#home-tour', el)?.addEventListener('click', runTour);
  };
  render();
  return { refresh: render };
}
const loc = () => (lang() === 'de' ? 'de-DE' : 'en-GB');
const fmtShort = (day) => new Date(`${day}T12:00:00`).toLocaleDateString(loc(), { day: 'numeric', month: 'numeric' });
const weekdayShort = (day) => new Date(`${day}T12:00:00`).toLocaleDateString(loc(), { weekday: 'short' });

function backupView(el) {
  const render = () => {
    const d = St.S.data, m = St.S.meta;
    el.innerHTML = `
      <div class="pagehead"><h1><span class="eyebrow">${esc(t('bk.eyebrow'))}</span>${esc(t('bk.title'))}</h1></div>
      <p class="lead muted">${esc(t('bk.lead'))}</p>
      <div class="stats">
        <div class="stat-tile"><b>${d.players.length}</b><span>${esc(t('nav.players'))}</span></div>
        <div class="stat-tile"><b>${d.groups.length}</b><span>${esc(t('nav.groups'))}</span></div>
        <div class="stat-tile"><b>${d.trainings.length}</b><span>${esc(t('bk.trainings'))}</span></div>
      </div>
      ${cloudPanel()}
      <section class="panel">
        <h2>${icon('shield', 20)} ${esc(t('bk.fileTitle'))}</h2>
        <p>${esc(t('bk.fileText'))}</p>
        <p class="note">${icon('alert', 16)}<span>${esc(t('bk.private'))}</span></p>
        <p class="muted small">${esc(t('bk.lastExport', { when: m.lastExport ? fmtDateTime(m.lastExport) : t('bk.never') }))}</p>
        <div class="dlg-actions">
          <button class="primary" id="bk-exp">${icon('download', 18)}<span>${esc(t('bk.export'))}</span><kbd>E</kbd></button>
          <button id="bk-imp">${icon('upload', 18)}<span>${esc(t('bk.import'))}</span><kbd>I</kbd></button>
          <input type="file" id="bk-file" accept=".json,application/json" hidden>
        </div>
      </section>
      <section class="panel dangerzone">
        <h2>${icon('trash', 20)} ${esc(t('bk.dangerTitle'))}</h2>
        <p>${esc(t('bk.dangerText'))}</p>
        <button class="danger" id="bk-wipe">${icon('trash', 18)}<span>${esc(t('bk.wipe'))}</span></button>
      </section>`;
    $('#bk-exp', el).onclick = exportAll;
    $('#bk-imp', el).onclick = () => $('#bk-file', el).click();
    $('#bk-file', el).onchange = (e) => { const f = e.target.files[0]; e.target.value = ''; if (f) importFile(f); };
    bindCloud(el);
    $('#bk-wipe', el).onclick = () => { if (confirm(t('bk.wipeConfirm'))) { St.wipeAll(); toast(t('bk.wiped')); } };
  };
  render();
  return {
    refresh: render,
    key(e) {
      const k = e.key.toLowerCase();
      if (k === 'e') { exportAll(); return true; }
      if (k === 'i') { $('#bk-file', el).click(); return true; }
      return false;
    },
  };
}

// ================= Dropbox =================
function cloudPanel() {
  const Y = Sync.Y;
  let body;
  if (Y.state === 'off') {
    body = `<p>${esc(t('dbx.intro'))}</p>
      <div class="dlg-actions"><button class="primary big" id="cl-dbx">${icon('cloud', 20)}<span>${esc(t('dbx.connect'))}</span></button></div>
      <details class="more"><summary>${esc(t('dbx.setupTitle'))}</summary>
        <p class="small">${esc(t('dbx.setupText'))}</p>
        <ol class="steps small"><li>${t('dbx.setup1')}</li><li>${t('dbx.setup2')}</li><li>${esc(t('dbx.setup3'))}<span class="copyline"><code>${esc(Sync.DBX.redirectUri())}</code><button class="sm" id="cl-copy">${esc(t('dbx.copy'))}</button></span></li></ol>
      </details>`;
  } else if (Y.state === 'permission') {
    body = `<p>${esc(t('dbx.lost'))}</p><div class="dlg-actions"><button class="primary" id="cl-dbx">${icon('cloud', 18)}<span>${esc(t('dbx.reconnectBtn'))}</span></button><button class="ghost" id="cl-off">${esc(t('dbx.disconnect'))}</button></div>`;
  } else {
    const when = St.S.meta.lastSync ? fmtDateTime(St.S.meta.lastSync) : '–';
    const bp = BP.cached();
    body = `<ul class="stat">
        <li>Dropbox${Sync.DBX.account() ? `: <b>${esc(Sync.DBX.account())}</b>` : ''} ${Y.error ? `<span class="badge warn">${esc(t('dbx.problem'))}</span>` : Y.busy ? `<span class="badge">${esc(t('dbx.busyNow'))}</span>` : `<span class="badge ok">${esc(t('dbx.ok'))}</span>`}</li>
        <li>${esc(t('dbx.file'))}: <b>Dropbox › Apps › Bad Apps › ${Sync.DBX.FILE}</b></li>
        <li>${esc(t('dbx.last'))}: <b>${esc(when)}</b></li>
        <li>BadPlan: <b>${esc(bp ? t('dbx.bpOk', { n: bp.slots.length, d: bp.dates.length }) : t('dbx.bpNone'))}</b></li>
        ${Y.error ? `<li><span class="badge warn">${esc(Y.error)}</span></li>` : ''}
      </ul>
      <p class="muted small" style="margin-top:10px">${esc(t('dbx.how'))}</p>
      <div class="dlg-actions"><button id="cl-now">${icon('repeat', 18)}<span>${esc(t('dbx.now'))}</span></button><button class="ghost" id="cl-off">${esc(t('dbx.disconnect'))}</button></div>`;
  }
  return `<section class="panel" id="cloud-panel"><h2>${icon('cloud', 20)} ${esc(t('dbx.title'))}</h2>${body}</section>`;
}
function bindCloud(el) {
  const on = (sel, fn) => { const b = $(sel, el); if (b) b.onclick = () => Promise.resolve().then(fn).catch((e) => toast(`Dropbox: ${e.message || e}`)); };
  on('#cl-dbx', () => Sync.login());
  on('#cl-copy', async () => { await navigator.clipboard.writeText(Sync.DBX.redirectUri()); toast(t('dbx.copied')); });
  on('#cl-now', async () => { await Sync.syncNow(); await BP.load(true); if (!Sync.Y.error) toast(t('dbx.synced')); });
  on('#cl-off', async () => { if (confirm(t('dbx.offConfirm'))) await Sync.disconnect(); });
}

function exportAll() {
  const data = St.buildExport();
  const blob = new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `badteam-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  St.markExported();
  toast(t('bk.exported'));
}

async function importFile(file) {
  let inc;
  try { inc = St.parseImport(await file.text()); } catch { return toast(t('bk.badFile')); }
  const d = modal(`<h2>${esc(t('bk.importTitle'))}</h2>
    <p>${esc(t('bk.importInfo', { pl: inc.players.length, gr: inc.groups.length, tr: inc.trainings.length }))}</p>
    <label class="radio"><input type="radio" name="im" value="merge" checked><span><b>${esc(t('bk.merge'))}</b><br><span class="muted small">${esc(t('bk.mergeHint'))}</span></span></label>
    <label class="radio"><input type="radio" name="im" value="replace"><span><b>${esc(t('bk.replace'))}</b><br><span class="muted small">${esc(t('bk.replaceHint'))}</span></span></label>
    <div class="dlg-actions"><span class="grow"></span><button class="ghost" id="im-no">${esc(t('bk.cancel'))}</button><button class="primary" id="im-ok">${esc(t('bk.doImport'))}</button></div>`);
  $('#im-no', d).onclick = closeModal;
  $('#im-ok', d).onclick = () => {
    const mode = $('input[name=im]:checked', d).value;
    closeModal();
    toast(t('bk.imported', St.applyImport(inc, mode)));
  };
}

// ================= Kopfzeile: Navigation, Sprache, Darstellung =================
function renderNav() {
  $('#nav').innerHTML = PAGES.map(([p, label, ic]) =>
    `<a href="#/${p === 'home' ? '' : p}" data-nav="${p}">${icon(ic)}<span>${esc(t(label))}</span>${p === 'trainings' ? '<i id="tr-dot" class="dot hidden"></i>' : ''}</a>`).join('');
  const bb = $('#backup-btn');
  bb.innerHTML = `${icon('shield', 20)}<i id="dirty" class="dot hidden"></i>`;
  bb.title = t('nav.backup');
  bb.setAttribute('aria-label', t('nav.backup'));
}

const THEMES = [['auto', 'auto'], ['light', 'sun'], ['dark', 'moon']];
let theme = 'auto';
try { theme = localStorage.getItem('badteam-theme') || 'auto'; } catch { /* privat */ }
function applyTheme() {
  if (theme === 'auto') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = theme;
  const btn = $('#theme-btn');
  btn.innerHTML = icon(THEMES.find((x) => x[0] === theme)[1], 20);
  btn.title = t('theme.title', { label: t(`theme.${theme}`) });
}
function cycleTheme() {
  theme = THEMES[(THEMES.findIndex((x) => x[0] === theme) + 1) % THEMES.length][0];
  try { localStorage.setItem('badteam-theme', theme); } catch { /* privat */ }
  applyTheme();
  toast(t('theme.toast', { label: t(`theme.${theme}`) }));
}

// ================= Einführungs-Tour =================
function runTour() {
  if (isTourOpen()) return;
  closeModal();
  St.setMeta({ tourDone: true });
  startTour();
}

function applyLangChrome() {
  document.title = 'BadTeam';
  $('meta[name=description]').content = t('app.desc');
  const lb = $('#lang-btn');
  lb.innerHTML = `<span class="lang-code">${lang().toUpperCase()}</span>`;
  lb.title = t('top.lang');
  const hb = $('#help-btn');
  hb.title = t('tour.btn'); hb.setAttribute('aria-label', t('tour.btn'));
  renderNav();
  applyTheme();
  applyKeys();
  mountSwitcher({ current: 'badteam', lang });
}
function toggleLang() {
  if (view?.canLeave && !view.canLeave()) return;
  setLang(lang() === 'de' ? 'en' : 'de');
  applyLangChrome();
  route();
  updateChrome();
  toast(t('lang.toast'));
}

// ================= Tastenkürzel: Anzeige an/aus + Übersicht =================
const keyGroups = () => [
  [t('nav.players'), [['N', t('pl.new')], ['/', t('keys.search')], ['E', t('keys.edit')], ['Esc', t('keys.back')], [`${t('key.ctrl')} + ↵`, t('keys.save')]]],
  [t('nav.groups'), [['N', t('gr.new')], ['M', t('gr.mail')]]],
  [t('keys.gAtt'), [['A', t('tr.allIn')], ['D', t('pr.print')], ['Esc', t('keys.back')]]],
  [t('nav.trainings'), [['N', t('tr.new')]]],
  [t('nav.backup'), [['E', t('bk.export')], ['I', t('bk.import')]]],
];
const keysOn = () => St.S.meta.showKeys !== false; // Standard: an (hilft beim ersten Benutzen)
function applyKeys() {
  document.body.classList.toggle('keys-off', !keysOn());
  const b = $('#keys-btn');
  b.classList.toggle('on', keysOn());
  b.title = t('top.keysState', { state: t(keysOn() ? 'top.on' : 'top.off') });
}
function keyHelp() {
  const d = modal(`<h2>${esc(t('keys.title'))}</h2>
    <label class="switch keysw"><input type="checkbox" id="keys-on" ${keysOn() ? 'checked' : ''}><i></i><span>${esc(t('keys.show'))}</span></label>
    <p class="muted small">${t('keys.hint')}</p>
    <div class="keyhelp">${keyGroups().map(([g, list]) => `<section><h3>${esc(g)}</h3>${list.map(([k, l]) => `<div class="kh-row"><span class="kh-k">${k.split(' / ').map((x) => `<kbd>${esc(x)}</kbd>`).join(' ')}</span><span>${esc(l)}</span></div>`).join('')}</section>`).join('')}</div>
    <div class="dlg-actions"><span class="grow"></span><button class="primary" id="kh-ok">${esc(t('keys.done'))}</button></div>`, 'wide');
  $('#keys-on', d).onchange = (e) => { St.setMeta({ showKeys: e.target.checked }); applyKeys(); };
  $('#kh-ok', d).onclick = closeModal;
}

// ================= Router, Banner =================
let lastHash = location.hash;
function route() {
  // Ungespeicherte Änderungen? Dann bleiben, wenn der Nutzer das möchte.
  if (view?.canLeave && !view.canLeave()) { history.replaceState(null, '', lastHash || '#/'); return; }
  lastHash = location.hash;
  view?.destroy?.();
  view = null;
  closeModal();
  document.body.classList.remove('printmode');
  const parts = (location.hash.slice(1) || '/').split('/').map((x) => decodeURIComponent(x));
  const [, a, b, c, d] = parts;
  const el = root();
  el.innerHTML = '';
  window.scrollTo(0, 0);
  let nav = 'home';
  if (a === 'players') { view = playersView(el); nav = 'players'; }
  else if (a === 'player' && b === 'new') { view = playerFormView(el, null, c || null); nav = 'players'; }
  else if (a === 'player' && c === 'edit') { view = playerFormView(el, b); nav = 'players'; }
  else if (a === 'player') { view = playerView(el, b); nav = 'players'; }
  else if (a === 'groups') { view = groupsView(el); nav = 'groups'; }
  else if (a === 'group') { view = groupView(el, b); nav = 'groups'; }
  else if (a === 'trainings') { view = trainingsView(el); nav = 'trainings'; }
  else if (a === 'training' && b === 'new') { view = trainingFormView(el, null, c || null); nav = 'trainings'; }
  else if (a === 'training' && c === 'edit') { view = trainingFormView(el, b); nav = 'trainings'; }
  else if (a === 'training') { view = trainingView(el, b); nav = 'trainings'; }
  else if (a === 'stats') { view = statsView(el, b || null); nav = 'stats'; }
  else if (a === 'print') { view = printView(el, b, c, d); nav = b === 'training' ? 'trainings' : 'stats'; }
  else if (a === 'backup') { view = backupView(el); nav = 'backup'; }
  else view = homeView(el);
  $$('#nav a').forEach((x) => x.classList.toggle('on', x.dataset.nav === nav));
  $('#backup-btn').classList.toggle('on', nav === 'backup');
}

function updateChrome() {
  const unsaved = Sync.Y.state === 'ok' ? St.S.meta.lastChange > (St.S.meta.lastSync || 0) : St.isDirty();
  $('#dirty')?.classList.toggle('hidden', !(St.hasData() && unsaved));
  const open = openTrainings().length;
  const dd = $('#tr-dot');
  if (dd) { dd.classList.toggle('hidden', !open); dd.title = open ? t('home.open') : ''; }
  $('#backup-btn')?.classList.toggle('synced', Sync.Y.state === 'ok' && !Sync.Y.error);
  const b = $('#banner');
  let html = '';
  if (Sync.Y.state === 'permission') html = `${icon('cloud', 18)}<span>${esc(t('dbx.lost'))}</span><button id="bn-dbx" class="sm primary">${esc(t('dbx.reconnectBtn'))}</button>`;
  else if (Sync.Y.state === 'ok' && Sync.Y.error) html = `${icon('alert', 18)}<span>Dropbox: ${esc(Sync.Y.error)}</span><button id="bn-bk" class="sm">${esc(t('nav.backup'))}</button>`;
  else if (St.S.volatile) html = `${icon('alert', 18)}<span>${esc(t('banner.volatile'))}</span><button id="bn-exp" class="sm">${esc(t('banner.export'))}</button>`;
  b.innerHTML = html;
  b.classList.toggle('hidden', !html);
  const bind = (sel, fn) => { const x = $(sel); if (x) x.onclick = fn; };
  bind('#bn-exp', exportAll);
  bind('#bn-dbx', () => Sync.login());
  bind('#bn-bk', () => (location.hash = '#/backup'));
}

document.addEventListener('keydown', (e) => {
  if (isTourOpen()) return;
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && view?.submit && !dlg().open) { e.preventDefault(); return view.submit(); }
  if (dlg().open || e.altKey || e.ctrlKey || e.metaKey) return;
  if (e.target.closest?.('input, textarea, select, [contenteditable]')) return;
  if (view?.key?.(e)) e.preventDefault();
});

window.addEventListener('beforeunload', (e) => {
  St.flush();
  // Ungespeichertes Formular: Browser fragt selbst nach
  if (view?.isDirty?.()) { e.preventDefault(); e.returnValue = ''; }
});
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') St.flush(); });

// ================= Start =================
(async function start() {
  $$('[data-icon]').forEach((el) => { el.outerHTML = icon(el.dataset.icon, el.classList.contains('brand-mark') ? 22 : 18, el.className); });
  $('#theme-btn').onclick = cycleTheme;
  $('#lang-btn').onclick = toggleLang;
  $('#keys-btn').onclick = keyHelp;
  $('#help-btn').onclick = runTour;
  await St.init();
  applyLangChrome();
  St.subscribe(() => { view?.refresh?.(); updateChrome(); });
  const synced = Sync.init({ message: toast }); // vor route(): räumt die Adresse nach der Dropbox-Anmeldung auf
  window.addEventListener('hashchange', route);
  route();
  updateChrome();
  synced.then(() => BP.init({ adopted: (n) => toast(t('gr.adopted', { n })) }));
  // Beim allerersten Besuch einmal von selbst starten (nicht, wenn schon Daten da sind)
  if (!St.S.meta.tourDone) {
    if (St.hasData()) St.setMeta({ tourDone: true });
    else setTimeout(() => { if (!St.S.meta.tourDone && !dlg().open) runTour(); }, 700);
  }
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    const hadSw = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.register('sw.js').then((reg) => {
      const check = () => reg.update().catch(() => {});
      setInterval(check, 30 * 60 * 1000);
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
    }).catch(() => {});
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (hadSw) toast(t('update.toast'), t('update.reload'), () => { St.flush().finally(() => location.reload()); });
    });
  }
})();
