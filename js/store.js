// Datenschicht: komplett getrennt von der Oberfläche (Aufbau wie in BadPlan).
// Speichert alles automatisch in IndexedDB, bietet Export/Import (JSON); der Dropbox-Abgleich (sync.js) hängt sich hier an.

const DB_NAME = 'badteam';
const STORE = 'kv';
export const FORMAT = 'badteam';
export const VERSION = 1;

/* ---------- Datenmodell ----------
 * players    Spieler
 *   { id, name, birthday: 'JJJJ-MM-TT' | '', hand: 'right' | 'left' | '', injuries, note, active: true,
 *     groups: [groupId], phone, email,                     (eigener Kontakt)
 *     parentName, parentPhone, parentEmail,                 (Kontakt der Eltern – wird nur unter 18 gezeigt)
 *     createdAt, updatedAt }
 * groups     Trainingsgruppen, z. B. „U15“   { id, name, updatedAt }
 *   Die IDs sind dieselben wie in BadPlan (beim ersten Abgleich übernommen), damit Termine und Slots aus BadPlan passen.
 * trainings  Erfasste Trainings (Anwesenheit)
 *   { id, day: 'JJJJ-MM-TT', start: '18:00', end: '19:30', groupId, place,
 *     ref: null (eigenes Training) | 'pd:<Termin-ID>' (Termin aus BadPlan) | 'ps:<Slot-ID>:<Tag>' (Trainingsslot aus BadPlan),
 *     att: { playerId: 'p' (da) | 'e' (entschuldigt) | 'a' (fehlt) }, note, createdAt, updatedAt }
 * deleted    Gelöschtes: { id: Zeitpunkt } – damit Löschungen beim Abgleich zwischen Geräten nicht wieder auftauchen
 */

const LISTS = ['players', 'groups', 'trainings'];
const empty = () => ({ players: [], groups: [], trainings: [], deleted: {} });
const TOMB_DAYS = 120; // so lange merkt sich die App Löschungen
export const STATUS = ['p', 'e', 'a'];

export const S = {
  data: empty(),
  meta: { created: 0, lastExport: 0, lastChange: 0, showKeys: true, lastSync: 0, syncVersion: 0 },
  volatile: false, // true = Speicher im Browser nicht verfügbar
};

let db = null;
let timer = null;
const subs = new Set();
const savedSubs = new Set();
/** Wird nach jedem Speichern aufgerufen (der Cloud-Abgleich hängt sich hier an). */
export const onSaved = (fn) => savedSubs.add(fn);

// ---------- Freie Schlüssel im Browser-Speicher (z. B. Dropbox-Anmeldung) ----------
export async function getKey(k) { if (!db) return null; try { return (await kvGet(`key:${k}`)) ?? null; } catch { return null; } }
export async function setKey(k, v) { if (db) await kvPut([[`key:${k}`, v]]); }

export const uid = () =>
  (crypto.randomUUID ? crypto.randomUUID() : 'id' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10));

const req = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
function openDb() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB_NAME, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
const kvGet = (k) => req(db.transaction(STORE).objectStore(STORE).get(k));
function kvPut(pairs) {
  return new Promise((res, rej) => {
    const tx = db.transaction(STORE, 'readwrite');
    for (const [k, v] of pairs) tx.objectStore(STORE).put(v, k);
    tx.oncomplete = res;
    tx.onerror = tx.onabort = () => rej(tx.error);
  });
}

const str = (v) => String(v ?? '').trim();
const cleanPlayer = (x) => ({
  name: str(x.name),
  birthday: /^\d{4}-\d{2}-\d{2}$/.test(x.birthday || '') ? x.birthday : '',
  hand: x.hand === 'left' || x.hand === 'right' ? x.hand : '',
  injuries: str(x.injuries),
  note: str(x.note),
  active: x.active !== false,
  groups: [...new Set(Array.isArray(x.groups) ? x.groups.filter(Boolean) : [])],
  phone: str(x.phone),
  email: str(x.email),
  parentName: str(x.parentName),
  parentPhone: str(x.parentPhone),
  parentEmail: str(x.parentEmail),
});
const cleanAtt = (a) => Object.fromEntries(Object.entries(a && typeof a === 'object' ? a : {}).filter(([, v]) => STATUS.includes(v)));

function normalize(d) {
  const out = empty();
  for (const k of LISTS) out[k] = Array.isArray(d?.[k]) ? d[k].filter((x) => x && x.id) : [];
  out.players = out.players.map((p) => ({ id: p.id, ...cleanPlayer(p), createdAt: p.createdAt || 0, updatedAt: p.updatedAt || 0 }));
  for (const tr of out.trainings) { tr.att = cleanAtt(tr.att); if (tr.ref === undefined) tr.ref = null; }
  // Alte Löschvermerke vergessen
  const cutoff = Date.now() - TOMB_DAYS * 864e5;
  out.deleted = Object.fromEntries(Object.entries(d?.deleted && typeof d.deleted === 'object' ? d.deleted : {}).filter(([, ts]) => ts > cutoff));
  return out;
}

// ---------- Start, Speichern, Benachrichtigen ----------
export async function init() {
  try {
    db = await openDb();
    const d = await kvGet('data');
    const m = await kvGet('meta');
    S.data = normalize(d);
    if (m) Object.assign(S.meta, m);
  } catch (e) {
    console.error('IndexedDB nicht verfügbar', e);
    S.volatile = true;
    S.data = normalize(null);
  }
  if (!S.meta.created) S.meta.created = Date.now();
  try { await navigator.storage?.persist?.(); } catch { /* egal */ }
}

export const subscribe = (fn) => { subs.add(fn); return () => subs.delete(fn); };
export const notify = () => subs.forEach((fn) => { try { fn(); } catch (e) { console.error(e); } });

function save() {
  clearTimeout(timer);
  timer = setTimeout(flush, 300);
}
export async function flush() {
  clearTimeout(timer);
  if (!db) return;
  try { await kvPut([['data', S.data], ['meta', S.meta]]); } catch (e) { console.error('Speichern fehlgeschlagen', e); return; }
  savedSubs.forEach((fn) => { try { fn(); } catch (e) { console.error(e); } });
}

/** Jede Änderung an den Daten läuft hier durch: ändern, merken, speichern, Oberfläche benachrichtigen. */
export function change(fn) {
  fn(S.data);
  S.meta.lastChange = Date.now();
  save();
  notify();
}
export function setMeta(patch) {
  Object.assign(S.meta, patch);
  save();
  notify();
}
export const isDirty = () => S.meta.lastChange > (S.meta.lastExport || 0);
export const hasData = () => LISTS.some((k) => S.data[k].length);

// ---------- Lesen ----------
export const player = (id) => S.data.players.find((x) => x.id === id);
export const group = (id) => S.data.groups.find((x) => x.id === id);
export const training = (id) => S.data.trainings.find((x) => x.id === id);
export const trainingByRef = (ref) => (ref ? S.data.trainings.find((x) => x.ref === ref) : null);
export const byName = (a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' });
export const groupsSorted = () => [...S.data.groups].sort(byName);
/** Spieler einer Gruppe (standardmäßig nur aktive), nach Namen sortiert */
export const members = (gid, all = false) => S.data.players.filter((p) => p.groups.includes(gid) && (all || p.active)).sort(byName);

// ---------- Alter ----------
const pad = (n) => String(n).padStart(2, '0');
export const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const todayIso = () => iso(new Date());
/** Alter in Jahren an einem Tag (Standard: heute); null ohne Geburtstag */
export function age(birthday, on = todayIso()) {
  if (!birthday) return null;
  const [y, m, d] = birthday.split('-').map(Number);
  const [oy, om, od] = on.split('-').map(Number);
  return oy - y - (om < m || (om === m && od < d) ? 1 : 0);
}
/** Volljährig? Ohne Geburtstag zählt der Spieler als minderjährig (Eltern-Kontakt bleibt sichtbar). */
export const isAdult = (p) => (age(p.birthday) ?? 0) >= 18;
/** E-Mail-Adressen für Rundbriefe: unter 18 Eltern und Spieler, ab 18 nur der Spieler */
export const mailsOf = (p) => [p.email, isAdult(p) ? '' : p.parentEmail].map(str).filter((m) => m.includes('@'));

// ---------- Spieler ----------
export function addPlayer(x) {
  const id = uid(), now = Date.now();
  change((d) => d.players.push({ id, ...cleanPlayer(x), createdAt: now, updatedAt: now }));
  return id;
}
export function updatePlayer(id, x) {
  change(() => { const p = player(id); if (p) Object.assign(p, cleanPlayer({ ...p, ...x }), { updatedAt: Date.now() }); });
}
/** Löscht einen Spieler. Seine Häkchen in alten Trainings bleiben nicht stehen. Gibt „Rückgängig“ zurück. */
export function deletePlayer(id) {
  const before = JSON.parse(JSON.stringify({ players: S.data.players, trainings: S.data.trainings }));
  change((d) => {
    tomb(id);
    d.players = d.players.filter((p) => p.id !== id);
    for (const tr of d.trainings) if (tr.att[id]) { delete tr.att[id]; tr.updatedAt = Date.now(); }
  });
  return () => change((d) => { d.players = before.players; d.trainings = before.trainings; untomb(id); });
}
export function setMembership(pid, gid, on) {
  change(() => {
    const p = player(pid); if (!p) return;
    const has = p.groups.includes(gid);
    if (on && !has) p.groups.push(gid);
    else if (!on && has) p.groups = p.groups.filter((g) => g !== gid);
    else return;
    p.updatedAt = Date.now();
  });
}

// ---------- Gruppen ----------
export function addGroup(name, id = uid()) {
  change((d) => { if (!d.groups.some((g) => g.id === id)) d.groups.push({ id, name: str(name), updatedAt: Date.now() }); });
  return id;
}
export function renameGroup(id, name) {
  change(() => { const g = group(id); if (g) Object.assign(g, { name: str(name), updatedAt: Date.now() }); });
}
export function deleteGroup(id) {
  change((d) => {
    tomb(id);
    d.groups = d.groups.filter((g) => g.id !== id);
    for (const p of d.players) if (p.groups.includes(id)) { p.groups = p.groups.filter((g) => g !== id); p.updatedAt = Date.now(); }
  });
}
/** Gruppen aus BadPlan übernehmen, die es hier noch nicht gibt (und die hier nicht gelöscht wurden). Liefert die Anzahl. */
export function adoptGroups(list) {
  const fresh = (list || []).filter((g) => g?.id && str(g.name) && !group(g.id) && S.data.deleted[g.id] == null);
  if (fresh.length) change((d) => { for (const g of fresh) d.groups.push({ id: g.id, name: str(g.name), updatedAt: Date.now() }); });
  return fresh.length;
}

// ---------- Trainings & Anwesenheit ----------
/** Legt ein Training an (eigenes oder für einen BadPlan-Termin/-Slot). Gibt es zur ref schon eins, wird dieses geliefert. */
export function addTraining(x) {
  const old = trainingByRef(x.ref);
  if (old) return old.id;
  const id = uid(), now = Date.now();
  change((d) => d.trainings.push({
    id, day: x.day, start: x.start || '', end: x.end || '', groupId: x.groupId || null, place: str(x.place),
    ref: x.ref || null, att: cleanAtt(x.att), note: str(x.note), createdAt: now, updatedAt: now,
  }));
  return id;
}
export function updateTraining(id, patch) {
  change(() => { const tr = training(id); if (tr) Object.assign(tr, patch, { updatedAt: Date.now() }); });
}
export function setAtt(id, pid, status) {
  change(() => {
    const tr = training(id); if (!tr) return;
    if (STATUS.includes(status)) tr.att[pid] = status; else delete tr.att[pid];
    tr.updatedAt = Date.now();
  });
}
/** Mehrere Häkchen auf einmal, z. B. „alle da“ */
export function setAttMany(id, pids, status) {
  change(() => {
    const tr = training(id); if (!tr) return;
    for (const pid of pids) tr.att[pid] = status;
    tr.updatedAt = Date.now();
  });
}
export function deleteTraining(id) {
  change((d) => { tomb(id); d.trainings = d.trainings.filter((x) => x.id !== id); });
}

// ---------- Löschvermerke ----------
function tomb(id) { S.data.deleted[id] = Date.now(); }
function untomb(id) { delete S.data.deleted[id]; }

// ---------- Alles löschen ----------
export function wipeAll() {
  // Alles als gelöscht vermerken, damit es beim Abgleich nicht von anderen Geräten zurückkommt
  const now = Date.now();
  const deleted = { ...S.data.deleted };
  for (const k of LISTS) for (const x of S.data[k]) deleted[x.id] = now;
  change((d) => { Object.assign(d, normalize(null), { deleted }); });
}

// ---------- Export / Import ----------
export function buildExport() {
  return { format: FORMAT, version: VERSION, exportedAt: new Date().toISOString(), ...S.data };
}
export function markExported() { setMeta({ lastExport: Date.now() }); }

const stamp = (x) => x.updatedAt || x.createdAt || 0;
/** Zusammenführen ohne Rückfrage (auch für den Cloud-Abgleich): neuere Fassung gewinnt, Gelöschtes bleibt gelöscht. */
export function mergeInto(d, inc, mode = 'merge') {
  if (mode === 'replace') { Object.assign(d, inc); return; }
  for (const [id, ts] of Object.entries(inc.deleted || {})) d.deleted[id] = Math.max(ts, d.deleted[id] || 0);
  const dead = (x) => d.deleted[x.id] != null && d.deleted[x.id] >= stamp(x);
  for (const k of LISTS) {
    for (const x of inc[k]) {
      const i = d[k].findIndex((y) => y.id === x.id);
      if (i < 0) d[k].push(x);
      else if (stamp(x) > stamp(d[k][i])) d[k][i] = x;
    }
    d[k] = d[k].filter((x) => !dead(x));
  }
  // Zwei Geräte haben dasselbe BadPlan-Training erfasst: zusammenlegen (neuere Häkchen gewinnen)
  const byRef = new Map();
  for (const tr of d.trainings) if (tr.ref) byRef.set(tr.ref, [...(byRef.get(tr.ref) || []), tr]);
  for (const list of byRef.values()) {
    if (list.length < 2) continue;
    list.sort((a, b) => stamp(b) - stamp(a) || a.id.localeCompare(b.id)); // neueste zuerst, bei Gleichstand fest
    const [keep, ...drop] = list;
    for (const x of drop) { keep.att = { ...x.att, ...keep.att }; d.deleted[x.id] = Math.max(stamp(keep), d.deleted[x.id] || 0); }
  }
  d.trainings = d.trainings.filter((x) => !dead(x));
}
/** Cloud-Abgleich: Stand aus einer Datei übernehmen, ohne lastChange zu setzen. */
export function importData(obj, mode) {
  mergeInto(S.data, normalize(obj), mode);
  save();
  notify();
}
/** Prüft eine Datei und liefert die normalisierten Daten (oder wirft einen Fehler). */
export function parseImport(text) {
  const d = JSON.parse(text);
  if (!d || d.format !== FORMAT) throw new Error('format');
  return normalize(d);
}
/** mode: 'merge' (neuere Fassung gewinnt) oder 'replace' */
export function applyImport(inc, mode = 'merge') {
  change((d) => mergeInto(d, inc, mode));
  return { pl: inc.players.length, gr: inc.groups.length, tr: inc.trainings.length };
}
