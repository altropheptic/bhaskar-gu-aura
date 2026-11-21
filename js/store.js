/**
 * Data store: one interface, two interchangeable backends.
 *
 *   cloud : Supabase (silent anonymous account, protected by RLS). The default.
 *   local : localStorage on this device. Used automatically if Supabase is down,
 *           so the app never stops working for an elder at dose time.
 *
 * New accounts start with a sample family, loaded once through importAll().
 *
 * Why one interface: views never care where data lives, and the fallback is just
 * a different backend object rather than if/else branches all over the UI.
 */
import { supabase, ensureAnonymousSession } from './supabaseClient.js';

const LOCAL_KEY = 'dawai-dost-local-v1';

const PROFILE_COLS = ['name', 'age', 'language', 'blood_group', 'allergies', 'conditions', 'emergency_name', 'emergency_phone',
  'wake_time', 'breakfast_time', 'lunch_time', 'dinner_time', 'bed_time'];
const MEDICINE_COLS = ['profile_id', 'name', 'generic_name', 'dosage', 'form', 'color', 'shape', 'meal', 'times', 'slots', 'days', 'dose_qty',
  'stock', 'refill_at', 'start_date', 'end_date', 'active', 'notes', 'kept_at', 'doctor', 'photo'];

const LOG_COLS = ['id', 'medicine_id', 'scheduled_for', 'status', 'logged_at'];

/** Thrown when a scheduled dose has already been logged (the double-dose guard). */
export class DuplicateDoseError extends Error {
  constructor() { super('This dose is already logged'); this.name = 'DuplicateDoseError'; }
}

/** Keep only known columns, so stray fields never reach the database. */
function pick(obj, cols) {
  return Object.fromEntries(cols.filter((c) => obj[c] !== undefined).map((c) => [c, obj[c]]));
}

/**
 * Normalise a medicine row (Postgres returns "08:00:00" for time and strings for
 * some numerics). Times and their routine slots are parallel arrays, so they are
 * sorted together.
 */
function normMedicine(m) {
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
function normProfile(p) {
  const out = { ...p };
  for (const k of ['wake_time', 'breakfast_time', 'lunch_time', 'dinner_time', 'bed_time']) {
    if (out[k]) out[k] = String(out[k]).slice(0, 5);
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Memory backend (this device's localStorage)                         */
/* ------------------------------------------------------------------ */
class MemoryBackend {
  /**
   * @param {{profiles: any[], medicines: any[], logs: any[], links: any[]}} data
   * @param {string | null} persistKey  localStorage key, or null to keep data in memory only
   */
  constructor(data, persistKey) {
    this.data = data;
    this.persistKey = persistKey;
  }

  static fromLocalStorage() {
    let data = { profiles: [], medicines: [], logs: [], links: [] };
    try {
      const raw = localStorage.getItem(LOCAL_KEY);
      if (raw) data = { ...data, ...JSON.parse(raw) };
    } catch { /* corrupted or blocked storage: start empty */ }
    return new MemoryBackend(data, LOCAL_KEY);
  }

  save() {
    if (!this.persistKey) return;
    try { localStorage.setItem(this.persistKey, JSON.stringify(this.data)); } catch { /* storage full/blocked */ }
  }

  async listProfiles() { return this.data.profiles.map(normProfile); }

  async saveProfile(p) {
    const clean = pick(p, PROFILE_COLS);
    if (p.id) {
      const i = this.data.profiles.findIndex((x) => x.id === p.id);
      this.data.profiles[i] = { ...this.data.profiles[i], ...clean };
      this.save();
      return this.data.profiles[i];
    }
    const row = { id: crypto.randomUUID(), created_at: new Date().toISOString(), ...clean };
    this.data.profiles.push(row);
    this.save();
    return row;
  }

  async deleteProfile(id) {
    const medIds = new Set(this.data.medicines.filter((m) => m.profile_id === id).map((m) => m.id));
    this.data.profiles = this.data.profiles.filter((p) => p.id !== id);
    this.data.medicines = this.data.medicines.filter((m) => m.profile_id !== id);
    this.data.logs = this.data.logs.filter((l) => !medIds.has(l.medicine_id));
    this.data.links = this.data.links.filter((l) => l.profile_id !== id);
    this.save();
  }

  async listMedicines(profileId) {
    return this.data.medicines.filter((m) => m.profile_id === profileId).map(normMedicine);
  }

  async saveMedicine(m) {
    const clean = pick(m, MEDICINE_COLS);
    if (m.id) {
      const i = this.data.medicines.findIndex((x) => x.id === m.id);
      this.data.medicines[i] = { ...this.data.medicines[i], ...clean };
      this.save();
      return normMedicine(this.data.medicines[i]);
    }
    const row = { id: crypto.randomUUID(), created_at: new Date().toISOString(), ...clean };
    this.data.medicines.push(row);
    this.save();
    return normMedicine(row);
  }

  async deleteMedicine(id) {
    this.data.medicines = this.data.medicines.filter((m) => m.id !== id);
    this.data.logs = this.data.logs.filter((l) => l.medicine_id !== id);
    this.save();
  }

  async listLogs(medicineIds, sinceISO) {
    const ids = new Set(medicineIds);
    const since = new Date(sinceISO).getTime();
    return this.data.logs.filter((l) => ids.has(l.medicine_id) && new Date(l.scheduled_for).getTime() >= since);
  }

  async addLog({ medicine_id, scheduled_for, status }) {
    const t = new Date(scheduled_for).getTime();
    if (this.data.logs.some((l) => l.medicine_id === medicine_id && new Date(l.scheduled_for).getTime() === t)) {
      throw new DuplicateDoseError();
    }
    const row = { id: crypto.randomUUID(), medicine_id, scheduled_for, status, logged_at: new Date().toISOString() };
    this.data.logs.push(row);
    this.save();
    return row;
  }

  async deleteLog(id) {
    this.data.logs = this.data.logs.filter((l) => l.id !== id);
    this.save();
  }

  /** Bulk-load a starter set (the sample family) into this device's list. */
  async importAll({ profiles, medicines, logs }) {
    this.data.profiles.push(...profiles.map((p) => ({ id: p.id, created_at: new Date().toISOString(), ...pick(p, PROFILE_COLS) })));
    this.data.medicines.push(...medicines.map((m) => ({ id: m.id, created_at: new Date().toISOString(), ...pick(m, MEDICINE_COLS) })));
    this.data.logs.push(...logs.map((l) => pick(l, LOG_COLS)));
    this.save();
  }

  async listLinks(profileId) { return this.data.links.filter((l) => l.profile_id === profileId); }
  async createLink() { throw new Error('Caregiver links need the online (cloud) mode.'); }
  async revokeLink(id) {
    const link = this.data.links.find((l) => l.id === id);
    if (link) link.revoked = true;
    this.save();
  }
}

/* ------------------------------------------------------------------ */
/* Cloud backend (Supabase + RLS)                                      */
/* ------------------------------------------------------------------ */
class CloudBackend {
  /** Throw a friendly error; details go to the console only. */
  static check(error) {
    if (!error) return;
    console.error('[store] Supabase error:', error.code, error.message);
    if (error.code === '23505') throw new DuplicateDoseError();
    throw new Error('Could not save. Please check your internet connection and try again.');
  }

  /**
   * Bulk-load a starter set (the sample family) into the signed-in account.
   * Rows are inserted in order (people, then medicines, then history) so every
   * foreign key and RLS ownership check passes; history goes in chunks.
   */
  async importAll({ profiles, medicines, logs }) {
    const stamp = Date.now();
    // created_at keeps the family in a stable order (Dadi first).
    let r = await supabase.from('profiles').insert(profiles.map((p, i) => ({ id: p.id, created_at: new Date(stamp + i).toISOString(), ...pick(p, PROFILE_COLS) })));
    CloudBackend.check(r.error);
    try {
      r = await supabase.from('medicines').insert(medicines.map((m, i) => ({ id: m.id, created_at: new Date(stamp + i).toISOString(), ...pick(m, MEDICINE_COLS) })));
      CloudBackend.check(r.error);
      for (let i = 0; i < logs.length; i += 500) {
        r = await supabase.from('dose_logs').insert(logs.slice(i, i + 500).map((l) => pick(l, LOG_COLS)));
        CloudBackend.check(r.error);
      }
    } catch (err) {
      // Never leave a half-made family behind: removing the people cascades to the rest.
      await supabase.from('profiles').delete().in('id', profiles.map((p) => p.id));
      throw err;
    }
  }

  async listProfiles() {
    const { data, error } = await supabase.from('profiles').select('*').order('created_at');
    CloudBackend.check(error);
    return data.map(normProfile);
  }

  async saveProfile(p) {
    const clean = pick(p, PROFILE_COLS);
    const query = p.id
      ? supabase.from('profiles').update(clean).eq('id', p.id)
      : supabase.from('profiles').insert(clean);
    const { data, error } = await query.select().single();
    CloudBackend.check(error);
    return data;
  }

  async deleteProfile(id) {
    const { error } = await supabase.from('profiles').delete().eq('id', id);
    CloudBackend.check(error);
  }

  async listMedicines(profileId) {
    const { data, error } = await supabase.from('medicines').select('*').eq('profile_id', profileId).order('created_at');
    CloudBackend.check(error);
    return data.map(normMedicine);
  }

  async saveMedicine(m) {
    const clean = pick(m, MEDICINE_COLS);
    const query = m.id
      ? supabase.from('medicines').update(clean).eq('id', m.id)
      : supabase.from('medicines').insert(clean);
    const { data, error } = await query.select().single();
    CloudBackend.check(error);
    return normMedicine(data);
  }

  async deleteMedicine(id) {
    const { error } = await supabase.from('medicines').delete().eq('id', id);
    CloudBackend.check(error);
  }

  async listLogs(medicineIds, sinceISO) {
    if (!medicineIds.length) return [];
    const { data, error } = await supabase
      .from('dose_logs')
      .select('id, medicine_id, scheduled_for, status, logged_at')
      .in('medicine_id', medicineIds)
      .gte('scheduled_for', sinceISO);
    CloudBackend.check(error);
    return data;
  }

  async addLog({ medicine_id, scheduled_for, status }) {
    const { data, error } = await supabase
      .from('dose_logs')
      .insert({ medicine_id, scheduled_for, status })
      .select('id, medicine_id, scheduled_for, status, logged_at')
      .single();
    CloudBackend.check(error);
    return data;
  }

  async deleteLog(id) {
    const { error } = await supabase.from('dose_logs').delete().eq('id', id);
    CloudBackend.check(error);
  }

  async listLinks(profileId) {
    const { data, error } = await supabase
      .from('caregiver_links')
      .select('id, profile_id, label, expires_at, revoked, created_at')
      .eq('profile_id', profileId)
      .order('created_at', { ascending: false });
    CloudBackend.check(error);
    return data;
  }

  async createLink({ profile_id, token_hash, label }) {
    const { data, error } = await supabase
      .from('caregiver_links')
      .insert({ profile_id, token_hash, label })
      .select('id, profile_id, label, expires_at, revoked, created_at')
      .single();
    CloudBackend.check(error);
    return data;
  }

  async revokeLink(id) {
    const { error } = await supabase.from('caregiver_links').update({ revoked: true }).eq('id', id);
    CloudBackend.check(error);
  }
}

/* ------------------------------------------------------------------ */
/* Public store                                                        */
/* ------------------------------------------------------------------ */
export const store = {
  /** @type {'cloud' | 'local'} */
  mode: 'local',
  /** @type {MemoryBackend | CloudBackend} */
  backend: MemoryBackend.fromLocalStorage(),

  /**
   * Pick the backend: cloud if Supabase answers, otherwise this device.
   * @returns {Promise<{ fellBack: boolean }>}
   */
  async init() {
    if (!supabase) return { fellBack: true };
    let backend;
    let mode;
    try {
      await ensureAnonymousSession();
      backend = new CloudBackend();
      mode = 'cloud';
    } catch (err) {
      console.warn('[store] cloud unavailable, using this device:', err?.message);
      backend = MemoryBackend.fromLocalStorage();
      mode = 'local';
    }
    this.backend = backend;
    this.mode = mode;
    return { fellBack: mode === 'local' };
  },

  listProfiles: (...a) => store.backend.listProfiles(...a),
  saveProfile: (...a) => store.backend.saveProfile(...a),
  deleteProfile: (...a) => store.backend.deleteProfile(...a),
  listMedicines: (...a) => store.backend.listMedicines(...a),
  saveMedicine: (...a) => store.backend.saveMedicine(...a),
  deleteMedicine: (...a) => store.backend.deleteMedicine(...a),
  listLogs: (...a) => store.backend.listLogs(...a),
  addLog: (...a) => store.backend.addLog(...a),
  deleteLog: (...a) => store.backend.deleteLog(...a),
  importAll: (...a) => store.backend.importAll(...a),
  listLinks: (...a) => store.backend.listLinks(...a),
  createLink: (...a) => store.backend.createLink(...a),
  revokeLink: (...a) => store.backend.revokeLink(...a),
};
