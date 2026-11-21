/**
 * Medicines screen: organise and manage every medicine for the selected person.
 *
 * Each card shows the pill as it looks, when and how to take it, how many days
 * of stock are left, and offers Edit / Pause / "What is this for?" / Delete.
 */
import { el, icon, pillIcon, formatTime, doseLabel, MEAL_LABEL, emptyState, openDialog, showBanner, toast, setLoading } from './ui.js';
import { state, currentProfile, saveMedicine, deleteMedicine } from './state.js';
import { daysOfSupply, duplicateGenerics } from './schedule.js';
import { openMedicineDialog } from './medForm.js';
import { explainWithAi } from './ai.js';

const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function daysText(days) {
  if (days.length === 7) return 'Every day';
  return days.slice().sort().map((d) => DAY_SHORT[d]).join(', ');
}

/** AI explanation in the person's language, always with a safety note. */
async function explain(med) {
  const dialog = /** @type {HTMLDialogElement} */ (document.getElementById('info-dialog'));
  const profile = currentProfile();
  const lang = profile?.language === 'hi' ? 'hi' : 'en';
  const body = openDialog(dialog, `What is ${med.name} for?`, 'info-title');
  const out = el('div', { attrs: { 'aria-live': 'polite' } }, [el('p', {}, [el('span', { className: 'spinner', attrs: { 'aria-hidden': 'true' } }), ' Asking Gemini…'])]);
  body.replaceChildren(out, el('p', { className: 'disclaimer', text: 'General information only, not medical advice. Always follow your own doctor or pharmacist.' }));
  try {
    const text = await explainWithAi(med, lang);
    out.replaceChildren(el('div', { className: 'ai-text', text, attrs: { lang } }));
  } catch (err) {
    out.replaceChildren(el('p', { text: `${err.message} You can ask your pharmacist what ${med.name} is for.` }));
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

  return el('article', { className: `card med${med.active ? '' : ' med--paused'}` }, [
    pillIcon(med),
    el('div', {}, [
      el('h3', { className: 'med__title', text: [med.name, med.dosage].filter(Boolean).join(' ') }),
      med.generic_name && el('p', { className: 'med__sub', text: `Contains ${med.generic_name}` }),
      el('p', { className: 'med__sub', text: `${doseLabel(med)} · ${MEAL_LABEL[med.meal] ?? ''} · ${daysText(med.days)}` }),
    ]),
    el('div', { className: 'med__row' }, [
      ...med.times.map((t) => el('span', { className: 'chip' }, [icon('clock'), formatTime(t)])),
      !med.active && el('span', { className: 'chip chip--skipped', text: 'Paused' }),
      med.end_date && el('span', { className: 'chip chip--meal', text: `Until ${new Date(`${med.end_date}T00:00`).toLocaleDateString([], { day: 'numeric', month: 'short' })}` }),
    ]),
    left !== null && el('p', { className: `supply${low ? ' supply--low' : ''}`, text: `${med.stock} in stock · about ${left} day${left === 1 ? '' : 's'} left${low ? ' · refill soon' : ''}` }),
    med.notes && el('p', { className: 'med__sub', text: med.notes }),
    el('div', { className: 'med__actions' }, [
      el('button', { className: 'btn btn--outline btn--sm', text: 'Edit', attrs: { type: 'button' }, on: { click: () => openMedicineDialog(med) } }),
      el('button', { className: 'btn btn--ghost btn--sm', attrs: { type: 'button' }, on: { click: () => explain(med) } }, [icon('book'), 'What is this for?']),
      pauseBtn,
      delBtn,
    ]),
  ]);
}

/** @param {HTMLElement} panel */
export function renderMedicines(panel) {
  const profile = currentProfile();
  const addBtn = el('button', { className: 'btn btn--primary', attrs: { type: 'button' }, on: { click: () => openMedicineDialog() } }, [icon('plus'), 'Add medicine']);
  const head = el('div', { className: 'panel-head' }, [
    el('div', {}, [el('h2', { text: `${profile?.name ?? ''}'s medicines` }), el('p', { text: `${state.medicines.filter((m) => m.active).length} active` })]),
    addBtn,
  ]);
  if (!state.medicines.length) {
    panel.replaceChildren(head, el('div', { className: 'card' }, [emptyState('Nothing here yet. Add a medicine by typing it like the prescription, or scan a photo.', { label: 'Add medicine', onClick: () => openMedicineDialog() })]));
    return;
  }
  const dupes = duplicateGenerics(state.medicines);
  const warn = dupes.length && el('div', { className: 'banner banner--warn', attrs: { role: 'note' } }, [
    el('p', { text: dupes.map(([a, b]) => `${a.name} and ${b.name} contain the same medicine (${a.generic_name}).`).join(' ') + ' Ask your doctor whether both are needed.' }),
  ]);
  const active = state.medicines.filter((m) => m.active);
  const paused = state.medicines.filter((m) => !m.active);
  panel.replaceChildren(
    head,
    warn || '',
    el('div', { className: 'med-list' }, [...active, ...paused].map(medCard)),
  );
}
