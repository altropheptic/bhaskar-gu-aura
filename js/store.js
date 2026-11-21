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
import { isSupabaseConfigured, ensureAnonymousSession } from './supabaseClient.js';
import { MemoryBackend } from './storeLocal.js';
import { CloudBackend } from './storeCloud.js';

export { DuplicateDoseError } from './storeRows.js';

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
    if (!isSupabaseConfigured) return { fellBack: true };
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
