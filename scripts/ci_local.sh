#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

NODE_PIN="20.11.1"
PNPM_PIN="9.1.1"
USE_CONTAINER="0"
CONTAINER_IF_AVAILABLE="0"
PREFLIGHT_ONLY="0"

usage() {
  cat <<USAGE
Usage: scripts/ci_local.sh [--preflight] [--container] [--container-if-available] [-- <command>]

Options:
  --preflight               Run local CI preflight only (node/pnpm pin + frozen lockfile)
  --container               Force dockerized preflight/command (fails if docker unavailable)
  --container-if-available  Use docker when available, otherwise host
  --                        Command to run after preflight
USAGE
}

CMD=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    --preflight) PREFLIGHT_ONLY="1"; shift ;;
    --container) USE_CONTAINER="1"; shift ;;
    --container-if-available) CONTAINER_IF_AVAILABLE="1"; shift ;;
    -h|--help) usage; exit 0 ;;
    --) shift; CMD=("$@"); break ;;
    *) CMD+=("$1"); shift ;;
  esac
done

preflight_host() {
  command -v corepack >/dev/null 2>&1 || { echo "corepack is required" >&2; return 1; }
  corepack enable >/dev/null 2>&1 || true
  corepack prepare "pnpm@${PNPM_PIN}" --activate >/dev/null 2>&1 || true

  node_v="$(node -v | sed 's/^v//')"
  pnpm_v="$(pnpm -v)"
  if [[ "$node_v" != "$NODE_PIN" ]]; then
    echo "[ci_local] warning: node version is ${node_v} (expected ${NODE_PIN})" >&2
  fi
  if [[ "$pnpm_v" != "$PNPM_PIN" ]]; then
    echo "[ci_local] warning: pnpm version is ${pnpm_v} (expected ${PNPM_PIN})" >&2
  fi

  pnpm install --frozen-lockfile --prefer-offline
}

preflight_container() {
  docker run --rm \
    -v "$ROOT_DIR:/work" -w /work \
    node:${NODE_PIN} \
    bash -lc "corepack enable && corepack prepare pnpm@${PNPM_PIN} --activate && node -v && pnpm -v && pnpm install --frozen-lockfile --prefer-offline"
}

run_command_host() {
  if [[ ${#CMD[@]} -gt 0 ]]; then
    "${CMD[@]}"
  fi
}

run_command_container() {
  if [[ ${#CMD[@]} -gt 0 ]]; then
    joined="$(printf '%q ' "${CMD[@]}")"
    docker run --rm -v "$ROOT_DIR:/work" -w /work node:${NODE_PIN} bash -lc "corepack enable && corepack prepare pnpm@${PNPM_PIN} --activate && ${joined}"
  fi
}

if [[ "$CONTAINER_IF_AVAILABLE" == "1" && "$USE_CONTAINER" == "0" ]]; then
  if command -v docker >/dev/null 2>&1; then
    USE_CONTAINER="1"
  fi
fi

if [[ "$USE_CONTAINER" == "1" ]]; then
  command -v docker >/dev/null 2>&1 || { echo "docker not found" >&2; exit 1; }
  preflight_container
  [[ "$PREFLIGHT_ONLY" == "1" ]] || run_command_container
else
  preflight_host
  [[ "$PREFLIGHT_ONLY" == "1" ]] || run_command_host
fi
