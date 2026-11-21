/**
 * Local backend: keeps the list in this browser's localStorage.
 *
 * Why: if Supabase can't be reached, an elder must still see and log today's
 * doses. Same interface as the cloud backend, including the double-dose guard.
 */
import { PROFILE_COLS, MEDICINE_COLS, LOG_COLS, DuplicateDoseError, pick, normMedicine, normProfile } from './storeRows.js';

export const LOCAL_KEY = 'dawai-dost-local-v1';

export class MemoryBackend {
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
