#!/usr/bin/env bash
set -euo pipefail

TASK="P20-T0"
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
EVDIR="$ROOT/evidence/P20/$TASK"
COVERAGE="$ROOT/design/stitch/ko-kr_final/inventory/route_coverage.md"
DERIVED="$ROOT/design/stitch/ko-kr_final/inventory/_derived_checklist.md"
SUMMARY="$EVDIR/summary.json"

EXPECTED=(
  "/files"
  "/files/:nodeId"
  "/search"
  "/recent"
  "/favorites"
  "/shared"
  "/media"
  "/trash"
  "/login"
  "/setup"
  "/invite/accept"
  "/admin"
  "/admin/users"
  "/admin/storage"
  "/admin/migration"
  "/admin/performance"
  "/admin/jobs"
  "/admin/audit"
  "/admin/security"
  "/admin/appearance"
)

if [[ ! -f "$COVERAGE" ]]; then
  echo "missing:$COVERAGE"
  exit 1
fi

if [[ ! -f "$DERIVED" ]]; then
  echo "missing:$DERIVED"
  exit 1
fi

python3 - "$COVERAGE" "$DERIVED" <<'PY'
import re, pathlib, sys

coverage_path, derived_path = sys.argv[1], sys.argv[2]
coverage = pathlib.Path(coverage_path).read_text(encoding='utf-8').splitlines()
derived = pathlib.Path(derived_path).read_text(encoding='utf-8')

expected_routes = [
  "/files",
  "/files/:nodeId",
  "/search",
  "/recent",
  "/favorites",
  "/shared",
  "/media",
  "/trash",
  "/login",
  "/setup",
  "/invite/accept",
  "/admin",
  "/admin/users",
  "/admin/storage",
  "/admin/migration",
  "/admin/performance",
  "/admin/jobs",
  "/admin/audit",
  "/admin/security",
  "/admin/appearance",
]

start = False
rows = []
for line in coverage:
  if line.startswith("| Route"):
    start = True
    continue
  if not start:
    continue
  if re.match(r"^\|\s*-{3,}", line):
    continue
  if not line.startswith('|'):
    continue
  cells = [c.strip() for c in line.strip('|').split('|')]
  if len(cells) < 5:
    continue
  route = cells[0].strip('`')
  if not route:
    continue
  rows.append(cells)

seen = {r[0].strip('`') for r in rows}
missing = [r for r in expected_routes if r not in seen]
if missing:
  print(f"missing_routes:{','.join(missing)}")
  raise SystemExit(1)

if len(rows) < len(expected_routes):
  print(f"row_short:{len(rows)}/{len(expected_routes)}")
  raise SystemExit(1)

for r in rows:
  route, stitch, derived_need, implemented = r[0].strip('`'), r[2], r[3], r[4]
  if not stitch or not derived_need or not implemented:
    print(f"empty_cell:{route}")
    raise SystemExit(1)

for r in rows:
  route = r[0].strip('`')
  derived_need = r[3].strip().lower()
  if derived_need in {"yes", "required", "need", "필요"}:
    if route not in derived:
      print(f"derived_missing:{route}")
      raise SystemExit(1)

print("ok")
PY

cat > "$SUMMARY" <<JSON
{
  "taskId": "$TASK",
  "status": "PASS",
  "result": "PASS",
  "pass": true,
  "details": "route_coverage and _derived_checklist format/coverage checks passed."
}
JSON

echo "[${TASK}] PASS"
exit 0
