/**
 * Add / edit medicine dialog.
 *
 * Three ways in, fastest first:
 *   1. Quick fill: type it like the prescription ("Metformin 500mg 1-0-1 after
 *      food 30 days"). The offline 1-0-1 reader answers instantly; anything it
 *      can't read goes to Gemini.
 *   2. Scan: photograph the prescription; Gemini reads it (and the doctor's name).
 *   3. Fill the form by hand. Times are picked as routine chips ("Breakfast",
 *      "Bedtime") instead of clock pickers, which older adults find hard.
 * AI never saves anything by itself: it only fills the form, and a person checks and saves.
 */
import { el, icon, openDialog, showBanner, setLoading, toast, pillIcon, formatTime } from './ui.js';
import { saveMedicine, currentProfile } from './state.js';
import { FORMS, COLORS, SHAPES, MEALS, validateMedicine } from './medSchema.js';
import { isoDate, addDays } from './schedule.js';
import { SLOTS, SLOT_LABEL, routineOf, slotTime } from './routine.js';
import { field, fieldset, seg, doseStepper, colourPicker, dayPicker, photoPicker } from './formControls.js';
import { quickAddSection } from './quickAdd.js';
import { newMedicine, customTimesOf, formToMedicine } from './medFormData.js';

const FORM_LABEL = {
  tablet: 'Tablet',
  capsule: 'Capsule',
  syrup: 'Syrup / liquid',
  injection: 'Injection',
  drops: 'Drops',
  inhaler: 'Inhaler',
  other: 'Other',
};
const SHAPE_LABEL = { round: 'Round', oval: 'Oval', capsule: 'Capsule', liquid: 'Liquid', other: 'Other' };
const MEAL_TEXT = { before: 'Before food', after: 'After food', with: 'With food', any: 'Any time' };
const MAX_CUSTOM_TIMES = 6;

/** A text input bound to a medicine field. */
const textInput = (name, value, attrs = {}) =>
  el('input', { attrs: { name, autocomplete: 'off', value: value ?? '', ...attrs } });

/**
 * Open the dialog. Pass a medicine to edit it, or nothing to add a new one.
 * @param {import('./types.js').Medicine} [existing]
 */
export function openMedicineDialog(existing) {
  const dialog = /** @type {HTMLDialogElement} */ (document.getElementById('med-dialog'));
  const profile = currentProfile();
  if (!profile) {
    showBanner('info', 'Add a person first.');
    return;
  }
  const routine = routineOf(profile);
  const m = existing ?? newMedicine();
  const body = openDialog(dialog, existing ? `Edit ${existing.name}` : 'Add medicine', 'med-title');
  const form = /** @type {HTMLFormElement} */ (el('form', { className: 'med-form', attrs: { novalidate: true } }));
  const checked = (name) =>
    /** @type {HTMLInputElement | null} */ (form.querySelector(`input[name="${name}"]:checked`))?.value;

  /* ---------- what it is ---------- */
  const nameIn = textInput('name', m.name, { maxlength: 80, required: true });
  const genericIn = textInput('generic_name', m.generic_name, { maxlength: 80 });
  const dosageIn = textInput('dosage', m.dosage, { maxlength: 40, placeholder: '500 mg' });
  const formSeg = seg('form', FORMS, FORM_LABEL, m.form);
  const shapeSeg = seg('shape', SHAPES, SHAPE_LABEL, m.shape, (o) => pillIcon({ color: 'white', shape: o }));
  const dose = doseStepper(m.dose_qty, () => checked('form') ?? 'tablet');
  formSeg.addEventListener('change', dose.refresh);
  const photo = photoPicker(m.photo);

  /* ---------- when: routine chips + optional custom times ---------- */
  const mealSet = fieldset('Food', seg('meal', MEALS, MEAL_TEXT, m.meal));
  const anchored = new Set((m.slots ?? []).filter((s) => s !== 'custom'));
  const chipTimes = {};
  const slotBox = el(
    'div',
    { className: 'slot-picker' },
    SLOTS.map((s) => {
      chipTimes[s] = el('span', { className: 'slot-chip__time tabular' });
      return el('label', { className: 'slot-chip' }, [
        el('input', { attrs: { type: 'checkbox', name: 'slot', value: s, checked: anchored.has(s) } }),
        el('span', { className: 'slot-chip__name', text: SLOT_LABEL[s] }),
        chipTimes[s],
      ]);
    }),
  );
  const refreshChipTimes = () => {
    for (const s of SLOTS) chipTimes[s].textContent = formatTime(slotTime(s, checked('meal') ?? 'any', routine));
  };
  mealSet.addEventListener('change', refreshChipTimes);

  const timesBox = el('div', { className: 'times-list' });
  const addTimeBtn = el('button', { className: 'btn btn--ghost btn--sm', attrs: { type: 'button' } }, [
    icon('plus'),
    'Other time',
  ]);
  const addTimeRow = (value = '18:00') => {
    if (timesBox.querySelectorAll('input').length >= MAX_CUSTOM_TIMES) return;
    const input = el('input', { attrs: { type: 'time', value, 'aria-label': 'Other dose time' } });
    const remove = el(
      'button',
      { className: 'btn btn--ghost btn--sm', attrs: { type: 'button', 'aria-label': 'Remove this time' } },
      [icon('cross')],
    );
    const row = el('span', { className: 'btn-row' }, [input, remove]);
    remove.addEventListener('click', () => row.remove());
    timesBox.insertBefore(row, addTimeBtn);
  };
  timesBox.append(addTimeBtn);
  addTimeBtn.addEventListener('click', () => addTimeRow());
  customTimesOf(m).forEach((t) => addTimeRow(t));

  /* ---------- details ---------- */
  const keptIn = textInput('kept_at', m.kept_at, { maxlength: 60, placeholder: 'Blue box, dining table' });
  const doctorIn = textInput('doctor', m.doctor, { maxlength: 60, placeholder: 'Dr. Sharma' });
  const startIn = el('input', { attrs: { name: 'start_date', type: 'date', value: m.start_date } });
  const endIn = el('input', { attrs: { name: 'end_date', type: 'date', value: m.end_date ?? '' } });
  const stockIn = el('input', {
    attrs: {
      name: 'stock',
      type: 'number',
      min: 0,
      max: 10000,
      step: 0.5,
      inputmode: 'decimal',
      placeholder: 'Optional',
      value: m.stock ?? '',
    },
  });
  const refillIn = el('input', {
    attrs: { name: 'refill_at', type: 'number', min: 0, max: 60, step: 1, value: m.refill_at },
  });
  const notesIn = el('textarea', { attrs: { name: 'notes', maxlength: 200, rows: 2 }, text: m.notes ?? '' });
  const activeRow =
    existing &&
    el('div', { className: 'check-row' }, [
      el('label', {}, [el('input', { attrs: { type: 'checkbox', name: 'active', checked: m.active } }), 'Active']),
    ]);

  const errorBox = el('div', { attrs: { role: 'alert', 'aria-live': 'assertive' } });
  const saveBtn = /** @type {HTMLButtonElement} */ (
    el('button', {
      className: 'btn btn--primary btn--xl',
      text: existing ? 'Save changes' : 'Save medicine',
      attrs: { type: 'submit' },
    })
  );

  form.append(
    el('div', { className: 'form-card' }, [
      el('span', { className: 'section-title', text: 'Medicine' }),
      el('div', { className: 'med-top' }, [
        photo.element,
        el('div', {}, [field('Name', nameIn), field('Strength', dosageIn)]),
      ]),
      field('Generic (salt)', genericIn),
      fieldset('Type', formSeg),
      fieldset('Shape', shapeSeg),
      fieldset('Dose each time', dose.element),
      colourPicker(COLORS, m.color),
    ]),
    el('div', { className: 'form-card' }, [
      el('span', { className: 'section-title', text: 'When' }),
      mealSet,
      fieldset(`${profile.name}'s routine`, slotBox, timesBox),
      dayPicker(m.days),
    ]),
    el('div', { className: 'form-card' }, [
      el('span', { className: 'section-title', text: 'Details' }),
      el('div', { className: 'field-grid' }, [field('Kept at', keptIn), field('Doctor', doctorIn)]),
      el('div', { className: 'field-grid' }, [field('Start date', startIn), field('End date (optional)', endIn)]),
      el('div', { className: 'field-grid' }, [
        field('In stock (optional)', stockIn),
        field('Refill alert (days left)', refillIn),
      ]),
      field('Notes', notesIn),
      activeRow,
    ]),
    errorBox,
    el('div', { className: 'dialog__foot' }, [
      el('button', {
        className: 'btn btn--ghost',
        text: 'Cancel',
        attrs: { type: 'button' },
        on: { click: () => dialog.close() },
      }),
      saveBtn,
    ]),
  );
  refreshChipTimes();

  /** Fill the form from parsed fields (AI or the offline reader). */
  function applyFields(f) {
    const setRadio = (name, value) => {
      const input = /** @type {HTMLInputElement | null} */ (
        form.querySelector(`input[name="${name}"][value="${value}"]`)
      );
      if (input) input.checked = true;
    };
    if (f.name) nameIn.value = f.name;
    if (f.generic_name) genericIn.value = f.generic_name;
    if (f.dosage) dosageIn.value = f.dosage;
    if (f.form) setRadio('form', f.form);
    if (f.shape) setRadio('shape', f.shape);
    else if (f.form === 'syrup') setRadio('shape', 'liquid');
    else if (f.form === 'capsule') setRadio('shape', 'capsule');
    if (f.dose_qty) dose.input.value = String(f.dose_qty);
    dose.refresh();
    if (f.meal) setRadio('meal', f.meal);
    if (f.color) setRadio('color', f.color);
    if (f.end_date) endIn.value = f.end_date;
    if (f.duration_days) endIn.value = isoDate(addDays(new Date(startIn.value || Date.now()), f.duration_days - 1));
    if (f.notes) notesIn.value = f.notes;
    if (f.doctor) doctorIn.value = f.doctor;
    const slots = Array.isArray(f.slots) ? f.slots : [];
    const times = Array.isArray(f.times) ? f.times : [];
    if (slots.length || times.length) {
      form.querySelectorAll('input[name="slot"]').forEach((i) => {
        /** @type {HTMLInputElement} */ (i).checked = slots.includes(i.value);
      });
      timesBox.querySelectorAll('.btn-row').forEach((r) => r.remove());
      if (!slots.length) times.forEach((t) => addTimeRow(t)); // AI gave clock times only
    }
    refreshChipTimes();
    nameIn.focus();
  }

  /* ---------- save ---------- */
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const customTimes = [...timesBox.querySelectorAll('input')].map((i) => /** @type {HTMLInputElement} */ (i).value);
    const med = formToMedicine(new FormData(form), { existing, customTimes, routine, photo: photo.value });
    const errors = validateMedicine(med);
    if (errors.length) {
      errorBox.replaceChildren(
        el('div', { className: 'banner banner--error' }, [
          el(
            'ul',
            {},
            errors.map((t) => el('li', { text: t })),
          ),
        ]),
      );
      errorBox.scrollIntoView({ block: 'nearest' });
      return;
    }
    errorBox.replaceChildren();
    setLoading(saveBtn, true, 'Saving…');
    try {
      await saveMedicine(med);
      dialog.close();
      toast(existing ? `${med.name} updated` : `${med.name} added`);
    } catch (err) {
      errorBox.replaceChildren(el('div', { className: 'banner banner--error' }, [el('p', { text: err.message })]));
    } finally {
      setLoading(saveBtn, false);
    }
  });

  const quick = existing ? null : quickAddSection(applyFields);
  body.replaceChildren(...[quick, form].filter(Boolean));
  (quick ? body.querySelector('#quick-text') : nameIn)?.focus();
}
