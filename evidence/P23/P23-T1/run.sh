#!/usr/bin/env bash
set -euo pipefail

TASK="P23-T1"
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
EVDIR="$ROOT/evidence/P23/$TASK"
SUMMARY="$EVDIR/summary.json"

ADMIN_HOME_PAGE="$ROOT/packages/ui/src/app/AdminHomePage.tsx"
ADMIN_HOME_CSS="$ROOT/packages/ui/src/app/AdminHomePage.css"
ADMIN_ROUTES="$ROOT/packages/ui/src/app/AdminRoutes.tsx"

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

if [[ ! -f "$ADMIN_HOME_PAGE" ]]; then
  on_failure "static" "missing AdminHomePage.tsx"
fi
if [[ ! -f "$ADMIN_HOME_CSS" ]]; then
  on_failure "static" "missing AdminHomePage.css"
fi
if [[ ! -f "$ADMIN_ROUTES" ]]; then
  on_failure "static" "missing AdminRoutes.tsx"
fi

if ! grep -q "AdminHomePage" "$ADMIN_ROUTES"; then
  on_failure "static" "admin routes do not render AdminHomePage"
fi

if ! grep -q 'from "@nimbus/ui-kit"' "$ADMIN_HOME_PAGE"; then
  on_failure "static" "AdminHomePage missing @nimbus/ui-kit import"
fi

if grep -q 'style=' "$ADMIN_HOME_PAGE"; then
  on_failure "static" "inline style usage detected in AdminHomePage"
fi

cd "$ROOT"

pnpm -C packages/ui exec eslint src/app/AdminHomePage.tsx src/app/AdminRoutes.tsx >/tmp/p23t1-eslint.log 2>&1 || {
  details="$(tail -n 120 /tmp/p23t1-eslint.log | tr '\n' ' ' | cut -c1-240)"
  on_failure "pnpm -C packages/ui exec eslint src/app/AdminHomePage.tsx src/app/AdminRoutes.tsx" "$details"
}

pnpm -C packages/ui typecheck >/tmp/p23t1-typecheck.log 2>&1 || {
  details="$(tail -n 120 /tmp/p23t1-typecheck.log | tr '\n' ' ' | cut -c1-240)"
  on_failure "pnpm -C packages/ui typecheck" "$details"
}

pnpm -C packages/ui test -- --run src/app/InviteAcceptPage.spec.tsx >/tmp/p23t1-test.log 2>&1 || {
  details="$(tail -n 120 /tmp/p23t1-test.log | tr '\n' ' ' | cut -c1-240)"
  on_failure "pnpm -C packages/ui test -- --run src/app/InviteAcceptPage.spec.tsx" "$details"
}

update_summary "PASS" "PASS" "true" "Admin home route and component implemented"
echo "[$TASK] PASS"
