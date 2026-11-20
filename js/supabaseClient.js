/**
 * Browser Supabase client.
 *
 * Why the publishable key is safe here: it only identifies the project. What a visitor
 * can read or write is decided by Row Level Security policies (see supabase/schema.sql),
 * not by hiding this key. Secret keys never appear in /js; they live only in /api.
 */
import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

/** True when the build has the public Supabase config. */
export const isSupabaseConfigured = Boolean(url && publishableKey);

/** @type {import('@supabase/supabase-js').SupabaseClient | null} */
export const supabase = isSupabaseConfigured
  ? createClient(url, publishableKey, { auth: { persistSession: false } })
  : null;
