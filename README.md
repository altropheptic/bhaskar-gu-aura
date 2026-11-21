# Dawai Dost · दवाई दोस्त

**Simple, spoken medicine reminders for elderly people and the families who care for them.**
PromptWars × Code1 · PS02 *MediTrack: Smart Medicine Reminder* (Healthcare)

**Live app:** https://bhaskar-gu-aura.vercel.app

## Try it in 10 seconds

1. Open the live app. There is no sign-up, login or password.
2. Click **Get started**. There is no sign-up: a private account is created silently and starts with a sample family (Dadi, Nanaji, Papa, Maa), 18 medicines (most with real photos), routines, doctors and a month of history. It is a real account: every Taken, edit and new medicine is saved to the database.
3. Wait about a minute. **An alarm rings for Dadi**: it chimes, speaks the reminder and shows the pill's colour and shape. Tap **I took it**.
4. Explore the tabs:
   - **Medicines**: add one by typing `Metformin 500mg 1-0-1 after food 30 days`, or photograph a prescription.
   - **Progress**: streaks and the doctor report.
   - **Family & safety**: WhatsApp update, caregiver link, emergency card, phone-calendar alarms.
5. Try **One-tap big mode** on the Today screen. It shows only the next dose and one huge button.

To start your own list, click **Start my own list**. Your data is private to your browser. **Log out** (sidebar, or Settings on phones) returns to the home page and keeps your list.

Sample medicine photos are real, freely licensed photos from Wikimedia Commons; see [public/demo/CREDITS.md](public/demo/CREDITS.md).

---

## Innovation and Originality

- **Built for Indian prescriptions.** Type the doctor's shorthand (`1-0-1`, `OD`, `BD`, `HS`, `after food x 5 days`) and the schedule fills itself. A rule-based parser runs offline; Google **Gemini** handles messy text and **prescription photos**.
- **Reminders in the elder's language.** At dose time the app speaks the reminder in Hindi or English with a natural **ElevenLabs** voice. The browser's own voice takes over if the service is unreachable.
- **Routine-based reminders, not just clock alarms.** Research on how people actually remember medicines found that daily routines and place cues beat timers, and that two cues beat one ([Stawarz et al. 2014](https://discovery.ucl.ac.uk/id/eprint/1418104), [2016](https://discovery.ucl.ac.uk/1522125/7/Stawarz_2055207616678707.pdf)).
  - Each elder sets their own breakfast/lunch/dinner/bed times, and doses attach to "after breakfast".
  - When the routine shifts, every dose moves with it.
  - Each medicine can record where it is kept ("steel dabba, dining table"), shown and spoken at reminder time.
- **Reminder health check.** The #1 complaint about reminder apps is that alerts silently stop. One card shows whether sound, voice, notifications, calendar alarms and the home-screen app are working, each with a one-tap fix.
- **Pill recognition by sight.** Every medicine is drawn in its real colour and shape, or shown with a photo of its strip, so "the small pink oval one" is unmistakable.
- **One-tap big mode.** A full-screen view with one pill, one sentence and one button: "I took it · ले ली".
- **Double-dose guard in the database.** A `UNIQUE(medicine_id, scheduled_for)` constraint means the same dose can never be logged twice, even from two phones.
- **Duplicate-molecule warning.** It warns when two brands contain the same generic drug, for example Dolo 650 and Crocin are both paracetamol.
- **A family loop that fits Indian households.** WhatsApp daily summaries and a private, revocable caregiver link.

## Problem-Solving Approach

We researched why elders miss doses before writing code, then mapped each cause to a feature:

| Research finding | Dawai Dost response |
|---|---|
| Forgetting is the top reason older adults miss doses ([study](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC6981635/)) | Alarm with chime, spoken reminder, notification, snooze; `.ics` export so the phone calendar rings even when the browser is closed |
| 49% of older adults in India take 5+ medicines ([meta-analysis](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC8173298/)) | Timeline grouped by time slot, pill icons, food timing on every dose |
| Double dosing ("did I already take it?") | "Taken at 8:04" with Undo, plus a DB-level unique constraint |
| Same molecule under two brand names | Duplicate-generic warning |
| Running out of medicine | Stock counts down with each dose and warns days ahead |
| About half of older adults on multidrug regimens are non-adherent; family help is a key support ([study](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC8969957/)) | Caregiver link, WhatsApp summary, several elders per phone |
| Older adults abandon complex apps (menus, scrolling, jargon) | Large type, 48–56px targets, senior XL mode, linear forms, plain words |
| iPhone web push is unreliable | We don't depend on it: in-app alarms plus native calendar alarms, and we document the limit honestly |

**Safety:** a missed dose never prompts "take two now". The app always says *"Do not take two doses together; ask your pharmacist."* AI only fills forms for a person to check; it never saves on its own.

Sources:
- [Portugal polymedicated elderly study](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC6981635/)
- [Drugs & Aging review](https://link.springer.com/article/10.1007/s40266-025-01249-7)
- [China multicentre study](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC9900971/)
- [Mysuru caregiver cohort](https://zenodo.org/records/17548784)
- [JMIR mHealth usability of reminder apps](https://mhealth.jmir.org/2014/1/e11)
- [Label redesign and dosing errors](https://www.sciencedaily.com/releases/2016/12/161209184314.htm)
- [WebKit push subscription bug](https://bugs.webkit.org/show_bug.cgi?id=273063)

## Website Functionality

- **Today:** live timeline (due, taken, missed, upcoming), progress ring, next dose, refill and duplicate warnings, Take / Skip / Undo.
- **Medicines:** add, edit, pause and delete.
  - Quick entry (offline parser or Gemini), prescription scan (Gemini also reads the doctor's name), "What is this for?" (Gemini, in Hindi or English).
  - Routine chips instead of time pickers; medicine photo, "kept at" place and prescribing doctor.
- **Progress:** 7- and 14-day adherence, streak, badges, 14-day grid per medicine, printable doctor report.
- **Family & safety:** WhatsApp summary, caregiver link (create, copy, revoke), emergency card, `.ics` calendar alarms, voice test.
- **Profiles:** several elders on one phone, each with their own voice language.
- **Works offline and installs** (PWA). If Supabase is unreachable, the app falls back to on-device storage and shows a banner. If the network is down on first open, the sample family is saved on the device instead.
- Loading, empty and error states everywhere. Nothing fails silently.

## Effective Utilisation of AI Tools

**AI inside the product (Google Gemini via `/api/ai`):**
- *Prescription text to schedule* and *prescription photo to schedule*, constrained by a JSON response schema and validated three times (Gemini schema, server sanitiser, browser sanitiser) before a person reviews and saves.
- *"What is this medicine for?"* in simple Hindi or English, with a built-in not-medical-advice line.
- Every AI feature has a non-AI fallback: the rule parser, manual entry, or "ask your pharmacist".

**Voice AI (ElevenLabs via `/api/tts`):** multilingual natural speech for reminders, built from a fixed server-side template.

**AI in how we built it:** Claude Code planned, researched, built and verified the app, using the Supabase MCP (schema, RLS, security advisors) and the Vercel MCP and CLI (env, deploys). See [docs/AI_WORKFLOW.md](docs/AI_WORKFLOW.md).

## Presentation and Explanation

- The first screen explains the product and opens the app in one click, already filled with a sample family. The problem, solution, features and safety sections are static HTML, readable without JavaScript.
- Design system, built from top medication-app design references:
  - The next dose is the hero (huge time, glossy pill, one big "Taken" button), "Later today" sits in pastel cards tinted by each medicine's colour, and phones get a floating capsule tab bar.
  - Fonts: **Lexend** headings and **Atkinson Hyperlegible Next** body. The body font was built for low-vision readers.
  - Colours: the light-only **Neem & Marigold** palette (ink actions, neem-lime selection, marigold for "due now"), with text pairs checked against WCAG AA.
  - Art: glossy SVG pill renders in each medicine's real colour and shape, plus a custom duotone icon set.
  - A senior XL text mode.
- Docs: [Architecture](docs/ARCHITECTURE.md) · [AI workflow](docs/AI_WORKFLOW.md) · [Security](docs/SECURITY.md)

## Security

- **No login wall, still private.** Each browser silently gets a Supabase *anonymous* account. **Row Level Security** on every table limits each user to their own rows. Inserts must prove the parent profile or medicine is theirs too.
- **Secrets stay server-side.** Only `VITE_*` public values reach the browser. Gemini, ElevenLabs and the Supabase secret key are used only in `/api`.
- **AI and voice endpoints require a valid Supabase session**, are rate-limited and size-capped, validate every field, and return generic errors.
- **The TTS endpoint can't speak arbitrary text.** The server builds the sentence from a template and validated fields.
- **Caregiver links** use 24 random bytes. Only a SHA-256 hash is stored, links expire and can be revoked, and the endpoint returns the minimum data.
- **XSS-safe rendering.** All dynamic text uses `textContent`; there is no `innerHTML`. Strict **CSP** (self + our Supabase only), `X-Frame-Options: DENY`, `nosniff`, and a tight `Permissions-Policy`.
- Validation runs three times: browser, `/api`, and Postgres `CHECK` constraints.

Details: [docs/SECURITY.md](docs/SECURITY.md)

---

## Tech stack

Vanilla HTML5, CSS3 and ES modules, bundled by Vite. Supabase (Postgres, RLS, anonymous auth). Vercel (static hosting + Node functions in `bom1` Mumbai). Google Gemini API. ElevenLabs API.

## Run locally

```bash
npm install
vercel env pull .env.local   # needs access to the Vercel project
vercel dev                   # frontend + /api on http://localhost:3000
npm run dev                  # frontend only on http://localhost:5173
npm run build
```

Environment variables are listed in [.env.example](.env.example).

*Dawai Dost is a reminder and tracking tool, not medical advice.*
