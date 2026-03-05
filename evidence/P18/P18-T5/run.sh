#!/usr/bin/env bash
set -euo pipefail

# P18-T5 FE 관측성(옵션)
# - Dev-only로 동작하는 경량 observability helper가 존재하는지 확인

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
cd "$ROOT"

FILE="packages/ui/src/observability.ts"

echo "[check] $FILE exists"
[[ -f "$FILE" ]]

echo "[check] dev-only guard present"
rg -n "isDev" "$FILE" >/dev/null

echo "[check] functions exported"
rg -n "export function obsLog\(" "$FILE" >/dev/null
rg -n -F "export async function obsMeasure" "$FILE" >/dev/null

cat > "evidence/P18/P18-T5/summary.json" <<'JSON'
{
  "taskId": "P18-T5",
  "result": "PASS",
  "pass": true,
  "status": "PASS",
  "summary": "Added dev-only FE observability helpers (obsLog/obsMeasure) with minimal overhead in production."
}
JSON

echo "PASS"
