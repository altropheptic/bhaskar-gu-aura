/**
 * GET /api/caregiver?t=<token>: read-only data for a family member's share link.
 *
 * Security design:
 *  - the token is 24 random bytes (base64url, 32 chars) created in the owner's browser
 *  - only SHA-256(token) is stored, so the database never holds a working link
 *  - links expire (30 days) and can be revoked; both are checked here
 *  - the response is the minimum needed to show today's doses: first name, the
 *    active medicines' schedule fields and ~2 days of dose logs. No phone numbers,
 *    allergies or ids of other people
 *  - the secret Supabase key is used only after the token checks out
 *  - one generic error for every failure, so links can't be probed
 */
import { createHash } from 'node:crypto';
import { json, rateLimited, adminClient } from './_lib.js';

const TOKEN_RE = /^[A-Za-z0-9_-]{32}$/;
const NOT_FOUND = { error: 'This link is not valid or has been turned off.' };

export async function GET(request) {
  if (rateLimited(request, 'caregiver', 30)) return json({ error: 'Too many requests.' }, 429);
  const token = new URL(request.url).searchParams.get('t') ?? '';
  if (!TOKEN_RE.test(token)) return json(NOT_FOUND, 404);

  try {
    const db = adminClient();
    const hash = createHash('sha256').update(token).digest('hex');
    const { data: link } = await db
      .from('caregiver_links')
      .select('profile_id, expires_at, revoked')
      .eq('token_hash', hash)
      .maybeSingle();
    if (!link || link.revoked || new Date(link.expires_at) <= new Date()) return json(NOT_FOUND, 404);

    const [{ data: profile }, { data: medicines }] = await Promise.all([
      db.from('profiles').select('name, language').eq('id', link.profile_id).single(),
      db.from('medicines')
        .select('id, name, dosage, form, color, shape, meal, times, days, dose_qty, start_date, end_date, active, stock, refill_at')
        .eq('profile_id', link.profile_id)
        .eq('active', true),
    ]);
    if (!profile) return json(NOT_FOUND, 404);

    const ids = (medicines ?? []).map((m) => m.id);
    const since = new Date(Date.now() - 48 * 3600_000).toISOString();
    const { data: logs } = ids.length
      ? await db.from('dose_logs').select('medicine_id, scheduled_for, status, logged_at').in('medicine_id', ids).gte('scheduled_for', since)
      : { data: [] };

    return json({ profile, medicines: medicines ?? [], logs: logs ?? [], generated_at: new Date().toISOString() });
  } catch (err) {
    console.error('[api/caregiver]', err?.message);
    return json({ error: 'Could not load right now. Please try again.' }, 503);
  }
}
