/**
 * Today screen.
 *
 * Layout follows patterns shared by well-rated medication app designs:
 *   1. week strip (tap a day to look back or ahead)
 *   2. "Up next" hero: tags, the medicine, a huge time, a glossy pill and one big "Taken" button
 *   3. "Needs attention": other due or missed doses, with Took it / Skip
 *   4. "Later today": pastel cards tinted by each medicine's colour
 *   5. "Done": taken or skipped doses, with Undo
 * Each dose carries three recognition cues: the pill's look (or its photo), the
 * routine moment ("after breakfast") and where it is kept.
 *
 * Only due or missed doses for today can be logged; future doses can't be
 * "taken early" by accident, one of the ways double dosing happens.
 */
import { el, icon, pillIcon, showBanner, formatClock, doseLabel, MEAL_LABEL, emptyState, timeEl, tintClass } from './ui.js';
import { state, undoDose, currentProfile, emit } from './state.js';
import { findLog, daysOfSupply, duplicateGenerics, dosesForDay, doseStatus, dayScore, addDays, startOfDay, isoDate } from './schedule.js';
import { takeOrSkip } from './doseActions.js';
import { speakReminder } from './voice.js';
import { openMedicineDialog, openOneTap } from './lazy.js';
import { doseSlotLabel } from './routine.js';
import { medMedia, photoImg } from './photo.js';

/** Which day the strip has selected (null = today). */
let viewDay = null;

function countdown(at, now) {
  const min = Math.round((at - now) / 60_000);
  if (min <= 0) return 'now';
  if (min < 60) return `in ${min} min`;
  const h = Math.floor(min / 60);
  return `in ${h} h${min % 60 ? ` ${min % 60} min` : ''}`;
}

/** "1 tablet · After food · Breakfast" */
const howText = (dose) => [doseLabel(dose.med), MEAL_LABEL[dose.med.meal], doseSlotLabel(dose.slot, dose.time)].filter(Boolean).join(' · ');

const placeEl = (med) => med.kept_at && el('span', { className: 'place' }, [icon('pin'), med.kept_at]);

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
      attrs: { type: 'button', 'aria-pressed': String(isSel), 'aria-label': `${day.toDateString()}${isToday ? ' (today)' : ''}` },
      on: { click: () => { viewDay = isToday ? null : day; emit(); } },
    }, [
      el('span', { className: 'week__name', text: day.toLocaleDateString([], { weekday: 'short' }) }),
      el('span', { className: 'week__num tabular', text: String(day.getDate()) }),
      el('span', { className: `week__dot ${dot}`, attrs: { 'aria-hidden': 'true' } }),
    ]);
  }));
}

/* ---------- "Up next" hero ---------- */
function hero(focus, doses, profile, now) {
  if (!focus) {
    return el('section', { className: 'next next--done', attrs: { 'aria-label': 'Next dose' } }, [
      el('span', { className: 'next__badge', attrs: { 'aria-hidden': 'true' } }, [icon('check')]),
      el('div', { className: 'stack' }, [
        el('span', { className: 'tag tag--lime', text: doses.length ? 'All done' : 'Free day' }),
        el('p', { className: 'next__name', text: doses.length ? 'Every dose taken today. Well done!' : 'Nothing scheduled today.' }),
      ]),
    ]);
  }
  const { med } = focus;
  const tags = el('div', { className: 'next__tags' }, [
    focus.status === 'due' ? el('span', { className: 'tag tag--due' }, [icon('bell'), 'Due now'])
      : focus.status === 'missed' ? el('span', { className: 'tag tag--missed' }, [icon('cross'), 'Missed'])
        : el('span', { className: 'tag tag--lime', text: 'Up next' }),
    el('span', { className: 'tag tag--ghost', text: focus.status === 'missed' ? `was due ${formatClock(focus.at)}` : countdown(focus.at, now) }),
  ]);

  const actions = el('div', { className: 'next__actions' });
  const say = el('button', { className: 'round-btn', attrs: { type: 'button', 'aria-label': 'Say it aloud' } }, [icon('speaker')]);
  say.addEventListener('click', () => speakReminder(profile, [med], undefined, { force: true }));
  const big = el('button', { className: 'round-btn', attrs: { type: 'button', 'aria-label': 'One-tap big mode' }, on: { click: () => openOneTap() } }, [icon('expand')]);
  actions.append(say, big);
  if (focus.status !== 'upcoming') {
    const take = el('button', { className: 'btn-taken', attrs: { type: 'button' } }, [icon('check'), focus.status === 'missed' ? 'Took it late' : 'Taken']);
    take.addEventListener('click', () => takeOrSkip(focus, 'taken', take));
    actions.append(take);
  } else {
    actions.append(el('span', { className: 'muted', text: 'You can mark it from 30 min before.' }));
  }

  return el('section', { className: `next next--${focus.status} ${tintClass(med.color)}`, attrs: { 'aria-label': 'Next dose' } }, [
    tags,
    el('div', { className: 'next__info' }, [
      el('p', { className: 'next__name', text: [med.name, med.dosage].filter(Boolean).join(' ') }),
      el('p', { className: 'next__how', text: howText(focus) }),
      placeEl(med),
    ]),
    el('div', { className: 'next__art' }, [med.photo ? el('span', { className: 'med-media med-media--xl' }, [photoImg(med.photo, `Photo of ${med.name}`)]) : pillIcon(med)]),
    timeEl('p', 'next__time', focus.time),
    focus.status === 'missed' && el('p', { className: 'next__note', text: "Don't take two doses together to catch up." }),
    actions,
  ]);
}

/* ---------- rows and cards ---------- */
const STATUS_CHIP = {
  taken: (log) => el('span', { className: 'chip chip--ok' }, [icon('check'), `Taken ${formatClock(log.logged_at)}`]),
  skipped: () => el('span', { className: 'chip chip--skipped' }, [icon('skip'), 'Skipped']),
  missed: () => el('span', { className: 'chip chip--missed' }, [icon('cross'), 'Missed']),
  due: () => el('span', { className: 'chip chip--due' }, [icon('bell'), 'Due now']),
};

function doseRow(dose, isToday) {
  const log = findLog(dose, state.logIndex);
  const { med, status } = dose;
  const end = el('div', { className: 'row__end' }, [timeEl('span', 'time-chip', dose.time)]);
  if (status !== 'upcoming') end.append(STATUS_CHIP[status](log));

  if (isToday && (status === 'due' || status === 'missed')) {
    const take = el('button', { className: 'btn btn--primary btn--sm', attrs: { type: 'button', 'aria-label': `I took ${med.name}` } }, [icon('check'), 'Took it']);
    take.addEventListener('click', () => takeOrSkip(dose, 'taken', take));
    const skip = el('button', { className: 'btn btn--ghost btn--sm', text: 'Skip', attrs: { type: 'button', 'aria-label': `Skip ${med.name}` } });
    skip.addEventListener('click', () => takeOrSkip(dose, 'skipped', skip));
    end.append(take, skip);
  } else if (isToday && log) {
    end.append(el('button', {
      className: 'btn btn--ghost btn--sm', text: 'Undo', attrs: { type: 'button', 'aria-label': `Undo ${med.name}` },
      on: { click: () => undoDose(log).catch((e) => showBanner('error', e.message)) },
    }));
  }

  return el('article', { className: `row row--${status}`, attrs: { 'aria-label': `${med.name}: ${status}` } }, [
    medMedia(med),
    el('div', { className: 'row__main' }, [
      el('span', { className: 'row__name', text: [med.name, med.dosage].filter(Boolean).join(' ') }),
      el('span', { className: 'row__how', text: howText(dose) }),
      placeEl(med),
    ]),
    end,
  ]);
}

function laterCard(dose) {
  const { med } = dose;
  return el('article', { className: `later ${tintClass(med.color)}`, attrs: { 'aria-label': `${med.name} later today` } }, [
    el('div', { className: 'later__art' }, [med.photo ? medMedia(med) : pillIcon(med)]),
    timeEl('p', 'later__time', dose.time),
    el('p', { className: 'later__name', text: [med.name, med.dosage].filter(Boolean).join(' ') }),
    el('p', { className: 'later__how', text: `${doseLabel(med)} · ${doseSlotLabel(dose.slot, dose.time)}` }),
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

const secHead = (title, note) => el('div', { className: 'sec-head' }, [el('h3', { text: title }), note && el('span', { text: note })]);

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
      el('p', { className: 'eyebrow-date', text: day.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' }) }),
      el('h2', { text: isToday ? 'Today' : day.toLocaleDateString([], { weekday: 'long' }) }),
    ]),
    ring,
  ]);

  if (!state.medicines.length) {
    panel.replaceChildren(head, el('div', { className: 'card' }, [
      emptyState(`No medicines yet for ${profile?.name ?? 'this person'}.`, { label: 'Add medicine', onClick: () => openMedicineDialog() }),
    ]));
    return;
  }

  // Another day: one simple read-only list
  if (!isToday) {
    panel.replaceChildren(
      head,
      weekStrip(today, now),
      doses.length ? el('div', { className: 'rows' }, doses.map((d) => doseRow(d, false))) : el('div', { className: 'card' }, [emptyState('No doses on this day.')]),
    );
    return;
  }

  const focus = doses.find((d) => d.status === 'due') ?? doses.find((d) => d.status === 'missed') ?? doses.find((d) => d.status === 'upcoming');
  const rest = doses.filter((d) => d !== focus);
  const attention = rest.filter((d) => d.status === 'due' || d.status === 'missed');
  const later = rest.filter((d) => d.status === 'upcoming');
  const finished = rest.filter((d) => d.status === 'taken' || d.status === 'skipped');

  panel.replaceChildren(
    head,
    weekStrip(today, now),
    hero(focus, doses, profile, now),
    alerts() ?? '',
    attention.length ? secHead('Needs attention', `${attention.length}`) : '',
    attention.length ? el('div', { className: 'rows' }, attention.map((d) => doseRow(d, true))) : '',
    later.length ? secHead('Later today', `${later.length} more`) : '',
    later.length ? el('div', { className: 'later-grid' }, later.map(laterCard)) : '',
    finished.length ? secHead('Done', `${finished.length}`) : '',
    finished.length ? el('div', { className: 'rows' }, finished.map((d) => doseRow(d, true))) : '',
  );
}
