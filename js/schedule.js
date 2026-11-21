/**
 * Schedule maths: pure functions, no DOM, no network.
 *
 * Why separate: the Today screen, alarms, progress stats, caregiver page and
 * reports all need the same answer to "which doses were due, and what happened
 * to each?". Keeping it pure makes it easy to reason about and reuse.
 *
 * A dose's identity is (medicine id, scheduled local date-time). Its ISO string
 * is what we store in dose_logs.scheduled_for, protected by a UNIQUE constraint.
 */

/** A dose counts as "due" from 30 min before until it is missed. */
export const DUE_BEFORE_MIN = 30;
/** A dose not logged within 2 hours of its time is "missed". */
export const MISSED_AFTER_MIN = 120;

const MS_MIN = 60_000;

/** Local "YYYY-MM-DD" for a Date. @param {Date} d */
export function isoDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Midnight (local) of the given day. @param {Date} d */
export function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** @param {Date} d @param {number} n */
export function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

/** Is this medicine scheduled on this day? */
export function isScheduledOn(med, day) {
  if (!med.active) return false;
  const key = isoDate(day);
  if (med.start_date && key < med.start_date) return false;
  if (med.end_date && key > med.end_date) return false;
  return med.days.includes(day.getDay());
}

/** Stable key for matching logs to doses. */
export const doseKey = (medicineId, when) => `${medicineId}|${new Date(when).getTime()}`;

/**
 * All doses for one day, sorted by time.
 * @param {any[]} medicines
 * @param {Date} day
 * @returns {{ med: any, time: string, slot: string, at: Date, iso: string, key: string }[]}
 */
export function dosesForDay(medicines, day) {
  const out = [];
  for (const med of medicines) {
    if (!isScheduledOn(med, day)) continue;
    med.times.forEach((time, i) => {
      const [h, m] = time.split(':').map(Number);
      const at = new Date(day);
      at.setHours(h, m, 0, 0);
      out.push({ med, time, slot: med.slots?.[i] ?? 'custom', at, iso: at.toISOString(), key: doseKey(med.id, at) });
    });
  }
  return out.sort((a, b) => a.at - b.at || a.med.name.localeCompare(b.med.name));
}

const hhmm = (d) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
const minutesOf = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
/** How far a re-timed dose may be from its original log and still match it. */
const RETIME_WINDOW_MIN = 180;

/**
 * Index of logs: exact doseKey -> log, plus logs grouped by medicine and day.
 * @param {any[]} logs
 */
export function indexLogs(logs) {
  const map = new Map();
  map.byMedDay = new Map();
  for (const log of logs) {
    map.set(doseKey(log.medicine_id, log.scheduled_for), log);
    const at = new Date(log.scheduled_for);
    const k = `${log.medicine_id}|${isoDate(at)}`;
    if (!map.byMedDay.has(k)) map.byMedDay.set(k, []);
    map.byMedDay.get(k).push({ log, time: hhmm(at) });
  }
  return map;
}

/**
 * The log for a dose. Exact match first. If the medicine's time was changed
 * (for example its routine moved breakfast from 8:00 to 9:00), earlier logs no
 * longer match exactly, so a dose also claims an "orphan" log of the same
 * medicine on the same day: one whose time is no longer in the schedule, that is
 * within 3 hours, and for which this dose is the nearest scheduled time. That
 * keeps history and today's "taken" state correct after re-timing, without ever
 * letting one log count for two doses.
 */
export function findLog(dose, logIndex) {
  const exact = logIndex.get(dose.key);
  if (exact) return exact;
  const list = logIndex.byMedDay?.get(`${dose.med.id}|${isoDate(dose.at)}`);
  if (!list) return undefined;
  const times = dose.med.times;
  let best;
  let bestDiff = Infinity;
  for (const { log, time } of list) {
    if (times.includes(time)) continue; // matches a current dose exactly: not an orphan
    const diff = Math.abs(minutesOf(time) - minutesOf(dose.time));
    if (diff > RETIME_WINDOW_MIN || diff >= bestDiff) continue;
    const nearest = times.reduce((a, t) => (Math.abs(minutesOf(t) - minutesOf(time)) < Math.abs(minutesOf(a) - minutesOf(time)) ? t : a), times[0]);
    if (nearest !== dose.time) continue;
    best = log;
    bestDiff = diff;
  }
  return best;
}

/**
 * Status of one dose right now.
 * @returns {'taken' | 'skipped' | 'missed' | 'due' | 'upcoming'}
 */
export function doseStatus(dose, logIndex, now = new Date()) {
  const log = findLog(dose, logIndex);
  if (log) return log.status;
  const diffMin = (now - dose.at) / MS_MIN;
  if (diffMin > MISSED_AFTER_MIN) return 'missed';
  if (diffMin >= -DUE_BEFORE_MIN) return 'due';
  return 'upcoming';
}

/** Group doses by time of day ("08:00" -> [...]). */
export function groupByTime(doses) {
  const groups = new Map();
  for (const d of doses) {
    if (!groups.has(d.time)) groups.set(d.time, []);
    groups.get(d.time).push(d);
  }
  return [...groups.entries()];
}

/** Friendly label for a time slot. @param {string} hhmm */
export function slotLabel(hhmm) {
  const h = Number(hhmm.slice(0, 2));
  if (h < 5) return 'Night';
  if (h < 12) return 'Morning';
  if (h < 17) return 'Afternoon';
  if (h < 21) return 'Evening';
  return 'Night';
}

/**
 * Taken / scheduled for one day, counting only doses whose outcome is known
 * (logged, or past the missed threshold). Future doses don't count against you.
 */
export function dayScore(medicines, logIndex, day, now = new Date()) {
  let taken = 0;
  let counted = 0;
  for (const dose of dosesForDay(medicines, day)) {
    const status = doseStatus(dose, logIndex, now);
    if (status === 'upcoming' || status === 'due') continue;
    counted += 1;
    if (status === 'taken') taken += 1;
  }
  return { taken, counted };
}

/** Adherence % over the last `days` days (including today). Null when nothing was due yet. */
export function adherence(medicines, logIndex, days = 7, now = new Date()) {
  let taken = 0;
  let counted = 0;
  for (let i = 0; i < days; i += 1) {
    const s = dayScore(medicines, logIndex, addDays(startOfDay(now), -i), now);
    taken += s.taken;
    counted += s.counted;
  }
  return counted ? Math.round((taken / counted) * 100) : null;
}

/**
 * Current streak: consecutive days, ending yesterday (or today if today is
 * already complete), on which every due dose was taken.
 */
export function streak(medicines, logIndex, now = new Date(), maxDays = 60) {
  let count = 0;
  const today = startOfDay(now);
  const todayScore = dayScore(medicines, logIndex, today, now);
  const todayDoses = dosesForDay(medicines, today);
  const todayAllDone = todayDoses.length > 0 && todayDoses.every((d) => doseStatus(d, logIndex, now) === 'taken');
  if (todayAllDone) count += 1;
  else if (todayScore.counted > todayScore.taken) return 0;
  for (let i = 1; i <= maxDays; i += 1) {
    const s = dayScore(medicines, logIndex, addDays(today, -i), now);
    if (s.counted === 0) continue; // nothing scheduled that day: neutral
    if (s.taken < s.counted) break;
    count += 1;
  }
  return count;
}

/** Per-medicine adherence % over `days`. */
export function perMedicine(medicines, logIndex, days = 14, now = new Date()) {
  return medicines.filter((m) => m.active).map((med) => {
    const pct = adherence([med], logIndex, days, now);
    return { med, pct };
  });
}

/** How many days the current stock lasts, or null when stock isn't tracked. */
export function daysOfSupply(med) {
  if (med.stock === null || med.stock === undefined) return null;
  const perDay = med.dose_qty * med.times.length * (med.days.length / 7);
  if (!perDay) return null;
  return Math.floor(med.stock / perDay);
}

/** Normalise a generic name for duplicate detection ("Paracetamol 500" -> "paracetamol"). */
function genericKey(med) {
  const raw = (med.generic_name || '').toLowerCase().replace(/[^a-z ]/g, ' ').trim();
  return raw.split(/\s+/)[0] || '';
}

/**
 * Pairs of active medicines that contain the same generic drug: a classic cause
 * of accidental double dosing (two brands, one molecule).
 * @returns {[any, any][]}
 */
export function duplicateGenerics(medicines) {
  const seen = new Map();
  const pairs = [];
  for (const med of medicines.filter((m) => m.active)) {
    const key = genericKey(med);
    if (!key || key.length < 4) continue;
    if (seen.has(key)) pairs.push([seen.get(key), med]);
    else seen.set(key, med);
  }
  return pairs;
}
