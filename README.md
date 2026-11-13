# Co Writer

Your Ideas. Your Voice. A Better Story.

A creative writing studio: manuscript editor with autosave and version history, projects, goals and streaks, plus an AI writing partner (chat, improve selection, chapter expansion), My Writing Voice, and a local prose check.

## Run locally
1. `cp .env.example .env.local` and fill in `AUTH_SECRET`.
2. Run `npm install`.
3. Run `netlify dev --port 8889` to use the managed Netlify Database connection.

The schema is defined in `db/schema.ts`. Generate schema changes with `npm run db:generate -- --name describe_change`; Netlify applies migrations in `netlify/database/migrations` automatically during deployment. The files in `drizzle/` are legacy migrations for the previous external database.

## Tests
- Local Postgres for tests: `scripts/pg-start.sh`. AI tests run with `AI_PROVIDER=mock`.
- `scripts/test-ai-unit.ts`, `scripts/test-provider.ts`, `scripts/test-ai-http.sh`, `scripts/test-ai-ui.mjs` (AI features)
- `scripts/test-manuscript.ts` (data layer), `scripts/test-http.sh` (API, run against a dev server), `scripts/test-ui.mjs` (editor in Chrome).

## Deploy (Netlify)
Import the repo in Netlify and set `AUTH_SECRET` and `GEMINI_API_KEY` as environment variables. Netlify Database provisions and supplies the database connection automatically; `DATABASE_URL` is no longer used.
