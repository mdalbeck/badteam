// Automatischer Abgleich mit Dropbox (Datei badteam-daten.json im Ordner Dropbox › Apps › Bad Apps).
// Ablauf wie bei BadPlan: beim Öffnen, beim Zurückkehren in die App und alle 30 Sekunden schauen, ob ein anderes
// Gerät etwas geändert hat; eigene Änderungen kurz nach dem Speichern hochladen. Konflikte über die Dropbox-Version (rev).
import * as St from './store.js';
import * as DBX from './dropbox.js';
import { t } from './i18n.js';

export { DBX };
/** state: off | permission (neu verbinden) | ok · error: Text des letzten Problems */
export const Y = { state: 'off', error: '', busy: false };
let lastText = '';
let pushTimer = null, pollTimer = null;
let queue = Promise.resolve();
let say = () => {};
const onCycle = new Set();
/** Nach jedem Abgleich aufrufen (z. B. BadPlan-Daten neu lesen) */
export const afterSync = (fn) => onCycle.add(fn);

function set(patch) { Object.assign(Y, patch); St.notify(); }
const run = (fn) => (queue = queue.then(fn, fn).catch((e) => fail(e)));
const localDirty = () => St.S.meta.lastChange > (St.S.meta.lastSync || 0);

function fail(e) {
  console.error('Cloud-Abgleich', e);
  if (e?.name === 'NotAllowedError') return set({ state: 'permission', error: '' });
  if (e?.name === 'NoModificationAllowedError') { set({ error: `${e.message} ${t('sync.retry')}` }); return schedulePush(15000); }
  if (e instanceof TypeError) { set({ error: t('sync.offline') }); return schedulePush(30000); }
  set({ error: e?.message || String(e) });
}

// ---------- Abgleich ----------
async function pull() {
  const p = await DBX.peek();
  if (!p) { St.setMeta({ syncVersion: 0 }); return true; } // noch keine Datei → schreiben
  if (p.version === St.S.meta.syncVersion) return false;
  const txt = await p.load();
  if (!txt.trim()) return true;
  if (txt === lastText) { St.setMeta({ syncVersion: p.version }); return false; }
  let obj;
  try { obj = JSON.parse(txt); } catch { set({ error: t('sync.incomplete') }); return false; }
  if (obj?.format !== St.FORMAT) throw new Error(t('sync.foreign'));
  const merge = localDirty();
  St.importData(obj, 'merge'); // immer zusammenführen: Gelöschtes bleibt dank Löschvermerken gelöscht
  lastText = txt;
  St.setMeta(merge ? { syncVersion: p.version } : { syncVersion: p.version, lastSync: Date.now(), lastExport: Date.now() });
  if (merge) say(t('sync.merged'));
  return false;
}

async function push() {
  const at = Date.now();
  const txt = JSON.stringify(St.buildExport(), null, 1);
  const v = await DBX.write(txt, St.S.meta.syncVersion || null);
  lastText = txt;
  St.setMeta({ syncVersion: v, lastSync: at, lastExport: Date.now() });
}

function cycle() {
  return run(async () => {
    if (Y.state !== 'ok') return;
    set({ busy: true });
    try {
      const empty = await pull();
      if (empty || localDirty()) {
        try { await push(); } catch (e) {
          if (e.name !== 'Conflict') throw e;
          await pull(); // ein anderes Gerät war schneller: zusammenführen und nochmal schreiben
          await push();
        }
      }
      if (Y.error) set({ error: '' });
    } finally { set({ busy: false }); }
    onCycle.forEach((fn) => { try { fn(); } catch (e) { console.error(e); } });
  });
}
function schedulePush(ms = 1500) { clearTimeout(pushTimer); pushTimer = setTimeout(() => cycle(), ms); }

async function activate() {
  set({ state: 'ok', error: '' });
  await cycle();
  clearInterval(pollTimer);
  pollTimer = setInterval(() => { if (document.visibilityState === 'visible') cycle(); }, 30000);
}

// ---------- öffentlich ----------
/** Muss vor dem ersten Routing aufgerufen werden (räumt die Adresse nach der Dropbox-Anmeldung auf). */
export function init({ message } = {}) {
  if (message) say = message;
  const redirect = DBX.handleRedirect(); // läuft bis zum ersten await synchron → Adresse ist sofort sauber
  St.onSaved(() => { if (Y.state === 'ok' && localDirty()) schedulePush(); });
  window.addEventListener('focus', () => { if (Y.state === 'ok') cycle(); });
  window.addEventListener('online', () => { if (Y.state === 'ok') cycle(); });
  document.addEventListener('visibilitychange', () => { if (Y.state === 'ok' && document.visibilityState === 'visible') cycle(); });
  return (async () => {
    try {
      if (await redirect) {
        St.setMeta({ syncVersion: 0, lastSync: 0 });
        lastText = '';
        await activate();
        say(t('sync.connected', { who: DBX.account() ? ` (${DBX.account()})` : '' }));
        return;
      }
    } catch (e) { if (e.name !== 'AbortError') say(`Dropbox: ${e.message}`); }
    try {
      if (await DBX.load()) await activate();
      else if ((await St.getKey('syncKind')) === 'dropbox') set({ state: 'permission' });
    } catch (e) { fail(e); }
  })();
}

export async function login() { await St.setKey('syncKind', 'dropbox'); return DBX.login(); }
export const syncNow = () => cycle();

export async function disconnect() {
  clearInterval(pollTimer); clearTimeout(pushTimer);
  await DBX.logout();
  await St.setKey('syncKind', '');
  lastText = '';
  St.setMeta({ syncVersion: 0, lastSync: 0 });
  set({ state: 'off', error: '' });
}
