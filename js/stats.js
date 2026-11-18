// Statistik: Anwesenheit pro Spieler in einem Zeitraum, „fehlt zuletzt oft“, Druck der Anwesenheitsliste.
// Gezählt werden nur Trainings, in denen der Spieler ein Häkchen hat (da, entschuldigt oder fehlt).
import * as St from './store.js';
import { icon } from './icons.js';
import { t } from './i18n.js';
import { $, $$, esc } from './ui.js';
import { fmtDay } from './trainings.js';

const F = { period: '3m', from: '', to: '' };
/** Zeitraum als [from, to] (JJJJ-MM-TT) */
export function periodRange(period = F.period) {
  const today = St.todayIso();
  const y = +today.slice(0, 4), m = +today.slice(5, 7);
  const back = (days) => St.iso(new Date(Date.now() - days * 864e5));
  switch (period) {
    case '4w': return [back(27), today];
    case 'month': return [`${today.slice(0, 7)}-01`, today];
    case 'half': return m <= 6 ? [`${y}-01-01`, `${y}-06-30`] : [`${y}-07-01`, `${y}-12-31`];
    case 'season': return m >= 8 ? [`${y}-08-01`, `${y + 1}-07-31`] : [`${y - 1}-08-01`, `${y}-07-31`];
    case 'custom': return [F.from || back(90), F.to || today];
    default: return [back(90), today]; // 3m
  }
}
const PERIODS = ['4w', 'month', '3m', 'half', 'season', 'custom'];

/** Trainings einer Gruppe (oder aller, gid = null) im Zeitraum, die erfasst sind – älteste zuerst */
export function takenTrainings(gid, from, to) {
  return St.S.data.trainings.filter((tr) => tr.day >= from && tr.day <= to && Object.keys(tr.att).length && (!gid || tr.groupId === gid))
    .sort((a, b) => (a.day + (a.start || '')).localeCompare(b.day + (b.start || '')));
}
/** Spieler in der Auswertung: aktive Mitglieder plus alle, die in den Trainings ein Häkchen haben */
export function statPlayers(gid, trainings) {
  const set = new Set(gid ? St.members(gid) : St.S.data.players.filter((p) => p.active && p.groups.length));
  for (const tr of trainings) for (const pid of Object.keys(tr.att)) { const p = St.player(pid); if (p) set.add(p); }
  return [...set].sort(St.byName);
}
export function playerStats(p, trainings) {
  const r = { p: 0, e: 0, a: 0, n: 0 };
  for (const tr of trainings) { const s = tr.att[p.id]; if (s) { r[s]++; r.n++; } }
  r.pct = r.n ? Math.round((r.p / r.n) * 100) : null;
  return r;
}
/** Fehlt zuletzt oft: in den letzten 4 erfassten Trainings mindestens 2 × „fehlt“ (entschuldigt zählt nicht) */
export function oftenMissing(gid) {
  const all = takenTrainings(gid, '0000-01-01', St.todayIso());
  return statPlayers(gid, []).map((p) => {
    const mine = all.filter((tr) => tr.att[p.id]).slice(-4);
    const miss = mine.filter((tr) => tr.att[p.id] === 'a');
    return { p, miss, last: mine.length };
  }).filter((x) => x.miss.length >= 2).sort((a, b) => b.miss.length - a.miss.length || St.byName(a.p, b.p));
}

export function statsView(el, gid) {
  if (gid && !St.group(gid)) gid = null;
  const render = () => {
    const [from, to] = periodRange();
    const groups = St.groupsSorted();
    const trs = takenTrainings(gid, from, to);
    const rows = statPlayers(gid, trs).map((p) => ({ pl: p, ...playerStats(p, trs) })).filter((r) => r.n || r.pl.active)
      .sort((a, b) => (b.pct ?? -1) - (a.pct ?? -1) || St.byName(a.pl, b.pl));
    const avg = trs.length ? Math.round((trs.reduce((s, tr) => s + Object.values(tr.att).filter((v) => v === 'p').length, 0) / trs.length) * 10) / 10 : 0;
    const sumP = rows.reduce((s, r) => s + r.p, 0), sumN = rows.reduce((s, r) => s + r.n, 0);
    const often = oftenMissing(gid);
    el.innerHTML = `
      <div class="pagehead">
        <h1><span class="eyebrow">${esc(t('st.eyebrow'))}</span>${esc(gid ? St.group(gid).name : t('st.allGroups'))}</h1>
        <div class="acts"><a class="btn" id="st-print" href="#/print/group/${gid || 'all'}/${from}_${to}">${icon('printer', 18)}<span>${esc(t('st.printList'))}</span><kbd>D</kbd></a></div>
      </div>
      <div class="fgroup plfilter">
        <button class="gfilter ${gid ? '' : 'on'}" data-g="">${esc(t('st.allGroups'))}</button>
        ${groups.map((g) => `<button class="gfilter ${gid === g.id ? 'on' : ''}" data-g="${g.id}">${esc(g.name)}</button>`).join('')}
      </div>
      <div class="periodbar">
        <div class="seg" id="st-period">${PERIODS.map((p) => `<button data-per="${p}" class="${F.period === p ? 'on' : ''}">${esc(t(`st.p.${p}`))}</button>`).join('')}</div>
        ${F.period === 'custom' ? `<span class="selrow"><input type="date" id="st-from" value="${from}" aria-label="${esc(t('st.from'))}"><span>–</span><input type="date" id="st-to" value="${to}" aria-label="${esc(t('st.to'))}"></span>`
          : `<span class="muted small">${esc(fmtDay(from))} – ${esc(fmtDay(to))}</span>`}
      </div>
      <div class="stats">
        <div class="stat-tile"><b>${trs.length}</b><span>${esc(t('st.trainings'))}</span></div>
        <div class="stat-tile"><b>${String(avg).replace('.', t('dec'))}</b><span>${esc(t('st.avg'))}</span></div>
        <div class="stat-tile"><b>${sumN ? Math.round((sumP / sumN) * 100) : '–'}${sumN ? '<small>%</small>' : ''}</b><span>${esc(t('st.rate'))}</span></div>
      </div>
      ${often.length ? `<section class="panel home-missing"><h2>${icon('alert', 20)} ${esc(t('st.often'))}</h2><p class="muted small">${esc(t('st.oftenText'))}</p>
        <div class="dlist">${often.map((x) => `<a class="drow" href="#/player/${x.p.id}"><span class="exrow-b"><b>${esc(x.p.name)}</b><span class="exmeta"><span>${esc(t('st.missOf', { n: x.miss.length, m: x.last }))}</span><span>${esc(x.miss.map((tr) => fmtDay(tr.day)).join(', '))}</span></span></span>${icon('right', 18)}</a>`).join('')}</div></section>` : ''}
      <section class="panel">
        <h2>${icon('chart', 20)} ${esc(t('st.perPlayer'))}</h2>
        ${trs.length ? `<div class="sttable">${rows.map((r) => `<a class="strow" href="#/player/${r.pl.id}">
            <span class="stname"><b>${esc(r.pl.name)}</b>${r.pl.active ? '' : ` <span class="badge">${esc(t('pl.paused'))}</span>`}</span>
            <span class="stbar" aria-hidden="true"><i class="b-p" style="width:${r.n ? (r.p / r.n) * 100 : 0}%"></i><i class="b-e" style="width:${r.n ? (r.e / r.n) * 100 : 0}%"></i><i class="b-a" style="width:${r.n ? (r.a / r.n) * 100 : 0}%"></i></span>
            <span class="stnum"><b>${r.pct == null ? '–' : `${r.pct} %`}</b><small>${esc(r.n ? t('st.ofLine', { p: r.p, n: r.n }) : t('st.noData'))}${r.e ? ` · ${esc(t('st.excusedN', { n: r.e }))}` : ''}</small></span>
          </a>`).join('')}</div>
          <p class="muted small stlegend"><i class="b-p"></i>${esc(t('att.p'))} <i class="b-e"></i>${esc(t('att.e'))} <i class="b-a"></i>${esc(t('att.a'))}</p>`
          : `<p class="muted">${esc(t('st.empty'))}</p>`}
      </section>`;
    $$('[data-g]', el).forEach((b) => { b.onclick = () => { location.hash = b.dataset.g ? `#/stats/${b.dataset.g}` : '#/stats'; }; });
    $$('[data-per]', el).forEach((b) => { b.onclick = () => { if (b.dataset.per === 'custom' && F.period !== 'custom') [F.from, F.to] = periodRange(); F.period = b.dataset.per; render(); }; });
    const fi = $('#st-from', el), ti = $('#st-to', el);
    if (fi) fi.onchange = () => { F.from = fi.value; render(); };
    if (ti) ti.onchange = () => { F.to = ti.value; render(); };
  };
  render();
  return {
    refresh: render,
    key(e) { if (e.key === 'd' || e.key === 'D') { location.hash = $('#st-print', el).getAttribute('href'); return true; } return false; },
  };
}
