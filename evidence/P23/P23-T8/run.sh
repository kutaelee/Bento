#!/usr/bin/env bash
set -euo pipefail

TASK="P23-T8"
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
EVDIR="$ROOT/evidence/P23/$TASK"
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

TASK_FILE="$ROOT/packages/ui/src/app/AdminSecurityPage.tsx"
TASK_STYLE="$ROOT/packages/ui/src/app/AdminSecurityPage.css"
ROUTE_FILE="$ROOT/packages/ui/src/app/AdminRoutes.tsx"
LOCALE_KO="$ROOT/packages/ui/src/i18n/locales/ko-KR.json"
LOCALE_EN="$ROOT/packages/ui/src/i18n/locales/en-US.json"

for file in "$TASK_FILE" "$TASK_STYLE" "$ROUTE_FILE" "$LOCALE_KO" "$LOCALE_EN"; do
  [[ -f "$file" ]] || fail "missing $file"
done

if ! grep -q "admin/security" "$ROUTE_FILE"; then
  fail "route wiring missing admin/security"
fi

for token in "AdminSecurityPage" "PageHeader" "Toolbar" "DataTable" "LoadingSkeleton" "ErrorState" "ForbiddenState" "EmptyState"; do
  if ! grep -q "$token" "$TASK_FILE"; then
    fail "missing token in task component: $token"
  fi
done

for token in "admin.security.section.share.title" "admin.security.section.share.description" "admin.security.section.security.title" "admin.security.section.security.description" "admin.security.policy" "admin.security.policyState" "admin.security.empty" "admin.security.error" "admin.security.forbidden"; do
  if ! jq -e --arg k "$token" '. | has($k)' "$LOCALE_KO" >/dev/null; then
    fail "missing i18n key in ko: $token"
  fi
  if ! jq -e --arg k "$token" '. | has($k)' "$LOCALE_EN" >/dev/null; then
    fail "missing i18n key in en: $token"
  fi
done

if grep -q "TODO" "$TASK_FILE"; then
  fail "placeholder TODO remains in task file"
fi

if grep -q "style=" "$TASK_FILE"; then
  fail "inline style detected in task file"
fi

cd "$ROOT"
pnpm -C packages/ui exec eslint src/app/AdminSecurityPage.tsx src/app/AdminRoutes.tsx >/tmp/${TASK}-eslint.log 2>&1 || {
  details="$(tail -n 120 /tmp/${TASK}-eslint.log | tr '\n' ' ' | cut -c1-240)"
  fail "eslint failed: $details"
}

pnpm -C packages/ui run lint >/tmp/${TASK}-lint.log 2>&1 || {
  details="$(tail -n 120 /tmp/${TASK}-lint.log | tr '\n' ' ' | cut -c1-240)"
  fail "lint failed: $details"
}

pnpm -C packages/ui run typecheck >/tmp/${TASK}-typecheck.log 2>&1 || {
  details="$(tail -n 120 /tmp/${TASK}-typecheck.log | tr '\n' ' ' | cut -c1-240)"
  fail "typecheck failed: $details"
}

update_summary "PASS" "PASS" "true" "admin security page implemented, route and i18n added"
echo "[$TASK] PASS"
