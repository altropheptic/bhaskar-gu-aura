/**
 * Progress screen: adherence, streaks and encouragement, plus the doctor report.
 *
 * Why encouragement and not just numbers: older adults keep using a tool when it
 * feels supportive. Streak badges reward consistency, and a missed day is
 * framed gently, never as failure.
 */
import { el, icon, emptyState } from './ui.js';
import { state, currentProfile } from './state.js';
import { adherence, streak, perMedicine, dosesForDay, doseStatus, addDays, startOfDay } from './schedule.js';
import { printDoctorReport } from './lazy.js';

const DAYS_SHOWN = 14;

/** Cell state for one medicine on one day. */
function cellFor(med, day, now) {
  const doses = dosesForDay([med], day);
  if (!doses.length) return { cls: '', label: 'Not scheduled' };
  const statuses = doses.map((d) => doseStatus(d, state.logIndex, now)).filter((s) => s !== 'upcoming' && s !== 'due');
  if (!statuses.length) return { cls: '', label: 'Not yet due' };
  const taken = statuses.filter((s) => s === 'taken').length;
  if (taken === statuses.length) return { cls: 'cell--full', label: 'All taken', mark: 'check' };
  if (taken > 0) return { cls: 'cell--part', label: `${taken} of ${statuses.length} taken`, mark: 'skip' };
  return { cls: 'cell--none', label: 'Missed or skipped', mark: 'cross' };
}

function encouragement(pct, days) {
  if (pct === null) return 'Progress appears after the first doses.';
  if (days >= 7) return `${days} days in a row. Wonderful.`;
  if (pct >= 90) return 'Excellent week. Keep it up.';
  if (pct >= 70) return 'Good going. One-tap mode can help.';
  return 'Every dose counts. Try voice reminders.';
}

/** @param {HTMLElement} panel */
export function renderHistory(panel) {
  const profile = currentProfile();
  const now = new Date();
  const head = el('div', { className: 'panel-head' }, [
    el('div', {}, [el('h2', { text: 'Progress' }), el('p', { text: `Last 14 days · ${profile?.name ?? ''}` })]),
    el('button', { className: 'btn btn--outline', attrs: { type: 'button' }, on: { click: () => printDoctorReport() } }, [icon('print'), 'Doctor report']),
  ]);
  if (!state.medicines.length) {
    panel.replaceChildren(head, el('div', { className: 'card' }, [emptyState('No medicines yet.')]));
    return;
  }

  const week = adherence(state.medicines, state.logIndex, 7, now);
  const fortnight = adherence(state.medicines, state.logIndex, 14, now);
  const days = streak(state.medicines, state.logIndex, now);
  let missedWeek = 0;
  for (let i = 0; i < 7; i += 1) {
    for (const d of dosesForDay(state.medicines, addDays(startOfDay(now), -i))) {
      const s = doseStatus(d, state.logIndex, now);
      if (s === 'missed' || s === 'skipped') missedWeek += 1;
    }
  }

  const stat = (value, label) => el('div', { className: 'stat' }, [el('p', { className: 'stat__value tabular', text: value }), el('p', { className: 'stat__label', text: label })]);
  // Hero: one big ring for this week, then the supporting numbers.
  const bigRing = el('div', { className: 'ring ring--lg', attrs: { role: 'img', 'aria-label': `${week ?? 0}% of doses taken this week` } }, [el('span', { className: 'tabular', text: week === null ? '–' : `${week}%` })]);
  bigRing.style.setProperty('--p', String(week ?? 0));
  const stats = el('div', { className: 'prog-hero' }, [
    el('section', { className: 'card prog-ring' }, [
      bigRing,
      el('div', { className: 'stack' }, [
        el('span', { className: 'tag tag--lime', text: 'This week' }),
        el('h3', { text: 'Doses taken' }),
        el('p', { text: encouragement(week, days) }),
      ]),
    ]),
    el('div', { className: 'stats' }, [
      stat(fortnight === null ? '–' : `${fortnight}%`, '14-day adherence'),
      stat(`${days}`, 'Day streak'),
      stat(`${missedWeek}`, 'Missed (7 days)'),
    ]),
  ]);

  const badgeDefs = [[3, '3-day streak'], [7, 'Perfect week'], [14, 'Two strong weeks'], [30, 'Month of care']];
  const badges = el('div', { className: 'badges', attrs: { 'aria-label': 'Streak badges' } }, badgeDefs.map(([n, label]) => el('span', {
    className: `badge${days >= n ? ' badge--earned' : ''}`,
    text: label,
    attrs: { 'aria-label': `${label}: ${days >= n ? 'earned' : 'not yet earned'}` },
  })));

  // 14-day grid: rows = medicines, columns = days (oldest -> today)
  const dayList = Array.from({ length: DAYS_SHOWN }, (_, i) => addDays(startOfDay(now), i - DAYS_SHOWN + 1));
  const meds = state.medicines.filter((m) => m.active);
  const table = el('table', { className: 'adherence-grid' }, [
    el('caption', { className: 'visually-hidden', text: 'Doses taken per medicine per day, last 14 days' }),
    el('thead', {}, [el('tr', {}, [
      el('th', { text: 'Medicine', attrs: { scope: 'col' } }),
      ...dayList.map((d) => el('th', { text: d.toLocaleDateString([], { day: 'numeric' }), attrs: { scope: 'col', title: d.toDateString() } })),
    ])]),
    el('tbody', {}, meds.map((med) => el('tr', {}, [
      el('th', { text: med.name, attrs: { scope: 'row' } }),
      ...dayList.map((d) => {
        const c = cellFor(med, d, now);
        return el('td', {}, [el('span', { className: `cell ${c.cls}`, attrs: { title: `${d.toDateString()}: ${c.label}`, 'aria-label': `${d.toDateString()}: ${c.label}`, role: 'img' } }, [c.mark ? icon(c.mark) : ''])]);
      }),
    ]))),
  ]);
  const legend = el('div', { className: 'legend' }, [
    el('span', {}, [el('span', { className: 'cell cell--full' }, [icon('check')]), 'All taken']),
    el('span', {}, [el('span', { className: 'cell cell--part' }, [icon('skip')]), 'Some']),
    el('span', {}, [el('span', { className: 'cell cell--none' }, [icon('cross')]), 'Missed']),
    el('span', {}, [el('span', { className: 'cell' }), 'None due']),
  ]);

  const perMed = el('ul', { className: 'per-med' }, perMedicine(state.medicines, state.logIndex, 14, now).map(({ med, pct }) => {
    const bar = el('span');
    bar.style.width = `${pct ?? 0}%`;
    return el('li', {}, [
      el('div', { className: 'per-med__head' }, [el('span', { text: med.name }), el('span', { className: 'tabular', text: pct === null ? '–' : `${pct}%` })]),
      el('div', { className: 'bar', attrs: { role: 'img', 'aria-label': `${med.name}: ${pct ?? 0}% taken` } }, [bar]),
    ]);
  }));

  panel.replaceChildren(
    head,
    stats,
    el('section', { className: 'card' }, [el('h3', { text: 'Day by day' }), el('div', { className: 'grid-wrap' }, [table]), legend]),
    el('div', { className: 'grid-2' }, [
      el('section', { className: 'card' }, [el('h3', { text: 'By medicine' }), perMed]),
      el('section', { className: 'card' }, [el('h3', { text: 'Badges' }), badges]),
    ]),
  );
}
