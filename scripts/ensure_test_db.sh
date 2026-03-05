#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

TASK_ID="${1:-}"
if [[ -z "$TASK_ID" ]]; then
  echo "usage: scripts/ensure_test_db.sh <TASK_ID>" >&2
  exit 2
fi

# Prefix per CI run to avoid cross-run collisions
RUN_KEY="${GITHUB_RUN_ID:-${RUN_ID:-local}}"
RUN_KEY_CLEAN="$(printf '%s' "$RUN_KEY" | tr -cd '0-9A-Za-z_' | cut -c1-20)"
TASK_CLEAN="$(printf '%s' "$TASK_ID" | tr -cd '0-9A-Za-z_' | tr '-' '_' | cut -c1-20)"
DB_NAME="test_${RUN_KEY_CLEAN}_${TASK_CLEAN}"
# NOTE: this script runs in a subshell; caller must capture output to set env.

# Start postgres once (global container)
docker compose -f compose.yaml up -d postgres

# Wait for base DB ready (pg_isready can be optimistic on some runners)
for _ in {1..90}; do
  if docker compose -f compose.yaml exec -T postgres pg_isready -U nimbus -d nimbus_drive >/dev/null 2>&1; then
    if docker compose -f compose.yaml exec -T postgres psql -U nimbus -d nimbus_drive -tAc "SELECT 1" >/dev/null 2>&1; then
      break
    fi
  fi
  sleep 1
done

# Ensure template DB has core tables (init scripts complete)
for _ in {1..120}; do
  if docker compose -f compose.yaml exec -T postgres psql -U nimbus -d nimbus_drive -tAc \
    "SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='users'" 2>/dev/null | grep -q 1; then
    break
  fi
  sleep 1
done

# Recreate per-task database from template to guarantee schema sync.
# Use postgres db for create/drop.
docker compose -f compose.yaml exec -T postgres psql -v ON_ERROR_STOP=1 -U nimbus -d postgres -tAc \
  "SELECT 1" >/dev/null

# Terminate connections + drop (if exists), then create from template.
docker compose -f compose.yaml exec -T postgres psql -v ON_ERROR_STOP=1 -U nimbus -d postgres -tAc \
  "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='${DB_NAME}' AND pid<>pg_backend_pid();" >/dev/null || true

docker compose -f compose.yaml exec -T postgres psql -v ON_ERROR_STOP=1 -U nimbus -d postgres -tAc \
  "DROP DATABASE IF EXISTS \"${DB_NAME}\";" >/dev/null

docker compose -f compose.yaml exec -T postgres psql -v ON_ERROR_STOP=1 -U nimbus -d postgres -tAc \
  "CREATE DATABASE \"${DB_NAME}\" TEMPLATE nimbus_drive;" >/dev/null

# Final readiness check on the cloned DB
for _ in {1..60}; do
  if docker compose -f compose.yaml exec -T postgres psql -U nimbus -d "${DB_NAME}" -tAc "SELECT 1" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

echo "[db] ready: ${DB_NAME} (template=nimbus_drive)" >&2
# stdout: the database name (for caller capture)
printf '%s' "$DB_NAME"
