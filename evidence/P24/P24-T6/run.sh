#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(git rev-parse --show-toplevel)"
EVIDENCE_DIR="$(cd "$(dirname "$0")" && pwd)"

FONTS_CSS="$ROOT_DIR/packages/ui/src/styles/fonts.css"
FONTS_DIR="$ROOT_DIR/packages/ui/src/assets/fonts"

fail() {
  cat > "$EVIDENCE_DIR/summary.json" <<JSON
{
  "taskId": "P24-T6",
  "result": "FAIL",
  "pass": false,
  "rootCause": "$1"
}
JSON
  exit 1
}

if [ ! -f "$FONTS_CSS" ]; then
  fail "fonts.css missing"
fi
if [ ! -d "$FONTS_DIR" ]; then
  fail "fonts directory missing"
fi

if ! grep -q "font-family: 'Inter'" "$FONTS_CSS"; then
  fail "Inter font-face missing"
fi
if ! grep -q "font-family: 'Noto Sans KR'" "$FONTS_CSS"; then
  fail "Noto Sans KR font-face missing"
fi

if ! ls "$FONTS_DIR"/*.woff2 >/dev/null 2>&1; then
  fail "woff2 fonts missing"
fi

pnpm -C "$ROOT_DIR/packages/ui" test:visual

cat > "$EVIDENCE_DIR/summary.json" <<JSON
{
  "taskId": "P24-T6",
  "result": "PASS",
  "pass": true
}
JSON
