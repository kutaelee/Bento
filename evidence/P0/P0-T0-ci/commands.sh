#!/usr/bin/env bash
set -euo pipefail

# 1) Git status clean (no changes)
if [[ -n "$(git status --porcelain)" ]]; then
  echo "git status not clean"
  git status --porcelain
  exit 1
fi

OUT="evidence/P0/P0-T0-ci/output.txt"
TMP="$(mktemp)"

# 2) OpenAPI YAML parse
python3 -c "import yaml; yaml.safe_load(open('openapi/openapi.yaml'))" >>"$TMP"

# 3) Record tracked files added (sanity)
git ls-files .github/workflows/ci.yml README.md >>"$TMP"

# 4) Ensure CI fails if evidence runner missing
if ! grep -q "scripts/run_evidence.sh not found; failing" .github/workflows/ci.yml; then
  echo "CI missing fail-on-no-runner guard" >&2
  exit 1
fi

cat "$TMP" > "$OUT"
rm -f "$TMP"
