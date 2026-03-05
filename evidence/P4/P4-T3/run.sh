#!/usr/bin/env bash
set -euo pipefail

fail() {
  echo "[P4-T3] $1" >&2
}

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
EVID_DIR="$ROOT_DIR/evidence/P4/P4-T3"
ACT_HTTP="$EVID_DIR/actual/http"
ACT_LOGS="$EVID_DIR/actual/logs"

mkdir -p "$ACT_HTTP" "$ACT_LOGS"
cd "$ROOT_DIR"

if [[ -z "${EVIDENCE_REUSE_DB:-}" ]]; then docker compose -f compose.yaml down -v >/dev/null 2>&1 || true; fi
# In CI, volume removal can be flaky; force-remove any prior pgdata volume to guarantee clean setup state.
docker volume ls -q | grep -E '(^|_)nimbus-pgdata$' | xargs -r docker volume rm -f >/dev/null 2>&1 || true

docker compose -f compose.yaml up -d postgres

for _ in {1..60}; do
  if docker compose -f compose.yaml exec -T postgres pg_isready -U nimbus -d ${NIMBUS_DB:-nimbus_drive} >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

PORT="$(python3 - <<'PY'
import socket
s = socket.socket()
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

ready=""
for _ in {1..300}; do
  if curl -sSf "http://localhost:${PORT}/health" >/dev/null 2>&1; then
    ready="yes"
    break
  fi
  sleep 0.2
done
if [[ -z "$ready" ]]; then
  fail "server did not become ready in time"
  exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
  fail "jq is required"
  exit 1
fi

RAW_SETUP="$ACT_HTTP/setup_admin.body.raw.json"
SETUP_STATUS_FILE="$ACT_HTTP/setup_admin.status.txt"

# CI can occasionally report /health ready slightly before the setup route is fully ready.
# Retry setup a few times to avoid flaky failures.
setup_ok=""
for _ in {1..15}; do
  curl -sS -o "$RAW_SETUP" -w "%{http_code}" \
    -H 'content-type: application/json' \
    -d '{"username":"admin","password":"CorrectHorseBatteryStaple","display_name":"Admin","locale":"en-US"}' \
    "http://localhost:${PORT}/setup/admin" \
    >"$SETUP_STATUS_FILE" || true

  if [[ "$(cat "$SETUP_STATUS_FILE" || true)" == "201" ]]; then
    setup_ok="yes"
    break
  fi
  sleep 0.2
done

if [[ -z "$setup_ok" ]]; then
  fail "expected setup/admin 201"
  exit 1
fi

ACCESS_TOKEN="$(jq -r '.tokens.access_token' <"$RAW_SETUP")"
ROOT_ID="00000000-0000-0000-0000-000000000001"

create_folder() {
  local parent="$1" name="$2" out="$3"
  curl -sS -o "$out" -w "%{http_code}" \
    -H 'content-type: application/json' -H "authorization: Bearer ${ACCESS_TOKEN}" \
    -d "{\"parent_id\":\"${parent}\",\"name\":\"${name}\"}" \
    "http://localhost:${PORT}/nodes/folders" \
    >"${out%.json}.status.txt" || true
}

create_folder "$ROOT_ID" Docs "$ACT_HTTP/folder_docs.body.raw.json"
DOCS_ID="$(jq -r '.id' "$ACT_HTTP/folder_docs.body.raw.json")"
create_folder "$ROOT_ID" Archive "$ACT_HTTP/folder_archive.body.raw.json"
ARCHIVE_ID="$(jq -r '.id' "$ACT_HTTP/folder_archive.body.raw.json")"
create_folder "$DOCS_ID" Notes "$ACT_HTTP/folder_notes.body.raw.json"
NOTES_ID="$(jq -r '.id' "$ACT_HTTP/folder_notes.body.raw.json")"

cat > /tmp/rename-body.json <<JSON
{"new_name":"Journal"}
JSON
curl -sS -o "$ACT_HTTP/rename_notes.body.raw.json" -w "%{http_code}" \
  -H 'content-type: application/json' -H "authorization: Bearer ${ACCESS_TOKEN}" \
  --data-binary @/tmp/rename-body.json \
  "http://localhost:${PORT}/nodes/${NOTES_ID}/rename" \
  >"$ACT_HTTP/rename_notes.status.txt" || true
if [[ "$(cat "$ACT_HTTP/rename_notes.status.txt" || true)" != "200" ]]; then
  fail "expected rename 200"
  exit 1
fi
jq -e '.name=="Journal"' "$ACT_HTTP/rename_notes.body.raw.json" >"$ACT_HTTP/rename_notes.assert.txt"

JOURNAL_ID="$(jq -r '.id' "$ACT_HTTP/rename_notes.body.raw.json")"
cat > /tmp/move-body.json <<JSON
{"destination_parent_id":"$ARCHIVE_ID","new_name":"Daily"}
JSON
curl -sS -o "$ACT_HTTP/move_journal.body.raw.json" -w "%{http_code}" \
  -H 'content-type: application/json' -H "authorization: Bearer ${ACCESS_TOKEN}" \
  --data-binary @/tmp/move-body.json \
  "http://localhost:${PORT}/nodes/${JOURNAL_ID}/move" \
  >"$ACT_HTTP/move_journal.status.txt" || true
if [[ "$(cat "$ACT_HTTP/move_journal.status.txt" || true)" != "200" ]]; then
  fail "expected move 200"
  exit 1
fi
jq -e --arg pid "$ARCHIVE_ID" '.parent_id==$pid and .name=="Daily"' "$ACT_HTTP/move_journal.body.raw.json" >"$ACT_HTTP/move_journal.assert.txt"

cat > /tmp/copy-body.json <<JSON
{"destination_parent_id":"$DOCS_ID","new_name":"JournalCopy"}
JSON
curl -sS -o "$ACT_HTTP/copy_journal.body.raw.json" -w "%{http_code}" \
  -H 'content-type: application/json' -H "authorization: Bearer ${ACCESS_TOKEN}" \
  --data-binary @/tmp/copy-body.json \
  "http://localhost:${PORT}/nodes/${JOURNAL_ID}/copy" \
  >"$ACT_HTTP/copy_journal.status.txt" || true
COPY_STATUS="$(cat "$ACT_HTTP/copy_journal.status.txt" || true)"
if [[ "$COPY_STATUS" != "200" && "$COPY_STATUS" != "201" ]]; then
  fail "expected copy 200/201"
  exit 1
fi

COPY_ID="$(jq -r '.id' "$ACT_HTTP/copy_journal.body.raw.json")"
if [[ -z "$COPY_ID" || "$COPY_ID" == "null" ]]; then
  fail "copy response missing id"
  exit 1
fi
if [[ "$COPY_ID" == "$JOURNAL_ID" ]]; then
  fail "copy id equals source id"
  exit 1
fi
printf '{"copied_id":"%s","same_as_source":false,"parent_id":"%s"}' "$COPY_ID" "$DOCS_ID" > "$ACT_HTTP/copy_journal.assert.txt"

cat > "$EVID_DIR/summary.json" <<'JSON'
{
  "piece_id": "P4",
  "task_id": "P4-T3",
  "result": "PASS",
  "pass": true,
  "checks": [
    {"name": "rename", "expected": "rename returns 200 and updated name", "actual_path": "evidence/P4/P4-T3/actual/http/rename_notes.assert.txt", "pass": true},
    {"name": "move", "expected": "move returns 200 and updated parent/name", "actual_path": "evidence/P4/P4-T3/actual/http/move_journal.assert.txt", "pass": true},
    {"name": "copy", "expected": "copy returns 200/201 and new id", "actual_path": "evidence/P4/P4-T3/actual/http/copy_journal.assert.txt", "pass": true}
  ],
  "artifacts": {
    "cases": [
      "evidence/P4/P4-T3/cases/P4-T3-NODES-RENAME-001.case.yaml",
      "evidence/P4/P4-T3/cases/P4-T3-NODES-MOVE-001.case.yaml",
      "evidence/P4/P4-T3/cases/P4-T3-NODES-COPY-001.case.yaml"
    ],
    "expected_md": "evidence/P4/P4-T3/expected.md",
    "run_sh": "evidence/P4/P4-T3/run.sh",
    "actual": {
      "http": {
        "rename": "evidence/P4/P4-T3/actual/http/rename_notes.assert.txt",
        "move": "evidence/P4/P4-T3/actual/http/move_journal.assert.txt",
        "copy": "evidence/P4/P4-T3/actual/http/copy_journal.assert.txt"
      }
    }
  }
}
JSON
