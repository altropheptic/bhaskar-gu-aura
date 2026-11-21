/**
 * Dawai Dost entry point: boot, tabs, header, settings and demo mode.
 *
 * Boot order is chosen so an elder (or a judge) is never blocked:
 *   1. Static page content is already readable (no JS needed).
 *   2. Settings (XL text) apply immediately. The app is light-only by design.
 *   3. The store connects to Supabase silently; if that fails we fall back to
 *      this device and say so in a banner, and the app keeps working.
 *   4. "Try Instant Demo" works at any point, even fully offline.
 */
import '@fontsource-variable/lexend/wght.css';
import '@fontsource-variable/atkinson-hyperlegible-next/wght.css';
import '../css/styles.css';

import { el, openDialog, showBanner, toast, avatarTint } from './ui.js';
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
import { healthSummary } from './reminderHealth.js';

const $ = (sel) => /** @type {HTMLElement} */ (document.querySelector(sel));
const RENDERERS = { today: renderToday, medicines: renderMedicines, history: renderHistory, care: renderCare };

applySettings();

/* ---------------- rendering ---------------- */

function renderHeader() {
  const sel = /** @type {HTMLSelectElement} */ ($('#profile-select'));
  $('#demo-chip').hidden = store.mode !== 'demo';
  const person = currentProfile();
  const avatar = $('#avatar');
  avatar.textContent = (person?.name ?? '?').trim().charAt(0).toUpperCase() || '?';
  avatar.className = `avatar ${avatarTint(person?.name ?? '')}`;
  // Bell badge: how many reminder channels need a fix (sound, voice, notifications, calendar).
  const { ready, total } = healthSummary();
  const badge = $('#health-badge');
  badge.hidden = ready === total;
  badge.textContent = String(total - ready);
  $('#health-btn').setAttribute('aria-label', ready === total ? 'Reminder check: all ready' : `Reminder check: ${total - ready} to fix`);
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
  $('#landing').hidden = false;
  $('#app').hidden = true;
  document.body.classList.remove('in-app');
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
  toast('Demo loaded · an alarm rings in about a minute');
}

async function exitDemo() {
  store.exitDemo();
  state.profileId = null;
  await loadAll();
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

  const notifyBtn = el('button', { className: 'btn btn--outline', text: 'Allow notifications', attrs: { type: 'button' } });
  notifyBtn.addEventListener('click', async () => {
    const result = await enableNotifications();
    toast(result === 'granted' ? 'Notifications are on.' : result === 'unsupported' ? 'This browser cannot show notifications.' : 'Notifications were not allowed.');
  });
  const soundBtn = el('button', { className: 'btn btn--ghost', text: 'Test sound', attrs: { type: 'button' }, on: { click: () => testChime() } });

  const modeText = { cloud: 'Saved privately online', local: 'Saved on this device', demo: 'Demo · nothing is saved' }[store.mode];

  body.replaceChildren(
    radios('Text size', 'size', [['normal', 'Normal'], ['xl', 'Extra large']], s.size),
    el('fieldset', {}, [el('legend', { text: 'Reminders' }), el('div', { className: 'check-row' }, [el('label', {}, [voice, 'Speak aloud'])])]),
    el('div', { className: 'btn-row' }, [notifyBtn, soundBtn]),
    el('hr'),
    el('p', { className: 'muted', text: modeText }),
    currentProfile() && el('button', { className: 'btn btn--ghost', text: `Edit ${currentProfile().name}'s details`, attrs: { type: 'button' }, on: { click: () => { dialog.close(); openProfileDialog(currentProfile()); } } }),
    store.mode === 'demo' && el('button', { className: 'btn btn--primary', text: 'Exit demo', attrs: { type: 'button' }, on: { click: () => { dialog.close(); exitDemo(); } } }),
  );
}

/* ---------------- wiring ---------------- */

$('#demo-btn').addEventListener('click', () => startDemo().catch((e) => showBanner('error', e.message)));
$('#start-btn').addEventListener('click', startOwnList);
$('#settings-btn').addEventListener('click', openSettings);
$('#add-med-btn').addEventListener('click', () => openMedicineDialog());
$('#fab-add').addEventListener('click', () => openMedicineDialog());
$('#health-btn').addEventListener('click', () => showTab('care'));
$('#demo-chip').addEventListener('click', () => exitDemo().catch((e) => showBanner('error', e.message)));
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

(async function boot() {
  const { fellBack } = await store.init();
  if (fellBack && isSupabaseConfigured) {
    showBanner('warn', 'Offline mode · saved on this device', { id: 'offline' });
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
