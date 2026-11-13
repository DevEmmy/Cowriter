# Co Writer

Your Ideas. Your Voice. A Better Story.

A creative writing studio: manuscript editor with autosave and version history, projects, goals and streaks.

## Run locally
1. `cp .env.example .env.local` and fill in `DATABASE_URL` and `AUTH_SECRET`.
2. Create the tables: run the SQL in `drizzle/0000_init.sql` in your Postgres (Neon: SQL Editor).
3. `npm install && npm run dev`

## Tests
- `scripts/test-manuscript.ts` (data layer), `scripts/test-http.sh` (API, run against a dev server), `scripts/test-ui.mjs` (editor in Chrome).

## Deploy (Netlify)
Import the repo in Netlify and set `DATABASE_URL` and `AUTH_SECRET` as environment variables.
