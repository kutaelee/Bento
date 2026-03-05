#!/usr/bin/env bash
set -euo pipefail

TASK="P22-T1"
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
EVDIR="$ROOT/evidence/P22/$TASK"
SUMMARY="$EVDIR/summary.json"

LOGIN_PAGE="$ROOT/packages/ui/src/app/LoginPage.tsx"
LOGIN_CSS="$ROOT/packages/ui/src/app/LoginPage.css"

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

if [[ ! -f "$LOGIN_PAGE" ]]; then
  on_failure "evidence" "missing LoginPage"
fi
if [[ ! -f "$LOGIN_CSS" ]]; then
  on_failure "evidence" "missing LoginPage.css"
fi

if grep -q "const .*loginStyles" "$LOGIN_PAGE"; then
  on_failure "static" "inline style object loginStyles still present"
fi

for needle in "from \"@nimbus/ui-kit\"" "TextField" "PasswordField" "Button"; do
  if ! grep -q "$needle" "$LOGIN_PAGE"; then
    on_failure "static" "missing ui-kit usage: $needle"
  fi
done

if grep -q "style={" "$LOGIN_PAGE"; then
  on_failure "static" "inline style props remain in LoginPage"
fi

if ! grep -q "login-page" "$LOGIN_PAGE"; then
  on_failure "static" "login page classes are not applied"
fi

cd "$ROOT"

pnpm -C packages/ui exec eslint src/app/LoginPage.tsx >"$EVDIR/.lint.log" 2>&1 || {
  tail -n 80 "$EVDIR/.lint.log" | tr '\n' ' ' | cut -c1-240 > "$EVDIR/.error.txt"
  details="$(cat "$EVDIR/.error.txt")"
  on_failure "pnpm -C packages/ui exec eslint src/app/LoginPage.tsx" "$details"
}

pnpm -C packages/ui typecheck >"$EVDIR/.typecheck.log" 2>&1 || {
  tail -n 80 "$EVDIR/.typecheck.log" | tr '\n' ' ' | cut -c1-240 > "$EVDIR/.error.txt"
  details="$(cat "$EVDIR/.error.txt")"
  on_failure "pnpm -C packages/ui typecheck" "$details"
}

pnpm -C packages/ui test -- --run >"$EVDIR/.test.log" 2>&1 || {
  tail -n 80 "$EVDIR/.test.log" | tr '\n' ' ' | cut -c1-240 > "$EVDIR/.error.txt"
  details="$(cat "$EVDIR/.error.txt")"
  on_failure "pnpm -C packages/ui test -- --run" "$details"
}

pnpm -C packages/ui run test:visual >"$EVDIR/.visual.log" 2>&1 || {
  tail -n 80 "$EVDIR/.visual.log" | tr '\n' ' ' | cut -c1-240 > "$EVDIR/.error.txt"
  details="$(cat "$EVDIR/.error.txt")"
  on_failure "pnpm -C packages/ui run test:visual" "$details"
}

update_summary "PASS" "PASS" "true" "LoginPage ui-kit composition is applied and lint/typecheck/test/visual checks pass"
echo "[$TASK] PASS"
