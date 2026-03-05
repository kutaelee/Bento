#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)

bash "$ROOT_DIR/scripts/run_ui_evidence.sh" \
  --out "$ROOT_DIR/evidence/P15/P15-T2" \
  --cmd "pnpm -C packages/ui test" \
  --cmd "pnpm -C packages/ui build"
