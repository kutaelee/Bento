#!/usr/bin/env bash
set -euo pipefail

fail() {
  echo "[P5-T2] $1" >&2
}

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
EVID_DIR="$ROOT_DIR/evidence/P5/P5-T2"
ACT_HTTP="$EVID_DIR/actual/http"
ACT_LOGS="$EVID_DIR/actual/logs"
ACT_FS="$EVID_DIR/actual/fs"

mkdir -p "$ACT_HTTP" "$ACT_LOGS" "$ACT_FS"
cd "$ROOT_DIR"

cleanup_stale_servers() {
  local stale_pids
  stale_pids="$(pgrep -af "node scripts/dev_server.mjs" | awk '{print $1}' || true)"

  if [[ -n "$stale_pids" ]]; then
    echo "[P5-T2] stale dev_server process detected; stopping before evidence run" >&2
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

RAW_UPLOAD="$ACT_HTTP/create_upload.body.raw.json"
curl -sS -o "$RAW_UPLOAD" -w "%{http_code}" \
  -H 'content-type: application/json' \
  -H "authorization: Bearer ${ACCESS_TOKEN}" \
  -d '{"parent_id":"'"$PARENT_ID"'","filename":"chunky.bin","size_bytes":4,"sha256":null,"mime_type":"application/octet-stream","modified_at":null}' \
  "http://localhost:${PORT}/uploads" \
  >"$ACT_HTTP/create_upload.status.txt" || true

if [[ "$(cat "$ACT_HTTP/create_upload.status.txt" || true)" != "201" ]]; then
  fail "expected uploads create 201"
  exit 1
fi

UPLOAD_ID="$(jq -r '.upload_id' <"$RAW_UPLOAD")"
if [[ -z "$UPLOAD_ID" || "$UPLOAD_ID" == "null" ]]; then
  fail "missing upload_id"
  exit 1
fi

# Prepare chunk 0 body (4 bytes)
printf 'ABCD' >"$ACT_FS/chunk0.bin"
CHUNK0_SHA="$(python3 - <<'PY'
import hashlib
p='evidence/P5/P5-T2/actual/fs/chunk0.bin'
with open(p,'rb') as f:
  print(hashlib.sha256(f.read()).hexdigest())
PY
)"

RAW_CHUNK1="$ACT_HTTP/upload_chunk_001.body.raw.json"
curl -sS -o "$RAW_CHUNK1" -w "%{http_code}" \
  -X PUT \
  -H "authorization: Bearer ${ACCESS_TOKEN}" \
  -H "content-type: application/octet-stream" \
  -H "X-Chunk-SHA256: ${CHUNK0_SHA}" \
  --data-binary "@$ACT_FS/chunk0.bin" \
  "http://localhost:${PORT}/uploads/${UPLOAD_ID}/chunks/0" \
  >"$ACT_HTTP/upload_chunk_001.status.txt" || true

# Idempotent re-upload (same bytes/sha)
RAW_CHUNK2="$ACT_HTTP/upload_chunk_002.body.raw.json"
curl -sS -o "$RAW_CHUNK2" -w "%{http_code}" \
  -X PUT \
  -H "authorization: Bearer ${ACCESS_TOKEN}" \
  -H "content-type: application/octet-stream" \
  -H "X-Chunk-SHA256: ${CHUNK0_SHA}" \
  --data-binary "@$ACT_FS/chunk0.bin" \
  "http://localhost:${PORT}/uploads/${UPLOAD_ID}/chunks/0" \
  >"$ACT_HTTP/upload_chunk_002.status.txt" || true

# Conflict: same chunk_index, different bytes/sha => 409
printf 'WXYZ' >"$ACT_FS/chunk0_conflict.bin"
CHUNK0_SHA2="$(python3 - <<'PY'
import hashlib
p='evidence/P5/P5-T2/actual/fs/chunk0_conflict.bin'
with open(p,'rb') as f:
  print(hashlib.sha256(f.read()).hexdigest())
PY
)"

RAW_CHUNK3="$ACT_HTTP/upload_chunk_003.body.raw.json"
curl -sS -o "$RAW_CHUNK3" -w "%{http_code}" \
  -X PUT \
  -H "authorization: Bearer ${ACCESS_TOKEN}" \
  -H "content-type: application/octet-stream" \
  -H "X-Chunk-SHA256: ${CHUNK0_SHA2}" \
  --data-binary "@$ACT_FS/chunk0_conflict.bin" \
  "http://localhost:${PORT}/uploads/${UPLOAD_ID}/chunks/0" \
  >"$ACT_HTTP/upload_chunk_003.status.txt" || true

# Assertions
jq -e '.upload_id == "'"$UPLOAD_ID"'"' "$RAW_CHUNK1" >"$ACT_HTTP/upload_chunk_001.assert.txt"
jq -e '.upload_id == "'"$UPLOAD_ID"'"' "$RAW_CHUNK2" >"$ACT_HTTP/upload_chunk_002.assert.txt"

PASS1=false
PASS2=false
PASS3=false

if [[ "$(cat "$ACT_HTTP/upload_chunk_001.status.txt" || true)" == "200" ]]; then PASS1=true; fi
if [[ "$(cat "$ACT_HTTP/upload_chunk_002.status.txt" || true)" == "200" ]]; then PASS2=true; fi
if [[ "$(cat "$ACT_HTTP/upload_chunk_003.status.txt" || true)" == "409" ]]; then PASS3=true; fi

if [[ "$PASS1" != "true" || "$PASS2" != "true" || "$PASS3" != "true" ]]; then
  fail "one or more checks failed"
  cat > "$EVID_DIR/summary.json" <<JSON
{
  "piece_id": "P5",
  "task_id": "P5-T2",
  "result": "FAIL",
  "pass": false,
  "checks": [
    {"name":"upload_chunk_200","expected":"PUT /uploads/{id}/chunks/0 returns 200","actual_path":"evidence/P5/P5-T2/actual/http/upload_chunk_001.status.txt","pass": $PASS1},
    {"name":"idempotent_reupload_200","expected":"Re-upload same chunk with same sha returns 200","actual_path":"evidence/P5/P5-T2/actual/http/upload_chunk_002.status.txt","pass": $PASS2},
    {"name":"conflict_different_sha_409","expected":"Re-upload same chunk_index with different sha returns 409","actual_path":"evidence/P5/P5-T2/actual/http/upload_chunk_003.status.txt","pass": $PASS3}
  ]
}
JSON
  exit 1
fi

cat > "$EVID_DIR/summary.json" <<'JSON'
{
  "piece_id": "P5",
  "task_id": "P5-T2",
  "result": "PASS",
  "pass": true,
  "checks": [
    {"name":"upload_chunk_200","expected":"PUT /uploads/{id}/chunks/0 returns 200","actual_path":"evidence/P5/P5-T2/actual/http/upload_chunk_001.status.txt","pass": true},
    {"name":"idempotent_reupload_200","expected":"Re-upload same chunk with same sha returns 200","actual_path":"evidence/P5/P5-T2/actual/http/upload_chunk_002.status.txt","pass": true},
    {"name":"conflict_different_sha_409","expected":"Re-upload same chunk_index with different sha returns 409","actual_path":"evidence/P5/P5-T2/actual/http/upload_chunk_003.status.txt","pass": true}
  ],
  "artifacts": {
    "cases": [
      "evidence/P5/P5-T2/cases/P5-T2-UPLOAD-CHUNK-001.case.yaml"
    ],
    "run_sh": "evidence/P5/P5-T2/run.sh",
    "expected_md": "evidence/P5/P5-T2/expected.md",
    "actual": {
      "http": {
        "chunk_1": "evidence/P5/P5-T2/actual/http/upload_chunk_001.status.txt",
        "chunk_2": "evidence/P5/P5-T2/actual/http/upload_chunk_002.status.txt",
        "chunk_3": "evidence/P5/P5-T2/actual/http/upload_chunk_003.status.txt"
      },
      "logs": {
        "server": "evidence/P5/P5-T2/actual/logs/server.log"
      },
      "fs": {
        "chunk0": "evidence/P5/P5-T2/actual/fs/chunk0.bin",
        "chunk0_conflict": "evidence/P5/P5-T2/actual/fs/chunk0_conflict.bin"
      }
    }
  }
}
JSON
