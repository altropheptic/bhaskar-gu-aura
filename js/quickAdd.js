/**
 * Quick add: type the medicine the way the doctor wrote it, or scan the
 * prescription, and the form fills itself.
 *
 * One button, two engines: the offline 1-0-1 reader (quickEntry.js) answers
 * instantly when it can; anything it can't read ("BP tablet in the morning")
 * goes to Gemini. Neither saves anything: a person checks the form and saves.
 */
import { el, icon, setLoading } from './ui.js';
import { parsePrescription } from './quickEntry.js';
import { parseTextWithAi, parsePhotoWithAi } from './ai.js';

const hint = (text) => el('p', { className: 'field__hint', text });

/**
 * Build the quick-add panel.
 * @param {(fields: Record<string, any>) => void} applyFields  fills the medicine form
 * @returns {HTMLElement}
 */
export function quickAddSection(applyFields) {
  const quickIn = /** @type {HTMLTextAreaElement} */ (
    el('textarea', {
      attrs: { id: 'quick-text', rows: 2, maxlength: 1000, placeholder: 'Metformin 500mg 1-0-1 after food 30 days' },
    })
  );
  const results = el('div', { attrs: { 'aria-live': 'polite' } });
  const fillBtn = /** @type {HTMLButtonElement} */ (
    el('button', { className: 'btn btn--primary', attrs: { type: 'button' } }, [icon('rx'), 'Quick fill'])
  );
  const scanIn = /** @type {HTMLInputElement} */ (
    el('input', {
      attrs: { type: 'file', accept: 'image/*', capture: 'environment', 'aria-label': 'Scan a prescription photo' },
    })
  );
  const scanBtn = el('span', { className: 'btn btn--outline file-btn' }, [icon('camera'), 'Scan', scanIn]);

  /** Offline reading. @returns {boolean} true when it understood the text */
  const useRules = () => {
    const { fields, understood } = parsePrescription(quickIn.value);
    if (!fields.name || !fields.slots) return false;
    applyFields(fields);
    results.replaceChildren(hint(`${understood.join(' · ')}. Check and save.`));
    return true;
  };

  /** One AI result fills the form; several get a pick list. */
  const showAiResults = (meds, source) => {
    if (!meds.length) {
      results.replaceChildren(hint('Nothing found. Try a clearer photo.'));
      return;
    }
    applyFields(meds[0]);
    if (meds.length === 1) {
      results.replaceChildren(hint(`Read by Gemini from your ${source}. Check and save.`));
      return;
    }
    results.replaceChildren(
      hint(`${meds.length} found. Tap one to fill, then save each.`),
      el(
        'div',
        { className: 'btn-row' },
        meds.map((med) =>
          el('button', {
            className: 'btn btn--sm btn--ghost',
            text: `${med.name} ${med.dosage}`.trim(),
            attrs: { type: 'button' },
            on: { click: () => applyFields(med) },
          }),
        ),
      ),
    );
  };

  fillBtn.addEventListener('click', async () => {
    if (!quickIn.value.trim()) {
      results.replaceChildren(hint('Type the medicine first, e.g. "Metformin 500mg 1-0-1".'));
      quickIn.focus();
      return;
    }
    if (useRules()) return;
    setLoading(fillBtn, true, 'Reading…');
    try {
      showAiResults(await parseTextWithAi(quickIn.value), 'text');
    } catch {
      const { fields } = parsePrescription(quickIn.value);
      if (fields.name || fields.slots) applyFields(fields);
      results.replaceChildren(hint('Could not read all of it. Try "Name 500mg 1-0-1".'));
    } finally {
      setLoading(fillBtn, false);
    }
  });

  scanIn.addEventListener('change', async () => {
    const file = scanIn.files?.[0];
    if (!file) return;
    results.replaceChildren(
      el('p', { className: 'field__hint' }, [
        el('span', { className: 'spinner', attrs: { 'aria-hidden': 'true' } }),
        ' Reading photo…',
      ]),
    );
    try {
      showAiResults(await parsePhotoWithAi(file), 'photo');
    } catch (err) {
      results.replaceChildren(hint(err.message));
    } finally {
      scanIn.value = '';
    }
  });

  return el('section', { className: 'quick-entry', attrs: { 'aria-label': 'Quick add' } }, [
    el('div', { className: 'quick-entry__head' }, [el('label', { text: 'Quick add', attrs: { for: 'quick-text' } })]),
    quickIn,
    el('div', { className: 'btn-row' }, [fillBtn, scanBtn]),
    results,
  ]);
}
