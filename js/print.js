// A4-Druck (Drucken oder als PDF speichern). Telefonnummern und E-Mails stehen hier grundsätzlich nie drauf.
//   #/print/group/<Gruppe|all>/<von>_<bis>   Anwesenheitsliste: Spieler × Trainings (Querformat)
//   #/print/training/<ID>                    ein Training: Namensliste mit Häkchen (leer = zum Ausfüllen)
import * as St from './store.js';
import { icon } from './icons.js';
import { t, lang } from './i18n.js';
import { $, esc } from './ui.js';
import { takenTrainings, statPlayers, playerStats } from './stats.js';
import { fmtDay } from './trainings.js';
import * as BP from './badplan.js';

const MARK = { p: '✓', e: 'E', a: '✗' };
const loc = () => (lang() === 'de' ? 'de-DE' : 'en-GB');
const dm = (day) => new Date(`${day}T12:00:00`).toLocaleDateString(loc(), { day: '2-digit', month: '2-digit' });

export function printView(el, kind, id, range) {
  document.body.classList.add('printmode');
  const bar = (back) => `<div class="p-bar no-print">
      <a class="btn" href="${back}">${icon('back', 18)}<span>${esc(t('pr.back'))}</span><kbd>Esc</kbd></a>
      <button class="primary" id="p-go">${icon('printer', 18)}<span>${esc(t('pr.print'))}</span><kbd>D</kbd></button>
      <span class="muted small">${esc(t('pr.hint'))}</span></div>`;
  const head = (title, sub) => `<div class="p-head"><div><div class="p-brand">Bad<b>Team</b> · ${esc(t('pr.attList'))}</div><h1>${esc(title)}</h1><div class="p-sub">${esc(sub)}</div></div></div>`;
  let back = '#/stats';
  if (kind === 'training') {
    const x = BP.trainingByKey(id);
    back = `#/training/${encodeURIComponent(id)}`;
    if (!x) { el.innerHTML = `<p class="empty muted">${esc(t('tr.notFound'))}</p>`; return {}; }
    const g = St.group(x.rec?.groupId || x.groupId);
    const roster = g ? St.members(g.id) : [];
    for (const pid of Object.keys(x.rec?.att || {})) { const p = St.player(pid); if (p && !roster.includes(p)) roster.push(p); }
    roster.sort(St.byName);
    const att = x.rec?.att || {};
    const sum = (s) => roster.filter((p) => att[p.id] === s).length;
    el.innerHTML = `${bar(back)}<div class="sheet">
      ${head(g?.name || t('tr.noGroup'), `${fmtDay(x.day, true)}${x.start ? ` · ${x.start}${x.end ? `–${x.end}` : ''}` : ''}${x.place ? ` · ${x.place}` : ''}`)}
      <table class="p-tab p-att1"><thead><tr><th>#</th><th>${esc(t('pl.name'))}</th><th>${esc(t('att.p'))}</th><th>${esc(t('att.e'))}</th><th>${esc(t('att.a'))}</th></tr></thead>
      <tbody>${roster.map((p, i) => `<tr><td class="p-n">${i + 1}</td><td>${esc(p.name)}</td>${['p', 'e', 'a'].map((s) => `<td class="p-box">${att[p.id] === s ? '✓' : '☐'}</td>`).join('')}</tr>`).join('')}
      ${[1, 2, 3].map(() => `<tr class="p-blank"><td></td><td></td><td class="p-box">☐</td><td class="p-box">☐</td><td class="p-box">☐</td></tr>`).join('')}</tbody>
      <tfoot><tr><td></td><td>${esc(t('pr.sum'))}</td><td class="p-box">${sum('p') || ''}</td><td class="p-box">${sum('e') || ''}</td><td class="p-box">${sum('a') || ''}</td></tr></tfoot></table>
      ${x.rec?.note ? `<p class="p-note">${esc(x.rec.note)}</p>` : ''}
      <p class="p-muted p-foot">${esc(t('pr.footer'))}</p></div>`;
  } else {
    const gid = id === 'all' ? null : id;
    const [from, to] = String(range || '').split('_');
    back = gid ? `#/stats/${gid}` : '#/stats';
    if (!from || !to || (gid && !St.group(gid))) { el.innerHTML = `<p class="empty muted">${esc(t('tr.notFound'))}</p>`; return {}; }
    const trs = takenTrainings(gid, from, to);
    const players = statPlayers(gid, trs).filter((p) => p.active || trs.some((tr) => tr.att[p.id]));
    el.innerHTML = `${bar(back)}<div class="sheet landscape">
      ${head(gid ? St.group(gid).name : t('st.allGroups'), `${fmtDay(from, true)} – ${fmtDay(to, true)} · ${t('pr.nTrainings', { n: trs.length })}`)}
      ${trs.length ? `<table class="p-tab p-matrix"><thead><tr><th>${esc(t('pl.name'))}</th>${trs.map((tr) => `<th class="p-d">${esc(dm(tr.day))}</th>`).join('')}<th class="p-sum">${esc(t('pr.sum'))}</th></tr></thead>
        <tbody>${players.map((p) => { const s = playerStats(p, trs); return `<tr><td class="p-name">${esc(p.name)}</td>${trs.map((tr) => `<td class="p-d m-${tr.att[p.id] || ''}">${MARK[tr.att[p.id]] || ''}</td>`).join('')}<td class="p-sum">${s.n ? `${s.p}/${s.n}` : '–'}</td></tr>`; }).join('')}</tbody>
        <tfoot><tr><td>${esc(t('att.p'))}</td>${trs.map((tr) => `<td class="p-d">${Object.values(tr.att).filter((v) => v === 'p').length}</td>`).join('')}<td></td></tr></tfoot></table>
        <p class="p-muted">${esc(t('pr.legend'))}</p>` : `<p>${esc(t('st.empty'))}</p>`}
      <p class="p-muted p-foot">${esc(t('pr.footer'))}</p></div>`;
  }
  $('#p-go', el).onclick = () => window.print();
  return {
    destroy: () => document.body.classList.remove('printmode'),
    key(e) {
      if (e.key === 'Escape') { location.hash = back; return true; }
      if (e.key === 'd' || e.key === 'D') { window.print(); return true; }
      return false;
    },
  };
}
