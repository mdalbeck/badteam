// Gruppen: Übersicht, Gruppe mit Mitgliedern, Rundbrief per E-Mail (alle Adressen im verdeckten BCC-Feld).
// BadTeam führt die Gruppen; Gruppen aus BadPlan werden mit derselben ID übernommen (siehe badplan.js).
import * as St from './store.js';
import { icon } from './icons.js';
import { t } from './i18n.js';
import { $, $$, esc, toast, modal, closeModal } from './ui.js';
import { playerRow } from './players.js';

/** Rundbrief: Fenster mit den Adressen aller aktiven Spieler (unter 18 auch die Eltern) */
export function mailDialog(players, title) {
  const list = players.filter((p) => p.active);
  const mails = [...new Set(list.flatMap(St.mailsOf))];
  const missing = list.filter((p) => !St.mailsOf(p).length);
  const href = `mailto:?bcc=${mails.map(encodeURIComponent).join(',')}`;
  const d = modal(`<h2>${icon('mail', 20)} ${esc(t('gr.mailTitle', { name: title }))}</h2>
    <p>${esc(t('gr.mailText', { n: mails.length, p: list.length - missing.length }))}</p>
    <p class="muted small">${esc(t('gr.mailRule'))}</p>
    ${missing.length ? `<p class="note">${icon('alert', 16)}<span>${esc(t('gr.mailMissing', { n: missing.length }))}: ${missing.map((p) => `<a href="#/player/${p.id}/edit">${esc(p.name)}</a>`).join(', ')}</span></p>` : ''}
    ${href.length > 1900 ? `<p class="muted small">${esc(t('gr.mailLong'))}</p>` : ''}
    <div class="dlg-actions"><button class="ghost" id="gm-no">${esc(t('bk.cancel'))}</button><span class="grow"></span>
      <button id="gm-copy" ${mails.length ? '' : 'disabled'}>${icon('copy', 18)}<span>${esc(t('gr.copy'))}</span></button>
      <a class="btn primary ${mails.length ? '' : 'disabled'}" id="gm-open" href="${esc(href)}">${icon('mail', 18)}<span>${esc(t('gr.openMail'))}</span></a></div>`);
  $('#gm-no', d).onclick = closeModal;
  $$('a[href^="#/player"]', d).forEach((a) => { a.onclick = closeModal; });
  $('#gm-copy', d).onclick = async () => {
    try { await navigator.clipboard.writeText(mails.join(', ')); toast(t('gr.copied', { n: mails.length })); closeModal(); } catch { toast(t('gr.copyFail')); }
  };
  $('#gm-open', d).onclick = (e) => { if (!mails.length) e.preventDefault(); else setTimeout(closeModal, 300); };
}

// ================= Übersicht =================
export function groupsView(el) {
  const render = () => {
    const groups = St.groupsSorted();
    const free = St.S.data.players.filter((p) => p.active && !p.groups.some((g) => St.group(g))).length;
    el.innerHTML = `
      <div class="pagehead">
        <h1><span class="eyebrow">${esc(t('gr.eyebrow'))}</span>${esc(t('nav.groups'))}</h1>
      </div>
      <p class="lead muted">${esc(t('gr.lead'))}</p>
      ${groups.length ? `<div class="exlist grlist">${groups.map((g) => {
        const m = St.members(g.id);
        const young = m.filter((p) => p.birthday).map((p) => St.age(p.birthday));
        return `<a class="exrow" href="#/group/${g.id}"><span class="avatar grp">${icon('users', 18)}</span>
          <span class="exrow-b"><b>${esc(g.name)}</b><span class="exmeta"><span>${esc(m.length === 1 ? t('gr.n1') : t('gr.n', { n: m.length }))}</span>${young.length ? `<span>${esc(t('gr.ages', { a: Math.min(...young), b: Math.max(...young) }))}</span>` : ''}</span></span>${icon('right', 18)}</a>`;
      }).join('')}</div>` : `<p class="empty muted">${esc(t('gr.none'))}</p>`}
      ${free ? `<p class="muted small"><a href="#/players">${esc(t('gr.free', { n: free }))}</a></p>` : ''}
      <form class="addrow panel" id="gr-add"><input name="name" placeholder="${esc(t('gr.namePh'))}" autocomplete="off" aria-label="${esc(t('gr.new'))}"><button class="primary" type="submit">${icon('plus', 18)}<span>${esc(t('gr.new'))}</span><kbd>N</kbd></button></form>`;
    $('#gr-add', el).onsubmit = (e) => {
      e.preventDefault();
      const name = e.target.name.value.trim();
      if (!name) return e.target.name.focus();
      if (St.S.data.groups.some((g) => g.name.toLowerCase() === name.toLowerCase())) return toast(t('gr.exists'));
      const id = St.addGroup(name);
      toast(t('gr.added', { name }));
      location.hash = `#/group/${id}`;
    };
  };
  render();
  return {
    refresh: () => { if (document.activeElement?.name !== 'name') render(); },
    key(e) { if (e.key === 'n' || e.key === 'N') { $('#gr-add input', el).focus(); return true; } return false; },
  };
}

// ================= Eine Gruppe =================
export function groupView(el, id) {
  let showPaused = false;
  const render = () => {
    const g = St.group(id);
    if (!g) { el.innerHTML = `<div class="pagehead"><a class="back" href="#/groups">${icon('back', 16)}${esc(t('nav.groups'))}</a></div><p class="empty muted">${esc(t('gr.notFound'))}</p>`; return; }
    const all = St.members(id, true);
    const active = all.filter((p) => p.active);
    const paused = all.length - active.length;
    el.innerHTML = `
      <div class="pagehead">
        <a class="back" href="#/groups">${icon('back', 16)}${esc(t('nav.groups'))}<kbd>Esc</kbd></a>
        <h1><span class="eyebrow">${esc(t('gr.eyebrow'))}</span>${esc(g.name)}</h1>
        <div class="acts">
          <button id="gr-mail">${icon('mail', 18)}<span>${esc(t('gr.mail'))}</span><kbd>M</kbd></button>
          <a class="btn" href="#/stats/${g.id}">${icon('chart', 18)}<span>${esc(t('nav.stats'))}</span></a>
          <button class="ghost" id="gr-ren">${icon('edit', 18)}<span>${esc(t('gr.rename'))}</span></button>
          <button class="ghost danger" id="gr-del">${icon('trash', 18)}<span>${esc(t('gr.del'))}</span></button>
        </div>
      </div>
      <div class="dlg-actions grtools">
        <a class="btn primary" href="#/player/new/${g.id}">${icon('userplus', 18)}<span>${esc(t('gr.newPlayer'))}</span></a>
        <button id="gr-pick">${icon('users', 18)}<span>${esc(t('gr.pick'))}</span></button>
        <a class="btn" href="#/training/new/${g.id}">${icon('plus', 18)}<span>${esc(t('tr.new'))}</span></a>
      </div>
      <p class="muted small excount">${esc(active.length === 1 ? t('gr.n1') : t('gr.n', { n: active.length }))}${paused ? ` · <button class="linkbtn" id="gr-paused">${esc(t(showPaused ? 'gr.hidePaused' : 'gr.showPaused', { n: paused }))}</button>` : ''}</p>
      ${all.length ? `<div class="exlist">${(showPaused ? all : active).map((p) => playerRow(p)).join('')}</div>` : `<p class="empty muted">${esc(t('gr.emptyMembers'))}</p>`}`;
    $('#gr-mail', el).onclick = () => mailDialog(active, g.name);
    $('#gr-pick', el).onclick = () => pickMembers(id);
    $('#gr-ren', el).onclick = () => {
      const name = prompt(t('gr.renamePrompt'), g.name);
      if (name && name.trim()) St.renameGroup(id, name);
    };
    $('#gr-del', el).onclick = () => {
      if (!confirm(t('gr.delConfirm', { name: g.name, n: all.length }))) return;
      St.deleteGroup(id);
      toast(t('gr.deleted', { name: g.name }));
      location.hash = '#/groups';
    };
    const ps = $('#gr-paused', el);
    if (ps) ps.onclick = () => { showPaused = !showPaused; render(); };
  };
  render();
  return {
    refresh: render,
    key(e) {
      if (e.key === 'Escape') { location.hash = '#/groups'; return true; }
      if ((e.key === 'm' || e.key === 'M') && St.group(id)) { mailDialog(St.members(id), St.group(id).name); return true; }
      return false;
    },
  };
}

/** Fenster: Spieler zur Gruppe hinzufügen oder herausnehmen (Häkchen) */
function pickMembers(gid) {
  const g = St.group(gid);
  const players = St.S.data.players.filter((p) => p.active || p.groups.includes(gid)).sort(St.byName);
  if (!players.length) { location.hash = `#/player/new/${gid}`; return; }
  const d = modal(`<h2>${esc(t('gr.pickTitle', { name: g.name }))}</h2>
    <label class="field">${icon('search', 18)}<input id="pm-q" type="search" placeholder="${esc(t('pl.search'))}" autocomplete="off"></label>
    <div class="picklist pmlist">${players.map((p) => `<label class="pickrow pm" data-name="${esc(p.name.toLowerCase())}"><input type="checkbox" value="${p.id}" ${p.groups.includes(gid) ? 'checked' : ''}>
      <span><b>${esc(p.name)}</b><small>${esc([St.age(p.birthday) != null ? t('pl.years', { n: St.age(p.birthday) }) : '', ...p.groups.filter((x) => x !== gid).map((x) => St.group(x)?.name).filter(Boolean)].filter(Boolean).join(' · '))}</small></span></label>`).join('')}</div>
    <div class="dlg-actions"><span class="grow"></span><button class="primary" id="pm-ok">${esc(t('keys.done'))}</button></div>`, 'wide');
  $$('.pm input', d).forEach((c) => { c.onchange = () => St.setMembership(c.value, gid, c.checked); });
  const q = $('#pm-q', d);
  q.oninput = () => { const v = q.value.trim().toLowerCase(); $$('.pm', d).forEach((r) => r.classList.toggle('hidden', !!v && !r.dataset.name.includes(v))); };
  $('#pm-ok', d).onclick = closeModal;
}
