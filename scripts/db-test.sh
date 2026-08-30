#!/usr/bin/env bash
#
# Applies every migration to a throwaway Postgres and runs the security tests.
#
# Needs a local Postgres 16 (or PGBIN pointed at another version). This is the
# only way to prove the Row Level Security policies actually hold, since they
# are the layer the application deliberately cannot bypass.
set -euo pipefail

PGBIN="${PGBIN:-/usr/lib/postgresql/16/bin}"
WORKDIR="${WORKDIR:-/var/tmp/modular-dbtest}"
PORT="${PGPORT:-54329}"
SOCKET="${PGSOCKET:-/var/tmp}"
DB=modular_test

# Postgres refuses to run as root, so when this script is root it drives the
# cluster through the postgres account instead.
if [ "$(id -u)" = "0" ]; then
  RUN="su postgres -c"
else
  RUN="bash -c"
fi

stop_cluster() {
  $RUN "$PGBIN/pg_ctl -D $WORKDIR stop -s -m immediate" >/dev/null 2>&1 || true
}
trap stop_cluster EXIT

# A cluster left behind by an interrupted run would hold the port.
stop_cluster
rm -rf "$WORKDIR"
mkdir -p "$WORKDIR"

if [ "$(id -u)" = "0" ]; then
  chown postgres:postgres "$WORKDIR"
  chmod 700 "$WORKDIR"
fi

$RUN "$PGBIN/initdb -D $WORKDIR --auth=trust" >/dev/null
$RUN "$PGBIN/pg_ctl -D $WORKDIR -o \"-p $PORT -k $SOCKET -c listen_addresses=''\" -l $WORKDIR/pg.log start" >/dev/null

export PGHOST="$SOCKET" PGPORT="$PORT" PGUSER=postgres

until psql -q -tAc 'select 1' postgres >/dev/null 2>&1; do sleep 0.3; done

psql -q -c "create database $DB;"
psql -q -v ON_ERROR_STOP=1 -d "$DB" -f supabase/tests/stub-supabase.sql

for migration in supabase/migrations/*.sql; do
  printf '  %-40s' "$(basename "$migration")"
  psql -q -v ON_ERROR_STOP=1 -d "$DB" -f "$migration"
  echo 'applied'
done

echo
psql -q -v ON_ERROR_STOP=1 -d "$DB" -f supabase/tests/security.sql 2>&1 \
  | grep -vE '^(SET|RESET|UPDATE|INSERT)' \
  | sed 's/^psql:[^ ]*: //'
echo
echo 'All database security checks passed.'
