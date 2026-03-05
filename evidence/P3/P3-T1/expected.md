# P3-T1. POST /admin/volumes/validate-path — Expected (PASS)

## Goal
Validate a storage base path for Volume creation.

## SSOT
- OpenAPI: `paths./admin/volumes/validate-path.post`
- Schemas:
  - `components.schemas.ValidatePathRequest`
  - `components.schemas.ValidatePathResponse`

## Required Evidence
1) Invalid path returns 400 + ErrorResponse
- Request: `{ "base_path": "/this/path/should/not/exist" }`
- Expect:
  - HTTP 400
  - `.error.code` and `.error.message` present

2) Valid writable directory returns 200 + ValidatePathResponse
- Request: `{ "base_path": "<temp dir>" }`
- Expect:
  - HTTP 200
  - `.ok == true`
  - `.writable == true`
  - `.free_bytes >= 0` and `.total_bytes >= 0`
