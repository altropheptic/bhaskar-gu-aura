/**
 * Shared helpers for /api functions (files starting with "_" are not routes on Vercel).
 *
 * Security building blocks used by every endpoint:
 *  - json(): consistent, uncached JSON responses
 *  - rateLimited(): per-IP sliding window (per warm instance; Fluid compute reuses instances)
 *  - readJson(): content-type + size checks before parsing
 *  - requireUser(): verifies the caller's Supabase session JWT, so only real app
 *    sessions can spend our AI / voice quota
 *  - adminClient(): server-only Supabase client using the SECRET key (bypasses RLS,
 *    so it is used only after the request has been validated)
 */
import { createClient } from '@supabase/supabase-js';

/** @param {unknown} body @param {number} [status] @param {Record<string,string>} [headers] */
export const json = (body, status = 200, headers = {}) =>
  Response.json(body, { status, headers: { 'Cache-Control': 'no-store', ...headers } });

/** @type {Map<string, number[]>} */
const hits = new Map();

/**
 * @param {Request} request
 * @param {string} bucket  separate limits per endpoint
 * @param {number} max     requests allowed per minute
 */
export function rateLimited(request, bucket, max) {
  const ip = (request.headers.get('x-forwarded-for') ?? 'unknown').split(',')[0].trim();
  const key = `${bucket}:${ip}`;
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < 60_000);
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) hits.clear(); // bounded memory
  return recent.length > max;
}

/**
 * Parse a JSON body with type and size checks. Returns null on any problem.
 * @param {Request} request
 * @param {number} maxBytes
 */
export async function readJson(request, maxBytes) {
  if (!(request.headers.get('content-type') ?? '').includes('application/json')) return null;
  if (Number(request.headers.get('content-length') ?? 0) > maxBytes) return null;
  try {
    const raw = await request.text();
    if (raw.length > maxBytes) return null;
    const body = JSON.parse(raw);
    return body && typeof body === 'object' && !Array.isArray(body) ? body : null;
  } catch {
    return null;
  }
}

let admin = null;
/** Server-only Supabase client (secret key). */
export function adminClient() {
  if (!admin) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SECRET_KEY;
    if (!url || !key) throw new Error('Supabase server env missing');
    admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  }
  return admin;
}

/**
 * Verify the Bearer token is a valid Supabase session for this project.
 * @param {Request} request
 * @returns {Promise<string | null>} user id or null
 */
export async function requireUser(request) {
  const auth = request.headers.get('authorization') ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!token || token.length > 4096) return null;
  try {
    const { data, error } = await adminClient().auth.getUser(token);
    return error || !data.user ? null : data.user.id;
  } catch {
    return null;
  }
}
