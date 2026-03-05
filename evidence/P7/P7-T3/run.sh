#!/usr/bin/env bash
set -euo pipefail

fail() {
  echo "[P7-T3] $1" >&2
  exit 1
}

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
EVID_DIR="$ROOT_DIR/evidence/P7/P7-T3"
ACT_HTTP="$EVID_DIR/actual/http"
ACT_LOGS="$EVID_DIR/actual/logs"
ACT_FS="$EVID_DIR/actual/fs"

mkdir -p "$ACT_HTTP" "$ACT_LOGS" "$ACT_FS"
cd "$ROOT_DIR"

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
s=socket.socket()
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

for _ in {1..300}; do
  if curl -sSf "http://localhost:${PORT}/health" >/dev/null 2>&1; then
    break
  fi
  sleep 0.2
done

if ! command -v jq >/dev/null 2>&1; then
  fail "jq is required"
fi

RAW_SETUP="$ACT_HTTP/setup_admin.body.raw.json"

# Setup admin
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
fi

ACCESS_TOKEN="$(jq -r '.tokens.access_token' <"$RAW_SETUP")"
if [[ -z "$ACCESS_TOKEN" || "$ACCESS_TOKEN" == "null" ]]; then
  fail "missing access token"
fi

authz=(-H "authorization: Bearer ${ACCESS_TOKEN}")

# Create and activate a local volume
VOL_BASE="$ACT_FS/volume"
mkdir -p "$VOL_BASE"
RAW_VOL="$ACT_HTTP/create_volume.body.raw.json"
curl -sS -o "$RAW_VOL" -w "%{http_code}" \
  -H 'content-type: application/json' \
  "${authz[@]}" \
  -d '{"name":"local","base_path":"'"$VOL_BASE"'"}' \
  "http://localhost:${PORT}/admin/volumes" \
  >"$ACT_HTTP/create_volume.status.txt" || true

if [[ "$(cat "$ACT_HTTP/create_volume.status.txt" || true)" != "201" ]]; then
  fail "expected admin/volumes 201"
fi

VOLUME_ID="$(jq -r '.id' <"$RAW_VOL")"
if [[ -z "$VOLUME_ID" || "$VOLUME_ID" == "null" ]]; then
  fail "missing volume id"
fi

docker compose -f compose.yaml exec -T postgres psql -v ON_ERROR_STOP=1 -U nimbus -d ${NIMBUS_DB:-nimbus_drive} -qtAc \
  "update volumes set is_active=false; update volumes set is_active=true where id='${VOLUME_ID}'::uuid;"

# Create parent folder
ROOT_ID="00000000-0000-0000-0000-000000000001"
RAW_PARENT="$ACT_HTTP/create_parent.body.raw.json"
curl -sS -o "$RAW_PARENT" -w "%{http_code}" \
  -H 'content-type: application/json' \
  "${authz[@]}" \
  -d '{"parent_id":"'"$ROOT_ID"'","name":"TrashHardDelete"}' \
  "http://localhost:${PORT}/nodes/folders" \
  >"$ACT_HTTP/create_parent.status.txt" || true

if [[ "$(cat "$ACT_HTTP/create_parent.status.txt" || true)" != "201" ]]; then
  fail "expected parent folder create 201"
fi

PARENT_ID="$(jq -r '.id' <"$RAW_PARENT")"

# Upload a tiny file => creates node+blob with ref_count=1
RAW_UPLOAD="$ACT_HTTP/create_upload.body.raw.json"
curl -sS -o "$RAW_UPLOAD" -w "%{http_code}" \
  -H 'content-type: application/json' \
  "${authz[@]}" \
  -d '{"parent_id":"'"$PARENT_ID"'","filename":"hard-delete.bin","size_bytes":4,"sha256":null,"mime_type":"application/octet-stream","modified_at":null}' \
  "http://localhost:${PORT}/uploads" \
  >"$ACT_HTTP/create_upload.status.txt" || true

if [[ "$(cat "$ACT_HTTP/create_upload.status.txt" || true)" != "201" ]]; then
  fail "expected uploads create 201"
fi

UPLOAD_ID="$(jq -r '.upload_id' <"$RAW_UPLOAD")"

printf 'ABCD' >"$ACT_FS/chunk0.bin"
EXPECTED_SHA="$(python3 - <<'PY'
import hashlib
p='evidence/P7/P7-T3/actual/fs/chunk0.bin'
with open(p,'rb') as f:
  print(hashlib.sha256(f.read()).hexdigest())
PY
)"

curl -sS -o "$ACT_HTTP/upload_chunk.body.raw.json" -w "%{http_code}" \
  -X PUT \
  "${authz[@]}" \
  -H "content-type: application/octet-stream" \
  -H "X-Chunk-SHA256: ${EXPECTED_SHA}" \
  --data-binary "@$ACT_FS/chunk0.bin" \
  "http://localhost:${PORT}/uploads/${UPLOAD_ID}/chunks/0" \
  >"$ACT_HTTP/upload_chunk.status.txt" || true

if [[ "$(cat "$ACT_HTTP/upload_chunk.status.txt" || true)" != "200" ]]; then
  fail "expected upload chunk 200"
fi

RAW_COMPLETE="$ACT_HTTP/complete.body.raw.json"
curl -sS -o "$RAW_COMPLETE" -w "%{http_code}" \
  -X POST \
  "${authz[@]}" \
  -H 'content-type: application/json' \
  -d '{}' \
  "http://localhost:${PORT}/uploads/${UPLOAD_ID}/complete" \
  >"$ACT_HTTP/complete.status.txt" || true

if [[ "$(cat "$ACT_HTTP/complete.status.txt" || true)" != "200" ]]; then
  fail "expected complete 200"
fi

NODE_ID="$(jq -r '.node_id' <"$RAW_COMPLETE")"
BLOB_ID="$(jq -r '.blob_id' <"$RAW_COMPLETE")"
if [[ -z "$NODE_ID" || "$NODE_ID" == "null" || -z "$BLOB_ID" || "$BLOB_ID" == "null" ]]; then
  fail "missing node_id/blob_id"
fi

# Pre-check: blob ref_count should be 1
REF_BEFORE="$(docker compose -f compose.yaml exec -T postgres psql -U nimbus -d ${NIMBUS_DB:-nimbus_drive} -qtAc "select ref_count from blobs where id='${BLOB_ID}'::uuid;")"
echo "${REF_BEFORE}" >"$ACT_HTTP/ref_count_before.txt"
if [[ "${REF_BEFORE}" != "1" ]]; then
  fail "expected ref_count=1 before delete (got ${REF_BEFORE})"
fi

# Ensure physical file exists
STORAGE_KEY="blobs/${EXPECTED_SHA:0:2}/${EXPECTED_SHA}.bin"
BLOB_PATH="$VOL_BASE/$STORAGE_KEY"
if [[ ! -f "$BLOB_PATH" ]]; then
  fail "expected blob file to exist at ${BLOB_PATH}"
fi

# Soft delete node => goes to trash
curl -sS -X DELETE -o "$ACT_HTTP/soft_delete.body.raw.json" -w "%{http_code}" \
  "${authz[@]}" \
  "http://localhost:${PORT}/nodes/${NODE_ID}" \
  >"$ACT_HTTP/soft_delete.status.txt" || true

if [[ "$(cat "$ACT_HTTP/soft_delete.status.txt" || true)" != "200" ]]; then
  fail "expected soft delete 200"
fi

# Hard delete from trash
curl -sS -X DELETE -o "$ACT_HTTP/hard_delete.body.raw.json" -w "%{http_code}" \
  "${authz[@]}" \
  "http://localhost:${PORT}/trash/${NODE_ID}" \
  >"$ACT_HTTP/hard_delete.status.txt" || true

if [[ "$(cat "$ACT_HTTP/hard_delete.status.txt" || true)" != "200" ]]; then
  fail "expected hard delete 200"
fi

# Post-check: node removed
NODE_COUNT="$(docker compose -f compose.yaml exec -T postgres psql -U nimbus -d ${NIMBUS_DB:-nimbus_drive} -qtAc "select count(*) from nodes where id='${NODE_ID}'::uuid;")"
echo "${NODE_COUNT}" >"$ACT_HTTP/node_count_after.txt"
if [[ "${NODE_COUNT}" != "0" ]]; then
  fail "expected node deleted from DB"
fi

# Post-check: ref_count decremented to 0 and blob deleted_at set
REF_AFTER="$(docker compose -f compose.yaml exec -T postgres psql -U nimbus -d ${NIMBUS_DB:-nimbus_drive} -qtAc "select ref_count from blobs where id='${BLOB_ID}'::uuid;")"
echo "${REF_AFTER}" >"$ACT_HTTP/ref_count_after.txt"
if [[ "${REF_AFTER}" != "0" ]]; then
  fail "expected ref_count=0 after hard delete (got ${REF_AFTER})"
fi

DELETED_AT_SET="$(docker compose -f compose.yaml exec -T postgres psql -U nimbus -d ${NIMBUS_DB:-nimbus_drive} -qtAc "select (deleted_at is not null) from blobs where id='${BLOB_ID}'::uuid;")"
echo "${DELETED_AT_SET}" >"$ACT_HTTP/blob_deleted_at_set.txt"
if [[ "${DELETED_AT_SET}" != "t" ]]; then
  fail "expected blobs.deleted_at set"
fi

# Optional: physical file removed
FILE_EXISTS_AFTER=false
if [[ -f "$BLOB_PATH" ]]; then FILE_EXISTS_AFTER=true; fi
echo "$FILE_EXISTS_AFTER" >"$ACT_HTTP/blob_file_exists_after.txt"

cat >"$EVID_DIR/summary.json" <<JSON
{
  "piece_id": "P7",
  "task_id": "P7-T3",
  "result": "PASS",
  "pass": true,
  "checks": [
    {"name":"soft_delete_200","expected":"DELETE /nodes/{id} returns 200","actual_path":"evidence/P7/P7-T3/actual/http/soft_delete.status.txt","pass": true},
    {"name":"hard_delete_200","expected":"DELETE /trash/{id} returns 200","actual_path":"evidence/P7/P7-T3/actual/http/hard_delete.status.txt","pass": true},
    {"name":"ref_count_decremented","expected":"blob ref_count decremented to 0","actual_path":"evidence/P7/P7-T3/actual/http/ref_count_after.txt","pass": true},
    {"name":"blob_deleted_at_set","expected":"blob deleted_at set when ref_count==0","actual_path":"evidence/P7/P7-T3/actual/http/blob_deleted_at_set.txt","pass": true},
    {"name":"node_removed","expected":"node row removed from DB","actual_path":"evidence/P7/P7-T3/actual/http/node_count_after.txt","pass": true}
  ],
  "artifacts": {
    "cases": ["evidence/P7/P7-T3/cases/P7-T3-TRASH-HARD-DELETE-001.case.yaml"],
    "expected_md": "evidence/P7/P7-T3/expected.md",
    "run_sh": "evidence/P7/P7-T3/run.sh",
    "actual": {
      "http": {
        "hard_delete": "evidence/P7/P7-T3/actual/http/hard_delete.status.txt"
      },
      "logs": {
        "server": "evidence/P7/P7-T3/actual/logs/server.log"
      }
    }
  }
}
JSON
