/**
 * Browser Supabase client + the invisible "no-login" account.
 *
 * Why the publishable key is safe here: it only identifies the project. What a
 * visitor can read or write is decided by Row Level Security (supabase/schema.sql).
 * Secret keys never appear in /js; they live only in /api.
 *
 * Why anonymous sign-in: the hackathon brief (and elderly users) need zero login
 * walls, but we still want real per-user privacy. Supabase anonymous users get a
 * real auth.uid(), so RLS isolates each browser's data with no password at all.
 * The session is persisted in localStorage, so the same browser keeps its list.
 *
 * Why lazy: the Supabase library is the largest dependency. It is fetched in
 * its own chunk while the page is already showing, instead of blocking it.
 */

const url = import.meta.env.VITE_SUPABASE_URL;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

/** True when the build has the public Supabase config. */
export const isSupabaseConfigured = Boolean(url && publishableKey);

/** @type {import('@supabase/supabase-js').SupabaseClient | null} */
let client = null;
/** @type {Promise<import('@supabase/supabase-js').SupabaseClient | null> | null} */
let loading = null;

/** Load the Supabase library once and create the client. Resolves to null when not configured. */
export function getSupabase() {
  if (!isSupabaseConfigured) return Promise.resolve(null);
  loading ??= import('@supabase/supabase-js').then(({ createClient }) => {
    client = createClient(url, publishableKey, { auth: { persistSession: true, autoRefreshToken: true } });
    return client;
  });
  return loading;
}

/**
 * The loaded client, for code that only runs after ensureAnonymousSession()
 * succeeded (the cloud backend).
 */
export function db() {
  if (!client) throw new Error('Supabase is not loaded yet');
  return client;
}

/**
 * Make sure this browser has a (silent) account. Resolves to the user id, or
 * throws if Supabase is unreachable or anonymous sign-ins are disabled.
 * @param {number} [timeoutMs]
 * @returns {Promise<string>}
 */
export async function ensureAnonymousSession(timeoutMs = 8000) {
  const work = (async () => {
    const supabase = await getSupabase();
    if (!supabase) throw new Error('Supabase is not configured');
    const { data } = await supabase.auth.getSession();
    if (data.session?.user) return data.session.user.id;
    const { data: signIn, error } = await supabase.auth.signInAnonymously();
    if (error || !signIn.user) throw error ?? new Error('Anonymous sign-in failed');
    return signIn.user.id;
  })();
  const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Supabase timed out')), timeoutMs));
  return Promise.race([work, timeout]);
}

/**
 * Current access token, used to prove to /api that the caller is a real app session
 * (so strangers can't spend our AI and voice quota). Null when offline or signed out.
 * @returns {Promise<string | null>}
 */
export async function getAccessToken() {
  try {
    const supabase = await getSupabase();
    if (!supabase) return null;
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  } catch {
    return null;
  }
}
