# P15-T3 — Session Refresh + Logout (무한루프 방지)

## Goal
- API 호출이 401을 받으면 refresh 토큰으로 1회 갱신을 시도하고, 성공 시 원 요청을 1회 재시도한다.
- refresh 실패 시 토큰을 정리하고 onAuthFailure 콜백을 호출한다.
- refresh/logout 자체 요청에서는 refresh 재시도를 하지 않는다(무한루프 방지).

## Evidence
- `pnpm -C packages/ui test`

Expected:
- `packages/ui/src/api/client.refresh.spec.ts` 테스트 PASS
