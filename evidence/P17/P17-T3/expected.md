# P17-T3 Move Evidence

## Goal
- 파일 탐색기에서 항목 이동 요청을 보낼 수 있다.
- 409 충돌(이름 중복) 응답을 err.conflict로 처리한다.

## Checks
- `pnpm -C packages/ui test`
  - nodes.moveNode API 스펙 테스트 통과
