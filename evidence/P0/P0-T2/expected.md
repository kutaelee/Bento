# P0-T2 — DB 마이그레이션 스켈레톤 + 필수 확장 설치 (Expected)

## Goal
- Postgres에 `ltree`, `pg_trgm` 확장이 설치되어 있어야 한다.
- `users` 테이블이 SSOT(x-db.tables.users) 기준으로 생성되어 있어야 한다.

## SSOT
- `openapi/openapi.yaml` → `x-db.extensions_required`, `x-db.tables.users`

## Checks
1) Extensions
- Command: `psql -c "\dx"`
- Expected: ltree, pg_trgm 표시

2) Users table
- Command: `psql -c "\d users"`
- Expected: users 테이블 스키마 출력 (id/username/role/locale/created_at 등)

## Evidence artifacts
- `run.sh`
- `actual/db/extensions.txt`
- `actual/db/users_schema.txt`
- `summary.json` (result=PASS)
