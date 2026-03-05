#!/usr/bin/env bash
set -euo pipefail

TASK="P21-T8"
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
EVDIR="$ROOT/evidence/P21/$TASK"
SUMMARY="$EVDIR/summary.json"

APP_ROUTER="$ROOT/packages/ui/src/app/AppRouter.tsx"
FILES_PAGE="$ROOT/packages/ui/src/app/FilesPage.tsx"

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
payload = {
    "taskId": task,
    "status": status,
    "result": result,
    "pass": pass_flag == "true",
    "details": details,
}
pathlib.Path(summary_path).write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
PY
}

on_failure() {
  local failed_cmd="$1"
  update_summary "FAIL" "FAIL" "false" "run.sh failed during: ${failed_cmd}"
  exit 1
}
trap 'on_failure "${BASH_COMMAND}"' ERR

for file in "$APP_ROUTER" "$FILES_PAGE"; do
  if [[ ! -f "$file" ]]; then
    update_summary "FAIL" "FAIL" "false" "missing:$file"
    exit 1
  fi
done

python3 - "$APP_ROUTER" "$FILES_PAGE" <<'PY'
import re
import sys

app_router = open(sys.argv[1], "r", encoding="utf-8").read()
files_page = open(sys.argv[2], "r", encoding="utf-8").read()

compact_router = re.sub(r"\s+", "", app_router)
if 'path="trash"element={<FilesPagerouteMode="trash"/>}' not in compact_router and 'path="trash"element={<FilesPage routeMode="trash" />}' not in compact_router and 'path="trash"element={<FilesPagerouteMode="trash"/>}' not in compact_router:
    print("route-trash-not-filespage")
    raise SystemExit(1)

for token in [
    'type RouteMode = "files" | "recent" | "favorites" | "shared" | "media" | "trash"',
    'const isTrashRoute = routeMode === "trash";',
    't("nav.trash")',
    'msg.emptyTrash',
    'nodesApi.listTrash',
]:
    if token not in files_page:
        print(f"missing-token:{token}")
        raise SystemExit(1)

print("ok")
PY

cd "$ROOT"
pnpm -C packages/ui test -- --run src/app/FilesPage.spec.tsx >"$EVDIR/.test.log" 2>&1 || {
  tail -n 80 "$EVDIR/.test.log" | tr '\n' ' ' | cut -c1-240 > "$EVDIR/.test_tail.txt"
  details="$(cat "$EVDIR/.test_tail.txt")"
  update_summary "FAIL" "FAIL" "false" "test failed: ${details}"
  exit 1
}

update_summary "PASS" "PASS" "true" "trash route mapped to FilesPage and FilesPage.spec passes"
echo "[$TASK] PASS"
