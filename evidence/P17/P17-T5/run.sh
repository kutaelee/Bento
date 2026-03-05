#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)

bash "$ROOT_DIR/scripts/run_ui_evidence.sh" \
  --out "$ROOT_DIR/evidence/P17/P17-T5" \
  --cmd "pnpm -C '"$ROOT_DIR"'/packages/ui test"
