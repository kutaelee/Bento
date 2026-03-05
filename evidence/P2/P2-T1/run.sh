#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
EVID_DIR="$ROOT_DIR/evidence/P2/P2-T1"
ACT_HTTP="$EVID_DIR/actual/http"
ACT_LOGS="$EVID_DIR/actual/logs"

mkdir -p "$ACT_HTTP" "$ACT_LOGS"

cd "$ROOT_DIR"
docker compose -f compose.yaml up -d postgres

for _ in {1..60}; do
  if docker compose -f compose.yaml exec -T postgres pg_isready -U nimbus -d ${NIMBUS_DB:-nimbus_drive} >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

# Extra guard: wait for schema init (users table) to be queryable.
for _ in {1..60}; do
  if docker compose -f compose.yaml exec -T postgres psql -U nimbus -d ${NIMBUS_DB:-nimbus_drive} -tAc "SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='users'" 2>/dev/null | grep -q 1; then
    break
  fi
  sleep 1
done

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

for _ in {1..20}; do
  if curl -sSf "http://localhost:${PORT}/health" >/dev/null 2>&1; then
    break
  fi
  sleep 0.1
done

if ! command -v jq >/dev/null 2>&1; then
  echo "jq is required" >"$ACT_LOGS/jq_missing.txt"
  exit 1
fi

# Seed initial admin
RAW_SETUP="$ACT_HTTP/setup_admin.body.raw.json"

curl -sS -o "$RAW_SETUP" -w "%{http_code}" \
  -H 'content-type: application/json' \
  -d '{"username":"admin","password":"CorrectHorseBatteryStaple","display_name":"Admin","locale":"en-US"}' \
  "http://localhost:${PORT}/setup/admin" \
  >"$ACT_HTTP/setup_admin.status.txt"

if [[ "$(cat "$ACT_HTTP/setup_admin.status.txt")" != "201" ]]; then
  echo "expected setup/admin 201" >"$ACT_HTTP/setup_admin.assert.txt"
  cat "$RAW_SETUP" >>"$ACT_HTTP/setup_admin.assert.txt" || true
  exit 1
fi

# Redact dynamic values for deterministic evidence
jq \
  '(.user.id)="REDACTED" |
   (.user.created_at)="REDACTED" |
   (.user.last_login_at)="REDACTED" |
   (.tokens.access_token)="REDACTED" |
   (.tokens.refresh_token)="REDACTED"' \
  "$RAW_SETUP" >"$ACT_HTTP/setup_admin.body.json"
rm -f "$RAW_SETUP"

# 1) login success
RAW_LOGIN="$ACT_HTTP/login_001.body.raw.json"

curl -sS -o "$RAW_LOGIN" -w "%{http_code}" \
  -H 'content-type: application/json' \
  -d '{"username":"admin","password":"CorrectHorseBatteryStaple"}' \
  "http://localhost:${PORT}/auth/login" \
  >"$ACT_HTTP/login_001.status.txt"

STATUS_1="$(cat "$ACT_HTTP/login_001.status.txt")"
if [[ "$STATUS_1" != "200" ]]; then
  echo "expected status 200, got $STATUS_1" >"$ACT_HTTP/login_001.assert.txt"
  exit 1
fi

jq -e '.user.id and (.user.username=="admin") and (.user.role=="ADMIN") and (.user.locale=="en-US") and (.user.created_at|type=="string")' \
  "$RAW_LOGIN" >"$ACT_HTTP/login_001.assert.txt" 2>&1
jq -e '.tokens.token_type=="Bearer" and (.tokens.access_token|type=="string") and (.tokens.refresh_token|type=="string") and (.tokens.expires_in_seconds|type=="number")' \
  "$RAW_LOGIN" >>"$ACT_HTTP/login_001.assert.txt" 2>&1

jq \
  '(.user.id)="REDACTED" |
   (.user.created_at)="REDACTED" |
   (.user.last_login_at)="REDACTED" |
   (.tokens.access_token)="REDACTED" |
   (.tokens.refresh_token)="REDACTED"' \
  "$RAW_LOGIN" >"$ACT_HTTP/login_001.body.json"
rm -f "$RAW_LOGIN"

# 2) wrong password
curl -sS -o "$ACT_HTTP/login_002.body.json" -w "%{http_code}" \
  -H 'content-type: application/json' \
  -d '{"username":"admin","password":"WrongPassword123"}' \
  "http://localhost:${PORT}/auth/login" \
  >"$ACT_HTTP/login_002.status.txt"

STATUS_2="$(cat "$ACT_HTTP/login_002.status.txt")"
if [[ "$STATUS_2" != "401" ]]; then
  echo "expected status 401, got $STATUS_2" >"$ACT_HTTP/login_002.assert.txt"
  exit 1
fi

jq -e '.error.code and .error.message' "$ACT_HTTP/login_002.body.json" >"$ACT_HTTP/login_002.assert.txt" 2>&1
