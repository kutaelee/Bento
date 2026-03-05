# P2-T4 Invite-only: POST /admin/invites + POST /auth/accept-invite

## Goal
Invite-only 가입 플로우를 구현/검증한다.

## SSOT
- OpenAPI:
  - `paths./admin/invites.post`
  - `paths./auth/accept-invite.post`
  - `components.schemas.Invite`
  - `components.schemas.AcceptInviteRequest`
  - `components.schemas.AuthTokens`
- DB:
  - `x-db.tables.invites`
  - `x-db.tables.users`

## Required Evidence (PASS 기준)
1) Admin으로 `POST /admin/invites` 호출 시 201
   - `.token` 이 1회성 invite token 문자열로 응답에 포함
   - `.expires_at` / `.created_at` 존재
2) `POST /auth/accept-invite` 호출 시 201
   - 신규 user 생성 + tokens 발급
3) 같은 invite token 재사용 시 실패(409)

모든 검증은 `scripts/run_evidence.sh`가 PASS여야 한다.
