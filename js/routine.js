/**
 * Routine-based reminders.
 *
 * Why: research on how people actually remember medicines (Stawarz et al.,
 * CHI 2014; Digital Health 2016, >1,000 participants) found that daily routines
 * ("after breakfast", "at bedtime") and place cues work better than clock
 * timers, and that combining two cues beats one. Most reminder apps only offer
 * clock alarms. Here every person has a routine, doses are anchored to routine
 * slots, and when the routine changes (a late breakfast, Ramadan, travel) every
 * anchored dose moves with it.
 *
 * Doses still store a materialised clock time (`times`), so the schedule,
 * alarms, caregiver view and calendar export stay simple.
 */

export const SLOTS = ['wake', 'breakfast', 'lunch', 'dinner', 'bed'];
export const SLOT_LABEL = {
  wake: 'Wake up',
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  bed: 'Bedtime',
  custom: 'Custom',
};
export const ROUTINE_FIELDS = {
  wake: 'wake_time',
  breakfast: 'breakfast_time',
  lunch: 'lunch_time',
  dinner: 'dinner_time',
  bed: 'bed_time',
};
export const DEFAULT_ROUTINE = {
  wake_time: '07:00',
  breakfast_time: '08:30',
  lunch_time: '13:30',
  dinner_time: '20:30',
  bed_time: '22:00',
};

/** Meal slots shift with food timing; wake/bed don't. */
const MEAL_SLOTS = new Set(['breakfast', 'lunch', 'dinner']);
const MEAL_OFFSET_MIN = { before: -30, with: 0, after: 15, any: 0 };

const toMin = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};
const toHHMM = (min) => {
  const m = ((min % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};

/** A person's routine with defaults filled in and times as "HH:MM". */
export function routineOf(profile) {
  const out = {};
  for (const [key, def] of Object.entries(DEFAULT_ROUTINE)) out[key] = String(profile?.[key] ?? def).slice(0, 5);
  return out;
}

/**
 * Clock time for a routine slot, e.g. ("breakfast", "after") with breakfast 08:30 -> "08:45".
 * @param {string} slot
 * @param {string} meal  before | with | after | any
 * @param {Record<string,string>} routine
 */
export function slotTime(slot, meal, routine) {
  const base = toMin(routine[ROUTINE_FIELDS[slot]] ?? DEFAULT_ROUTINE[ROUTINE_FIELDS[slot]]);
  return toHHMM(base + (MEAL_SLOTS.has(slot) ? (MEAL_OFFSET_MIN[meal] ?? 0) : 0));
}

/**
 * Build the parallel (times, slots) arrays from chosen slots + custom times, sorted by time.
 * @param {string[]} slots     chosen routine slots
 * @param {string[]} custom    extra clock times ("HH:MM")
 * @param {string} meal
 * @param {Record<string,string>} routine
 * @returns {{ times: string[], slots: string[] }}
 */
export function buildSchedule(slots, custom, meal, routine) {
  const pairs = [
    ...slots.map((s) => ({ slot: s, time: slotTime(s, meal, routine) })),
    ...custom.map((t) => ({ slot: 'custom', time: t })),
  ];
  const seen = new Set();
  const unique = pairs.filter((p) => (seen.has(p.time) ? false : (seen.add(p.time), true)));
  unique.sort((a, b) => a.time.localeCompare(b.time));
  return { times: unique.map((p) => p.time), slots: unique.map((p) => p.slot) };
}

/**
 * Re-time a medicine's anchored doses for a (new) routine. Custom times are kept.
 * Returns null when nothing changes.
 */
export function retime(med, routine) {
  if (!Array.isArray(med.slots) || !med.slots.length) return null;
  const anchored = med.slots.filter((s) => s !== 'custom');
  const custom = med.times.filter((_, i) => med.slots[i] === 'custom');
  const next = buildSchedule(anchored, custom, med.meal, routine);
  const same = next.times.join() === med.times.join() && next.slots.join() === med.slots.join();
  return same ? null : next;
}

/** Best label for a dose: its routine slot if anchored, else the part of day. */
export function doseSlotLabel(slot, time) {
  if (slot && slot !== 'custom') return SLOT_LABEL[slot];
  const h = Number(time.slice(0, 2));
  if (h < 5) return 'Night';
  if (h < 12) return 'Morning';
  if (h < 17) return 'Afternoon';
  if (h < 21) return 'Evening';
  return 'Night';
}
