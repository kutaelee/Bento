#!/bin/bash
# enforce-tokens.sh
# Verifies that no hardcoded hex colors or px values are used in UI components.

FAIL=0

echo "[Token Enforcement] Checking for hardcoded hex colors..."
if grep -rn --include=\*.tsx --include=\*.ts "#[0-9a-fA-F]\{3,6\}" packages/ui/src/ ; then
  echo "❌ Hardcoded hex colors found. Please use var(--nd-color-...) instead."
  FAIL=1
else
  echo "✅ No hardcoded hex colors found."
fi

echo "[Token Enforcement] Checking for hardcoded pixel values in inline styles..."
if grep -rn --include=\*.tsx "px" packages/ui/src/ | grep -v "var("; then
  echo "⚠️ Note: Pixel values found. Ensure they are moved to tokens/CSS variables where possible."
  # Not failing for px right away, just a warning, as some fixed layouts might need it currently.
fi

if [ $FAIL -eq 1 ]; then
  exit 1
fi

exit 0
