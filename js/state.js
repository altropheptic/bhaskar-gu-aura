/**
 * App state + actions (a tiny store with subscribe/emit).
 *
 * Why: every view (Today, Medicines, Progress, Family) and the alarm engine read
 * the same data. Actions here are the only code that writes through `store`,
 * then reload and notify subscribers, so the screens can never disagree.
 */
import { store, DuplicateDoseError } from './store.js';
import { indexLogs, addDays, startOfDay } from './schedule.js';
import { routineOf, retime } from './routine.js';

const PROFILE_KEY = 'dawai-dost-profile';

export const state = {
  /** @type {any[]} */ profiles: [],
  /** @type {string | null} */ profileId: null,
  /** @type {any[]} */ medicines: [],
  /** @type {any[]} */ logs: [],
  /** @type {Map<string, any>} */ logIndex: new Map(),
  /** @type {any[]} */ links: [],
  tab: 'today',
};

const listeners = new Set();
/** @param {(s: typeof state) => void} fn */
export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
export function emit() { for (const fn of listeners) fn(state); }

/** The selected person. */
export const currentProfile = () => state.profiles.find((p) => p.id === state.profileId) ?? null;

/** Load everyone, pick the remembered person, then their medicines and logs. */
export async function loadAll() {
  state.profiles = await store.listProfiles();
  let remembered = null;
  try { remembered = localStorage.getItem(PROFILE_KEY); } catch { /* blocked storage */ }
  const ids = state.profiles.map((p) => p.id);
  state.profileId = ids.includes(state.profileId) ? state.profileId : ids.includes(remembered) ? remembered : ids[0] ?? null;
  await loadProfileData();
}

/** Reload the selected person's medicines, last 30 days of logs and share links. */
export async function loadProfileData() {
  if (!state.profileId) {
    Object.assign(state, { medicines: [], logs: [], logIndex: new Map(), links: [] });
    emit();
    return;
  }
  state.medicines = await store.listMedicines(state.profileId);
  const since = addDays(startOfDay(new Date()), -30).toISOString();
  state.logs = await store.listLogs(state.medicines.map((m) => m.id), since);
  state.logIndex = indexLogs(state.logs);
  state.links = store.mode === 'cloud' ? await store.listLinks(state.profileId).catch(() => []) : [];
  emit();
}

/** @param {string} id */
export async function selectProfile(id) {
  state.profileId = id;
  try { localStorage.setItem(PROFILE_KEY, id); } catch { /* ignore */ }
  await loadProfileData();
}

/**
 * Create or update a person. Selects a newly created one. If their daily routine
 * changed, every dose anchored to it ("after breakfast") is re-timed to match.
 * @returns {Promise<any>} the saved profile (with `retimed` = number of medicines moved)
 */
export async function saveProfile(profile) {
  const saved = await store.saveProfile(profile);
  if (!profile.id) state.profileId = saved.id;
  let retimed = 0;
  if (profile.id) {
    const routine = routineOf({ ...saved, ...profile });
    for (const med of await store.listMedicines(profile.id)) {
      const next = retime(med, routine);
      if (next) { await store.saveMedicine({ id: med.id, ...next }); retimed += 1; }
    }
  }
  await loadAll();
  return { ...saved, retimed };
}

export async function deleteProfile(id) {
  await store.deleteProfile(id);
  if (state.profileId === id) state.profileId = null;
  await loadAll();
}

/** Create or update a medicine for the selected person. */
export async function saveMedicine(med) {
  const saved = await store.saveMedicine({ ...med, profile_id: med.profile_id ?? state.profileId });
  await loadProfileData();
  return saved;
}

export async function deleteMedicine(id) {
  await store.deleteMedicine(id);
  await loadProfileData();
}

/**
 * Log a dose as taken or skipped. Taking a dose lowers the stock count.
 * Throws DuplicateDoseError if it was already logged (e.g. from another device).
 * @param {{ med: any, iso: string }} dose
 * @param {'taken' | 'skipped'} status
 */
export async function logDose(dose, status) {
  try {
    const log = await store.addLog({ medicine_id: dose.med.id, scheduled_for: dose.iso, status });
    if (status === 'taken' && dose.med.stock !== null && dose.med.stock !== undefined) {
      await store.saveMedicine({ id: dose.med.id, stock: Math.max(0, dose.med.stock - dose.med.dose_qty) });
    }
    await loadProfileData();
    return log;
  } catch (err) {
    if (err instanceof DuplicateDoseError) await loadProfileData();
    throw err;
  }
}

/** Undo a logged dose (and give the stock back if it had been taken). */
export async function undoDose(log) {
  await store.deleteLog(log.id);
  const med = state.medicines.find((m) => m.id === log.medicine_id);
  if (log.status === 'taken' && med && med.stock !== null && med.stock !== undefined) {
    await store.saveMedicine({ id: med.id, stock: med.stock + med.dose_qty });
  }
  await loadProfileData();
}
