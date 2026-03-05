#!/usr/bin/env bash
set -euo pipefail

TASK="P21-T3"
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
EVDIR="$ROOT/evidence/P21/$TASK"
SUMMARY="$EVDIR/summary.json"

SEARCH_PAGE="$ROOT/packages/ui/src/app/SearchPage.tsx"
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
pathlib.Path(summary_path).write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n")
PY
}

on_failure() {
  local failed_cmd="$1"
  update_summary "FAIL" "FAIL" "false" "run.sh failed during: ${failed_cmd}"
  exit 1
}
trap 'on_failure "${BASH_COMMAND}"' ERR

for file in "$SEARCH_PAGE" "$APP_ROUTER" "$FILES_PAGE"; do
  if [[ ! -f "$file" ]]; then
    update_summary "FAIL" "FAIL" "false" "missing:$file"
    exit 1
  fi
done

python3 - "$SEARCH_PAGE" "$APP_ROUTER" <<'PY'
import re
import sys

search_page = open(sys.argv[1], 'r', encoding='utf-8').read()
app_router = open(sys.argv[2], 'r', encoding='utf-8').read()

required_search_tokens = [
    'FolderView',
    'useSearchParams',
    'loading={loading}',
    'loadingMore={loadingMore}',
    'errorKey={errorKey}',
    'emptyKey="msg.emptySearch"',
    'metaValue={query || null}',
    'onLoadMore={loadMore}',
    'onSelectItem={setSelectedNode}',
    'title={t("field.search")}',
    'metaLabelKey="field.search"',
]

for token in required_search_tokens:
    if token not in search_page:
        print(f'missing-search-token:{token}')
        raise SystemExit(1)

route_pattern = re.compile(r'path="search".*element=\{<SearchPage\s*/?\>\}', re.S)
if not route_pattern.search(app_router):
    print('route-search-missing-or-mismatch')
    raise SystemExit(1)

print('ok')
PY

cd "$ROOT/packages/ui"
if ! pnpm test -- --run src/app/FilesPage.spec.tsx >"$EVDIR/.test.log" 2>&1; then
  tail -n 60 "$EVDIR/.test.log" | tr '\n' ' ' | cut -c1-240 > "$EVDIR/.test_tail.txt"
  details=$(cat "$EVDIR/.test_tail.txt")
  update_summary "FAIL" "FAIL" "false" "test failed: ${details}"
  exit 1
fi

update_summary "PASS" "PASS" "true" "search route/page checks passed"
echo "[$TASK] PASS"
