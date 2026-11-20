# AI workflow

> Skeleton: completed with the real features and session highlights at the end of the hackathon.

## 1. AI inside the app

- **Route:** the browser calls `POST /api/ai`; only that Vercel Function talks to the model.
- **Model:** `anthropic/claude-opus-5.5` with `reasoning: 'high'` through Vercel AI Gateway (AI SDK v7). Configurable with the `AI_MODEL` / `AI_REASONING` env vars.
- **Auth:** Vercel OIDC, so no AI API key exists anywhere in the code or repo.
- **Guardrails:** prompt length cap, JSON-only body with a size cap, per-IP rate limit, 60 s timeout, output-token cap, a system prompt that treats user text as data, and output rendered with `textContent` (no HTML injection).
- **Resilience:** if the AI is slow or unavailable, the UI shows a labelled fallback answer so the demo never dead-ends.

### AI features

_To be documented after the build: what each feature asks the model, why AI is the right tool for it, and example inputs and outputs._

## 2. How we built it with AI tools

| Tool | How we used it |
| --- | --- |
| **Claude Code** | Pair-programmer for the whole project: scaffolding, code, reviews, docs. Project rules live in `CLAUDE.md`. |
| **Vercel MCP** | Inspected the project, deployments and git link; verified every production deploy; managed AI Gateway model choice. |
| **Supabase MCP** | Inspected the project, applies schema migrations, runs the security advisor after each schema change. |
| **Vercel CLI / Supabase CLI / GitHub CLI** | Project creation, env vars (secrets passed without ever printing them), repo setup. |

### Notable moments

_To be filled in: prompts that worked, bugs AI found or fixed, decisions it helped make._
