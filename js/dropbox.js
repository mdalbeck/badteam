// Dropbox: einmal verbinden (OAuth 2.0 mit PKCE, ganz ohne Server), danach bleibt die Verbindung bestehen.
// Gemeinsame Dropbox-App „Bad Apps“ (App-Typ "App folder"): alle Bad Apps sehen den Ordner Dropbox › Apps › Bad Apps.
import * as St from './store.js';
import { t } from './i18n.js';
import { DROPBOX_APP_KEY } from './config.js';

const AUTH = 'https://www.dropbox.com/oauth2/authorize';
const TOKEN = 'https://api.dropboxapi.com/oauth2/token';
const API = 'https://api.dropboxapi.com/2';
const CONTENT = 'https://content.dropboxapi.com/2';
export const FILE = 'badteam-daten.json';
export const BADPLAN_FILE = 'badplan-daten.json';
const KEY = 'dbxAuth';
const SS_LOGIN = 'badteam-dbx-login';

let auth = null; // { access, refresh, exp, account }

export const redirectUri = () => location.origin + location.pathname;
export const appKey = () => DROPBOX_APP_KEY;
export const account = () => auth?.account || '';
export const connected = () => !!auth?.refresh;

// ---------- Hilfsfunktionen ----------
const b64url = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const randomStr = () => b64url(crypto.getRandomValues(new Uint8Array(32)));
function err(name, message) { const e = new Error(message); e.name = name; return e; }

async function tokenRequest(params) {
  const r = await fetch(TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: appKey(), ...params }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    if (j.error === 'invalid_grant') throw err('NotAllowedError', t('dbx.reconnect'));
    throw new Error(j.error_description || j.error || `Dropbox (${r.status})`);
  }
  auth = {
    access: j.access_token,
    refresh: j.refresh_token || auth?.refresh,
    exp: Date.now() + (j.expires_in || 14400) * 1000 - 60000,
    account: auth?.account || '',
    key: appKey(), // mit welcher Dropbox-App angemeldet (bei neuem App-Key: neu verbinden)
  };
  await St.setKey(KEY, auth);
}

async function token(force = false) {
  if (!auth?.refresh) throw err('NotAllowedError', t('dbx.notConnected'));
  if (force || !auth.access || Date.now() > auth.exp) await tokenRequest({ grant_type: 'refresh_token', refresh_token: auth.refresh });
  return auth.access;
}

/** Dropbox-Aufruf mit Token; bei 401 einmal mit frischem Token wiederholen. */
async function call(url, opts = {}) {
  const go = async (force) => fetch(url, { ...opts, headers: { ...opts.headers, Authorization: `Bearer ${await token(force)}` } });
  let r = await go(false);
  if (r.status === 401) r = await go(true);
  return r;
}
async function callError(r) {
  const txt = await r.text().catch(() => '');
  if (r.status === 401) return err('NotAllowedError', t('dbx.reconnect'));
  if (r.status === 400 && /scope/i.test(txt)) return new Error(t('dbx.scope'));
  if (r.status === 429 || r.status >= 500) return err('NoModificationAllowedError', t('dbx.busy'));
  let msg = txt;
  try { msg = JSON.parse(txt).error_summary || txt; } catch { /* Text */ }
  return new Error(`Dropbox: ${msg || r.status}`);
}

// ---------- Verbinden ----------
/** Zur Dropbox-Anmeldung weiterleiten. Danach kommt man wieder zur App zurück. */
export async function login() {
  const verifier = randomStr(), state = randomStr();
  const challenge = b64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));
  const data = JSON.stringify({ verifier, state, hash: location.hash || '#/backup' });
  try { sessionStorage.setItem(SS_LOGIN, data); } catch { localStorage.setItem(SS_LOGIN, data); }
  location.assign(`${AUTH}?${new URLSearchParams({
    client_id: appKey(), response_type: 'code', redirect_uri: redirectUri(), state,
    code_challenge: challenge, code_challenge_method: 'S256', token_access_type: 'offline',
  })}`);
}

/** Beim Start: Kommt die Seite gerade von Dropbox zurück? Dann Code gegen Token tauschen. */
export async function handleRedirect() {
  const q = new URLSearchParams(location.search);
  if (!q.has('code') && !q.has('error')) return false;
  let saved = null;
  try { saved = JSON.parse(sessionStorage.getItem(SS_LOGIN) || localStorage.getItem(SS_LOGIN) || 'null'); } catch { /* egal */ }
  try { sessionStorage.removeItem(SS_LOGIN); localStorage.removeItem(SS_LOGIN); } catch { /* egal */ }
  history.replaceState(null, '', redirectUri() + (saved?.hash || '#/backup'));
  if (q.has('error')) {
    if (q.get('error') === 'access_denied') throw err('AbortError', 'abort');
    throw new Error(q.get('error_description') || q.get('error'));
  }
  if (!saved || saved.state !== q.get('state')) throw new Error(t('dbx.expired'));
  await tokenRequest({ grant_type: 'authorization_code', code: q.get('code'), redirect_uri: redirectUri(), code_verifier: saved.verifier });
  try {
    const r = await call(`${API}/users/get_current_account`, { method: 'POST' });
    if (r.ok) { const j = await r.json(); auth.account = j.email || j.name?.display_name || ''; await St.setKey(KEY, auth); }
  } catch { /* nur Anzeige */ }
  return true;
}

export async function load() {
  auth = (await St.getKey(KEY)) || null;
  // Anmeldung gehört zu einer anderen (alten) Dropbox-App → nicht mehr benutzen, neu verbinden lassen
  if (auth && auth.key !== appKey()) { auth = null; await St.setKey(KEY, null); return false; }
  return !!auth?.refresh;
}
export async function logout() {
  try { if (auth?.access) await call(`${API}/auth/token/revoke`, { method: 'POST' }); } catch { /* egal */ }
  auth = null;
  await St.setKey(KEY, null);
}

// ---------- Dateien ----------
/** Version (rev) einer Datei plus Funktion zum Laden. null = Datei gibt es (noch) nicht. */
export async function peek(name = FILE) {
  const path = `/${name}`;
  const r = await call(`${API}/files/get_metadata`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path }),
  });
  if (r.status === 409) return null; // path/not_found
  if (!r.ok) throw await callError(r);
  const m = await r.json();
  return {
    version: m.rev,
    load: async () => {
      const x = await call(`${CONTENT}/files/download`, { method: 'POST', headers: { 'Dropbox-API-Arg': JSON.stringify({ path }) } });
      if (!x.ok) throw await callError(x);
      return x.text();
    },
  };
}

/** Datendatei schreiben. ifVersion: nur überschreiben, wenn die Datei noch diesen Stand hat (sonst Conflict). */
export async function write(text, ifVersion) {
  const mode = ifVersion ? { '.tag': 'update', update: ifVersion } : { '.tag': 'add' };
  const r = await call(`${CONTENT}/files/upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/octet-stream', 'Dropbox-API-Arg': JSON.stringify({ path: `/${FILE}`, mode, autorename: false, mute: true }) },
    body: new Blob([text]),
  });
  if (r.status === 409) throw err('Conflict', 'conflict');
  if (!r.ok) throw await callError(r);
  return (await r.json()).rev;
}
