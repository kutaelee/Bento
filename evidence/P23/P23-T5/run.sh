#!/usr/bin/env bash
set -euo pipefail

TASK="P23-T5"
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
EVDIR="$ROOT/evidence/P23/$TASK"
SUMMARY="$EVDIR/summary.json"

update_summary() {
  local status="$1"
  local result="$2"
  local pass="$3"
  local details="$4"
  cat > "$SUMMARY" <<JSON
{
  "taskId": "$TASK",
  "status": "$status",
  "result": "$result",
  "pass": $pass,
  "details": "$details"
}
JSON
}

on_failure() {
  local rc=$?
  update_summary "FAIL" "FAIL" false "run.sh failed during: ${BASH_COMMAND}"
  exit "$rc"
}
trap on_failure ERR

ADMIN_ROUTES="$ROOT/packages/ui/src/app/AdminRoutes.tsx"
PAGE_TSX="$ROOT/packages/ui/src/app/AdminPerformancePage.tsx"
PAGE_CSS="$ROOT/packages/ui/src/app/AdminPerformancePage.css"
LOCALE_KO="$ROOT/packages/ui/src/i18n/locales/ko-KR.json"
LOCALE_EN="$ROOT/packages/ui/src/i18n/locales/en-US.json"

for f in "$ADMIN_ROUTES" "$PAGE_TSX" "$PAGE_CSS" "$LOCALE_KO" "$LOCALE_EN"; do
  [[ -f "$f" ]] || { update_summary "FAIL" "FAIL" false "missing:$f"; exit 1; }
done

python3 - <<'PY' "$ADMIN_ROUTES" "$PAGE_TSX" "$LOCALE_KO" "$LOCALE_EN"
import json,sys
routes=open(sys.argv[1],encoding='utf-8').read()
page=open(sys.argv[2],encoding='utf-8').read()
ko=json.load(open(sys.argv[3],encoding='utf-8'))
en=json.load(open(sys.argv[4],encoding='utf-8'))
if '/admin/performance' not in routes and 'performance' not in routes:
    raise SystemExit('missing route /admin/performance')
for token in ('AdminPerformancePage','PageHeader','Toolbar','DataTable'):
    if token not in page:
        raise SystemExit(f'missing token: {token}')
for k in ('admin.performance.title','admin.performance.settingSection'):
    if k not in ko or k not in en:
        raise SystemExit(f'missing i18n key: {k}')
print('ok')
PY

pnpm -C "$ROOT/packages/ui" run lint
pnpm -C "$ROOT/packages/ui" run typecheck

update_summary "PASS" "PASS" true "admin performance route/page/i18n + lint/typecheck passed"
echo "[$TASK] PASS"
