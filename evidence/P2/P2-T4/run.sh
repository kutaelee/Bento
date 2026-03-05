#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
EVID_DIR="$ROOT_DIR/evidence/P2/P2-T4"
ACT_HTTP="$EVID_DIR/actual/http"
ACT_LOGS="$EVID_DIR/actual/logs"

mkdir -p "$ACT_HTTP" "$ACT_LOGS"

cd "$ROOT_DIR"
docker compose -f compose.yaml up -d postgres

for _ in {1..60}; do
  if docker compose -f compose.yaml exec -T postgres pg_isready -U nimbus -d ${NIMBUS_DB:-nimbus_drive} >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

for _ in {1..60}; do
  if docker compose -f compose.yaml exec -T postgres psql -U nimbus -d ${NIMBUS_DB:-nimbus_drive} -tAc "SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='invites'" 2>/dev/null | grep -q 1; then
    break
  fi
  sleep 1
done

PORT="$(python3 - <<'PY'
import socket
s = socket.socket()
s.bind(('', 0))
port = s.getsockname()[1]
s.close()
print(port)
PY
)"
(
  cd "$ROOT_DIR"
  PORT="$PORT" node scripts/dev_server.mjs \
    >"$ACT_LOGS/server.log" 2>&1 &
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

for _ in {1..20}; do
  if curl -sSf "http://localhost:${PORT}/health" >/dev/null 2>&1; then
    break
  fi
  sleep 0.1
done

if ! command -v jq >/dev/null 2>&1; then
  echo "jq is required" >"$ACT_LOGS/jq_missing.txt"
  exit 1
fi

# Seed initial admin (creator)
RAW_SETUP="$ACT_HTTP/setup_admin.body.raw.json"

curl -sS -o "$RAW_SETUP" -w "%{http_code}" \
  -H 'content-type: application/json' \
  -d '{"username":"admin","password":"CorrectHorseBatteryStaple","display_name":"Admin","locale":"en-US"}' \
  "http://localhost:${PORT}/setup/admin" \
  >"$ACT_HTTP/setup_admin.status.txt"

if [[ "$(cat "$ACT_HTTP/setup_admin.status.txt")" != "201" ]]; then
  echo "expected setup/admin 201" >"$ACT_HTTP/setup_admin.assert.txt"
  cat "$RAW_SETUP" >>"$ACT_HTTP/setup_admin.assert.txt" || true
  exit 1
fi

# Login as admin for bearerAuth
RAW_LOGIN="$ACT_HTTP/login.body.raw.json"

curl -sS -o "$RAW_LOGIN" -w "%{http_code}" \
  -H 'content-type: application/json' \
  -d '{"username":"admin","password":"CorrectHorseBatteryStaple"}' \
  "http://localhost:${PORT}/auth/login" \
  >"$ACT_HTTP/login.status.txt"

if [[ "$(cat "$ACT_HTTP/login.status.txt")" != "200" ]]; then
  echo "expected login 200" >"$ACT_HTTP/login.assert.txt"
  cat "$RAW_LOGIN" >>"$ACT_HTTP/login.assert.txt" || true
  exit 1
fi

ACCESS_TOKEN="$(jq -r '.tokens.access_token' "$RAW_LOGIN")"
if [[ -z "$ACCESS_TOKEN" || "$ACCESS_TOKEN" == "null" ]]; then
  echo "missing tokens.access_token" >"$ACT_HTTP/login.assert.txt"
  exit 1
fi

# 1) Create invite
RAW_INVITE="$ACT_HTTP/invite_001.body.raw.json"

curl -sS -o "$RAW_INVITE" -w "%{http_code}" \
  -H "authorization: Bearer ${ACCESS_TOKEN}" \
  -H 'content-type: application/json' \
  -d '{}' \
  "http://localhost:${PORT}/admin/invites" \
  >"$ACT_HTTP/invite_001.status.txt"

STATUS_1="$(cat "$ACT_HTTP/invite_001.status.txt")"
if [[ "$STATUS_1" != "201" ]]; then
  echo "expected status 201, got $STATUS_1" >"$ACT_HTTP/invite_001.assert.txt"
  cat "$RAW_INVITE" >>"$ACT_HTTP/invite_001.assert.txt" || true
  exit 1
fi

INVITE_TOKEN="$(jq -r '.token' "$RAW_INVITE")"
if [[ -z "$INVITE_TOKEN" || "$INVITE_TOKEN" == "null" ]]; then
  echo "missing token" >"$ACT_HTTP/invite_001.assert.txt"
  exit 1
fi

jq -e '(.id|length)>10 and (.token|length)>20 and (.expires_at|length)>10 and (.created_at|length)>10' \
  "$RAW_INVITE" >"$ACT_HTTP/invite_001.assert.txt" 2>&1

jq '(.token)="REDACTED"' "$RAW_INVITE" >"$ACT_HTTP/invite_001.body.json"
rm -f "$RAW_INVITE"

# 2) Accept invite (create new user)
RAW_ACCEPT="$ACT_HTTP/accept_invite_001.body.raw.json"

curl -sS -o "$RAW_ACCEPT" -w "%{http_code}" \
  -H 'content-type: application/json' \
  -d "{\"token\":\"${INVITE_TOKEN}\",\"username\":\"invited_user\",\"password\":\"NewUserPassw0rd!\",\"display_name\":\"Invited\"}" \
  "http://localhost:${PORT}/auth/accept-invite" \
  >"$ACT_HTTP/accept_invite_001.status.txt"

STATUS_2="$(cat "$ACT_HTTP/accept_invite_001.status.txt")"
if [[ "$STATUS_2" != "201" ]]; then
  echo "expected status 201, got $STATUS_2" >"$ACT_HTTP/accept_invite_001.assert.txt"
  cat "$RAW_ACCEPT" >>"$ACT_HTTP/accept_invite_001.assert.txt" || true
  exit 1
fi

jq -e '.user.username=="invited_user" and (.tokens.access_token|length)>20 and (.tokens.refresh_token|length)>20 and .tokens.token_type=="Bearer"' \
  "$RAW_ACCEPT" >"$ACT_HTTP/accept_invite_001.assert.txt" 2>&1

jq \
  '(.user.id)="REDACTED" |
   (.user.created_at)="REDACTED" |
   (.user.last_login_at)="REDACTED" |
   (.tokens.access_token)="REDACTED" |
   (.tokens.refresh_token)="REDACTED"' \
  "$RAW_ACCEPT" >"$ACT_HTTP/accept_invite_001.body.json"
rm -f "$RAW_ACCEPT"

# 3) Reuse invite token must fail (409)
curl -sS -o "$ACT_HTTP/accept_invite_002.body.json" -w "%{http_code}" \
  -H 'content-type: application/json' \
  -d "{\"token\":\"${INVITE_TOKEN}\",\"username\":\"invited_user2\",\"password\":\"NewUserPassw0rd!\"}" \
  "http://localhost:${PORT}/auth/accept-invite" \
  >"$ACT_HTTP/accept_invite_002.status.txt"

STATUS_3="$(cat "$ACT_HTTP/accept_invite_002.status.txt")"
if [[ "$STATUS_3" != "409" ]]; then
  echo "expected status 409, got $STATUS_3" >"$ACT_HTTP/accept_invite_002.assert.txt"
  cat "$ACT_HTTP/accept_invite_002.body.json" >>"$ACT_HTTP/accept_invite_002.assert.txt" || true
  exit 1
fi

jq -e '.error.code and .error.message' "$ACT_HTTP/accept_invite_002.body.json" >"$ACT_HTTP/accept_invite_002.assert.txt" 2>&1

python3 - <<PY
import json, os
EVID_DIR = os.environ.get('EVID_DIR')
ACT_HTTP = os.environ.get('ACT_HTTP')
out = {
  'piece_id': 'P2',
  'task_id': 'P2-T4',
  'result': 'PASS',
  'pass': True,
  'checks': [
    {
      'name': 'create_invite_201',
      'expected': 'POST /admin/invites returns 201 + Invite with token/expires_at/created_at',
      'actual_path': 'evidence/P2/P2-T4/actual/http/invite_001.assert.txt',
      'pass': True,
    },
    {
      'name': 'accept_invite_201',
      'expected': 'POST /auth/accept-invite returns 201 + {user,tokens}',
      'actual_path': 'evidence/P2/P2-T4/actual/http/accept_invite_001.assert.txt',
      'pass': True,
    },
    {
      'name': 'invite_reuse_409',
      'expected': 'Invite token reuse fails with 409',
      'actual_path': 'evidence/P2/P2-T4/actual/http/accept_invite_002.assert.txt',
      'pass': True,
    },
  ],
  'artifacts': {
    'run_sh': 'evidence/P2/P2-T4/run.sh',
    'expected_md': 'evidence/P2/P2-T4/expected.md',
    'cases': [
      'evidence/P2/P2-T4/cases/P2-T4-INVITE-001.case.yaml',
      'evidence/P2/P2-T4/cases/P2-T4-ACCEPT-INVITE-001.case.yaml',
      'evidence/P2/P2-T4/cases/P2-T4-ACCEPT-INVITE-002.case.yaml',
    ],
    'actual': {
      'http': {
        'invite_assert': 'evidence/P2/P2-T4/actual/http/invite_001.assert.txt',
        'accept_assert': 'evidence/P2/P2-T4/actual/http/accept_invite_001.assert.txt',
        'reuse_assert': 'evidence/P2/P2-T4/actual/http/accept_invite_002.assert.txt',
      },
      'logs': {
        'server': 'evidence/P2/P2-T4/actual/logs/server.log',
      }
    }
  }
}
path = os.path.join('evidence','P2','P2-T4','summary.json')
os.makedirs(os.path.dirname(path), exist_ok=True)
with open(path,'w',encoding='utf-8') as f:
  json.dump(out,f,indent=2,sort_keys=True)
  f.write('\n')
print('wrote', path)
PY
