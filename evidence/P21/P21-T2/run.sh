#!/usr/bin/env bash
set -euo pipefail

TASK="P21-T2"
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
EVDIR="$ROOT/evidence/P21/$TASK"
SUMMARY="$EVDIR/summary.json"

FILES_PAGE="$ROOT/packages/ui/src/app/FilesPage.tsx"
APP_ROUTER="$ROOT/packages/ui/src/app/AppRouter.tsx"
BREADCRUMBS="$ROOT/packages/ui/src/app/Breadcrumbs.tsx"

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
pathlib.Path(summary_path).write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n")
PY
}

on_failure() {
  local failed_cmd="$1"
  update_summary "FAIL" "FAIL" "false" "run.sh failed during: ${failed_cmd}"
  exit 1
}
trap 'on_failure "${BASH_COMMAND}"' ERR

for file in "$FILES_PAGE" "$APP_ROUTER" "$BREADCRUMBS"; do
  if [[ ! -f "$file" ]]; then
    update_summary "FAIL" "FAIL" "false" "missing:$file"
    exit 1
  fi
done

python3 - "$FILES_PAGE" "$APP_ROUTER" "$BREADCRUMBS" <<'PY'
import re
import sys

files_page = open(sys.argv[1], 'r', encoding='utf-8').read()
app_router = open(sys.argv[2], 'r', encoding='utf-8').read()
breadcrumbs = open(sys.argv[3], 'r', encoding='utf-8').read()

checks = [
    ('PageHeader', 'PageHeader component'),
    ('Toolbar', 'Toolbar component'),
    ('PatternDataTable', 'PatternDataTable component'),
]
for token, label in checks:
    if token not in files_page:
        print(f'missing:{label}')
        raise SystemExit(1)

if 'metaLabelKey="field.path"' not in files_page and 'metaLabelKey={isRootRoute || !isTrashRoute ? pageMetaLabelKey : undefined}' not in files_page:
    print('missing:folder path metadata label')
    raise SystemExit(1)

routes = {}
route_tag_pattern = re.compile(r'<Route\b([^>]*?)\s*/\s*>', re.S)
for match in route_tag_pattern.finditer(app_router):
    attrs = match.group(1)
    path_match = re.search(r'path\s*=\s*"([^"]+)"', attrs)
    element_match = re.search(r'element\s*=\s*\{<\s*([A-Za-z0-9_]+)', attrs)
    if not path_match or not element_match:
        continue
    routes[path_match.group(1)] = element_match.group(1)

for required in ('files', 'files/:nodeId'):
    component = routes.get(required)
    if component != 'FilesPage':
        print(f'route-component-mismatch:{required}:{component}')
        raise SystemExit(1)

if 'useLocation' not in breadcrumbs or 'setErrorKey' not in breadcrumbs or 'isFilesRoute' not in breadcrumbs:
    print('missing-breadcrumb-state')
    raise SystemExit(1)

print('ok')
PY

cd "$ROOT/packages/ui"
if ! pnpm test -- --run src/app/FilesPage.spec.tsx >"$EVDIR/.test.log" 2>&1; then
  tail -n 80 "$EVDIR/.test.log" | tr '\n' ' ' | cut -c1-220 > "$EVDIR/.test_tail.txt"
  details=$(cat "$EVDIR/.test_tail.txt")
  update_summary "FAIL" "FAIL" "false" "test failed: $details"
  exit 1
fi

if ! pnpm run test:visual >"$EVDIR/.visual.log" 2>&1; then
  tail -n 80 "$EVDIR/.visual.log" | tr '\n' ' ' | cut -c1-220 > "$EVDIR/.visual_tail.txt"
  details=$(cat "$EVDIR/.visual_tail.txt")
  update_summary "FAIL" "FAIL" "false" "visual failed: $details"
  exit 1
fi

update_summary "PASS" "PASS" "true" "files folder route and breadcrumb/state checks plus tests + visual passed"
echo "[$TASK] PASS"
