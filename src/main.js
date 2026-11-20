import { supabase, supabaseConfig } from './supabase.js';

function setStatus(id, ok, message) {
  const el = document.getElementById(id);
  el.textContent = message;
  el.className = ok ? 'ok' : 'fail';
}

// Real round trip to the Supabase project using the browser (publishable) key.
async function checkSupabase() {
  if (!supabase) {
    setStatus('check-supabase', false, 'Supabase (browser) — env vars missing');
    return;
  }
  try {
    const res = await fetch(`${supabaseConfig.url}/auth/v1/health`, {
      headers: { apikey: supabaseConfig.publishableKey },
    });
    setStatus('check-supabase', res.ok, `Supabase (browser) — ${res.ok ? 'connected' : `HTTP ${res.status}`}`);
  } catch (err) {
    setStatus('check-supabase', false, `Supabase (browser) — ${err.message}`);
  }
}

// Calls the server-side function in /api/health.js.
async function checkApi() {
  try {
    const res = await fetch('/api/health');
    const data = await res.json();
    setStatus(
      'check-api',
      res.ok && data.ok,
      `API function — ${data.ok ? `ok, Supabase ${data.supabase} (region ${data.region})` : data.error}`,
    );
  } catch {
    setStatus('check-api', false, 'API function — not reachable (use `vercel dev` locally to serve /api)');
  }
}

checkSupabase();
checkApi();
