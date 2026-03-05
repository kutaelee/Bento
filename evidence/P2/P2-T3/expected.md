# P2-T3 Evidence (POST /auth/logout)

## 목표
- SSOT: `paths./auth/logout.post`
- logout 이후, 해당 세션의 refresh token이 더 이상 유효하지 않아야 한다.

## Evidence
1) `POST /auth/logout` → **200** + `{ "ok": true }`
2) 기존 refresh_token으로 `POST /auth/refresh` → **401**
