#!/usr/bin/env bash
set -euo pipefail

TASK_ID="P26-T1"
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
SUMMARY="$ROOT/evidence/P26/P26-T1/summary.json"
LOG="$ROOT/evidence/P26/P26-T1/actual.log"

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

export TZ="UTC"
export VISUAL_TIMEZONE="UTC"
export VISUAL_LOCALE="ko-KR"
export VISUAL_DIFF_MODE="structure"

if pnpm -C "$ROOT/packages/ui" run test:visual >"$LOG" 2>&1; then
  cat > "$SUMMARY" <<JSON
{
  "taskId": "$TASK_ID",
  "result": "PASS",
  "pass": true
}
JSON
  echo "[$TASK_ID] PASS"
else
  tail -n 80 "$LOG" || true
  fail "test:visual failed (see evidence/P26/P26-T1/actual.log)"
fi
