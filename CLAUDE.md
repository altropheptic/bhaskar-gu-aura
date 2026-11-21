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

## Current state

**Building PS02 MediTrack as "Dawai Dost"** (medicine reminders for elders). The approved plan covers: Supabase anonymous no-login accounts + RLS, Today/Medicines/Progress/Family tabs, alarms with voice, one-tap big mode, Gemini prescription parsing (text + photo) and "explain", ElevenLabs voice, caregiver links, WhatsApp summary, .ics export, doctor report, emergency card, PWA.

**Hold rules (owner, 21 Nov):** no `git push` and no Vercel deploy until the owner says so. Local commits and Supabase migrations are allowed. Verify locally (`npm run dev` for UI; `vercel dev` for `/api`; note `vercel dev` applies the CSP, which blocks Vite's dev-only inline styles).

**Design (owner-approved):** fonts Lexend (headings) + Atkinson Hyperlegible Next (body), self-hosted via Fontsource; palette "Neem & Marigold" (tokens in `css/styles.css`); custom duotone SVG icons in the sprite in `index.html`. Avoid AI-slop defaults (Inter/Poppins/etc., purple gradients, icon libraries, sparkle icons, emoji icons).

**UI rules (owner, 21 Nov, round 2):** the app must look like an app, not a website. Landing (`#landing`) is short and static; once the demo or a list opens, `#landing` is hidden and the app shell (`#app`: sidebar ≥960px, bottom tab bar on phones, top bar with profile switch, demo chip and settings) takes over. Keep copy terse (labels, not paragraphs). 8px spacing scale (`--s1`…`--s8`), bordered cards only (no shadows, no nested cards), equal-width grids (`.grid-2`, 4-up `.stats`), card actions in `.card__foot`.

### Progress log (keep updated)

- Done:
  - Supabase migration `dawai_dost_initial_schema` applied (4 tables, RLS); security advisor clean.
  - All JS modules, `/api/ai` (Gemini), `/api/tts` (ElevenLabs), `/api/caregiver`, caregiver page, PWA, docs (README + `docs/*`).
  - Commits `a865530` (build) and `46cdd4e` (docs).
  - Verified in Chrome: demo, alarm, take/undo, quick fill, all tabs, one-tap mode, themes.
  - API checks: 401 / 400 / 404 responses as designed.
- Round 3 (USPs from competitor research + Dribbble patterns), committed locally:
  - Routine-based reminders (`js/routine.js`, profile routine columns, medicine `slots`; doses re-time when the routine changes).
  - "Kept at" place cue, doctor name, medicine photo (data-URL thumbnail).
  - Reminder health check (`js/reminderHealth.js`).
  - Today redesign: greeting, week strip, "Next up" hero, time rail; floating + on phones.
  - Fixes: tolerant log matching after re-timing (`findLog`), sticky sidebar.
  - Migrations: `routine_slots_and_place_cue`, `medicine_doctor_and_photo`.
- Gemini/ElevenLabs keys are set in Vercel **Production only**: test AI and voice on the live site (local `/api` has no keys).
- Round-2 UI rework committed locally (see `git log`).
  - App shell, terse copy, symmetric grids.
  - Verified in Chrome on desktop and at 390px width (no horizontal overflow on any tab).
- Waiting on owner:
  - Enable Supabase anonymous sign-ins (still off as of round 3; until then the app runs in on-device "offline mode").
  - After that: test AI, voice, cloud saving and caregiver links end-to-end.
- Live and verified (21 Nov): Supabase anonymous sign-in on (cloud saving works); Gemini 3.5 Flash Lite parse + explain OK (~13 s); ElevenLabs Hindi/English audio OK (~12 s); caregiver link create/open/revoke OK. Gemini uses free-tier Lite models (15 req/min, 500/day) with fallbacks.
- Not yet: PWA offline test, print preview.

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
