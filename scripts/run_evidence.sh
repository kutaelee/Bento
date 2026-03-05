#!/usr/bin/env bash
set -euo pipefail

# Evidence runner (CI entrypoint)
#
# Scopes:
# - full:    run all evidence scripts
# - api:     run API/DB evidence subset
# - ui:      run ui_fast + optional ui_task (if TASK_ID/--task exists)
# - ui_fast: run only fast UI checks (no DB)
# - ui_task: run only one task evidence script (requires TASK_ID/--task; if missing, degrades to ui_fast)
# - ui_full: legacy broad UI suite (P13~P20)

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if ! command -v pnpm >/dev/null 2>&1; then
  if command -v corepack >/dev/null 2>&1; then
    corepack enable >/dev/null 2>&1 || true
  fi
fi

if [ -f pnpm-lock.yaml ] && [ ! -d node_modules ]; then
  pnpm -w install --frozen-lockfile
fi

usage() {
  cat <<'USAGE'
Usage: scripts/run_evidence.sh [--scope <full|ui|api|ui_fast|ui_task|ui_full>] [--task Pxx-Ty]

Options:
  --scope <...>     Evidence scope selector.
  --task <Pxx-Ty>   Task ID for ui_task (or ui optional task execution)

Environment:
  EVIDENCE_SCOPE    Same as --scope (arg wins)
  TASK_ID           Same as --task (arg wins)
  EVIDENCE_REUSE_DB Local-only speed-up hint
USAGE
}

scope="${EVIDENCE_SCOPE:-full}"
TASK_ID_INPUT="${TASK_ID:-}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --scope)
      scope="${2:-}"
      shift 2
      ;;
    --task)
      TASK_ID_INPUT="${2:-}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage
      exit 1
      ;;
  esac
done

case "$scope" in
  full|ui|api|ui_fast|ui_task|ui_full)
    ;;
  *)
    echo "[evidence] unknown scope '$scope' -> fail-closed to full" >&2
    scope="full"
    ;;
esac

# Local CI parity preflight (1: pinned toolchain, 2: optional container parity, 3: frozen lockfile)
# Keep GitHub CI fast: apply only for local runs.
if [[ -z "${CI:-}" && -x scripts/ci_local.sh ]]; then
  bash scripts/ci_local.sh --preflight --container-if-available
fi

if [[ -n "${EVIDENCE_REUSE_DB:-}" ]]; then
  export COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-nimbus-drive}"
fi

# CI: reuse a single postgres container across tasks, isolate per task via DB cloning
if [[ -n "${CI:-}" ]]; then
  export EVIDENCE_REUSE_DB=1
fi

normalize_task_id() {
  local raw="$1"
  raw="${raw#UI-}"
  if [[ "$raw" =~ ^P[0-9]+-T[0-9]+$ ]]; then
    echo "$raw"
    return 0
  fi
  return 1
}

resolve_task_script() {
  local tid="$1"
  local piece="${tid%%-*}"
  local run_path="evidence/${piece}/${tid}/run.sh"
  local cmd_path="evidence/${piece}/${tid}/commands.sh"
  if [[ -f "$run_path" ]]; then
    echo "$run_path"
    return 0
  fi
  if [[ -f "$cmd_path" ]]; then
    echo "$cmd_path"
    return 0
  fi
  return 1
}

run_ui_fast() {
  echo "[evidence] ui_fast: openapi contract sanity"
  python3 - <<'PY'
import yaml

path = 'openapi/openapi.yaml'
with open(path, 'r', encoding='utf-8') as f:
    doc = yaml.safe_load(f)

if not isinstance(doc, dict):
    raise SystemExit('openapi-invalid:root-not-object')

paths = doc.get('paths')
if not isinstance(paths, dict):
    raise SystemExit('openapi-invalid:paths-missing')

required_paths = [
    '/nodes/{node_id}/children',
    '/nodes/{node_id}/download',
    '/uploads',
]

missing = [p for p in required_paths if p not in paths]
if missing:
    raise SystemExit('openapi-missing-required-paths:' + ','.join(missing))

print('openapi-contract-ok')
PY
  echo "[evidence] ui_fast: pnpm -C packages/ui typecheck"
  pnpm -C packages/ui run typecheck
  echo "[evidence] ui_fast: pnpm -C packages/ui-kit lint"
  pnpm -C packages/ui-kit run lint
  echo "[evidence] ui_fast: pnpm -C packages/ui lint"
  pnpm -C packages/ui run lint
  echo "[evidence] ui_fast: /files smoke test"
  pnpm -C packages/ui exec vitest run src/app/FilesPage.spec.tsx
  echo "[evidence] ui_fast: core e2e + basic a11y via visual harness"
  VISUAL_DIFF_MODE=structure VISUAL_PIXEL_ALLOWLIST=/files pnpm -C packages/ui run test:visual
}

run_legacy_p26_non_blocking() {
  local legacy_script="evidence/P26/P26-T2/run.sh"
  local legacy_report="evidence/P26/P26-T2/legacy-gate-report.json"

  if [[ ! -f "$legacy_script" ]]; then
    return 0
  fi

  set +e
  bash "$legacy_script"
  local legacy_exit=$?
  set -e

  python3 - "$legacy_report" "$legacy_exit" <<'PY'
import json
import os
import sys
from datetime import datetime, timezone

report_path = sys.argv[1]
exit_code = int(sys.argv[2])

payload = {
    "gate": "P26",
    "task": "P26-T2",
    "policy": "legacy gate (pre-new-UI SSOT), non-blocking",
    "blocking": False,
    "status": "PASS" if exit_code == 0 else "FAIL",
    "exitCode": exit_code,
    "timestamp": datetime.now(timezone.utc).isoformat(),
}

os.makedirs(os.path.dirname(report_path), exist_ok=True)
with open(report_path, 'w', encoding='utf-8') as f:
    json.dump(payload, f, ensure_ascii=False, indent=2)
    f.write('\n')
PY

  if [[ "$legacy_exit" -ne 0 ]]; then
    echo "[evidence] non-blocking legacy gate failure: P26-T2 (pre-new-UI SSOT)" >&2
  else
    echo "[evidence] non-blocking legacy gate pass: P26-T2 (pre-new-UI SSOT)"
  fi
}

EFFECTIVE_TASK_ID=""
if normalize_task_id "$TASK_ID_INPUT" >/dev/null 2>&1; then
  EFFECTIVE_TASK_ID="$(normalize_task_id "$TASK_ID_INPUT")"
fi

EVID_SCRIPTS=()
UI_FAST_ONLY=0
SCOPE_REASON=""

case "$scope" in
  full)
    mapfile -t EVID_SCRIPTS < <(
      find evidence -type f \( -name 'commands.sh' -o -name 'run.sh' \) \
        ! -path 'evidence/P26/*' \
        -print | LC_ALL=C sort
    )
    SCOPE_REASON="full: explicit/full-failclosed"
    ;;
  ui_full)
    mapfile -t EVID_SCRIPTS < <(
      find evidence \( \
        -path 'evidence/P13/*' -o \
        -path 'evidence/P14/*' -o \
        -path 'evidence/P15/*' -o \
        -path 'evidence/P16/*' -o \
        -path 'evidence/P17/*' -o \
        -path 'evidence/P18/*' -o \
        -path 'evidence/P19/*' -o \
        -path 'evidence/P20/*' \
      \) -type f \( -name 'commands.sh' -o -name 'run.sh' \) -print | LC_ALL=C sort
    )
    SCOPE_REASON="ui_full: legacy broad UI suite P13~P20"
    ;;
  api)
    mapfile -t EVID_SCRIPTS < <(
      find evidence -type f \( -name 'commands.sh' -o -name 'run.sh' \) \
        ! -path 'evidence/P13/*' \
        ! -path 'evidence/P14/*' \
        ! -path 'evidence/P15/*' \
        ! -path 'evidence/P16/*' \
        ! -path 'evidence/P17/*' \
        ! -path 'evidence/P18/*' \
        ! -path 'evidence/P19/*' \
        ! -path 'evidence/P20/*' \
        ! -path 'evidence/P26/*' \
        -print | LC_ALL=C sort
    )
    SCOPE_REASON="api: non-UI subset"
    ;;
  ui_fast)
    UI_FAST_ONLY=1
    SCOPE_REASON="ui_fast: fast UI checks only"
    ;;
  ui_task)
    if [[ -n "$EFFECTIVE_TASK_ID" ]] && task_script="$(resolve_task_script "$EFFECTIVE_TASK_ID" 2>/dev/null)"; then
      if [[ "$task_script" == evidence/P26/* ]]; then
        UI_FAST_ONLY=1
        SCOPE_REASON="ui_task: legacy-p26-non-blocking + ui_fast(${EFFECTIVE_TASK_ID})"
      else
        EVID_SCRIPTS=("$task_script")
        SCOPE_REASON="ui_task: task-only ${EFFECTIVE_TASK_ID}"
      fi
    else
      UI_FAST_ONLY=1
      SCOPE_REASON="ui_task degraded to ui_fast: taskid missing/invalid"
      echo "[evidence] task missing => ui_fast only (taskid missing/invalid)" >&2
    fi
    ;;
  ui)
    if [[ -n "$EFFECTIVE_TASK_ID" ]] && task_script="$(resolve_task_script "$EFFECTIVE_TASK_ID" 2>/dev/null)"; then
      if [[ "$task_script" == evidence/P26/* ]]; then
        UI_FAST_ONLY=1
        SCOPE_REASON="ui: ui_fast + legacy-p26-non-blocking(${EFFECTIVE_TASK_ID})"
      else
        EVID_SCRIPTS=("$task_script")
        SCOPE_REASON="ui: ui_fast + ui_task(${EFFECTIVE_TASK_ID})"
      fi
    else
      UI_FAST_ONLY=1
      SCOPE_REASON="ui: ui_fast only (taskid missing)"
      echo "[evidence] taskid missing => ui_fast only" >&2
    fi
    ;;
esac

echo "[evidence] scope=$scope"
echo "[evidence] reason=$SCOPE_REASON"
if [[ -n "$EFFECTIVE_TASK_ID" ]]; then
  echo "[evidence] task_id=$EFFECTIVE_TASK_ID"
else
  echo "[evidence] task_id=none"
fi

debug_tail() {
  echo "[evidence] ERROR: dumping server.log tails (best-effort)" >&2

  if [[ -n "${EVIDENCE_CURRENT_TASK_DIR:-}" ]]; then
    # Prefer noise-free debug for the last task we attempted.
    echo "[evidence] debug: current_task_dir=${EVIDENCE_CURRENT_TASK_DIR}" >&2
    ls -la "${EVIDENCE_CURRENT_TASK_DIR}" >&2 || true
    find "${EVIDENCE_CURRENT_TASK_DIR}" -maxdepth 3 -type f -print >&2 2>/dev/null || true

    for f in \
      "${EVIDENCE_CURRENT_TASK_DIR}/actual/logs/server.log" \
      "${EVIDENCE_CURRENT_TASK_DIR}/actual/logs/server_start_failed.txt" \
      "${EVIDENCE_CURRENT_TASK_DIR}/actual/logs/jq_missing.txt" \
      "${EVIDENCE_CURRENT_TASK_DIR}/actual/logs/openapi_lint.txt" \
      "${EVIDENCE_CURRENT_TASK_DIR}/.typecheck.log" \
      "${EVIDENCE_CURRENT_TASK_DIR}/.lint.log" \
      "${EVIDENCE_CURRENT_TASK_DIR}/.test.log" \
      "${EVIDENCE_CURRENT_TASK_DIR}/.visual.log" \
      ; do
      if [[ -f "$f" ]]; then
        echo "--- $f" >&2
        tail -n 200 "$f" >&2 || true
      fi
    done
    return 0
  fi

  find evidence -path "*/actual/logs/server.log" -type f -print0 2>/dev/null \
    | xargs -0 -I{} sh -c "echo --- {}; tail -n 200 {}" 2>/dev/null || true
}
trap debug_tail ERR

TASK_IS_UI=0
if [[ -n "$EFFECTIVE_TASK_ID" ]] && [[ "$EFFECTIVE_TASK_ID" =~ ^P([0-9]+)-T[0-9]+$ ]]; then
  piece_num="${BASH_REMATCH[1]}"
  if (( piece_num >= 13 )); then
    TASK_IS_UI=1
  fi
fi

if [[ "$scope" == "ui" || "$scope" == "ui_fast" ]]; then
  run_ui_fast
elif [[ "$scope" == "ui_task" && "$TASK_IS_UI" == "1" ]]; then
  # ui_task for UI pieces keeps fast UI guardrails.
  run_ui_fast
fi

if [[ ${#EVID_SCRIPTS[@]} -gt 0 ]]; then
  echo "[evidence] selected scripts (${#EVID_SCRIPTS[@]}):"
  for s in "${EVID_SCRIPTS[@]}"; do
    echo "  - $s"
  done

  for s in "${EVID_SCRIPTS[@]}"; do
    echo "[evidence] START $s" >&2
    echo "[evidence] running: $s"
    export EVIDENCE_CURRENT_TASK_DIR="$(dirname "$s")"

    # Per-task DB isolation (global postgres container, per-task database)
    if [[ "$scope" == "full" || "$scope" == "api" || "$scope" == "ui_full" ]]; then
      if [[ "$s" =~ evidence/(P[0-9]+)/((UI-)?P[0-9]+-T[0-9]+)/ ]]; then
        TASK_ID_FOR_DB="${BASH_REMATCH[2]}"
        TASK_ID_FOR_DB="${TASK_ID_FOR_DB#UI-}"
        NIMBUS_DB="$(bash scripts/ensure_test_db.sh "$TASK_ID_FOR_DB" 2>/dev/null)"
        export NIMBUS_DB
      fi
    fi

    pkill -f "node scripts/dev_server.mjs" >/dev/null 2>&1 || true
    sleep 0.1
    set +e
    bash "$s"
    code=$?
    set -e
    if [[ $code -ne 0 ]]; then
      echo "[evidence] FAIL $s exit=${code}" >&2
      exit $code
    fi
  done
fi

if [[ "$scope" == "full" || "$scope" == "ui" || "$scope" == "ui_fast" || "$scope" == "ui_task" || "$scope" == "ui_full" ]]; then
  run_legacy_p26_non_blocking
fi

EVID_DIRS=()
if [[ ${#EVID_SCRIPTS[@]} -gt 0 ]]; then
  mapfile -t EVID_DIRS < <(
    for s in "${EVID_SCRIPTS[@]}"; do
      [[ -z "$s" ]] && continue
      dirname "$s"
    done | LC_ALL=C sort -u
  )
fi

export EVIDENCE_SUMMARY_PATHS="$(printf '%s\n' "${EVID_DIRS[@]/%//summary.json}")"
export EVIDENCE_SCOPE_EFFECTIVE="$scope"
export EVIDENCE_TASK_EFFECTIVE="$EFFECTIVE_TASK_ID"

python3 - <<'PY'
import json
import os
from glob import glob

summary_paths = [
    line.strip()
    for line in os.environ.get('EVIDENCE_SUMMARY_PATHS', '').splitlines()
    if line.strip()
]

scope = os.environ.get('EVIDENCE_SCOPE_EFFECTIVE', '')
task = os.environ.get('EVIDENCE_TASK_EFFECTIVE', '')

if not summary_paths and scope not in ('ui_fast', 'ui', 'ui_task'):
    summary_paths = [
        p for p in sorted(glob('evidence/**/summary.json', recursive=True))
        if os.path.normpath(p) != os.path.normpath('evidence/summary.json')
    ]

summaries = []
for path in summary_paths:
    if os.path.normpath(path) == os.path.normpath('evidence/summary.json'):
        continue
    try:
        with open(path, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except Exception:
        data = None
    summaries.append({'path': path, 'summary': data})

if scope in ('ui_fast', 'ui', 'ui_task') and len(summaries) == 0:
    out = {
        'pass': True,
        'result': 'PASS',
        'mode': 'ui_fast_only',
        'taskId': task or None,
        'summaries': [],
    }
else:
    overall_pass = True
    for s in summaries:
        sm = s['summary']
        if not isinstance(sm, dict) or sm.get('result') != 'PASS':
            overall_pass = False
    out = {
        'pass': overall_pass,
        'result': 'PASS' if overall_pass else 'FAIL',
        'summaries': summaries,
    }
    if len(summaries) == 0:
        raise SystemExit('No evidence/**/summary.json found (nothing produced)')

os.makedirs('evidence', exist_ok=True)
legacy_path = 'evidence/P26/P26-T2/legacy-gate-report.json'
if os.path.exists(legacy_path):
    try:
        with open(legacy_path, 'r', encoding='utf-8') as f:
            out['legacyGates'] = [json.load(f)]
    except Exception:
        out['legacyGates'] = [{'gate': 'P26', 'status': 'UNKNOWN', 'blocking': False}]

with open('evidence/summary.json', 'w', encoding='utf-8') as f:
    json.dump(out, f, indent=2, sort_keys=True)
    f.write('\n')
print('[evidence] wrote evidence/summary.json')
PY

echo "[evidence] done"
