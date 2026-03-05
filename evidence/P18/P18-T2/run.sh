#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
cd "$ROOT"

mkdir -p "evidence/P18/P18-T2/actual"

# Check err.* keys exist in SSOT doc
node - <<'NODE'
const fs = require('fs');
const p = 'docs/ui/COPY_KEYS_SSOT.md';
const s = fs.readFileSync(p,'utf8');
const required = [
  'err.unauthorized',
  'err.forbidden',
  'err.notFound',
  'err.conflict',
  'err.rateLimited',
];
const missing = required.filter(k => !s.includes(k));
if (missing.length) {
  console.error('Missing err.* keys in COPY_KEYS_SSOT.md:', missing.join(', '));
  process.exit(1);
}
NODE

# Run UI unit tests (vitest) which include the 401/403/404/409/429 mapping spec.
pnpm -C packages/ui test

cat > evidence/P18/P18-T2/summary.json <<'JSON'
{
  "taskId": "P18-T2",
  "result": "PASS",
  "pass": true,
  "status": "PASS",
  "notes": "status(401/403/404/409/429) -> err.* mapping covered by packages/ui tests; keys exist in COPY_KEYS_SSOT.md"
}
JSON

echo "P18-T2 PASS"
