# Security

## Threat model in one paragraph

Dawai Dost stores health-adjacent data: medicine names, schedules, allergies and an emergency phone number. The main risks:
- one visitor reading another's data
- leaked API keys (Gemini, ElevenLabs, Supabase secret)
- abuse of our paid AI/voice quota
- XSS through user or AI text
- guessable caregiver links

Each risk has at least two independent defences.

## Identity without a login wall

- Every browser silently calls `supabase.auth.signInAnonymously()`, which creates a real user with a real `auth.uid()`. Elders never see a login screen, and the grader can use every feature.
- Supabase applies an IP rate limit to anonymous sign-ups (30/hour by default). Adding a CAPTCHA (Turnstile) is the documented next step if abuse appears.

## Database (Supabase Postgres)

- **RLS is enabled on all four tables.** Each has separate `select / insert / update / delete` policies `to authenticated` with `user_id = (select auth.uid())`.
- **Ownership chain checks.** Inserting a medicine requires that its `profile_id` belongs to you. Inserting a dose log requires that its `medicine_id` belongs to you. You can't attach rows to someone else's profile by guessing a UUID.
- **The `anon` role has no table privileges** (`revoke all … from anon`).
- **CHECK constraints** on every field: lengths, allow-lists (form, colour, shape, meal, blood group), ranges (dose 0.5–20, stock 0–10,000), time arrays of 1–6 entries, and days within 0–6.
- **Double-dose guard:** `UNIQUE (medicine_id, scheduled_for)`.
- **Medicine photos** are stored as small data URLs. Postgres enforces the format (`^data:image/(jpeg|png|webp);base64,…$`) and a 90 KB cap. The browser re-checks the format before rendering into an `<img>`; it is never rendered as HTML.
- The schema lives in [`supabase/schema.sql`](../supabase/schema.sql). After the migration, the Supabase **security advisor reported zero issues**.

## Secrets

| Secret | Where it lives | Used by |
|---|---|---|
| `SUPABASE_SECRET_KEY` | Vercel env (server) | `/api/_lib.js` only |
| `GEMINI_API_KEY` | Vercel env (server) | `/api/ai.js` only |
| `ELEVENLABS_API_KEY` | Vercel env (server) | `/api/tts.js` only |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` | bundled (public by design) | browser |

`.env*` files are git-ignored. Gemini and ElevenLabs are called only from the server, so the CSP doesn't list their origins.

## API endpoints

| Endpoint | Auth | Validation | Rate limit |
|---|---|---|---|
| `POST /api/ai` | Supabase JWT (`auth.getUser`) | action allow-list; text ≤ 1000 chars; image base64 regex, JPEG/PNG/WebP only, ≤ ~4.5 MB; explain fields length-checked; `lang` ∈ {en, hi} | 12/min/IP |
| `POST /api/tts` | Supabase JWT | lang/form/meal allow-lists; names match a Unicode letter regex ≤ 60 chars; 1–3 medicines; qty 0.5–20 | 20/min/IP |
| `GET /api/caregiver` | share token | `^[A-Za-z0-9_-]{32}$`; SHA-256 lookup; expiry + revocation checked | 30/min/IP |

All endpoints accept JSON only (where relevant), cap the body size, return **generic error messages** (details go to server logs), and send `Cache-Control: no-store`.

**TTS can't be used as a free speech service.** The server builds the sentence from a fixed template (`js/voiceText.js`). Clients never send free text to speak.

**AI output is untrusted.** Gemini is forced into a JSON schema, then every field goes through `sanitizeAiMedicine` (server), again in the browser, and finally through Postgres constraints. AI never writes to the database: a person reviews and saves. Prompts tell the model to treat user content as data (prompt-injection guard).

## Caregiver links

- The token has 192 bits of entropy (`crypto.getRandomValues`, 24 bytes).
- Only the SHA-256 hash is stored, so a database dump yields no working links.
- Links have a 30-day default expiry and can be revoked in one tap. Revoked and expired links return the same generic 404 as unknown ones.
- The response contains only the first name, today's schedule fields and 48 hours of logs. Phone numbers and allergies are not included.
- The family page removes the token from the address bar after loading, sends `no-referrer`, is `noindex`, and is never cached by the service worker.

## Browser

- **No `innerHTML` anywhere.** All dynamic text goes through `el()` / `textContent` (`js/ui.js`).
- **Headers** (`vercel.json`):
  - CSP: `default-src 'self'`; scripts and styles self-only; `connect-src` limited to our Supabase project; `media-src 'self' blob:` for voice audio; `frame-ancestors 'none'`; `object-src 'none'`; `upgrade-insecure-requests`.
  - `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`.
  - `Permissions-Policy` disables camera, microphone, geolocation, payment and USB. Photo capture uses a file input, which needs no camera permission.
- Fonts are self-hosted (no third-party font CDN).

## Known limitations (honest list)

- Anonymous accounts are per browser. Clearing site data loses access to that list, by design, because there is no PII to recover it with.
- The in-memory rate limit is per warm function instance; it is not a global limit.
- Alarms run only while the page is open. The `.ics` export covers the closed-browser case.
