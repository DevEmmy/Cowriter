# Co Writer

Your Ideas. Your Voice. A Better Story.

A creative writing studio: manuscript editor with autosave and version history, projects, goals and streaks, plus an AI writing partner (chat, improve selection, chapter expansion), My Writing Voice, and a local prose check.

## Run locally
1. `cp .env.example .env.local` and fill in `DATABASE_URL` and `AUTH_SECRET`.
2. Create the tables: run `drizzle/0000_init.sql`, then `drizzle/0001_stage2.sql`, then `drizzle/0002_stage3.sql`, in order, in your Postgres (Supabase or Neon: SQL Editor).
3. `npm install && npm run dev`

## Tests
- Local Postgres for tests: `scripts/pg-start.sh`. AI tests run with `AI_PROVIDER=mock`.
- `scripts/test-ai-unit.ts`, `scripts/test-provider.ts`, `scripts/test-ai-http.sh`, `scripts/test-ai-ui.mjs` (AI features)
- `scripts/test-manuscript.ts` (data layer), `scripts/test-http.sh` (API, run against a dev server), `scripts/test-ui.mjs` (editor in Chrome).

## Deploy (Netlify)
Import the repo in Netlify and set `DATABASE_URL`, `AUTH_SECRET` and `GEMINI_API_KEY` as environment variables.
