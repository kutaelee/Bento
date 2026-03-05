#!/usr/bin/env bash
set -euo pipefail

TASK="P20-T2"
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
EVDIR="$ROOT/evidence/P20/$TASK"
SUMMARY="$EVDIR/summary.json"
APP_ROUTER="$ROOT/packages/ui/src/app/AppRouter.tsx"
ADMIN_ROUTES="$ROOT/packages/ui/src/app/AdminRoutes.tsx"
APP_SHELL="$ROOT/packages/ui/src/app/AppShell.tsx"

for file in "$APP_ROUTER" "$APP_SHELL" "$ADMIN_ROUTES"; do
  if [[ ! -f "$file" ]]; then
    echo "missing:$file"
    cat > "$SUMMARY" <<JSON
{
  "taskId": "$TASK",
  "status": "FAIL",
  "result": "FAIL",
  "pass": false,
  "details": "missing required file"
}
JSON
    exit 1
  fi
done

python3 - "$APP_ROUTER" "$ADMIN_ROUTES" "$APP_SHELL" <<'PY'
from pathlib import Path
import sys

router_path, admin_path, shell_path = sys.argv[1:]
router = Path(router_path).read_text(encoding="utf-8")
admin_routes = Path(admin_path).read_text(encoding="utf-8")
shell = Path(shell_path).read_text(encoding="utf-8")

def fail(msg: str) -> None:
    print(msg)
    raise SystemExit(1)

required_shell_tokens = [
    'export function AppShell',
    '<aside',
    '<header',
    '<main',
    'InspectorPanel',
    'UploadQueuePanel',
]
for token in required_shell_tokens:
    if token not in shell:
        fail(f"missing-shell-piece:{token}")

if 'from "./AppShell"' not in router or '<AppShell' not in router:
    fail('appshell-not-wrapped')

required_router_routes = [
    'path="files"',
    'path="files/:nodeId"',
    'path="search"',
    'path="trash"',
]
for token in required_router_routes:
    if token not in router:
        fail(f"missing-route:{token}")

if 'path="admin"' not in admin_routes and "path='admin'" not in admin_routes:
    fail('missing-admin-route-root')

if '{adminRoutes}' not in router:
    fail('admin-routes-not-rendered')

admin_index = router.find('{adminRoutes}')
if admin_index == -1:
    fail('admin-routes-not-rendered')

root_route_index = router.find('path="/"')
if root_route_index == -1:
    fail('missing-root-route')

root_route_close = router.find('</Route>', root_route_index)
if root_route_close == -1:
    fail('malformed-router: no root route closing tag')

if not (root_route_index < admin_index < root_route_close):
    fail('admin-routes-not-nested-in-shell-root')

print('ok')
PY

cat > "$SUMMARY" <<JSON
{
  "taskId": "$TASK",
  "status": "PASS",
  "result": "PASS",
  "pass": true,
  "details": "AppShell and routed pages are driven through shared shell container components with admin routes verified inside shell-root route."
}
JSON

echo "[$TASK] PASS"
