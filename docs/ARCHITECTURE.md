# Architecture

> Skeleton: completed with the real feature flow at the end of the hackathon.

## Overview

| Layer | Technology | Responsibility |
| --- | --- | --- |
| Frontend | Vanilla HTML5, CSS3, ES modules (bundled by Vite) | UI, input validation for UX, safe rendering |
| Server | Vercel Functions in `/api` (Node.js, region `bom1` Mumbai) | AI calls, privileged DB work, validation, rate limiting |
| AI | Vercel AI Gateway → `anthropic/claude-opus-5.5` (reasoning: high) | AI features, authenticated with Vercel OIDC |
| Data | Supabase Postgres (ap-south-1 Mumbai) with Row Level Security | Storage and access rules |
| Hosting | Vercel, auto-deploy from GitHub `main` | HTTPS, security headers, previews |

## Data flow

```mermaid
flowchart LR
  U[Visitor / grader] -->|HTML, CSS, JS| B[Browser app<br/>js/app.js]
  B -->|"Try Instant Demo"| D[(demoData.js<br/>offline sample data)]
  B -->|publishable key, RLS-checked| S[(Supabase Postgres<br/>Mumbai)]
  B -->|POST /api/ai| F[Vercel Function<br/>api/ai.js, bom1]
  F -->|validate, rate-limit| F
  F -->|OIDC auth| G[Vercel AI Gateway]
  G --> M[Claude Opus 5.5]
  F -->|secret key, server only| S
  F -.->|on failure| B2[fallback answer]
```

## Module map

| File | Purpose |
| --- | --- |
| `js/app.js` | Entry point; wires events to services |
| `js/ui.js` | Safe DOM rendering, banners, loading and empty states |
| `js/demoData.js` | Offline demo dataset and AI fallback |
| `js/supabaseClient.js` | Browser Supabase client (publishable key) |
| `js/aiService.js` | Browser → `/api/ai` with timeout and fallback |
| `api/ai.js` | AI route: validation, rate limit, AI Gateway call |
| `api/health.js` | Health check: function + database reachability |
| `supabase/schema.sql` | Tables and RLS policies |

## Feature flows

_To be documented after the build._
