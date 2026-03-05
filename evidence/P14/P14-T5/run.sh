#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)

bash "$ROOT_DIR/scripts/run_ui_evidence.sh" \
  --out "$ROOT_DIR/evidence/P14/P14-T5" \
  --cmd "pnpm -C packages/ui-kit storybook:build" \
  --cmd "pnpm -C packages/ui-kit test"
