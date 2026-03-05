# P1-T1 — GET /setup/status (Expected)

## Goal
- DB가 비어있을 때 `setup_required=true`를 반환해야 한다.

## SSOT
- OpenAPI: `paths./setup/status.get`
- DB: `x-db.tables.users`

## Checks
1) Status
- Command: `curl -s -o /tmp/body.json -w "%{http_code}" http://localhost:<random_port>/setup/status`
- Expected: HTTP 200

2) Body
- Command: `jq -e '.setup_required == true' /tmp/body.json`
- Expected: true

## Evidence artifacts
- `cases/P1-T1-SETUP-STATUS-001.case.yaml`
- `run.sh`
- `actual/http/setup_status.status.txt`, `actual/http/setup_status.body.json`
- `summary.json` (result=PASS)
