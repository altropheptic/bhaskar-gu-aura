# CLAUDE.md: rules for this project

5-hour hackathon on 21 Nov 2026 (150 participants). An automated AI grader reviews the GitHub repo and the live URL and picks the Top 10 on 6 criteria: **Innovation and Originality, Problem-Solving Approach, Website Functionality, Effective Utilisation of AI Tools, Presentation and Explanation, Security**.

## Current state

**Nothing is built yet, on purpose.** Only infrastructure exists (repo, Vercel, Supabase, env vars, tooling) and the site shows a placeholder. Do not write app code until the owner shares the problem statement; then propose the idea, Supabase schema with RLS and a time-boxed build plan, and get a go-ahead before coding.

## Project facts

- Live: https://bhaskar-gu-aura.vercel.app (push to `main` = production deploy in ~15 s; old hackathon-gu-aura.vercel.app redirects here).
- Repo: https://github.com/altropheptic/bhaskar-gu-aura (public, so never commit secrets).
- Supabase: project `bhaskar-gu-aura`, ref `fkyozmweopldnopwdylm`, Mumbai, linked locally (`supabase/`). Use the **Supabase MCP** for schema work (`apply_migration`, `execute_sql`, `get_advisors`).
- Vercel: project `bhaskar-gu-aura` (team `altropheptic`), functions pinned to `bom1` (Mumbai); `vercel.json` sets clean URLs and security headers (CSP allows only self + our Supabase project). Use the **Vercel MCP** for deployments, logs and env vars; the CLI is linked too.
- Env vars live in Vercel; `vercel env pull .env.local` locally. Browser-safe: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`. Server-only (`/api`): `SUPABASE_URL`, `SUPABASE_SECRET_KEY`.
- **No AI API in the app** unless the owner asks. If they do: `/api/ai.js` with AI SDK + Vercel AI Gateway (OIDC auth; preferred model `anthropic/claude-opus-5.5`, `reasoning: 'high'`), browser talks only to our `/api`, with a fallback. The gateway needs a credit card on the Vercel account first.
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
