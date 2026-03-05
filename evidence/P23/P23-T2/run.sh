#!/usr/bin/env bash
set -euo pipefail

TASK="P23-T2"
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
EVDIR="$ROOT/evidence/P23/$TASK"
SUMMARY="$EVDIR/summary.json"

TASK_FILE="$ROOT/packages/ui/src/app/AdminUsersPage.tsx"
TASK_STYLES="$ROOT/packages/ui/src/app/AdminUsersPage.css"
ROUTE_FILE="$ROOT/packages/ui/src/app/AdminRoutes.tsx"

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

if [[ ! -f "$TASK_FILE" ]]; then
  fail "missing $TASK_FILE"
fi
if [[ ! -f "$TASK_STYLES" ]]; then
  fail "missing $TASK_STYLES"
fi

if ! grep -q "AdminUsersPage" "$ROUTE_FILE"; then
  fail "admin users route not wired"
fi

if grep -q "TODO" "$TASK_FILE"; then
  fail "placeholder TODO remains in task file"
fi

cd "$ROOT"

pnpm -C packages/ui exec eslint src/app/AdminUsersPage.tsx src/app/AdminRoutes.tsx >/tmp/${TASK}-eslint.log 2>&1 || {
  details="$(tail -n 120 /tmp/${TASK}-eslint.log | tr '\n' ' ' | cut -c1-240)"
  fail "eslint failed: $details"
}

pnpm -C packages/ui typecheck >/tmp/${TASK}-typecheck.log 2>&1 || {
  details="$(tail -n 120 /tmp/${TASK}-typecheck.log | tr '\n' ' ' | cut -c1-240)"
  fail "typecheck failed: $details"
}

update_summary "PASS" "PASS" "true" "admin users page refactor implemented and wired"
echo "[$TASK] PASS"
