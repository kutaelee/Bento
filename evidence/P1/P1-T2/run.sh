#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
EVID_DIR="$ROOT_DIR/evidence/P1/P1-T2"
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

# Ensure a clean DB for this task
# WARNING: evidence environment only.
if [[ -z "${EVIDENCE_REUSE_DB:-}" ]]; then docker compose -f compose.yaml down -v >/dev/null 2>&1 || true; fi
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

# Case 1
RAW1="$ACT_HTTP/setup_admin_001.body.raw.json"

curl -sS -o "$RAW1" -w "%{http_code}" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin1234!","display_name":"Admin","locale":"ko-KR"}' \
  "http://localhost:${PORT}/setup/admin" \
  >"$ACT_HTTP/setup_admin_001.status.txt"

STATUS1="$(cat "$ACT_HTTP/setup_admin_001.status.txt")"
if [[ "$STATUS1" != "201" ]]; then
  echo "expected status 201, got $STATUS1" >"$ACT_HTTP/setup_admin_001.assert.txt"
  exit 1
fi

# Assertions are performed against the raw response.
jq -e '.user.username == "admin"' "$RAW1" >"$ACT_HTTP/setup_admin_001.assert.txt" 2>&1
jq -e '.user.role == "ADMIN"' "$RAW1" >>"$ACT_HTTP/setup_admin_001.assert.txt" 2>&1
jq -e '.tokens.token_type == "Bearer"' "$RAW1" >>"$ACT_HTTP/setup_admin_001.assert.txt" 2>&1
jq -e '(.tokens.access_token | length) > 20' "$RAW1" >>"$ACT_HTTP/setup_admin_001.assert.txt" 2>&1
jq -e '(.tokens.refresh_token | length) > 20' "$RAW1" >>"$ACT_HTTP/setup_admin_001.assert.txt" 2>&1

# Persist a redacted body to keep evidence deterministic and avoid committing secrets.
jq \
  '(.user.id)="REDACTED" |
   (.user.created_at)="REDACTED" |
   (.tokens.access_token)="REDACTED" |
   (.tokens.refresh_token)="REDACTED"' \
  "$RAW1" >"$ACT_HTTP/setup_admin_001.body.json"
rm -f "$RAW1"

# Case 2
curl -sS -o "$ACT_HTTP/setup_admin_002.body.json" -w "%{http_code}" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin2","password":"admin1234!"}' \
  "http://localhost:${PORT}/setup/admin" \
  >"$ACT_HTTP/setup_admin_002.status.txt"

STATUS2="$(cat "$ACT_HTTP/setup_admin_002.status.txt")"
if [[ "$STATUS2" != "409" ]]; then
  echo "expected status 409, got $STATUS2" >"$ACT_HTTP/setup_admin_002.assert.txt"
  exit 1
fi
jq -e '.error.code == "SETUP_ALREADY_COMPLETED"' "$ACT_HTTP/setup_admin_002.body.json" >"$ACT_HTTP/setup_admin_002.assert.txt" 2>&1
