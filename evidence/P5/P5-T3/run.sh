#!/usr/bin/env bash
set -euo pipefail

fail() {
  echo "[P5-T3] $1" >&2
}

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
EVID_DIR="$ROOT_DIR/evidence/P5/P5-T3"
ACT_HTTP="$EVID_DIR/actual/http"
ACT_LOGS="$EVID_DIR/actual/logs"
ACT_FS="$EVID_DIR/actual/fs"

mkdir -p "$ACT_HTTP" "$ACT_LOGS" "$ACT_FS"
cd "$ROOT_DIR"

cleanup_stale_servers() {
  local stale_pids
  stale_pids="$(pgrep -af "node scripts/dev_server.mjs" | awk '{print $1}' || true)"

  if [[ -n "$stale_pids" ]]; then
    echo "[P5-T3] stale dev_server process detected; stopping before evidence run" >&2
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

# Create and activate a local volume (server writes files on host filesystem).
VOL_BASE="$ACT_FS/volume"
mkdir -p "$VOL_BASE"
RAW_VOL="$ACT_HTTP/create_volume.body.raw.json"
curl -sS -o "$RAW_VOL" -w "%{http_code}" \
  -H 'content-type: application/json' \
  -H "authorization: Bearer ${ACCESS_TOKEN}" \
  -d '{"name":"local","base_path":"'"$VOL_BASE"'"}' \
  "http://localhost:${PORT}/admin/volumes" \
  >"$ACT_HTTP/create_volume.status.txt" || true

if [[ "$(cat "$ACT_HTTP/create_volume.status.txt" || true)" != "201" ]]; then
  fail "expected admin/volumes 201"
  exit 1
fi

VOLUME_ID="$(jq -r '.id' <"$RAW_VOL")"
if [[ -z "$VOLUME_ID" || "$VOLUME_ID" == "null" ]]; then
  fail "missing volume id"
  exit 1
fi

# Activate volume (no API yet; do it via DB for evidence).
docker compose -f compose.yaml exec -T postgres psql -v ON_ERROR_STOP=1 -U nimbus -d ${NIMBUS_DB:-nimbus_drive} -qtAc \
  "update volumes set is_active=false; update volumes set is_active=true where id='${VOLUME_ID}'::uuid;"

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
  -d '{"parent_id":"'"$PARENT_ID"'","filename":"complete.bin","size_bytes":4,"sha256":null,"mime_type":"application/octet-stream","modified_at":null}' \
  "http://localhost:${PORT}/uploads" \
  >"$ACT_HTTP/create_upload.status.txt" || true

if [[ "$(cat "$ACT_HTTP/create_upload.status.txt" || true)" != "201" ]]; then
  fail "expected uploads create 201"
  exit 1
fi

UPLOAD_ID="$(jq -r '.upload_id' <"$RAW_UPLOAD")"

# Prepare chunk 0 body (4 bytes)
printf 'ABCD' >"$ACT_FS/chunk0.bin"
EXPECTED_SHA="$(python3 - <<'PY'
import hashlib
p='evidence/P5/P5-T3/actual/fs/chunk0.bin'
with open(p,'rb') as f:
  print(hashlib.sha256(f.read()).hexdigest())
PY
)"

RAW_CHUNK="$ACT_HTTP/upload_chunk.body.raw.json"
curl -sS -o "$RAW_CHUNK" -w "%{http_code}" \
  -X PUT \
  -H "authorization: Bearer ${ACCESS_TOKEN}" \
  -H "content-type: application/octet-stream" \
  -H "X-Chunk-SHA256: ${EXPECTED_SHA}" \
  --data-binary "@$ACT_FS/chunk0.bin" \
  "http://localhost:${PORT}/uploads/${UPLOAD_ID}/chunks/0" \
  >"$ACT_HTTP/upload_chunk.status.txt" || true
if [[ "$(cat "$ACT_HTTP/upload_chunk.status.txt" || true)" != "200" ]]; then
  fail "expected upload chunk 200"
  exit 1
fi

RAW_COMPLETE="$ACT_HTTP/complete.body.raw.json"
curl -sS -o "$RAW_COMPLETE" -w "%{http_code}" \
  -X POST \
  -H "authorization: Bearer ${ACCESS_TOKEN}" \
  -H 'content-type: application/json' \
  -d '{}' \
  "http://localhost:${PORT}/uploads/${UPLOAD_ID}/complete" \
  >"$ACT_HTTP/complete.status.txt" || true

PASS1=false
PASS2=false
PASS3=false
PASS4=false

if [[ "$(cat "$ACT_HTTP/complete.status.txt" || true)" == "200" ]]; then PASS1=true; fi

NODE_ID="$(jq -r '.node_id' <"$RAW_COMPLETE" 2>/dev/null || echo '')"
BLOB_ID="$(jq -r '.blob_id' <"$RAW_COMPLETE" 2>/dev/null || echo '')"
RESP_SHA="$(jq -r '.sha256' <"$RAW_COMPLETE" 2>/dev/null || echo '')"
RESP_SIZE="$(jq -r '.size_bytes' <"$RAW_COMPLETE" 2>/dev/null || echo '')"

if [[ -n "$NODE_ID" && "$NODE_ID" != "null" && -n "$BLOB_ID" && "$BLOB_ID" != "null" ]]; then PASS2=true; fi
if [[ "$RESP_SHA" == "$EXPECTED_SHA" ]]; then PASS3=true; fi
if [[ "$RESP_SIZE" == "4" ]]; then PASS4=true; fi

# Download the created node and verify sha.
DL_PATH="$ACT_FS/downloaded.bin"
curl -sS \
  -H "authorization: Bearer ${ACCESS_TOKEN}" \
  -o "$DL_PATH" \
  "http://localhost:${PORT}/nodes/${NODE_ID}/download"

DOWN_SHA="$(python3 - <<'PY'
import hashlib
p='evidence/P5/P5-T3/actual/fs/downloaded.bin'
with open(p,'rb') as f:
  print(hashlib.sha256(f.read()).hexdigest())
PY
)"

PASS5=false
if [[ "$DOWN_SHA" == "$EXPECTED_SHA" ]]; then PASS5=true; fi

if [[ "$PASS1" != "true" || "$PASS2" != "true" || "$PASS3" != "true" || "$PASS4" != "true" || "$PASS5" != "true" ]]; then
  fail "one or more checks failed"
  cat > "$EVID_DIR/summary.json" <<JSON
{
  "piece_id": "P5",
  "task_id": "P5-T3",
  "result": "FAIL",
  "pass": false,
  "checks": [
    {"name":"complete_200","expected":"POST /uploads/{id}/complete returns 200","actual_path":"evidence/P5/P5-T3/actual/http/complete.status.txt","pass": $PASS1},
    {"name":"complete_fields","expected":"CompleteUploadResponse fields exist","actual_path":"evidence/P5/P5-T3/actual/http/complete.body.raw.json","pass": $PASS2},
    {"name":"complete_sha","expected":"response sha256 equals expected","actual_path":"evidence/P5/P5-T3/actual/http/complete.body.raw.json","pass": $PASS3},
    {"name":"complete_size","expected":"response size_bytes == 4","actual_path":"evidence/P5/P5-T3/actual/http/complete.body.raw.json","pass": $PASS4},
    {"name":"download_sha","expected":"downloaded sha256 equals expected","actual_path":"evidence/P5/P5-T3/actual/fs/downloaded.bin","pass": $PASS5}
  ]
}
JSON
  exit 1
fi

cat > "$EVID_DIR/summary.json" <<'JSON'
{
  "piece_id": "P5",
  "task_id": "P5-T3",
  "result": "PASS",
  "pass": true,
  "checks": [
    {"name":"complete_200","expected":"POST /uploads/{id}/complete returns 200","actual_path":"evidence/P5/P5-T3/actual/http/complete.status.txt","pass": true},
    {"name":"complete_fields","expected":"CompleteUploadResponse fields exist","actual_path":"evidence/P5/P5-T3/actual/http/complete.body.raw.json","pass": true},
    {"name":"complete_sha","expected":"response sha256 equals expected","actual_path":"evidence/P5/P5-T3/actual/http/complete.body.raw.json","pass": true},
    {"name":"complete_size","expected":"response size_bytes == 4","actual_path":"evidence/P5/P5-T3/actual/http/complete.body.raw.json","pass": true},
    {"name":"download_sha","expected":"downloaded sha256 equals expected","actual_path":"evidence/P5/P5-T3/actual/fs/downloaded.bin","pass": true}
  ],
  "artifacts": {
    "cases": [
      "evidence/P5/P5-T3/cases/P5-T3-UPLOADS-COMPLETE-001.case.yaml"
    ],
    "run_sh": "evidence/P5/P5-T3/run.sh",
    "expected_md": "evidence/P5/P5-T3/expected.md",
    "actual": {
      "http": {
        "complete": "evidence/P5/P5-T3/actual/http/complete.status.txt"
      },
      "logs": {
        "server": "evidence/P5/P5-T3/actual/logs/server.log"
      },
      "fs": {
        "chunk0": "evidence/P5/P5-T3/actual/fs/chunk0.bin",
        "downloaded": "evidence/P5/P5-T3/actual/fs/downloaded.bin"
      }
    }
  }
}
JSON
