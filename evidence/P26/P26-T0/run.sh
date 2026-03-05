#!/usr/bin/env bash
set -euo pipefail

TASK_ID="P26-T0"
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
SUMMARY="$ROOT/evidence/P26/P26-T0/summary.json"
LOG="$ROOT/evidence/P26/P26-T0/actual.log"

fail() {
  local msg="$1"
  cat > "$SUMMARY" <<JSON
{
  "taskId": "$TASK_ID",
  "result": "FAIL",
  "pass": false,
  "rootCause": "$msg"
}
JSON
  echo "[$TASK_ID] FAIL: $msg"
  exit 1
}

if pnpm -C "$ROOT/packages/ui" run test:visual:config >"$LOG" 2>&1; then
  cat > "$SUMMARY" <<JSON
{
  "taskId": "$TASK_ID",
  "result": "PASS",
  "pass": true
}
JSON
  echo "[$TASK_ID] PASS"
else
  tail -n 60 "$LOG" || true
  fail "test:visual:config failed (see evidence/P26/P26-T0/actual.log)"
fi
