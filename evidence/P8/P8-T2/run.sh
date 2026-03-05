#!/usr/bin/env bash
set -euo pipefail

fail() {
  echo "[P8-T2] $1" >&2
}

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
EVID_DIR="$ROOT_DIR/evidence/P8/P8-T2"
ACT_HTTP="$EVID_DIR/actual/http"
ACT_FS="$EVID_DIR/actual/fs"
ACT_LOGS="$EVID_DIR/actual/logs"

mkdir -p "$ACT_HTTP" "$ACT_FS" "$ACT_LOGS"
cd "$ROOT_DIR"

cleanup_stale_servers() {
  local stale_pids
  stale_pids="$(pgrep -af "node scripts/dev_server.mjs" | awk '{print $1}' || true)"

  if [[ -n "$stale_pids" ]]; then
    echo "[P8-T2] stale dev_server process detected; stopping before evidence run" >&2
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

pg_ready=""
for _ in {1..60}; do
  if docker compose -f compose.yaml exec -T postgres pg_isready -U nimbus -d ${NIMBUS_DB:-nimbus_drive} >/dev/null 2>&1; then
    pg_ready="yes"
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

# Seed initial admin
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
ADMIN_USER_ID="$(jq -r '.user.id' <"$RAW_SETUP")"
if [[ -z "$ACCESS_TOKEN" || "$ACCESS_TOKEN" == "null" ]]; then
  fail "missing access token from setup/admin"
  exit 1
fi
if [[ -z "$ADMIN_USER_ID" || "$ADMIN_USER_ID" == "null" ]]; then
  fail "missing user.id from setup/admin"
  exit 1
fi



docker_psql_retry() {
  local sql="$1"
  local out=""
  for _ in {1..50}; do
    if out="$(docker compose -f compose.yaml exec -T postgres psql -v ON_ERROR_STOP=1 -U nimbus -d ${NIMBUS_DB:-nimbus_drive} -qtAc "$sql" 2>&1)"; then
      printf "%s\n" "$out"
      return 0
    fi
    if printf "%s" "$out" | grep -q "the database system is starting up"; then
      sleep 0.2
      continue
    fi
    printf "%s\n" "$out" >&2
    return 1
  done
  echo "psql did not become ready in time" >&2
  return 1
}
# Ensure deterministic root node exists for direct DB seeding below.
docker_psql_retry "insert into nodes (id, type, parent_id, name, path, owner_user_id, size_bytes, metadata, created_at, updated_at, deleted_at)values ('00000000-0000-0000-0000-000000000001'::uuid, 'FOLDER', NULL, 'root', 'root'::ltree, '${ADMIN_USER_ID}'::uuid, 0, '{}'::jsonb, now(), now(), NULL)on conflict (id) do update  set type='FOLDER', parent_id=NULL, name='root', path='root'::ltree, owner_user_id=EXCLUDED.owner_user_id, size_bytes=0, metadata='{}'::jsonb, updated_at=now(), deleted_at=NULL;"

# Create volume (needed for blob path resolution)
TMP_DIR="$(mktemp -d -t nimbus-share-public-XXXXXX)"
VOLUME_NAME="data"

curl -sS -o "$ACT_HTTP/volumes_create.body.json" -w "%{http_code}" \
  -H "authorization: Bearer ${ACCESS_TOKEN}" \
  -H 'content-type: application/json' \
  -d "{\"name\":\"${VOLUME_NAME}\",\"base_path\":\"${TMP_DIR}\"}" \
  "http://localhost:${PORT}/admin/volumes" \
  >"$ACT_HTTP/volumes_create.status.txt" || true

if [[ "$(cat "$ACT_HTTP/volumes_create.status.txt" || true)" != "201" ]]; then
  fail "expected volumes create 201"
  exit 1
fi

VOLUME_ID="$(jq -r '.id' <"$ACT_HTTP/volumes_create.body.json")"
if [[ -z "$VOLUME_ID" || "$VOLUME_ID" == "null" ]]; then
  fail "missing volume id"
  exit 1
fi

# Seed a blob + file node directly in DB
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
    f.write(b'hello-share-public-' + bytes(range(10)))
print('wrote', p)
PY

sha256sum "$FILE_PATH" | awk '{print $1}' >"$ACT_FS/blob.sha256.txt"
FILE_SHA="$(cat "$ACT_FS/blob.sha256.txt")"
SIZE_BYTES="$(stat -c '%s' "$FILE_PATH")"

if [[ "$SIZE_BYTES" -lt "10" ]]; then
  fail "expected seed file size >= 10"
  exit 1
fi

# Insert blob + node.
docker_psql_retry "\
insert into blobs (id, volume_id, storage_key, sha256, size_bytes, content_type, ref_count, created_at)
values ('${BLOB_ID}'::uuid, '${VOLUME_ID}'::uuid, '${STORAGE_KEY}', '${FILE_SHA}'::char(64), ${SIZE_BYTES}::bigint, 'application/octet-stream', 1, now());
" >"$ACT_FS/psql_insert_blob.txt"

docker_psql_retry "\
insert into nodes (id, type, parent_id, name, path, owner_user_id, blob_id, size_bytes, mime_type, metadata, created_at, updated_at)
values (
  '${NODE_ID}'::uuid,
  'FILE',
  '00000000-0000-0000-0000-000000000001'::uuid,
  'shared.bin',
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

# Create share without password
RAW_SHARE_PUBLIC="$ACT_HTTP/share_public_create.body.raw.json"
curl -sS -o "$RAW_SHARE_PUBLIC" -w "%{http_code}" \
  -H 'content-type: application/json' \
  -H "authorization: Bearer ${ACCESS_TOKEN}" \
  -d '{"expires_in_seconds":604800,"permission":"READ"}' \
  "http://localhost:${PORT}/nodes/${NODE_ID}/share-links" \
  >"$ACT_HTTP/share_public_create.status.txt" || true

if [[ "$(cat "$ACT_HTTP/share_public_create.status.txt" || true)" != "201" ]]; then
  fail "expected share-links (public) create 201"
  exit 1
fi
TOKEN_PUBLIC="$(jq -r '.token' <"$RAW_SHARE_PUBLIC")"
if [[ -z "$TOKEN_PUBLIC" || "$TOKEN_PUBLIC" == "null" ]]; then
  fail "missing token for public share"
  exit 1
fi

# Create share with password
RAW_SHARE_PW="$ACT_HTTP/share_pw_create.body.raw.json"
curl -sS -o "$RAW_SHARE_PW" -w "%{http_code}" \
  -H 'content-type: application/json' \
  -H "authorization: Bearer ${ACCESS_TOKEN}" \
  -d '{"expires_in_seconds":604800,"password":"sharepass","permission":"READ"}' \
  "http://localhost:${PORT}/nodes/${NODE_ID}/share-links" \
  >"$ACT_HTTP/share_pw_create.status.txt" || true

if [[ "$(cat "$ACT_HTTP/share_pw_create.status.txt" || true)" != "201" ]]; then
  fail "expected share-links (password) create 201"
  exit 1
fi
TOKEN_PW="$(jq -r '.token' <"$RAW_SHARE_PW")"
if [[ -z "$TOKEN_PW" || "$TOKEN_PW" == "null" ]]; then
  fail "missing token for password share"
  exit 1
fi

# Public GET metadata (no password)
curl -sS -o "$ACT_HTTP/public_meta.body.json" -w "%{http_code}" \
  "http://localhost:${PORT}/s/${TOKEN_PUBLIC}" \
  >"$ACT_HTTP/public_meta.status.txt" || true

# Password-required GET metadata (missing header => 403)
curl -sS -o "$ACT_HTTP/pw_meta_missing.body.json" -w "%{http_code}" \
  "http://localhost:${PORT}/s/${TOKEN_PW}" \
  >"$ACT_HTTP/pw_meta_missing.status.txt" || true

# Password-required GET metadata (with header => 200)
curl -sS -o "$ACT_HTTP/pw_meta_ok.body.json" -w "%{http_code}" \
  -H 'X-Share-Password: sharepass' \
  "http://localhost:${PORT}/s/${TOKEN_PW}" \
  >"$ACT_HTTP/pw_meta_ok.status.txt" || true

# Invalid route guard for share links
curl -sS -o /dev/null -w "%{http_code}" "http://localhost:${PORT}/s/${TOKEN_PUBLIC}/download/extra" >"$ACT_HTTP/public_share_invalid_download.status.txt" || true
curl -sS -o /dev/null -w "%{http_code}" "http://localhost:${PORT}/s/${TOKEN_PUBLIC}/abc" >"$ACT_HTTP/public_share_invalid_path.status.txt" || true

# Download with range (public share)
DL_PATH="$ACT_FS/public_download_range.bin"
curl -sS -o "$DL_PATH" -w "%{http_code}" \
  -H 'Range: bytes=0-9' \
  "http://localhost:${PORT}/s/${TOKEN_PUBLIC}/download" \
  >"$ACT_HTTP/public_download_range.status.txt" || true

# Download requires password (missing => 403)
curl -sS -o "$ACT_FS/pw_download_missing.bin" -w "%{http_code}" \
  "http://localhost:${PORT}/s/${TOKEN_PW}/download" \
  >"$ACT_HTTP/pw_download_missing.status.txt" || true

# Download requires password (ok => 206)
curl -sS -o "$ACT_FS/pw_download_range.bin" -w "%{http_code}" \
  -H 'X-Share-Password: sharepass' \
  -H 'Range: bytes=0-9' \
  "http://localhost:${PORT}/s/${TOKEN_PW}/download" \
  >"$ACT_HTTP/pw_download_range.status.txt" || true

PASS1=false
PASS2=false
PASS3=false
PASS4=false
PASS5=false
PASS6=false
PASS7=false
PASS8=false

if [[ "$(cat "$ACT_HTTP/public_meta.status.txt" || true)" == "200" ]]; then PASS1=true; fi
if [[ "$(cat "$ACT_HTTP/pw_meta_missing.status.txt" || true)" == "403" ]]; then PASS2=true; fi
if [[ "$(cat "$ACT_HTTP/pw_meta_ok.status.txt" || true)" == "200" ]]; then PASS3=true; fi
if [[ "$(cat "$ACT_HTTP/public_download_range.status.txt" || true)" == "206" ]]; then PASS4=true; fi
if [[ "$(cat "$ACT_HTTP/pw_download_missing.status.txt" || true)" == "403" ]]; then PASS5=true; fi
if [[ "$(cat "$ACT_HTTP/pw_download_range.status.txt" || true)" == "206" ]]; then PASS6=true; fi
if [[ "$(cat "$ACT_HTTP/public_share_invalid_download.status.txt" || true)" == "404" ]]; then PASS7=true; fi
if [[ "$(cat "$ACT_HTTP/public_share_invalid_path.status.txt" || true)" == "404" ]]; then PASS8=true; fi

# Ensure the ranged downloads are correct length
RANGE_LEN_PUBLIC="$(stat -c '%s' "$DL_PATH" 2>/dev/null || echo 0)"
if [[ "$RANGE_LEN_PUBLIC" != "10" ]]; then
  PASS4=false
fi

if [[ "$PASS1" != "true" || "$PASS2" != "true" || "$PASS3" != "true" || "$PASS4" != "true" || "$PASS5" != "true" || "$PASS6" != "true" || "$PASS7" != "true" || "$PASS8" != "true" ]]; then
  fail "one or more checks failed"
  cat > "$EVID_DIR/summary.json" <<JSON
{
  "piece_id": "P8",
  "task_id": "P8-T2",
  "result": "FAIL",
  "pass": false,
  "checks": [
    {"name":"public_meta_200","expected":"GET /s/{token} without password returns 200","actual_path":"evidence/P8/P8-T2/actual/http/public_meta.status.txt","pass": $PASS1},
    {"name":"pw_meta_missing_403","expected":"GET /s/{token} missing password returns 403","actual_path":"evidence/P8/P8-T2/actual/http/pw_meta_missing.status.txt","pass": $PASS2},
    {"name":"pw_meta_ok_200","expected":"GET /s/{token} with password returns 200","actual_path":"evidence/P8/P8-T2/actual/http/pw_meta_ok.status.txt","pass": $PASS3},
    {"name":"public_download_range_206","expected":"GET /s/{token}/download Range returns 206 and 10 bytes","actual_path":"evidence/P8/P8-T2/actual/http/public_download_range.status.txt","pass": $PASS4},
    {"name":"pw_download_missing_403","expected":"GET /s/{token}/download missing password returns 403","actual_path":"evidence/P8/P8-T2/actual/http/pw_download_missing.status.txt","pass": $PASS5},
    {"name":"pw_download_range_206","expected":"GET /s/{token}/download with password Range returns 206","actual_path":"evidence/P8/P8-T2/actual/http/pw_download_range.status.txt","pass": $PASS6},
    {"name":"public_share_invalid_download_404","expected":"GET /s/{token}/download/extra returns 404","actual_path":"evidence/P8/P8-T2/actual/http/public_share_invalid_download.status.txt","pass": $PASS7},
    {"name":"public_share_invalid_path_404","expected":"GET /s/{token}/abc returns 404","actual_path":"evidence/P8/P8-T2/actual/http/public_share_invalid_path.status.txt","pass": $PASS8}
  ]
}
JSON
  exit 1
fi

cat > "$EVID_DIR/summary.json" <<'JSON'
{
  "piece_id": "P8",
  "task_id": "P8-T2",
  "result": "PASS",
  "pass": true,
  "checks": [
    {"name":"public_meta_200","expected":"GET /s/{token} without password returns 200","actual_path":"evidence/P8/P8-T2/actual/http/public_meta.status.txt","pass": true},
    {"name":"pw_meta_missing_403","expected":"GET /s/{token} missing password returns 403","actual_path":"evidence/P8/P8-T2/actual/http/pw_meta_missing.status.txt","pass": true},
    {"name":"pw_meta_ok_200","expected":"GET /s/{token} with password returns 200","actual_path":"evidence/P8/P8-T2/actual/http/pw_meta_ok.status.txt","pass": true},
    {"name":"public_download_range_206","expected":"GET /s/{token}/download Range returns 206 and 10 bytes","actual_path":"evidence/P8/P8-T2/actual/http/public_download_range.status.txt","pass": true},
    {"name":"pw_download_missing_403","expected":"GET /s/{token}/download missing password returns 403","actual_path":"evidence/P8/P8-T2/actual/http/pw_download_missing.status.txt","pass": true},
    {"name":"pw_download_range_206","expected":"GET /s/{token}/download with password Range returns 206","actual_path":"evidence/P8/P8-T2/actual/http/pw_download_range.status.txt","pass": true},
    {"name":"public_share_invalid_download_404","expected":"GET /s/{token}/download/extra returns 404","actual_path":"evidence/P8/P8-T2/actual/http/public_share_invalid_download.status.txt","pass": true},
    {"name":"public_share_invalid_path_404","expected":"GET /s/{token}/abc returns 404","actual_path":"evidence/P8/P8-T2/actual/http/public_share_invalid_path.status.txt","pass": true}
  ],
  "artifacts": {
    "cases": [
      "evidence/P8/P8-T2/cases/P8-T2-SHARES-001.case.yaml"
    ],
    "run_sh": "evidence/P8/P8-T2/run.sh",
    "expected_md": "evidence/P8/P8-T2/expected.md",
    "actual": {
      "http": {
        "public_meta": "evidence/P8/P8-T2/actual/http/public_meta.status.txt",
        "pw_meta_missing": "evidence/P8/P8-T2/actual/http/pw_meta_missing.status.txt",
        "pw_meta_ok": "evidence/P8/P8-T2/actual/http/pw_meta_ok.status.txt",
        "public_download_range": "evidence/P8/P8-T2/actual/http/public_download_range.status.txt",
        "pw_download_missing": "evidence/P8/P8-T2/actual/http/pw_download_missing.status.txt",
        "pw_download_range": "evidence/P8/P8-T2/actual/http/pw_download_range.status.txt",
        "public_share_invalid_download_404": "evidence/P8/P8-T2/actual/http/public_share_invalid_download.status.txt",
        "public_share_invalid_path_404": "evidence/P8/P8-T2/actual/http/public_share_invalid_path.status.txt"
      },
      "logs": {
        "server": "evidence/P8/P8-T2/actual/logs/server.log"
      }
    }
  }
}
JSON
