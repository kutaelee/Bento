#!/usr/bin/env bash
set -euo pipefail

TASK="P22-T2"
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
EVDIR="$ROOT/evidence/P22/$TASK"
SUMMARY="$EVDIR/summary.json"

SETUP_PAGE="$ROOT/packages/ui/src/app/SetupPage.tsx"
SETUP_CSS="$ROOT/packages/ui/src/app/SetupPage.css"

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

if [[ ! -f "$SETUP_PAGE" ]]; then
  on_failure "static" "missing SetupPage"
fi
if [[ ! -f "$SETUP_CSS" ]]; then
  on_failure "static" "missing SetupPage.css"
fi

if ! grep -q 'from "@nimbus/ui-kit"' "$SETUP_PAGE"; then
  on_failure "static" "missing @nimbus/ui-kit import"
fi

for token in "TextField" "PasswordField" "Button"; do
  if ! grep -q "$token" "$SETUP_PAGE"; then
    on_failure "static" "missing component: $token"
  fi
done

if grep -q 'setupStyles' "$SETUP_PAGE"; then
  on_failure "static" "inline setupStyles object remains"
fi

if grep -q 'style={' "$SETUP_PAGE"; then
  on_failure "static" "inline style prop remains in SetupPage"
fi

for token in "setup-page" "setup-page__card" "setup-page__error"; do
  if ! grep -q "$token" "$SETUP_PAGE"; then
    on_failure "static" "missing class usage: $token"
  fi
done

cd "$ROOT"

pnpm -C packages/ui exec eslint src/app/SetupPage.tsx >"$EVDIR/.lint.log" 2>&1 || {
  tail -n 120 "$EVDIR/.lint.log" | tr '\n' ' ' | cut -c1-240 >"$EVDIR/.error.txt"
  details="$(cat "$EVDIR/.error.txt")"
  on_failure "pnpm -C packages/ui exec eslint src/app/SetupPage.tsx" "$details"
}

pnpm -C packages/ui typecheck >"$EVDIR/.typecheck.log" 2>&1 || {
  tail -n 120 "$EVDIR/.typecheck.log" | tr '\n' ' ' | cut -c1-240 >"$EVDIR/.error.txt"
  details="$(cat "$EVDIR/.error.txt")"
  on_failure "pnpm -C packages/ui typecheck" "$details"
}

pnpm -C packages/ui test -- --run src/app/setupGate.spec.ts >"$EVDIR/.test.log" 2>&1 || {
  tail -n 120 "$EVDIR/.test.log" | tr '\n' ' ' | cut -c1-240 >"$EVDIR/.error.txt"
  details="$(cat "$EVDIR/.error.txt")"
  on_failure "pnpm -C packages/ui test -- --run src/app/setupGate.spec.ts" "$details"
}

update_summary "PASS" "PASS" "true" "setup page uses ui-kit components, lint/typecheck/test pass"
echo "[$TASK] PASS"
