/**
 * The bell: one place for everything that needs the family's attention.
 *
 * Why: a reminder that has already gone off is easy to lose (the alarm was
 * dismissed, the phone was in another room). The bell gathers what is due now,
 * what was missed today or yesterday, medicines running low and any reminder
 * channel that is not ready, so nothing slips past silently.
 */
import { el, icon, doseLabel, timeEl, emptyState, openDialog } from './ui.js';
import { state, currentProfile } from './state.js';
import { dosesForDay, doseStatus, daysOfSupply, addDays } from './schedule.js';
import { takeOrSkip } from './doseActions.js';
import { healthSummary } from './reminderHealth.js';
import { medMedia } from './photo.js';

/** Everything worth a notification for the selected person, newest first. */
export function notificationItems(now = new Date()) {
  const doses = [];
  for (const [day, when] of [
    [now, 'today'],
    [addDays(now, -1), 'yesterday'],
  ]) {
    for (const dose of dosesForDay(state.medicines, day)) {
      const status = doseStatus(dose, state.logIndex, now);
      if (status === 'due' || status === 'missed') doses.push({ ...dose, status, when });
    }
  }
  doses.sort((a, b) => b.at - a.at);

  const refills = state.medicines
    .filter((m) => m.active)
    .map((med) => ({ med, left: daysOfSupply(med) }))
    .filter(({ med, left }) => left !== null && left <= med.refill_at);

  const { ready, total } = healthSummary();
  return { doses, refills, setupToFix: total - ready };
}

/** Badge number on the bell. */
export function notificationCount() {
  const { doses, refills, setupToFix } = notificationItems();
  return doses.length + refills.length + (setupToFix ? 1 : 0);
}

function doseItem(dose, rerender) {
  const { med } = dose;
  const end = el('div', { className: 'row__end' }, [
    timeEl('span', 'time-chip', dose.time),
    el('span', {
      className: `chip chip--${dose.status}`,
      text: dose.status === 'due' ? 'Due now' : dose.when === 'yesterday' ? 'Missed yesterday' : 'Missed',
    }),
  ]);
  // Only today's doses can still be logged; yesterday's are a record, not a to-do.
  if (dose.when === 'today') {
    const take = el(
      'button',
      { className: 'btn btn--primary btn--sm', attrs: { type: 'button', 'aria-label': `I took ${med.name}` } },
      [icon('check'), 'Took it'],
    );
    take.addEventListener('click', async () => {
      if (await takeOrSkip(dose, 'taken', take)) rerender();
    });
    const skip = el('button', {
      className: 'btn btn--ghost btn--sm',
      text: 'Skip',
      attrs: { type: 'button', 'aria-label': `Skip ${med.name}` },
    });
    skip.addEventListener('click', async () => {
      if (await takeOrSkip(dose, 'skipped', skip)) rerender();
    });
    end.append(take, skip);
  }
  return el(
    'article',
    { className: `row row--${dose.status}`, attrs: { 'aria-label': `${med.name}: ${dose.status} ${dose.when}` } },
    [
      medMedia(med),
      el('div', { className: 'row__main' }, [
        el('span', { className: 'row__name', text: [med.name, med.dosage].filter(Boolean).join(' ') }),
        el('span', { className: 'row__how', text: doseLabel(med) }),
      ]),
      end,
    ],
  );
}

function infoItem(iconName, title, detail, action) {
  return el('article', { className: 'row note' }, [
    el('span', { className: 'note__icon', attrs: { 'aria-hidden': 'true' } }, [icon(iconName)]),
    el('div', { className: 'row__main' }, [
      el('span', { className: 'row__name', text: title }),
      el('span', { className: 'row__how', text: detail }),
    ]),
    action ? el('div', { className: 'row__end' }, [action]) : '',
  ]);
}

/**
 * Open the notifications sheet.
 * @param {{ onFixSetup: () => void }} opts
 */
export function openNotifications({ onFixSetup }) {
  const dialog = /** @type {HTMLDialogElement} */ (document.querySelector('#info-dialog'));
  const person = currentProfile();
  const body = el('div', { className: 'notify' });

  const draw = () => {
    const { doses, refills, setupToFix } = notificationItems();
    const section = (title, items) =>
      items.length &&
      el('section', { className: 'notify__group' }, [
        el('h3', { className: 'notify__title', text: title }),
        el('div', { className: 'rows' }, items),
      ]);
    const fix = el('button', { className: 'btn btn--outline btn--sm', text: 'Fix', attrs: { type: 'button' } });
    fix.addEventListener('click', () => {
      dialog.close();
      onFixSetup();
    });

    const groups = [
      section(
        'Doses',
        doses.map((d) => doseItem(d, draw)),
      ),
      section(
        'Refill',
        refills.map(({ med, left }) =>
          infoItem('warn', med.name, left <= 0 ? 'Run out' : `${left} day${left === 1 ? '' : 's'} left`),
        ),
      ),
      section('Reminders', setupToFix ? [infoItem('bell', 'Reminder check', `${setupToFix} to fix`, fix)] : []),
    ].filter(Boolean);
    body.replaceChildren(...(groups.length ? groups : [emptyState('All caught up.')]));
  };

  draw();
  openDialog(dialog, person ? `${person.name} · Alerts` : 'Alerts', 'info-title').replaceChildren(body);
}
