# Security

> Skeleton: the controls below are already in place; feature-specific items are added after the build.

## Secrets

- No secret is in the repo or the browser bundle. Browser code only sees `VITE_*` values (Supabase URL + publishable key).
- Server secrets (`SUPABASE_SECRET_KEY`) live in Vercel env vars, marked **sensitive** for production and preview, and are only read inside `/api`.
- AI uses Vercel OIDC through AI Gateway, so there is no AI API key at all.
- `.gitignore` excludes every `.env*` file except `.env.example`; the build output is checked for secret values before release.

## Database (Supabase)

- Row Level Security is enabled on every table, with explicit minimal policies; see `supabase/schema.sql`.
- The Supabase security advisor is run after every schema change.

## Web app

- **XSS:** all untrusted text (user input, AI output, DB rows) is rendered with `textContent` via `js/ui.js`; no `innerHTML` with untrusted data.
- **Security headers** (`vercel.json`): Content-Security-Policy (`script-src 'self'`, `connect-src` limited to our Supabase project, `frame-ancestors 'none'`, `object-src 'none'`), `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`, `X-Frame-Options: DENY`; HSTS from Vercel.

## API (`/api`)

- JSON-only requests with body-size caps and input validation (type, length).
- Per-IP rate limiting on the AI route, request timeouts, output-token caps.
- Generic error messages to clients; details only in server logs.

## Threat model

_To be completed after the build: what an attacker could try against our features and how each attempt is blocked._
