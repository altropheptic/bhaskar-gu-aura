/**
 * One-tap big mode: a full-screen view with only the next dose and one huge button.
 *
 * Why: research on older adults shows menus, scrolling and small targets are the
 * main reasons they abandon medication apps. This mode removes all of it:
 * one pill picture, one sentence, one button.
 */
import { el, icon, pillIcon, formatTime, doseLabel, MEAL_LABEL } from './ui.js';
import { currentProfile, subscribe } from './state.js';
import { todayDoses, takeOrSkip } from './doseActions.js';
import { speakReminder } from './voice.js';

const dialog = () => /** @type {HTMLDialogElement} */ (document.getElementById('onetap-dialog'));

function render() {
  const d = dialog();
  if (!d.open) return;
  const profile = currentProfile();
  const doses = todayDoses();
  const now = doses.find((x) => x.status === 'due') ?? doses.find((x) => x.status === 'missed');
  const later = doses.find((x) => x.status === 'upcoming');

  const close = el('button', {
    className: 'btn btn--ghost onetap__close', attrs: { type: 'button' },
    on: { click: () => d.close() },
  }, [icon('cross'), 'Close']);

  let body;
  if (now) {
    const go = el('button', { className: 'btn btn--primary onetap__go', attrs: { type: 'button' } }, [
      icon('check'), el('span', { text: 'I took it' }), el('span', { text: ' · ले ली', attrs: { lang: 'hi' } }),
    ]);
    go.addEventListener('click', () => takeOrSkip(now, 'taken', go));
    const say = el('button', { className: 'btn btn--outline', attrs: { type: 'button' } }, [icon('speaker'), 'Say aloud']);
    say.addEventListener('click', () => speakReminder(profile, [now.med], say, { force: true }));
    body = [
      el('p', { className: 'big-time', text: now.status === 'missed' ? `Missed at ${formatTime(now.time)}` : `Now · ${formatTime(now.time)}` }),
      pillIcon(now.med),
      el('h2', { className: 'onetap__name', text: now.med.name, attrs: { id: 'onetap-title' } }),
      el('p', { className: 'onetap__how', text: `${doseLabel(now.med)} · ${MEAL_LABEL[now.med.meal] ?? ''}` }),
      go,
      say,
    ];
  } else {
    body = [
      el('div', { className: 'alarm__ring' }, [icon('check')]),
      el('h2', { className: 'onetap__name', text: 'All done for now', attrs: { id: 'onetap-title' } }),
      el('p', { className: 'onetap__how', text: later ? `Next: ${later.med.name} at ${formatTime(later.time)}` : 'Nothing more today' }),
    ];
  }
  d.replaceChildren(el('div', { className: 'onetap' }, [close, ...body]));
}

/** Open the full-screen one-tap view. */
export function openOneTap() {
  const d = dialog();
  if (!d.open) d.showModal();
  render();
}

// Re-render whenever data changes (e.g. after "I took it" or an Undo from the toast).
subscribe(render);
