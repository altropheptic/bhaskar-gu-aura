// Browser Supabase client.
// The PUBLISHABLE key is safe to ship to the browser: your data is protected by
// Row Level Security (RLS) policies on each table, not by hiding this key.
// Secret keys never go in /src — use them only in /api functions.
import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const supabaseConfig = { url, publishableKey };

export const supabase = url && publishableKey ? createClient(url, publishableKey) : null;

if (!supabase) {
  console.warn('Supabase env vars missing. Run `vercel env pull .env.local`, then restart `npm run dev`.');
}
