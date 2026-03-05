#!/usr/bin/env bash
set -euo pipefail

TASK="P20-T1"
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
EVDIR="$ROOT/evidence/P20/$TASK"
SUMMARY="$EVDIR/summary.json"

check() {
  local path="$1"
  local label="$2"
  if [[ ! -f "$path" ]]; then
    echo "missing:$label:$path"
    return 1
  fi
}

check "$ROOT/packages/ui-kit/src/tokens/spacing.ts" "spacing-tokens"
check "$ROOT/packages/ui-kit/src/tokens/shadows.ts" "shadow-tokens"
check "$ROOT/packages/ui-kit/src/tokens/index.ts" "token-index"

python3 - "$ROOT/packages/ui-kit/src/tokens/index.ts" "$ROOT/packages/ui-kit/src/tokens/spacing.ts" "$ROOT/packages/ui-kit/src/tokens/shadows.ts" "$ROOT/packages/ui-kit/src/styles/global.css" <<'PY'
from pathlib import Path
import re
import sys

index_path, spacing_path, shadows_path, global_css_path = sys.argv[1:]
index_text = Path(index_path).read_text(encoding='utf-8')
spacing_text = Path(spacing_path).read_text(encoding='utf-8')
shadows_text = Path(shadows_path).read_text(encoding='utf-8')
global_text = Path(global_css_path).read_text(encoding='utf-8')

if "spacing = {" not in spacing_text or "shadows = {" not in shadows_text:
    print("invalid-token-file")
    raise SystemExit(1)

# Ensure both tokens are present as keys in tokens map.
match = re.search(r"export\s+const\s+tokens\s*:\s*NimbusTokenCollection\s*=\s*\{(.*?)\}", index_text, re.S)
if match is None:
    print("missing-index-tokens-object")
    raise SystemExit(1)
tokens_body = match.group(1)
for token in ("spacing", "shadows"):
    if re.search(rf"\b{token}\b\s*,", tokens_body) is None and re.search(rf"\b{token}\b\s*:\s*{token}\b", tokens_body) is None:
        print(f"missing-index-token-map:{token}")
        raise SystemExit(1)

# Ensure named exports include both tokens as real identifiers.
match_exports = re.search(r"export\s*\{([^}]*)\}", index_text, re.S)
if match_exports is None:
    print("missing-index-exports")
    raise SystemExit(1)
export_body = match_exports.group(1)
for token in ("spacing", "shadows"):
    if re.search(rf"\b{token}\b", export_body) is None:
        print(f"missing-index-named-export:{token}")
        raise SystemExit(1)

for v in ("--nd-space-4", "--nd-shadow-md", "--nd-space-16", "--nd-shadow-lg"):
    if v not in global_text:
        print(f"missing-css-var:{v}")
        raise SystemExit(1)

print("ok")
PY

cat > "$SUMMARY" <<JSON
{
  "taskId": "$TASK",
  "status": "PASS",
  "result": "PASS",
  "pass": true,
  "details": "spacing/shadow tokens are explicitly wired in exports and CSS variables"
}
JSON

echo "[$TASK] PASS"
