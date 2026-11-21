/**
 * Medicine form <-> data, as pure functions (no DOM), so they are unit-tested.
 *
 * Why separate: turning raw form values into a medicine involves real rules
 * (routine slots become clock times, an empty stock means "not tracked", an
 * edited medicine keeps its id). Keeping that out of the dialog code makes the
 * dialog simpler and the rules testable.
 */
import { isoDate } from './schedule.js';
import { buildSchedule } from './routine.js';

/**
 * Defaults for a brand-new medicine.
 * @param {Date} [today]
 * @returns {import('./types.js').Medicine}
 */
export function newMedicine(today = new Date()) {
  return {
    name: '',
    generic_name: '',
    dosage: '',
    form: 'tablet',
    color: 'white',
    shape: 'round',
    meal: 'after',
    times: [],
    slots: ['breakfast'],
    days: [0, 1, 2, 3, 4, 5, 6],
    dose_qty: 1,
    stock: null,
    refill_at: 5,
    start_date: isoDate(today),
    end_date: null,
    active: true,
    notes: '',
    kept_at: '',
    doctor: '',
    photo: null,
  };
}

/** Custom (non-routine) clock times of an existing medicine. */
export function customTimesOf(med) {
  return med.slots ? med.times.filter((_, i) => med.slots[i] === 'custom') : [...med.times];
}

const text = (fd, key) => String(fd.get(key) ?? '').trim();

/**
 * Read the medicine form.
 * @param {FormData} fd
 * @param {{ existing?: import('./types.js').Medicine | null, customTimes: string[], routine: Record<string, string>, photo: string | null }} opts
 * @returns {import('./types.js').Medicine}
 */
export function formToMedicine(fd, { existing = null, customTimes, routine, photo }) {
  const meal = text(fd, 'meal');
  const stockRaw = text(fd, 'stock');
  const schedule = buildSchedule(fd.getAll('slot').map(String), customTimes.filter(Boolean), meal || 'any', routine);
  return {
    ...(existing ? { id: existing.id } : {}),
    name: text(fd, 'name'),
    generic_name: text(fd, 'generic_name'),
    dosage: text(fd, 'dosage'),
    form: text(fd, 'form'),
    color: text(fd, 'color'),
    shape: text(fd, 'shape'),
    meal,
    times: schedule.times,
    slots: schedule.slots,
    days: fd.getAll('days').map(Number),
    dose_qty: Number(fd.get('dose_qty')),
    stock: stockRaw === '' ? null : Number(stockRaw),
    refill_at: Number(fd.get('refill_at') || 0),
    start_date: text(fd, 'start_date'),
    end_date: text(fd, 'end_date') || null,
    kept_at: text(fd, 'kept_at'),
    doctor: text(fd, 'doctor'),
    notes: text(fd, 'notes'),
    photo,
    active: existing ? fd.get('active') !== null : true,
  };
}
