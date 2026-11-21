/**
 * Add / edit a person ("Dadi", "Nanaji") including emergency details.
 *
 * Why profiles: one caregiver often manages medicines for two or three elders
 * from the same phone. Emergency fields feed the printable emergency card.
 */
import { el, openDialog, setLoading, toast } from './ui.js';
import { saveProfile, deleteProfile, state } from './state.js';

const BLOOD = ['', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

/** Validate a profile; returns friendly errors. */
function validate(p) {
  const errors = [];
  if (!p.name || p.name.length > 40) errors.push('Enter a name (up to 40 letters).');
  if (p.age !== null && !(Number.isInteger(p.age) && p.age >= 0 && p.age <= 120)) errors.push('Age must be 0–120.');
  if (!['en', 'hi'].includes(p.language)) errors.push('Choose a language.');
  if (p.blood_group && !BLOOD.includes(p.blood_group)) errors.push('Choose a valid blood group.');
  if ((p.allergies ?? '').length > 200 || (p.conditions ?? '').length > 200) errors.push('Allergies and conditions must be under 200 letters.');
  if ((p.emergency_name ?? '').length > 40) errors.push('Contact name is too long.');
  if (p.emergency_phone && !/^[0-9+ -]{0,20}$/.test(p.emergency_phone)) errors.push('Phone can only contain digits, spaces, + and -.');
  return errors;
}

/**
 * @param {any} [existing]
 * @param {{ onSaved?: (profile: any) => void }} [opts]
 */
export function openProfileDialog(existing, { onSaved } = {}) {
  const dialog = /** @type {HTMLDialogElement} */ (document.getElementById('profile-dialog'));
  const p = existing ?? { name: '', age: null, language: 'en', blood_group: '', allergies: '', conditions: '', emergency_name: '', emergency_phone: '' };
  const body = openDialog(dialog, existing ? `Edit ${existing.name}` : 'Add a person', 'profile-title');

  const input = (name, label, attrs = {}, hint) => {
    const id = `pf-${name}`;
    return el('div', { className: 'field' }, [
      el('label', { text: label, attrs: { for: id } }),
      el('input', { attrs: { id, name, value: p[name] ?? '', autocomplete: 'off', ...attrs } }),
      hint && el('p', { className: 'field__hint', text: hint }),
    ]);
  };
  const errorBox = el('div', { attrs: { role: 'alert' } });
  const saveBtn = el('button', { className: 'btn btn--primary btn--xl', text: existing ? 'Save' : 'Continue', attrs: { type: 'submit' } });

  const form = el('form', { attrs: { novalidate: true } }, [
    input('name', 'Name', { maxlength: 40, required: true, placeholder: 'Dadi, Papa, Mrs. Das' }),
    el('div', { className: 'field-grid' }, [
      input('age', 'Age', { type: 'number', min: 0, max: 120, inputmode: 'numeric' }),
      el('div', { className: 'field' }, [
        el('label', { text: 'Voice language', attrs: { for: 'pf-language' } }),
        el('select', { attrs: { id: 'pf-language', name: 'language' } }, [
          el('option', { text: 'English', attrs: { value: 'en', selected: p.language === 'en' } }),
          el('option', { text: 'हिन्दी (Hindi)', attrs: { value: 'hi', selected: p.language === 'hi' } }),
        ]),
      ]),
    ]),
    el('details', { attrs: { open: Boolean(existing) } }, [
      el('summary', { text: 'Emergency details (optional)' }),
      el('div', { className: 'field-grid' }, [
        el('div', { className: 'field' }, [
          el('label', { text: 'Blood group', attrs: { for: 'pf-blood' } }),
          el('select', { attrs: { id: 'pf-blood', name: 'blood_group' } }, BLOOD.map((b) => el('option', { text: b || 'Not known', attrs: { value: b, selected: (p.blood_group ?? '') === b } }))),
        ]),
        input('emergency_phone', 'Emergency phone', { maxlength: 20, inputmode: 'tel', type: 'tel' }),
      ]),
      input('emergency_name', 'Emergency contact', { maxlength: 40 }),
      input('allergies', 'Allergies', { maxlength: 200 }),
      input('conditions', 'Conditions', { maxlength: 200 }),
    ]),
    errorBox,
    el('div', { className: 'dialog__foot' }, [
      existing && state.profiles.length > 1 && el('button', {
        className: 'btn btn--danger', text: 'Remove person', attrs: { type: 'button' },
        on: {
          click: async () => {
            if (!window.confirm(`Remove ${existing.name} and all their medicines? This cannot be undone.`)) return;
            await deleteProfile(existing.id);
            dialog.close();
            toast(`${existing.name} removed.`);
          },
        },
      }),
      el('button', { className: 'btn btn--ghost', text: 'Cancel', attrs: { type: 'button' }, on: { click: () => dialog.close() } }),
      saveBtn,
    ]),
  ]);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const ageRaw = String(fd.get('age') ?? '').trim();
    const profile = {
      ...(existing ? { id: existing.id } : {}),
      name: String(fd.get('name') ?? '').trim(),
      age: ageRaw === '' ? null : Number(ageRaw),
      language: String(fd.get('language')),
      blood_group: String(fd.get('blood_group') ?? '') || null,
      allergies: String(fd.get('allergies') ?? '').trim(),
      conditions: String(fd.get('conditions') ?? '').trim(),
      emergency_name: String(fd.get('emergency_name') ?? '').trim(),
      emergency_phone: String(fd.get('emergency_phone') ?? '').trim(),
    };
    const errors = validate(profile);
    if (errors.length) {
      errorBox.replaceChildren(el('div', { className: 'banner banner--error' }, [el('ul', {}, errors.map((t) => el('li', { text: t })))]));
      return;
    }
    setLoading(saveBtn, true, 'Saving…');
    try {
      const saved = await saveProfile(profile);
      dialog.close();
      onSaved?.(saved);
    } catch (err) {
      errorBox.replaceChildren(el('div', { className: 'banner banner--error' }, [el('p', { text: err.message })]));
    } finally {
      setLoading(saveBtn, false);
    }
  });

  body.replaceChildren(form);
  form.querySelector('#pf-name')?.focus();
}
