<p><img src="public/brand/logo-full.webp" width="360" alt="Dawai Dost · दवाई दोस्त" /></p>

# Dawai Dost · दवाई दोस्त

**Medicine reminders that follow an elder's day, speak in Hindi or English, and keep the family in the loop.**
PromptWars × Code1 · PS02 *MediTrack: Smart Medicine Reminder* (Healthcare)

[![CI](https://github.com/altropheptic/bhaskar-gu-aura/actions/workflows/ci.yml/badge.svg)](https://github.com/altropheptic/bhaskar-gu-aura/actions/workflows/ci.yml)

**Live app:** https://bhaskar-gu-aura.vercel.app

<p>
  <img src="public/shots/today.webp" width="190" alt="Today screen with the next dose and a big Taken button" />
  <img src="public/shots/onetap.webp" width="190" alt="Big one-tap mode: one medicine and one huge I took it button" />
  <img src="public/shots/medicines.webp" width="190" alt="Medicines with strip photos, meal slots, place and stock" />
  <img src="public/shots/progress.webp" width="190" alt="Progress ring, streak and day-by-day grid" />
</p>

## Try it in 30 seconds

1. Open the live app and click **Get started**. There is no sign-up. Your browser gets a private account that starts with a sample family: 4 people, 18 medicines with real photos and a month of history.
2. Within about a minute, **an alarm rings for Dadi**. It chimes, says the reminder aloud and shows the pill. Tap **I took it**.
3. Tap **+**, type `Metformin 500mg 1-0-1 after food 30 days` and press **Quick fill**. The form fills itself.
4. Open the **bell** for alerts, **Progress** for the doctor report and **Family** for the WhatsApp update and caregiver link.

Every tap is saved to the database. **Log out** returns to the home page and keeps the list.

---

## 1. Problem statement alignment

PS02 asks for *a simple, accessible web app to organise, manage and track daily medication schedules* for elderly people who forget their medicines.

| PS02 asks for | How Dawai Dost does it |
|---|---|
| **Organise** every medicine | One list per elder: strip photo, strength, meal slot, where it's kept, prescribing doctor. Several elders per phone. |
| **Manage** schedules | Add in seconds from prescription shorthand (`1-0-1`, `BD`, `HS`) or a photo (Gemini). Doses attach to the elder's own meals, so changing dinner to 9:30 moves every evening dose. Pause, edit, refill tracking. |
| **Track** doses | Taken, skipped or missed, with Undo. Streak, 14-day adherence, a day-by-day grid and a printable doctor report. |
| **Remind** people who forget | Chime + spoken reminder in Hindi or English + notification + snooze. Big one-tap mode. Phone-calendar export so it rings even with the browser closed. An alerts bell keeps doses missed after a dismissed alarm. |
| **Accessible** for elders | Large type, 48–56px targets, extra-large text mode, plain words, a typeface built for low vision, voice. |
| **Families** who help | WhatsApp daily summary and a private read-only caregiver link that can be revoked. |

**Why these choices:** forgetting is the top reason older adults miss doses ([study](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC6981635/)). 49% of older Indians take five or more medicines ([meta-analysis](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC8173298/)). Routine and place cues beat clock alarms ([Stawarz et al.](https://discovery.ucl.ac.uk/id/eprint/1418104)).

**Safety by design:** a missed dose never says "take two now". The app says *"Do not take two doses together; ask your pharmacist."* The same dose can't be logged twice (database constraint), and two brands of one molecule (Dolo + Crocin) trigger a warning. AI only fills a form; a person always checks and saves.

## 2. Code quality

- **Small, single-purpose ES modules** in [`js/`](js) (vanilla JS, no framework). Each file opens with a JSDoc note on *why* it exists. Examples: `schedule.js` (dose maths), `routine.js` (meal-based timing), `store.js` (one data interface, two backends), `todayView.js` (one screen).
- **Pure logic is separated from the DOM**, which is what makes the unit tests possible.
- **One source of truth:** views read shared state; only `state.js` actions write, so screens never disagree.
- **Shared rules, no duplication:** the voice sentence template (`voiceText.js`) and validation (`medSchema.js`) are used by both the browser and the `/api` functions.
- **ESLint** (recommended rules + `eqeqeq`, `prefer-const`, `no-unused-vars`) passes with zero warnings. Run `npm run lint`.
- **CI** on every push: lint → tests → production build ([workflow](.github/workflows/ci.yml)).

```
api/        Vercel functions: ai.js (Gemini), tts.js (ElevenLabs), caregiver.js, _lib.js (guards)
js/         Browser modules: app, state, store, schedule, routine, views, reminders, voice…
css/        One stylesheet with design tokens
tests/      Vitest unit tests (logic + API guards)
supabase/   schema.sql: tables, CHECK constraints, RLS policies (mirrors the applied migrations)
docs/       ARCHITECTURE.md · SECURITY.md · AI_WORKFLOW.md
```

## 3. Security

- **Private without a login.** Each browser gets a Supabase anonymous account, and **Row Level Security** on all 4 tables limits every user to their own rows. Inserts must also prove the parent profile or medicine is theirs.
- **Secrets never reach the browser.** Only public `VITE_*` values are bundled. Gemini, ElevenLabs and the Supabase secret key live in `/api` only.
- **Hardened API.** `/api/ai` and `/api/tts` require a valid session, are rate-limited per IP, cap body size, validate every field against allow-lists and return generic errors. The voice endpoint can only speak a fixed template, never arbitrary text.
- **Caregiver links** use 24 random bytes. Only a SHA-256 hash is stored, and links expire and can be revoked.
- **Three layers of validation:** browser, `/api` and Postgres `CHECK` constraints.
- **XSS-safe:** all dynamic text uses `textContent` (no `innerHTML`). Strict CSP (self + our Supabase only), HSTS, `X-Frame-Options: DENY`, `nosniff`, COOP and a tight `Permissions-Policy`.
- **Dependencies:** `npm audit` reports 0 vulnerabilities. The Supabase security advisor shows only the expected anonymous-sign-in notice.

Details: [docs/SECURITY.md](docs/SECURITY.md)

## 4. Efficiency

- **No framework.** The whole app is about 83 KB gzipped (most of it the Supabase client), with ~10 KB of CSS. The landing page HTML is ~6 KB gzipped.
- **Images:** screenshots are WebP (13–33 KB each), the hero image loads with high priority, and the rest load lazily. Medicine photos are 360px JPEGs; user photos are resized in the browser to a ~25 KB thumbnail before saving.
- **Caching:** hashed build assets are cached for a year (`immutable`); images for a week.
- **Few network calls:** a new account is set up with a few batched inserts; logs are read for 30 days only; the AI tries fast "Flash Lite" models with short timeouts, then falls back.
- **Server close to users:** functions run in Mumbai (`bom1`), next to the Supabase project in Mumbai.
- **Offline-ready:** a service worker caches the app shell (PWA), and reminders keep working from local state.

## 5. Testing

**40 unit tests** with [Vitest](https://vitest.dev) in [`tests/`](tests). Run `npm test`.

| Area | What's covered |
|---|---|
| Scheduling | doses per day, due / missed windows, matching logs after re-timing, adherence, streaks, refill days, duplicate brands |
| Routine | meal offsets (before / after food), re-timing when the routine changes, custom times kept |
| Prescription reader | `1-0-1`, `BD`, `HS`, half tablets, syrups in ml, durations, never throws |
| Validation | form rules, AI-output sanitising, photo allow-list (blocks remote URLs and path tricks) |
| Voice | English and Hindi sentences, "half a tablet", unknown-language fallback |
| Sample family | every medicine passes the form's validation; history has no future or duplicate doses |
| API guards | bad JSON → 400, no session → 401, bad caregiver token → 404, rate limit kicks in |

The live site was also checked end to end: account setup, Gemini parsing, ElevenLabs voice in both languages, caregiver links, API guards and phone layouts.

## 6. Accessibility

- **Built for older eyes and hands:** 18px base text with an extra-large mode, 48–56px tap targets, Atkinson Hyperlegible Next (a typeface designed for low-vision readers), and a big one-tap mode.
- **Not colour alone:** every status has an icon and a word (✓ Taken, ✕ Missed), and text pairs meet WCAG AA contrast.
- **Keyboard and screen readers:** semantic HTML, a skip link, visible focus rings, ARIA labels on icon buttons, native `<dialog>` (focus trap, Esc to close), and live regions for results.
- **Voice:** reminders are spoken in Hindi or English for people who can't read small print.
- **Motion and layout:** honours `prefers-reduced-motion`, works from 320px phones to desktops, and the landing content is readable without JavaScript.

## AI tools used

- **Google Gemini** (`/api/ai`): prescription text or photo → schedule (JSON schema, then validated on the server and in the browser), and "What is this medicine for?" in Hindi or English. Every AI feature has a non-AI fallback.
- **ElevenLabs** (`/api/tts`): natural multilingual voice for reminders. Falls back to the browser's own voice.
- **Claude Code** planned, researched, built and verified the app, using the Supabase MCP (schema, RLS, advisors) and the Vercel MCP (deploys, logs). See [docs/AI_WORKFLOW.md](docs/AI_WORKFLOW.md).

## Run locally

```bash
npm install
vercel env pull .env.local   # needs access to the Vercel project; see .env.example
npm run dev                  # app on http://localhost:5173
vercel dev                   # app + /api on http://localhost:3000
npm run check                # lint + tests + build
```

**Stack:** HTML5, CSS3, ES modules, Vite · Supabase (Postgres, RLS, anonymous auth) · Vercel (static + Node functions in Mumbai) · Gemini · ElevenLabs.

**Docs:** [Architecture](docs/ARCHITECTURE.md) · [Security](docs/SECURITY.md) · [AI workflow](docs/AI_WORKFLOW.md) · Photo credits: [public/demo/CREDITS.md](public/demo/CREDITS.md)

*Dawai Dost is a reminder and tracking tool, not medical advice.*
