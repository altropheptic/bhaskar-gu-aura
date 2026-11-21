/**
 * Cloud backend: Supabase Postgres, scoped to this browser's anonymous account
 * by Row Level Security (see supabase/schema.sql).
 *
 * Errors are logged with their code for debugging but shown to people as one
 * friendly sentence; a unique-constraint violation becomes DuplicateDoseError.
 */
import { db } from './supabaseClient.js';
import {
  PROFILE_COLS,
  MEDICINE_COLS,
  LOG_COLS,
  DuplicateDoseError,
  pick,
  normMedicine,
  normProfile,
} from './storeRows.js';

export class CloudBackend {
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
    let r = await db()
      .from('profiles')
      .insert(
        profiles.map((p, i) => ({ id: p.id, created_at: new Date(stamp + i).toISOString(), ...pick(p, PROFILE_COLS) })),
      );
    CloudBackend.check(r.error);
    try {
      r = await db()
        .from('medicines')
        .insert(
          medicines.map((m, i) => ({
            id: m.id,
            created_at: new Date(stamp + i).toISOString(),
            ...pick(m, MEDICINE_COLS),
          })),
        );
      CloudBackend.check(r.error);
      for (let i = 0; i < logs.length; i += 500) {
        r = await db()
          .from('dose_logs')
          .insert(logs.slice(i, i + 500).map((l) => pick(l, LOG_COLS)));
        CloudBackend.check(r.error);
      }
    } catch (err) {
      // Never leave a half-made family behind: removing the people cascades to the rest.
      await db()
        .from('profiles')
        .delete()
        .in(
          'id',
          profiles.map((p) => p.id),
        );
      throw err;
    }
  }

  async listProfiles() {
    const { data, error } = await db().from('profiles').select('*').order('created_at');
    CloudBackend.check(error);
    return data.map(normProfile);
  }

  async saveProfile(p) {
    const clean = pick(p, PROFILE_COLS);
    const query = p.id ? db().from('profiles').update(clean).eq('id', p.id) : db().from('profiles').insert(clean);
    const { data, error } = await query.select().single();
    CloudBackend.check(error);
    return data;
  }

  async deleteProfile(id) {
    const { error } = await db().from('profiles').delete().eq('id', id);
    CloudBackend.check(error);
  }

  async listMedicines(profileId) {
    const { data, error } = await db().from('medicines').select('*').eq('profile_id', profileId).order('created_at');
    CloudBackend.check(error);
    return data.map(normMedicine);
  }

  async saveMedicine(m) {
    const clean = pick(m, MEDICINE_COLS);
    const query = m.id ? db().from('medicines').update(clean).eq('id', m.id) : db().from('medicines').insert(clean);
    const { data, error } = await query.select().single();
    CloudBackend.check(error);
    return normMedicine(data);
  }

  async deleteMedicine(id) {
    const { error } = await db().from('medicines').delete().eq('id', id);
    CloudBackend.check(error);
  }

  async listLogs(medicineIds, sinceISO) {
    if (!medicineIds.length) return [];
    const { data, error } = await db()
      .from('dose_logs')
      .select('id, medicine_id, scheduled_for, status, logged_at')
      .in('medicine_id', medicineIds)
      .gte('scheduled_for', sinceISO);
    CloudBackend.check(error);
    return data;
  }

  async addLog({ medicine_id, scheduled_for, status }) {
    const { data, error } = await db()
      .from('dose_logs')
      .insert({ medicine_id, scheduled_for, status })
      .select('id, medicine_id, scheduled_for, status, logged_at')
      .single();
    CloudBackend.check(error);
    return data;
  }

  async deleteLog(id) {
    const { error } = await db().from('dose_logs').delete().eq('id', id);
    CloudBackend.check(error);
  }

  async listLinks(profileId) {
    const { data, error } = await db()
      .from('caregiver_links')
      .select('id, profile_id, label, expires_at, revoked, created_at')
      .eq('profile_id', profileId)
      .order('created_at', { ascending: false });
    CloudBackend.check(error);
    return data;
  }

  async createLink({ profile_id, token_hash, label }) {
    const { data, error } = await db()
      .from('caregiver_links')
      .insert({ profile_id, token_hash, label })
      .select('id, profile_id, label, expires_at, revoked, created_at')
      .single();
    CloudBackend.check(error);
    return data;
  }

  async revokeLink(id) {
    const { error } = await db().from('caregiver_links').update({ revoked: true }).eq('id', id);
    CloudBackend.check(error);
  }
}
