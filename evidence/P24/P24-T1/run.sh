#!/usr/bin/env bash
set -euo pipefail

TASK="P24-T1"
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
EVDIR="$ROOT/evidence/P24/$TASK"
SUMMARY="$EVDIR/summary.json"
ROUTE_MAP="$ROOT/design/stitch/ko-kr_final/inventory/route_reference_map.md"
ROUTES_TS="$ROOT/packages/ui/src/routes.ts"

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
  local details="$1"
  update_summary "PASS" "PASS" "true" "$details"
  echo "[$TASK] PASS: $details"
}

for required in "$ROUTE_MAP" "$ROUTES_TS"; do
  [[ -f "$required" ]] || fail "missing required file: $required"
done

# 1) Validate map + route config parity for P24 IA routes
python3 - "$ROUTE_MAP" "$ROUTES_TS" <<'PY'
import pathlib
import re
import sys

route_map_path, routes_ts_path = sys.argv[1:3]
text = pathlib.Path(route_map_path).read_text(encoding="utf-8").splitlines()
rows = []
inside = False
for line in text:
    if not line.strip().startswith("|"):
        continue
    cols = [c.strip() for c in line.strip("|").split("|")]
    if cols and cols[0].lower() == "route":
        inside = True
        continue
    if not inside:
        continue
    if len(cols) < 4:
        continue
    route = cols[0]
    if not route or set(route) <= {"-", " "}:
        continue
    if re.search(r"TODO|todo|TBD|tbd", route):
        continue
    rows.append(route)

if not rows:
    raise SystemExit("route_reference_map parse failed")

route_set = set(rows)

routes_text = pathlib.Path(routes_ts_path).read_text(encoding="utf-8")
route_patterns = re.findall(r'path:\s*"([^"]+)"', routes_text)
route_defs = [r for r in route_patterns if r.startswith("/")]
route_defs = set(route_defs)

missing_from_map = sorted(route_defs - route_set)
missing_from_routes = sorted(route_set - route_defs)
if missing_from_map:
    raise SystemExit(f"IA routes missing in map: {', '.join(missing_from_map)}")
if missing_from_routes:
    raise SystemExit(f"map rows not in routes.ts: {', '.join(missing_from_routes)}")
PY

# 2) Ensure every mapped route with reference has a stable anchor string
echo "[$TASK] validating mapping entries"
python3 - "$ROUTE_MAP" <<'PY'
import pathlib
import re
import sys

text = pathlib.Path(sys.argv[1]).read_text(encoding="utf-8").splitlines()
inside = False
for line in text:
    if not line.strip().startswith("|"):
        continue
    cols = [c.strip() for c in line.strip("|").split("|")]
    if cols and cols[0].lower() == "route":
        inside = True
        continue
    if not inside or len(cols) < 4:
        continue
    route, ref, screen, derived = cols[0], cols[1], cols[2], cols[3]
    if not route or set(route) <= {"-", " "} or re.search(r"TODO|todo|TBD|tbd", route):
        continue
    if not ref and not derived:
        raise SystemExit(f"route {route} has neither reference nor derived link")

    if ref and ref.lower() not in {"none", "n/a", "na", "null", ""}:
        if "code.html" not in ref:
            raise SystemExit(f"route {route} references invalid code.html path: {ref}")

    if derived and derived.lower() not in {"none", "n/a", "na", "null", ""}:
        if "#" not in derived and "/inventory/_derived_checklist.md" not in derived:
            raise SystemExit(f"route {route} derived link invalid: {derived}")
PY

# 3) Run ui lint and visual evidence
if ! pnpm -C "$ROOT/packages/ui" run lint >/tmp/p24t1-lint.out 2>&1; then
  fail "ui lint failed: $(tail -n 1 /tmp/p24t1-lint.out)"
fi

if ! pnpm -C "$ROOT/packages/ui" run test:visual >/tmp/p24t1-visual.out 2>&1; then
  fail "visual check failed: $(tail -n 1 /tmp/p24t1-visual.out)"
fi

pass_msg "route_reference_map and routes.ts parity PASS; lint and visual PASS"
