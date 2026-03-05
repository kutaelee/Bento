# P2-T2. POST /auth/refresh (rotation)

## Goal
- Refresh token으로 새로운 access/refresh 토큰을 발급한다.
- SSOT 정책: `x-constants.auth.refresh_token_rotation: true` 이므로 **refresh token은 사용 시 회전(rotating)** 되어야 하며,
  동일 refresh token 재사용은 실패해야 한다.

## SSOT References
- OpenAPI: `paths./auth/refresh.post`
- Schema: `components.schemas.RefreshRequest`, `components.schemas.AuthTokens`
- Constants: `x-constants.auth.refresh_token_rotation`

## Required Evidence
- 200: refresh 성공 시 `AuthTokens` 반환
- 401: 기존 refresh token 재사용 시 실패 (rotation 적용)
