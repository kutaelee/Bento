#!/usr/bin/env bash
set -euo pipefail

fail() {
  echo "[P12-T2] $1" >&2
}

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
EVID_DIR="$ROOT_DIR/evidence/P12/P12-T2"
export EVID_DIR
ACT_HTTP="$EVID_DIR/actual/http"
ACT_LOGS="$EVID_DIR/actual/logs"
ACT_FS="$EVID_DIR/actual/fs"

mkdir -p "$ACT_HTTP" "$ACT_LOGS" "$ACT_FS"

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
  fail "postgres did not become ready in time"
  docker compose -f compose.yaml logs --tail 200 postgres || true
  exit 1
fi

PORT="$(python3 - <<'PY'
import socket
s=socket.socket(); s.bind(('',0)); print(s.getsockname()[1]); s.close()
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
  fail "server did not become ready in time"
  tail -n 200 "$ACT_LOGS/server.log" >"$ACT_LOGS/server_not_ready_tail.txt" 2>/dev/null || true
  exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
  fail "jq is required"
  exit 1
fi

get_admin_token() {
  local port="$1"
  local out="$2"
  local tries=0
  local code=""
  local login_out="${out%.json}.login.json"

  while [[ $tries -lt 6 ]]; do
    code="$(curl -sS -o "$out" -w "%{http_code}" \
      -H 'content-type: application/json' \
      -d '{"username":"admin","password":"CorrectHorseBatteryStaple","display_name":"Admin","locale":"en-US"}' \
      "http://localhost:${port}/setup/admin" \
      || true)"

    if [[ "$code" == "201" ]]; then
      echo "$code"
      return 0
    fi

    if [[ "$code" == "409" ]]; then
      login_code="$(curl -sS -o "$login_out" -w "%{http_code}" \
        -H 'content-type: application/json' \
        -d '{"username":"admin","password":"CorrectHorseBatteryStaple"}' \
        "http://localhost:${port}/auth/login" \
        || true)"
      if [[ "$login_code" == "200" ]]; then
        cp "$login_out" "$out"
        echo 201
        return 0
      fi
    fi

    tries=$((tries + 1))
    sleep 0.5
  done

  echo "$code"
  return 1
}

RAW_SETUP="$ACT_HTTP/setup_admin.body.raw.json"
setup_status="$(get_admin_token "$PORT" "$RAW_SETUP")"
echo "$setup_status" >"$ACT_HTTP/setup_admin.status.txt"
if [[ "$setup_status" != "201" ]]; then
  fail "expected setup/admin 201 (got $setup_status)"
  exit 1
fi

ACCESS_TOKEN="$(jq -r '.tokens.access_token' <"$RAW_SETUP")"
if [[ -z "$ACCESS_TOKEN" || "$ACCESS_TOKEN" == "null" ]]; then
  fail "missing access_token from setup/admin"
  exit 1
fi

VOLUME_PATH="/tmp/nimbus-volume-scan-${PORT}"
mkdir -p "$VOLUME_PATH"

RAW_VOLUME="$ACT_HTTP/volume_create.body.raw.json"
VOLUME_STATUS="$(curl -sS -o "$RAW_VOLUME" -w "%{http_code}" \
  -H "authorization: Bearer ${ACCESS_TOKEN}" \
  -H "content-type: application/json" \
  -d "{\"name\":\"Scan Volume\",\"base_path\":\"${VOLUME_PATH}\"}" \
  "http://localhost:${PORT}/admin/volumes" || true)"
echo "$VOLUME_STATUS" >"$ACT_HTTP/volume_create.status.txt"
if [[ "$VOLUME_STATUS" != "201" ]]; then
  fail "expected /admin/volumes 201 (got $VOLUME_STATUS)"
  exit 1
fi

VOLUME_ID="$(jq -r '.id' <"$RAW_VOLUME")"
if [[ -z "$VOLUME_ID" || "$VOLUME_ID" == "null" ]]; then
  fail "missing volume id"
  exit 1
fi

docker compose -f compose.yaml exec -T postgres psql -U nimbus -d ${NIMBUS_DB:-nimbus_drive} -c "update volumes set is_active=false; update volumes set is_active=true where id='${VOLUME_ID}';" >/dev/null

mkdir -p "$VOLUME_PATH/blobs/aa" "$VOLUME_PATH/blobs/bb" "$VOLUME_PATH/blobs/ff"

echo "orphan" >"$VOLUME_PATH/blobs/aa/orphan.bin"
echo "keep" >"$VOLUME_PATH/blobs/ff/keep.bin"

KEEP_SHA="$(sha256sum "$VOLUME_PATH/blobs/ff/keep.bin" | awk '{print $1}')"
KEEP_SIZE="$(stat -c %s "$VOLUME_PATH/blobs/ff/keep.bin")"
MISSING_SHA="$(echo -n "missing" | sha256sum | awk '{print $1}')"

KEEP_ID="$(python3 - <<'PY'
import uuid; print(uuid.uuid4())
PY
)"
MISSING_ID="$(python3 - <<'PY'
import uuid; print(uuid.uuid4())
PY
)"

docker compose -f compose.yaml exec -T postgres psql -U nimbus -d ${NIMBUS_DB:-nimbus_drive} -c "\
insert into blobs (id, volume_id, storage_key, sha256, size_bytes, content_type, ref_count, created_at)
values ('${KEEP_ID}', '${VOLUME_ID}', 'blobs/ff/keep.bin', '${KEEP_SHA}', ${KEEP_SIZE}, 'application/octet-stream', 0, now());
insert into blobs (id, volume_id, storage_key, sha256, size_bytes, content_type, ref_count, created_at)
values ('${MISSING_ID}', '${VOLUME_ID}', 'blobs/bb/missing.bin', '${MISSING_SHA}', 7, 'application/octet-stream', 0, now());
" >/dev/null

RAW_SCAN1="$ACT_HTTP/scan_1.body.raw.json"
SCAN1_STATUS="$(curl -sS -o "$RAW_SCAN1" -w "%{http_code}" \
  -H "authorization: Bearer ${ACCESS_TOKEN}" \
  -H "content-type: application/json" \
  -d '{"delete_orphan_files":false,"delete_orphan_db_rows":false}' \
  "http://localhost:${PORT}/admin/storage/scan" || true)"
echo "$SCAN1_STATUS" >"$ACT_HTTP/scan_1.status.txt"
if [[ "$SCAN1_STATUS" != "202" ]]; then
  fail "expected /admin/storage/scan 202 (got $SCAN1_STATUS)"
  exit 1
fi

JOB1_ID="$(jq -r '.id' <"$RAW_SCAN1")"
if [[ -z "$JOB1_ID" || "$JOB1_ID" == "null" ]]; then
  fail "missing job id for scan 1"
  exit 1
fi

JOB1_STATE=""
for _ in {1..40}; do
  RAW_JOB1="$ACT_HTTP/job_1.body.raw.json"
  JOB1_STATUS_CODE="$(curl -sS -o "$RAW_JOB1" -w "%{http_code}" \
    -H "authorization: Bearer ${ACCESS_TOKEN}" \
    "http://localhost:${PORT}/jobs/${JOB1_ID}" || true)"
  echo "$JOB1_STATUS_CODE" >"$ACT_HTTP/job_1.status.txt"
  if [[ "$JOB1_STATUS_CODE" != "200" ]]; then
    fail "expected /jobs/{id} 200 (got $JOB1_STATUS_CODE)"
    exit 1
  fi
  JOB1_STATE="$(jq -r '.status' <"$RAW_JOB1")"
  if [[ "$JOB1_STATE" == "SUCCEEDED" ]]; then
    break
  fi
  sleep 0.2
done

if [[ "$JOB1_STATE" != "SUCCEEDED" ]]; then
  fail "expected scan job to reach SUCCEEDED (last=$JOB1_STATE)"
  exit 1
fi

if ! jq -e '.result.orphan_files | index("blobs/aa/orphan.bin") != null' <"$RAW_JOB1" >/dev/null; then
  fail "expected orphan file to be reported"
  exit 1
fi

if ! jq -e '.result.orphan_db_rows | map(.storage_key) | index("blobs/bb/missing.bin") != null' <"$RAW_JOB1" >/dev/null; then
  fail "expected orphan db row to be reported"
  exit 1
fi

if [[ ! -f "$VOLUME_PATH/blobs/aa/orphan.bin" ]]; then
  fail "orphan file should remain when delete_orphan_files=false"
  exit 1
fi

RAW_SCAN2="$ACT_HTTP/scan_2.body.raw.json"
SCAN2_STATUS="$(curl -sS -o "$RAW_SCAN2" -w "%{http_code}" \
  -H "authorization: Bearer ${ACCESS_TOKEN}" \
  -H "content-type: application/json" \
  -d '{"delete_orphan_files":true,"delete_orphan_db_rows":false}' \
  "http://localhost:${PORT}/admin/storage/scan" || true)"
echo "$SCAN2_STATUS" >"$ACT_HTTP/scan_2.status.txt"
if [[ "$SCAN2_STATUS" != "202" ]]; then
  fail "expected /admin/storage/scan 202 (got $SCAN2_STATUS)"
  exit 1
fi

JOB2_ID="$(jq -r '.id' <"$RAW_SCAN2")"
if [[ -z "$JOB2_ID" || "$JOB2_ID" == "null" ]]; then
  fail "missing job id for scan 2"
  exit 1
fi

JOB2_STATE=""
for _ in {1..40}; do
  RAW_JOB2="$ACT_HTTP/job_2.body.raw.json"
  JOB2_STATUS_CODE="$(curl -sS -o "$RAW_JOB2" -w "%{http_code}" \
    -H "authorization: Bearer ${ACCESS_TOKEN}" \
    "http://localhost:${PORT}/jobs/${JOB2_ID}" || true)"
  echo "$JOB2_STATUS_CODE" >"$ACT_HTTP/job_2.status.txt"
  if [[ "$JOB2_STATUS_CODE" != "200" ]]; then
    fail "expected /jobs/{id} 200 (got $JOB2_STATUS_CODE)"
    exit 1
  fi
  JOB2_STATE="$(jq -r '.status' <"$RAW_JOB2")"
  if [[ "$JOB2_STATE" == "SUCCEEDED" ]]; then
    break
  fi
  sleep 0.2
done

if [[ "$JOB2_STATE" != "SUCCEEDED" ]]; then
  fail "expected scan job to reach SUCCEEDED (last=$JOB2_STATE)"
  exit 1
fi

if [[ -f "$VOLUME_PATH/blobs/aa/orphan.bin" ]]; then
  fail "expected orphan file to be deleted when delete_orphan_files=true"
  exit 1
fi

DELETED_FILES="$(jq -r '.result.deleted_files' <"$RAW_JOB2")"
if [[ -z "$DELETED_FILES" || "$DELETED_FILES" == "null" || "$DELETED_FILES" -lt 1 ]]; then
  fail "expected deleted_files >= 1"
  exit 1
fi

python3 - <<'PY'
import json, os
out = {
  'piece_id': 'P12',
  'task_id': 'P12-T2',
  'result': 'PASS',
  'pass': True,
  'artifacts': {
    'expected_md': 'evidence/P12/P12-T2/expected.md',
    'run_sh': 'evidence/P12/P12-T2/run.sh',
    'cases': [
      'evidence/P12/P12-T2/cases/P12-T2-SCAN-001.case.yaml',
      'evidence/P12/P12-T2/cases/P12-T2-SCAN-002.case.yaml',
    ],
    'actual': {
      'http': {
        'scan_1': 'evidence/P12/P12-T2/actual/http/scan_1.body.raw.json',
        'job_1': 'evidence/P12/P12-T2/actual/http/job_1.body.raw.json',
        'scan_2': 'evidence/P12/P12-T2/actual/http/scan_2.body.raw.json',
        'job_2': 'evidence/P12/P12-T2/actual/http/job_2.body.raw.json',
      },
      'logs': {
        'server': 'evidence/P12/P12-T2/actual/logs/server.log',
      }
    }
  },
  'checks': [
    {
      'name': 'scan_orphan_reported',
      'expected': 'orphan files/rows are reported when delete flags false',
      'actual_path': 'evidence/P12/P12-T2/actual/http/job_1.body.raw.json',
      'pass': True,
    },
    {
      'name': 'scan_orphan_deleted',
      'expected': 'orphan file deleted when delete_orphan_files=true',
      'actual_path': 'evidence/P12/P12-T2/actual/http/job_2.body.raw.json',
      'pass': True,
    },
  ],
}
with open(os.path.join(os.environ['EVID_DIR'], 'summary.json'), 'w') as f:
  json.dump(out, f, indent=2)
PY
