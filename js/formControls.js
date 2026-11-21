/**
 * Reusable form controls: labelled fields, pill-style choices, the dose stepper,
 * colour swatches, the weekday picker and the medicine photo picker.
 *
 * Why native inputs underneath: every control is a real <input> styled with CSS
 * (:has(:checked)), so keyboard use, screen readers and FormData all work with
 * no extra code, and the form can be read in one place on submit.
 */
import { el, icon, showBanner, tintClass, FORM_UNIT } from './ui.js';
import { makeThumbnail, photoImg } from './photo.js';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

let uid = 0;
const nextId = (prefix) => `${prefix}-${(uid += 1)}`;

/**
 * Label + input (+ optional hint), linked by id.
 * @param {string} label
 * @param {HTMLElement} input
 * @param {string} [hint]
 */
export function field(label, input, hint) {
  input.id ||= nextId('f');
  return el('div', { className: 'field' }, [
    el('label', { text: label, attrs: { for: input.id } }),
    input,
    hint && el('p', { className: 'field__hint', text: hint }),
  ]);
}

/**
 * A <fieldset> with a visible legend.
 * @param {string} legend
 * @param {...(Node | string | null | false)} children
 */
export function fieldset(legend, ...children) {
  return el('fieldset', {}, [el('legend', { text: legend }), ...children]);
}

/**
 * Segmented control: radio inputs styled as pills.
 * @param {string} name
 * @param {string[]} options
 * @param {Record<string, string>} labels
 * @param {string} value
 * @param {(option: string) => Node} [iconFor]
 */
export function seg(name, options, labels, value, iconFor) {
  return el('div', { className: 'seg', attrs: { role: 'radiogroup' } }, options.map((o) => el('label', {}, [
    el('input', { attrs: { type: 'radio', name, value: o, checked: o === value } }),
    iconFor ? iconFor(o) : null,
    labels[o] ?? o,
  ])));
}

/**
 * "Dose each time" stepper with a unit that follows the medicine type
 * ("2 tablets", "10 ml").
 * @param {number} value
 * @param {() => string} currentForm  returns the selected medicine type
 * @returns {{ element: HTMLElement, input: HTMLInputElement, refresh: () => void }}
 */
export function doseStepper(value, currentForm) {
  const input = /** @type {HTMLInputElement} */ (el('input', {
    attrs: { name: 'dose_qty', type: 'number', min: 0.5, max: 20, step: 0.5, inputmode: 'decimal', value, 'aria-label': 'Dose each time' },
  }));
  const unitEl = el('span', { className: 'stepper__unit' });
  const refresh = () => {
    const unit = FORM_UNIT[currentForm()] ?? 'dose';
    const qty = Number(input.value) || 1;
    unitEl.textContent = qty !== 1 && !['ml', 'drops'].includes(unit) ? `${unit}s` : unit;
  };
  const step = (delta) => {
    input.value = String(Math.min(20, Math.max(0.5, (Number(input.value) || 1) + delta)));
    refresh();
  };
  const element = el('div', { className: 'stepper' }, [
    el('button', { text: '−', attrs: { type: 'button', 'aria-label': 'Less' }, on: { click: () => step(-0.5) } }),
    input,
    el('button', { text: '+', attrs: { type: 'button', 'aria-label': 'More' }, on: { click: () => step(0.5) } }),
    unitEl,
  ]);
  input.addEventListener('input', refresh);
  refresh();
  return { element, input, refresh };
}

/**
 * Colour swatches (radio inputs named "color").
 * @param {string[]} colours
 * @param {string} value
 */
export function colourPicker(colours, value) {
  return fieldset('Colour', el('div', { className: 'swatches', attrs: { role: 'radiogroup' } }, colours.map((c) => el('label', { className: tintClass(c), attrs: { title: c } }, [
    el('input', { attrs: { type: 'radio', name: 'color', value: c, checked: c === value, 'aria-label': c[0].toUpperCase() + c.slice(1) } }),
  ]))));
}

/**
 * Weekday circles (checkboxes named "days", 0 = Sunday).
 * @param {number[]} value
 */
export function dayPicker(value) {
  return fieldset('Days', el('div', { className: 'days' }, DAY_NAMES.map((d, i) => el('label', {}, [
    el('input', { attrs: { type: 'checkbox', name: 'days', value: i, checked: value.includes(i) } }), d,
  ]))));
}

/**
 * Photo picker: take or choose a photo, shrunk to a small thumbnail in the
 * browser before it is ever saved.
 * @param {string | null} initial
 * @returns {{ element: HTMLElement, readonly value: string | null }}
 */
export function photoPicker(initial) {
  let photo = initial ?? null;
  const element = el('div', { className: 'photo-field' });
  function render() {
    const fileIn = el('input', { attrs: { type: 'file', accept: 'image/*', capture: 'environment', 'aria-label': 'Add a photo of the medicine' } });
    fileIn.addEventListener('change', async () => {
      const file = fileIn.files?.[0];
      if (!file) return;
      try { photo = await makeThumbnail(file); render(); } catch (err) { showBanner('error', err.message); }
    });
    if (photo) {
      element.replaceChildren(
        photoImg(photo, 'Photo of the medicine', 'med-photo med-photo--lg'),
        el('div', { className: 'btn-row' }, [
          el('span', { className: 'btn btn--ghost btn--sm file-btn' }, ['Change', fileIn]),
          el('button', { className: 'btn btn--danger btn--sm', text: 'Remove', attrs: { type: 'button' }, on: { click: () => { photo = null; render(); } } }),
        ]),
      );
    } else {
      element.replaceChildren(
        el('span', { className: 'photo-field__empty file-btn' }, [icon('camera'), fileIn]),
        el('span', { className: 'field__hint', text: 'Add photo' }),
      );
    }
  }
  render();
  return { element, get value() { return photo; } };
}
