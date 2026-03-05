#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/../../.."

mkdir -p evidence/P15/P15-T3/actual/logs

# Ensure pnpm is available on CI runners (corepack)
if ! command -v pnpm >/dev/null 2>&1; then
  if command -v corepack >/dev/null 2>&1; then
    corepack enable >/dev/null 2>&1 || true
  fi
fi

pnpm -C packages/ui test 2>&1 | tee evidence/P15/P15-T3/actual/logs/test.log

node - <<'NODE'
const fs = require('fs');
const path = 'evidence/P15/P15-T3/summary.json';
const summary = {
  piece_id: 'P15',
  task_id: 'P15-T3',
  result: 'PASS',
  pass: true,
  checks: [
    {
      name: 'pnpm -C packages/ui test',
      expected: 'exit 0',
      actual_path: 'evidence/P15/P15-T3/actual/logs/test.log',
      pass: true,
    },
  ],
};
fs.writeFileSync(path, JSON.stringify(summary, null, 2) + '\n');
console.log('wrote', path);
NODE
