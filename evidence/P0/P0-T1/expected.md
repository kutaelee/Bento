# P0-T1 — OpenAPI SSOT 로드/검증 게이트 (Expected)

## Goal
- `openapi/openapi.yaml`이 파싱 가능해야 한다.
- OpenAPI 스키마 lint/validate가 CLI로 재현 가능해야 한다.
- `/health` 엔드포인트에 대해 최소 1개 contract case가 PASS해야 한다.

## SSOT
- `openapi/openapi.yaml` (전체)

## Checks
1) OpenAPI validate
- Command: `npx -y @redocly/cli lint openapi/openapi.yaml`
- Expected: exit code 0

2) Health contract
- Request: `GET http://localhost:<random_port>/health`
- Expected:
  - HTTP 200
  - JSON: `.ok == true` and `.run_id == <RUN_ID>`

## Evidence artifacts
- `cases/P0-T1-OPENAPI-001.case.yaml`
- `run.sh`
- `actual/http/health.status.txt`, `actual/http/health.body.json`
- `actual/logs/server.log`
- `summary.json` (result=PASS)
