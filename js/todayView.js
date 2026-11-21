/**
 * Today screen: what to take now, what's done, what was missed.
 *
 * Designed for elders: one big "I took it" button per due dose, the pill's real
 * colour and shape, plain-language food timing, and an Undo after every tap.
 * Only due or missed doses can be logged; future doses can't be "taken early"
 * by accident, which is one of the ways double dosing happens.
 */
import { el, icon, pillIcon, showBanner, formatTime, formatClock, doseLabel, MEAL_LABEL, emptyState } from './ui.js';
import { state, undoDose, currentProfile } from './state.js';
import { groupByTime, slotLabel, daysOfSupply, duplicateGenerics } from './schedule.js';
import { todayDoses, takeOrSkip } from './doseActions.js';
import { openOneTap } from './oneTap.js';
import { speakReminder } from './voice.js';
import { openMedicineDialog } from './medForm.js';

const STATUS_CHIP = {
  taken: (log) => el('span', { className: 'chip chip--ok' }, [icon('check'), `Taken ${formatClock(log.logged_at)}`]),
  skipped: () => el('span', { className: 'chip chip--skipped' }, [icon('skip'), 'Skipped']),
  missed: () => el('span', { className: 'chip chip--missed' }, [icon('cross'), 'Missed']),
  due: () => el('span', { className: 'chip chip--due' }, [icon('bell'), 'Due now']),
  upcoming: (_, dose) => el('span', { className: 'chip' }, [icon('clock'), formatTime(dose.time)]),
};

function doseRow(dose) {
  const log = state.logIndex.get(dose.key);
  const { med, status } = dose;
  const actions = el('div', { className: 'dose__actions' }, [STATUS_CHIP[status](log, dose)]);

  if (status === 'due' || status === 'missed') {
    const take = el('button', {
      className: 'btn btn--primary',
      attrs: { type: 'button', 'aria-label': `I took ${med.name} ${med.dosage ?? ''}` },
    }, [icon('check'), status === 'missed' ? 'I took it (late)' : 'I took it']);
    take.addEventListener('click', () => takeOrSkip(dose, 'taken', take));
    const skip = el('button', { className: 'btn btn--ghost btn--sm', text: 'Skip', attrs: { type: 'button', 'aria-label': `Skip ${med.name}` } });
    skip.addEventListener('click', () => takeOrSkip(dose, 'skipped', skip));
    actions.append(take, skip);
  } else if (log) {
    actions.append(el('button', {
      className: 'btn btn--ghost btn--sm', text: 'Undo',
      attrs: { type: 'button', 'aria-label': `Undo ${med.name}` },
      on: { click: () => undoDose(log).catch((e) => showBanner('error', e.message)) },
    }));
  }

  return el('article', { className: `dose dose--${status}`, attrs: { 'aria-label': `${med.name} at ${formatTime(dose.time)}: ${status}` } }, [
    pillIcon(med),
    el('div', {}, [
      el('div', { className: 'dose__name', text: [med.name, med.dosage].filter(Boolean).join(' ') }),
      el('div', { className: 'dose__meta' }, [
        el('span', { text: doseLabel(med) }),
        el('span', { className: 'chip chip--meal', text: MEAL_LABEL[med.meal] ?? 'Any time' }),
      ]),
    ]),
    actions,
    status === 'missed' && el('p', { className: 'dose__note', text: "Missed. Don't take two at once." }),
  ]);
}

function alerts() {
  const items = [];
  for (const med of state.medicines.filter((m) => m.active)) {
    const left = daysOfSupply(med);
    if (left !== null && left <= med.refill_at) {
      items.push(left <= 0
        ? `${med.name} has run out`
        : `${med.name}: ${left} day${left === 1 ? '' : 's'} left, refill soon`);
    }
  }
  for (const [a, b] of duplicateGenerics(state.medicines)) {
    items.push(`${a.name} and ${b.name} are both ${a.generic_name}. Ask your doctor.`);
  }
  if (!items.length) return null;
  return el('ul', { className: 'alert-list', attrs: { 'aria-label': 'Warnings' } }, items.map((t) => el('li', {}, [icon('warn'), el('span', { text: t })])));
}

/** @param {HTMLElement} panel */
export function renderToday(panel) {
  const now = new Date();
  const profile = currentProfile();
  const doses = todayDoses(now);
  const done = doses.filter((d) => d.status === 'taken').length;
  const pct = doses.length ? Math.round((done / doses.length) * 100) : 0;
  const next = doses.find((d) => d.status === 'due' || d.status === 'upcoming');
  const missedCount = doses.filter((d) => d.status === 'missed').length;

  const dateText = now.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' });
  const head = el('div', { className: 'panel-head' }, [
    el('div', {}, [el('h2', { text: 'Today' }), el('p', { text: dateText })]),
  ]);

  if (!state.medicines.length) {
    panel.replaceChildren(head, el('div', { className: 'card' }, [
      emptyState('No medicines yet.', { label: 'Add medicine', onClick: () => openMedicineDialog() }),
    ]));
    return;
  }

  const ring = el('div', { className: 'ring', attrs: { role: 'img', 'aria-label': `${done} of ${doses.length} doses taken today` } }, [el('span', { text: `${pct}%` })]);
  ring.style.setProperty('--p', String(pct));

  const nextText = next
    ? next.status === 'due' ? `Now: ${next.med.name}` : `Next: ${next.med.name} at ${formatTime(next.time)}`
    : missedCount ? `${missedCount} missed today` : doses.length ? 'All done for today' : 'Nothing scheduled today';

  const speakBtn = el('button', { className: 'btn btn--outline', attrs: { type: 'button', disabled: !next } }, [icon('speaker'), 'Say aloud']);
  speakBtn.addEventListener('click', () => next && speakReminder(profile, [next.med], speakBtn, { force: true }));
  const bigBtn = el('button', { className: 'btn btn--accent', attrs: { type: 'button' }, on: { click: () => openOneTap() } }, ['One-tap mode']);

  const summary = el('section', { className: 'card summary', attrs: { 'aria-label': 'Today summary' } }, [
    ring,
    el('div', {}, [
      el('p', { className: 'next-dose', text: nextText }),
      el('p', { className: 'summary__sub', text: `${done} of ${doses.length} taken` }),
    ]),
    el('div', { className: 'summary__actions' }, [speakBtn, bigBtn]),
  ]);

  const timeline = el('section', { className: 'stack', attrs: { 'aria-label': 'Today timeline' } });
  if (!doses.length) timeline.append(el('div', { className: 'card' }, [emptyState('No doses scheduled for today.')]));
  for (const [time, group] of groupByTime(doses)) {
    timeline.append(el('div', { className: 'slot' }, [
      el('div', { className: 'slot__head' }, [
        el('h3', { className: 'slot__time tabular', text: formatTime(time) }),
        el('span', { className: 'slot__label', text: slotLabel(time) }),
      ]),
      ...group.map(doseRow),
    ]));
  }

  panel.replaceChildren(head, summary, alerts() ?? '', timeline);
}
