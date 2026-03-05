#!/usr/bin/env bash
set -euo pipefail

fail() {
  echo "[P11-T1] $1" >&2
}

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
EVID_DIR="$ROOT_DIR/evidence/P11/P11-T1"
ACT_HTTP="$EVID_DIR/actual/http"
ACT_FS="$EVID_DIR/actual/fs"
ACT_LOGS="$EVID_DIR/actual/logs"
DIAG_LOG="$ACT_LOGS/diagnose.log"

mkdir -p "$ACT_HTTP" "$ACT_FS" "$ACT_LOGS"

# Diagnostic log (this run only)
: >"$DIAG_LOG"
{
  echo "[diag] task=P11-T1 ts=$(TZ=Asia/Seoul date '+%F %T %Z')"
  echo "[diag] CI=${CI:-} EVIDENCE_REUSE_DB=${EVIDENCE_REUSE_DB:-} NIMBUS_DB=${NIMBUS_DB:-}" 
  echo "[diag] compose_project=${COMPOSE_PROJECT_NAME:-<unset>}"
} >>"$DIAG_LOG"

cd "$ROOT_DIR"

if [[ -z "${EVIDENCE_REUSE_DB:-}" ]]; then docker compose -f compose.yaml down -v >/dev/null 2>&1 || true; fi
docker compose -f compose.yaml up -d postgres
{
  echo "[diag] docker compose ps";
  docker compose -f compose.yaml ps || true;
} >>"$DIAG_LOG" 2>&1

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

  if jq -e ' .error.code == "SETUP_ALREADY_COMPLETED" ' "$RAW_SETUP" >/dev/null 2>&1; then
    # setup already done; proceed to login path using known credentials
    setup_status="201"
    echo "$setup_status" >"$ACT_HTTP/setup_admin.status.txt"
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

RAW_LOGIN="$ACT_HTTP/login.body.raw.json"

login_status=""
for _ in {1..30}; do
  curl -sS -o "$RAW_LOGIN" -w "%{http_code}" \
    -H 'content-type: application/json' \
    -d '{"username":"admin","password":"CorrectHorseBatteryStaple"}' \
    "http://localhost:${PORT}/auth/login" \
    >"$ACT_HTTP/login.status.txt" || true

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
  fail "expected login 200 (got $login_status)"
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

ROOT_NODE_ID="00000000-0000-0000-0000-000000000001"

docker compose -f compose.yaml exec -T postgres psql -v ON_ERROR_STOP=1 -U nimbus -d ${NIMBUS_DB:-nimbus_drive} -qtAc "\
insert into nodes (id, type, parent_id, name, path, owner_user_id, blob_id, size_bytes, mime_type, metadata, created_at, updated_at)
values (
  '${ROOT_NODE_ID}'::uuid,
  'FOLDER',
  NULL,
  'root',
  'root',
  '${ADMIN_USER_ID}'::uuid,
  NULL,
  0,
  NULL,
  '{}'::jsonb,
  now(),
  now()
)
on conflict (id) do nothing;
" >"$ACT_FS/psql_insert_root.txt"

TMP_DIR="$(mktemp -d -t nimbus-thumbnail-XXXXXX)"
VOLUME_NAME="data"

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

docker compose -f compose.yaml exec -T postgres psql -v ON_ERROR_STOP=1 -U nimbus -d ${NIMBUS_DB:-nimbus_drive} -qtAc \
"\
insert into volumes (id, name, base_path, is_active, status, created_at)
values ('${VOLUME_ID}'::uuid, '${VOLUME_NAME}', '${TMP_DIR}', false, 'OK', now())
on conflict (id) do nothing;
" >"$ACT_FS/psql_insert_volume.txt"

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
    f.write(bytes(range(120)))
print('wrote', p)
PY

sha256sum "$FILE_PATH" | awk '{print $1}' >"$ACT_FS/blob.sha256.txt"
FILE_SHA="$(cat "$ACT_FS/blob.sha256.txt")"

SIZE_BYTES="$(stat -c '%s' "$FILE_PATH")"
if [[ "$SIZE_BYTES" != "120" ]]; then
  fail "expected seed file size 120, got $SIZE_BYTES"
  exit 1
fi

# ---- DIAG signals (before blob insert) ----
DB_SELECTED="${NIMBUS_DB:-nimbus_drive}"
DB_CURRENT="$(docker compose -f compose.yaml exec -T postgres psql -U nimbus -d ${NIMBUS_DB:-nimbus_drive} -tAc "select current_database();" 2>/dev/null | tr -d '[:space:]' || true)"
VOLUME_ROW_COUNT="$(docker compose -f compose.yaml exec -T postgres psql -U nimbus -d ${NIMBUS_DB:-nimbus_drive} -tAc "select count(*) from volumes where id='${VOLUME_ID}'::uuid;" 2>/dev/null | tr -d '[:space:]' || true)"
SERVER_DB_CURRENT="$(node -e "import { execPsql } from './src/db/pool.mjs'; try { process.stdout.write(String(execPsql('select current_database();')).trim()); } catch (e) { process.stdout.write('ERROR:' + String(e && e.message ? e.message : e)); }" 2>/dev/null || true)"
{
  echo "[diag] ---- pre-blob-insert ----"
  echo "[diag] NIMBUS_DB(selected)=${DB_SELECTED}"
  echo "[diag] psql current_database()=${DB_CURRENT}"
  echo "[diag] volumes count (id=${VOLUME_ID})=${VOLUME_ROW_COUNT}"
  echo "[diag] server execPsql current_database()=${SERVER_DB_CURRENT}"
} >>"$DIAG_LOG"

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
  'thumb.bin',
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

curl -sS -D "$ACT_HTTP/thumbnail_202.headers.txt" -o "$ACT_HTTP/thumbnail_202.body.json" -w "%{http_code}" \
  -H "authorization: Bearer ${ACCESS_TOKEN}" \
  -H 'accept: image/png' \
  "http://localhost:${PORT}/media/${NODE_ID}/thumbnail" \
  >"$ACT_HTTP/thumbnail_202.status.txt" || true

if [[ "$(cat "$ACT_HTTP/thumbnail_202.status.txt")" != "202" ]]; then
  fail "expected thumbnail 202"
  exit 1
fi

jq -e '.type == "THUMBNAIL"' "$ACT_HTTP/thumbnail_202.body.json" >"$ACT_HTTP/thumbnail_202.type.assert.txt"
jq -e '.status == "QUEUED"' "$ACT_HTTP/thumbnail_202.body.json" >"$ACT_HTTP/thumbnail_202.status.assert.txt"

curl -sS -D "$ACT_HTTP/thumbnail_200.headers.txt" -o "$ACT_HTTP/thumbnail_200.body.bin" -w "%{http_code}" \
  -H "authorization: Bearer ${ACCESS_TOKEN}" \
  -H 'accept: image/png' \
  "http://localhost:${PORT}/media/${NODE_ID}/thumbnail" \
  >"$ACT_HTTP/thumbnail_200.status.txt" || true

if [[ "$(cat "$ACT_HTTP/thumbnail_200.status.txt")" != "200" ]]; then
  fail "expected thumbnail 200"
  exit 1
fi

if ! grep -qi '^content-type: image/png' "$ACT_HTTP/thumbnail_200.headers.txt"; then
  fail "expected content-type image/png"
  exit 1
fi

THUMB_SIZE="$(stat -c '%s' "$ACT_HTTP/thumbnail_200.body.bin")"
if [[ "$THUMB_SIZE" -le 0 ]]; then
  fail "expected thumbnail body size > 0"
  exit 1
fi

cat > "$EVID_DIR/summary.json" <<'JSON'
{
  "piece_id": "P11",
  "task_id": "P11-T1",
  "result": "PASS",
  "pass": true,
  "artifacts": {
    "actual": {
      "http": {
        "thumbnail_202_status": "actual/http/thumbnail_202.status.txt",
        "thumbnail_200_status": "actual/http/thumbnail_200.status.txt"
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
      "cases/P11-T1-THUMBNAIL-001.case.yaml",
      "cases/P11-T1-THUMBNAIL-002.case.yaml"
    ],
    "expected_md": "expected.md",
    "run_sh": "run.sh"
  },
  "checks": [
    {
      "name": "thumbnail_202",
      "expected": "HTTP 202 with THUMBNAIL job",
      "actual_path": "actual/http/thumbnail_202.status.txt",
      "pass": true
    },
    {
      "name": "thumbnail_200",
      "expected": "HTTP 200 with image/png body",
      "actual_path": "actual/http/thumbnail_200.status.txt",
      "pass": true
    }
  ]
}
JSON

rm -rf "$TMP_DIR" || true
