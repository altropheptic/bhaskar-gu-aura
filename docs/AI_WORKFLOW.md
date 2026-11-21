# How AI was used

Dawai Dost uses AI in two places: **inside the product** (Gemini, ElevenLabs) and **to build the product** (Claude Code with MCP servers).

## 1. AI inside the product

| Feature | Model / service | Guardrails | Fallback |
|---|---|---|---|
| Prescription text to schedule | Google Gemini 3.5 Flash Lite (`GEMINI_MODEL`; falls back to 3.1 Flash Lite). Lite models chosen for the free tier: 15 req/min and 500/day | JSON response schema with enums; server + browser sanitiser; DB constraints; a person confirms | Offline rule-based `1-0-1` parser |
| Prescription / strip photo to schedule | Gemini (multimodal) | Same as above; image type and size limits; downscaled in the browser | Type it in |
| "What is this medicine for?" | Gemini | Simple language, no dosing advice, ends with "follow your doctor"; markdown stripped | "Ask your pharmacist" |
| Spoken reminders (Hindi / English) | ElevenLabs `eleven_multilingual_v2` | Server-side sentence template; validated fields only | Browser `speechSynthesis` |

**Prompt design notes:**
- The parser prompt encodes Indian prescription conventions: `1-0-1` slots map to 08:00/14:00/21:00; OD, BD, TDS, QID and HS; AC/PC food timing; durations.
- Prompts instruct the model to never invent medicines and to ignore instructions inside user content.
- Temperature is 0.1 for deterministic parsing.

## 2. AI that built the product

The whole build was pair-programmed with **Claude Code** inside the hackathon's 5-hour window.

1. **Research before code.** Claude Code ran web searches on why elders miss doses (forgetfulness, polypharmacy, double dosing, caregiver effect, app usability, iOS web-push limits). Each finding became a feature (see the README table).
2. **Plan with the owner.**
   - Claude Code wrote a time-boxed plan.
   - It asked the owner to choose the AI provider, the account model and the extra features.
   - For fonts and palette, it researched "AI-slop" design tells and offered only non-generic options. The owner picked Lexend + Atkinson Hyperlegible Next and the Neem & Marigold palette.
3. **Database via the Supabase MCP.**
   - `apply_migration` created the schema with RLS.
   - `get_advisors` (security and performance) verified it: zero security findings.
   - `search_docs` confirmed the anonymous sign-in behaviour.
4. **Vercel via the Vercel CLI / MCP.** Linked project, environment variables and `vercel dev` for local `/api` testing. Deploys run only on the owner's go-ahead.
5. **Verification.**
   - Claude Code drove a real Chrome tab (Claude in Chrome) through the app: the alarm firing, take/undo, add medicine via quick entry, every tab and one-tap mode. It also wrote the Vitest suite and the ESLint/CI setup.
   - It found and fixed a card-layout bug.
   - A Node script checked WCAG contrast; one failing green was darkened to pass AA.
   - `curl` checks confirmed the API returns 401 without a session, 400 on bad input and a generic 404 for bad caregiver tokens.
6. **Design iteration.** After the first build, the owner asked for an app feel instead of a website, with less text.
   - Claude Code researched app-shell navigation (sidebar on desktop, bottom tab bar on mobile), 8pt spacing and card-consistency guidance.
   - It rebuilt the layout and measured horizontal overflow at 390px in the browser until every screen fitted.
7. **Competitor and design research.**
   - Claude Code analysed recent app-store complaints (reminders silently failing, paywalls), Android Doze limits, CHI/Digital Health studies on routine-based remembering, and NN/g guidance for older adults.
   - It also looked at top Dribbble medication-app shots: greeting, week strip, "Next up" hero, time rail.
   - This produced the routine-based reminders, place cue and reminder health check, and the redesigned Today screen.
8. **Full visual revamp from references.**
   - The owner shared five Dribbble-style concepts. Claude Code extracted their shared patterns: next-dose hero, pastel "later" cards, list rows with time chips, floating capsule nav, and chip-based forms.
   - It rebuilt the CSS and components in the Neem & Marigold palette (light only, at the owner's request) and drew glossy SVG pill renders.
   - It verified desktop and phone layouts in Chrome.
9. **Human in the loop.** The owner made every product decision (name, palette, fonts, features, no deploy without approval). Claude Code proposed, implemented and verified.

## Repo conventions that help AI agents

- `CLAUDE.md` holds the project rules (stack, security standards, rubric).
- Every module starts with a JSDoc block explaining *why* it exists.
- `js/medSchema.js` and `js/voiceText.js` are shared by the browser and the server, so one rule change applies everywhere.
