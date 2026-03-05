#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
EVID_DIR="$ROOT_DIR/evidence/P1/P1-T1"
ACT_HTTP="$EVID_DIR/actual/http"
ACT_LOGS="$EVID_DIR/actual/logs"

mkdir -p "$ACT_HTTP" "$ACT_LOGS"

# Start postgres via compose (required for /setup/status DB check)
cd "$ROOT_DIR"
docker compose -f compose.yaml up -d postgres

# Wait for postgres readiness
for _ in {1..60}; do
  if docker compose -f compose.yaml exec -T postgres pg_isready -U nimbus -d ${NIMBUS_DB:-nimbus_drive} >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

# Extra guard: pg_isready can be optimistic during startup on some runners.
# Require a real SQL round-trip and wait for schema init to complete.
for _ in {1..60}; do
  if docker compose -f compose.yaml exec -T postgres psql -U nimbus -d ${NIMBUS_DB:-nimbus_drive} -tAc "SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='users'" 2>/dev/null | grep -q 1; then
    break
  fi
  sleep 1
done

# Start minimal server on a random free port
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

# Wait for server
for _ in {1..20}; do
  if curl -sSf "http://localhost:${PORT}/setup/status" >/dev/null 2>&1; then
    break
  fi
  sleep 0.1
done

# Capture response
curl -sS -o "$ACT_HTTP/setup_status.body.json" -w "%{http_code}" \
  "http://localhost:${PORT}/setup/status" \
  >"$ACT_HTTP/setup_status.status.txt"

# Assertions
if ! command -v jq >/dev/null 2>&1; then
  echo "jq is required" >"$ACT_LOGS/jq_missing.txt"
  exit 1
fi

STATUS="$(cat "$ACT_HTTP/setup_status.status.txt")"
if [[ "$STATUS" != "200" ]]; then
  echo "expected status 200, got $STATUS" >"$ACT_HTTP/setup_status.assert.txt"
  exit 1
fi

jq -e '.setup_required == true' "$ACT_HTTP/setup_status.body.json" \
  >"$ACT_HTTP/setup_status.assert.txt" 2>&1
