# CLAUDE.md: rules for this project

5-hour hackathon (21 Nov 2026, 150 participants). An automated AI grader reviews the GitHub repo and the live URL and picks the Top 10 on 6 criteria: **Innovation and Originality, Problem-Solving Approach, Website Functionality, Effective Utilisation of AI Tools, Presentation and Explanation, Security**. Every change should help at least one of them.

## Project facts

- Live: https://bhaskar-gu-aura.vercel.app (push to `main` = production deploy in ~15 s; old hackathon-gu-aura.vercel.app redirects here).
- Repo: https://github.com/altropheptic/bhaskar-gu-aura (public, so never commit secrets).
- Supabase: project `bhaskar-gu-aura`, ref `fkyozmweopldnopwdylm`, Mumbai. Use the **Supabase MCP** for schema work (`apply_migration`, `execute_sql`, `get_advisors`).
- Vercel: project `bhaskar-gu-aura` (team `altropheptic`), functions pinned to `bom1` (Mumbai). Use the **Vercel MCP** for deployments, logs and env vars; the CLI is linked too.
- Env vars live in Vercel; `vercel env pull .env.local` locally. Browser-safe: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`. Server-only (`/api`): `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, optional `AI_MODEL` / `AI_REASONING`.
- AI: AI SDK + Vercel AI Gateway from `/api/ai.js` (OIDC auth, no key stored). Default model **`anthropic/claude-opus-5.5` with `reasoning: 'high'`** (owner's choice; slow-ish and pricier than Haiku, so keep the rate limit and token caps). The gateway needs a credit card on the Vercel account before it serves requests; until then `/api/ai` returns 503 and the UI uses its fallback.

## Stack (non-negotiable)

Vanilla HTML5, semantic CSS3, ES6+ modules. Vite is only the dev server/bundler (every root `.html` file is a page). No React/Vue/TypeScript/Tailwind or other frameworks. The owner is most comfortable with plain HTML/CSS/JS; keep code readable for them.

## Rules

1. **Modular JS.** Small ES modules in `/js/`, each with JSDoc that explains *why* (the problem-solving logic), not just what:
   - `app.js`: entry point, wires UI events to services.
   - `ui.js`: safe rendering helpers, loading states, empty states, error banners.
   - `demoData.js`: realistic demo dataset.
   - `supabaseClient.js`: browser Supabase client (publishable key).
   - `aiService.js`: talks only to our `/api/ai`, never to an AI provider directly.
   Add new modules by responsibility; never grow one giant file.
2. **Zero login walls.** The main interface never requires sign-in. The first screen has a prominent **"Try Instant Demo"** button that fills every feature with data from `demoData.js` in one click, and it must still work if Supabase or the AI is down.
3. **Crawler-readable.** The problem, the solution, how it works and the key features are written in static semantic HTML in `index.html`, not injected by JS, so a grader that doesn't run JavaScript still understands the project. Keep the `<noscript>` note.
4. **Security.**
   - No secrets in browser code or the repo. Only `VITE_*` vars reach the browser. AI calls and privileged Supabase calls go through `/api/*` Vercel Functions.
   - Every table: `enable row level security` + explicit, minimal policies. Keep `supabase/schema.sql` in sync with what is applied, and run `get_advisors` (security) after each schema change.
   - Render untrusted text (user input, AI output, DB rows) with `textContent` / the `ui.js` helpers. Never `innerHTML` with untrusted data.
   - Validate input in the browser for UX and again in `/api` for safety (type, length, allowed values).
   - `/api` endpoints: JSON only, body-size cap, per-IP rate limit, timeouts, generic error messages (no stack traces or provider errors to the client).
   - CSP and security headers live in `vercel.json`. If a feature needs a new origin (fonts, images, camera, mic), update the CSP / Permissions-Policy deliberately.
5. **AI with a fallback.** Server-side via AI SDK + AI Gateway; stream when it helps UX. Every AI feature has a fallback (cached/demo answer) so the demo never dead-ends.
6. **UI/UX polish.** Mobile-first responsive layout, CSS variables, light/dark via `prefers-color-scheme`, visible focus states, ARIA labels, `prefers-reduced-motion`. Every async action shows a loading state; every list has an empty state; every failure shows a friendly banner. Never fail silently with only `console.error`.
7. **Workflow.** Small conventional commits (`feat:`, `fix:`, `docs:`, `chore:`). After each push to `main`, confirm the deployment is READY via the Vercel MCP and smoke-test the live URL (`/api/health` too). Feature freeze 60 minutes before the deadline; after that only fixes, docs and polish. Fill `README.md` and `docs/` with real content in the final 45 minutes.

## Commands

- `npm run dev`: frontend only (no `/api`).
- `vercel dev`: frontend + `/api` functions locally (uses `.env.local`).
- `npm run build`: production build to `dist/`.
- `vercel env pull .env.local`: refresh local env after changing Vercel env vars.
- `vercel env add NAME production|preview|development`: in Windows PowerShell 5.1 pass `'""'` as the branch argument after `preview` to target all preview branches.
