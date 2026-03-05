# P2-T1. POST /auth/login — Expected (PASS)

## Goal
- Implement login per SSOT `openapi/openapi.yaml`:
  - `paths./auth/login.post`
  - `components.schemas.LoginRequest`
  - `components.schemas.AuthTokens`
  - `components.schemas.User`

## Required Evidence
1) **login success**
- Seed an initial admin via `POST /setup/admin`
- `POST /auth/login` with correct credentials returns **200**
- body contains:
  - `.user.id/.user.username/.user.role/.user.locale/.user.created_at`
  - `.tokens.access_token/.tokens.refresh_token/.tokens.token_type == "Bearer"/.tokens.expires_in_seconds`

2) **wrong password**
- `POST /auth/login` with wrong password returns **401**
