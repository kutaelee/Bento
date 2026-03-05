#!/usr/bin/env bash
set -euo pipefail

fail() {
  echo "[P3-T1] $1" >&2
}

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
EVID_DIR="$ROOT_DIR/evidence/P3/P3-T1"
ACT_HTTP="$EVID_DIR/actual/http"
ACT_LOGS="$EVID_DIR/actual/logs"

mkdir -p "$ACT_HTTP" "$ACT_LOGS"

cd "$ROOT_DIR"
# Ensure a clean environment (CI runners can leave compose resources around between tasks).
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
  echo "postgres did not become ready in time" >&2
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
  PORT="$PORT" node scripts/dev_server.mjs \
    >"$ACT_LOGS/server.log" 2>&1 &
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

# Wait for server readiness. CI runners can be slow; be generous but still bounded.
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
  echo "server did not become ready in time" >"$ACT_LOGS/server_not_ready.txt"
  tail -n 200 "$ACT_LOGS/server.log" >"$ACT_LOGS/server_not_ready_tail.txt" 2>/dev/null || true
  exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
  fail "jq is required"
  echo "jq is required" >"$ACT_LOGS/jq_missing.txt"
  exit 1
fi

# Seed initial admin
RAW_SETUP="$ACT_HTTP/setup_admin.body.raw.json"

# CI can hit a small race where /health is OK but the DB/migrations aren’t quite
# ready to accept /setup/admin yet. Retry briefly on transient failures.
setup_status=""
for _ in {1..50}; do
  curl -sS -o "$RAW_SETUP" -w "%{http_code}" \
    -H 'content-type: application/json' \
    -d '{"username":"admin","password":"CorrectHorseBatteryStaple","display_name":"Admin","locale":"en-US"}' \
    "http://localhost:${PORT}/setup/admin" \
    >"$ACT_HTTP/setup_admin.status.txt"

  setup_status="$(cat "$ACT_HTTP/setup_admin.status.txt" || true)"
  if [[ "$setup_status" == "201" ]]; then
    break
  fi

  # Retry only on curl transport failure or 5xx.
  if [[ "$setup_status" == "000" || "$setup_status" == 5* ]]; then
    sleep 0.2
    continue
  fi

  break
done

if [[ "$setup_status" != "201" ]]; then
  # Setup may already be completed if the docker volume persists unexpectedly.
  # Evidence expects a clean environment; treat as failure with useful logs.
  fail "expected setup/admin 201 (got $setup_status)"
  {
    echo "expected setup/admin 201 (got $setup_status)"
    echo "--- response body ---"
    cat "$RAW_SETUP" || true
    echo "--- server log tail ---"
    tail -n 200 "$ACT_LOGS/server.log" 2>/dev/null || true
  } >"$ACT_HTTP/setup_admin.assert.txt"
  exit 1
fi

# Login as admin
RAW_LOGIN="$ACT_HTTP/login.body.raw.json"
login_status=""
for _ in {1..20}; do
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
  fail "expected login 200"
  echo "expected login 200" >"$ACT_HTTP/login.assert.txt"
  cat "$RAW_LOGIN" >>"$ACT_HTTP/login.assert.txt" || true
  exit 1
fi

ACCESS_TOKEN="$(jq -r '.tokens.access_token' "$RAW_LOGIN")"
if [[ -z "$ACCESS_TOKEN" || "$ACCESS_TOKEN" == "null" ]]; then
  fail "missing tokens.access_token"
  echo "missing tokens.access_token" >"$ACT_HTTP/login.assert.txt"
  exit 1
fi

# Case 1: invalid path => 400
curl -sS -o "$ACT_HTTP/validate_path_001.body.json" -w "%{http_code}" \
  -H "authorization: Bearer ${ACCESS_TOKEN}" \
  -H 'content-type: application/json' \
  -d '{"base_path":"/this/path/should/not/exist"}' \
  "http://localhost:${PORT}/admin/volumes/validate-path" \
  >"$ACT_HTTP/validate_path_001.status.txt"

STATUS_1="$(cat "$ACT_HTTP/validate_path_001.status.txt")"
if [[ "$STATUS_1" != "400" ]]; then
  fail "expected status 400, got $STATUS_1"
  echo "expected status 400, got $STATUS_1" >"$ACT_HTTP/validate_path_001.assert.txt"
  cat "$ACT_HTTP/validate_path_001.body.json" >>"$ACT_HTTP/validate_path_001.assert.txt" || true
  exit 1
fi

jq -e '.error.code and .error.message' \
  "$ACT_HTTP/validate_path_001.body.json" >"$ACT_HTTP/validate_path_001.assert.txt" 2>&1

# Case 2: writable temp dir => 200
TMP_DIR="$(mktemp -d -t nimbus-volume-validate-XXXXXX)"

curl -sS -o "$ACT_HTTP/validate_path_002.body.json" -w "%{http_code}" \
  -H "authorization: Bearer ${ACCESS_TOKEN}" \
  -H 'content-type: application/json' \
  -d "{\"base_path\":\"${TMP_DIR}\"}" \
  "http://localhost:${PORT}/admin/volumes/validate-path" \
  >"$ACT_HTTP/validate_path_002.status.txt"

STATUS_2="$(cat "$ACT_HTTP/validate_path_002.status.txt")"
if [[ "$STATUS_2" != "200" ]]; then
  fail "expected status 200, got $STATUS_2"
  echo "expected status 200, got $STATUS_2" >"$ACT_HTTP/validate_path_002.assert.txt"
  cat "$ACT_HTTP/validate_path_002.body.json" >>"$ACT_HTTP/validate_path_002.assert.txt" || true
  exit 1
fi

jq -e '.ok==true and .writable==true and (.free_bytes>=0) and (.total_bytes>=0)' \
  "$ACT_HTTP/validate_path_002.body.json" >"$ACT_HTTP/validate_path_002.assert.txt" 2>&1

rm -rf "$TMP_DIR" || true

python3 - <<'PY'
import json, os
out = {
  'piece_id': 'P3',
  'task_id': 'P3-T1',
  'result': 'PASS',
  'pass': True,
  'checks': [
    {
      'name': 'invalid_path_400',
      'expected': 'Non-existent or permission-denied path returns 400 + ErrorResponse',
      'actual_path': 'evidence/P3/P3-T1/actual/http/validate_path_001.assert.txt',
      'pass': True,
    },
    {
      'name': 'valid_path_200',
      'expected': 'Valid writable directory returns 200 + {ok:true,writable:true,free_bytes,total_bytes}',
      'actual_path': 'evidence/P3/P3-T1/actual/http/validate_path_002.assert.txt',
      'pass': True,
    },
  ],
  'artifacts': {
    'run_sh': 'evidence/P3/P3-T1/run.sh',
    'expected_md': 'evidence/P3/P3-T1/expected.md',
    'cases': [
      'evidence/P3/P3-T1/cases/P3-T1-VOLUME-VALIDATE-PATH-001.case.yaml',
      'evidence/P3/P3-T1/cases/P3-T1-VOLUME-VALIDATE-PATH-002.case.yaml',
    ],
    'actual': {
      'http': {
        'invalid_assert': 'evidence/P3/P3-T1/actual/http/validate_path_001.assert.txt',
        'valid_assert': 'evidence/P3/P3-T1/actual/http/validate_path_002.assert.txt',
      },
      'logs': {
        'server': 'evidence/P3/P3-T1/actual/logs/server.log',
      }
    }
  }
}
path = os.path.join('evidence','P3','P3-T1','summary.json')
os.makedirs(os.path.dirname(path), exist_ok=True)
with open(path,'w',encoding='utf-8') as f:
  json.dump(out,f,indent=2,sort_keys=True)
  f.write('\n')
print('wrote', path)
PY
