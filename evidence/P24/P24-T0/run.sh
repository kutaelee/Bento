#!/usr/bin/env bash
set -euo pipefail

TASK="P24-T0"
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
EVDIR="$ROOT/evidence/P24/$TASK"
SUMMARY="$EVDIR/summary.json"
ROUTE_MAP="$ROOT/design/stitch/ko-kr_final/inventory/route_reference_map.md"

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

[[ -f "$ROUTE_MAP" ]] || fail "missing route_reference_map file: $ROUTE_MAP"

python3 - "$ROUTE_MAP" "${EXPECTED[@]}" <<'PY'
import pathlib
import sys

def is_placeholder(value: str) -> bool:
    v = (value or "").strip().lower()
    return not v or v in {"todo", "tbd", "n/a", "na", "none", "null", "-", "—"}

route_map = pathlib.Path(sys.argv[1]).read_text(encoding="utf-8").splitlines()
expected = sys.argv[2:]
rows = {}
header_found = False

for line in route_map:
    if not line.strip().startswith("|"):
        continue

    cols = [c.strip() for c in line.strip("|").split("|")]
    if len(cols) < 2:
        continue

    if not header_found:
        if cols[0].lower().startswith("route"):
            header_found = True
        continue

    if len(cols) == 0 or all(set(c) <= {"-", " "} for c in cols[0]):
        continue

    if cols[0].lower() in {"route", ""}:
        continue

    if len(cols) < 4:
        raise SystemExit(f"invalid table row for {cols[0]}")

    route = cols[0]
    if any(tok in route for tok in ("TODO", "todo", "TBD", "tbd")):
        raise SystemExit(f"placeholder route token on row: {route}")
    rows[route] = [cols[1], cols[2], cols[3]]

missing = [route for route in expected if route not in rows]
if missing:
    raise SystemExit(f"missing routes: {', '.join(missing)}")

for route in expected:
    ref, screen, derived = rows[route][0], rows[route][1], rows[route][2]
    has_ref = not is_placeholder(ref)
    has_derived = not is_placeholder(derived)

    if not (has_ref or has_derived):
        raise SystemExit(f"route {route} has no reference/derived mapping")

    if has_ref and is_placeholder(screen):
        raise SystemExit(f"route {route} uses direct ref {ref} but is missing screen mapping")

print(f"route_reference_map pass: checked {len(expected)} IA routes")
PY

pass_msg "route_reference_map validated for all IA routes"
