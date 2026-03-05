#!/usr/bin/env bash
set -euo pipefail

TASK="P22-T3"
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
EVDIR="$ROOT/evidence/P22/$TASK"
SUMMARY="$EVDIR/summary.json"

INVITE_PAGE="$ROOT/packages/ui/src/app/InviteAcceptPage.tsx"
INVITE_CSS="$ROOT/packages/ui/src/app/InviteAcceptPage.css"

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

if [[ ! -f "$INVITE_PAGE" ]]; then
  on_failure "static" "missing InviteAcceptPage.tsx"
fi
if [[ ! -f "$INVITE_CSS" ]]; then
  on_failure "static" "missing InviteAcceptPage.css"
fi

if ! grep -q 'from "@nimbus/ui-kit"' "$INVITE_PAGE"; then
  on_failure "static" "missing @nimbus/ui-kit import"
fi

for token in "TextField" "PasswordField" "Button"; do
  if ! grep -q "$token" "$INVITE_PAGE"; then
    on_failure "static" "missing component: $token"
  fi

done

if grep -q 'style=' "$INVITE_PAGE"; then
  on_failure "static" "inline style prop remains"
fi

if grep -q 'inviteStyles' "$INVITE_PAGE"; then
  on_failure "static" "temporary inline style object remains"
fi

for token in "invite-accept" "invite-accept__card" "invite-accept__error"; do
  if ! grep -q "$token" "$INVITE_PAGE"; then
    on_failure "static" "missing class usage: $token"
  fi
done

cd "$ROOT"

pnpm -C packages/ui exec eslint src/app/InviteAcceptPage.tsx >/tmp/p22t3-lint.log 2>&1 || {
  details="$(tail -n 120 /tmp/p22t3-lint.log | tr '\n' ' ' | cut -c1-240)"
  on_failure "pnpm -C packages/ui exec eslint src/app/InviteAcceptPage.tsx" "$details"
}

pnpm -C packages/ui typecheck >/tmp/p22t3-typecheck.log 2>&1 || {
  details="$(tail -n 120 /tmp/p22t3-typecheck.log | tr '\n' ' ' | cut -c1-240)"
  on_failure "pnpm -C packages/ui typecheck" "$details"
}

pnpm -C packages/ui test -- --run src/app/InviteAcceptPage.spec.tsx >/tmp/p22t3-test.log 2>&1 || {
  details="$(tail -n 120 /tmp/p22t3-test.log | tr '\n' ' ' | cut -c1-240)"
  on_failure "pnpm -C packages/ui test -- --run src/app/InviteAcceptPage.spec.tsx" "$details"
}

update_summary "PASS" "PASS" "true" "Invite accept page uses ui-kit, lint/typecheck/test pass"
echo "[$TASK] PASS"
