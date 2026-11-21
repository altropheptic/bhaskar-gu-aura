# How AI was used

Dawai Dost uses AI in two places: **inside the product** (Gemini, ElevenLabs) and **to build the product** (Claude Code with MCP servers).

## 1. AI inside the product

| Feature | Model / service | Guardrails | Fallback |
|---|---|---|---|
| Prescription text to schedule | Google Gemini (`gemini-flash-latest`, set by `GEMINI_MODEL`) | JSON response schema with enums; server + browser sanitiser; DB constraints; a person confirms | Offline rule-based `1-0-1` parser |
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
   - Claude Code drove a real Chrome tab (Claude in Chrome) through the demo: the alarm firing, take/undo, add medicine via quick entry, every tab, one-tap mode, and light/dark themes.
   - It found and fixed a card-layout bug.
   - A Node script checked WCAG contrast; one failing green was darkened to pass AA.
   - `curl` checks confirmed the API returns 401 without a session, 400 on bad input and a generic 404 for bad caregiver tokens.
6. **Human in the loop.** The owner made every product decision (name, palette, fonts, features, no deploy without approval). Claude Code proposed, implemented and verified.

## Repo conventions that help AI agents

- `CLAUDE.md` holds the project rules (stack, security standards, rubric).
- Every module starts with a JSDoc block explaining *why* it exists.
- `js/medSchema.js` and `js/voiceText.js` are shared by the browser and the server, so one rule change applies everywhere.
