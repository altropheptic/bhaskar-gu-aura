/**
 * Row rules shared by both storage backends: which columns may be written, and
 * how rows are normalised when read back.
 *
 * Why shared: the local and cloud backends must accept and return exactly the
 * same shapes, so the views never know (or care) where data lives.
 */

export const PROFILE_COLS = [
  'name',
  'age',
  'language',
  'blood_group',
  'allergies',
  'conditions',
  'emergency_name',
  'emergency_phone',
  'wake_time',
  'breakfast_time',
  'lunch_time',
  'dinner_time',
  'bed_time',
];
export const MEDICINE_COLS = [
  'profile_id',
  'name',
  'generic_name',
  'dosage',
  'form',
  'color',
  'shape',
  'meal',
  'times',
  'slots',
  'days',
  'dose_qty',
  'stock',
  'refill_at',
  'start_date',
  'end_date',
  'active',
  'notes',
  'kept_at',
  'doctor',
  'photo',
];

export const LOG_COLS = ['id', 'medicine_id', 'scheduled_for', 'status', 'logged_at'];

/** Thrown when a scheduled dose has already been logged (the double-dose guard). */
export class DuplicateDoseError extends Error {
  constructor() {
    super('This dose is already logged');
    this.name = 'DuplicateDoseError';
  }
}

/** Keep only known columns, so stray fields never reach the database. */
export function pick(obj, cols) {
  return Object.fromEntries(cols.filter((c) => obj[c] !== undefined).map((c) => [c, obj[c]]));
}

/**
 * Normalise a medicine row (Postgres returns "08:00:00" for time and strings for
 * some numerics). Times and their routine slots are parallel arrays, so they are
 * sorted together.
 */
export function normMedicine(m) {
  const times = (m.times ?? []).map((t) => String(t).slice(0, 5));
  const slots = Array.isArray(m.slots) && m.slots.length === times.length ? m.slots : null;
  const order = times.map((t, i) => i).sort((a, b) => times[a].localeCompare(times[b]));
  return {
    ...m,
    times: order.map((i) => times[i]),
    slots: slots ? order.map((i) => slots[i]) : null,
    days: (m.days ?? []).map(Number),
    dose_qty: Number(m.dose_qty),
    stock: m.stock === null || m.stock === undefined ? null : Number(m.stock),
    refill_at: Number(m.refill_at ?? 5),
  };
}

/** Routine times come back as "08:30:00" from Postgres; keep "HH:MM". */
export function normProfile(p) {
  const out = { ...p };
  for (const k of ['wake_time', 'breakfast_time', 'lunch_time', 'dinner_time', 'bed_time']) {
    if (out[k]) out[k] = String(out[k]).slice(0, 5);
  }
  return out;
}
