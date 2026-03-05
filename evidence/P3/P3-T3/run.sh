#!/usr/bin/env bash
set -euo pipefail

fail() {
  echo "[P3-T3] $1" >&2
}

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
EVID_DIR="$ROOT_DIR/evidence/P3/P3-T3"
ACT_HTTP="$EVID_DIR/actual/http"
ACT_LOGS="$EVID_DIR/actual/logs"

mkdir -p "$ACT_HTTP" "$ACT_LOGS"

cd "$ROOT_DIR"
# Ensure a clean environment.
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


server_restart_count=0
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
    echo "[P3-T3] server not running (pid=$pid) and restart budget exhausted" >&2
    return 1
  fi

  echo "[P3-T3] server not running (pid=$pid); restarting once" >&2
  server_restart_count=$((server_restart_count + 1))

  ( cd "$ROOT_DIR"; PORT="$PORT" node scripts/dev_server.mjs >"$ACT_LOGS/server.log" 2>&1 & echo $! >"$ACT_LOGS/server.pid" )
  sleep 1.0
  return 0
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
  {
    echo "expected setup/admin 201 (got $setup_status)"
    echo "--- response body ---"
    cat "$RAW_SETUP" || true
    echo "--- server log tail ---"
    tail -n 200 "$ACT_LOGS/server.log" || true
  } >"$ACT_LOGS/setup_admin_failure.txt"
  exit 1
fi

ACCESS_TOKEN="$(jq -r '.tokens.access_token' <"$RAW_SETUP")"
if [[ -z "$ACCESS_TOKEN" || "$ACCESS_TOKEN" == "null" ]]; then
  fail "missing access_token from setup/admin"
  exit 1
fi

# PATCH /admin/system-mode -> read_only=true
RAW_PATCH="$ACT_HTTP/system_mode_patch_001.body.raw.json"
PATCH_STATUS=""
for _ in {1..20}; do
  curl -sS -o "$RAW_PATCH" -w "%{http_code}" \
    -X PATCH \
    -H 'content-type: application/json' \
    -H "authorization: Bearer ${ACCESS_TOKEN}" \
    -d '{"read_only":true,"reason":"maintenance"}' \
    "http://localhost:${PORT}/admin/system-mode" \
    >"$ACT_HTTP/system_mode_patch_001.status.txt" || true
  PATCH_STATUS="$(cat "$ACT_HTTP/system_mode_patch_001.status.txt" || true)"
  if [[ "$PATCH_STATUS" == "200" ]]; then
    break
  fi
  if [[ "$PATCH_STATUS" == "000" || "$PATCH_STATUS" == 5* ]]; then
    ensure_server_alive || true
    sleep 0.2
    continue
  fi
  break

done
if [[ "$PATCH_STATUS" != "200" ]]; then
  fail "expected system-mode PATCH 200 (got $PATCH_STATUS)"
  exit 1
fi

jq -e '.read_only == true' <"$RAW_PATCH" >"$ACT_HTTP/system_mode_patch_001.assert.txt"

# GET /admin/system-mode -> read_only=true
RAW_GET="$ACT_HTTP/system_mode_get_001.body.raw.json"
GET_STATUS=""
for _ in {1..20}; do
  curl -sS -o "$RAW_GET" -w "%{http_code}" \
    -H "authorization: Bearer ${ACCESS_TOKEN}" \
    "http://localhost:${PORT}/admin/system-mode" \
    >"$ACT_HTTP/system_mode_get_001.status.txt" || true
  GET_STATUS="$(cat "$ACT_HTTP/system_mode_get_001.status.txt" || true)"
  if [[ "$GET_STATUS" == "200" ]]; then
    break
  fi
  if [[ "$GET_STATUS" == "000" || "$GET_STATUS" == 5* ]]; then
    ensure_server_alive || true
    sleep 0.2
    continue
  fi
  break

done
if [[ "$GET_STATUS" != "200" ]]; then
  fail "expected system-mode GET 200 (got $GET_STATUS)"
  exit 1
fi

jq -e '.read_only == true' <"$RAW_GET" >"$ACT_HTTP/system_mode_get_001.assert.txt"

# Mutating endpoint should be blocked while read-only
RAW_BLOCK="$ACT_HTTP/read_only_blocks_001.body.raw.json"
curl -sS -o "$RAW_BLOCK" -w "%{http_code}" \
  -H 'content-type: application/json' \
  -H "authorization: Bearer ${ACCESS_TOKEN}" \
  -d '{"name":"blocked","base_path":"/tmp"}' \
  "http://localhost:${PORT}/admin/volumes" \
  >"$ACT_HTTP/read_only_blocks_001.status.txt" || true

BLOCK_STATUS="$(cat "$ACT_HTTP/read_only_blocks_001.status.txt" || true)"
if [[ "$BLOCK_STATUS" != "409" ]]; then
  fail "expected read-only block status 409 (got $BLOCK_STATUS)"
  {
    echo "expected 409 (got $BLOCK_STATUS)"
    echo "--- response body ---"
    cat "$RAW_BLOCK" || true
  } >"$ACT_HTTP/read_only_blocks_001.assert.txt"
  exit 1
fi

echo "ok" >"$ACT_HTTP/read_only_blocks_001.assert.txt"

# PATCH /admin/system-mode -> read_only=false (cleanup)
RAW_UNPATCH="$ACT_HTTP/system_mode_patch_002.body.raw.json"
curl -sS -o "$RAW_UNPATCH" -w "%{http_code}" \
  -X PATCH \
  -H 'content-type: application/json' \
  -H "authorization: Bearer ${ACCESS_TOKEN}" \
  -d '{"read_only":false}' \
  "http://localhost:${PORT}/admin/system-mode" \
  >"$ACT_HTTP/system_mode_patch_002.status.txt" || true

UNPATCH_STATUS="$(cat "$ACT_HTTP/system_mode_patch_002.status.txt" || true)"
if [[ "$UNPATCH_STATUS" != "200" ]]; then
  fail "expected system-mode PATCH(false) 200 (got $UNPATCH_STATUS)"
  exit 1
fi

jq -e '.read_only == false' <"$RAW_UNPATCH" >"$ACT_HTTP/system_mode_patch_002.assert.txt"

# Write summary.json
python3 - <<'PY'
import json, os
# NOTE: this script runs python via stdin (no reliable __file__). Use cwd as repo root.
ROOT_DIR=os.path.abspath(os.getcwd())
EVID_DIR=os.path.join(ROOT_DIR,'evidence','P3','P3-T3')

def rel(p):
  return os.path.relpath(p, ROOT_DIR)

checks=[]
checks.append({
  'name':'patch_200_sets_read_only_true',
  'expected':'PATCH /admin/system-mode returns 200 and read_only=true',
  'actual_path':rel(os.path.join(EVID_DIR,'actual','http','system_mode_patch_001.assert.txt')),
  'pass':True,
})
checks.append({
  'name':'get_200_reads_read_only_true',
  'expected':'GET /admin/system-mode returns 200 and read_only=true',
  'actual_path':rel(os.path.join(EVID_DIR,'actual','http','system_mode_get_001.assert.txt')),
  'pass':True,
})
checks.append({
  'name':'read_only_blocks_mutation',
  'expected':'mutating endpoint is blocked with 409 while read_only=true',
  'actual_path':rel(os.path.join(EVID_DIR,'actual','http','read_only_blocks_001.assert.txt')),
  'pass':True,
})

out={
  'task_id':'P3-T3',
  'piece_id':'P3',
  'result':'PASS',
  'pass':True,
  'checks':checks,
  'artifacts':{
    'run_sh':rel(os.path.join(EVID_DIR,'run.sh')),
    'expected_md':rel(os.path.join(EVID_DIR,'expected.md')),
    'cases':[rel(os.path.join(EVID_DIR,'cases','P3-T3-SYSTEM-MODE-GET-001.case.yaml')),
             rel(os.path.join(EVID_DIR,'cases','P3-T3-SYSTEM-MODE-PATCH-001.case.yaml')),
             rel(os.path.join(EVID_DIR,'cases','P3-T3-READONLY-BLOCKS-MUTATION-001.case.yaml'))],
    'actual':{
      'http':{
        'patch_assert':rel(os.path.join(EVID_DIR,'actual','http','system_mode_patch_001.assert.txt')),
        'get_assert':rel(os.path.join(EVID_DIR,'actual','http','system_mode_get_001.assert.txt')),
        'block_assert':rel(os.path.join(EVID_DIR,'actual','http','read_only_blocks_001.assert.txt')),
      },
      'logs':{
        'server':rel(os.path.join(EVID_DIR,'actual','logs','server.log'))
      }
    }
  }
}

with open(os.path.join(EVID_DIR,'summary.json'),'w',encoding='utf-8') as f:
  json.dump(out,f,indent=2,sort_keys=True)
  f.write('\n')
print('[P3-T3] wrote summary.json')
PY
