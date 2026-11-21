/**
 * Dawai Dost entry point: boot, tabs, header, settings and demo mode.
 *
 * Boot order is chosen so an elder (or a judge) is never blocked:
 *   1. Static page content is already readable (no JS needed).
 *   2. Settings (theme, XL text) apply immediately.
 *   3. The store connects to Supabase silently; if that fails we fall back to
 *      this device and say so in a banner, and the app keeps working.
 *   4. "Try Instant Demo" works at any point, even fully offline.
 */
import '@fontsource-variable/lexend/wght.css';
import '@fontsource-variable/atkinson-hyperlegible-next/wght.css';
import '../css/styles.css';

import { el, openDialog, showBanner, clearBanner, toast } from './ui.js';
import { store } from './store.js';
import { isSupabaseConfigured } from './supabaseClient.js';
import { state, subscribe, loadAll, selectProfile, currentProfile } from './state.js';
import { buildDemoData } from './demoData.js';
import { renderToday } from './todayView.js';
import { renderMedicines } from './medicinesView.js';
import { renderHistory } from './historyView.js';
import { renderCare } from './careView.js';
import { openProfileDialog } from './profileDialog.js';
import { openMedicineDialog } from './medForm.js';
import { startReminders, enableNotifications, testChime } from './reminders.js';
import { getSettings, setSettings, applySettings } from './settings.js';

const $ = (sel) => /** @type {HTMLElement} */ (document.querySelector(sel));
const RENDERERS = { today: renderToday, medicines: renderMedicines, history: renderHistory, care: renderCare };

applySettings();

/* ---------------- rendering ---------------- */

function renderHeader() {
  const sw = $('#profile-switch');
  const sel = /** @type {HTMLSelectElement} */ ($('#profile-select'));
  const appVisible = !$('#app').hidden;
  sw.hidden = !appVisible || !state.profiles.length;
  sel.replaceChildren(
    ...state.profiles.map((p) => el('option', { text: p.name, attrs: { value: p.id, selected: p.id === state.profileId } })),
    el('option', { text: '+ Add a person', attrs: { value: '__new' } }),
  );
}

function renderDemoBar() {
  if (store.mode === 'demo') {
    showBanner('info', 'You are exploring the demo with sample data. Changes are not saved. Open Settings and choose "Exit demo" to start your own list.', { sticky: true, id: 'demo' });
  } else {
    clearBanner('demo');
  }
}

function render() {
  renderHeader();
  if ($('#app').hidden) return;
  const panel = $(`#panel-${state.tab}`);
  RENDERERS[state.tab]?.(panel);
}

function showTab(tab) {
  state.tab = tab;
  document.querySelectorAll('.tab').forEach((t) => t.setAttribute('aria-selected', String(t.dataset.tab === tab)));
  document.querySelectorAll('.panel').forEach((p) => { p.hidden = p.dataset.panel !== tab; });
  render();
}

function showApp() {
  $('#welcome').hidden = true;
  $('#app').hidden = false;
  renderDemoBar();
  render();
  startReminders();
}

function showWelcome() {
  $('#welcome').hidden = false;
  $('#app').hidden = true;
  renderHeader();
}

subscribe(render);
// Keep "due / missed" states fresh even when nothing is clicked.
setInterval(() => { if (!$('#app').hidden && state.tab === 'today' && !document.querySelector('dialog[open]')) render(); }, 60_000);

/* ---------------- actions ---------------- */

async function startDemo() {
  store.startDemo(buildDemoData());
  state.profileId = null;
  await loadAll();
  showTab('today');
  showApp();
  toast('Demo loaded. An alarm for Dadi will ring in about a minute.');
}

async function exitDemo() {
  store.exitDemo();
  state.profileId = null;
  await loadAll();
  renderDemoBar();
  if (state.profiles.length) { showTab('today'); showApp(); } else { showWelcome(); }
}

function startOwnList() {
  if (store.mode === 'demo') store.exitDemo();
  openProfileDialog(null, {
    onSaved: () => {
      showTab('today');
      showApp();
      openMedicineDialog();
    },
  });
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

  const notifyBtn = el('button', { className: 'btn btn--outline', text: 'Allow alarm notifications', attrs: { type: 'button' } });
  notifyBtn.addEventListener('click', async () => {
    const result = await enableNotifications();
    toast(result === 'granted' ? 'Notifications are on.' : result === 'unsupported' ? 'This browser cannot show notifications.' : 'Notifications were not allowed.');
  });
  const soundBtn = el('button', { className: 'btn btn--ghost', text: 'Test alarm sound', attrs: { type: 'button' }, on: { click: () => testChime() } });

  const modeText = {
    cloud: 'Your list is saved privately online for this browser (no login needed).',
    local: 'Your list is saved on this device only.',
    demo: 'You are viewing sample data. Nothing is saved.',
  }[store.mode];

  body.replaceChildren(
    radios('Text size', 'size', [['normal', 'Normal'], ['xl', 'Extra large']], s.size),
    radios('Theme', 'theme', [['system', 'Match phone'], ['light', 'Light'], ['dark', 'Dark']], s.theme),
    el('label', { className: 'check-row' }, [voice, 'Speak reminders aloud']),
    el('div', { className: 'btn-row' }, [notifyBtn, soundBtn]),
    el('p', { className: 'field__hint', text: 'Alarms ring while Dawai Dost is open. For alarms when it is closed, use "Add alarms to phone calendar" in Family & safety.' }),
    el('hr'),
    el('p', { text: modeText }),
    currentProfile() && el('button', { className: 'btn btn--ghost', text: `Edit ${currentProfile().name}'s details`, attrs: { type: 'button' }, on: { click: () => { dialog.close(); openProfileDialog(currentProfile()); } } }),
    store.mode === 'demo' && el('button', { className: 'btn btn--primary', text: 'Exit demo', attrs: { type: 'button' }, on: { click: () => { dialog.close(); exitDemo(); } } }),
  );
}

/* ---------------- wiring ---------------- */

$('#demo-btn').addEventListener('click', () => startDemo().catch((e) => showBanner('error', e.message)));
$('#start-btn').addEventListener('click', startOwnList);
$('#settings-btn').addEventListener('click', openSettings);
document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => showTab(t.dataset.tab)));
document.querySelector('.tabs').addEventListener('keydown', (e) => {
  // Arrow keys move between tabs (WAI-ARIA tabs pattern).
  if (!['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
  const tabs = [...document.querySelectorAll('.tab')];
  const i = tabs.indexOf(document.activeElement);
  if (i < 0) return;
  const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
  next.focus();
  showTab(next.dataset.tab);
});
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

(async function boot() {
  const { fellBack } = await store.init();
  if (fellBack && isSupabaseConfigured) {
    showBanner('warn', "Couldn't reach the online service, so your list is being saved on this device. Everything still works.", { id: 'offline' });
  }
  if (store.mode === 'demo') return; // the user clicked the demo while we were connecting
  try {
    await loadAll();
  } catch (err) {
    showBanner('error', err.message || 'Could not load your list.');
  }
  if (state.profiles.length && store.mode !== 'demo') {
    showTab('today');
    showApp();
  }
})();

// Installable / offline: register the service worker in production builds only
// (in development it would cache stale files while we edit).
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}
