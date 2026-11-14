# Co Writer

Your Ideas. Your Voice. A Better Story.

A creative writing studio with a real backend:

- **Write**: import an existing manuscript (.docx, .pdf, .txt, .md or pasted text, split into chapters with a preview), manuscript editor with autosave, version history, projects, goals and streaks.
- **AI partner**: chat, improve a selection, chapter expansion, My Writing Voice, prose check. Every AI result is a suggestion; nothing edits your manuscript on its own.
- **Create**: Idea Lab (ideas, characters, plot, chapter breakdowns), prompt builder, Cover Studio (PNG and SVG download).
- **Refine**: Story Bible, manuscript memory, Story Guard (continuity checks with verified quotes), Chapter Analyser, optional third-party AI-detector checks, Writing Analytics.
- **Keep**: export any manuscript as DOCX, PDF (6 x 9 in, full Unicode including Yoruba diacritics) or TXT.

## Run locally
1. `cp .env.example .env.local` and fill in `DATABASE_URL` and `AUTH_SECRET`.
2. Create the tables: paste `supabase-setup.sql` into your Postgres (Supabase: SQL Editor). If you already ran an earlier version, run `supabase-update.sql` instead (safe to run any time, any number of times). Regenerate both with `scripts/make-setup-sql.sh` after adding a migration.
3. `npm install && npm run dev`

## Honest by design
- AI providers are swappable (`AI_PROVIDER`: gemini, groq). With no key, AI features say so and everything else still works.
- Story Guard and the analyser only show an AI finding if the text it quotes really exists in your chapter.
- Detector integrations (GPTZero, Originality.ai) show a number only when the provider returned one. They are written from the vendors' public API docs and have not been run against the live services. Without a key they are simply off.
- Cover Studio draws covers itself from templates. AI only suggests a layout, palette and tagline; it does not generate images.

## Tests
- Local Postgres for tests: `scripts/pg-start.sh`. AI tests run with `AI_PROVIDER=mock`. Run UI tests against `npm run build && npm start`.
- Unit: `test-ai-unit.ts`, `test-provider.ts`, `test-json.ts`, `test-diagnose.ts`, `test-ca.ts`, `test-stage4-unit.ts`, `test-export-unit.ts`, `test-cover-unit.ts`
- API: `test-http.sh`, `test-ai-http.sh`, `test-stage3.sh`, `test-stage4.sh`, `test-import.mjs` (import API+UI), `test-stage5.sh` (needs `scripts/fake-detector.mjs` and the detector env vars shown in that script)
- Browser (Chrome): `test-ui.mjs`, `test-ai-ui.mjs`, `test-stage3-ui.mjs`, `test-stage4-ui.mjs` (includes phone layout), `test-stage5-ui.mjs`

## Deploy (Vercel or Netlify)
See `HANDOVER.md` for the full guide. On Vercel (recommended; `vercel.json` sets the region and a daily keep-alive), or Netlify, set `DATABASE_URL` (Supabase transaction pooler, port 6543), `AUTH_SECRET` (40+ random characters), `GEMINI_API_KEY`, and `DATABASE_CA` (Supabase's CA certificate text) if the database certificate is not trusted. Optional: `GPTZERO_API_KEY`, `ORIGINALITY_API_KEY`.

## Accounts and fair use
- Password reset and email confirmation need one free email provider: set `EMAIL_FROM` plus `RESEND_API_KEY` or `BREVO_API_KEY` (and `SITE_URL` if you use a custom domain). With none set, the site says reset is not available instead of pretending.
- Login, sign-up, reset and email requests are rate limited in the database, so limits hold across serverless instances. `RATELIMIT_DISABLED=1` exists for automated tests only.
- Each person gets a per-minute and per-day AI allowance (`AI_PER_MINUTE_LIMIT`, `AI_DAILY_LIMIT`) so one free AI key is shared fairly.
- Test scripts: `test-auth.mjs` (needs `scripts/fake-email.mjs`), `test-aibudget.mjs`, `test-settings-ui.mjs`. Defaults: 20 AI requests per person per day. Users can change their password and delete their account in Settings; changing or resetting a password signs out other devices.

## Interface principles
Mobile gets a bottom tab bar inside the thumb zone with a "More" sheet; every touch target is at least 44 px; text meets WCAG AA contrast; all controls are keyboard reachable with visible focus; charts have text or table alternatives; destructive actions ask first.
