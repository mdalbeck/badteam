// Trainings und Anwesenheit.
// Die Liste zeigt eigene Trainings und die aus BadPlan (Termine und Trainingsslots). Beim ersten Häkchen wird ein
// BadPlan-Training hier als „erfasst“ gespeichert (mit ref auf den Termin bzw. Slot), BadPlan selbst bleibt unverändert.
import * as St from './store.js';
import * as BP from './badplan.js';
import { icon } from './icons.js';
import { t, lang } from './i18n.js';
import { $, $$, esc, toast } from './ui.js';
import { initials } from './players.js';

const loc = () => (lang() === 'de' ? 'de-DE' : 'en-GB');
export const fmtDay = (day, long = false) => new Date(`${day}T12:00:00`).toLocaleDateString(loc(), long
  ? { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' } : { weekday: 'short', day: 'numeric', month: 'numeric' });
const timeText = (x) => (x.start ? `${x.start}${x.end ? `–${x.end}` : ''}` : '');
const NEXT = ['p', 'e', 'a', null]; // Tippen: da → entschuldigt → fehlt → leer

/** Gruppe des Trainings (das erfasste Training kann eine eigene Gruppe haben) */
const groupOf = (x) => St.group(x.rec?.groupId || x.groupId);
/** Spieler, die in der Liste stehen: aktive Mitglieder der Gruppe plus alle, die schon ein Häkchen haben */
export function rosterOf(x) {
  const g = groupOf(x);
  const list = g ? St.members(g.id) : [];
  for (const pid of Object.keys(x.rec?.att || {})) { const p = St.player(pid); if (p && !list.includes(p)) list.push(p); }
  return list.sort(St.byName);
}
export function countsOf(x) {
  const c = { p: 0, e: 0, a: 0, open: 0 };
  for (const p of rosterOf(x)) { const s = x.rec?.att[p.id]; if (s) c[s]++; else c.open++; }
  return c;
}
const ended = (x) => St.todayIso() > x.day || (St.todayIso() === x.day && (x.end || '23:59') <= new Date().toTimeString().slice(0, 5));
const marked = (x) => !!x.rec && Object.keys(x.rec.att).length > 0;

/** Trainings der letzten 14 Tage, die vorbei sind und noch keine Anwesenheit haben (nur Gruppen mit Spielern) */
export function openTrainings() {
  const today = St.todayIso();
  return BP.trainingsBetween(BP.addDays(today, -14), today)
    .filter((x) => ended(x) && !marked(x) && groupOf(x) && St.members(groupOf(x).id).length)
    .reverse();
}

/** Anwesenheit eines Spielers zwischen from und to: { p, e, a, counted, list: [{ key, day, s }] } (älteste zuerst) */
export function attendanceOf(pid, from, to) {
  const out = { p: 0, e: 0, a: 0, counted: 0, list: [] };
  for (const tr of St.S.data.trainings) {
    const s = tr.att[pid];
    if (!s || tr.day < from || tr.day > to) continue;
    out[s]++; out.counted++;
    out.list.push({ key: tr.id, day: tr.day, s });
  }
  out.list.sort((a, b) => a.day.localeCompare(b.day));
  return out;
}

/** Eine Zeile in Listen (Startseite, Trainings). big = mit Knopf „Anwesenheit“ */
export function trainingRow(x, big = false) {
  const g = groupOf(x);
  const c = countsOf(x);
  const has = marked(x);
  const status = !g ? `<span class="badge warn">${esc(t('tr.noGroup'))}</span>`
    : has ? `<span class="attcount"><b>${c.p}</b> ${esc(t('tr.present'))}${c.open ? ` <span class="muted">· ${esc(t('tr.openN', { n: c.open }))}</span>` : ''}</span>`
    : ended(x) ? `<span class="badge warn">${esc(t('tr.notTaken'))}</span>` : '';
  const meta = [x.place, x.unit ? `${t('tr.plan')}: ${x.unit}` : ''].filter(Boolean);
  const href = `#/training/${encodeURIComponent(x.key)}`;
  return `<${big ? 'div' : 'a'} class="drow trrow ${big ? 'big' : ''}" ${big ? '' : `href="${href}"`}>
    <span class="dday ${big ? 'big' : ''}"><b>${esc(fmtDay(x.day))}</b><span>${esc(timeText(x))}</span></span>
    <span class="exrow-b"><b>${esc(g?.name || t('tr.noGroup'))}</b><span class="exmeta">${meta.map((m) => `<span>${esc(m)}</span>`).join('')}${x.source !== 'own' ? `<span class="srcbadge">${esc(t('tr.fromPlan'))}</span>` : ''}</span></span>
    ${status}
    ${big ? `<a class="btn primary big" href="${href}">${icon('check', 20)}<span>${esc(t(has ? 'tr.continue' : 'tr.take'))}</span></a>` : ''}
  </${big ? 'div' : 'a'}>`;
}

// ================= Liste =================
const F = { group: '', weeks: 4 };
export function trainingsView(el) {
  if (F.group && !St.group(F.group)) F.group = '';
  const render = () => {
    const today = St.todayIso();
    const all = BP.trainingsBetween(BP.addDays(today, -7 * F.weeks), BP.addDays(today, 7)).filter((x) => !F.group || groupOf(x)?.id === F.group);
    const soon = all.filter((x) => x.day > today);
    const now = all.filter((x) => x.day === today);
    const past = all.filter((x) => x.day < today).reverse();
    const groups = St.groupsSorted();
    const noSource = !BP.cached() && !St.S.data.trainings.length;
    el.innerHTML = `
      <div class="pagehead">
        <h1><span class="eyebrow">${esc(t('tr.eyebrow'))}</span>${esc(t('nav.trainings'))}</h1>
        <div class="acts"><a class="btn primary" id="tr-new" href="#/training/new${F.group ? `/${F.group}` : ''}">${icon('plus', 18)}<span>${esc(t('tr.new'))}</span><kbd>N</kbd></a></div>
      </div>
      ${groups.length > 1 ? `<div class="fgroup plfilter"><button class="gfilter ${F.group ? '' : 'on'}" data-g="">${esc(t('pl.allGroups'))}</button>
        ${groups.map((g) => `<button class="gfilter ${F.group === g.id ? 'on' : ''}" data-g="${g.id}">${esc(g.name)}</button>`).join('')}</div>` : ''}
      ${noSource ? `<p class="note">${icon('cloud', 16)}<span>${esc(t('tr.noSource'))} <a href="#/backup">${esc(t('nav.backup'))}</a></span></p>` : ''}
      ${now.length ? `<h3 class="exgroup-h">${esc(t('tr.today'))}</h3><div class="dlist">${now.map((x) => trainingRow(x, true)).join('')}</div>` : ''}
      ${soon.length ? `<h3 class="exgroup-h">${esc(t('tr.soon'))}</h3><div class="dlist">${soon.map((x) => trainingRow(x)).join('')}</div>` : ''}
      <h3 class="exgroup-h">${esc(t('tr.past'))}</h3>
      ${past.length ? `<div class="dlist">${past.map((x) => trainingRow(x)).join('')}</div>` : `<p class="empty muted">${esc(t('tr.nonePast'))}</p>`}
      <p><button class="sm" id="tr-more">${icon('down', 16)}<span>${esc(t('tr.more'))}</span></button></p>`;
    $$('[data-g]', el).forEach((b) => { b.onclick = () => { F.group = b.dataset.g; render(); }; });
    $('#tr-more', el).onclick = () => { F.weeks += 8; render(); };
  };
  render();
  return {
    refresh: render,
    key(e) { if (e.key === 'n' || e.key === 'N') { location.hash = $('#tr-new', el).getAttribute('href'); return true; } return false; },
  };
}

// ================= Anwesenheit =================
export function trainingView(el, key) {
  let showAll = false;
  /** Erfasstes Training holen oder (beim ersten Häkchen) anlegen */
  const ensure = (x, patch = {}) => x.rec?.id || St.addTraining({ day: x.day, start: x.start, end: x.end, groupId: x.groupId, place: x.place, ref: x.ref, ...patch });
  const render = () => {
    const x = BP.trainingByKey(key);
    if (!x) { el.innerHTML = `<div class="pagehead"><a class="back" href="#/trainings">${icon('back', 16)}${esc(t('nav.trainings'))}</a></div><p class="empty muted">${esc(t('tr.notFound'))}</p>`; return; }
    const g = groupOf(x);
    const roster = rosterOf(x);
    const c = countsOf(x);
    const att = x.rec?.att || {};
    const groups = St.groupsSorted();
    const others = showAll && g ? St.S.data.players.filter((p) => p.active && !roster.includes(p)).sort(St.byName) : [];
    const row = (p) => {
      const s = att[p.id] || '';
      return `<button class="attrow ${s ? `is-${s}` : ''}" data-p="${p.id}" aria-label="${esc(p.name)}: ${esc(s ? t(`att.${s}`) : t('att.none'))}">
        <span class="avatar">${esc(initials(p.name))}</span>
        <span class="attname"><b>${esc(p.name)}</b>${p.injuries ? `<small class="warn-t">${icon('alert', 12)}${esc(p.injuries.split('\n')[0])}</small>` : ''}${g && !p.groups.includes(g.id) ? `<small class="muted">${esc(t('tr.otherGroup'))}</small>` : ''}</span>
        <span class="attpill">${s ? esc(t(`att.${s}`)) : '–'}</span></button>`;
    };
    el.innerHTML = `
      <div class="pagehead">
        <a class="back" href="#/trainings">${icon('back', 16)}${esc(t('nav.trainings'))}<kbd>Esc</kbd></a>
        <h1><span class="eyebrow">${esc(fmtDay(x.day, true))}${timeText(x) ? ` · ${esc(timeText(x))}` : ''}${x.place ? ` · ${esc(x.place)}` : ''}</span>${esc(g?.name || t('tr.noGroup'))}</h1>
        <div class="acts">
          ${x.rec ? `<a class="btn" id="tr-print" href="#/print/training/${encodeURIComponent(x.rec.id)}">${icon('printer', 18)}<span>${esc(t('pr.print'))}</span><kbd>D</kbd></a>` : ''}
          ${x.source === 'own' ? `<a class="btn" href="#/training/${encodeURIComponent(x.rec.id)}/edit">${icon('edit', 18)}<span>${esc(t('tr.edit'))}</span></a>` : ''}
          ${x.rec ? `<button class="danger ghost" id="tr-del">${icon('trash', 18)}<span>${esc(t(x.source === 'own' ? 'tr.del' : 'tr.reset'))}</span></button>` : ''}
        </div>
      </div>
      ${x.unit ? `<p class="muted">${esc(t('tr.plan'))}: <b>${esc(x.unit)}</b>${x.ref?.startsWith('pd:') ? ` · <a href="${BP.dateUrl(x.ref.slice(3))}" target="_blank" rel="noopener">${esc(t('tr.openPlan'))}</a>` : ''}</p>` : ''}
      ${!g ? `<section class="panel"><h2>${esc(t('tr.pickGroup'))}</h2><p class="muted small">${esc(t('tr.pickGroupText'))}</p>
        ${groups.length ? `<div class="chips">${groups.map((gg) => `<button class="sm" data-setg="${gg.id}">${esc(gg.name)}</button>`).join('')}</div>` : `<p><a class="btn" href="#/groups">${esc(t('nav.groups'))}</a></p>`}</section>` : `
      <div class="attbar" role="status">
        <span class="ab-p"><b>${c.p}</b> ${esc(t('tr.present'))}</span>
        <span class="ab-e"><b>${c.e}</b> ${esc(t('att.e'))}</span>
        <span class="ab-a"><b>${c.a}</b> ${esc(t('att.a'))}</span>
        ${c.open ? `<span class="ab-o"><b>${c.open}</b> ${esc(t('tr.open'))}</span>` : `<span class="ab-done">${icon('check', 16)} ${esc(t('tr.complete'))}</span>`}
      </div>
      ${roster.length ? `<p class="muted small">${esc(t('tr.tapHint'))}</p>
        <div class="attlist">${roster.map(row).join('')}</div>
        <div class="dlg-actions attacts">
          ${c.open ? `<button class="primary" id="tr-all">${icon('check', 18)}<span>${esc(t(c.p + c.e + c.a ? 'tr.restIn' : 'tr.allIn'))}</span><kbd>A</kbd></button>
            ${c.p + c.e + c.a ? `<button id="tr-restout">${icon('x', 18)}<span>${esc(t('tr.restOut'))}</span></button>` : ''}` : ''}
          <span class="grow"></span>
          <button class="ghost" id="tr-others">${icon(showAll ? 'up' : 'userplus', 18)}<span>${esc(t(showAll ? 'tr.hideOthers' : 'tr.showOthers'))}</span></button>
        </div>
        ${others.length ? `<h3 class="exgroup-h">${esc(t('tr.others'))}</h3><div class="attlist">${others.map(row).join('')}</div>` : ''}`
        : `<div class="emptybig">${icon('users', 40)}<h2>${esc(t('tr.emptyGroup'))}</h2><p>${esc(t('tr.emptyGroupText'))}</p><p><a class="btn primary" href="#/group/${g.id}">${esc(t('tr.toGroup', { name: g.name }))}</a></p></div>`}
      <label class="trnote">${esc(t('tr.note'))}<textarea id="tr-note" rows="2" placeholder="${esc(t('tr.notePh'))}">${esc(x.rec?.note || '')}</textarea></label>`}`;

    $$('[data-p]', el).forEach((b) => {
      b.onclick = () => {
        const cur = BP.trainingByKey(key);
        const s = cur?.rec?.att[b.dataset.p] || null;
        const next = NEXT[(NEXT.indexOf(s) + 1) % NEXT.length];
        St.setAtt(ensure(cur), b.dataset.p, next);
      };
    });
    $$('[data-setg]', el).forEach((b) => { b.onclick = () => { const id = ensure(x, { groupId: b.dataset.setg }); St.updateTraining(id, { groupId: b.dataset.setg }); }; });
    const all = $('#tr-all', el);
    if (all) all.onclick = () => markRest('p');
    const out = $('#tr-restout', el);
    if (out) out.onclick = () => markRest('a');
    const oth = $('#tr-others', el);
    if (oth) oth.onclick = () => { showAll = !showAll; render(); };
    const note = $('#tr-note', el);
    if (note) note.onchange = () => { const cur = BP.trainingByKey(key); St.updateTraining(ensure(cur), { note: note.value.trim() }); };
    const del = $('#tr-del', el);
    if (del) del.onclick = () => {
      if (!confirm(t(x.source === 'own' ? 'tr.delConfirm' : 'tr.resetConfirm'))) return;
      St.deleteTraining(x.rec.id);
      if (x.source === 'own') location.hash = '#/trainings';
    };
  };
  const markRest = (s) => {
    const x = BP.trainingByKey(key);
    if (!x) return;
    const open = rosterOf(x).filter((p) => !x.rec?.att[p.id]).map((p) => p.id);
    if (open.length) St.setAttMany(ensure(x), open, s);
  };
  render();
  return {
    refresh: () => { if (document.activeElement?.id !== 'tr-note') render(); },
    key(e) {
      if (e.key === 'Escape') { location.hash = '#/trainings'; return true; }
      if (e.key === 'a' || e.key === 'A') { markRest('p'); return true; }
      if ((e.key === 'd' || e.key === 'D') && $('#tr-print', el)) { location.hash = $('#tr-print', el).getAttribute('href'); return true; }
      return false;
    },
  };
}

// ================= Eigenes Training anlegen / bearbeiten =================
export function trainingFormView(el, id, groupId = null) {
  const src = id ? St.training(id) : null;
  if (id && (!src || src.ref)) { el.innerHTML = `<div class="pagehead"><a class="back" href="#/trainings">${icon('back', 16)}${esc(t('nav.trainings'))}</a></div><p class="empty muted">${esc(t('tr.notFound'))}</p>`; return {}; }
  const x = src || { day: St.todayIso(), start: '', end: '', groupId: St.group(groupId) ? groupId : St.groupsSorted()[0]?.id || '', place: '' };
  const backTo = id ? `#/training/${id}` : '#/trainings';
  const groups = St.groupsSorted();
  el.innerHTML = `
    <form id="trf" class="exform" novalidate>
      <div class="pagehead">
        <a class="back" href="${backTo}">${icon('back', 16)}${esc(t('nav.trainings'))}<kbd>Esc</kbd></a>
        <h1><span class="eyebrow">${esc(t('tr.eyebrow'))}</span>${esc(t(id ? 'tr.editTitle' : 'tr.newTitle'))}</h1>
        <div class="acts">
          <button type="button" class="ghost" id="trf-no">${esc(t('ex.cancel'))}</button>
          <button type="submit" class="primary">${icon('check', 18)}<span>${esc(t(id ? 'ex.save' : 'tr.createGo'))}</span><kbd>${esc(t('key.ctrl'))} + ↵</kbd></button>
        </div>
      </div>
      <section class="panel narrow">
        <p class="muted small">${esc(t('tr.ownHint'))}</p>
        <label>${esc(t('tr.day'))}<input name="day" type="date" value="${esc(x.day)}" required></label>
        <div class="row2">
          <label>${esc(t('tr.start'))}<input name="start" type="time" value="${esc(x.start)}"></label>
          <label>${esc(t('tr.end'))}<input name="end" type="time" value="${esc(x.end)}"></label>
        </div>
        <label>${esc(t('tr.group'))}<select name="group">${groups.map((g) => `<option value="${g.id}" ${g.id === x.groupId ? 'selected' : ''}>${esc(g.name)}</option>`).join('')}</select></label>
        ${groups.length ? '' : `<p class="note">${icon('alert', 16)}<span>${esc(t('tr.needGroup'))} <a href="#/groups">${esc(t('nav.groups'))}</a></span></p>`}
        <label>${esc(t('tr.place'))}<input name="place" value="${esc(x.place)}" autocomplete="off"></label>
      </section>
    </form>`;
  const f = $('#trf', el);
  const read = () => ({ day: f.day.value, start: f.start.value, end: f.end.value, groupId: f.group.value, place: f.place.value });
  const initial = JSON.stringify(read());
  let saved = false;
  const save = () => {
    const v = read();
    if (!v.day) { toast(t('tr.dayMissing')); f.day.focus(); return; }
    if (!v.groupId) { toast(t('tr.needGroup')); return; }
    saved = true;
    if (id) { St.updateTraining(id, { ...v, place: v.place.trim() }); location.hash = `#/training/${id}`; return; }
    location.hash = `#/training/${St.addTraining(v)}`;
  };
  $('#trf-no', el).onclick = () => { location.hash = backTo; };
  f.onsubmit = (ev) => { ev.preventDefault(); save(); };
  f.onkeydown = (ev) => { if (ev.key === 'Enter' && !(ev.ctrlKey || ev.metaKey) && ev.target.tagName === 'INPUT') ev.preventDefault(); };
  const dirty = () => !saved && JSON.stringify(read()) !== initial;
  return {
    canLeave: () => !dirty() || confirm(t('ex.leaveConfirm')),
    isDirty: dirty,
    submit: save,
    key(e) { if (e.key === 'Escape') { location.hash = backTo; return true; } return false; },
  };
}
