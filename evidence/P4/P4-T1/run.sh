#!/usr/bin/env bash
set -euo pipefail

fail() {
  echo "[P4-T1] $1" >&2
}

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
EVID_DIR="$ROOT_DIR/evidence/P4/P4-T1"
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

ROOT_ID="00000000-0000-0000-0000-000000000001"

# 1) create (201)
RAW_CREATE_001="$ACT_HTTP/nodes_folders_001.body.raw.json"
curl -sS -o "$RAW_CREATE_001" -w "%{http_code}" \
  -H 'content-type: application/json' \
  -H "authorization: Bearer ${ACCESS_TOKEN}" \
  -d '{"parent_id":"'"$ROOT_ID"'","name":"Docs"}' \
  "http://localhost:${PORT}/nodes/folders" \
  >"$ACT_HTTP/nodes_folders_001.status.txt" || true

if [[ "$(cat "$ACT_HTTP/nodes_folders_001.status.txt" || true)" != "201" ]]; then
  fail "expected POST /nodes/folders 201"
  exit 1
fi

jq -e '.type=="FOLDER" and .parent_id=="'"$ROOT_ID"'" and (.id|length)>10' \
  <"$RAW_CREATE_001" >"$ACT_HTTP/nodes_folders_001.assert.txt"

# 2) duplicate (409)
RAW_CREATE_002="$ACT_HTTP/nodes_folders_002.body.raw.json"
curl -sS -o "$RAW_CREATE_002" -w "%{http_code}" \
  -H 'content-type: application/json' \
  -H "authorization: Bearer ${ACCESS_TOKEN}" \
  -d '{"parent_id":"'"$ROOT_ID"'","name":"Docs"}' \
  "http://localhost:${PORT}/nodes/folders" \
  >"$ACT_HTTP/nodes_folders_002.status.txt" || true

if [[ "$(cat "$ACT_HTTP/nodes_folders_002.status.txt" || true)" != "409" ]]; then
  fail "expected duplicate name => 409"
  exit 1
fi

jq -e '(.error.code | length) > 0' \
  <"$RAW_CREATE_002" >"$ACT_HTTP/nodes_folders_002.assert.txt"
