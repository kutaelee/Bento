#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
EVIDENCE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SUMMARY_JSON="$EVIDENCE_DIR/summary.json"
CHECKLIST="$ROOT_DIR/design/stitch/ko-kr_final/inventory/_derived_checklist.md"
ROUTE_MAP="$ROOT_DIR/design/stitch/ko-kr_final/inventory/route_reference_map.md"
export ROOT_DIR CHECKLIST ROUTE_MAP

set +e
python3 - <<'PY'
import os
import pathlib
import re
import sys

root = pathlib.Path(os.environ.get('ROOT_DIR', '.'))
checklist_path = pathlib.Path(os.environ.get('CHECKLIST', ''))
route_map_path = pathlib.Path(os.environ.get('ROUTE_MAP', ''))

if not checklist_path.is_file():
    print('missing-checklist')
    sys.exit(1)
if not route_map_path.is_file():
    print('missing-route-map')
    sys.exit(1)

# parse derived links from route map
lines = route_map_path.read_text(encoding='utf-8').splitlines()
inside = False
anchors = set()
invalid_anchors = []
for line in lines:
    if not line.strip().startswith('|'):
        continue
    cols = [c.strip() for c in line.strip('|').split('|')]
    if cols and cols[0].lower() == 'route':
        inside = True
        continue
    if not inside or len(cols) < 4:
        continue
    route, derived = cols[0], cols[3]
    if not route.startswith('/'):
        continue
    if not derived or derived.lower() in {'none', 'n/a', 'na', 'null'}:
        continue
    if '#' in derived:
        anchors.add(derived.split('#',1)[1].strip())
    else:
        invalid_anchors.append(route)

if invalid_anchors:
    print('invalid-derived-link-anchor:' + ','.join(sorted(invalid_anchors)))
    sys.exit(1)

# parse checklist sections
text = checklist_path.read_text(encoding='utf-8')
section_re = re.compile(r'^###\s+([^\n]+)\n([\s\S]*?)(?=^###\s+|\Z)', re.M)
sections = {m.group(1).strip(): m.group(2).strip() for m in section_re.finditer(text)}

missing_sections = sorted(a for a in anchors if a not in sections)
if missing_sections:
    print('missing-sections:' + ','.join(missing_sections))
    sys.exit(1)

errors = []
for anchor, body in sections.items():
    derived_match = re.search(r'^-\s*derived:\s*(\S+)', body, re.M)
    reuse_match = re.search(r'^-\s*재사용 reference:\s*(\S+)', body, re.M)
    if not derived_match:
        errors.append(f'missing-derived:{anchor}')
        continue
    derived_path = root / derived_match.group(1)
    if not derived_path.is_file():
        errors.append(f'derived-missing:{anchor}')
        continue
    content = derived_path.read_text(encoding='utf-8')
    if '재사용 reference:' not in content:
        errors.append(f'derived-missing-reuse:{anchor}')
    if reuse_match:
        reuse_path = root / reuse_match.group(1)
        if not reuse_path.is_file():
            errors.append(f'reuse-missing:{anchor}')
        if reuse_match.group(1) not in content:
            errors.append(f'derived-reuse-link-mismatch:{anchor}')
    else:
        errors.append(f'missing-reuse:{anchor}')

if errors:
    print('errors:' + ';'.join(errors))
    sys.exit(1)

print('ok:derived-specs')
PY
status=$?
set -e

if [ "$status" -eq 0 ]; then
  cat > "$SUMMARY_JSON" <<'JSON'
{
  "taskId": "P24-T5",
  "result": "PASS",
  "pass": true
}
JSON
  echo "[P24-T5] PASS"
  exit 0
fi

cat > "$SUMMARY_JSON" <<'JSON'
{
  "taskId": "P24-T5",
  "result": "FAIL",
  "pass": false
}
JSON
echo "[P24-T5] FAIL"
exit "$status"
