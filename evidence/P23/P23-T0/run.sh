#!/usr/bin/env bash
set -euo pipefail

TASK="P23-T0"
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
EVDIR="$ROOT/evidence/P23/$TASK"
SUMMARY="$EVDIR/summary.json"

TASK_FILE_APP="${ROOT}/packages/ui/src/app/AdminRoutes.tsx"
TASK_FILE_SHELL="${ROOT}/packages/ui/src/app/AdminShell.tsx"
TASK_FILE_STYLE="${ROOT}/packages/ui/src/app/AdminShell.css"

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

on_failure() {
  local failed_cmd="$1"
  local reason="$2"
  update_summary "FAIL" "FAIL" "false" "${failed_cmd}: ${reason}"
  exit 1
}

if [[ ! -f "$TASK_FILE_SHELL" ]]; then
  on_failure "static" "missing AdminShell.tsx"
fi

if [[ ! -f "$TASK_FILE_APP" ]]; then
  on_failure "static" "missing AdminRoutes.tsx"
fi

if ! grep -q "AdminShell" "$TASK_FILE_APP"; then
  on_failure "static" "admin routes are not wrapped with AdminShell"
fi

if ! grep -q "admin.storage" "$TASK_FILE_APP"; then
  on_failure "static" "admin routes missing expected route entries"
fi

cd "$ROOT"

pnpm -C packages/ui exec eslint src/app/AdminRoutes.tsx src/app/AdminShell.tsx >/tmp/p23t0-eslint.log 2>&1 || {
  details="$(tail -n 120 /tmp/p23t0-eslint.log | tr '\n' ' ' | cut -c1-240)"
  on_failure "pnpm -C packages/ui exec eslint src/app/AdminRoutes.tsx src/app/AdminShell.tsx" "$details"
}

pnpm -C packages/ui typecheck >/tmp/p23t0-typecheck.log 2>&1 || {
  details="$(tail -n 120 /tmp/p23t0-typecheck.log | tr '\n' ' ' | cut -c1-240)"
  on_failure "pnpm -C packages/ui typecheck" "$details"
}

pnpm -C packages/ui test -- --run src/app/InviteAcceptPage.spec.tsx >/tmp/p23t0-test.log 2>&1 || {
  details="$(tail -n 120 /tmp/p23t0-test.log | tr '\n' ' ' | cut -c1-240)"
  on_failure "pnpm -C packages/ui test -- --run src/app/InviteAcceptPage.spec.tsx" "$details"
}

update_summary "PASS" "PASS" "true" "AdminShell implemented and admin routes are now shell-wrapped"
echo "[$TASK] PASS"
