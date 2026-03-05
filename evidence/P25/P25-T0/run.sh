#!/usr/bin/env bash
set -euo pipefail

pnpm -C packages/ui lint
pnpm -C packages/ui test:visual

cat <<'JSON' > evidence/P25/P25-T0/summary.json
{
  "taskId": "P25-T0",
  "result": "PASS",
  "pass": true,
  "status": "PASS",
  "summary": "Quick Links topbar tabs + admin gear entry, left nav folder tree focus."
}
JSON
