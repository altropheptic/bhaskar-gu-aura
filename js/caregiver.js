/**
 * Family (caregiver) view: today's doses for one elder, read-only.
 *
 * The token from the link is sent to /api/caregiver, which checks its hash,
 * expiry and revocation server-side. The page reuses the same schedule maths as
 * the main app, so what the family sees matches what the elder sees.
 */
import '@fontsource-variable/lexend/wght.css';
import '@fontsource-variable/atkinson-hyperlegible-next/wght.css';
import '../css/styles.css';

import { el, icon, pillIcon, formatTime, formatClock, doseLabel, MEAL_LABEL } from './ui.js';
import { dosesForDay, doseStatus, indexLogs, findLog, daysOfSupply } from './schedule.js';
import { applySettings } from './settings.js';

applySettings();
const root = document.getElementById('cg-root');
const fromUrl = new URLSearchParams(location.search).get('t');
let token = fromUrl ?? '';
try {
  if (fromUrl) sessionStorage.setItem('dawai-dost-cg', fromUrl);
  else token = sessionStorage.getItem('dawai-dost-cg') ?? '';
} catch {
  /* storage blocked: refresh will need the link again */
}

// Remove the token from the address bar so it isn't left in screenshots or shared by
// accident. It stays in this tab's sessionStorage so a refresh still works.
if (fromUrl) history.replaceState(null, '', location.pathname);

const CHIP = {
  taken: (log) => el('span', { className: 'chip chip--ok' }, [icon('check'), `Taken ${formatClock(log.logged_at)}`]),
  skipped: () => el('span', { className: 'chip chip--skipped' }, [icon('skip'), 'Skipped']),
  missed: () => el('span', { className: 'chip chip--missed' }, [icon('cross'), 'Missed']),
  due: () => el('span', { className: 'chip chip--due' }, [icon('bell'), 'Due now']),
  upcoming: (_, d) => el('span', { className: 'chip' }, [icon('clock'), formatTime(d.time)]),
};

function normalise(m) {
  return {
    ...m,
    times: m.times.map((t) => String(t).slice(0, 5)).sort(),
    days: m.days.map(Number),
    dose_qty: Number(m.dose_qty),
    stock: m.stock === null ? null : Number(m.stock),
  };
}

function render(data) {
  const meds = data.medicines.map(normalise);
  const logIndex = indexLogs(data.logs);
  const now = new Date();
  const doses = dosesForDay(meds, now).map((d) => ({ ...d, status: doseStatus(d, logIndex, now) }));
  const taken = doses.filter((d) => d.status === 'taken').length;
  const missed = doses.filter((d) => d.status === 'missed').length;
  const low = meds.filter((m) => {
    const left = daysOfSupply(m);
    return left !== null && left <= m.refill_at;
  });

  root.replaceChildren(
    el('h1', { text: `${data.profile.name}'s medicines today` }),
    el('p', {
      className: 'muted',
      text: `${now.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })} · updated ${formatClock(data.generated_at)}`,
    }),
    el('p', {
      className: 'cg__status',
      text: doses.length
        ? `${taken} of ${doses.length} taken${missed ? ` · ${missed} missed` : ''}`
        : 'Nothing scheduled today.',
    }),
    missed
      ? el('div', { className: 'banner banner--warn', attrs: { role: 'note' } }, [
          el('p', { text: `A dose was missed. A gentle call can help. Remind them not to take two doses together.` }),
        ])
      : '',
    low.length
      ? el(
          'ul',
          { className: 'alert-list' },
          low.map((m) =>
            el('li', {}, [icon('warn'), el('span', { text: `${m.name} is running low. It may need a refill.` })]),
          ),
        )
      : '',
    el(
      'section',
      { attrs: { 'aria-label': 'Today' } },
      doses.map((d) =>
        el('article', { className: `dose dose--${d.status}` }, [
          pillIcon(d.med),
          el('div', {}, [
            el('div', { className: 'dose__name', text: [d.med.name, d.med.dosage].filter(Boolean).join(' ') }),
            el('div', { className: 'dose__meta' }, [
              el('span', { text: `${formatTime(d.time)} · ${doseLabel(d.med)}` }),
              el('span', { className: 'chip chip--meal', text: MEAL_LABEL[d.med.meal] ?? '' }),
            ]),
          ]),
          el('div', { className: 'dose__actions' }, [CHIP[d.status](findLog(d, logIndex), d)]),
        ]),
      ),
    ),
    el('p', {
      className: 'disclaimer',
      text: 'Read-only view. The family member who shared this link can turn it off at any time.',
    }),
  );
}

async function load() {
  if (!/^[A-Za-z0-9_-]{32}$/.test(token)) {
    root.replaceChildren(
      el('h1', { text: 'Link not valid' }),
      el('p', {
        text: 'This family link is incomplete. Ask for a new link from the Dawai Dost app (Family & safety).',
      }),
    );
    return;
  }
  try {
    const res = await fetch(`/api/caregiver?t=${encodeURIComponent(token)}`, { signal: AbortSignal.timeout(12000) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Could not load right now.');
    render(data);
  } catch (err) {
    root.replaceChildren(
      el('h1', { text: 'Could not open this view' }),
      el('p', { text: err.message || 'Please try again later.' }),
    );
  }
}

load();
setInterval(() => {
  if (!document.hidden) load();
}, 120_000);
