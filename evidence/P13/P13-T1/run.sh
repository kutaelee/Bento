#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)

bash "$ROOT_DIR/scripts/run_ui_evidence.sh" \
  --out "$ROOT_DIR/evidence/P13/P13-T1" \
  --cmd "pnpm -r lint" \
  --cmd "pnpm -r typecheck" \
  --cmd "pnpm -r test" \
  --cmd "pnpm -C packages/ui-kit storybook:build"
