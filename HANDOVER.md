# Co Writer: handover guide for the new owner

Everything you need to take over and run the site. No secrets are stored in this repository. You will create your own.

## 1. What this is
A writing studio (Next.js 16, Postgres, free-tier hosting). Features: editor with autosave and version history, manuscript import, AI writing partner, Idea Lab, Story Bible, Story Guard, Chapter Analyser, Cover Studio, export to Word/PDF/text, analytics, accounts with password reset.

## 2. Take ownership (do these in order)
1. **GitHub:** the current owner opens the repo, then Settings, then Danger Zone, then **Transfer ownership**, and enters your GitHub username. Accept the email invitation.
2. **Supabase (database):** the safest route is your own fresh project, so no old passwords or keys carry over.
   - Create a project at supabase.com. Choose a region close to your users.
   - Open **SQL Editor**, paste all of `supabase-setup.sql` from the repo, and press Run. It should say "Success".
   - Existing users and manuscripts stay in the old database. If you need them, ask the previous owner to transfer the Supabase project instead (Organization settings, then Transfer project) and then run `supabase-update.sql` once. It is safe to run any number of times.
3. **Vercel (hosting):** if the project was created on another Vercel account, use Project Settings, then Transfer, or simply import the repo again from your own account. Add the environment variables below, then deploy.
4. **Rotate every key.** The previous owner pasted a database password and an AI key in chat while setting up, so treat all old ones as exposed: reset the database password, delete the old Google AI key and make a new one.

## 3. Environment variables (Vercel, then Settings, then Environment Variables)
| Name | Required | What to put |
|---|---|---|
| `DATABASE_URL` | yes | Supabase **Transaction pooler** string, port 6543. Use a password with letters and numbers only. |
| `AUTH_SECRET` | yes | 40+ random characters. Changing it signs everyone out. |
| `GEMINI_API_KEY` | for AI | Free key from aistudio.google.com/apikey. |
| `DATABASE_CA` | only if you see "certificate not trusted" | Supabase certificate text (Project Settings, Database, SSL). |
| `EMAIL_FROM` | for password reset | e.g. `Co Writer <hello@yourdomain.com>`, an address verified with the email provider. |
| `BREVO_API_KEY` or `RESEND_API_KEY` | for password reset | One provider only. Brevo's free plan allows 300 emails a day and lets you verify a single sender address. |
| `SITE_URL` | only with a custom domain | e.g. `https://yourdomain.com`. |
| `CONTACT_EMAIL` | recommended | Shown on the Privacy and Terms pages. |
| `AI_DAILY_LIMIT`, `AI_PER_MINUTE_LIMIT` | optional | Per-person AI allowance. Defaults 20 per day and 5 per minute. |
| `GPTZERO_API_KEY`, `ORIGINALITY_API_KEY` | optional, paid | Turns on AI-detector checks. Never tested against the live services. |

Never set `RATELIMIT_DISABLED`. It exists only for automated tests.
Changing a variable only takes effect after a redeploy.

## 4. First-day checklist
- [ ] Sign up on the live site, write a chapter, refresh, and confirm the text is still there.
- [ ] Use one AI feature (Idea Lab).
- [ ] Press "Forgot your password?" and confirm the email arrives (check spam). If email is not set up the page says so.
- [ ] Download a manuscript as Word and PDF.
- [ ] Open `/api/health`. It should show `{"ok":true}`.
- [ ] Fill in `CONTACT_EMAIL`, and have the Privacy and Terms pages reviewed before charging anyone.

## 5. Free-tier limits to watch (checked November 2026; they change)
- **Vercel Hobby** is free but for non-commercial use only. Upgrade to Pro before charging. The included compute (about 4 CPU-hours a month) is the limit you will probably hit first.
- **Gemini free tier** is a small shared daily quota for the whole site, and free-tier prompts may be used by Google to improve its products. A paid Gemini key removes both limits.
- **Supabase free** pauses a project after 7 days with no database activity, has no automatic backups, and allows 500 MB. A daily health check (`vercel.json`) keeps it awake. For real users, upgrade to Pro ($25 a month) for daily backups.
- Autosave runs every 5 seconds after typing stops. Leaving or hiding the tab saves immediately and a local backup protects the text.

## 6. Backups
Free Supabase has none. Until you upgrade: Supabase, then Database, then Backups (if shown), or run `pg_dump` against your database weekly and store the file somewhere safe.

## 7. Known gaps (not built)
No payments or plans, no admin dashboard, no error-monitoring service, no collaboration or sharing between users, no mobile app. Password reset needs an email provider to be configured.

## 8. Running it locally and the tests
`cp .env.example .env.local`, fill in `DATABASE_URL` and `AUTH_SECRET`, then `npm install && npm run dev`. The test scripts in `scripts/` are described in `README.md`. They need a throwaway local Postgres (`scripts/pg-start.sh`) and run against a production build (`npm run build && npm start`).
