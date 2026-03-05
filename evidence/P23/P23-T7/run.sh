#!/usr/bin/env bash
set -euo pipefail

TASK="P23-T7"
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

ADMIN_ROUTES="$ROOT/packages/ui/src/app/AdminRoutes.tsx"
PAGE_TSX="$ROOT/packages/ui/src/app/AdminAuditPage.tsx"
PAGE_CSS="$ROOT/packages/ui/src/app/AdminAuditPage.css"
LOCALE_KO="$ROOT/packages/ui/src/i18n/locales/ko-KR.json"
LOCALE_EN="$ROOT/packages/ui/src/i18n/locales/en-US.json"

for f in "$ADMIN_ROUTES" "$PAGE_TSX" "$PAGE_CSS" "$LOCALE_KO" "$LOCALE_EN"; do
  [[ -f "$f" ]] || fail "missing:$f"
done

if ! grep -q "admin/audit" "$ADMIN_ROUTES"; then
  fail "admin/audit route missing in AdminRoutes"
fi

python3 - "$ADMIN_ROUTES" "$PAGE_TSX" "$LOCALE_KO" "$LOCALE_EN" <<'PY'
import json
import pathlib
import sys

routes = pathlib.Path(sys.argv[1]).read_text(encoding="utf-8")
page = pathlib.Path(sys.argv[2]).read_text(encoding="utf-8")

for token in ("AdminAuditPage", "PageHeader", "Toolbar", "DataTable", "LoadingSkeleton", "EmptyState", "ErrorState"):
    if token not in page:
        raise SystemExit(f"missing token: {token}")

if "AdminAuditPage" not in routes:
    raise SystemExit("AdminAuditPage component is not referenced in routes")
if "admin/audit" not in routes:
    raise SystemExit("admin route is missing expected path")

for p in (sys.argv[3], sys.argv[4]):
    d = json.loads(pathlib.Path(p).read_text(encoding='utf-8'))
    for key in (
        "admin.audit.title",
        "admin.audit.column.actor",
        "admin.audit.column.action",
        "admin.audit.column.target",
        "admin.audit.column.time",
        "admin.audit.empty",
        "admin.audit.failed",
        "admin.audit.reload",
    ):
        if key not in d:
            raise SystemExit(f"missing i18n key: {key}")

print('ok')
PY

pnpm -C "$ROOT/packages/ui" run lint
pnpm -C "$ROOT/packages/ui" run typecheck

update_summary "PASS" "PASS" "true" "admin audit route/page/i18n + lint/typecheck passed"
echo "[$TASK] PASS"
