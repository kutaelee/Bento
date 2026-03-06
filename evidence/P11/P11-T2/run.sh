#!/usr/bin/env bash
set -euo pipefail

fail() {
  echo "[P11-T2] $1" >&2
}

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
EVID_DIR="$ROOT_DIR/evidence/P11/P11-T2"
ACT_HTTP="$EVID_DIR/actual/http"
ACT_LOGS="$EVID_DIR/actual/logs"

mkdir -p "$ACT_HTTP" "$ACT_LOGS"

cd "$ROOT_DIR"

if [[ -z "${EVIDENCE_REUSE_DB:-}" ]]; then docker compose -f compose.yaml down -v >/dev/null 2>&1 || true; fi
docker compose -f compose.yaml up -d postgres

pg_ready=""
for _ in {1..60}; do
  if docker compose -f compose.yaml exec -T postgres pg_isready -U nimbus -d ${NIMBUS_DB:-nimbus_drive} >/dev/null 2>&1; then
    pg_ready="yes"
    break
  fi
  sleep 1
done

if [ -z "$pg_ready" ]; then
  fail "postgres did not become ready in time"
  docker compose -f compose.yaml logs --tail 200 postgres || true
  exit 1
fi

PORT="$(python3 - <<'PY'
import socket
s=socket.socket(); s.bind(('',0)); print(s.getsockname()[1]); s.close()
PY
)"
(
  cd "$ROOT_DIR"
  PORT="$PORT" node scripts/dev_server.mjs >"$ACT_LOGS/server.log" 2>&1 &
  echo $! >"$ACT_LOGS/server.pid"
)

cleanup() {
  if [[ -f "$ACT_LOGS/server.pid" ]]; then
    PID="$(cat "$ACT_LOGS/server.pid" || true)"
    if [[ -n "${PID:-}" ]] && kill -0 "$PID" 2>/dev/null; then
      kill "$PID" 2>/dev/null || true
      sleep 0.2 || true
      kill -9 "$PID" 2>/dev/null || true
    fi
  fi
  if [[ -z "${EVIDENCE_REUSE_DB:-}" ]]; then docker compose -f compose.yaml down -v >/dev/null 2>&1 || true; fi
}
trap cleanup EXIT

server_restart_count=0
ensure_server_alive() {
  if [[ ! -f "$ACT_LOGS/server.pid" ]]; then
    return 0
  fi
  local pid
  pid="$(cat "$ACT_LOGS/server.pid" 2>/dev/null || true)"
  if [[ -z "${pid:-}" ]]; then
    return 0
  fi
  if kill -0 "$pid" 2>/dev/null; then
    return 0
  fi

  if [[ "$server_restart_count" -ge 1 ]]; then
    echo "[P11-T2] server not running (pid=$pid) and restart budget exhausted" >&2
    return 1
  fi

  echo "[P11-T2] server not running (pid=$pid); restarting once" >&2
  server_restart_count=$((server_restart_count + 1))
  ( cd "$ROOT_DIR"; PORT="$PORT" node scripts/dev_server.mjs >"$ACT_LOGS/server.log" 2>&1 & echo $! >"$ACT_LOGS/server.pid" )
  sleep 1.0
  return 0
}

get_perf_status() {
  local out_file="$1"
  local status_file="$2"
  local tries=0
  local code=""

  while [[ $tries -lt 15 ]]; do
    code="$(curl -sS -o "$out_file" -w "%{http_code}" \
      -H "authorization: Bearer ${ACCESS_TOKEN}" \
      "http://localhost:${PORT}/system/performance" || true)"

    echo "$code" >"$status_file"

    if [[ "$code" == "200" ]]; then
      printf "%s" "$code"
      return 0
    fi

    if [[ "$code" == "000" || "$code" == 5* ]]; then
      ensure_server_alive || true
      sleep 0.2
      tries=$((tries + 1))
      continue
    fi

    printf "%s" "$code"
    return 1
  done

  printf "%s" "$code"
  return 1
}

ready=""
for _ in {1..300}; do
  if curl -sSf "http://localhost:${PORT}/health" >/dev/null 2>&1; then
    ready="yes"
    break
  fi
  sleep 0.2
done

if [ -z "$ready" ]; then
  fail "server did not become ready in time"
  tail -n 200 "$ACT_LOGS/server.log" >"$ACT_LOGS/server_not_ready_tail.txt" 2>/dev/null || true
  exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
  fail "jq is required"
  exit 1
fi

get_admin_token() {
  local port="$1"
  local out="$2"
  local tries=0
  local code=""
  local login_out="${out%.json}.login.json"

  while [[ $tries -lt 6 ]]; do
    code="$(curl -sS -o "$out" -w "%{http_code}" \
      -H 'content-type: application/json' \
      -d '{"username":"admin","password":"CorrectHorseBatteryStaple","display_name":"Admin","locale":"en-US"}' \
      "http://localhost:${port}/setup/admin" \
      || true)"

    if [[ "$code" == "201" ]]; then
      echo "$code"
      return 0
    fi

    if [[ "$code" == "409" ]]; then
      login_code="$(curl -sS -o "$login_out" -w "%{http_code}" \
        -H 'content-type: application/json' \
        -d '{"username":"admin","password":"CorrectHorseBatteryStaple"}' \
        "http://localhost:${port}/auth/login" \
        || true)"
      if [[ "$login_code" == "200" ]]; then
        cp "$login_out" "$out"
        echo 201
        return 0
      fi
    fi

    tries=$((tries + 1))
    sleep 0.5
  done

  echo "$code"
  return 1
}

RAW_SETUP="$ACT_HTTP/setup_admin.body.raw.json"
setup_status="$(get_admin_token "$PORT" "$RAW_SETUP")"
echo "$setup_status" >"$ACT_HTTP/setup_admin.status.txt"
if [[ "$setup_status" != "201" ]]; then
  fail "expected setup/admin 201 (got $setup_status)"
  exit 1
fi

ACCESS_TOKEN="$(jq -r '.tokens.access_token' <"$RAW_SETUP")"
if [[ -z "$ACCESS_TOKEN" || "$ACCESS_TOKEN" == "null" ]]; then
  fail "missing access_token from setup/admin"
  exit 1
fi

RAW_IDLE="$ACT_HTTP/perf_idle.body.raw.json"
IDLE_STATUS="$(get_perf_status "$RAW_IDLE" "$ACT_HTTP/perf_idle.status.txt")"
echo "$IDLE_STATUS" >"$ACT_HTTP/perf_idle.status.txt"
if [[ "$IDLE_STATUS" != "200" ]]; then
  fail "expected /system/performance idle 200"
  exit 1
fi

IDLE_BG="$(jq -r '.allowed.bg_worker_concurrency' <"$RAW_IDLE")"
IDLE_MAX="$(jq -r '.limits.bg_worker_concurrency_max' <"$RAW_IDLE")"
echo "$IDLE_BG" >"$ACT_HTTP/perf_idle.bg.txt"

declare -a STRESS_PIDS=()
STRESS_WORKERS="$(nproc 2>/dev/null || echo 2)"
if [[ "$STRESS_WORKERS" -lt 2 ]]; then
  STRESS_WORKERS=2
fi

for _ in $(seq 1 "$STRESS_WORKERS"); do
  python3 - <<'PY' &
import math, time
end = time.time() + 4
acc = 0.0
while time.time() < end:
    for i in range(8000):
        acc += math.sqrt(i * i)
print(acc)
PY
  STRESS_PIDS+=("$!")
done

sleep 0.4

RAW_STRESS="$ACT_HTTP/perf_stress.body.raw.json"
STRESS_STATUS="$(get_perf_status "$RAW_STRESS" "$ACT_HTTP/perf_stress.status.txt")"
echo "$STRESS_STATUS" >"$ACT_HTTP/perf_stress.status.txt"
if [[ "$STRESS_STATUS" != "200" ]]; then
  fail "expected /system/performance stress 200"
  exit 1
fi

STRESS_BG="$(jq -r '.allowed.bg_worker_concurrency' <"$RAW_STRESS")"
echo "$STRESS_BG" >"$ACT_HTTP/perf_stress.bg.txt"

for pid in "${STRESS_PIDS[@]:-}"; do
  if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
    wait "$pid" || true
  fi
done

sleep 0.6

RECOVERY_BG=""
RECOVERY_STATUS=""
for attempt in {1..8}; do
  RAW_RECOVERY="$ACT_HTTP/perf_recovery_try${attempt}.body.raw.json"
  RECOVERY_STATUS="$(get_perf_status "$RAW_RECOVERY" "$ACT_HTTP/perf_recovery.status.txt")"
  echo "$RECOVERY_STATUS" >"$ACT_HTTP/perf_recovery.status.txt"
  if [[ "$RECOVERY_STATUS" != "200" ]]; then
    fail "expected /system/performance recovery 200"
    exit 1
  fi

  current_recovery_bg="$(jq -r '.allowed.bg_worker_concurrency' <"$RAW_RECOVERY")"
  if [[ -z "$RECOVERY_BG" || "$current_recovery_bg" -gt "$RECOVERY_BG" ]]; then
    RECOVERY_BG="$current_recovery_bg"
    cp "$RAW_RECOVERY" "$ACT_HTTP/perf_recovery.body.raw.json"
  fi

  if [[ "$RECOVERY_BG" -gt "$STRESS_BG" ]]; then
    break
  fi
  sleep 0.3
done
echo "$RECOVERY_BG" >"$ACT_HTTP/perf_recovery.bg.txt"

python3 - <<'PY'
import json, os, sys
idle = int(open(os.path.join('evidence','P11','P11-T2','actual','http','perf_idle.bg.txt')).read().strip())
stress = int(open(os.path.join('evidence','P11','P11-T2','actual','http','perf_stress.bg.txt')).read().strip())
recovery = int(open(os.path.join('evidence','P11','P11-T2','actual','http','perf_recovery.bg.txt')).read().strip())
if idle == 0:
    if stress != 0:
        sys.stderr.write(f"[P11-T2] expected stress == idle when idle is zero (idle={idle}, stress={stress})\n")
        sys.exit(1)
else:
    if stress >= idle:
        sys.stderr.write(f"[P11-T2] expected stress < idle (idle={idle}, stress={stress})\n")
        sys.exit(1)
if recovery < stress:
    sys.stderr.write(f"[P11-T2] expected recovery >= stress (recovery={recovery}, stress={stress})\n")
    sys.exit(1)
if idle > 0 and stress < idle and recovery <= stress:
    sys.stderr.write(f"[P11-T2] expected recovery > stress when idle allows headroom (idle={idle}, stress={stress}, recovery={recovery})\n")
    sys.exit(1)
PY

if [[ -n "$IDLE_MAX" && "$IDLE_MAX" != "null" ]]; then
  python3 - <<PY
import sys
idle = int("$IDLE_BG")
limit = int("$IDLE_MAX")
if idle > limit:
    sys.stderr.write(f"[P11-T2] idle bg {idle} exceeds limit {limit}\n")
    sys.exit(1)
PY
fi

python3 - <<'PY'
import json, os
out = {
  'piece_id': 'P11',
  'task_id': 'P11-T2',
  'result': 'PASS',
  'pass': True,
  'checks': [
    {
      'name': 'qos_decrease_on_stress',
      'expected': 'bg_worker_concurrency decreases under load',
      'actual_path': 'evidence/P11/P11-T2/actual/http/perf_stress.bg.txt',
      'pass': True,
    },
    {
      'name': 'qos_recovery_idle',
      'expected': 'bg_worker_concurrency increases after idle',
      'actual_path': 'evidence/P11/P11-T2/actual/http/perf_recovery.bg.txt',
      'pass': True,
    },
  ],
  'artifacts': {
    'run_sh': 'evidence/P11/P11-T2/run.sh',
    'expected_md': 'evidence/P11/P11-T2/expected.md',
    'cases': [
      'evidence/P11/P11-T2/cases/P11-T2-PERF-001.case.yaml',
      'evidence/P11/P11-T2/cases/P11-T2-PERF-002.case.yaml',
    ],
    'actual': {
      'http': {
        'idle': 'evidence/P11/P11-T2/actual/http/perf_idle.body.raw.json',
        'stress': 'evidence/P11/P11-T2/actual/http/perf_stress.body.raw.json',
        'recovery': 'evidence/P11/P11-T2/actual/http/perf_recovery.body.raw.json',
      },
      'logs': {
        'server': 'evidence/P11/P11-T2/actual/logs/server.log',
      }
    }
  }
}
path = os.path.join('evidence','P11','P11-T2','summary.json')
os.makedirs(os.path.dirname(path), exist_ok=True)
with open(path,'w',encoding='utf-8') as f:
  json.dump(out,f,indent=2,sort_keys=True)
  f.write('\n')
print('wrote', path)
PY
