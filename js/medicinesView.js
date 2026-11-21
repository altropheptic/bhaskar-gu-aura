/**
 * Medicines screen: organise and manage every medicine for the selected person.
 *
 * Each card shows the pill as it looks, when and how to take it, how many days
 * of stock are left, and offers Edit / Pause / "What is this for?" / Delete.
 */
import { el, icon, pillIcon, formatTime, doseLabel, MEAL_LABEL, emptyState, openDialog, showBanner, toast, setLoading, tintClass } from './ui.js';
import { state, currentProfile, saveMedicine, deleteMedicine } from './state.js';
import { daysOfSupply, duplicateGenerics } from './schedule.js';
import { openMedicineDialog, explainWithAi } from './lazy.js';
import { medMedia } from './photo.js';
import { doseSlotLabel } from './routine.js';

const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function daysText(days) {
  if (days.length === 7) return 'Every day';
  return days.slice().sort().map((d) => DAY_SHORT[d]).join(', ');
}

/** AI explanation in the person's language, always with a safety note. */
async function explain(med) {
  const dialog = /** @type {HTMLDialogElement} */ (document.getElementById('info-dialog'));
  const lang = 'en'; // explanations are always in English (voice reminders still follow the person's language)
  const body = openDialog(dialog, med.name, 'info-title');
  const out = el('div', { attrs: { 'aria-live': 'polite' } }, [el('p', {}, [el('span', { className: 'spinner', attrs: { 'aria-hidden': 'true' } }), ' Asking Gemini…'])]);
  body.replaceChildren(out, el('p', { className: 'disclaimer', text: 'General information, not medical advice.' }));
  try {
    const text = await explainWithAi(med, lang);
    out.replaceChildren(el('div', { className: 'ai-text', text, attrs: { lang } }));
  } catch (err) {
    out.replaceChildren(el('p', { text: `${err.message} Ask your pharmacist about ${med.name}.` }));
  }
}

function medCard(med) {
  const left = daysOfSupply(med);
  const low = left !== null && left <= med.refill_at;
  const pauseBtn = el('button', { className: 'btn btn--ghost btn--sm', text: med.active ? 'Pause' : 'Resume', attrs: { type: 'button' } });
  pauseBtn.addEventListener('click', async () => {
    setLoading(pauseBtn, true, '…');
    try {
      await saveMedicine({ id: med.id, active: !med.active });
      toast(med.active ? `${med.name} paused.` : `${med.name} resumed.`);
    } catch (e) { showBanner('error', e.message); setLoading(pauseBtn, false); }
  });
  const delBtn = el('button', { className: 'btn btn--danger btn--sm', text: 'Delete', attrs: { type: 'button' } });
  delBtn.addEventListener('click', async () => {
    if (!window.confirm(`Delete ${med.name} and its history? This cannot be undone.`)) return;
    try { await deleteMedicine(med.id); toast(`${med.name} deleted.`); } catch (e) { showBanner('error', e.message); }
  });

  const showGeneric = med.generic_name && med.generic_name.toLowerCase() !== med.name.toLowerCase();
  const stockPct = left === null ? 0 : Math.max(4, Math.min(100, Math.round((left / 30) * 100)));
  const bar = el('span');
  bar.style.width = `${stockPct}%`;
  return el('article', { className: `card medcard ${tintClass(med.color)}${med.active ? '' : ' medcard--paused'}` }, [
    el('div', { className: 'medcard__top' }, [
      el('div', { className: 'medcard__art' }, [med.photo ? medMedia(med) : pillIcon(med)]),
      el('div', {}, [
        el('h3', { className: 'medcard__title', text: [med.name, med.dosage].filter(Boolean).join(' ') }),
        el('p', { className: 'medcard__sub', text: [showGeneric && med.generic_name, doseLabel(med), MEAL_LABEL[med.meal]].filter(Boolean).join(' · ') }),
      ]),
    ]),
    el('div', { className: 'medcard__body' }, [
      el('div', { className: 'medcard__chips' }, [
        ...med.times.map((t, i) => el('span', { className: 'chip' }, [icon('clock'), med.slots?.[i] && med.slots[i] !== 'custom' ? `${doseSlotLabel(med.slots[i], t)} · ${formatTime(t)}` : formatTime(t)])),
        med.days.length < 7 && el('span', { className: 'chip chip--meal', text: daysText(med.days) }),
        med.end_date && el('span', { className: 'chip chip--meal', text: `Until ${new Date(`${med.end_date}T00:00`).toLocaleDateString([], { day: 'numeric', month: 'short' })}` }),
        !med.active && el('span', { className: 'chip chip--skipped', text: 'Paused' }),
      ]),
      (med.kept_at || med.doctor) && el('div', { className: 'medcard__facts' }, [
        med.kept_at && el('span', { className: 'place' }, [icon('pin'), med.kept_at]),
        med.doctor && el('span', { className: 'place' }, [icon('rx'), med.doctor]),
      ]),
      left !== null && el('div', { className: `stock${low ? ' stock--low' : ''}` }, [
        el('div', { className: 'stock__row' }, [el('span', { text: `${med.stock} in stock` }), el('span', { text: `${left} day${left === 1 ? '' : 's'} left${low ? ' · refill' : ''}` })]),
        el('div', { className: 'bar', attrs: { role: 'img', 'aria-label': `About ${left} days of stock left` } }, [bar]),
      ]),
      el('div', { className: 'medcard__actions' }, [
        el('button', { className: 'btn btn--ghost btn--sm', text: 'Edit', attrs: { type: 'button' }, on: { click: () => openMedicineDialog(med) } }),
        el('button', { className: 'btn btn--ghost btn--sm', attrs: { type: 'button' }, on: { click: () => explain(med) } }, [icon('book'), 'About']),
        pauseBtn,
        delBtn,
      ]),
    ]),
  ]);
}

/** @param {HTMLElement} panel */
export function renderMedicines(panel) {
  const profile = currentProfile();
  // "Add medicine" lives in the sidebar (desktop) and the floating + button (phones).
  const head = el('div', { className: 'panel-head' }, [
    el('div', {}, [el('h2', { text: 'Medicines' }), el('p', { text: `${state.medicines.filter((m) => m.active).length} active · ${profile?.name ?? ''}` })]),
  ]);
  if (!state.medicines.length) {
    panel.replaceChildren(head, el('div', { className: 'card' }, [emptyState('No medicines yet.', { label: 'Add medicine', onClick: () => openMedicineDialog() })]));
    return;
  }
  const dupes = duplicateGenerics(state.medicines);
  const warn = dupes.length && el('ul', { className: 'alert-list', attrs: { 'aria-label': 'Warnings' } }, dupes.map(([a, b]) => el('li', {}, [
    icon('warn'), el('span', { text: `${a.name} and ${b.name} are both ${a.generic_name}. Ask your doctor.` }),
  ])));
  const active = state.medicines.filter((m) => m.active);
  const paused = state.medicines.filter((m) => !m.active);
  panel.replaceChildren(
    head,
    warn || '',
    el('div', { className: 'med-list' }, [...active, ...paused].map(medCard)),
  );
}
