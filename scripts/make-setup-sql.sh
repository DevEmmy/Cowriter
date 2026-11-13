#!/bin/bash
# Rebuilds supabase-setup.sql (one paste for a fresh database) from the drizzle migrations plus the RLS lock.
cd "$(dirname "$0")/.."
{ for f in drizzle/0*.sql; do echo "-- $f"; sed 's/--> statement-breakpoint//' "$f"; echo; done
cat <<'SQL'
-- Lock the tables against Supabase's public REST API (the app connects directly, so it is unaffected)
do $$ declare t text; begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;
SQL
} > supabase-setup.sql
