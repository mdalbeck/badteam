// Brücke zu BadPlan: liest BadPlans Daten (Gruppen, Termine, Trainingsslots, Ferien) aus dem gemeinsamen Dropbox-Ordner.
// BadTeam schreibt nie in BadPlans Datei. Gruppen, die es nur in BadPlan gibt, übernimmt BadTeam mit derselben ID.
import * as St from './store.js';
import * as Sync from './sync.js';

export const BADPLAN_URL = 'https://badplan.mpdalbeck.workers.dev/';
const CACHE_KEY = 'badplanCache';
let data = null; // { groups, slots, pauses, dates, units, rev, at }
let loading = null;
let say = () => {};

export const dateUrl = (id) => `${BADPLAN_URL}#/date/${encodeURIComponent(id)}`;

/** BadPlan-Daten holen (aus Dropbox, nur wenn sich die Datei geändert hat; sonst die zuletzt geholte Fassung). */
export async function load(force = false) {
  if (loading) return loading;
  loading = (async () => {
    if (!data) data = (await St.getKey(CACHE_KEY)) || null;
    if (Sync.Y.state === 'ok') {
      try {
        const p = await Sync.DBX.peek(Sync.DBX.BADPLAN_FILE);
        if (p && (force || p.version !== data?.rev)) {
          const obj = JSON.parse(await p.load());
          // Nur das, was BadTeam braucht (Einheiten nur mit Namen)
          data = {
            groups: (obj.groups || []).map((g) => ({ id: g.id, name: g.name })),
            slots: obj.slots || [], pauses: obj.pauses || [],
            dates: (obj.dates || []).map((d) => ({ id: d.id, day: d.day, start: d.start, end: d.end, groupId: d.groupId || null, place: d.place || '', slotId: d.slotId || null, unitId: d.unitId, players: d.players || 0 })),
            units: (obj.units || []).map((u) => ({ id: u.id, name: u.name })),
            rev: p.version, at: Date.now(),
          };
          await St.setKey(CACHE_KEY, data);
        }
      } catch (e) { console.error('BadPlan-Daten', e); }
    }
    if (data) {
      const n = St.adoptGroups(data.groups);
      if (n) say(n);
    }
    loading = null;
    St.notify();
    return data;
  })();
  return loading;
}
export const cached = () => data;
export function init({ adopted } = {}) {
  if (adopted) say = adopted;
  Sync.afterSync(() => load());
  return load();
}

// ---------- Tage ----------
const parse = (day) => new Date(`${day}T12:00:00`);
export const addDays = (day, n) => { const d = parse(day); d.setDate(d.getDate() + n); return St.iso(d); };
const weekday = (day) => ((parse(day).getDay() + 6) % 7) + 1; // 1 = Montag
const pauseOn = (day) => data?.pauses.find((p) => p.from <= day && day <= p.to) || null;
export const unitName = (id) => data?.units.find((u) => u.id === id)?.name || '';

/**
 * Alle Trainings zwischen from und to (einschließlich): eigene, erfasste und die aus BadPlan (Termine und Slots).
 * Jedes Element: { key, rec, ref, day, start, end, groupId, place, unit, source: 'own' | 'date' | 'slot' }
 * key ist die Adresse der Anwesenheits-Seite: die ID des erfassten Trainings oder die ref.
 */
export function trainingsBetween(from, to) {
  const out = new Map(); // ref oder id → Eintrag
  const put = (key, x) => { if (!out.has(key)) out.set(key, x); };
  // Erfasste Trainings zuerst – sie gewinnen gegenüber den BadPlan-Daten
  for (const rec of St.S.data.trainings) {
    if (rec.day < from || rec.day > to) continue;
    put(rec.ref || rec.id, { key: rec.id, rec, ref: rec.ref, day: rec.day, start: rec.start, end: rec.end, groupId: rec.groupId, place: rec.place,
      unit: rec.ref?.startsWith('pd:') ? unitName(data?.dates.find((d) => `pd:${d.id}` === rec.ref)?.unitId) : '', source: rec.ref ? (rec.ref.startsWith('pd:') ? 'date' : 'slot') : 'own' });
  }
  if (data) {
    for (const d of data.dates) {
      if (d.day < from || d.day > to) continue;
      const ref = d.slotId ? `ps:${d.slotId}:${d.day}` : `pd:${d.id}`;
      const slotRec = out.get(ref);
      if (slotRec) { if (!slotRec.unit) slotRec.unit = unitName(d.unitId); continue; }
      put(ref, { key: ref, rec: null, ref, day: d.day, start: d.start, end: d.end, groupId: d.groupId, place: d.place, unit: unitName(d.unitId), source: d.slotId ? 'slot' : 'date' });
    }
    if (data.slots.length) {
      for (let day = from; day <= to; day = addDays(day, 1)) {
        const wd = weekday(day);
        if (pauseOn(day)) continue;
        for (const s of data.slots) {
          if (s.weekday !== wd || (s.skips || []).includes(day)) continue;
          const ref = `ps:${s.id}:${day}`;
          put(ref, { key: ref, rec: null, ref, day, start: s.start, end: s.end, groupId: s.groupId || null, place: s.place || '', unit: '', source: 'slot' });
        }
      }
    }
  }
  return [...out.values()].sort((a, b) => (a.day + (a.start || '')).localeCompare(b.day + (b.start || '')));
}

/** Ein Training über seine Adresse finden (ID eines erfassten Trainings oder ref aus BadPlan) */
export function trainingByKey(key) {
  const rec = St.training(key) || St.trainingByRef(key);
  if (rec) return trainingsBetween(rec.day, rec.day).find((x) => x.rec === rec) || null;
  const m = /^ps:(.+):(\d{4}-\d{2}-\d{2})$/.exec(key) || /^pd:(.+)$/.exec(key);
  if (!m) return null;
  const day = m[2] || data?.dates.find((d) => d.id === m[1])?.day;
  return day ? trainingsBetween(day, day).find((x) => x.key === key) || null : null;
}
