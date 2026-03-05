#!/usr/bin/env bash
set -euo pipefail

fail() {
  echo "[P6-T1] $1" >&2
}

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
EVID_DIR="$ROOT_DIR/evidence/P6/P6-T1"
ACT_HTTP="$EVID_DIR/actual/http"
ACT_FS="$EVID_DIR/actual/fs"
ACT_LOGS="$EVID_DIR/actual/logs"

mkdir -p "$ACT_HTTP" "$ACT_FS" "$ACT_LOGS"

cd "$ROOT_DIR"

if [[ -z "${EVIDENCE_REUSE_DB:-}" ]]; then docker compose -f compose.yaml down -v >/dev/null 2>&1 || true; fi
docker compose -f compose.yaml up -d postgres

pg_ready=""
for _ in {1..60}; do
  if docker compose -f compose.yaml exec -T postgres pg_isready -U nimbus -d ${NIMBUS_DB:-nimbus_drive} >/dev/null 2>&1; then
    pg_ready="yes"
    break
  fi
  sleep 1
done

if [ -z "$pg_ready" ]; then
  fail "postgres did not become ready"
  docker compose -f compose.yaml logs --tail 200 postgres || true
  exit 1
fi

PORT="$(python3 - <<'PY'
import socket
s = socket.socket()
s.bind(('', 0))
port = s.getsockname()[1]
s.close()
print(port)
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

if [ -z "$ready" ]; then
  fail "server not ready"
  tail -n 200 "$ACT_LOGS/server.log" >"$ACT_LOGS/server_not_ready_tail.txt" 2>/dev/null || true
  exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
  fail "jq is required"
  exit 1
fi

# Seed initial admin
RAW_SETUP="$ACT_HTTP/setup_admin.body.raw.json"
setup_status=""
for _ in {1..50}; do
  curl -sS -o "$RAW_SETUP" -w "%{http_code}" \
    -H 'content-type: application/json' \
    -d '{"username":"admin","password":"CorrectHorseBatteryStaple","display_name":"Admin","locale":"en-US"}' \
    "http://localhost:${PORT}/setup/admin" \
    >"$ACT_HTTP/setup_admin.status.txt" || true

  setup_status="$(cat "$ACT_HTTP/setup_admin.status.txt" || true)"
  if [[ "$setup_status" == "201" ]]; then
    break
  fi
  if [[ "$setup_status" == "000" || "$setup_status" == 5* ]]; then
    sleep 0.2
    continue
  fi
  break
done

if [[ "$setup_status" != "201" ]]; then
  fail "expected setup/admin 201 (got $setup_status)"
  tail -n 200 "$ACT_LOGS/server.log" >"$ACT_LOGS/setup_admin_fail_tail.txt" 2>/dev/null || true
  exit 1
fi

# Login as admin
RAW_LOGIN="$ACT_HTTP/login.body.raw.json"
login_status=""
for _ in {1..50}; do
  curl -sS -o "$RAW_LOGIN" -w "%{http_code}"     -H 'content-type: application/json'     -d '{"username":"admin","password":"CorrectHorseBatteryStaple"}'     "http://localhost:${PORT}/auth/login"     >"$ACT_HTTP/login.status.txt" || true

  login_status="$(cat "$ACT_HTTP/login.status.txt" || true)"
  if [[ "$login_status" == "200" ]]; then
    break
  fi
  if [[ "$login_status" == "000" || "$login_status" == 5* ]]; then
    sleep 0.2
    continue
  fi
  break
done

if [[ "$login_status" != "200" ]]; then
  fail "expected login 200"
  cat "$RAW_LOGIN" >"$ACT_HTTP/login.assert.txt" || true
  exit 1
fi

ACCESS_TOKEN="$(jq -r '.tokens.access_token' "$RAW_LOGIN")"
ADMIN_USER_ID="$(jq -r '.user.id' "$RAW_LOGIN")"
if [[ -z "$ACCESS_TOKEN" || "$ACCESS_TOKEN" == "null" ]]; then
  fail "missing access token"
  exit 1
fi
if [[ -z "$ADMIN_USER_ID" || "$ADMIN_USER_ID" == "null" ]]; then
  fail "missing user.id"
  exit 1
fi

# Ensure root node exists for parent references.
docker compose -f compose.yaml exec -T postgres psql -v ON_ERROR_STOP=1 -U nimbus -d ${NIMBUS_DB:-nimbus_drive} -qtAc "\
insert into nodes (id, type, parent_id, name, path, owner_user_id, size_bytes, metadata, created_at, updated_at)
values (
  '00000000-0000-0000-0000-000000000001'::uuid,
  'FOLDER',
  NULL,
  'root',
  'root'::ltree,
  '${ADMIN_USER_ID}'::uuid,
  0,
  '{}'::jsonb,
  now(),
  now()
)
on conflict (id) do nothing;
" >"$ACT_FS/psql_insert_root.txt"

TMP_DIR="$(mktemp -d -t nimbus-download-range-XXXXXX)"
VOLUME_NAME="data"

# Create volume
curl -sS -o "$ACT_HTTP/volumes_create.body.json" -w "%{http_code}" \
  -H "authorization: Bearer ${ACCESS_TOKEN}" \
  -H 'content-type: application/json' \
  -d "{\"name\":\"${VOLUME_NAME}\",\"base_path\":\"${TMP_DIR}\"}" \
  "http://localhost:${PORT}/admin/volumes" \
  >"$ACT_HTTP/volumes_create.status.txt"

if [[ "$(cat "$ACT_HTTP/volumes_create.status.txt")" != "201" ]]; then
  fail "expected volumes create 201"
  cat "$ACT_HTTP/volumes_create.body.json" >"$ACT_HTTP/volumes_create.assert.txt" || true
  exit 1
fi

VOLUME_ID="$(jq -r '.id' "$ACT_HTTP/volumes_create.body.json")"
if [[ -z "$VOLUME_ID" || "$VOLUME_ID" == "null" ]]; then
  fail "missing volume id"
  exit 1
fi

# Seed a blob + file node directly in DB (server reads blobs/volumes/nodes from DB).
BLOB_ID="$(python3 - <<'PY'
import uuid
print(str(uuid.uuid4()))
PY
)"
NODE_ID="$(python3 - <<'PY'
import uuid
print(str(uuid.uuid4()))
PY
)"

LABEL="$(python3 - <<PY
u = "$NODE_ID".replace('-', '').lower()
print('n' + u)
PY
)"

STORAGE_KEY="blobs/${BLOB_ID}.bin"
FILE_PATH="${TMP_DIR}/${STORAGE_KEY}"
mkdir -p "$(dirname "$FILE_PATH")"

python3 - <<PY
import os
p = "$FILE_PATH"
os.makedirs(os.path.dirname(p), exist_ok=True)
with open(p, 'wb') as f:
    f.write(bytes(range(100)))
print('wrote', p)
PY

sha256sum "$FILE_PATH" | awk '{print $1}' >"$ACT_FS/blob.sha256.txt"
FILE_SHA="$(cat "$ACT_FS/blob.sha256.txt")"

SIZE_BYTES="$(stat -c '%s' "$FILE_PATH")"
if [[ "$SIZE_BYTES" != "100" ]]; then
  fail "expected seed file size 100, got $SIZE_BYTES"
  exit 1
fi

# Insert blob + node.
docker compose -f compose.yaml exec -T postgres psql -v ON_ERROR_STOP=1 -U nimbus -d ${NIMBUS_DB:-nimbus_drive} -qtAc "\
insert into blobs (id, volume_id, storage_key, sha256, size_bytes, content_type, ref_count, created_at)
values ('${BLOB_ID}'::uuid, '${VOLUME_ID}'::uuid, '${STORAGE_KEY}', '${FILE_SHA}'::char(64), ${SIZE_BYTES}::bigint, 'application/octet-stream', 1, now());
" >"$ACT_FS/psql_insert_blob.txt"

docker compose -f compose.yaml exec -T postgres psql -v ON_ERROR_STOP=1 -U nimbus -d ${NIMBUS_DB:-nimbus_drive} -qtAc "\
insert into nodes (id, type, parent_id, name, path, owner_user_id, blob_id, size_bytes, mime_type, metadata, created_at, updated_at)
values (
  '${NODE_ID}'::uuid,
  'FILE',
  '00000000-0000-0000-0000-000000000001'::uuid,
  'seed.bin',
  ('root.${LABEL}')::ltree,
  '${ADMIN_USER_ID}'::uuid,
  '${BLOB_ID}'::uuid,
  ${SIZE_BYTES}::bigint,
  'application/octet-stream',
  '{}'::jsonb,
  now(),
  now()
);
" >"$ACT_FS/psql_insert_node.txt"

# 200 (full)
curl -sS -D "$ACT_HTTP/download_full.headers.txt" -o "$ACT_HTTP/download_full.body.bin" -w "%{http_code}" \
  -H "authorization: Bearer ${ACCESS_TOKEN}" \
  "http://localhost:${PORT}/nodes/${NODE_ID}/download" \
  >"$ACT_HTTP/download_full.status.txt"

if [[ "$(cat "$ACT_HTTP/download_full.status.txt")" != "200" ]]; then
  fail "expected download full 200"
  exit 1
fi

cmp -s "$FILE_PATH" "$ACT_HTTP/download_full.body.bin" || {
  fail "full download body mismatch"
  echo "full download body mismatch" >"$ACT_HTTP/download_full.assert.txt"
  exit 1
}

# 206 (range 0-9)
curl -sS -D "$ACT_HTTP/download_range.headers.txt" -o "$ACT_HTTP/download_range.body.bin" -w "%{http_code}" \
  -H "authorization: Bearer ${ACCESS_TOKEN}" \
  -H 'Range: bytes=0-9' \
  "http://localhost:${PORT}/nodes/${NODE_ID}/download" \
  >"$ACT_HTTP/download_range.status.txt"

if [[ "$(cat "$ACT_HTTP/download_range.status.txt")" != "206" ]]; then
  fail "expected download range 206"
  exit 1
fi

RANGE_SIZE="$(stat -c '%s' "$ACT_HTTP/download_range.body.bin")"
if [[ "$RANGE_SIZE" != "10" ]]; then
  fail "expected range body size 10, got $RANGE_SIZE"
  exit 1
fi

head -c 10 "$FILE_PATH" >"$ACT_HTTP/download_range.expected.bin"
cmp -s "$ACT_HTTP/download_range.expected.bin" "$ACT_HTTP/download_range.body.bin" || {
  fail "range body content mismatch"
  exit 1
}

# 416 (range beyond file)
curl -sS -D "$ACT_HTTP/download_416.headers.txt" -o "$ACT_HTTP/download_416.body.json" -w "%{http_code}" \
  -H "authorization: Bearer ${ACCESS_TOKEN}" \
  -H 'Range: bytes=999999999-' \
  "http://localhost:${PORT}/nodes/${NODE_ID}/download" \
  >"$ACT_HTTP/download_416.status.txt" || true

if [[ "$(cat "$ACT_HTTP/download_416.status.txt")" != "416" ]]; then
  fail "expected 416"
  exit 1
fi

jq -e '.error.code and .error.message' "$ACT_HTTP/download_416.body.json" >"$ACT_HTTP/download_416.assert.txt" 2>&1

cat > "$EVID_DIR/summary.json" <<'JSON'
{
  "piece_id": "P6",
  "task_id": "P6-T1",
  "result": "PASS",
  "pass": true,
  "artifacts": {
    "actual": {
      "http": {
        "download_full_status": "actual/http/download_full.status.txt",
        "download_range_status": "actual/http/download_range.status.txt",
        "download_416_status": "actual/http/download_416.status.txt"
      },
      "fs": {
        "blob_checksum": "actual/fs/blob.sha256.txt",
        "node_insert": "actual/fs/psql_insert_node.txt"
      },
      "logs": {
        "server": "actual/logs/server.log"
      }
    },
    "cases": [
      "cases/P6-T1-DOWNLOAD-001.case.yaml"
    ],
    "expected_md": "expected.md",
    "run_sh": "run.sh"
  },
  "checks": [
    {
      "name": "download_full_200",
      "expected": "HTTP 200 + full body matches seeded file",
      "actual_path": "actual/http/download_full.status.txt",
      "pass": true
    },
    {
      "name": "download_range_206",
      "expected": "HTTP 206 + 10 bytes body matches first 10 bytes",
      "actual_path": "actual/http/download_range.status.txt",
      "pass": true
    },
    {
      "name": "download_range_416",
      "expected": "HTTP 416 for out-of-range start",
      "actual_path": "actual/http/download_416.status.txt",
      "pass": true
    }
  ]
}
JSON
 echo "[P6-T1] wrote summary.json"

rm -rf "$TMP_DIR" || true
