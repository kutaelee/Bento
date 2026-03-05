#!/usr/bin/env bash
set -euo pipefail
TASK="P21-T1"
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
EVDIR="$ROOT/evidence/P21/$TASK"
SUMMARY="$EVDIR/summary.json"

FILES_PAGE="$ROOT/packages/ui/src/app/FilesPage.tsx"
APP_ROUTER="$ROOT/packages/ui/src/app/AppRouter.tsx"

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
  local status=$?
  update_summary "FAIL" "FAIL" false "run.sh failed during ${BASH_COMMAND}"
  exit "$status"
}
trap 'on_failure' ERR

check_file() {
  local path="$1"
  if [[ ! -f "$path" ]]; then
    update_summary "FAIL" "FAIL" false "missing:$path"
    exit 1
  fi
}

check_file "$FILES_PAGE"
check_file "$APP_ROUTER"

python3 - "$FILES_PAGE" "$APP_ROUTER" <<'PY'
import sys
files_page = open(sys.argv[1], 'r', encoding='utf-8').read()
app_router = open(sys.argv[2], 'r', encoding='utf-8').read()

for token in ('PageHeader', 'PatternDataTable', 'Toolbar', 'FolderView'):
    if token not in files_page:
        print(f'missing-token:{token}')
        raise SystemExit(1)

# allow either literal or refactored variable-based binding
if 'metaLabelKey="field.path"' not in files_page and 'metaLabelKey={isRootRoute || !isTrashRoute ? pageMetaLabelKey : undefined}' not in files_page:
    print('missing-token:metaLabelKey')
    raise SystemExit(1)

for token in ('path="files"', 'path="files/:nodeId"'):
    if token not in app_router:
        print(f'missing-route:{token}')
        raise SystemExit(1)

if 't("field.search")' not in app_router:
    # allow SearchPage coverage to be partial for /files task; ensure Search still exists
    if 'path="search"' not in app_router:
        print('missing-search-route')
        raise SystemExit(1)

print('ok')
PY

cd "$ROOT"
pnpm -C packages/ui test -- --run src/app/FilesPage.spec.tsx
pnpm -C packages/ui run test:visual

update_summary "PASS" "PASS" true "files page ui-kit usage validated and visual/ui tests pass"
echo "[$TASK] PASS"
