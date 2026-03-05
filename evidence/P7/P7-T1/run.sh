#!/usr/bin/env bash
set -euo pipefail

fail() {
  echo "[P7-T1] $1" >&2
  exit 1
}

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
EVID_DIR="$ROOT_DIR/evidence/P7/P7-T1"
ACT_HTTP="$EVID_DIR/actual/http"
ACT_LOGS="$EVID_DIR/actual/logs"

mkdir -p "$ACT_HTTP" "$ACT_LOGS"
cd "$ROOT_DIR"

if [[ -z "${EVIDENCE_REUSE_DB:-}" ]]; then docker compose -f compose.yaml down -v >/dev/null 2>&1 || true; fi
docker compose -f compose.yaml up -d postgres

for _ in {1..60}; do
  if docker compose -f compose.yaml exec -T postgres pg_isready -U nimbus -d ${NIMBUS_DB:-nimbus_drive} >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

PORT="$(python3 - <<'PY'
import socket
s=socket.socket()
s.bind(('',0))
print(s.getsockname()[1])
s.close()
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

for _ in {1..300}; do
  if curl -sSf "http://localhost:${PORT}/health" >/dev/null 2>&1; then
    break
  fi
  sleep 0.2
done

if ! command -v jq >/dev/null 2>&1; then
  fail "jq is required"
  exit 1
fi

RAW_SETUP="$ACT_HTTP/setup_admin.body.raw.json"
SETUP_STATUS_FILE="$ACT_HTTP/setup_admin.status.txt"

get_admin_token() {
  local setup_status=""
  local token=""

  for _ in {1..15}; do
    setup_status="$(curl -sS -o "$RAW_SETUP" -w "%{http_code}" \
      -H 'content-type: application/json' \
      -d '{"username":"admin","password":"CorrectHorseBatteryStaple","display_name":"Admin","locale":"en-US"}' \
      "http://localhost:${PORT}/setup/admin" \
      2>/dev/null || true)"

    echo "$setup_status" > "$SETUP_STATUS_FILE"

    if [[ "$setup_status" == "201" ]]; then
      token="$(jq -r '.tokens.access_token' "$RAW_SETUP")"
      if [[ -n "$token" && "$token" != "null" ]]; then
        echo "$token"
        return 0
      fi
    fi

    if [[ "$setup_status" == "409" ]]; then
      break
    fi

    sleep 0.2
  done

  if [[ "$setup_status" == "409" ]]; then
    # fallback for already-initialized system
    local login_status
    login_status="$(curl -sS -o "$RAW_SETUP" -w "%{http_code}" \
      -H 'content-type: application/json' \
      -d '{"username":"admin","password":"CorrectHorseBatteryStaple"}' \
      "http://localhost:${PORT}/auth/login" \
      2>/dev/null || true)"
    echo "$login_status" > "$SETUP_STATUS_FILE"
    if [[ "$login_status" == "200" ]]; then
      token="$(jq -r '.tokens.access_token' "$RAW_SETUP")"
      if [[ -n "$token" && "$token" != "null" ]]; then
        echo "$token"
        return 0
      fi
    fi
  fi

  return 1
}

ACCESS_TOKEN="$(get_admin_token)"
if [[ -z "$ACCESS_TOKEN" || "$ACCESS_TOKEN" == "null" ]]; then
  fail "no access token"
  exit 1
fi

ROOT_ID="00000000-0000-0000-0000-000000000001"

create_node() {
  local parent="$1" name="$2" out="$3"
  curl -sS -o "$out" -w "%{http_code}" \
    -H 'content-type: application/json' -H "authorization: Bearer ${ACCESS_TOKEN}" \
    -d "{\"parent_id\":\"${parent}\",\"name\":\"${name}\"}" \
    "http://localhost:${PORT}/nodes/folders" \
    >"${out%.json}.status.txt" || true
}

create_node "$ROOT_ID" TrashFolder "$ACT_HTTP/folder_trash.body.raw.json"
TRASH_ID="$(jq -r '.id' "$ACT_HTTP/folder_trash.body.raw.json")"
if [[ -z "$TRASH_ID" || "$TRASH_ID" == "null" ]]; then
  fail "folder creation failed"
  exit 1
fi

curl -sS -X DELETE -o "$ACT_HTTP/delete_trash.body.raw.json" -w "%{http_code}" \
  -H "authorization: Bearer ${ACCESS_TOKEN}" \
  "http://localhost:${PORT}/nodes/${TRASH_ID}" \
  >"$ACT_HTTP/delete_trash.status.txt" || true

delete_code="$(cat "$ACT_HTTP/delete_trash.status.txt" || true)"
if [[ "$delete_code" != "200" ]]; then
  fail "expected delete 200"
  exit 1
fi
if ! jq -e '.ok == true' "$ACT_HTTP/delete_trash.body.raw.json" >/dev/null; then
  fail "delete response not ok"
fi

curl -sS -o "$ACT_HTTP/trash_list.body.raw.json" -w "%{http_code}" \
  -H "authorization: Bearer ${ACCESS_TOKEN}" \
  "http://localhost:${PORT}/trash?limit=10" \
  >"$ACT_HTTP/trash_list.status.txt" || true

trash_code="$(cat "$ACT_HTTP/trash_list.status.txt" || true)"
if [[ "$trash_code" != "200" ]]; then
  fail "expected /trash 200"
  exit 1
fi

jq -e "(.items | type == \"array\") and ([.items[].id] | any(. == \"$TRASH_ID\"))" "$ACT_HTTP/trash_list.body.raw.json" >/dev/null
if [[ $? -ne 0 ]]; then
  fail "deleted node id not found in /trash"
  exit 1
fi

curl -sS -o "$ACT_HTTP/get_deleted.body.raw.json" -w "%{http_code}" \
  -H "authorization: Bearer ${ACCESS_TOKEN}" \
  "http://localhost:${PORT}/nodes/${TRASH_ID}" \
  >"$ACT_HTTP/get_deleted.status.txt" || true

deleted_get="$(cat "$ACT_HTTP/get_deleted.status.txt" || true)"
if [[ "$deleted_get" != "404" ]]; then
  fail "expected get deleted node 404"
  exit 1
fi

cat > "$EVID_DIR/summary.json" <<'JSON'
{
  "piece_id": "P7",
  "task_id": "P7-T1",
  "result": "PASS",
  "pass": true,
  "checks": [
    {"name": "delete_node", "expected": "delete returns 200/ok", "actual_path": "evidence/P7/P7-T1/actual/http/delete_trash.status.txt", "pass": true},
    {"name": "trash_list_includes_node", "expected": "/trash contains deleted node", "actual_path": "evidence/P7/P7-T1/actual/http/trash_list.body.raw.json", "pass": true},
    {"name": "deleted_node_not_fetchable", "expected": "GET /nodes/{id} for deleted node returns 404", "actual_path": "evidence/P7/P7-T1/actual/http/get_deleted.status.txt", "pass": true}
  ],
  "artifacts": {
    "cases": [
      "evidence/P7/P7-T1/cases/P7-T1-NODES-DELETE-001.case.yaml"
    ],
    "expected_md": "evidence/P7/P7-T1/expected.md",
    "run_sh": "evidence/P7/P7-T1/run.sh",
    "actual": {
      "http": {
        "setup_status": "actual/http/setup_admin.status.txt",
        "delete": "actual/http/delete_trash.status.txt",
        "trash_list": "actual/http/trash_list.body.raw.json",
        "get_deleted": "actual/http/get_deleted.status.txt"
      },
      "logs": {
        "server": "actual/logs/server.log"
      }
    }
  }
}
JSON
