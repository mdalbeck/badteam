// Kleine gemeinsame Bausteine der Oberfläche: Auswahl, Escaping, Toast, Dialog.
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let toastTimer;
export function toast(msg, action, fn) {
  const el = $('#toast');
  el.innerHTML = `<span>${esc(msg)}</span>${action ? `<button>${esc(action)}</button>` : ''}`;
  if (action) $('button', el).onclick = () => { el.classList.add('hidden'); fn(); };
  el.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add('hidden'), action ? 6000 : 3500);
}

export const dlg = () => $('#dlg');
export function modal(html, cls = '') {
  const d = dlg();
  d.className = cls;
  d.innerHTML = `<div class="dlg-body">${html}</div>`;
  if (!d.open) d.showModal();
  return d;
}
export const closeModal = () => dlg().open && dlg().close();
