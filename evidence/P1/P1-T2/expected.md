# P1-T2. POST /setup/admin (1회만)

## Goal
- 최초 관리자 1회 생성
- 이미 유저가 있으면 409 반환

## SSOT
- OpenAPI: `paths./setup/admin.post`
- Schema: `components.schemas.CreateAdminRequest`, `components.schemas.User`, `components.schemas.AuthTokens`
- DB: `x-db.tables.users`

## Required Evidence
- Case 1) create-admin: status 201, body contains `user.username`, `user.role == ADMIN`, `tokens.token_type == Bearer`
- Case 2) create-admin again: status 409
