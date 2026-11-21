/**
 * Family & safety screen: four equal cards in a 2×2 grid:
 * caregiver sharing, emergency card, daily routine and the reminder check
 * (which also covers calendar alarms and voice). Each card = icon + title,
 * short content, actions pinned to the bottom.
 */
import { el, icon, showBanner, toast, setLoading, formatTime } from './ui.js';
import { state, currentProfile, loadProfileData } from './state.js';
import { store } from './store.js';
import { todayDoses } from './doseActions.js';
import { todaySummaryText, shareOnWhatsApp, createCaregiverLink } from './share.js';
import { printEmergencyCard, openProfileDialog } from './lazy.js';
import { healthCard } from './reminderHealth.js';
import { SLOTS, SLOT_LABEL, ROUTINE_FIELDS, routineOf } from './routine.js';

/** Newest caregiver link, shown until the user leaves this screen. */
let lastLink = null;
/** Called when leaving the Family screen: the raw link is never kept longer. */
export function forgetLastLink() { lastLink = null; }

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
    const why = 'Live links need internet.';
    return card('family', 'Family', `Share today's doses. ${why}`, [], [wa]);
  }

  const labelIn = el('input', { attrs: { id: 'cg-label', maxlength: 40, placeholder: 'Name, e.g. Priya', autocomplete: 'off', 'aria-label': 'Who is the link for' } });
  const create = el('button', { className: 'btn btn--outline', attrs: { type: 'button' } }, [icon('link'), 'Create link']);
  const result = el('div', { className: 'stack', attrs: { 'aria-live': 'polite' } });
  // The raw link exists only in memory (the database keeps a hash), so remember the
  // newest one here; otherwise the refresh after saving would wipe it from screen.
  if (lastLink && lastLink.profileId === profile.id) {
    const { url } = lastLink;
    const copy = el('button', { className: 'btn btn--sm btn--primary', text: 'Copy', attrs: { type: 'button' } });
    copy.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(url); toast('Link copied'); } catch { showBanner('info', 'Select the link to copy it.'); }
    });
    const send = el('button', { className: 'btn btn--sm btn--outline', attrs: { type: 'button' } }, [icon('chat'), 'Send']);
    send.addEventListener('click', () => shareOnWhatsApp(`${profile.name}'s medicines today (read-only): ${url}`));
    result.append(
      el('p', { className: 'share-url', text: url }),
      el('p', { className: 'field__hint', text: 'Shown once. Save it now.' }),
      el('div', { className: 'btn-row' }, [copy, send]),
    );
  }
  create.addEventListener('click', async () => {
    setLoading(create, true, 'Creating…');
    try {
      const { url } = await createCaregiverLink(profile.id, labelIn.value.trim() || 'Family');
      lastLink = { profileId: profile.id, url };
      await loadProfileData(); // re-renders this card with the link shown
    } catch (err) {
      showBanner('error', err.message);
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

function routineCard(profile) {
  const r = routineOf(profile);
  return card('clock', 'Daily routine', 'Doses follow these moments.', [
    el('dl', { className: 'kv' }, SLOTS.flatMap((s) => [el('dt', { text: SLOT_LABEL[s] }), el('dd', { className: 'tabular', text: formatTime(r[ROUTINE_FIELDS[s]]) })])),
  ], [
    el('button', { className: 'btn btn--outline', text: 'Change routine', attrs: { type: 'button' }, on: { click: () => openProfileDialog(profile) } }),
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
    el('div', { className: 'grid-2' }, [healthCard(), routineCard(profile), familyCard(profile), emergencyCard(profile)]),
  );
}
