#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
TASK="P18-T4"

cd "$ROOT"

# 1) route-level lazy loading check for /admin/*
if ! grep -nE "\blazy\(" packages/ui/src/app/AdminRoutes.tsx >/dev/null; then
  echo "missing React.lazy usage in AdminRoutes"
  exit 1
fi

if ! grep -n "AdminRoutes" packages/ui/src/app/AppRouter.tsx >/dev/null; then
  echo "AppRouter does not include AdminRoutes"
  exit 1
fi

# 2) perf smoke (5k items) test
pnpm -C packages/ui test -- src/app/perfSmoke.spec.ts

cat > "$(dirname "$0")/summary.json" <<JSON
{"taskId":"${TASK}","result":"PASS","pass":true,"status":"PASS","checks":["admin routes lazy","perf smoke 5k"]}
JSON

echo "PASS: ${TASK}"
