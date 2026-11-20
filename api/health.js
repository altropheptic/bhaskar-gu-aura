// Vercel Function: GET /api/health
// Everything in /api runs on the server, so it can safely use secret env vars
// (SUPABASE_SECRET_KEY, AI provider keys, ...). Never use secrets in /src.
export async function GET() {
  const url = process.env.SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;

  if (!url || !secretKey) {
    return Response.json({ ok: false, error: 'Supabase server env vars missing' }, { status: 500 });
  }

  try {
    const res = await fetch(`${url}/auth/v1/health`, { headers: { apikey: secretKey } });
    return Response.json(
      {
        ok: res.ok,
        supabase: res.ok ? 'connected' : `HTTP ${res.status}`,
        region: process.env.VERCEL_REGION ?? 'local',
      },
      { status: res.ok ? 200 : 502 },
    );
  } catch (err) {
    return Response.json({ ok: false, error: err.message }, { status: 502 });
  }
}
