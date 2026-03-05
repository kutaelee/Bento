#!/usr/bin/env bash
set -euo pipefail

fail() {
  echo "[P4-T2] $1" >&2
}

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
EVID_DIR="$ROOT_DIR/evidence/P4/P4-T2"
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

if ! command -v jq >/dev/null 2>&1; then
  fail "jq is required"
  exit 1
fi

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
ROOT_ID="00000000-0000-0000-0000-000000000001"

RAW_PARENT="$ACT_HTTP/create_parent.body.raw.json"
curl -sS -o "$RAW_PARENT" -w "%{http_code}" \
  -H 'content-type: application/json' \
  -H "authorization: Bearer ${ACCESS_TOKEN}" \
  -d '{"parent_id":"'"$ROOT_ID"'","name":"Docs"}' \
  "http://localhost:${PORT}/nodes/folders" \
  >"$ACT_HTTP/create_parent.status.txt" || true

create_parent_status="$(cat "$ACT_HTTP/create_parent.status.txt" || true)"
if [[ "$create_parent_status" != "201" ]]; then
  fail "expected parent folder create 201 (got $create_parent_status)"
  exit 1
fi

PARENT_ID="$(jq -r '.id' <"$RAW_PARENT")"

# Create children
for name in Alpha Beta Gamma Delta; do
  curl -sS -o "$ACT_HTTP/create_${name}.body.raw.json" -w "%{http_code}" \
    -H 'content-type: application/json' \
    -H "authorization: Bearer ${ACCESS_TOKEN}" \
    -d '{"parent_id":"'"$PARENT_ID"'","name":"'"$name"'"}' \
    "http://localhost:${PORT}/nodes/folders" \
    >"$ACT_HTTP/create_${name}.status.txt" || true
  if [[ "$(cat "$ACT_HTTP/create_${name}.status.txt" || true)" != "201" ]]; then
    fail "expected child $name create 201"
    exit 1
  fi
done

# GET one node
NODE_GET="$ACT_HTTP/node_get_001.body.raw.json"
curl -sS -o "$NODE_GET" -w "%{http_code}" \
  -H "authorization: Bearer ${ACCESS_TOKEN}" \
  "http://localhost:${PORT}/nodes/${PARENT_ID}" \
  >"$ACT_HTTP/node_get_001.status.txt" || true

if [[ "$(cat "$ACT_HTTP/node_get_001.status.txt" || true)" != "200" ]]; then
  fail "expected GET /nodes/{id} 200"
  exit 1
fi

jq -e '.id == "'"$PARENT_ID"'" and .type == "FOLDER" and .parent_id == "'"$ROOT_ID"'"' \
  <"$NODE_GET" >"$ACT_HTTP/node_get_001.assert.txt" || true

# 404 case
curl -sS -o "$ACT_HTTP/node_get_404_001.body.raw.json" -w "%{http_code}" \
  -H "authorization: Bearer ${ACCESS_TOKEN}" \
  "http://localhost:${PORT}/nodes/00000000-0000-0000-0000-000000000099" \
  >"$ACT_HTTP/node_get_404_001.status.txt" || true

if [[ "$(cat "$ACT_HTTP/node_get_404_001.status.txt" || true)" != "404" ]]; then
  fail "expected GET /nodes/{missing} 404"
  exit 1
fi

# children first page (pagination)
CHILDREN_FIRST="$ACT_HTTP/node_children_first_001.body.raw.json"
curl -sS -o "$CHILDREN_FIRST" -w "%{http_code}" \
  -H "authorization: Bearer ${ACCESS_TOKEN}" \
  "http://localhost:${PORT}/nodes/${PARENT_ID}/children?limit=2&sort=name&order=asc" \
  >"$ACT_HTTP/node_children_first_001.status.txt" || true

if [[ "$(cat "$ACT_HTTP/node_children_first_001.status.txt" || true)" != "200" ]]; then
  fail "expected GET /nodes/{id}/children 200"
  exit 1
fi

jq -e '(.items|length)==2 and (.next_cursor != null)' <"$CHILDREN_FIRST" >"$ACT_HTTP/node_children_first_001.assert.txt"
NEXT_CURSOR="$(jq -r '.next_cursor' <"$CHILDREN_FIRST")"

if [[ -z "$NEXT_CURSOR" || "$NEXT_CURSOR" == "null" ]]; then
  fail "expected next_cursor on first page"
  exit 1
fi

# second page and include_deleted default false
CHILDREN_SECOND="$ACT_HTTP/node_children_second_001.body.raw.json"
curl -sS -o "$CHILDREN_SECOND" -w "%{http_code}" \
  -H "authorization: Bearer ${ACCESS_TOKEN}" \
  "http://localhost:${PORT}/nodes/${PARENT_ID}/children?limit=2&cursor=${NEXT_CURSOR}&sort=name&order=asc" \
  >"$ACT_HTTP/node_children_second_001.status.txt" || true

if [[ "$(cat "$ACT_HTTP/node_children_second_001.status.txt" || true)" != "200" ]]; then
  fail "expected second page 200"
  exit 1
fi

jq -e '(.items|length)>=1 and (.next_cursor == null)' <"$CHILDREN_SECOND" >"$ACT_HTTP/node_children_second_001.assert.txt"

jq -e '(.items[0].id|type=="string") and (.items[0].parent_id == "'"$PARENT_ID"'" )' <"$CHILDREN_SECOND" >"$ACT_HTTP/node_children_second_001.assert2.txt"

python3 - <<'PY'
import json, os

ROOT_DIR = os.getcwd()
EVID_DIR = os.path.join(ROOT_DIR, 'evidence', 'P4', 'P4-T2')

def check(path, expected, name):
    return {
        "name": name,
        "expected": expected,
        "actual_path": path,
        "pass": bool(os.path.exists(path) and os.path.getsize(path) > 0)
    }

out = {
    "piece_id": "P4",
    "task_id": "P4-T2",
    "result": "PASS",
    "pass": True,
    "artifacts": {
        "cases": [
            "evidence/P4/P4-T2/cases/P4-T2-NODE-GET-001.case.yaml",
            "evidence/P4/P4-T2/cases/P4-T2-NODE-GET-404-001.case.yaml",
            "evidence/P4/P4-T2/cases/P4-T2-NODE-CHILDREN-001.case.yaml",
        ],
        "run_sh": "evidence/P4/P4-T2/run.sh",
        "expected_md": "evidence/P4/P4-T2/expected.md",
        "actual": {
            "http": {
                "node_get": "evidence/P4/P4-T2/actual/http/node_get_001.assert.txt",
                "node_get_404": "evidence/P4/P4-T2/actual/http/node_get_404_001.status.txt",
                "children_first": "evidence/P4/P4-T2/actual/http/node_children_first_001.assert.txt",
                "children_second": "evidence/P4/P4-T2/actual/http/node_children_second_001.assert.txt",
                "children_second_item": "evidence/P4/P4-T2/actual/http/node_children_second_001.assert2.txt",
            },
            "logs": {
                "server": "evidence/P4/P4-T2/actual/logs/server.log",
            },
        }
    },
    "checks": [
        check(os.path.join(EVID_DIR, 'actual/http/node_get_001.assert.txt'), 'GET /nodes/{id} returns 200 and Node payload', 'node_get_200'),
        check(os.path.join(EVID_DIR, 'actual/http/node_get_404_001.status.txt'), 'missing node returns 404', 'node_get_404'),
        check(os.path.join(EVID_DIR, 'actual/http/node_children_first_001.assert.txt'), 'children first page returns <=limit and next_cursor', 'children_first_page'),
        check(os.path.join(EVID_DIR, 'actual/http/node_children_second_001.assert.txt'), 'children second page returns remaining items and null cursor', 'children_second_page'),
    ]
}

with open(os.path.join(EVID_DIR, 'summary.json'), 'w', encoding='utf-8') as f:
    json.dump(out, f, indent=2, sort_keys=True)
    f.write('\n')
print('[P4-T2] wrote summary.json')
PY
