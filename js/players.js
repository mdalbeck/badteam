// Spieler: Liste mit Suche und Gruppenfilter, Detailseite, Formular.
// Kontakt: unter 18 (oder ohne Geburtstag) zusätzlich die Eltern; ab 18 nur der Spieler selbst.
import * as St from './store.js';
import { icon } from './icons.js';
import { t, lang } from './i18n.js';
import { $, $$, esc, toast } from './ui.js';
import { attendanceOf, fmtDay } from './trainings.js';

const F = { q: '', group: '', inactive: false };
const loc = () => (lang() === 'de' ? 'de-DE' : 'en-GB');
export const fmtBirthday = (b) => (b ? new Date(`${b}T12:00:00`).toLocaleDateString(loc(), { day: 'numeric', month: 'long', year: 'numeric' }) : '');
export const ageText = (p) => { const a = St.age(p.birthday); return a == null ? '' : t('pl.years', { n: a }); };
const handText = (h) => (h ? t(`pl.hand.${h}`) : '–');
export const groupTags = (p) => p.groups.map((g) => St.group(g)).filter(Boolean).sort(St.byName)
  .map((g) => `<span class="tag">${esc(g.name)}</span>`).join('');

/** Geburtstage in den nächsten n Tagen (heute eingeschlossen): [{ p, day, turns }] */
export function birthdaysSoon(n) {
  const today = St.todayIso(), out = [];
  for (const p of St.S.data.players) {
    if (!p.active || !p.birthday) continue;
    const y = +today.slice(0, 4);
    for (const yy of [y, y + 1]) {
      let day = `${yy}${p.birthday.slice(4)}`;
      if (day.endsWith('02-29') && new Date(`${day}T12:00:00`).getMonth() !== 1) day = `${yy}-03-01`; // 29. Februar
      const diff = Math.round((new Date(`${day}T12:00:00`) - new Date(`${today}T12:00:00`)) / 864e5);
      if (diff >= 0 && diff < n) { out.push({ p, day, turns: yy - +p.birthday.slice(0, 4) }); break; }
    }
  }
  return out.sort((a, b) => a.day.localeCompare(b.day));
}

// ================= Liste =================
const norm = (s) => s.toLocaleLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
function matches(p) {
  if (!F.inactive && !p.active) return false;
  if (F.group === '-' ? p.groups.some((g) => St.group(g)) : F.group && !p.groups.includes(F.group)) return false;
  if (!F.q) return true;
  const hay = norm([p.name, p.note, p.injuries, ...p.groups.map((g) => St.group(g)?.name || '')].join(' '));
  return norm(F.q).split(/\s+/).every((w) => hay.includes(w));
}
export function playerRow(p, extra = '') {
  return `<a class="exrow plrow ${p.active ? '' : 'inactive'}" href="#/player/${p.id}">
    <span class="avatar">${esc(initials(p.name))}</span>
    <span class="exrow-b"><b>${esc(p.name || t('pl.noName'))}</b><span class="exmeta">${p.birthday ? `<span>${esc(ageText(p))}</span>` : ''}${p.hand === 'left' ? `<span>${esc(t('pl.hand.left'))}</span>` : ''}${p.active ? '' : `<span class="badge">${esc(t('pl.paused'))}</span>`}${p.injuries ? `<span class="warn-t">${icon('alert', 13)}${esc(t('pl.injuryShort'))}</span>` : ''}</span>
      ${p.groups.length ? `<span class="tags">${groupTags(p)}</span>` : ''}</span>${extra}</a>`;
}
export const initials = (name) => (name || '?').trim().split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';

export function playersView(el) {
  if (F.group && F.group !== '-' && !St.group(F.group)) F.group = '';
  const render = () => {
    const all = St.S.data.players;
    if (!all.length) {
      el.innerHTML = `
        <div class="pagehead"><h1><span class="eyebrow">${esc(t('pl.eyebrow'))}</span>${esc(t('nav.players'))}</h1></div>
        <div class="emptybig">${icon('user', 44)}<h2>${esc(t('pl.emptyTitle'))}</h2><p>${esc(t('pl.emptyText'))}</p>
          <p><a class="btn primary big" id="pl-new" href="#/player/new">${icon('plus', 20)}<span>${esc(t('pl.new'))}</span><kbd>N</kbd></a></p></div>`;
      return;
    }
    const groups = St.groupsSorted();
    const paused = all.filter((p) => !p.active).length;
    el.innerHTML = `
      <div class="pagehead">
        <h1><span class="eyebrow">${esc(t('pl.eyebrow'))}</span>${esc(t('nav.players'))}</h1>
        <div class="acts"><a class="btn primary" id="pl-new" href="#/player/new${F.group && F.group !== '-' ? `/${F.group}` : ''}">${icon('plus', 18)}<span>${esc(t('pl.new'))}</span><kbd>N</kbd></a></div>
      </div>
      <div class="toolbar">
        <label class="field">${icon('search', 18)}<input id="pl-q" type="search" value="${esc(F.q)}" placeholder="${esc(t('pl.search'))}" autocomplete="off"><kbd>/</kbd></label>
      </div>
      <div class="fgroup plfilter">
        <button class="gfilter ${F.group ? '' : 'on'}" data-g="">${esc(t('pl.allGroups'))}</button>
        ${groups.map((g) => `<button class="gfilter ${F.group === g.id ? 'on' : ''}" data-g="${g.id}">${esc(g.name)}</button>`).join('')}
        ${all.some((p) => !p.groups.some((g) => St.group(g))) ? `<button class="gfilter ${F.group === '-' ? 'on' : ''}" data-g="-">${esc(t('pl.noGroup'))}</button>` : ''}
        ${paused ? `<label class="switch"><input type="checkbox" id="pl-inactive" ${F.inactive ? 'checked' : ''}><i></i><span>${esc(t('pl.showPaused', { n: paused }))}</span></label>` : ''}
      </div>
      <div id="pl-list"></div>`;
    renderList();
    const q = $('#pl-q', el);
    q.oninput = () => { F.q = q.value.trim(); renderList(); };
    q.onkeydown = (e) => { if (e.key === 'Escape') { q.value = ''; F.q = ''; renderList(); q.blur(); } };
    $$('[data-g]', el).forEach((b) => { b.onclick = () => { F.group = b.dataset.g; render(); }; });
    const ia = $('#pl-inactive', el);
    if (ia) ia.onchange = () => { F.inactive = ia.checked; renderList(); };
  };
  const renderList = () => {
    const shown = St.S.data.players.filter(matches).sort(St.byName);
    $('#pl-list', el).innerHTML = `<p class="muted small excount">${esc(shown.length === 1 ? t('pl.count1') : t('pl.count', { n: shown.length }))}</p>
      ${shown.length ? `<div class="exlist">${shown.map((p) => playerRow(p)).join('')}</div>` : `<p class="empty muted">${esc(t('pl.none'))}</p>`}`;
  };
  render();
  return {
    refresh: () => { if (!$('#pl-q', el) || document.activeElement !== $('#pl-q', el)) render(); else renderList(); },
    key(e) {
      if (e.key === 'n' || e.key === 'N') { location.hash = $('#pl-new', el)?.getAttribute('href') || '#/player/new'; return true; }
      if (e.key === '/') { $('#pl-q', el)?.focus(); return true; }
      return false;
    },
  };
}

// ================= Detail =================
export function playerView(el, id) {
  const render = () => {
    const p = St.player(id);
    if (!p) { el.innerHTML = `<div class="pagehead"><a class="back" href="#/players">${icon('back', 16)}${esc(t('nav.players'))}</a></div><p class="empty muted">${esc(t('pl.notFound'))}</p>`; return; }
    const adult = St.isAdult(p);
    const contact = (label, v, kind) => (v ? `<dt>${esc(label)}</dt><dd class="sel">${kind === 'mail' ? `<a href="mailto:${esc(v)}">${esc(v)}</a>` : esc(v)}</dd>` : '');
    const own = contact(t('pl.phone'), p.phone) + contact(t('pl.email'), p.email, 'mail');
    const par = adult ? '' : contact(t('pl.parentName'), p.parentName) + contact(t('pl.parentPhone'), p.parentPhone) + contact(t('pl.parentEmail'), p.parentEmail, 'mail');
    const a = attendanceOf(p.id, St.iso(new Date(Date.now() - 182 * 864e5)), St.todayIso());
    el.innerHTML = `
      <div class="pagehead">
        <a class="back" href="#/players">${icon('back', 16)}${esc(t('nav.players'))}<kbd>Esc</kbd></a>
        <h1><span class="eyebrow">${p.groups.length ? `<span class="tags">${groupTags(p)}</span>` : esc(t('pl.eyebrow'))}</span>${esc(p.name || t('pl.noName'))}${p.active ? '' : ` <span class="badge">${esc(t('pl.paused'))}</span>`}</h1>
        <div class="acts">
          <a class="btn primary" id="pl-edit" href="#/player/${p.id}/edit">${icon('edit', 18)}<span>${esc(t('pl.edit'))}</span><kbd>E</kbd></a>
          <button id="pl-act">${icon(p.active ? 'pausec' : 'play', 18)}<span>${esc(t(p.active ? 'pl.pause' : 'pl.activate'))}</span></button>
          <button class="danger ghost" id="pl-del">${icon('trash', 18)}<span>${esc(t('pl.del'))}</span></button>
        </div>
      </div>
      <div class="exdetail">
        <div class="exmain">
          ${p.injuries ? `<section class="panel injury"><h2>${icon('alert', 20)} ${esc(t('pl.injuries'))}</h2><p class="pre">${esc(p.injuries)}</p></section>` : ''}
          <section class="panel">
            <h2>${icon('phone', 20)} ${esc(t('pl.contact'))}</h2>
            ${own || par ? `<dl class="facts">${par}${own}</dl>` : `<p class="muted">${esc(t('pl.noContact'))}</p>`}
            ${adult ? `<p class="muted small">${esc(t('pl.adultHint'))}</p>` : ''}
          </section>
          <section class="panel">
            <h2>${icon('check', 20)} ${esc(t('pl.attTitle'))}</h2>
            ${a.counted ? `<p><b class="bigpct">${Math.round((a.p / a.counted) * 100)} %</b> <span class="muted">${esc(t('st.ofLine', { p: a.p, n: a.counted }))}${a.e ? ` · ${esc(t('st.excusedN', { n: a.e }))}` : ''}</span></p>
              <div class="attstrip">${a.list.slice(-20).map((x) => `<a href="#/training/${encodeURIComponent(x.key)}" class="att-${x.s}" title="${esc(fmtDay(x.day))}: ${esc(t(`att.${x.s}`))}"></a>`).join('')}</div>
              <p class="muted small">${esc(t('pl.attHint'))}</p>` : `<p class="muted">${esc(t('pl.attNone'))}</p>`}
          </section>
          ${p.note ? `<section class="panel"><h2>${icon('note', 20)} ${esc(t('pl.note'))}</h2><p class="pre">${esc(p.note)}</p></section>` : ''}
        </div>
        <aside class="panel exfacts">
          <dl>
            <dt>${esc(t('pl.birthday'))}</dt><dd>${p.birthday ? `${esc(fmtBirthday(p.birthday))}<br><span class="muted small">${esc(ageText(p))} · ${esc(t('pl.yob', { y: p.birthday.slice(0, 4) }))}</span>` : '–'}</dd>
            <dt>${esc(t('pl.hand'))}</dt><dd>${esc(handText(p.hand))}</dd>
            <dt>${esc(t('nav.groups'))}</dt><dd>${p.groups.map((g) => St.group(g)).filter(Boolean).map((g) => `<a href="#/group/${g.id}">${esc(g.name)}</a>`).join(', ') || '–'}</dd>
            <dt>${esc(t('pl.status'))}</dt><dd>${esc(t(p.active ? 'pl.active' : 'pl.paused'))}</dd>
          </dl>
        </aside>
      </div>`;
    $('#pl-act', el).onclick = () => { St.updatePlayer(id, { active: !p.active }); toast(t(p.active ? 'pl.pausedToast' : 'pl.activeToast', { name: p.name })); };
    $('#pl-del', el).onclick = () => {
      if (!confirm(t('pl.delConfirm', { name: p.name }))) return;
      const undo = St.deletePlayer(id);
      location.hash = '#/players';
      toast(t('pl.deleted', { name: p.name }), t('pl.undo'), undo);
    };
  };
  render();
  return {
    refresh: render,
    key(e) {
      if (e.key === 'Escape') { location.hash = '#/players'; return true; }
      if ((e.key === 'e' || e.key === 'E') && St.player(id)) { location.hash = `#/player/${id}/edit`; return true; }
      return false;
    },
  };
}

// ================= Formular =================
export function playerFormView(el, id, groupId = null) {
  const src = id ? St.player(id) : null;
  if (id && !src) { el.innerHTML = `<div class="pagehead"><a class="back" href="#/players">${icon('back', 16)}${esc(t('nav.players'))}</a></div><p class="empty muted">${esc(t('pl.notFound'))}</p>`; return {}; }
  // groupId: eine Gruppe aus der Adresse (#/player/new/<Gruppe>) oder eine Liste (beim „Speichern + nächster“)
  const pre = Array.isArray(groupId) ? groupId.filter((g) => St.group(g)) : St.group(groupId) ? [groupId] : [];
  const p = src || { active: true, groups: pre };
  const backTo = id ? `#/player/${id}` : !Array.isArray(groupId) && St.group(groupId) ? `#/group/${groupId}` : '#/players';
  const groups = St.groupsSorted();
  el.innerHTML = `
    <form id="plf" class="exform" novalidate>
      <div class="pagehead">
        <a class="back" href="${backTo}">${icon('back', 16)}${esc(id ? p.name : t('nav.players'))}<kbd>Esc</kbd></a>
        <h1><span class="eyebrow">${esc(t('pl.eyebrow'))}</span>${esc(t(id ? 'pl.editTitle' : 'pl.newTitle'))}</h1>
        <div class="acts">
          <button type="button" class="ghost" id="plf-no">${esc(t('ex.cancel'))}</button>
          ${id ? '' : `<button type="button" id="plf-more">${icon('plus', 18)}<span>${esc(t('pl.saveMore'))}</span></button>`}
          <button type="submit" class="primary">${icon('check', 18)}<span>${esc(t('ex.save'))}</span><kbd>${esc(t('key.ctrl'))} + ↵</kbd></button>
        </div>
      </div>
      <div class="exform-grid">
        <section class="panel">
          <label>${esc(t('pl.name'))}<input name="name" class="bigname" value="${esc(p.name)}" placeholder="${esc(t('pl.namePh'))}" autocomplete="off" required></label>
          <div class="row2">
            <label>${esc(t('pl.birthday'))}<input name="birthday" type="date" value="${esc(p.birthday)}" max="${St.todayIso()}"></label>
            <div><div class="lbl">${esc(t('pl.hand'))}</div><div class="seg" id="plf-hand">${['right', 'left', ''].map((h) => `<button type="button" data-hand="${h}" class="${(p.hand || '') === h ? 'on' : ''}">${esc(h ? t(`pl.hand.${h}`) : '–')}</button>`).join('')}</div></div>
          </div>
          <p class="muted small hint" id="plf-age"></p>
          <div class="lbl">${esc(t('nav.groups'))}</div>
          ${groups.length ? `<div class="chips">${groups.map((g) => `<label class="pick"><input type="checkbox" name="groups" value="${g.id}" ${p.groups.includes(g.id) ? 'checked' : ''}><span>${esc(g.name)}</span></label>`).join('')}</div>`
            : `<p class="muted small">${esc(t('pl.noGroupsYet'))} <a href="#/groups">${esc(t('nav.groups'))}</a></p>`}
          <label class="switch courtsw"><input type="checkbox" name="active" ${p.active !== false ? 'checked' : ''}><i></i><span>${esc(t('pl.activeSw'))}</span></label>
          <label>${esc(t('pl.injuries'))}<textarea name="injuries" rows="3" placeholder="${esc(t('pl.injuriesPh'))}">${esc(p.injuries)}</textarea></label>
          <label>${esc(t('pl.note'))}<textarea name="note" rows="4" placeholder="${esc(t('pl.notePh'))}">${esc(p.note)}</textarea></label>
        </section>
        <section class="panel">
          <h2>${icon('phone', 20)} ${esc(t('pl.contact'))}</h2>
          <div id="plf-parents">
            <p class="muted small">${esc(t('pl.parentsHint'))}</p>
            <label>${esc(t('pl.parentName'))}<input name="parentName" value="${esc(p.parentName)}" autocomplete="off"></label>
            <div class="row2">
              <label>${esc(t('pl.parentPhone'))}<input name="parentPhone" type="tel" value="${esc(p.parentPhone)}" autocomplete="off"></label>
              <label>${esc(t('pl.parentEmail'))}<input name="parentEmail" type="email" value="${esc(p.parentEmail)}" autocomplete="off"></label>
            </div>
          </div>
          <p class="muted small" id="plf-adult">${esc(t('pl.adultFormHint'))}</p>
          <div class="row2">
            <label>${esc(t('pl.phone'))}<input name="phone" type="tel" value="${esc(p.phone)}" autocomplete="off"></label>
            <label>${esc(t('pl.email'))}<input name="email" type="email" value="${esc(p.email)}" autocomplete="off"></label>
          </div>
          <p class="muted small">${esc(t('pl.privacy'))}</p>
        </section>
      </div>
    </form>`;
  const f = $('#plf', el);
  let hand = p.hand || '';
  $$('[data-hand]', f).forEach((b) => { b.onclick = () => { hand = b.dataset.hand; $$('[data-hand]', f).forEach((x) => x.classList.toggle('on', x === b)); }; });
  const syncAge = () => {
    const a = St.age(f.birthday.value);
    const adult = (a ?? 0) >= 18;
    $('#plf-age', el).textContent = a == null ? '' : t('pl.ageLine', { n: a, y: f.birthday.value.slice(0, 4) });
    $('#plf-parents', el).classList.toggle('hidden', adult);
    $('#plf-adult', el).classList.toggle('hidden', !adult);
  };
  f.birthday.oninput = syncAge;
  syncAge();

  const read = () => ({
    name: f.name.value, birthday: f.birthday.value, hand, active: f.active.checked,
    groups: $$('input[name=groups]:checked', f).map((c) => c.value),
    injuries: f.injuries.value, note: f.note.value, phone: f.phone.value, email: f.email.value,
    parentName: f.parentName.value, parentPhone: f.parentPhone.value, parentEmail: f.parentEmail.value,
  });
  const initial = JSON.stringify(read());
  let saved = false;
  const dirty = () => !saved && JSON.stringify(read()) !== initial;
  const save = (more) => {
    const x = read();
    if (!x.name.trim()) { toast(t('pl.nameMissing')); f.name.focus(); return; }
    saved = true;
    if (id) { St.updatePlayer(id, x); toast(t('pl.saved')); location.hash = `#/player/${id}`; return; }
    const nid = St.addPlayer(x);
    if (more) {
      toast(t('pl.savedNamed', { name: x.name.trim() }), t('pl.open'), () => (location.hash = `#/player/${nid}`));
      // Formular leeren, Gruppen behalten – praktisch, um eine ganze Gruppe nacheinander einzutragen
      Object.assign(api, playerFormView(el, null, x.groups));
      return;
    }
    toast(t('pl.saved'));
    location.hash = `#/player/${nid}`;
  };
  $('#plf-no', el).onclick = () => { location.hash = backTo; };
  const more = $('#plf-more', el);
  if (more) more.onclick = () => save(true);
  f.onkeydown = (ev) => {
    if (ev.key === 'Enter' && !(ev.ctrlKey || ev.metaKey) && ev.target.tagName === 'INPUT') ev.preventDefault(); // Enter speichert nicht aus Versehen
    else if (ev.key === 'Escape' && ev.target.matches('input, textarea')) { ev.preventDefault(); ev.target.blur(); }
  };
  f.onsubmit = (ev) => { ev.preventDefault(); save(false); };
  setTimeout(() => f.name.focus(), 30);
  const api = {
    canLeave: () => !dirty() || confirm(t('ex.leaveConfirm')),
    isDirty: dirty,
    submit: () => save(false),
    key(e) { if (e.key === 'Escape') { location.hash = backTo; return true; } return false; },
  };
  return api;
}
