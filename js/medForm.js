/**
 * Add / edit medicine dialog.
 *
 * Three ways in, fastest first:
 *   1. Quick add: type it like the prescription ("Metformin 500mg 1-0-1 after
 *      food 30 days") and let Gemini fill the form, or use the offline parser.
 *   2. Scan: photograph the prescription; Gemini reads it (and the doctor's name).
 *   3. Fill the form by hand. Times are picked as routine chips ("Breakfast",
 *      "Bedtime") instead of clock pickers, which older adults find hard.
 * AI never saves anything by itself: it only fills the form, and a person checks and saves.
 */
import { el, icon, openDialog, showBanner, setLoading, toast, pillIcon, formatTime, tintClass, FORM_UNIT } from './ui.js';
import { saveMedicine, currentProfile } from './state.js';
import { parsePrescription } from './quickEntry.js';
import { parseTextWithAi, parsePhotoWithAi } from './ai.js';
import { FORMS, COLORS, SHAPES, MEALS, validateMedicine } from './medSchema.js';
import { isoDate, addDays } from './schedule.js';
import { SLOTS, SLOT_LABEL, routineOf, slotTime, buildSchedule } from './routine.js';
import { makeThumbnail, photoImg } from './photo.js';

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

/** Segmented control: radio inputs styled as pills (keyboard + FormData still work). */
function seg(name, options, labels, value, iconFor) {
  return el('div', { className: 'seg', attrs: { role: 'radiogroup' } }, options.map((o) => el('label', {}, [
    el('input', { attrs: { type: 'radio', name, value: o, checked: o === value } }),
    iconFor ? iconFor(o) : null,
    labels[o] ?? o,
  ])));
}

function radioGroup(legend, name, options, labels, value) {
  return el('fieldset', {}, [el('legend', { text: legend }), seg(name, options, labels, value)]);
}

/**
 * Open the dialog. Pass a medicine to edit it, or nothing to add a new one.
 * @param {any} [existing]
 */
export function openMedicineDialog(existing) {
  const dialog = /** @type {HTMLDialogElement} */ (document.getElementById('med-dialog'));
  const profile = currentProfile();
  if (!profile) { showBanner('info', 'Add a person first.'); return; }
  const routine = routineOf(profile);
  const m = existing ?? {
    name: '', generic_name: '', dosage: '', form: 'tablet', color: 'white', shape: 'round', meal: 'after',
    times: [], slots: ['breakfast'], days: [0, 1, 2, 3, 4, 5, 6], dose_qty: 1, stock: null, refill_at: 5,
    start_date: isoDate(new Date()), end_date: null, active: true, notes: '', kept_at: '', doctor: '', photo: null,
  };
  const body = openDialog(dialog, existing ? `Edit ${existing.name}` : 'Add medicine', 'med-title');

  /* ---------- inputs ---------- */
  const form = el('form', { className: 'med-form', attrs: { novalidate: true } });
  const nameIn = el('input', { attrs: { name: 'name', maxlength: 80, required: true, autocomplete: 'off', value: m.name } });
  const genericIn = el('input', { attrs: { name: 'generic_name', maxlength: 80, autocomplete: 'off', value: m.generic_name ?? '' } });
  const dosageIn = el('input', { attrs: { name: 'dosage', maxlength: 40, autocomplete: 'off', placeholder: '500 mg', value: m.dosage ?? '' } });
  const formSeg = seg('form', FORMS, FORM_LABEL, m.form);
  const shapeSeg = seg('shape', SHAPES, SHAPE_LABEL, m.shape, (o) => pillIcon({ color: 'white', shape: o }));
  const qtyIn = el('input', { attrs: { name: 'dose_qty', type: 'number', min: 0.5, max: 20, step: 0.5, inputmode: 'decimal', value: m.dose_qty, 'aria-label': 'Dose each time' } });
  const unitEl = el('span', { className: 'stepper__unit' });
  const currentForm = () => /** @type {HTMLInputElement} */ (formSeg.querySelector('input:checked'))?.value ?? 'tablet';
  const updateUnit = () => {
    const unit = FORM_UNIT[currentForm()] ?? 'dose';
    const qty = Number(qtyIn.value) || 1;
    unitEl.textContent = qty !== 1 && !['ml', 'drops'].includes(unit) ? `${unit}s` : unit;
  };
  const step = (delta) => {
    const next = Math.min(20, Math.max(0.5, (Number(qtyIn.value) || 1) + delta));
    qtyIn.value = String(next);
    updateUnit();
  };
  const stepper = el('div', { className: 'stepper' }, [
    el('button', { text: '−', attrs: { type: 'button', 'aria-label': 'Less' }, on: { click: () => step(-0.5) } }),
    qtyIn,
    el('button', { text: '+', attrs: { type: 'button', 'aria-label': 'More' }, on: { click: () => step(0.5) } }),
    unitEl,
  ]);
  qtyIn.addEventListener('input', updateUnit);
  formSeg.addEventListener('change', updateUnit);
  updateUnit();
  const stockIn = el('input', { attrs: { name: 'stock', type: 'number', min: 0, max: 10000, step: 0.5, inputmode: 'decimal', placeholder: 'Optional', value: m.stock ?? '' } });
  const refillIn = el('input', { attrs: { name: 'refill_at', type: 'number', min: 0, max: 60, step: 1, value: m.refill_at } });
  const startIn = el('input', { attrs: { name: 'start_date', type: 'date', value: m.start_date } });
  const endIn = el('input', { attrs: { name: 'end_date', type: 'date', value: m.end_date ?? '' } });
  const keptIn = el('input', { attrs: { name: 'kept_at', maxlength: 60, autocomplete: 'off', placeholder: 'Blue box, dining table', value: m.kept_at ?? '' } });
  const doctorIn = el('input', { attrs: { name: 'doctor', maxlength: 60, autocomplete: 'off', placeholder: 'Dr. Sharma', value: m.doctor ?? '' } });
  const notesIn = el('textarea', { attrs: { name: 'notes', maxlength: 200, rows: 2 }, text: m.notes ?? '' });

  /* ---------- photo of the medicine ---------- */
  let photoData = m.photo ?? null;
  const photoBox = el('div', { className: 'photo-field' });
  function renderPhoto() {
    const fileIn = el('input', { attrs: { type: 'file', accept: 'image/*', capture: 'environment', 'aria-label': 'Add a photo of the medicine' } });
    fileIn.addEventListener('change', async () => {
      const file = fileIn.files?.[0];
      if (!file) return;
      try { photoData = await makeThumbnail(file); renderPhoto(); } catch (err) { showBanner('error', err.message); }
    });
    if (photoData) {
      photoBox.replaceChildren(
        photoImg(photoData, 'Photo of the medicine', 'med-photo med-photo--lg'),
        el('div', { className: 'btn-row' }, [
          el('span', { className: 'btn btn--ghost btn--sm file-btn' }, ['Change', fileIn]),
          el('button', { className: 'btn btn--danger btn--sm', text: 'Remove', attrs: { type: 'button' }, on: { click: () => { photoData = null; renderPhoto(); } } }),
        ]),
      );
    } else {
      photoBox.replaceChildren(
        el('span', { className: 'photo-field__empty file-btn' }, [icon('camera'), fileIn]),
        el('span', { className: 'field__hint', text: 'Add photo' }),
      );
    }
  }
  renderPhoto();

  /* ---------- colour ---------- */
  const colourSet = el('fieldset', {}, [
    el('legend', { text: 'Colour' }),
    el('div', { className: 'swatches', attrs: { role: 'radiogroup' } }, COLORS.map((c) => el('label', { className: tintClass(c), attrs: { title: c } }, [
      el('input', { attrs: { type: 'radio', name: 'color', value: c, checked: c === m.color, 'aria-label': c[0].toUpperCase() + c.slice(1) } }),
    ]))),
  ]);

  /* ---------- when: routine chips + optional custom times ---------- */
  const mealSet = radioGroup('Food', 'meal', MEALS, MEAL_TEXT, m.meal);
  const anchored = new Set((m.slots ?? []).filter((s) => s !== 'custom'));
  const customTimes = m.slots ? m.times.filter((_, i) => m.slots[i] === 'custom') : [...m.times];

  const chipTimes = {};
  const slotBox = el('div', { className: 'slot-picker' }, SLOTS.map((s) => {
    chipTimes[s] = el('span', { className: 'slot-chip__time tabular' });
    return el('label', { className: 'slot-chip' }, [
      el('input', { attrs: { type: 'checkbox', name: 'slot', value: s, checked: anchored.has(s) } }),
      el('span', { className: 'slot-chip__name', text: SLOT_LABEL[s] }),
      chipTimes[s],
    ]);
  }));
  const currentMeal = () => /** @type {HTMLInputElement} */ (form.querySelector('input[name="meal"]:checked'))?.value ?? 'any';
  function refreshChipTimes() {
    for (const s of SLOTS) chipTimes[s].textContent = formatTime(slotTime(s, currentMeal(), routine));
  }
  mealSet.addEventListener('change', refreshChipTimes);

  const timesBox = el('div', { className: 'times-list' });
  const addTimeBtn = el('button', { className: 'btn btn--ghost btn--sm', attrs: { type: 'button' } }, [icon('plus'), 'Other time']);
  function addTimeRow(value = '18:00') {
    if (timesBox.querySelectorAll('input').length >= 6) return;
    const input = el('input', { attrs: { type: 'time', value, 'aria-label': 'Other dose time' } });
    const remove = el('button', { className: 'btn btn--ghost btn--sm', attrs: { type: 'button', 'aria-label': 'Remove this time' } }, [icon('cross')]);
    const row = el('span', { className: 'btn-row' }, [input, remove]);
    remove.addEventListener('click', () => row.remove());
    timesBox.insertBefore(row, addTimeBtn);
  }
  timesBox.append(addTimeBtn);
  addTimeBtn.addEventListener('click', () => addTimeRow());
  customTimes.forEach((t) => addTimeRow(t));

  const daysSet = el('fieldset', {}, [
    el('legend', { text: 'Days' }),
    el('div', { className: 'days' }, DAY_NAMES.map((d, i) => el('label', {}, [
      el('input', { attrs: { type: 'checkbox', name: 'days', value: i, checked: m.days.includes(i) } }), d,
    ]))),
  ]);

  const activeRow = existing && el('div', { className: 'check-row' }, [el('label', {}, [
    el('input', { attrs: { type: 'checkbox', name: 'active', checked: m.active } }), 'Active',
  ])]);

  const errorBox = el('div', { attrs: { role: 'alert', 'aria-live': 'assertive' } });
  const saveBtn = el('button', { className: 'btn btn--primary btn--xl', text: existing ? 'Save changes' : 'Save medicine', attrs: { type: 'submit' } });

  form.append(
    el('div', { className: 'form-card' }, [
      el('span', { className: 'section-title', text: 'Medicine' }),
      el('div', { className: 'med-top' }, [photoBox, el('div', {}, [field('Name', nameIn), field('Strength', dosageIn)])]),
      field('Generic (salt)', genericIn),
      el('fieldset', {}, [el('legend', { text: 'Type' }), formSeg]),
      el('fieldset', {}, [el('legend', { text: 'Shape' }), shapeSeg]),
      el('fieldset', {}, [el('legend', { text: 'Dose each time' }), stepper]),
      colourSet,
    ]),
    el('div', { className: 'form-card' }, [
      el('span', { className: 'section-title', text: 'When' }),
      mealSet,
      el('fieldset', {}, [el('legend', { text: `${profile.name}'s routine` }), slotBox, timesBox]),
      daysSet,
    ]),
    el('div', { className: 'form-card' }, [
      el('span', { className: 'section-title', text: 'Details' }),
      el('div', { className: 'field-grid' }, [field('Kept at', keptIn), field('Doctor', doctorIn)]),
      el('div', { className: 'field-grid' }, [field('Start date', startIn), field('End date (optional)', endIn)]),
      el('div', { className: 'field-grid' }, [field('In stock (optional)', stockIn), field('Refill alert (days left)', refillIn)]),
      field('Notes', notesIn),
      activeRow,
    ]),
    errorBox,
    el('div', { className: 'dialog__foot' }, [
      el('button', { className: 'btn btn--ghost', text: 'Cancel', attrs: { type: 'button' }, on: { click: () => dialog.close() } }),
      saveBtn,
    ]),
  );
  refreshChipTimes();

  /** Fill the form from parsed fields (from AI or the rule parser). */
  function applyFields(f) {
    if (f.name) nameIn.value = f.name;
    if (f.generic_name) genericIn.value = f.generic_name;
    if (f.dosage) dosageIn.value = f.dosage;
    const setRadio = (name, value) => { const i = form.querySelector(`input[name="${name}"][value="${value}"]`); if (i) i.checked = true; };
    if (f.form) setRadio('form', f.form);
    if (f.shape) setRadio('shape', f.shape);
    else if (f.form === 'syrup') setRadio('shape', 'liquid');
    else if (f.form === 'capsule') setRadio('shape', 'capsule');
    if (f.dose_qty) qtyIn.value = String(f.dose_qty);
    updateUnit();
    if (f.meal) form.querySelector(`input[name="meal"][value="${f.meal}"]`).checked = true;
    if (f.color) form.querySelector(`input[name="color"][value="${f.color}"]`).checked = true;
    if (f.end_date) endIn.value = f.end_date;
    if (f.duration_days) endIn.value = isoDate(addDays(new Date(startIn.value || Date.now()), f.duration_days - 1));
    if (f.notes) notesIn.value = f.notes;
    if (f.doctor) doctorIn.value = f.doctor;
    const slots = Array.isArray(f.slots) ? f.slots : [];
    const times = Array.isArray(f.times) ? f.times : [];
    if (slots.length || times.length) {
      form.querySelectorAll('input[name="slot"]').forEach((i) => { i.checked = slots.includes(i.value); });
      timesBox.querySelectorAll('.btn-row').forEach((r) => r.remove());
      if (!slots.length) times.forEach((t) => addTimeRow(t)); // AI gave clock times only
    }
    refreshChipTimes();
    nameIn.focus();
  }

  /* ---------- quick add (new medicines only) ---------- */
  let quick = null;
  if (!existing) {
    const quickIn = el('textarea', {
      attrs: { id: 'quick-text', rows: 2, maxlength: 1000, placeholder: 'Metformin 500mg 1-0-1 after food 30 days' },
    });
    const results = el('div', { attrs: { 'aria-live': 'polite' } });
    const aiBtn = el('button', { className: 'btn btn--primary', attrs: { type: 'button' } }, [icon('rx'), 'Fill with AI']);
    const ruleBtn = el('button', { className: 'btn btn--outline', attrs: { type: 'button' } }, ['Quick fill']);
    const scanIn = el('input', { attrs: { type: 'file', accept: 'image/*', capture: 'environment', 'aria-label': 'Scan a prescription photo' } });
    const scanBtn = el('span', { className: 'btn btn--outline file-btn' }, [icon('camera'), 'Scan', scanIn]);

    const useRules = () => {
      const { fields, understood } = parsePrescription(quickIn.value);
      if (!fields.name && !fields.slots) {
        results.replaceChildren(el('p', { className: 'field__hint', text: 'Not understood. Try "Name 500mg 1-0-1".' }));
        return;
      }
      applyFields(fields);
      results.replaceChildren(el('p', { className: 'field__hint', text: `${understood.join(' · ')}. Check and save.` }));
    };

    /** Show AI results; one result fills the form, several get a pick list. */
    const showAiResults = (meds, source) => {
      if (!meds.length) {
        results.replaceChildren(el('p', { className: 'field__hint', text: 'Nothing found. Try a clearer photo.' }));
        return;
      }
      applyFields(meds[0]);
      if (meds.length === 1) {
        results.replaceChildren(el('p', { className: 'field__hint', text: `Read by Gemini from your ${source}. Check and save.` }));
        return;
      }
      results.replaceChildren(
        el('p', { className: 'field__hint', text: `${meds.length} found. Tap one to fill, then save each.` }),
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
      } catch {
        useRules();
        results.prepend(el('p', { className: 'field__hint', text: 'AI unavailable, used quick fill.' }));
      } finally {
        setLoading(aiBtn, false);
      }
    });
    scanIn.addEventListener('change', async () => {
      const file = scanIn.files?.[0];
      if (!file) return;
      results.replaceChildren(el('p', { className: 'field__hint' }, [el('span', { className: 'spinner', attrs: { 'aria-hidden': 'true' } }), ' Reading photo…']));
      try {
        showAiResults(await parsePhotoWithAi(file), 'photo');
      } catch (err) {
        results.replaceChildren(el('p', { className: 'field__hint', text: err.message }));
      } finally {
        scanIn.value = '';
      }
    });

    quick = el('section', { className: 'quick-entry', attrs: { 'aria-label': 'Quick add' } }, [
      el('div', { className: 'quick-entry__head' }, [
        el('label', { text: 'Quick add', attrs: { for: 'quick-text' } }),
        el('span', { className: 'tag tag--lime', text: 'Gemini AI' }),
      ]),
      quickIn,
      el('div', { className: 'btn-row' }, [aiBtn, ruleBtn, scanBtn]),
      results,
    ]);
  }

  /* ---------- submit ---------- */
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const stockRaw = String(fd.get('stock') ?? '').trim();
    const meal = String(fd.get('meal') ?? '');
    const chosen = fd.getAll('slot').map(String);
    const custom = [...timesBox.querySelectorAll('input')].map((i) => i.value).filter(Boolean);
    const schedule = buildSchedule(chosen, custom, meal || 'any', routine);
    const med = {
      ...(existing ? { id: existing.id } : {}),
      name: String(fd.get('name') ?? '').trim(),
      generic_name: String(fd.get('generic_name') ?? '').trim(),
      dosage: String(fd.get('dosage') ?? '').trim(),
      form: String(fd.get('form')),
      color: String(fd.get('color') ?? ''),
      shape: String(fd.get('shape')),
      meal,
      times: schedule.times,
      slots: schedule.slots,
      days: fd.getAll('days').map(Number),
      dose_qty: Number(fd.get('dose_qty')),
      stock: stockRaw === '' ? null : Number(stockRaw),
      refill_at: Number(fd.get('refill_at') || 0),
      start_date: String(fd.get('start_date') ?? ''),
      end_date: String(fd.get('end_date') ?? '') || null,
      kept_at: String(fd.get('kept_at') ?? '').trim(),
      doctor: String(fd.get('doctor') ?? '').trim(),
      notes: String(fd.get('notes') ?? '').trim(),
      photo: photoData,
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
      toast(existing ? `${med.name} updated` : `${med.name} added`);
    } catch (err) {
      errorBox.replaceChildren(el('div', { className: 'banner banner--error' }, [el('p', { text: err.message })]));
    } finally {
      setLoading(saveBtn, false);
    }
  });

  body.replaceChildren(...[quick, form].filter(Boolean));
  (quick ? body.querySelector('#quick-text') : nameIn)?.focus();
}
