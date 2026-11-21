# CLAUDE.md: rules for this project

5-hour hackathon on 21 Nov 2026 (150 participants). An automated AI grader reviews the GitHub repo and the live URL and picks the Top 10.

## Evaluation criteria (every decision must serve these)

1. Innovation and Originality
2. Problem-Solving Approach
3. Website Functionality
4. Effective Utilisation of AI Tools
5. Presentation and Explanation
6. Security

When planning or reviewing work, say which criteria it serves; the README gets one heading per criterion.

## Current state (snapshot 21 Nov, ~12:20 IST; live = commit 1d5cff5)

**Built and live: PS02 MediTrack as "Dawai Dost"** (medicine reminders for elders) at https://bhaskar-gu-aura.vercel.app. All work is pushed; the Vercel deploy is READY.

**Hold rule (owner):** never `git push` or deploy without the owner saying so in that turn ("Yes, deploy"). Local commits and Supabase migrations are fine. Test UI locally with `npm run dev` (port 5173). `vercel dev` applies the CSP, which blocks Vite's inline dev styles. Gemini/ElevenLabs keys exist **only in Vercel Production**, so test AI and voice on the live site.

**Features:**
- No-login: Supabase anonymous auth + RLS (4 tables: profiles, medicines, dose_logs, caregiver_links). Falls back to localStorage, plus an in-memory demo.
- Today: week strip, "Up next" hero, Needs attention / Later today / Done.
- Medicines CRUD:
  - 1-0-1 quick fill, Gemini text/photo parse, Gemini "About".
  - Routine-based slots, place cue ("kept at"), doctor, photo.
- Alarms: chime + ElevenLabs voice (Hindi/English, browser fallback), snooze, notifications, one-tap big mode.
- Progress: ring, streak, 14-day grid, badges, doctor report.
- Family & safety: reminder health check, daily routine, caregiver link (hashed token) + WhatsApp, emergency card.
- Other: .ics calendar export, PWA, Log out (back to the landing; keeps the list; landing then says "Open my list").
- Demo: 4 people (Dadi, Nanaji, Papa, Maa), 18 medicines, 30 days of history, 14 real Wikimedia Commons photos in `public/demo/` (see CREDITS.md; `DEMO_PHOTO_RE` allows `/demo/*.jpg`).

**AI:** `/api/ai` uses free-tier Gemini Flash Lite (`gemini-3.5-flash-lite` → `gemini-3.1-flash-lite` → `gemini-flash-lite-latest`, short per-try timeouts) and requires a Supabase JWT. `/api/tts` = ElevenLabs `eleven_multilingual_v2`, server-built sentence template. `/api/caregiver` = SHA-256 token lookup.

**Design (owner-approved, light only, no dark mode):**
- Fonts: Lexend + Atkinson Hyperlegible Next (Fontsource, self-hosted).
- Palette "Neem & Marigold": ink primary buttons; lime `#c6ec62` for up-next/selected (background only, never text on white); marigold for due.
- Layout follows the owner's "Medico"-style reference shots:
  - "Up next" hero with a huge time, glossy pill and ink "Taken" button
  - pastel `.tint--*` cards
  - rows with time chips
  - floating white sidebar (desktop) / white capsule tab bar with a lime active circle + ink "+" (phones)
  - avatar "Hello, name" + bell badge
  - chip-based form controls
  - bottom-sheet dialogs on phones
- White cards with a soft shadow, 8px spacing scale, terse copy. Avoid AI-slop defaults (Inter/Poppins, purple gradients, icon libraries, emoji, sparkle icons).
- Pills are glossy SVG renders (`#pg-hl`/`#pg-shade` gradients); keep caregiver.html's sprite in sync with index.html.

**Supabase migrations applied:** `dawai_dost_initial_schema`, `routine_slots_and_place_cue`, `medicine_doctor_and_photo`. The security advisor is clean. Mirror any change in `supabase/schema.sql`.

**Verified live:** cloud saving; Gemini parse + explain (~13 s); ElevenLabs Hindi/English (~12 s); caregiver link create/open/revoke; API guards (401/400/404); CSP intact; 390px layouts with no overflow.

**Not yet done / ideas:** PWA offline test, print-preview check, final README polish before the deadline (feature freeze 60 min before). Test data "Test Elder" exists only in the owner's Chrome anonymous account (harmless).

## Project facts

- Live: https://bhaskar-gu-aura.vercel.app (push to `main` = production deploy in ~15 s; old hackathon-gu-aura.vercel.app redirects here).
- Repo: https://github.com/altropheptic/bhaskar-gu-aura (public, so never commit secrets).
- Supabase: project `bhaskar-gu-aura`, ref `fkyozmweopldnopwdylm`, Mumbai, linked locally (`supabase/`). Use the **Supabase MCP** for schema work (`apply_migration`, `execute_sql`, `get_advisors`).
- Vercel: project `bhaskar-gu-aura` (team `altropheptic`), functions pinned to `bom1` (Mumbai); `vercel.json` sets clean URLs and security headers (CSP allows only self + our Supabase project). Use the **Vercel MCP** for deployments, logs and env vars; the CLI is linked too.
- Env vars live in Vercel; `vercel env pull .env.local` locally. Browser-safe: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`. Server-only (`/api`): `SUPABASE_URL`, `SUPABASE_SECRET_KEY`.
- **AI APIs (owner-approved):** Google Gemini in `/api/ai.js` (`GEMINI_API_KEY`, model `GEMINI_MODEL`, default `gemini-3.5-flash-lite`, fallback `gemini-3.1-flash-lite`) and ElevenLabs in `/api/tts.js` (`ELEVENLABS_API_KEY`, optional `ELEVENLABS_VOICE_ID`, `ELEVENLABS_MODEL`). Browser talks only to our `/api`, which requires a Supabase session JWT; every AI feature has a non-AI fallback.
- A full rubric-oriented foundation (modular JS, CSS, docs, 404, schema template) was drafted and then removed on 20 Nov; it can be restored from commit `5d2f18a` if the owner wants it.

## Stack (non-negotiable)

Vanilla HTML5, semantic CSS3, ES6+ modules. Vite is only the dev server/bundler (every root `.html` file is a page). No React/Vue/TypeScript/Tailwind or other frameworks. The owner is most comfortable with plain HTML/CSS/JS; keep code readable for them.

## Standards for the build

1. **Modular JS.** Small ES modules in `/js/` by responsibility (e.g. `app.js`, `ui.js`, `demoData.js`, `supabaseClient.js`), each with JSDoc explaining *why*. Styles in `/css/styles.css`. Never one giant file.
2. **Zero login walls.** The main interface never requires sign-in. A prominent **"Try Instant Demo"** button on the first screen fills every feature with realistic demo data in one click, and still works if Supabase is down.
3. **Crawler-readable.** The problem, solution, how it works and key features are static semantic HTML, not injected by JS, with a `<noscript>` note.
4. **Security.** No secrets in browser code or the repo (only `VITE_*` reaches the browser). Privileged calls go through `/api/*`. RLS on every table with minimal explicit policies, mirrored in `supabase/schema.sql`; run `get_advisors` (security) after each schema change. Render untrusted text with `textContent`, never `innerHTML`. Validate input in the browser and again in `/api` (type, length, allowed values); `/api` returns generic errors. Update the CSP in `vercel.json` deliberately when a new origin is needed.
5. **UI/UX polish.** Mobile-first, CSS variables, light/dark, visible focus states, ARIA labels, `prefers-reduced-motion`. Loading states, empty states and friendly error banners everywhere; never fail silently.
6. **Docs for the grader.** `README.md` with the live link and demo instructions at the top, then one heading per criterion; `docs/ARCHITECTURE.md` (Mermaid data flow), `docs/AI_WORKFLOW.md` (how Claude Code + Supabase/Vercel MCPs were used), `docs/SECURITY.md`. Write them in the final 45 minutes.
7. **Workflow.** Small conventional commits. After each push to `main`, confirm the deployment is READY via the Vercel MCP and smoke-test the live URL. Feature freeze 60 minutes before the deadline.

## Commands

- `npm run dev`: frontend only. `vercel dev`: frontend + `/api` locally.
- `npm run build`: production build to `dist/`.
- `vercel env pull .env.local`: refresh local env vars.
- `vercel env add NAME production|preview|development`: in Windows PowerShell 5.1 pass `'""'` as the branch argument after `preview` to target all preview branches.
