#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Always validate SSOT config/map first (cheap, deterministic)
bash "$ROOT_DIR/scripts/validate_visual_config.sh"

# Default: structure gate only (local). In CI, pixel diff becomes the default gate
# for reference-ready routes (P26-T2).
# You can still override explicitly:
#   VISUAL_DIFF_MODE=structure pnpm -C packages/ui test:visual
#   VISUAL_DIFF_MODE=pixel VISUAL_PIXEL_ALLOWLIST=/files,/admin pnpm -C packages/ui test:visual

# Default: structure gate only.
# Pixel diff is intentionally opt-in because reference baselines are design-stitch images
# (not golden screenshots), and pixel diff is far more sensitive to runtime rendering.
: "${VISUAL_DIFF_MODE:=structure}"
export VISUAL_DIFF_MODE

node "$ROOT_DIR/packages/ui/scripts/visual_route_snapshot.mjs"
