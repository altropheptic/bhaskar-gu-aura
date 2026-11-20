# hackathon-gu-aura

**Live:** https://hackathon-gu-aura.vercel.app

Plain HTML, CSS and JavaScript (Vite), Supabase for data and auth, Vercel for hosting and server functions.

## Run locally

```bash
npm install
vercel env pull .env.local   # gets the Supabase keys (needs `vercel login`, folder already linked)
npm run dev                  # frontend only → http://localhost:5173
vercel dev                   # frontend + /api functions → http://localhost:3000
```

## Where things go

| Path | What |
| --- | --- |
| `*.html` (project root) | Pages. Every root `.html` file is a route: `about.html` → `/about` |
| `src/` | Browser JS and CSS. `src/supabase.js` exports the Supabase client |
| `api/` | Server functions on Vercel. `api/hello.js` → `/api/hello`. Secrets are only used here |
| `supabase/` | Supabase CLI config. Migrations go in `supabase/migrations/` |

## Environment variables

Stored in Vercel (Project → Settings → Environment Variables), pulled locally with `vercel env pull .env.local`.

| Name | Used in | Notes |
| --- | --- | --- |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` | browser | Public by design. Data is protected by Row Level Security |
| `SUPABASE_URL`, `SUPABASE_SECRET_KEY` | `api/` only | The secret key bypasses RLS. Never use it in `src/` |
| `SUPABASE_DB_PASSWORD` | local only | For `supabase db push` and direct Postgres access |

## Deploy

Push to `main` → production. Push another branch or open a PR → preview URL.
