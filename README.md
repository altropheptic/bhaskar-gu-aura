# bhaskar-gu-aura

**Live app:** https://bhaskar-gu-aura.vercel.app
**Try it in one click:** open the live app and press **Try Instant Demo**. No sign-up, no setup.

An AI-powered web app built in a 5-hour hackathon with vanilla HTML/CSS/JavaScript, Supabase and Vercel.

> Sections marked _TBD_ are written once the problem statement is announced and the features are built.

## Innovation and Originality

_TBD: what is new about our approach._

## Problem-Solving Approach

_TBD: the problem, who has it, and how our solution addresses it._

## Website Functionality

- One-click **Try Instant Demo**: every feature is testable without an account, even offline from the demo dataset.
- Responsive, accessible UI (semantic HTML, ARIA labels, keyboard focus states, light/dark mode, reduced-motion support).
- Clear loading, empty and error states throughout.
- _TBD: feature list._

## Effective Utilisation of AI Tools

- **In the app:** Claude Opus 5.5 (high reasoning) via Vercel AI Gateway, called only from a server function, with a fallback so the demo never breaks. Details in [docs/AI_WORKFLOW.md](docs/AI_WORKFLOW.md).
- **To build it:** Claude Code with the Supabase and Vercel MCP servers for schema work, deployments and verification.
- _TBD: the AI features themselves._

## Presentation and Explanation

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): architecture and data-flow diagram.
- [docs/AI_WORKFLOW.md](docs/AI_WORKFLOW.md): AI features and development workflow.
- [docs/SECURITY.md](docs/SECURITY.md): security controls.
- Every JS module has JSDoc explaining the reasoning behind it.

## Security

- No secrets in the repo or browser; server secrets live in Vercel and are used only in `/api`.
- Supabase Row Level Security on every table ([supabase/schema.sql](supabase/schema.sql)).
- XSS-safe rendering, strict Content-Security-Policy and security headers, input validation and rate limiting on the API.
- Full list: [docs/SECURITY.md](docs/SECURITY.md).

## Tech stack

| Layer | Choice |
| --- | --- |
| Frontend | Vanilla HTML5, CSS3, ES6+ modules (Vite for dev server and bundling) |
| Backend | Vercel Functions (`/api`, Node.js, Mumbai region) |
| AI | AI SDK + Vercel AI Gateway (Claude Opus 5.5) |
| Database | Supabase Postgres with RLS (Mumbai) |
| Hosting / CI | Vercel, auto-deploy from GitHub `main` |

## Run locally

```bash
npm install
vercel link                  # once, link to the Vercel project
vercel env pull .env.local   # Supabase keys and AI Gateway token
npm run dev                  # frontend only → http://localhost:5173
vercel dev                   # frontend + /api functions → http://localhost:3000
```

## Architecture

```
index.html, 404.html   pages (static, readable without JavaScript)
css/styles.css         design tokens and layout
js/                    app.js · ui.js · demoData.js · supabaseClient.js · aiService.js
api/                   ai.js (AI route) · health.js (status)
supabase/schema.sql    tables and RLS policies
docs/                  architecture, AI workflow, security
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the data-flow diagram.
