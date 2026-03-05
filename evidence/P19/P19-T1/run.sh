#!/usr/bin/env bash
set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
SUMMARY="$DIR/summary.json"
EXPECTED="$DIR/expected.md"

if [[ ! -f "$EXPECTED" ]]; then
  REASON="expected.md is missing"
elif [[ ! -s "$EXPECTED" ]]; then
  REASON="expected.md is empty"
elif ! grep -qE "P19|route|navigation|design" "$EXPECTED"; then
  REASON="expected.md does not contain required design checklist entries"
else
  cat > "$SUMMARY" <<'JSON'
{
  "taskId": "P19-T1",
  "status": "PASS",
  "result": "PASS",
  "pass": true,
  "details": "expected.md present and contains task-specific checklist markers"
}
JSON
  echo "[P19-T1] evidence checks passed"
  exit 0
fi

cat > "$SUMMARY" <<JSON
{
  "taskId": "P19-T1",
  "status": "FAIL",
  "result": "FAIL",
  "pass": false,
  "details": "$REASON"
}
JSON

echo "[P19-T1] evidence checks failed: $REASON" >&2
exit 1
