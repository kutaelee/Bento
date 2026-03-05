#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)

bash "$ROOT_DIR/scripts/run_ui_evidence.sh" \
  --out "$ROOT_DIR/evidence/P18/P18-T1" \
  --cmd "pnpm -C '"$ROOT_DIR"'/packages/ui typecheck"
