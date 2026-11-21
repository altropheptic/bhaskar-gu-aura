/**
 * Family & safety screen: caregiver links, WhatsApp summary, emergency card,
 * phone-calendar alarms and voice settings for the selected person.
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

function caregiverCard(profile) {
  const card = el('section', { className: 'card' }, [
    el('h3', {}, ['Keep family in the loop']),
    el('p', { className: 'muted', text: `Send today's status, or give a son, daughter or neighbour a private live view of ${profile.name}'s doses.` }),
  ]);

  const wa = el('button', { className: 'btn btn--primary', attrs: { type: 'button' } }, [icon('chat'), "Send today's update on WhatsApp"]);
  wa.addEventListener('click', () => shareOnWhatsApp(todaySummaryText(profile, todayDoses())));
  card.append(el('div', { className: 'btn-row' }, [wa]));

  card.append(el('h3', { text: 'Caregiver link' }));
  if (store.mode !== 'cloud') {
    card.append(el('p', { className: 'muted', text: store.mode === 'demo'
      ? 'Caregiver links work with your own list (they are switched off in the demo). Exit the demo to create one.'
      : 'Caregiver links need an internet connection. Your list is currently saved on this device only.' }));
    return card;
  }

  const labelIn = el('input', { attrs: { id: 'cg-label', maxlength: 40, placeholder: 'e.g. Priya (daughter)', autocomplete: 'off' } });
  const create = el('button', { className: 'btn btn--outline', attrs: { type: 'button' } }, [icon('link'), 'Create link']);
  const result = el('div', { attrs: { 'aria-live': 'polite' } });
  create.addEventListener('click', async () => {
    setLoading(create, true, 'Creating…');
    try {
      const { url } = await createCaregiverLink(profile.id, labelIn.value.trim() || 'Family');
      const copy = el('button', { className: 'btn btn--sm btn--primary', text: 'Copy link', attrs: { type: 'button' } });
      copy.addEventListener('click', async () => {
        try { await navigator.clipboard.writeText(url); toast('Link copied.'); } catch { showBanner('info', 'Select the link and copy it.'); }
      });
      const send = el('button', { className: 'btn btn--sm btn--outline', attrs: { type: 'button' } }, [icon('chat'), 'Send on WhatsApp']);
      send.addEventListener('click', () => shareOnWhatsApp(`See ${profile.name}'s medicines for today on Dawai Dost (read-only): ${url}`));
      result.replaceChildren(
        el('p', { className: 'field__hint', text: 'Save or send it now. For privacy we only keep a scrambled copy, so it cannot be shown again.' }),
        el('p', { className: 'share-url', text: url }),
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

  card.append(
    el('div', { className: 'field' }, [el('label', { text: 'Who is it for?', attrs: { for: 'cg-label' } }), labelIn]),
    el('div', { className: 'btn-row' }, [create]),
    result,
  );

  const active = state.links.filter((l) => !l.revoked && new Date(l.expires_at) > new Date());
  if (active.length) {
    card.append(el('ul', { className: 'link-list', attrs: { 'aria-label': 'Active caregiver links' } }, active.map((l) => {
      const revoke = el('button', { className: 'btn btn--danger btn--sm', text: 'Turn off', attrs: { type: 'button' } });
      revoke.addEventListener('click', async () => {
        try { await store.revokeLink(l.id); await loadProfileData(); toast('Link turned off.'); } catch (e) { showBanner('error', e.message); }
      });
      return el('li', {}, [
        el('span', { text: `${l.label || 'Family'} · expires ${new Date(l.expires_at).toLocaleDateString()}` }),
        revoke,
      ]);
    })));
  }
  return card;
}

function emergencyCard(profile) {
  const line = (label, value) => el('p', {}, [el('strong', { text: `${label}: ` }), value || 'Not added']);
  return el('section', { className: 'card' }, [
    el('h3', { text: 'Emergency card' }),
    line('Blood group', profile.blood_group),
    line('Allergies', profile.allergies),
    line('Conditions', profile.conditions),
    line('Emergency contact', [profile.emergency_name, profile.emergency_phone].filter(Boolean).join(' · ')),
    el('div', { className: 'btn-row' }, [
      el('button', { className: 'btn btn--primary', attrs: { type: 'button' }, on: { click: () => printEmergencyCard() } }, [icon('print'), 'Print emergency card']),
      el('button', { className: 'btn btn--ghost', text: 'Edit details', attrs: { type: 'button' }, on: { click: () => openProfileDialog(profile) } }),
    ]),
  ]);
}

function calendarCard(profile) {
  const btn = el('button', { className: 'btn btn--outline', attrs: { type: 'button' } }, [icon('calendar'), 'Add alarms to phone calendar']);
  btn.addEventListener('click', () => {
    if (!state.medicines.some((m) => m.active)) { showBanner('info', 'Add a medicine first.'); return; }
    downloadIcs(profile, state.medicines);
    toast('Calendar file downloaded. Open it to add the alarms.');
  });
  return el('section', { className: 'card' }, [
    el('h3', { text: 'Alarms even when the browser is closed' }),
    el('p', { className: 'muted', text: "Download the schedule and open it on the phone. The phone's own calendar will ring at every dose time. Do this again after changing medicines." }),
    btn,
  ]);
}

function voiceCard(profile) {
  const test = el('button', { className: 'btn btn--outline', attrs: { type: 'button' } }, [icon('speaker'), 'Hear a sample reminder']);
  test.addEventListener('click', () => {
    const med = state.medicines.find((m) => m.active) ?? { name: 'Metformin', dose_qty: 1, form: 'tablet', meal: 'after' };
    speakReminder(profile, [med], test, { force: true });
  });
  return el('section', { className: 'card' }, [
    el('h3', { text: 'Voice reminders' }),
    el('p', { className: 'muted', text: `Reminders are spoken in ${profile.language === 'hi' ? 'Hindi' : 'English'} using a natural ElevenLabs voice (the phone's own voice is used if offline). Change the language with "Edit details".` }),
    test,
  ]);
}

/** @param {HTMLElement} panel */
export function renderCare(panel) {
  const profile = currentProfile();
  if (!profile) { panel.replaceChildren(); return; }
  panel.replaceChildren(
    el('div', { className: 'panel-head' }, [
      el('div', {}, [el('h2', { text: 'Family & safety' }), el('p', { text: `For ${profile.name}` })]),
    ]),
    el('div', { className: 'care-grid' }, [caregiverCard(profile), emergencyCard(profile), calendarCard(profile), voiceCard(profile)]),
  );
}
