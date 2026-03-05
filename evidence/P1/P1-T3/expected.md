# P1-T3 — GET /health

## Goal
- Public health check endpoint returns schema-valid `SuccessResponse`.

## SSOT
- OpenAPI: `paths./health.get`
- Schema: `components.schemas.SuccessResponse`

## Required Evidence
- `GET /health` returns HTTP 200
- Response JSON satisfies:
  - `.ok == true`
  - no extra top-level fields (only `ok`)

## How to Run
- `bash evidence/P1/P1-T3/run.sh`
