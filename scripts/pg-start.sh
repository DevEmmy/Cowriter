#!/bin/bash
# Starts the throwaway local Postgres used for tests (port 54329) only if it is not already running.
if psql -h localhost -p 54329 -U postgres -qc "select 1" >/dev/null 2>&1; then exit 0; fi
rm -f /tmp/pg/data/postmaster.pid
su postgres -c "/usr/lib/postgresql/16/bin/pg_ctl -D /tmp/pg/data -o '-p 54329 -k /tmp/pg' -l /tmp/pg/log start" >/dev/null 2>&1
for i in 1 2 3 4 5 6 7 8 9 10; do psql -h localhost -p 54329 -U postgres -qc "select 1" >/dev/null 2>&1 && exit 0; sleep 1; done
echo "postgres failed to start" >&2; exit 1
