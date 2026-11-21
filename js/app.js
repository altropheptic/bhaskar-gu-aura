/**
 * Dawai Dost entry point: boot, tabs, header, settings and the first-open setup.
 *
 * Boot order is chosen so an elder (or a judge) is never blocked:
 *   1. Static page content is already readable (no JS needed).
 *   2. Settings (XL text) apply immediately. The app is light-only by design.
 *   3. The store connects to Supabase silently (a private, invisible account);
 *      if that fails we fall back to this device and say so in a banner.
 *   4. One button opens the app. A brand-new account starts with a sample
 *      family saved into it, so every tap from then on is stored for real.
 */
import '@fontsource-variable/lexend/wght.css';
import '@fontsource-variable/atkinson-hyperlegible-next/wght.css';
import '../css/styles.css';

import { el, icon, openDialog, showBanner, toast, avatarTint, setLoading } from './ui.js';
import { store } from './store.js';
import { isSupabaseConfigured } from './supabaseClient.js';
import { state, subscribe, loadAll, selectProfile, currentProfile } from './state.js';
import { buildDemoData } from './demoData.js';
import { renderToday } from './todayView.js';
import { renderMedicines } from './medicinesView.js';
import { renderHistory } from './historyView.js';
import { renderCare, forgetLastLink } from './careView.js';
import { openProfileDialog } from './profileDialog.js';
import { openMedicineDialog } from './medForm.js';
import { startReminders, enableNotifications, testChime } from './reminders.js';
import { getSettings, setSettings, applySettings } from './settings.js';
import { openNotifications, notificationCount } from './notifications.js';

const $ = (sel) => /** @type {HTMLElement} */ (document.querySelector(sel));
const RENDERERS = { today: renderToday, medicines: renderMedicines, history: renderHistory, care: renderCare };

applySettings();

/* ---------------- rendering ---------------- */

function renderHeader() {
  const sel = /** @type {HTMLSelectElement} */ ($('#profile-select'));
  const person = currentProfile();
  const avatar = $('#avatar');
  avatar.textContent = (person?.name ?? '?').trim().charAt(0).toUpperCase() || '?';
  avatar.className = `avatar ${avatarTint(person?.name ?? '')}`;
  // Bell badge: due or missed doses, low stock and reminder setup that needs a fix.
  const count = notificationCount();
  const badge = $('#health-badge');
  badge.hidden = count === 0;
  badge.textContent = String(count);
  $('#health-btn').setAttribute('aria-label', count ? `Alerts: ${count}` : 'Alerts: none');
  sel.replaceChildren(
    ...state.profiles.map((p) => el('option', { text: p.name, attrs: { value: p.id, selected: p.id === state.profileId } })),
    el('option', { text: '+ Add a person', attrs: { value: '__new' } }),
  );
}

function render() {
  renderHeader();
  if ($('#app').hidden) return;
  const panel = $(`#panel-${state.tab}`);
  RENDERERS[state.tab]?.(panel);
}

function showTab(tab) {
  if (state.tab === 'care' && tab !== 'care') forgetLastLink();
  state.tab = tab;
  document.querySelectorAll('.nav__item').forEach((t) => {
    if (t.dataset.tab === tab) t.setAttribute('aria-current', 'page');
    else t.removeAttribute('aria-current');
  });
  document.querySelectorAll('[data-panel]').forEach((p) => { p.hidden = p.dataset.panel !== tab; });
  window.scrollTo(0, 0);
  render();
}

/** Switch from the landing page to the app shell (and stop looking like a website). */
function showApp() {
  $('#landing').hidden = true;
  $('#app').hidden = false;
  document.body.classList.add('in-app');
  render();
  startReminders();
}

function showWelcome() {
  document.querySelectorAll('[data-open-app]').forEach((b) => { b.textContent = 'Open my list'; });
  $('#landing').hidden = false;
  $('#app').hidden = true;
  document.body.classList.remove('in-app');
  renderHeader();
  window.scrollTo(0, 0);
}

/**
 * "Log out": leave the app and return to the home page. There is no password
 * (each browser has a private, invisible account), so the list stays saved and
 * "Open my list" brings it straight back.
 */
function logOut() {
  document.querySelectorAll('dialog[open]').forEach((d) => d.close());
  showWelcome();
  toast('Logged out · your list is saved');
}

subscribe(render);
// Keep "due / missed" states fresh even when nothing is clicked.
setInterval(() => { if (!$('#app').hidden && state.tab === 'today' && !document.querySelector('dialog[open]')) render(); }, 60_000);

/* ---------------- actions ---------------- */

/** Connect once, in the background, as soon as the page loads. */
const ready = store.init().catch(() => ({ fellBack: true }));

/**
 * Open the app. A brand-new account gets the sample family (4 people, 18
 * medicines, a month of history) saved into it first, so the first screen is
 * full and everything after that is a real, saved change.
 * @param {HTMLButtonElement} button
 */
async function openApp(button) {
  setLoading(button, true, 'Opening…');
  try {
    const { fellBack } = await ready;
    if (fellBack && isSupabaseConfigured) showBanner('warn', 'Offline mode · saved on this device', { id: 'offline' });
    await loadAll();
    let fresh = false;
    if (!state.profiles.length) {
      await store.importAll(buildDemoData());
      state.profileId = null;
      await loadAll();
      fresh = true;
    }
    showTab('today');
    showApp();
    if (fresh) toast('Welcome · a reminder rings in about a minute');
  } finally {
    setLoading(button, false);
  }
}

function openSettings() {
  const dialog = /** @type {HTMLDialogElement} */ ($('#settings-dialog'));
  const s = getSettings();
  const body = openDialog(dialog, 'Settings', 'settings-title');
  const radios = (legend, name, options, value) => el('fieldset', {}, [
    el('legend', { text: legend }),
    el('div', { className: 'check-row' }, options.map(([v, label]) => {
      const input = el('input', { attrs: { type: 'radio', name, value: v, checked: v === value } });
      input.addEventListener('change', () => setSettings({ [name]: v }));
      return el('label', {}, [input, label]);
    })),
  ]);
  const voice = el('input', { attrs: { type: 'checkbox', checked: s.voice } });
  voice.addEventListener('change', () => setSettings({ voice: /** @type {HTMLInputElement} */ (voice).checked }));

  const notifyBtn = el('button', { className: 'btn btn--outline', text: 'Allow notifications', attrs: { type: 'button' } });
  notifyBtn.addEventListener('click', async () => {
    const result = await enableNotifications();
    toast(result === 'granted' ? 'Notifications are on.' : result === 'unsupported' ? 'This browser cannot show notifications.' : 'Notifications were not allowed.');
  });
  const soundBtn = el('button', { className: 'btn btn--ghost', text: 'Test sound', attrs: { type: 'button' }, on: { click: () => testChime() } });

  body.replaceChildren(
    radios('Text size', 'size', [['normal', 'Normal'], ['xl', 'Extra large']], s.size),
    el('fieldset', {}, [el('legend', { text: 'Reminders' }), el('div', { className: 'check-row' }, [el('label', {}, [voice, 'Speak aloud'])])]),
    el('div', { className: 'btn-row' }, [notifyBtn, soundBtn]),
    el('hr'),
    currentProfile() && el('button', { className: 'btn btn--ghost', text: `Edit ${currentProfile().name}'s details`, attrs: { type: 'button' }, on: { click: () => { dialog.close(); openProfileDialog(currentProfile()); } } }),
    el('div', { className: 'btn-row' }, [
      el('button', { className: 'btn btn--primary', attrs: { type: 'button' }, on: { click: () => logOut() } }, [icon('logout'), 'Log out']),
    ]),
  );
}

/* ---------------- wiring ---------------- */

document.querySelectorAll('[data-open-app]').forEach((btn) => btn.addEventListener('click', (e) => openApp(/** @type {HTMLButtonElement} */ (e.currentTarget)).catch((err) => showBanner('error', err.message || 'Could not open. Please try again.'))));
$('#settings-btn').addEventListener('click', openSettings);
$('#add-med-btn').addEventListener('click', () => openMedicineDialog());
$('#fab-add').addEventListener('click', () => openMedicineDialog());
$('#logout-btn').addEventListener('click', () => logOut());
$('#health-btn').addEventListener('click', () => openNotifications({ onFixSetup: () => showTab('care') }));
document.querySelectorAll('.nav__item').forEach((t) => t.addEventListener('click', () => showTab(t.dataset.tab)));
$('#profile-select').addEventListener('change', (e) => {
  const value = /** @type {HTMLSelectElement} */ (e.target).value;
  if (value === '__new') {
    renderHeader();
    openProfileDialog(null, { onSaved: () => toast('Person added.') });
  } else {
    selectProfile(value).catch((err) => showBanner('error', err.message));
  }
});

/* ---------------- boot ---------------- */

// A returning visitor sees "Open my list" on the home page.
ready.then(() => store.listProfiles()).then((people) => {
  if (people.length) document.querySelectorAll('[data-open-app]').forEach((b) => { b.textContent = 'Open my list'; });
}).catch(() => {});

// Installable / offline: register the service worker in production builds only
// (in development it would cache stale files while we edit).
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}
