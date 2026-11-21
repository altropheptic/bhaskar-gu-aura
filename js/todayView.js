/**
 * Today screen: what to take now, what's done, what was missed.
 *
 * Layout follows patterns common to well-rated medication app designs:
 * greeting, week strip, one bold "Next up" card, then a time-rail timeline.
 * Each dose carries three recognition cues: the pill's look (or its photo),
 * the routine moment ("after breakfast") and where it is kept.
 *
 * Only due or missed doses for today can be logged; future doses can't be
 * "taken early" by accident, one of the ways double dosing happens.
 */
import { el, icon, showBanner, formatTime, formatClock, doseLabel, MEAL_LABEL, emptyState } from './ui.js';
import { state, undoDose, currentProfile, emit } from './state.js';
import { findLog, groupByTime, daysOfSupply, duplicateGenerics, dosesForDay, doseStatus, dayScore, addDays, startOfDay, isoDate } from './schedule.js';
import { takeOrSkip } from './doseActions.js';
import { openOneTap } from './oneTap.js';
import { speakReminder } from './voice.js';
import { openMedicineDialog } from './medForm.js';
import { doseSlotLabel } from './routine.js';
import { medMedia } from './photo.js';
import { healthSummary } from './reminderHealth.js';

/** Which day the strip has selected (null = today). */
let viewDay = null;

const STATUS_CHIP = {
  taken: (log) => el('span', { className: 'chip chip--ok' }, [icon('check'), `Taken ${formatClock(log.logged_at)}`]),
  skipped: () => el('span', { className: 'chip chip--skipped' }, [icon('skip'), 'Skipped']),
  missed: () => el('span', { className: 'chip chip--missed' }, [icon('cross'), 'Missed']),
  due: () => el('span', { className: 'chip chip--due' }, [icon('bell'), 'Due now']),
  upcoming: (_, dose) => el('span', { className: 'chip' }, [icon('clock'), formatTime(dose.time)]),
};

function greeting(now) {
  const h = now.getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

function countdown(at, now) {
  const min = Math.round((at - now) / 60_000);
  if (min <= 0) return 'now';
  if (min < 60) return `in ${min} min`;
  const h = Math.floor(min / 60);
  return `in ${h} h${min % 60 ? ` ${min % 60} min` : ''}`;
}

/** "1 tablet · After food" + routine moment, e.g. "1 tablet · After food · Breakfast". */
function howText(dose) {
  return [doseLabel(dose.med), MEAL_LABEL[dose.med.meal]].filter(Boolean).join(' · ');
}

/* ---------- week strip ---------- */
function weekStrip(today, now) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i - 3));
  const selected = viewDay ?? today;
  return el('div', { className: 'week', attrs: { role: 'group', 'aria-label': 'Choose a day' } }, days.map((day) => {
    const isToday = isoDate(day) === isoDate(today);
    const isSel = isoDate(day) === isoDate(selected);
    let dot = '';
    if (day < today) {
      const s = dayScore(state.medicines, state.logIndex, day, now);
      dot = s.counted === 0 ? '' : s.taken === s.counted ? 'week__dot--ok' : s.taken > 0 ? 'week__dot--part' : 'week__dot--none';
    }
    return el('button', {
      className: `week__day${isSel ? ' is-selected' : ''}${isToday ? ' is-today' : ''}`,
      attrs: { type: 'button', 'aria-pressed': String(isSel), 'aria-label': day.toDateString() },
      on: { click: () => { viewDay = isToday ? null : day; emit(); } },
    }, [
      el('span', { className: 'week__name', text: isToday ? 'Today' : day.toLocaleDateString([], { weekday: 'short' }) }),
      el('span', { className: 'week__num tabular', text: String(day.getDate()) }),
      el('span', { className: `week__dot ${dot}`, attrs: { 'aria-hidden': 'true' } }),
    ]);
  }));
}

/* ---------- "Next up" hero ---------- */
function hero(doses, profile, now) {
  const focus = doses.find((d) => d.status === 'due') ?? doses.find((d) => d.status === 'missed') ?? doses.find((d) => d.status === 'upcoming');
  const oneTap = el('button', { className: 'btn btn--ghost hero__ghost', attrs: { type: 'button' }, on: { click: () => openOneTap() } }, ['One-tap mode']);
  if (!focus) {
    return el('section', { className: 'hero hero--done', attrs: { 'aria-label': 'Next dose' } }, [
      el('span', { className: 'hero__badge' }, [icon('check')]),
      el('div', { className: 'hero__body' }, [
        el('p', { className: 'hero__eyebrow', text: doses.length ? 'All done' : 'Free day' }),
        el('h3', { className: 'hero__title', text: doses.length ? 'Every dose taken today' : 'Nothing scheduled today' }),
      ]),
    ]);
  }
  const { med } = focus;
  const label = focus.status === 'due' ? 'Now' : focus.status === 'missed' ? 'Missed' : 'Next up';
  const actions = el('div', { className: 'hero__actions' });
  if (focus.status !== 'upcoming') {
    const take = el('button', { className: 'btn btn--xl hero__primary', attrs: { type: 'button' } }, [icon('check'), focus.status === 'missed' ? 'I took it (late)' : 'I took it']);
    take.addEventListener('click', () => takeOrSkip(focus, 'taken', take));
    actions.append(take);
  }
  const say = el('button', { className: 'btn btn--ghost hero__ghost', attrs: { type: 'button' } }, [icon('speaker'), 'Say aloud']);
  say.addEventListener('click', () => speakReminder(profile, [med], say, { force: true }));
  actions.append(say, oneTap);

  return el('section', { className: `hero hero--${focus.status}`, attrs: { 'aria-label': 'Next dose' } }, [
    medMedia(med, 'med-media--xl'),
    el('div', { className: 'hero__body' }, [
      el('p', { className: 'hero__eyebrow', text: `${label} · ${doseSlotLabel(focus.slot, focus.time)}` }),
      el('h3', { className: 'hero__title', text: [med.name, med.dosage].filter(Boolean).join(' ') }),
      el('p', { className: 'hero__how', text: howText(focus) }),
      med.kept_at && el('p', { className: 'hero__place' }, [icon('pin'), med.kept_at]),
    ]),
    el('div', { className: 'hero__time' }, [
      el('span', { className: 'hero__clock tabular', text: formatTime(focus.time) }),
      el('span', { className: 'hero__count', text: focus.status === 'missed' ? "Don't double up" : countdown(focus.at, now) }),
    ]),
    actions,
  ]);
}

/* ---------- timeline ---------- */
function doseTile(dose, isToday) {
  const log = findLog(dose, state.logIndex);
  const { med, status } = dose;
  const side = el('div', { className: 'tile__side' }, [STATUS_CHIP[status](log, dose)]);

  if (isToday && (status === 'due' || status === 'missed')) {
    const take = el('button', {
      className: 'btn btn--primary btn--sm',
      attrs: { type: 'button', 'aria-label': `I took ${med.name} ${med.dosage ?? ''}` },
    }, [icon('check'), 'Took it']);
    take.addEventListener('click', () => takeOrSkip(dose, 'taken', take));
    const skip = el('button', { className: 'btn btn--ghost btn--sm', text: 'Skip', attrs: { type: 'button', 'aria-label': `Skip ${med.name}` } });
    skip.addEventListener('click', () => takeOrSkip(dose, 'skipped', skip));
    side.append(take, skip);
  } else if (isToday && log) {
    side.append(el('button', {
      className: 'btn btn--ghost btn--sm', text: 'Undo',
      attrs: { type: 'button', 'aria-label': `Undo ${med.name}` },
      on: { click: () => undoDose(log).catch((e) => showBanner('error', e.message)) },
    }));
  }

  return el('article', { className: `tile tile--${status}`, attrs: { 'aria-label': `${med.name} at ${formatTime(dose.time)}: ${status}` } }, [
    medMedia(med),
    el('div', { className: 'tile__main' }, [
      el('div', { className: 'tile__name', text: [med.name, med.dosage].filter(Boolean).join(' ') }),
      el('div', { className: 'tile__meta', text: howText(dose) }),
      med.kept_at && el('div', { className: 'tile__place' }, [icon('pin'), med.kept_at]),
    ]),
    side,
  ]);
}

function alerts() {
  const items = [];
  for (const med of state.medicines.filter((m) => m.active)) {
    const left = daysOfSupply(med);
    if (left !== null && left <= med.refill_at) {
      items.push(left <= 0 ? `${med.name} has run out` : `${med.name}: ${left} day${left === 1 ? '' : 's'} left, refill soon`);
    }
  }
  for (const [a, b] of duplicateGenerics(state.medicines)) {
    items.push(`${a.name} and ${b.name} are both ${a.generic_name}. Ask your doctor.`);
  }
  if (!items.length) return null;
  return el('ul', { className: 'alert-list', attrs: { 'aria-label': 'Warnings' } }, items.map((t) => el('li', {}, [icon('warn'), el('span', { text: t })])));
}

/** Small "Reminders: ready / 2 to fix" chip that opens the health check. */
function healthChip() {
  const { ready, total } = healthSummary();
  const ok = ready === total;
  return el('button', {
    className: `chip health-chip ${ok ? 'chip--ok' : 'chip--due'}`,
    attrs: { type: 'button', 'aria-label': `Reminder check: ${ready} of ${total} ready` },
    on: { click: () => document.querySelector('.nav__item[data-tab="care"]')?.click() },
  }, [icon(ok ? 'check' : 'bell'), ok ? 'Reminders ready' : `${total - ready} reminder fix${total - ready === 1 ? '' : 'es'}`]);
}

/** @param {HTMLElement} panel */
export function renderToday(panel) {
  const now = new Date();
  const today = startOfDay(now);
  if (viewDay && isoDate(viewDay) === isoDate(today)) viewDay = null;
  const day = viewDay ?? today;
  const isToday = !viewDay;
  const profile = currentProfile();

  const doses = dosesForDay(state.medicines, isToday ? now : day).map((d) => ({ ...d, status: doseStatus(d, state.logIndex, now) }));
  const done = doses.filter((d) => d.status === 'taken').length;

  const ring = el('div', { className: 'ring ring--sm', attrs: { role: 'img', 'aria-label': `${done} of ${doses.length} doses taken` } }, [el('span', { className: 'tabular', text: `${done}/${doses.length}` })]);
  ring.style.setProperty('--p', String(doses.length ? Math.round((done / doses.length) * 100) : 0));

  const head = el('div', { className: 'panel-head' }, [
    el('div', {}, [
      el('h2', { text: `${greeting(now)}, ${profile?.name ?? ''}` }),
      el('p', { text: day.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' }) }),
    ]),
    el('div', { className: 'btn-row' }, [healthChip(), ring]),
  ]);

  if (!state.medicines.length) {
    panel.replaceChildren(head, el('div', { className: 'card' }, [
      emptyState('No medicines yet.', { label: 'Add medicine', onClick: () => openMedicineDialog() }),
    ]));
    return;
  }

  const timeline = el('section', { className: 'rail', attrs: { 'aria-label': isToday ? 'Today' : day.toDateString() } });
  if (!doses.length) timeline.append(el('div', { className: 'card' }, [emptyState('No doses on this day.')]));
  for (const [time, group] of groupByTime(doses)) {
    timeline.append(el('div', { className: 'rail__row' }, [
      el('div', { className: 'rail__time' }, [
        el('span', { className: 'rail__clock tabular', text: formatTime(time) }),
        el('span', { className: 'rail__label', text: doseSlotLabel(group[0].slot, time) }),
      ]),
      el('div', { className: 'rail__tiles' }, group.map((d) => doseTile(d, isToday))),
    ]));
  }

  panel.replaceChildren(
    head,
    weekStrip(today, now),
    isToday ? hero(doses, profile, now) : '',
    isToday ? (alerts() ?? '') : '',
    timeline,
  );
}
