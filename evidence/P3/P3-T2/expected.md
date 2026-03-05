# P3-T2 — POST /admin/volumes (create) + GET /admin/volumes (Expected)

## Goal
- Admin can create a volume with `name` + absolute `base_path`.
- Admin can list volumes and see the created one.

## SSOT
- OpenAPI: `paths./admin/volumes.post`, `paths./admin/volumes.get`
- DB: `x-db.tables.volumes`

## Checks
1) Create volume
- Expect: HTTP 201
- Expect body:
  - `id` is uuid string
  - `name` matches request
  - `base_path` matches normalized absolute path
  - `is_active == false`
  - `status == "OK"`

2) List volumes
- Expect: HTTP 200
- Expect body:
  - `.items` is array
  - created volume `id` is present in `.items[]`
