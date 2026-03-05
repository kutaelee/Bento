# P3-T3 — GET/PATCH /admin/system-mode (Expected)

## Goal
- `GET /admin/system-mode` returns the current SystemMode.
- `PATCH /admin/system-mode` updates the SystemMode.
- When `read_only=true`, mutating endpoints (e.g., `POST /admin/volumes`) are blocked.

## SSOT
- OpenAPI: `paths./admin/system-mode.*`
- State machine: `x-state-machines.SystemMode`
- DB: `x-db.tables.system_settings` key `READ_ONLY_MODE`

## Evidence
- cases:
  - `cases/P3-T3-SYSTEM-MODE-GET-001.case.yaml`
  - `cases/P3-T3-SYSTEM-MODE-PATCH-001.case.yaml`
  - `cases/P3-T3-READONLY-BLOCKS-MUTATION-001.case.yaml`
- `summary.json` result=PASS
