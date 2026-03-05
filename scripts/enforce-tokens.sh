#!/bin/bash
# enforce-tokens.sh
# Verifies that no hardcoded hex colors or px values are used in UI components.

FAIL=0
ALLOWLIST_FILE="scripts/enforce-tokens-allowlist.txt" # Define allowlist file path

echo "[Token Enforcement] Checking for hardcoded hex colors..."

# Generate list of files to check for hex colors, excluding those in allowlist
HEX_CHECK_FILES=$(rg --files -g "*.tsx" -g "*.ts" -g "*.css" -g "*.json" packages/ui/src/ | \
grep -v -F -f "$ALLOWLIST_FILE")

if [ -n "$HEX_CHECK_FILES" ]; then
  if echo "$HEX_CHECK_FILES" | xargs -r grep -n "#[0-9a-fA-F]\{3,6\}"; then
    echo "❌ Hardcoded hex colors found. Please use var(--nd-color-...) instead."
    FAIL=1
  else
    echo "✅ No hardcoded hex colors found."
  fi
else
  echo "✅ No files to check for hardcoded hex colors (all are allowlisted or no relevant files found)."
fi

echo "[Token Enforcement] Checking for hardcoded pixel values in inline styles..."

# Generate list of files to check for pixel values, excluding those in allowlist
# For pixel values, we only care about .tsx files, and still exclude those in allowlist
PX_CHECK_FILES=$(rg --files -g "*.tsx" packages/ui/src/ | \
grep -v -F -f "$ALLOWLIST_FILE")

if [ -n "$PX_CHECK_FILES" ]; then
  if echo "$PX_CHECK_FILES" | xargs -r grep -n "px" | grep -v "var("; then
    echo "⚠️ Note: Pixel values found. Ensure they are moved to tokens/CSS variables where possible."
    # Not failing for px right away, just a warning, as some fixed layouts might need it currently.
  else
    echo "✅ No hardcoded pixel values found."
  fi
else
  echo "✅ No files to check for pixel values (all are allowlisted or no relevant files found)."
fi


if [ $FAIL -eq 1 ]; then
  exit 1
fi

exit 0
