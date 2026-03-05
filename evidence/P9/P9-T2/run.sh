#!/usr/bin/env bash
set -euo pipefail

fail() {
  echo "[P9-T2] $1" >&2
}

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
EVID_DIR="$ROOT_DIR/evidence/P9/P9-T2"
ACT_HTTP="$EVID_DIR/actual/http"
ACT_LOGS="$EVID_DIR/actual/logs"

mkdir -p "$ACT_HTTP" "$ACT_LOGS"
cd "$ROOT_DIR"

cleanup_stale_servers() {
  stale_pids="$(pgrep -af "node scripts/dev_server.mjs" | awk '{print $1}' || true)"
  if [[ -n "$stale_pids" ]]; then
    echo "[P9-T2] stale dev_server process detected; stopping before evidence run" >&2
    while read -r pid; do
      [[ -z "$pid" ]] && continue
      kill "$pid" 2>/dev/null || true
    done <<<"$stale_pids"
    sleep 0.5
  fi
}

cleanup_stale_servers

if [[ -z "${EVIDENCE_REUSE_DB:-}" ]]; then docker compose -f compose.yaml down -v >/dev/null 2>&1 || true; fi
docker compose -f compose.yaml up -d postgres

for _ in {1..60}; do
  if docker compose -f compose.yaml exec -T postgres pg_isready -U nimbus -d ${NIMBUS_DB:-nimbus_drive} >/dev/null 2>&1; then
    break
  fi
  sleep 1
  if [[ "$_" == "60" ]]; then
    fail "postgres not ready"
    exit 1
  fi
done

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

ready=""
for _ in {1..300}; do
  if curl -sSf "http://localhost:${PORT}/health" >/dev/null 2>&1; then
    ready="yes"
    break
  fi
  sleep 0.2
  done
if [[ -z "$ready" ]]; then
  fail "server did not become ready"
  exit 1
fi

RAW_SETUP="$ACT_HTTP/setup_admin.body.raw.json"
setup_status=""
for _ in {1..20}; do
  curl -sS -o "$RAW_SETUP" -w "%{http_code}" \
    -H 'content-type: application/json' \
    -d '{"username":"admin","password":"CorrectHorseBatteryStaple","display_name":"Admin","locale":"en-US"}' \
    "http://localhost:${PORT}/setup/admin" \
    >"$ACT_HTTP/setup_admin.status.txt" || true
  setup_status="$(cat "$ACT_HTTP/setup_admin.status.txt" || true)"
  if [[ "$setup_status" == "201" ]]; then
    break
  fi
  sleep 0.2

done
if [[ "$setup_status" != "201" ]]; then
  fail "expected setup/admin 201"
  exit 1
fi
ACCESS_TOKEN="$(jq -r '.tokens.access_token' <"$RAW_SETUP")"
if [[ -z "$ACCESS_TOKEN" || "$ACCESS_TOKEN" == "null" ]]; then
  fail "missing access token"
  exit 1
fi

ROOT_ID="00000000-0000-0000-0000-000000000001"
RAW_PARENT="$ACT_HTTP/create_parent.body.raw.json"
curl -sS -o "$RAW_PARENT" -w "%{http_code}" \
  -H 'content-type: application/json' \
  -H "authorization: Bearer ${ACCESS_TOKEN}" \
  -d '{"parent_id":"'"$ROOT_ID"'","name":"AccessFolder"}' \
  "http://localhost:${PORT}/nodes/folders" \
  >"$ACT_HTTP/create_parent.status.txt" || true
if [[ "$(cat "$ACT_HTTP/create_parent.status.txt" || true)" != "201" ]]; then
  fail "parent create failed"
  exit 1
fi
NODE_ID="$(jq -r '.id' <"$RAW_PARENT")"

curl -sS -o "$ACT_HTTP/access_get.body.raw.json" -w "%{http_code}" \
  -H "authorization: Bearer ${ACCESS_TOKEN}" \
  "http://localhost:${PORT}/nodes/${NODE_ID}/access" \
  >"$ACT_HTTP/access_get.status.txt" || true

MISSING_NODE_ID="11111111-1111-1111-1111-111111111111"
curl -sS -o "$ACT_HTTP/access_missing.body.raw.json" -w "%{http_code}" \
  -H "authorization: Bearer ${ACCESS_TOKEN}" \
  "http://localhost:${PORT}/nodes/${MISSING_NODE_ID}/access" \
  >"$ACT_HTTP/access_missing.status.txt" || true

PASS1=false
PASS2=false
PASS3=false

if [[ "$(cat "$ACT_HTTP/access_get.status.txt" || true)" == "200" ]]; then PASS1=true; fi
if jq -e '.allowed | length == 4' "$ACT_HTTP/access_get.body.raw.json" >/dev/null 2>&1; then PASS2=true; fi
if [[ "$(cat "$ACT_HTTP/access_missing.status.txt" || true)" == "404" ]]; then PASS3=true; fi

if [[ "$PASS1" != "true" || "$PASS2" != "true" || "$PASS3" != "true" ]]; then
  cat > "$EVID_DIR/summary.json" <<JSON
{
  "piece_id": "P9",
  "task_id": "P9-T2",
  "result": "FAIL",
  "pass": false,
  "checks": [
    {"name":"access_get_200","expected":"GET /nodes/{node_id}/access returns 200","actual_path":"evidence/P9/P9-T2/actual/http/access_get.status.txt","pass": $PASS1},
    {"name":"access_get_all","expected":"allowed length == 4","actual_path":"evidence/P9/P9-T2/actual/http/access_get.body.raw.json","pass": $PASS2},
    {"name":"access_missing_404","expected":"missing node returns 404","actual_path":"evidence/P9/P9-T2/actual/http/access_missing.status.txt","pass": $PASS3}
  ],
  "artifacts": {
    "cases": [
      "evidence/P9/P9-T2/cases/P9-T2-ACCESS-001.case.yaml",
      "evidence/P9/P9-T2/cases/P9-T2-ACCESS-002.case.yaml"
    ],
    "run_sh": "evidence/P9/P9-T2/run.sh",
    "expected_md": "evidence/P9/P9-T2/expected.md",
    "actual": {
      "http": {
        "setup_admin": "evidence/P9/P9-T2/actual/http/setup_admin.status.txt",
        "create_parent": "evidence/P9/P9-T2/actual/http/create_parent.status.txt",
        "access_get": "evidence/P9/P9-T2/actual/http/access_get.status.txt",
        "access_missing": "evidence/P9/P9-T2/actual/http/access_missing.status.txt"
      },
      "logs": {
        "server": "evidence/P9/P9-T2/actual/logs/server.log"
      }
    }
  }
}
JSON
  fail "one or more checks failed"
  exit 1
fi

cat > "$EVID_DIR/summary.json" <<'JSON'
{
  "piece_id": "P9",
  "task_id": "P9-T2",
  "result": "PASS",
  "pass": true,
  "checks": [
    {"name":"access_get_200","expected":"GET /nodes/{node_id}/access returns 200","actual_path":"evidence/P9/P9-T2/actual/http/access_get.status.txt","pass": true},
    {"name":"access_get_all","expected":"allowed length == 4","actual_path":"evidence/P9/P9-T2/actual/http/access_get.body.raw.json","pass": true},
    {"name":"access_missing_404","expected":"missing node returns 404","actual_path":"evidence/P9/P9-T2/actual/http/access_missing.status.txt","pass": true}
  ],
  "artifacts": {
    "cases": [
      "evidence/P9/P9-T2/cases/P9-T2-ACCESS-001.case.yaml",
      "evidence/P9/P9-T2/cases/P9-T2-ACCESS-002.case.yaml"
    ],
    "run_sh": "evidence/P9/P9-T2/run.sh",
    "expected_md": "evidence/P9/P9-T2/expected.md",
    "actual": {
      "http": {
        "setup_admin": "evidence/P9/P9-T2/actual/http/setup_admin.status.txt",
        "create_parent": "evidence/P9/P9-T2/actual/http/create_parent.status.txt",
        "access_get": "evidence/P9/P9-T2/actual/http/access_get.status.txt",
        "access_missing": "evidence/P9/P9-T2/actual/http/access_missing.status.txt"
      },
      "logs": {
        "server": "evidence/P9/P9-T2/actual/logs/server.log"
      }
    }
  }
}
JSON
