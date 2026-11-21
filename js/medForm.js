/**
 * Add / edit medicine dialog.
 *
 * Three ways in, fastest first:
 *   1. Type it like the prescription ("Metformin 500mg 1-0-1 after food 30 days")
 *      and let Gemini fill the form, or use the offline rule-based parser.
 *   2. Photograph the prescription or the strip; Gemini reads it.
 *   3. Fill the simple form by hand.
 * AI never saves anything by itself: it only fills the form, and a person checks and saves.
 */
import { el, icon, openDialog, showBanner, setLoading, toast, pillIcon } from './ui.js';
import { saveMedicine, currentProfile } from './state.js';
import { parsePrescription } from './quickEntry.js';
import { parseTextWithAi, parsePhotoWithAi } from './ai.js';
import { FORMS, COLORS, SHAPES, MEALS, validateMedicine } from './medSchema.js';
import { isoDate, addDays } from './schedule.js';

const FORM_LABEL = { tablet: 'Tablet', capsule: 'Capsule', syrup: 'Syrup / liquid', injection: 'Injection', drops: 'Drops', inhaler: 'Inhaler', other: 'Other' };
const SHAPE_LABEL = { round: 'Round', oval: 'Oval', capsule: 'Capsule', liquid: 'Liquid', other: 'Other' };
const MEAL_TEXT = { before: 'Before food', after: 'After food', with: 'With food', any: 'Any time' };
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

let uid = 0;
const nextId = (p) => `${p}-${(uid += 1)}`;

/** Labelled input helper. */
function field(label, input, hint) {
  const id = input.id || nextId('f');
  input.id = id;
  return el('div', { className: 'field' }, [
    el('label', { text: label, attrs: { for: id } }),
    input,
    hint && el('p', { className: 'field__hint', text: hint }),
  ]);
}

function select(name, options, labels, value) {
  return el('select', { attrs: { name } }, options.map((o) => el('option', { text: labels[o] ?? o, attrs: { value: o, selected: o === value } })));
}

function radioGroup(legend, name, options, labels, value) {
  return el('fieldset', {}, [
    el('legend', { text: legend }),
    el('div', { className: 'check-row' }, options.map((o) => el('label', {}, [
      el('input', { attrs: { type: 'radio', name, value: o, checked: o === value } }),
      labels[o] ?? o,
    ]))),
  ]);
}

/**
 * Open the dialog. Pass a medicine to edit it, or nothing to add a new one.
 * @param {any} [existing]
 */
export function openMedicineDialog(existing) {
  const dialog = /** @type {HTMLDialogElement} */ (document.getElementById('med-dialog'));
  const profile = currentProfile();
  if (!profile) { showBanner('info', 'Add a person first.'); return; }
  const m = existing ?? {
    name: '', generic_name: '', dosage: '', form: 'tablet', color: 'white', shape: 'round', meal: 'after',
    times: ['08:00'], days: [0, 1, 2, 3, 4, 5, 6], dose_qty: 1, stock: null, refill_at: 5,
    start_date: isoDate(new Date()), end_date: null, active: true, notes: '',
  };
  const body = openDialog(dialog, existing ? `Edit ${existing.name}` : `Add a medicine for ${profile.name}`, 'med-title');

  /* ---------- the form ---------- */
  const form = el('form', { attrs: { novalidate: true } });
  const nameIn = el('input', { attrs: { name: 'name', maxlength: 80, required: true, autocomplete: 'off', value: m.name } });
  const genericIn = el('input', { attrs: { name: 'generic_name', maxlength: 80, autocomplete: 'off', value: m.generic_name ?? '' } });
  const dosageIn = el('input', { attrs: { name: 'dosage', maxlength: 40, autocomplete: 'off', placeholder: 'e.g. 500 mg', value: m.dosage ?? '' } });
  const formSel = select('form', FORMS, FORM_LABEL, m.form);
  const shapeSel = select('shape', SHAPES, SHAPE_LABEL, m.shape);
  const qtyIn = el('input', { attrs: { name: 'dose_qty', type: 'number', min: 0.5, max: 20, step: 0.5, inputmode: 'decimal', value: m.dose_qty } });
  const stockIn = el('input', { attrs: { name: 'stock', type: 'number', min: 0, max: 10000, step: 0.5, inputmode: 'decimal', placeholder: 'Optional', value: m.stock ?? '' } });
  const refillIn = el('input', { attrs: { name: 'refill_at', type: 'number', min: 0, max: 60, step: 1, value: m.refill_at } });
  const startIn = el('input', { attrs: { name: 'start_date', type: 'date', value: m.start_date } });
  const endIn = el('input', { attrs: { name: 'end_date', type: 'date', value: m.end_date ?? '' } });
  const notesIn = el('textarea', { attrs: { name: 'notes', maxlength: 200, rows: 2 }, text: m.notes ?? '' });

  // Colour swatches show the actual pill icon colour
  const colourSet = el('fieldset', {}, [
    el('legend', { text: 'Pill colour' }),
    el('div', { className: 'check-row' }, COLORS.map((c) => el('label', {}, [
      el('input', { attrs: { type: 'radio', name: 'color', value: c, checked: c === m.color } }),
      pillIcon({ color: c, shape: 'round' }),
      c[0].toUpperCase() + c.slice(1),
    ]))),
  ]);
  colourSet.querySelectorAll('.pill').forEach((p) => p.classList.add('pill--sm'));

  // Times (1–6)
  const timesBox = el('div', { className: 'times-list' });
  const addTimeBtn = el('button', { className: 'btn btn--ghost btn--sm', attrs: { type: 'button' } }, [icon('plus'), 'Add time']);
  function addTimeRow(value = '20:00') {
    if (timesBox.querySelectorAll('input').length >= 6) return;
    const input = el('input', { attrs: { type: 'time', value, 'aria-label': 'Dose time', required: true } });
    const remove = el('button', { className: 'btn btn--ghost btn--sm', attrs: { type: 'button', 'aria-label': 'Remove this time' } }, [icon('cross')]);
    const row = el('span', { className: 'btn-row' }, [input, remove]);
    remove.addEventListener('click', () => { if (timesBox.querySelectorAll('input').length > 1) row.remove(); });
    timesBox.insertBefore(row, addTimeBtn);
  }
  timesBox.append(addTimeBtn);
  addTimeBtn.addEventListener('click', () => addTimeRow());
  m.times.forEach((t) => addTimeRow(t));

  // Days of week
  const daysSet = el('fieldset', {}, [
    el('legend', { text: 'Days' }),
    el('div', { className: 'check-row' }, DAY_NAMES.map((d, i) => el('label', {}, [
      el('input', { attrs: { type: 'checkbox', name: 'days', value: i, checked: m.days.includes(i) } }), d,
    ]))),
  ]);

  const mealSet = radioGroup('With food?', 'meal', MEALS, MEAL_TEXT, m.meal);
  const activeRow = existing && el('label', { className: 'check-row' }, [
    el('input', { attrs: { type: 'checkbox', name: 'active', checked: m.active } }), 'Active (uncheck to pause this medicine)',
  ]);

  const errorBox = el('div', { attrs: { role: 'alert', 'aria-live': 'assertive' } });
  const saveBtn = el('button', { className: 'btn btn--primary btn--xl', text: existing ? 'Save changes' : 'Save medicine', attrs: { type: 'submit' } });

  form.append(
    field('Medicine name', nameIn, 'As written on the strip, e.g. "Glycomet" or "Metformin".'),
    el('div', { className: 'field-grid' }, [
      field('Strength', dosageIn),
      field('Generic name (salt)', genericIn, 'Helps us warn about duplicate medicines.'),
    ]),
    el('div', { className: 'field-grid' }, [field('Type', formSel), field('Shape', shapeSel), field('How many each time', qtyIn)]),
    colourSet,
    el('fieldset', {}, [el('legend', { text: 'Times each day' }), timesBox]),
    daysSet,
    mealSet,
    el('div', { className: 'field-grid' }, [
      field('Start date', startIn),
      field('End date', endIn, 'Leave empty if it is ongoing.'),
    ]),
    el('div', { className: 'field-grid' }, [
      field('Tablets in stock', stockIn, 'We count down as doses are taken.'),
      field('Warn me when this many days are left', refillIn),
    ]),
    field('Notes', notesIn),
    activeRow,
    errorBox,
    el('div', { className: 'dialog__foot' }, [
      el('button', { className: 'btn btn--ghost', text: 'Cancel', attrs: { type: 'button' }, on: { click: () => dialog.close() } }),
      saveBtn,
    ]),
  );

  /** Fill the form from parsed fields (from AI or the rule parser). */
  function applyFields(f) {
    if (f.name) nameIn.value = f.name;
    if (f.generic_name) genericIn.value = f.generic_name;
    if (f.dosage) dosageIn.value = f.dosage;
    if (f.form) formSel.value = f.form;
    if (f.shape) shapeSel.value = f.shape;
    else if (f.form === 'syrup') shapeSel.value = 'liquid';
    else if (f.form === 'capsule') shapeSel.value = 'capsule';
    if (f.dose_qty) qtyIn.value = String(f.dose_qty);
    if (f.meal) form.querySelector(`input[name="meal"][value="${f.meal}"]`).checked = true;
    if (f.color) form.querySelector(`input[name="color"][value="${f.color}"]`).checked = true;
    if (f.end_date) endIn.value = f.end_date;
    if (f.duration_days) endIn.value = isoDate(addDays(new Date(startIn.value || Date.now()), f.duration_days - 1));
    if (f.notes) notesIn.value = f.notes;
    if (Array.isArray(f.times) && f.times.length) {
      timesBox.querySelectorAll('.btn-row').forEach((r) => r.remove());
      f.times.forEach((t) => addTimeRow(t));
    }
    nameIn.focus();
  }

  /* ---------- quick entry (new medicines only) ---------- */
  let quick = null;
  if (!existing) {
    const quickIn = el('textarea', {
      attrs: { id: 'quick-text', rows: 2, maxlength: 1000, placeholder: 'e.g. Metformin 500mg 1-0-1 after food for 30 days' },
    });
    const results = el('div', { attrs: { 'aria-live': 'polite' } });
    const aiBtn = el('button', { className: 'btn btn--primary', attrs: { type: 'button' } }, [icon('rx'), 'Fill with AI']);
    const ruleBtn = el('button', { className: 'btn btn--outline', attrs: { type: 'button' } }, ['Quick fill (offline)']);
    const photoIn = el('input', { attrs: { type: 'file', accept: 'image/*', capture: 'environment', 'aria-label': 'Scan a prescription photo' } });
    const photoBtn = el('span', { className: 'btn btn--outline file-btn' }, [icon('camera'), 'Scan prescription', photoIn]);

    const useRules = () => {
      const { fields, understood } = parsePrescription(quickIn.value);
      if (!fields.name && !fields.times) {
        results.replaceChildren(el('p', { className: 'field__hint', text: 'Could not understand that. Try "Name strength 1-0-1 after food".' }));
        return;
      }
      applyFields(fields);
      results.replaceChildren(el('p', { className: 'field__hint', text: `Understood: ${understood.join(' · ')}. Please check below and save.` }));
    };

    /** Show AI results; one result fills the form, several get a pick list. */
    const showAiResults = (meds, source) => {
      if (!meds.length) {
        results.replaceChildren(el('p', { className: 'field__hint', text: 'No medicines found. Try a clearer photo or type it in.' }));
        return;
      }
      applyFields(meds[0]);
      if (meds.length === 1) {
        results.replaceChildren(el('p', { className: 'field__hint', text: `Gemini read this from your ${source}. Please check the details below, then save.` }));
        return;
      }
      results.replaceChildren(
        el('p', { className: 'field__hint', text: `Gemini found ${meds.length} medicines. The first one is filled in below; tap another to fill it instead. Save each one separately.` }),
        el('div', { className: 'btn-row' }, meds.map((med) => el('button', {
          className: 'btn btn--sm btn--ghost', text: `${med.name} ${med.dosage}`.trim(), attrs: { type: 'button' },
          on: { click: () => applyFields(med) },
        }))),
      );
    };

    ruleBtn.addEventListener('click', useRules);
    aiBtn.addEventListener('click', async () => {
      if (!quickIn.value.trim()) { quickIn.focus(); return; }
      setLoading(aiBtn, true, 'Reading…');
      try {
        showAiResults(await parseTextWithAi(quickIn.value), 'text');
      } catch (err) {
        useRules();
        results.prepend(el('p', { className: 'field__hint', text: `${err.message} Used the offline reader instead.` }));
      } finally {
        setLoading(aiBtn, false);
      }
    });
    photoIn.addEventListener('change', async () => {
      const file = photoIn.files?.[0];
      if (!file) return;
      results.replaceChildren(el('p', { className: 'field__hint' }, [el('span', { className: 'spinner', attrs: { 'aria-hidden': 'true' } }), ' Reading the photo with Gemini…']));
      try {
        showAiResults(await parsePhotoWithAi(file), 'photo');
      } catch (err) {
        results.replaceChildren(el('p', { className: 'field__hint', text: `${err.message} You can type the medicine instead.` }));
      } finally {
        photoIn.value = '';
      }
    });

    quick = el('section', { className: 'quick-entry', attrs: { 'aria-label': 'Quick entry' } }, [
      el('label', { text: 'Type it like the prescription', attrs: { for: 'quick-text' } }),
      quickIn,
      el('div', { className: 'btn-row' }, [aiBtn, ruleBtn, photoBtn]),
      results,
    ]);
  }

  /* ---------- submit ---------- */
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const stockRaw = String(fd.get('stock') ?? '').trim();
    const med = {
      ...(existing ? { id: existing.id } : {}),
      name: String(fd.get('name') ?? '').trim(),
      generic_name: String(fd.get('generic_name') ?? '').trim(),
      dosage: String(fd.get('dosage') ?? '').trim(),
      form: String(fd.get('form')),
      color: String(fd.get('color') ?? ''),
      shape: String(fd.get('shape')),
      meal: String(fd.get('meal') ?? ''),
      times: [...timesBox.querySelectorAll('input')].map((i) => i.value).filter(Boolean).sort(),
      days: fd.getAll('days').map(Number),
      dose_qty: Number(fd.get('dose_qty')),
      stock: stockRaw === '' ? null : Number(stockRaw),
      refill_at: Number(fd.get('refill_at') || 0),
      start_date: String(fd.get('start_date') ?? ''),
      end_date: String(fd.get('end_date') ?? '') || null,
      notes: String(fd.get('notes') ?? '').trim(),
      active: existing ? fd.get('active') !== null : true,
    };
    const errors = validateMedicine(med);
    if (errors.length) {
      errorBox.replaceChildren(el('div', { className: 'banner banner--error' }, [el('ul', {}, errors.map((t) => el('li', { text: t })))]));
      errorBox.scrollIntoView({ block: 'nearest' });
      return;
    }
    errorBox.replaceChildren();
    setLoading(saveBtn, true, 'Saving…');
    try {
      await saveMedicine(med);
      dialog.close();
      toast(existing ? `${med.name} updated.` : `${med.name} added for ${profile.name}.`);
    } catch (err) {
      errorBox.replaceChildren(el('div', { className: 'banner banner--error' }, [el('p', { text: err.message })]));
    } finally {
      setLoading(saveBtn, false);
    }
  });

  body.replaceChildren(...[quick, form].filter(Boolean));
  (quick ? body.querySelector('#quick-text') : nameIn)?.focus();
}
