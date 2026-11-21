/**
 * Family screen: four equal cards for caregiver sharing, emergency card,
 * phone-calendar alarms and voice. Each card = icon + title, one short line,
 * actions pinned to the bottom, so the 2×2 grid stays visually symmetric.
 */
import { el, icon, showBanner, toast, setLoading } from './ui.js';
import { state, currentProfile, loadProfileData } from './state.js';
import { store } from './store.js';
import { todayDoses } from './doseActions.js';
import { todaySummaryText, shareOnWhatsApp, createCaregiverLink } from './share.js';
import { printEmergencyCard } from './reports.js';
import { downloadIcs } from './ics.js';
import { openProfileDialog } from './profileDialog.js';
import { speakReminder } from './voice.js';

/** Shared card frame. */
function card(iconName, title, line, body, actions) {
  return el('section', { className: 'card' }, [
    el('div', { className: 'card__head' }, [icon(iconName), el('h3', { text: title })]),
    line && el('p', { className: 'muted', text: line }),
    ...body,
    actions?.length ? el('div', { className: 'card__foot' }, actions) : null,
  ]);
}

function familyCard(profile) {
  const wa = el('button', { className: 'btn btn--primary', attrs: { type: 'button' } }, [icon('chat'), 'WhatsApp update']);
  wa.addEventListener('click', () => shareOnWhatsApp(todaySummaryText(profile, todayDoses())));

  if (store.mode !== 'cloud') {
    const why = store.mode === 'demo' ? 'Live links are off in the demo.' : 'Live links need internet.';
    return card('family', 'Family', `Share today's doses. ${why}`, [], [wa]);
  }

  const labelIn = el('input', { attrs: { id: 'cg-label', maxlength: 40, placeholder: 'Name, e.g. Priya', autocomplete: 'off', 'aria-label': 'Who is the link for' } });
  const create = el('button', { className: 'btn btn--outline', attrs: { type: 'button' } }, [icon('link'), 'Create link']);
  const result = el('div', { className: 'stack', attrs: { 'aria-live': 'polite' } });
  create.addEventListener('click', async () => {
    setLoading(create, true, 'Creating…');
    try {
      const { url } = await createCaregiverLink(profile.id, labelIn.value.trim() || 'Family');
      const copy = el('button', { className: 'btn btn--sm btn--primary', text: 'Copy', attrs: { type: 'button' } });
      copy.addEventListener('click', async () => {
        try { await navigator.clipboard.writeText(url); toast('Link copied'); } catch { showBanner('info', 'Select the link to copy it.'); }
      });
      const send = el('button', { className: 'btn btn--sm btn--outline', attrs: { type: 'button' } }, [icon('chat'), 'Send']);
      send.addEventListener('click', () => shareOnWhatsApp(`${profile.name}'s medicines today (read-only): ${url}`));
      result.replaceChildren(
        el('p', { className: 'share-url', text: url }),
        el('p', { className: 'field__hint', text: 'Shown once. Save it now.' }),
        el('div', { className: 'btn-row' }, [copy, send]),
      );
      labelIn.value = '';
      await loadProfileData();
    } catch (err) {
      showBanner('error', err.message);
    } finally {
      setLoading(create, false);
    }
  });

  const active = state.links.filter((l) => !l.revoked && new Date(l.expires_at) > new Date());
  const list = active.length && el('ul', { className: 'link-list', attrs: { 'aria-label': 'Active links' } }, active.map((l) => {
    const revoke = el('button', { className: 'btn btn--danger btn--sm', text: 'Turn off', attrs: { type: 'button' } });
    revoke.addEventListener('click', async () => {
      try { await store.revokeLink(l.id); await loadProfileData(); toast('Link turned off'); } catch (e) { showBanner('error', e.message); }
    });
    return el('li', {}, [el('span', { text: l.label || 'Family' }), revoke]);
  }));

  return card('family', 'Family', 'Private live view or a WhatsApp update.', [labelIn, result, list || null], [create, wa]);
}

function emergencyCard(profile) {
  const row = (k, v) => [el('dt', { text: k }), el('dd', { text: v || '—' })];
  return card('warn', 'Emergency card', null, [
    el('dl', { className: 'kv' }, [
      ...row('Blood group', profile.blood_group),
      ...row('Allergies', profile.allergies),
      ...row('Conditions', profile.conditions),
      ...row('Contact', [profile.emergency_name, profile.emergency_phone].filter(Boolean).join(' · ')),
    ]),
  ], [
    el('button', { className: 'btn btn--primary', attrs: { type: 'button' }, on: { click: () => printEmergencyCard() } }, [icon('print'), 'Print']),
    el('button', { className: 'btn btn--ghost', text: 'Edit', attrs: { type: 'button' }, on: { click: () => openProfileDialog(profile) } }),
  ]);
}

function calendarCard(profile) {
  const btn = el('button', { className: 'btn btn--outline', attrs: { type: 'button' } }, [icon('calendar'), 'Download']);
  btn.addEventListener('click', () => {
    if (!state.medicines.some((m) => m.active)) { showBanner('info', 'Add a medicine first.'); return; }
    downloadIcs(profile, state.medicines);
    toast('Open the file to add alarms');
  });
  return card('calendar', 'Calendar alarms', 'Rings even when this app is closed.', [], [btn]);
}

function voiceCard(profile) {
  const test = el('button', { className: 'btn btn--outline', attrs: { type: 'button' } }, [icon('speaker'), 'Play sample']);
  test.addEventListener('click', () => {
    const med = state.medicines.find((m) => m.active) ?? { name: 'Metformin', dose_qty: 1, form: 'tablet', meal: 'after' };
    speakReminder(profile, [med], test, { force: true });
  });
  return card('speaker', 'Voice', `Reminders in ${profile.language === 'hi' ? 'Hindi' : 'English'}.`, [], [
    test,
    el('button', { className: 'btn btn--ghost', text: 'Change', attrs: { type: 'button' }, on: { click: () => openProfileDialog(profile) } }),
  ]);
}

/** @param {HTMLElement} panel */
export function renderCare(panel) {
  const profile = currentProfile();
  if (!profile) { panel.replaceChildren(); return; }
  panel.replaceChildren(
    el('div', { className: 'panel-head' }, [
      el('div', {}, [el('h2', { text: 'Family & safety' }), el('p', { text: profile.name })]),
    ]),
    el('div', { className: 'grid-2' }, [familyCard(profile), emergencyCard(profile), calendarCard(profile), voiceCard(profile)]),
  );
}
