#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
EVID_DIR="$ROOT_DIR/evidence/P0/P0-T2"
ACT_DB="$EVID_DIR/actual/db"

mkdir -p "$ACT_DB"

# Start postgres via compose
cd "$ROOT_DIR"
docker compose -f compose.yaml up -d postgres

cleanup() {
  if [[ -z "${EVIDENCE_REUSE_DB:-}" ]]; then docker compose -f compose.yaml down -v >/dev/null 2>&1 || true; fi
}
trap cleanup EXIT

# Wait for postgres readiness (fail hard if not ready; CI needs deterministic behavior)
ready=""
for _ in {1..60}; do
  if docker compose -f compose.yaml exec -T postgres pg_isready -U nimbus >/dev/null 2>&1; then
    ready="yes"
    break
  fi
  sleep 1
done

if [ -z "$ready" ]; then
  echo "postgres did not become ready in time" >&2
  docker compose -f compose.yaml logs --tail=200 postgres || true
  exit 1
fi

# Extra guard: pg_isready can be optimistic during startup on some runners.
# Require an actual SQL round-trip before proceeding.
psql_ready=""
for _ in {1..60}; do
  if docker compose -f compose.yaml exec -T postgres psql -U nimbus -d postgres -tAc "SELECT 1" >/dev/null 2>&1; then
    psql_ready="yes"
    break
  fi
  sleep 1
done
if [ -z "$psql_ready" ]; then
  echo "psql did not become ready in time" >&2
  docker compose -f compose.yaml logs --tail=200 postgres || true
  exit 1
fi

# Some GitHub runners exhibit a short window where Postgres reports ready but then
# briefly shuts down/restarts (e.g., init scripts / volume). Harden by retrying
# psql operations that are expected to be stable.
docker_psql_retry() {
  local db="$1"; shift
  local sql="$1"; shift

  local out=""
  for _ in {1..30}; do
    if out="$(docker compose -f compose.yaml exec -T postgres psql -U nimbus -d "$db" -tAc "$sql" 2>&1)"; then
      printf '%s' "$out"
      return 0
    fi
    if echo "$out" | grep -qi "the database system is shutting down"; then
      sleep 1
      continue
    fi
    # GitHub runners sometimes briefly lose the local unix socket even after pg_isready
    # (e.g., container restart / init window). Treat as transient and retry.
    if echo "$out" | grep -Eqi "connection to server .*failed|Is the server running locally|No such file or directory"; then
      sleep 1
      continue
    fi
    echo "$out" >&2
    return 1
  done

  echo "$out" >&2
  echo "psql failed repeatedly (postgres shutting down)" >&2
  docker compose -f compose.yaml logs --tail=200 postgres || true
  return 1
}

# Ensure the expected database exists (compose may not create it by default).
# IMPORTANT: evidence scripts must be idempotent in CI.
# NOTE: Postgres disallows CREATE DATABASE inside a DO/function context on some versions.
# So we check first, then create only if missing.
if ! docker_psql_retry postgres "SELECT 1 FROM pg_database WHERE datname = 'nimbus_drive'" | grep -q 1; then
  # Race-safe create: CI runners sometimes finish initdb (and create POSTGRES_DB)
  # between the existence check and CREATE DATABASE.
  create_out=""
  created=""
  for _ in {1..30}; do
    if create_out="$(docker compose -f compose.yaml exec -T postgres psql -U nimbus -d postgres -v ON_ERROR_STOP=1 -c "CREATE DATABASE nimbus_drive;" 2>&1)"; then
      created="yes"
      break
    fi
    if echo "$create_out" | grep -qi "the database system is shutting down"; then
      sleep 1
      continue
    fi
    echo "$create_out" >&2
    break
  done

  if [ -z "$created" ]; then
    # If it now exists, treat it as OK; otherwise bubble up the error.
    if docker_psql_retry postgres "SELECT 1 FROM pg_database WHERE datname = 'nimbus_drive'" | grep -q 1; then
      echo "database nimbus_drive already exists (race); continuing" >&2
    else
      echo "$create_out" >&2
      exit 1
    fi
  fi
fi

# Wait for schema readiness: the compose init scripts can finish slightly after the
# server becomes "ready" on some runners.
schema_ready=""
for _ in {1..60}; do
  if docker_psql_retry nimbus_drive "SELECT 1 WHERE to_regclass('public.users') IS NOT NULL" | grep -q 1; then
    schema_ready="yes"
    break
  fi
  sleep 1
done
if [ -z "$schema_ready" ]; then
  echo "schema did not become ready in time (missing public.users)" >&2
  docker compose -f compose.yaml exec -T postgres psql -U nimbus -d ${NIMBUS_DB:-nimbus_drive} -c "\\dt" || true
  docker compose -f compose.yaml logs --tail=200 postgres || true
  exit 1
fi

# Capture extensions and users schema

docker compose -f compose.yaml exec -T postgres psql -U nimbus -d ${NIMBUS_DB:-nimbus_drive} -c "\\dx" \
  >"$ACT_DB/extensions.txt"

docker compose -f compose.yaml exec -T postgres psql -U nimbus -d ${NIMBUS_DB:-nimbus_drive} -c "\\d users" \
  >"$ACT_DB/users_schema.txt"

# Assertions
if ! grep -q "ltree" "$ACT_DB/extensions.txt"; then
  echo "ltree extension missing" >&2
  exit 1
fi
if ! grep -q "pg_trgm" "$ACT_DB/extensions.txt"; then
  echo "pg_trgm extension missing" >&2
  exit 1
fi
# NOTE: psql error output can still contain the token "users" even when the table is missing.
# Assert on schema-specific markers to avoid false positives.
if ! grep -q 'Table "public\.users"' "$ACT_DB/users_schema.txt"; then
  echo "users table missing (expected: Table \"public.users\")" >&2
  exit 1
fi
if ! grep -qE '^\s*username\s*\|\s*citext\b' "$ACT_DB/users_schema.txt"; then
  echo "users.username column missing (expected citext)" >&2
  exit 1
fi
