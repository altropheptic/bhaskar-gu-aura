# bhaskar-gu-aura

**Live:** https://bhaskar-gu-aura.vercel.app

Hackathon project. Building starts on 21 November 2026, once the problem statement is announced.

## Tech stack

| Layer | Choice |
| --- | --- |
| Frontend | Vanilla HTML5, CSS3, ES6+ modules (Vite for dev server and bundling) |
| Backend | Vercel Functions (`/api`, Node.js, Mumbai region) |
| Database | Supabase Postgres with Row Level Security (Mumbai) |
| Hosting / CI | Vercel, auto-deploy from GitHub `main` |

## Run locally

```bash
npm install
vercel link                  # once, link to the Vercel project
vercel env pull .env.local   # Supabase keys
npm run dev                  # http://localhost:5173
vercel dev                   # with /api functions → http://localhost:3000
```
