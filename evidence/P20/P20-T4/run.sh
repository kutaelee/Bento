#!/usr/bin/env bash
set -euo pipefail

TASK="P20-T4"
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
EVDIR="$ROOT/evidence/P20/$TASK"
SUMMARY="$EVDIR/summary.json"
HIDDEN_FILE="$ROOT/packages/ui/visual-regression.config.json"
SCRIPT="$ROOT/scripts/run_route_snapshot_harness.sh"
PKG_JSON="$ROOT/packages/ui/package.json"

for file in "$HIDDEN_FILE" "$SCRIPT" "$PKG_JSON"; do
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

if ! command -v pnpm >/dev/null 2>&1; then
  echo "pnpm not found"
  cat > "$SUMMARY" <<JSON
{
  "taskId": "$TASK",
  "status": "FAIL",
  "result": "FAIL",
  "pass": false,
  "details": "pnpm not found"
}
JSON
  exit 1
fi

if ! pnpm -C "$ROOT/packages/ui" run test:visual; then
  echo "test:visual failed"
  cat > "$SUMMARY" <<JSON
{
  "taskId": "$TASK",
  "status": "FAIL",
  "result": "FAIL",
  "pass": false,
  "details": "visual harness command failed"
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
  "details": "visual regression harness config and test:visual command are present and passing"
}
JSON

echo "[$TASK] PASS"
