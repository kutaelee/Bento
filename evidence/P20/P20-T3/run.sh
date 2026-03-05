#!/usr/bin/env bash
set -euo pipefail

TASK="P20-T3"
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
EVDIR="$ROOT/evidence/P20/$TASK"
SUMMARY="$EVDIR/summary.json"

expected_files=(
  "$ROOT/packages/ui-kit/src/components/PageHeader.tsx"
  "$ROOT/packages/ui-kit/src/components/Toolbar.tsx"
  "$ROOT/packages/ui-kit/src/components/EmptyState.tsx"
  "$ROOT/packages/ui-kit/src/components/ErrorState.tsx"
  "$ROOT/packages/ui-kit/src/components/ForbiddenState.tsx"
  "$ROOT/packages/ui-kit/src/components/LoadingSkeleton.tsx"
  "$ROOT/packages/ui-kit/src/components/PatternDataTable.tsx"
  "$ROOT/packages/ui-kit/src/components/DetailInspector.tsx"
  "$ROOT/packages/ui/src/app/FilesPage.tsx"
  "$ROOT/packages/ui/src/app/SearchPage.tsx"
  "$ROOT/packages/ui/src/app/AppShell.tsx"
  "$ROOT/packages/ui-kit/src/components/PageHeader.stories.tsx"
  "$ROOT/packages/ui-kit/src/components/Toolbar.stories.tsx"
  "$ROOT/packages/ui-kit/src/components/PatternDataTable.stories.tsx"
)

for file in "${expected_files[@]}"; do
  if [[ ! -f "$file" ]]; then
    echo "missing:$file"
    cat > "$SUMMARY" <<JSON
{
  "taskId": "$TASK",
  "status": "FAIL",
  "result": "FAIL",
  "pass": false,
  "details": "missing:$file"
}
JSON
    exit 1
  fi
done

if ! rg -q "PageHeader" "$ROOT/packages/ui/src/app/FilesPage.tsx"; then
  echo "filespage-not-using-pageheader"
  cat > "$SUMMARY" <<JSON
{
  "taskId": "$TASK",
  "status": "FAIL",
  "result": "FAIL",
  "pass": false,
  "details": "files page does not use PageHeader component"
}
JSON
  exit 1
fi

if ! rg -q "PatternDataTable" "$ROOT/packages/ui/src/app/FilesPage.tsx"; then
  echo "filespage-not-using-patterndatatable"
  cat > "$SUMMARY" <<JSON
{
  "taskId": "$TASK",
  "status": "FAIL",
  "result": "FAIL",
  "pass": false,
  "details": "files page does not use PatternDataTable component"
}
JSON
  exit 1
fi

if ! rg -q "FolderView" "$ROOT/packages/ui/src/app/SearchPage.tsx"; then
  echo "searchpage-not-using-common-composition"
  cat > "$SUMMARY" <<JSON
{
  "taskId": "$TASK",
  "status": "FAIL",
  "result": "FAIL",
  "pass": false,
  "details": "search page does not reuse common FolderView composition"
}
JSON
  exit 1
fi

if ! rg -q "DetailInspector" "$ROOT/packages/ui/src/app/AppShell.tsx"; then
  echo "appshell-not-using-detailinspector"
  cat > "$SUMMARY" <<JSON
{
  "taskId": "$TASK",
  "status": "FAIL",
  "result": "FAIL",
  "pass": false,
  "details": "app shell still uses direct inspector wrapper"
}
JSON
  exit 1
fi

cd "$ROOT/packages/ui"
if ! pnpm test -- --run src/app/FilesPage.spec.tsx >"$EVDIR/.test.log" 2>&1; then
  tail -n 40 "$EVDIR/.test.log" >/tmp/p20t3_test_tail.txt
  details=$(cat /tmp/p20t3_test_tail.txt | tr '\n' ' ' | sed 's/\s\+/ /g' | cut -c1-180)
  echo "filespage-tests-failed"
  cat > "$SUMMARY" <<JSON
{
  "taskId": "$TASK",
  "status": "FAIL",
  "result": "FAIL",
  "pass": false,
  "details": "$details"
}
JSON
  exit 1
fi

cat > "$SUMMARY" <<JSON
{
  "taskId": "$TASK",
  "status": "PASS",
  "result": "PASS",
  "pass": true,
  "details": "common pattern components exist and Files/Search pages consume shared pattern components"
}
JSON

echo "[$TASK] PASS"
