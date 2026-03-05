#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
cd "$ROOT"

TASK_DIR="evidence/P18/P18-T3"
ACTUAL_DIR="$TASK_DIR/actual"
FIX1="packages/ui-kit/src/__p18_t3_rel_fixture__.ts"
FIX2="packages/ui-kit/src/deep/nested/__p18_t3_deep_fixture__.ts"
FIX3="packages/ui-kit/src/__p18_t3_subpath_fixture__.ts"
mkdir -p "$ACTUAL_DIR" "$(dirname "$FIX2")"

cleanup() {
  rm -f "$FIX1" "$FIX2" "$FIX3"
}
trap cleanup EXIT

cat > "$FIX1" <<'TS'
import { FilesPage } from '../../ui/src/app/FilesPage';
export const a = FilesPage;
TS

cat > "$FIX2" <<'TS'
import { FilesPage } from '../../../../ui/src/app/FilesPage';
export const b = FilesPage;
TS

cat > "$FIX3" <<'TS'
import { apiFetch } from '@nimbus/ui/src/api/client';
export const c = apiFetch;
TS

set +e
pnpm -C packages/ui-kit exec eslint "src/__p18_t3_rel_fixture__.ts" "src/deep/nested/__p18_t3_deep_fixture__.ts" "src/__p18_t3_subpath_fixture__.ts" > "$ACTUAL_DIR/lint-fixtures.log" 2>&1
rc=$?
set -e
if [ $rc -eq 0 ]; then
  echo "fixture lint was expected to fail but passed" >&2
  exit 1
fi
if ! grep -E "no-restricted-imports|모듈 경계" "$ACTUAL_DIR/lint-fixtures.log" >/dev/null; then
  echo "fixture lint failed, but not by boundary rule" >&2
  cat "$ACTUAL_DIR/lint-fixtures.log" >&2
  exit 1
fi

rm -f "$FIX1" "$FIX2" "$FIX3"
trap - EXIT

# Real-code boundary pass check: ui-kit source must not import ui package/path.
if grep -R -nE "@nimbus/ui(/|$)|packages/ui|(\.\./)+ui/" packages/ui-kit/src > "$ACTUAL_DIR/forbidden-imports.log"; then
  echo "forbidden ui import found in ui-kit source" >&2
  cat "$ACTUAL_DIR/forbidden-imports.log" >&2
  exit 1
fi

cat > "$TASK_DIR/summary.json" <<'JSON'
{
  "taskId": "P18-T3",
  "result": "PASS",
  "pass": true,
  "checks": [
    "fixtures(relative/deep/subpath) lint FAIL by no-restricted-imports",
    "ui-kit source has no forbidden ui import paths"
  ]
}
JSON

echo "P18-T3 PASS"
