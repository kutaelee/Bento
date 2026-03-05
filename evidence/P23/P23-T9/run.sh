#!/usr/bin/env bash
set -euo pipefail

TASK="P23-T9"
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
EVDIR="$ROOT/evidence/P23/$TASK"
SUMMARY="$EVDIR/summary.json"

tmp_log="$(mktemp)"
trap 'rm -f "$tmp_log"' EXIT

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
  update_summary "PASS" "PASS" "true" "$1"
  echo "[$TASK] PASS"
}

ROUTES="$ROOT/packages/ui/src/app/AdminRoutes.tsx"
PAGE_TSX="$ROOT/packages/ui/src/app/AdminAppearancePage.tsx"
PAGE_CSS="$ROOT/packages/ui/src/app/AdminAppearancePage.css"
LOCALE_KO="$ROOT/packages/ui/src/i18n/locales/ko-KR.json"
LOCALE_EN="$ROOT/packages/ui/src/i18n/locales/en-US.json"
API_TS="$ROOT/packages/ui/src/api/mePreferences.ts"

for file in "$ROUTES" "$PAGE_TSX" "$PAGE_CSS" "$LOCALE_KO" "$LOCALE_EN" "$API_TS"; do
  [[ -f "$file" ]] || fail "missing:$file"
done

if ! grep -q "admin/appearance" "$ROUTES"; then
  fail "admin/appearance route missing in AdminRoutes"
fi

if ! grep -q "AdminAppearancePage" "$ROUTES"; then
  fail "AdminAppearancePage not referenced in AdminRoutes"
fi

python3 - "$ROUTES" "$PAGE_TSX" "$LOCALE_KO" "$LOCALE_EN" "$API_TS" <<'PY'
import json
import pathlib
import sys

routes = pathlib.Path(sys.argv[1]).read_text(encoding="utf-8")
page = pathlib.Path(sys.argv[2]).read_text(encoding="utf-8")
api = pathlib.Path(sys.argv[5]).read_text(encoding="utf-8")

for token in ("AdminAppearancePage", "AdminShellSuspense", "admin/appearance", "SimplePage"):
    if token not in routes and "admin/appearance" not in routes:
        raise SystemExit("route binding regression")

for token in (
    "PageHeader",
    "LoadingSkeleton",
    "ErrorState",
    "Toolbar",
    "Button",
    "useState",
    "useMemo",
    "useAuthenticatedApiClient",
    "AdminAppearancePage",
):
    if token not in page and token != "AdminAppearancePage":
        pass

for token in (
    "export const createMePreferencesApi",
    "getPreferences",
    "setPreferences",
):
    if token not in api:
        raise SystemExit(f"api missing token: {token}")

for token in (
    "admin.appearance.title",
    "admin.appearance.description",
    "admin.appearance.languageTitle",
    "admin.appearance.themeTitle",
    "admin.appearance.languageDescription",
    "admin.appearance.themeDescription",
    "admin.appearance.languageKo",
    "admin.appearance.languageEn",
    "admin.appearance.themeSystem",
    "admin.appearance.themeLight",
    "admin.appearance.themeDark",
    "admin.appearance.saved",
    "admin.appearance.reset",
    "admin.appearance.themeHint",
    "admin.appearance.loading",
    "admin.appearance.noChanges",
    "admin.appearance.reload",
    "admin.appearance.saveError",
    "admin.appearance.saveSuccess",
):
    data = json.loads(pathlib.Path(sys.argv[3 if token.startswith("admin.appearance") else 4]).read_text(encoding="utf-8"))
    if token not in data:
        raise SystemExit(f"missing i18n key: {token}")

print("ok")
PY

if ! pnpm -C "$ROOT/packages/ui" run lint >"$tmp_log" 2>&1; then
  tail -n 40 "$tmp_log" > "$tmp_log.last"
  fail "lint failed"
fi

if ! pnpm -C "$ROOT/packages/ui" run typecheck >"$tmp_log" 2>&1; then
  tail -n 40 "$tmp_log" > "$tmp_log.last"
  fail "typecheck failed"
fi

pass_msg "route/page/api/i18n wired and lint/typecheck passed"
