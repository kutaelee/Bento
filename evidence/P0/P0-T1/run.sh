#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
EVID_DIR="$ROOT_DIR/evidence/P0/P0-T1"
ACT_HTTP="$EVID_DIR/actual/http"
ACT_LOGS="$EVID_DIR/actual/logs"

mkdir -p "$ACT_HTTP" "$ACT_LOGS"

# Local CI parity preflight for cron/manual runs.
if [[ -z "${CI:-}" && -x "$ROOT_DIR/scripts/ci_local.sh" ]]; then
  bash "$ROOT_DIR/scripts/ci_local.sh" --preflight --container-if-available
fi

# 1) OpenAPI lint/validate
(
  cd "$ROOT_DIR"
  LINT_JSON="$ACT_LOGS/lint.json"
  LINT_ERR="$ACT_LOGS/lint.err"
  LINT_CLEAN="$ACT_LOGS/lint.clean.out"

  set +e
  npx -y @redocly/cli@2.20.3 lint --config .redocly.yaml --format json openapi/openapi.yaml >"$LINT_JSON" 2>"$LINT_ERR"
  REDOCLY_RC=$?
  set -e

  # Normalize human-readable lint output (strip ANSI + CR) for evidence artifact.
  if ! sed -E $'s/\x1B\[[0-9;]*[A-Za-z]//g; s/\r$//' "$LINT_ERR" >"$LINT_CLEAN"; then
    cp "$LINT_ERR" "$LINT_CLEAN"
  fi

  # Parse machine output once (single-source gate).
  PARSED="$(python3 - <<'PY' "$LINT_JSON"
import json, sys
p = sys.argv[1]
errors = 1
warnings = 'n/a'
try:
    data = json.load(open(p, 'r', encoding='utf-8'))
    totals = data.get('totals', {}) if isinstance(data, dict) else {}
    errors = int(totals.get('errors', 0))
    warnings = str(totals.get('warnings', 'n/a'))
except Exception:
    pass
print(f"{errors} {warnings}")
PY
)"
  ERROR_COUNT="${PARSED%% *}"
  WARNINGS="${PARSED#* }"

  VALID_MARKER=0
  if [[ "$ERROR_COUNT" == "0" ]]; then
    VALID_MARKER=1
  fi

  echo "[P0-T1] sha=$(git rev-parse --short HEAD)" >&2
  echo "[P0-T1] redocly_rc=${REDOCLY_RC}" >&2
  echo "[P0-T1] valid_marker=${VALID_MARKER} warnings=${WARNINGS}" >&2

  # Deterministic artifact for evidence checks.
  if ! sed -E "s/validated in [0-9]+ms/validated in Xms/g" "$LINT_CLEAN" >"$ACT_LOGS/openapi_lint.txt"; then
    cp "$LINT_CLEAN" "$ACT_LOGS/openapi_lint.txt"
  fi

  # Gate rule (single SSOT): fail only on lint errors.
  if [[ "$ERROR_COUNT" != "0" ]]; then
    exit "${REDOCLY_RC:-1}"
  fi
)

# 2) Start minimal server for /health on a random free port
PORT="$(python3 - <<'PY'
import socket
s = socket.socket()
s.bind(('', 0))
port = s.getsockname()[1]
s.close()
print(port)
PY
)"
# Use a fixed RUN_ID so evidence artifacts are deterministic.
# The server is invoked with RUN_ID and echoes it back in /health.
RUN_ID="00000000-0000-0000-0000-000000000000"
(
  cd "$ROOT_DIR"
  PORT="$PORT" RUN_ID="$RUN_ID" node scripts/dev_server.mjs \
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
}
trap cleanup EXIT

# Wait for server to accept connections (max ~10s; GH runners can be slower)
READY=0
for _ in {1..100}; do
  if curl -sSf "http://localhost:${PORT}/health" >/dev/null 2>&1; then
    READY=1
    break
  fi
  sleep 0.1
done

if [[ "$READY" != "1" ]]; then
  {
    echo "server did not become ready in time"
    echo "port=$PORT"
    echo "--- tail(server.log) ---"
    tail -n 200 "$ACT_LOGS/server.log" 2>/dev/null || true
  } >"$ACT_LOGS/server_start_failed.txt"
  exit 1
fi

# 3) Capture health response (status + body)
curl -sS -o "$ACT_HTTP/health.body.json" -w "%{http_code}" \
  "http://localhost:${PORT}/health" \
  >"$ACT_HTTP/health.status.txt"

# 4) Assert status=200 and body via jq (CLI gate)
if ! command -v jq >/dev/null 2>&1; then
  echo "jq is required" >"$ACT_LOGS/jq_missing.txt"
  exit 1
fi

STATUS="$(cat "$ACT_HTTP/health.status.txt")"
if [[ "$STATUS" != "200" ]]; then
  echo "expected status 200, got $STATUS" >"$ACT_HTTP/health.assert.txt"
  exit 1
fi

# Overwrite (not append) so the evidence output is deterministic across runs
jq -e --arg run_id "$RUN_ID" '.ok == true and .run_id == $run_id' \
  "$ACT_HTTP/health.body.json" \
  >"$ACT_HTTP/health.assert.txt" 2>&1
