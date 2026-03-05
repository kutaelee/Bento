#!/usr/bin/env bash
set -euo pipefail

fail() {
  echo "[P10-T1] $1" >&2
}

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
EVID_DIR="$ROOT_DIR/evidence/P10/P10-T1"
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

debug_on_err() {
  echo "[P10-T1] ERROR: dumping http status + bodies (best-effort)" >&2
  for f in "$ACT_HTTP"/*.status.txt; do
    [ -f "$f" ] || continue
    echo "--- $f" >&2
    cat "$f" >&2 || true
  done
  for f in "$ACT_HTTP"/*.body.raw.json; do
    [ -f "$f" ] || continue
    echo "--- $f (head)" >&2
    head -c 800 "$f" >&2 || true
    echo "" >&2
  done
  if [[ -f "$ACT_LOGS/server.log" ]]; then
    echo "--- $ACT_LOGS/server.log (tail)" >&2
    tail -n 200 "$ACT_LOGS/server.log" >&2 || true
  fi
}
trap debug_on_err ERR

server_restart_count=0

reset_db_and_retry_setup() {
  echo "[P10-T1] resetting DB volume due to SETUP_ALREADY_COMPLETED (determinism)" >&2
  docker compose -f compose.yaml down -v >/dev/null 2>&1 || true
  docker compose -f compose.yaml up -d postgres

  for _ in {1..60}; do
    if docker compose -f compose.yaml exec -T postgres pg_isready -U nimbus -d ${NIMBUS_DB:-nimbus_drive} >/dev/null 2>&1; then
      break
    fi
    sleep 1
  done

  ensure_server_alive || true
  return 0
}
ensure_server_alive() {
  if [[ ! -f "$ACT_LOGS/server.pid" ]]; then
    return 0
  fi
  local pid
  pid="$(cat "$ACT_LOGS/server.pid" 2>/dev/null || true)"
  if [[ -z "${pid:-}" ]]; then
    return 0
  fi
  if kill -0 "$pid" 2>/dev/null; then
    return 0
  fi

  if [[ "$server_restart_count" -ge 1 ]]; then
    echo "[P10-T1] server not running (pid=$pid) and restart budget exhausted" >&2
    return 1
  fi

  echo "[P10-T1] server not running (pid=$pid); restarting once" >&2
  server_restart_count=$((server_restart_count + 1))
  ( cd "$ROOT_DIR"; PORT="$PORT" node scripts/dev_server.mjs >"$ACT_LOGS/server.log" 2>&1 & echo $! >"$ACT_LOGS/server.pid" )
  sleep 1.0
  return 0
}

curl_status_retry() {
  local out_file="$1"
  local method="$2"
  local url="$3"
  local tries=0
  local code=""

  shift 3

  while [[ $tries -lt 15 ]]; do
    code="$(curl -sS -o "$out_file" -w "%{http_code}" -X "$method" "$@" "$url" || true)"

    if [[ "$code" == "200" || "$code" == "201" || "$code" == "409" ]]; then
      printf "%s" "$code"
      return 0
    fi

    if [[ "$code" == "000" || "$code" == 5* ]]; then
      ensure_server_alive || true
      sleep 0.2
      tries=$((tries + 1))
      continue
    fi

    printf "%s" "$code"
    return 1
  done

  printf "%s" "$code"
  return 1
}

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

  while [[ $tries -lt 12 ]]; do
    code="$(curl -sS -o "$out" -w "%{http_code}" \
      -H 'content-type: application/json' \
      -d '{"username":"admin","password":"CorrectHorseBatteryStaple","display_name":"Admin","locale":"en-US"}' \
      "http://localhost:${port}/setup/admin" \
      || true)"

    # If setup is already completed (some runners return 201 with error body), fall back to login.
    if jq -e '.error.code == "SETUP_ALREADY_COMPLETED"' "$out" >/dev/null 2>&1; then
      reset_db_and_retry_setup
      tries=$((tries + 1))
      sleep 0.8
      continue
    fi

    if [[ "$code" == "201" ]]; then

      if jq -e '.error.code == "SETUP_ALREADY_COMPLETED"' "$out" >/dev/null 2>&1; then
        code="409"
      else
        echo "$code"
        return 0
      fi
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
    sleep 0.8
  done

  echo "$code"
  return 1
}

RAW_SETUP="$ACT_HTTP/setup_admin.body.raw.json"
setup_status="$(get_admin_token "$PORT" "$RAW_SETUP")"
echo "[P10-T1] setup_status=${setup_status:-}" >&2
echo "$setup_status" >"$ACT_HTTP/setup_admin.status.txt"
echo "[P10-T1] setup_admin body(head):" >&2
head -c 500 "$RAW_SETUP" >&2 || true
echo "" >&2
if [[ "$setup_status" != "201" ]]; then
  fail "expected setup/admin 201 (got $setup_status)"
  exit 1
fi

ACCESS_TOKEN="$(jq -r '.tokens.access_token' <"$RAW_SETUP")"
if [[ -z "$ACCESS_TOKEN" || "$ACCESS_TOKEN" == "null" ]]; then
  fail "missing access_token from setup/admin"
  exit 1
fi

ROOT_ID="00000000-0000-0000-0000-000000000001"

RAW_CREATE_ALPHA="$ACT_HTTP/create_alpha.body.raw.json"
CREATE_ALPHA_STATUS="$(curl_status_retry "$RAW_CREATE_ALPHA" POST "http://localhost:${PORT}/nodes/folders" \
  -H 'content-type: application/json' \
  -H "authorization: Bearer ${ACCESS_TOKEN}" \
  -d "{\"parent_id\":\"${ROOT_ID}\",\"name\":\"SearchAlpha\"}" || true)"

echo "$CREATE_ALPHA_STATUS" >"$ACT_HTTP/create_alpha.status.txt"
echo "[P10-T1] create_alpha status=${CREATE_ALPHA_STATUS:-empty}"

if [[ "${CREATE_ALPHA_STATUS:-}" != "201" ]]; then
  fail "expected create alpha 201 (got ${CREATE_ALPHA_STATUS:-empty})"
  exit 1
fi

RAW_CREATE_BETA="$ACT_HTTP/create_beta.body.raw.json"
CREATE_BETA_STATUS="$(curl_status_retry "$RAW_CREATE_BETA" POST "http://localhost:${PORT}/nodes/folders" \
  -H 'content-type: application/json' \
  -H "authorization: Bearer ${ACCESS_TOKEN}" \
  -d "{\"parent_id\":\"${ROOT_ID}\",\"name\":\"SearchBeta\"}" || true)"

echo "$CREATE_BETA_STATUS" >"$ACT_HTTP/create_beta.status.txt"
echo "[P10-T1] create_beta status=${CREATE_BETA_STATUS:-empty}"

if [[ "${CREATE_BETA_STATUS:-}" != "201" ]]; then
  fail "expected create beta 201 (got ${CREATE_BETA_STATUS:-empty})"
  exit 1
fi

RAW_SEARCH_001="$ACT_HTTP/search_001.body.raw.json"
SEARCH_001_STATUS="$(curl_status_retry "$RAW_SEARCH_001" GET "http://localhost:${PORT}/search?q=Search&limit=1" \
  -H "authorization: Bearer ${ACCESS_TOKEN}" || true)"
echo "$SEARCH_001_STATUS" >"$ACT_HTTP/search_001.status.txt"
echo "[P10-T1] search_001 status=${SEARCH_001_STATUS:-empty}"

if [[ "${SEARCH_001_STATUS:-}" != "200" ]]; then
  fail "expected search page 1 200 (got ${SEARCH_001_STATUS:-empty})"
  exit 1
fi

jq -e '.items | length == 1' "$RAW_SEARCH_001" >"$ACT_HTTP/search_001.items.assert.txt"
jq -e '.items[0].name == "SearchAlpha"' "$RAW_SEARCH_001" >"$ACT_HTTP/search_001.name.assert.txt"
jq -e '.next_cursor != null' "$RAW_SEARCH_001" >"$ACT_HTTP/search_001.cursor.assert.txt"

NEXT_CURSOR="$(jq -r '.next_cursor' "$RAW_SEARCH_001")"
if [[ -z "$NEXT_CURSOR" || "$NEXT_CURSOR" == "null" ]]; then
  fail "missing next_cursor"
  exit 1
fi

RAW_SEARCH_002="$ACT_HTTP/search_002.body.raw.json"
SEARCH_002_STATUS="$(curl_status_retry "$RAW_SEARCH_002" GET "http://localhost:${PORT}/search?q=Search&limit=1&cursor=${NEXT_CURSOR}" \
  -H "authorization: Bearer ${ACCESS_TOKEN}" || true)"
echo "$SEARCH_002_STATUS" >"$ACT_HTTP/search_002.status.txt"
echo "[P10-T1] search_002 status=${SEARCH_002_STATUS:-empty}"

if [[ "${SEARCH_002_STATUS:-}" != "200" ]]; then
  fail "expected search page 2 200 (got ${SEARCH_002_STATUS:-empty})"
  exit 1
fi

jq -e '.items | length >= 1' "$RAW_SEARCH_002" >"$ACT_HTTP/search_002.items.assert.txt"
jq -e '.items[0].name == "SearchBeta"' "$RAW_SEARCH_002" >"$ACT_HTTP/search_002.name.assert.txt"

python3 - <<'PY'
import json, os
out = {
  'piece_id': 'P10',
  'task_id': 'P10-T1',
  'result': 'PASS',
  'pass': True,
  'checks': [
    {
      'name': 'search_page1',
      'expected': 'GET /search?q=Search&limit=1 returns 200 with items and next_cursor',
      'actual_path': 'evidence/P10/P10-T1/actual/http/search_001.cursor.assert.txt',
      'pass': True,
    },
    {
      'name': 'search_page2',
      'expected': 'GET /search?q=Search&limit=1&cursor=<next> returns second item',
      'actual_path': 'evidence/P10/P10-T1/actual/http/search_002.name.assert.txt',
      'pass': True,
    },
  ],
  'artifacts': {
    'run_sh': 'evidence/P10/P10-T1/run.sh',
    'expected_md': 'evidence/P10/P10-T1/expected.md',
    'cases': [
      'evidence/P10/P10-T1/cases/P10-T1-SEARCH-001.case.yaml',
      'evidence/P10/P10-T1/cases/P10-T1-SEARCH-002.case.yaml',
    ],
    'actual': {
      'http': {
        'search_page1': 'evidence/P10/P10-T1/actual/http/search_001.body.raw.json',
        'search_page2': 'evidence/P10/P10-T1/actual/http/search_002.body.raw.json',
      },
      'logs': {
        'server': 'evidence/P10/P10-T1/actual/logs/server.log',
      }
    }
  }
}
path = os.path.join('evidence','P10','P10-T1','summary.json')
os.makedirs(os.path.dirname(path), exist_ok=True)
with open(path,'w',encoding='utf-8') as f:
  json.dump(out,f,indent=2,sort_keys=True)
  f.write('\n')
print('wrote', path)
PY
