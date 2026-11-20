# Notes for Claude

Hackathon project (built 2026-11-21). The owner is most comfortable with plain HTML, CSS and JavaScript: keep it that way (no React, Vue, TypeScript or CSS-framework build setup) unless they ask.

## Stack

- Vite 8, vanilla ES modules. Multi-page: every root `.html` file is a build entry (`vite.config.js`), and `vercel.json` turns on clean URLs.
- Supabase project ref `fkyozmweopldnopwdylm` (display name may still read `hackathon-gu-aura`), region ap-south-1 (Mumbai), org `altropheptic`. Linked locally (`supabase/`). The Supabase MCP connector is scoped to this account.
- Vercel project `altropheptic/bhaskar-gu-aura`, functions pinned to `bom1` (Mumbai) next to the database. Production: https://bhaskar-gu-aura.vercel.app (the old hackathon-gu-aura.vercel.app 308-redirects there). Pushing to `main` auto-deploys.
- GitHub: https://github.com/altropheptic/bhaskar-gu-aura (public).

## Rules

- Browser code (`*.html`, `src/`) may only use `VITE_*` env vars. Secrets (Supabase secret key, AI provider keys) are used only in `api/*.js` via `process.env`.
- `api/*.js` handlers use the Web signature: `export async function GET(request) { return Response.json({...}) }` (same for POST etc.).
- Supabase rejects the secret key from browser-like clients, so call it only from `api/`.
- Every new table gets RLS enabled plus policies; the browser talks to Supabase with the publishable key.
- Schema changes go through migrations: `supabase migration new <name>`, then `supabase db push` (or the Supabase MCP when it is connected).
- The repo is public: never commit `.env*` files or key values.

## Commands

- `npm run dev`: frontend only (no `/api`).
- `vercel dev`: frontend plus `/api` functions locally.
- `npm run build`: production build into `dist/`.
- `vercel env pull .env.local`: refresh local env vars after changing them in Vercel.
- `vercel env add NAME production|preview|development`: add an env var. In Windows PowerShell 5.1, pass `'""'` as the branch argument after `preview` to target all preview branches.
