#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONFIG_FILE="$ROOT_DIR/packages/ui/visual-regression.config.json"
ROUTE_MAP="$ROOT_DIR/design/stitch/ko-kr_final/inventory/route_reference_map.md"

python3 - "$CONFIG_FILE" "$ROUTE_MAP" "$ROOT_DIR" <<'PY'
import json
import pathlib
import sys

config_path = pathlib.Path(sys.argv[1])
route_map_path = pathlib.Path(sys.argv[2])
root_dir = pathlib.Path(sys.argv[3])

config = json.loads(config_path.read_text(encoding='utf-8'))
routes = config.get('routes')
if not isinstance(routes, list) or not routes:
    print('invalid-config:routes-empty')
    raise SystemExit(1)

required = {'/files', '/login', '/admin'}
seen = set()

lines = route_map_path.read_text(encoding='utf-8').splitlines()
inside = False
route_map = {}
for line in lines:
    if not line.strip().startswith('|'):
        continue
    cols = [c.strip() for c in line.strip('|').split('|')]
    if cols and cols[0].lower() == 'route':
        inside = True
        continue
    if not inside or len(cols) < 4:
        continue
    route, ref_code, ref_screen, derived = cols[0], cols[1], cols[2], cols[3]
    if not route or set(route) <= {'-', ' '}:
        continue
    if not route.startswith('/'):
        continue
    route_map[route] = {
        'ref_screen': ref_screen,
        'derived': derived,
    }

if not route_map:
    print('invalid-map:empty')
    raise SystemExit(1)

for i, r in enumerate(routes, 1):
    if not isinstance(r, dict):
        print(f'invalid-route:{i}')
        raise SystemExit(1)
    p = r.get('path')
    states = r.get('states')
    seed = r.get('seed')
    baseline = r.get('baseline')
    if not isinstance(p, str) or not p:
        print(f'invalid-path:{i}')
        raise SystemExit(1)
    if not isinstance(states, list) or not states:
        print(f'missing-states:{p}')
        raise SystemExit(1)
    if not isinstance(seed, str) or not seed:
        print(f'missing-seed:{p}')
        raise SystemExit(1)
    if not isinstance(baseline, dict):
        print(f'missing-baseline:{p}')
        raise SystemExit(1)
    mode = baseline.get('mode')
    if mode not in {'reference', 'derived'}:
        print(f'invalid-baseline-mode:{p}')
        raise SystemExit(1)
    if p not in route_map:
        print(f'route-not-in-map:{p}')
        raise SystemExit(1)

    mapping = route_map[p]
    ref_screen = (mapping.get('ref_screen') or '').strip()
    derived = (mapping.get('derived') or '').strip()
    has_reference = ref_screen.lower() not in {'', 'none', 'n/a', 'na', 'null'}

    if has_reference:
        if mode != 'reference':
            print(f'baseline-mode-mismatch:{p}')
            raise SystemExit(1)
        if baseline.get('screen') != ref_screen:
            print(f'reference-screen-mismatch:{p}')
            raise SystemExit(1)
        if not (root_dir / ref_screen).is_file():
            print(f'reference-screen-missing:{p}')
            raise SystemExit(1)
    else:
        if mode != 'derived':
            print(f'baseline-mode-mismatch:{p}')
            raise SystemExit(1)
        if baseline.get('derived') != derived:
            print(f'derived-link-mismatch:{p}')
            raise SystemExit(1)

    seen.add(p)

missing = sorted(required - seen)
if missing:
    print('missing-required-routes:' + ','.join(missing))
    raise SystemExit(1)

reference_required = {
    route
    for route, entry in route_map.items()
    if (entry.get('ref_screen') or '').strip().lower() not in {'', 'none', 'n/a', 'na', 'null'}
}
missing_reference = sorted(reference_required - seen)
if missing_reference:
    print('missing-reference-routes:' + ','.join(missing_reference))
    raise SystemExit(1)

for p in ['/files', '/admin', '/login']:
    entry = next((r for r in routes if r.get('path') == p), None)
    if not entry:
        continue
    states = set(entry.get('states', []))
    if p == '/files' and len({'loading', 'empty', 'error'} - states):
        print('files-missing-state')
        raise SystemExit(1)
    if p == '/admin' and 'forbidden' not in states:
        print('admin-missing-forbidden-state')
        raise SystemExit(1)

print('ok: visual config + route map validated')
PY
