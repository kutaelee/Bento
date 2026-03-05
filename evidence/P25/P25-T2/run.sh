#!/usr/bin/env bash
set -euo pipefail

TASK_ID="P25-T2"
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
SUMMARY="$ROOT/evidence/P25/P25-T2/summary.json"

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

if pnpm -C "$ROOT/packages/ui" run test:visual >"$ROOT/evidence/P25/P25-T2/actual.log" 2>&1; then
  cat > "$SUMMARY" <<JSON
{
  "taskId": "$TASK_ID",
  "result": "PASS",
  "pass": true
}
JSON
  echo "[$TASK_ID] PASS"
else
  tail -n 60 "$ROOT/evidence/P25/P25-T2/actual.log" || true
  fail "test:visual failed (see evidence/P25/P25-T2/actual.log)"
fi
