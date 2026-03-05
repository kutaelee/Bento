#!/usr/bin/env bash
set -euo pipefail

fail() {
  echo "[P12-T1] $1" >&2
}

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
EVID_DIR="$ROOT_DIR/evidence/P12/P12-T1"
ACT_HTTP="$EVID_DIR/actual/http"
ACT_LOGS="$EVID_DIR/actual/logs"

mkdir -p "$ACT_HTTP" "$ACT_LOGS"

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

VOLUME_PATH="/tmp/nimbus-volume-migration-${PORT}"
mkdir -p "$VOLUME_PATH"

RAW_VOLUME="$ACT_HTTP/volume_create.body.raw.json"
VOLUME_STATUS="$(curl -sS -o "$RAW_VOLUME" -w "%{http_code}" \
  -H "authorization: Bearer ${ACCESS_TOKEN}" \
  -H "content-type: application/json" \
  -d "{\"name\":\"Migration Target\",\"base_path\":\"${VOLUME_PATH}\"}" \
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

RAW_MIGRATION="$ACT_HTTP/migration_create.body.raw.json"
MIGRATION_STATUS="$(curl -sS -o "$RAW_MIGRATION" -w "%{http_code}" \
  -H "authorization: Bearer ${ACCESS_TOKEN}" \
  -H "content-type: application/json" \
  -d "{\"target_volume_id\":\"${VOLUME_ID}\",\"verify_sha256\":true,\"delete_source_after\":false}" \
  "http://localhost:${PORT}/admin/migrations" || true)"
echo "$MIGRATION_STATUS" >"$ACT_HTTP/migration_create.status.txt"
if [[ "$MIGRATION_STATUS" != "202" ]]; then
  fail "expected /admin/migrations 202 (got $MIGRATION_STATUS)"
  exit 1
fi

JOB_ID="$(jq -r '.id' <"$RAW_MIGRATION")"
if [[ -z "$JOB_ID" || "$JOB_ID" == "null" ]]; then
  fail "missing job id"
  exit 1
fi

JOB_STATE=""
for _ in {1..40}; do
  RAW_JOB="$ACT_HTTP/job_status.body.raw.json"
  JOB_STATUS_CODE="$(curl -sS -o "$RAW_JOB" -w "%{http_code}" \
    -H "authorization: Bearer ${ACCESS_TOKEN}" \
    "http://localhost:${PORT}/jobs/${JOB_ID}" || true)"
  echo "$JOB_STATUS_CODE" >"$ACT_HTTP/job_status.status.txt"
  if [[ "$JOB_STATUS_CODE" != "200" ]]; then
    fail "expected /jobs/{id} 200 (got $JOB_STATUS_CODE)"
    exit 1
  fi
  JOB_STATE="$(jq -r '.status' <"$RAW_JOB")"
  if [[ "$JOB_STATE" == "SUCCEEDED" ]]; then
    break
  fi
  sleep 0.2
done

if [[ "$JOB_STATE" != "SUCCEEDED" ]]; then
  fail "expected job to reach SUCCEEDED (last=$JOB_STATE)"
  exit 1
fi

python3 - <<'PY'
import json, os
out = {
  'piece_id': 'P12',
  'task_id': 'P12-T1',
  'result': 'PASS',
  'pass': True,
  'checks': [
    {
      'name': 'migration_job_created',
      'expected': 'POST /admin/migrations returns 202 with job payload',
      'actual_path': 'evidence/P12/P12-T1/actual/http/migration_create.body.raw.json',
      'pass': True,
    },
    {
      'name': 'migration_job_completed',
      'expected': 'GET /jobs/{job_id} reaches SUCCEEDED',
      'actual_path': 'evidence/P12/P12-T1/actual/http/job_status.body.raw.json',
      'pass': True,
    },
  ],
  'artifacts': {
    'run_sh': 'evidence/P12/P12-T1/run.sh',
    'expected_md': 'evidence/P12/P12-T1/expected.md',
    'cases': [
      'evidence/P12/P12-T1/cases/P12-T1-MIGRATION-001.case.yaml',
      'evidence/P12/P12-T1/cases/P12-T1-MIGRATION-002.case.yaml',
    ],
    'actual': {
      'http': {
        'migration_create': 'evidence/P12/P12-T1/actual/http/migration_create.body.raw.json',
        'job_status': 'evidence/P12/P12-T1/actual/http/job_status.body.raw.json',
      },
      'logs': {
        'server': 'evidence/P12/P12-T1/actual/logs/server.log',
      }
    }
  }
}
path = os.path.join('evidence','P12','P12-T1','summary.json')
os.makedirs(os.path.dirname(path), exist_ok=True)
with open(path,'w',encoding='utf-8') as f:
  json.dump(out,f,indent=2,sort_keys=True)
  f.write('\n')
print('wrote', path)
PY
