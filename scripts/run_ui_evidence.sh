#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)

usage() {
  cat <<'USAGE'
Usage: scripts/run_ui_evidence.sh [--self-test] [--out <dir>] [--cmd <command>]...

Options:
  --self-test          Run harness smoke test and write evidence bundle.
  --out <dir>          Evidence output directory (required unless --self-test).
  --cmd <command>      Command to execute (repeatable). Each command output logs to actual/logs.
USAGE
}

self_test=false
out_dir=""
commands=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --self-test)
      self_test=true
      shift
      ;;
    --out)
      if [[ $# -lt 2 || -z "${2:-}" ]]; then
        echo "--out requires a value" >&2
        usage
        exit 1
      fi
      out_dir="$2"
      shift 2
      ;;
    --cmd)
      if [[ $# -lt 2 || -z "${2:-}" ]]; then
        echo "--cmd requires a value" >&2
        usage
        exit 1
      fi
      commands+=("$2")
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

if [[ "$self_test" == "true" ]]; then
  if [[ -z "$out_dir" ]]; then
    out_dir="$ROOT_DIR/evidence/P13/P13-T0"
  fi
  commands=("printf 'ui evidence harness self-test: ok\n'")
else
  if [[ -z "$out_dir" ]]; then
    echo "--out is required unless --self-test" >&2
    usage
    exit 1
  fi
  if [[ ${#commands[@]} -eq 0 ]]; then
    echo "At least one --cmd is required unless --self-test" >&2
    usage
    exit 1
  fi
fi

mkdir -p "$out_dir/actual/logs" "$out_dir/actual/fs" "$out_dir/cases"

checks_tmp=$(mktemp)
all_pass=true
index=0
for cmd in "${commands[@]}"; do
  index=$((index + 1))
  log_file="$out_dir/actual/logs/cmd_${index}.log"
  set +e
  bash -lc "$cmd" >"$log_file" 2>&1
  status=$?
  set -e
  if [[ $status -ne 0 ]]; then
    all_pass=false
  fi
  pass_value=true
  if [[ $status -ne 0 ]]; then
    pass_value=false
  fi
  NAME="cmd_${index}" ACTUAL="actual/logs/cmd_${index}.log" PASS="$pass_value" \
    python3 - <<'PY' >> "$checks_tmp"
import json, os
print(json.dumps({
  "name": os.environ["NAME"],
  "expected": "exit 0",
  "actual_path": os.environ["ACTUAL"],
  "pass": os.environ["PASS"] == "true",
}))
PY
done

piece_id=$(basename "$(dirname "$out_dir")")
task_id=$(basename "$out_dir")

result="PASS"
pass_bool="true"
if [[ "$all_pass" == "false" ]]; then
  result="FAIL"
  pass_bool="false"
fi

PASS_BOOL="$pass_bool" RESULT="$result" PIECE_ID="$piece_id" TASK_ID="$task_id" OUT_DIR="$out_dir" CHECKS_TMP="$checks_tmp" \
  python3 - <<'PY'
import json, os
checks = []
with open(os.environ["CHECKS_TMP"], "r", encoding="utf-8") as f:
  for line in f:
    if line.strip():
      checks.append(json.loads(line))

payload = {
  "piece_id": os.environ["PIECE_ID"],
  "task_id": os.environ["TASK_ID"],
  "result": os.environ["RESULT"],
  "pass": os.environ["PASS_BOOL"] == "true",
  "checks": checks,
}
with open(os.path.join(os.environ["OUT_DIR"], "summary.json"), "w", encoding="utf-8") as f:
  json.dump(payload, f, ensure_ascii=False, indent=2)
  f.write("\n")
PY

rm -f "$checks_tmp"

echo "UI evidence written to ${out_dir} (result=${result})"
