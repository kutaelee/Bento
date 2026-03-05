#!/usr/bin/env bash
set -euo pipefail

fail() {
  echo "[P5-T4] $1" >&2
}

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
EVID_DIR="$ROOT_DIR/evidence/P5/P5-T4"
ACT_HTTP="$EVID_DIR/actual/http"
ACT_LOGS="$EVID_DIR/actual/logs"
ACT_FS="$EVID_DIR/actual/fs"
ACT_DB="$EVID_DIR/actual/db"

mkdir -p "$ACT_HTTP" "$ACT_LOGS" "$ACT_FS" "$ACT_DB"
cd "$ROOT_DIR"

cleanup_stale_servers() {
  local stale_pids
  stale_pids="$(pgrep -af "node scripts/dev_server.mjs" | awk '{print $1}' || true)"

  if [[ -n "$stale_pids" ]]; then
    echo "[P5-T4] stale dev_server process detected; stopping before evidence run" >&2
    while read -r pid; do
      [[ -z "$pid" ]] && continue
      kill "$pid" 2>/dev/null || true
    done <<<"$stale_pids"
    sleep 0.5
  fi
}

cleanup_stale_servers

if [[ -z "${EVIDENCE_REUSE_DB:-}" ]]; then docker compose -f compose.yaml down -v >/dev/null 2>&1 || true; fi
docker compose -f compose.yaml up -d postgres

for _ in {1..60}; do
  if docker compose -f compose.yaml exec -T postgres pg_isready -U nimbus -d ${NIMBUS_DB:-nimbus_drive} >/dev/null 2>&1; then
    break
  fi
  sleep 1
  if [[ "$_" == "60" ]]; then
    fail "postgres not ready"
    exit 1
  fi
  done

PORT="$(python3 - <<'PY'
import socket
s = socket.socket()
s.bind(('',0))
print(s.getsockname()[1])
s.close()
PY
)"
(
  cd "$ROOT_DIR"
  PORT="$PORT" node scripts/dev_server.mjs >"$ACT_LOGS/server.log" 2>&1 &
  echo $! >"$ACT_LOGS/server.pid"
)

cleanup() {
  if [[ -f "$ACT_LOGS/server.pid" ]]; then
    PID="$(cat "$ACT_LOGS/server.pid" || true)"
    if [[ -n "${PID:-}" ]] && kill -0 "$PID" 2>/dev/null; then
      kill "$PID" 2>/dev/null || true
      sleep 0.2 || true
      kill -9 "$PID" 2>/dev/null || true
    fi
  fi
  if [[ -z "${EVIDENCE_REUSE_DB:-}" ]]; then docker compose -f compose.yaml down -v >/dev/null 2>&1 || true; fi
}
trap cleanup EXIT

ready=""
for _ in {1..300}; do
  if curl -sSf "http://localhost:${PORT}/health" >/dev/null 2>&1; then
    ready="yes"
    break
  fi
  sleep 0.2
  done
if [[ -z "$ready" ]]; then
  fail "server did not become ready in time"
  exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
  fail "jq is required"
  exit 1
fi

RAW_SETUP="$ACT_HTTP/setup_admin.body.raw.json"
setup_status=""
for _ in {1..20}; do
  curl -sS -o "$RAW_SETUP" -w "%{http_code}" \
    -H 'content-type: application/json' \
    -d '{"username":"admin","password":"CorrectHorseBatteryStaple","display_name":"Admin","locale":"en-US"}' \
    "http://localhost:${PORT}/setup/admin" \
    >"$ACT_HTTP/setup_admin.status.txt" || true
  setup_status="$(cat "$ACT_HTTP/setup_admin.status.txt" || true)"
  if [[ "$setup_status" == "201" ]]; then
    break
  fi
  sleep 0.2
  done

if [[ "$setup_status" != "201" ]]; then
  fail "expected setup/admin 201 (got ${setup_status:-empty})"
  exit 1
fi

ACCESS_TOKEN="$(jq -r '.tokens.access_token' <"$RAW_SETUP")"
if [[ -z "$ACCESS_TOKEN" || "$ACCESS_TOKEN" == "null" ]]; then
  fail "missing access token from setup/admin"
  exit 1
fi

ROOT_ID="00000000-0000-0000-0000-000000000001"
RAW_PARENT="$ACT_HTTP/create_parent.body.raw.json"
curl -sS -o "$RAW_PARENT" -w "%{http_code}" \
  -H 'content-type: application/json' \
  -H "authorization: Bearer ${ACCESS_TOKEN}" \
  -d '{"parent_id":"'"$ROOT_ID"'","name":"Uploads"}' \
  "http://localhost:${PORT}/nodes/folders" \
  >"$ACT_HTTP/create_parent.status.txt" || true
if [[ "$(cat "$ACT_HTTP/create_parent.status.txt" || true)" != "201" ]]; then
  fail "expected parent create 201"
  exit 1
fi
PARENT_ID="$(jq -r '.id' <"$RAW_PARENT")"

MERGING_ID="$(python3 - <<'PY'
import uuid
print(uuid.uuid4())
PY
)"
INIT_ID="$(python3 - <<'PY'
import uuid
print(uuid.uuid4())
PY
)"

MERGING_DIR="$ACT_FS/merging-${MERGING_ID}"
INIT_DIR="$ACT_FS/init-${INIT_ID}"
mkdir -p "$MERGING_DIR" "$INIT_DIR"
printf 'ABCD' >"$MERGING_DIR/chunk_0.bin"
printf 'EFGH' >"$INIT_DIR/chunk_0.bin"

MERGING_CHUNK_SHA="$(sha256sum "$MERGING_DIR/chunk_0.bin" | awk '{print $1}')"
INIT_CHUNK_SHA="$(sha256sum "$INIT_DIR/chunk_0.bin" | awk '{print $1}')"

# Insert stale MERGING session (updated_at older than 30 minutes)
docker compose -f compose.yaml exec -T postgres psql -v ON_ERROR_STOP=1 -U nimbus -d ${NIMBUS_DB:-nimbus_drive} -qtAc \
  "insert into upload_sessions (id, user_id, parent_id, filename, size_bytes, sha256, mime_type, status, chunk_size_bytes, total_chunks, received_chunks, temp_dir, created_at, updated_at, expires_at) values (\
    '${MERGING_ID}'::uuid,\
    (select id from users where username='admin' limit 1),\
    '${PARENT_ID}'::uuid,\
    'merge.bin',\
    4,\
    null,\
    'application/octet-stream',\
    'MERGING',\
    8388608,\
    1,\
    '{0}',\
    '${MERGING_DIR}',\
    now() - interval '1 day',\
    now() - interval '31 minutes',\
    now() + interval '1 day'\
  );"

docker compose -f compose.yaml exec -T postgres psql -v ON_ERROR_STOP=1 -U nimbus -d ${NIMBUS_DB:-nimbus_drive} -qtAc \
  "insert into upload_chunks (upload_id, chunk_index, checksum_sha256, size_bytes, stored_path) values (\
    '${MERGING_ID}'::uuid,\
    0,\
    '${MERGING_CHUNK_SHA}'::char(64),\
    4,\
    '${MERGING_DIR}/chunk_0.bin'\
  );"

# Insert expired INIT session (created_at older than session_ttl)
docker compose -f compose.yaml exec -T postgres psql -v ON_ERROR_STOP=1 -U nimbus -d ${NIMBUS_DB:-nimbus_drive} -qtAc \
  "insert into upload_sessions (id, user_id, parent_id, filename, size_bytes, sha256, mime_type, status, chunk_size_bytes, total_chunks, received_chunks, temp_dir, created_at, updated_at, expires_at) values (\
    '${INIT_ID}'::uuid,\
    (select id from users where username='admin' limit 1),\
    '${PARENT_ID}'::uuid,\
    'init.bin',\
    4,\
    null,\
    'application/octet-stream',\
    'INIT',\
    8388608,\
    1,\
    '{}',\
    '${INIT_DIR}',\
    now() - interval '3 days',\
    now() - interval '3 days',\
    now() - interval '1 day'\
  );"

docker compose -f compose.yaml exec -T postgres psql -v ON_ERROR_STOP=1 -U nimbus -d ${NIMBUS_DB:-nimbus_drive} -qtAc \
  "insert into upload_chunks (upload_id, chunk_index, checksum_sha256, size_bytes, stored_path) values (\
    '${INIT_ID}'::uuid,\
    0,\
    '${INIT_CHUNK_SHA}'::char(64),\
    4,\
    '${INIT_DIR}/chunk_0.bin'\
  );"

# Restart server to trigger startup reconciler
if [[ -f "$ACT_LOGS/server.pid" ]]; then
  PID="$(cat "$ACT_LOGS/server.pid" || true)"
  if [[ -n "${PID:-}" ]] && kill -0 "$PID" 2>/dev/null; then
    kill "$PID" 2>/dev/null || true
    sleep 0.5 || true
  fi
fi

(
  cd "$ROOT_DIR"
  PORT="$PORT" node scripts/dev_server.mjs >"$ACT_LOGS/server_restart.log" 2>&1 &
  echo $! >"$ACT_LOGS/server.pid"
)

ready=""
for _ in {1..300}; do
  if curl -sSf "http://localhost:${PORT}/health" >/dev/null 2>&1; then
    ready="yes"
    break
  fi
  sleep 0.2
  done
if [[ -z "$ready" ]]; then
  fail "server did not become ready after restart"
  exit 1
fi

# Assertions: status updated + chunks removed + temp dirs removed
MERGING_STATUS="$(docker compose -f compose.yaml exec -T postgres psql -U nimbus -d ${NIMBUS_DB:-nimbus_drive} -qtAc "select status from upload_sessions where id='${MERGING_ID}'::uuid;")"
INIT_STATUS="$(docker compose -f compose.yaml exec -T postgres psql -U nimbus -d ${NIMBUS_DB:-nimbus_drive} -qtAc "select status from upload_sessions where id='${INIT_ID}'::uuid;")"
MERGING_CHUNKS="$(docker compose -f compose.yaml exec -T postgres psql -U nimbus -d ${NIMBUS_DB:-nimbus_drive} -qtAc "select count(*) from upload_chunks where upload_id='${MERGING_ID}'::uuid;")"
INIT_CHUNKS="$(docker compose -f compose.yaml exec -T postgres psql -U nimbus -d ${NIMBUS_DB:-nimbus_drive} -qtAc "select count(*) from upload_chunks where upload_id='${INIT_ID}'::uuid;")"

printf '%s' "$MERGING_STATUS" >"$ACT_DB/merging_status.txt"
printf '%s' "$INIT_STATUS" >"$ACT_DB/init_status.txt"
printf '%s' "$MERGING_CHUNKS" >"$ACT_DB/merging_chunks.txt"
printf '%s' "$INIT_CHUNKS" >"$ACT_DB/init_chunks.txt"

MERGING_DIR_EXISTS="false"
INIT_DIR_EXISTS="false"
if [[ -d "$MERGING_DIR" ]]; then MERGING_DIR_EXISTS="true"; fi
if [[ -d "$INIT_DIR" ]]; then INIT_DIR_EXISTS="true"; fi
printf '%s' "$MERGING_DIR_EXISTS" >"$ACT_FS/merging_dir_exists.txt"
printf '%s' "$INIT_DIR_EXISTS" >"$ACT_FS/init_dir_exists.txt"

PASS1=false
PASS2=false
PASS3=false
PASS4=false
PASS5=false
PASS6=false

if [[ "$MERGING_STATUS" == "FAILED" ]]; then PASS1=true; fi
if [[ "$INIT_STATUS" == "ABORTED" ]]; then PASS2=true; fi
if [[ "$MERGING_CHUNKS" == "0" ]]; then PASS3=true; fi
if [[ "$INIT_CHUNKS" == "0" ]]; then PASS4=true; fi
if [[ "$MERGING_DIR_EXISTS" == "false" ]]; then PASS5=true; fi
if [[ "$INIT_DIR_EXISTS" == "false" ]]; then PASS6=true; fi

if [[ "$PASS1" != "true" || "$PASS2" != "true" || "$PASS3" != "true" || "$PASS4" != "true" || "$PASS5" != "true" || "$PASS6" != "true" ]]; then
  fail "one or more checks failed"
  cat > "$EVID_DIR/summary.json" <<JSON
{
  "piece_id": "P5",
  "task_id": "P5-T4",
  "result": "FAIL",
  "pass": false,
  "checks": [
    {"name":"merging_failed","expected":"MERGING stale => FAILED","actual_path":"evidence/P5/P5-T4/actual/db/merging_status.txt","pass": $PASS1},
    {"name":"init_aborted","expected":"INIT expired => ABORTED","actual_path":"evidence/P5/P5-T4/actual/db/init_status.txt","pass": $PASS2},
    {"name":"merging_chunks_clean","expected":"MERGING chunks deleted","actual_path":"evidence/P5/P5-T4/actual/db/merging_chunks.txt","pass": $PASS3},
    {"name":"init_chunks_clean","expected":"INIT chunks deleted","actual_path":"evidence/P5/P5-T4/actual/db/init_chunks.txt","pass": $PASS4},
    {"name":"merging_temp_removed","expected":"MERGING temp dir removed","actual_path":"evidence/P5/P5-T4/actual/fs/merging_dir_exists.txt","pass": $PASS5},
    {"name":"init_temp_removed","expected":"INIT temp dir removed","actual_path":"evidence/P5/P5-T4/actual/fs/init_dir_exists.txt","pass": $PASS6}
  ]
}
JSON
  exit 1
fi

cat > "$EVID_DIR/summary.json" <<'JSON'
{
  "piece_id": "P5",
  "task_id": "P5-T4",
  "result": "PASS",
  "pass": true,
  "checks": [
    {"name":"merging_failed","expected":"MERGING stale => FAILED","actual_path":"evidence/P5/P5-T4/actual/db/merging_status.txt","pass": true},
    {"name":"init_aborted","expected":"INIT expired => ABORTED","actual_path":"evidence/P5/P5-T4/actual/db/init_status.txt","pass": true},
    {"name":"merging_chunks_clean","expected":"MERGING chunks deleted","actual_path":"evidence/P5/P5-T4/actual/db/merging_chunks.txt","pass": true},
    {"name":"init_chunks_clean","expected":"INIT chunks deleted","actual_path":"evidence/P5/P5-T4/actual/db/init_chunks.txt","pass": true},
    {"name":"merging_temp_removed","expected":"MERGING temp dir removed","actual_path":"evidence/P5/P5-T4/actual/fs/merging_dir_exists.txt","pass": true},
    {"name":"init_temp_removed","expected":"INIT temp dir removed","actual_path":"evidence/P5/P5-T4/actual/fs/init_dir_exists.txt","pass": true}
  ],
  "artifacts": {
    "cases": [
      "evidence/P5/P5-T4/cases/P5-T4-STARTUP-RECONCILE-001.case.yaml"
    ],
    "run_sh": "evidence/P5/P5-T4/run.sh",
    "expected_md": "evidence/P5/P5-T4/expected.md",
    "actual": {
      "db": {
        "merging_status": "evidence/P5/P5-T4/actual/db/merging_status.txt",
        "init_status": "evidence/P5/P5-T4/actual/db/init_status.txt",
        "merging_chunks": "evidence/P5/P5-T4/actual/db/merging_chunks.txt",
        "init_chunks": "evidence/P5/P5-T4/actual/db/init_chunks.txt"
      },
      "fs": {
        "merging_dir_exists": "evidence/P5/P5-T4/actual/fs/merging_dir_exists.txt",
        "init_dir_exists": "evidence/P5/P5-T4/actual/fs/init_dir_exists.txt"
      },
      "logs": {
        "server": "evidence/P5/P5-T4/actual/logs/server.log",
        "server_restart": "evidence/P5/P5-T4/actual/logs/server_restart.log"
      }
    }
  }
}
JSON
