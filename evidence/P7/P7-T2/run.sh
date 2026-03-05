#!/usr/bin/env bash
set -euo pipefail

fail() {
  echo "[P7-T2] $1" >&2
  exit 1
}

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
EVID_DIR="$ROOT_DIR/evidence/P7/P7-T2"
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
fi

ROOT_ID="00000000-0000-0000-0000-000000000001"

create_folder() {
  local parent="$1" name="$2" out="$3"
  curl -sS -o "$out" -w "%{http_code}" \
    -H 'content-type: application/json' -H "authorization: Bearer ${ACCESS_TOKEN}" \
    -d "{\"parent_id\":\"${parent}\",\"name\":\"${name}\"}" \
    "http://localhost:${PORT}/nodes/folders" \
    >"${out%.json}.status.txt" || true
}

NAME="RestoreMe-$(date +%s)"
create_folder "$ROOT_ID" "$NAME" "$ACT_HTTP/folder.body.raw.json"
NODE_ID="$(jq -r '.id' "$ACT_HTTP/folder.body.raw.json")"
if [[ -z "$NODE_ID" || "$NODE_ID" == "null" ]]; then
  fail "folder creation failed"
fi

authz=(-H "authorization: Bearer ${ACCESS_TOKEN}")

curl -sS -X DELETE -o "$ACT_HTTP/delete.body.raw.json" -w "%{http_code}" \
  "${authz[@]}" \
  "http://localhost:${PORT}/nodes/${NODE_ID}" \
  >"$ACT_HTTP/delete.status.txt" || true

if [[ "$(cat "$ACT_HTTP/delete.status.txt" || true)" != "200" ]]; then
  fail "expected delete 200"
fi

curl -sS -X POST -o "$ACT_HTTP/restore.body.raw.json" -w "%{http_code}" \
  "${authz[@]}" \
  "http://localhost:${PORT}/trash/${NODE_ID}/restore" \
  >"$ACT_HTTP/restore.status.txt" || true

if [[ "$(cat "$ACT_HTTP/restore.status.txt" || true)" != "200" ]]; then
  fail "expected restore 200"
fi

if ! jq -e ".id == \"${NODE_ID}\"" "$ACT_HTTP/restore.body.raw.json" >/dev/null; then
  fail "restore response id mismatch"
fi

curl -sS -o "$ACT_HTTP/trash_list.body.raw.json" -w "%{http_code}" \
  "${authz[@]}" \
  "http://localhost:${PORT}/trash?limit=10" \
  >"$ACT_HTTP/trash_list.status.txt" || true

if [[ "$(cat "$ACT_HTTP/trash_list.status.txt" || true)" != "200" ]]; then
  fail "expected /trash 200"
fi

if jq -e "([.items[].id] | any(. == \"${NODE_ID}\"))" "$ACT_HTTP/trash_list.body.raw.json" >/dev/null; then
  fail "restored node id still present in /trash"
fi

curl -sS -o "$ACT_HTTP/get_restored.body.raw.json" -w "%{http_code}" \
  "${authz[@]}" \
  "http://localhost:${PORT}/nodes/${NODE_ID}" \
  >"$ACT_HTTP/get_restored.status.txt" || true

if [[ "$(cat "$ACT_HTTP/get_restored.status.txt" || true)" != "200" ]]; then
  fail "expected get restored node 200"
fi

cat > "$EVID_DIR/summary.json" <<JSON
{
  "piece_id": "P7",
  "task_id": "P7-T2",
  "result": "PASS",
  "pass": true,
  "checks": [
    {"name": "delete_node", "expected": "delete returns 200/ok", "actual_path": "evidence/P7/P7-T2/actual/http/delete.status.txt", "pass": true},
    {"name": "restore_node", "expected": "restore returns 200 and node JSON", "actual_path": "evidence/P7/P7-T2/actual/http/restore.status.txt", "pass": true},
    {"name": "trash_list_excludes_restored", "expected": "/trash no longer contains restored node", "actual_path": "evidence/P7/P7-T2/actual/http/trash_list.body.raw.json", "pass": true},
    {"name": "restored_node_fetchable", "expected": "GET /nodes/{id} returns 200 after restore", "actual_path": "evidence/P7/P7-T2/actual/http/get_restored.status.txt", "pass": true}
  ],
  "artifacts": {
    "cases": ["evidence/P7/P7-T2/cases/P7-T2-TRASH-RESTORE-001.case.yaml"],
    "expected_md": "evidence/P7/P7-T2/expected.md",
    "run_sh": "evidence/P7/P7-T2/run.sh",
    "actual": {
      "http": {
        "setup_status": "actual/http/setup_admin.status.txt",
        "delete": "actual/http/delete.status.txt",
        "restore": "actual/http/restore.status.txt",
        "trash_list": "actual/http/trash_list.body.raw.json",
        "get_restored": "actual/http/get_restored.status.txt"
      },
      "logs": {"server": "actual/logs/server.log"}
    }
  }
}
JSON
