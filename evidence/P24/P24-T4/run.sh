#!/usr/bin/env bash
set -euo pipefail

TASK="P24-T4"
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
EVDIR="$ROOT/evidence/P24/$TASK"
SUMMARY="$EVDIR/summary.json"

update_summary() {
  local status="$1"
  local result="$2"
  local pass="$3"
  local details="$4"
  python3 - "$SUMMARY" "$TASK" "$status" "$result" "$pass" "$details" <<'PY'
import json
import pathlib
import sys

summary_path, task, status, result, pass_flag, details = sys.argv[1:7]
pathlib.Path(summary_path).write_text(
    json.dumps(
        {
            "taskId": task,
            "status": status,
            "result": result,
            "pass": pass_flag == "true",
            "details": details,
        },
        ensure_ascii=False,
        indent=2,
    )
    + "\n",
    encoding="utf-8",
)
PY
}

fail() {
  local reason="$1"
  update_summary "FAIL" "FAIL" "false" "$reason"
  echo "[$TASK] FAIL: $reason"
  exit 1
}

pass_msg() {
  local details="$1"
  update_summary "PASS" "PASS" "true" "$details"
  echo "[$TASK] PASS: $details"
}

if ! pnpm -C "$ROOT/packages/ui" run lint >/tmp/p24t4-lint.out 2>&1; then
  fail "ui lint failed: $(tail -n 1 /tmp/p24t4-lint.out)"
fi

if ! pnpm -C "$ROOT/packages/ui" run test:visual >/tmp/p24t4-visual.out 2>&1; then
  fail "visual check failed: $(tail -n 1 /tmp/p24t4-visual.out)"
fi

pass_msg "inline style controls replaced + lint/visual PASS"
