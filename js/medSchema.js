/**
 * Medicine field rules, shared by the browser form AND the /api/ai server.
 *
 * Why shared: input is validated twice (browser for friendly messages, server
 * because the browser can't be trusted), and AI output is validated before
 * anyone sees it. One definition means the three can never drift apart. The
 * same limits are enforced a third time by CHECK constraints in Postgres.
 */

export const FORMS = ['tablet', 'capsule', 'syrup', 'injection', 'drops', 'inhaler', 'other'];
export const COLORS = ['white', 'yellow', 'orange', 'pink', 'red', 'blue', 'green', 'brown'];
export const SHAPES = ['round', 'oval', 'capsule', 'liquid', 'other'];
export const MEALS = ['before', 'after', 'with', 'any'];
export const ROUTINE_SLOTS = ['wake', 'breakfast', 'lunch', 'dinner', 'bed'];
/** Small medicine photo stored as a data URL (JPEG/PNG/WebP, base64). */
export const PHOTO_RE = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;
export const PHOTO_MAX = 90000;

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Trim and cut a value to a max length; non-strings become ''. */
export function cleanText(value, max) {
  return typeof value === 'string' ? value.replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max) : '';
}

/** Normalise "8:00", "08:00:00", "8" into "08:00" or null. */
export function cleanTime(value) {
  if (typeof value !== 'string') return null;
  const m = value.trim().match(/^(\d{1,2})(?::(\d{2}))?/);
  if (!m) return null;
  const t = `${m[1].padStart(2, '0')}:${m[2] ?? '00'}`;
  return TIME_RE.test(t) ? t : null;
}

/**
 * Turn untrusted AI output into a safe partial medicine. Anything unknown is dropped.
 * @param {any} raw
 * @returns {null | { name: string, generic_name: string, dosage: string, form: string, meal: string, times: string[], dose_qty: number, duration_days: number | null, notes: string, color?: string, shape?: string }}
 */
export function sanitizeAiMedicine(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const name = cleanText(raw.name, 80);
  if (!name) return null;
  const times = [...new Set((Array.isArray(raw.times) ? raw.times : []).map(cleanTime).filter(Boolean))].sort().slice(0, 6);
  const qty = Number(raw.dose_qty);
  const days = Number(raw.duration_days);
  const out = {
    name,
    generic_name: cleanText(raw.generic_name, 80),
    dosage: cleanText(raw.dosage, 40),
    form: FORMS.includes(raw.form) ? raw.form : 'tablet',
    meal: MEALS.includes(raw.meal) ? raw.meal : 'any',
    times: times.length ? times : ['08:00'],
    dose_qty: Number.isFinite(qty) && qty >= 0.5 && qty <= 20 ? Math.round(qty * 2) / 2 : 1,
    duration_days: Number.isInteger(days) && days >= 1 && days <= 365 ? days : null,
    notes: cleanText(raw.notes, 200),
    doctor: cleanText(raw.doctor, 60),
    slots: [...new Set((Array.isArray(raw.slots) ? raw.slots : []).filter((s) => ROUTINE_SLOTS.includes(s)))].slice(0, 5),
  };
  if (COLORS.includes(raw.color)) out.color = raw.color;
  if (SHAPES.includes(raw.shape)) out.shape = raw.shape;
  return out;
}

/**
 * Validate a medicine from the form. Returns a list of friendly error messages.
 * @param {any} m
 * @returns {string[]}
 */
export function validateMedicine(m) {
  const errors = [];
  if (!m.name || m.name.length > 80) errors.push('Enter the medicine name (up to 80 letters).');
  if ((m.generic_name ?? '').length > 80) errors.push('Generic name is too long.');
  if ((m.dosage ?? '').length > 40) errors.push('Strength is too long.');
  if (!FORMS.includes(m.form)) errors.push('Choose what kind of medicine it is.');
  if (!COLORS.includes(m.color)) errors.push('Choose a colour.');
  if (!SHAPES.includes(m.shape)) errors.push('Choose a shape.');
  if (!MEALS.includes(m.meal)) errors.push('Choose when to take it with food.');
  if (!Array.isArray(m.times) || !m.times.length || m.times.length > 6 || m.times.some((t) => !TIME_RE.test(t))) {
    errors.push('Add between 1 and 6 valid times.');
  } else if (new Set(m.times).size !== m.times.length) {
    errors.push('The same time is listed twice.');
  }
  if (!Array.isArray(m.days) || !m.days.length) errors.push('Pick at least one day.');
  if (!(m.dose_qty >= 0.5 && m.dose_qty <= 20)) errors.push('Dose must be between ½ and 20.');
  if (m.stock !== null && !(m.stock >= 0 && m.stock <= 10000)) errors.push('Stock must be between 0 and 10,000.');
  if (!(m.refill_at >= 0 && m.refill_at <= 60)) errors.push('Refill warning must be 0–60 days.');
  if (!m.start_date) errors.push('Pick a start date.');
  if (m.end_date && m.start_date && m.end_date < m.start_date) errors.push('End date is before the start date.');
  if ((m.notes ?? '').length > 200) errors.push('Notes must be under 200 letters.');
  if ((m.kept_at ?? '').length > 60) errors.push('"Kept at" must be under 60 letters.');
  if ((m.doctor ?? '').length > 60) errors.push("Doctor's name must be under 60 letters.");
  if (m.photo && (m.photo.length > PHOTO_MAX || !PHOTO_RE.test(m.photo))) errors.push('That photo could not be used. Try another one.');
  if (m.slots && (!Array.isArray(m.slots) || m.slots.length !== m.times?.length || m.slots.some((s) => s !== 'custom' && !ROUTINE_SLOTS.includes(s)))) {
    errors.push('Times could not be matched to the routine.');
  }
  return errors;
}
