# P17-T2 Rename Evidence

## Goal
- 파일 탐색기에서 항목 이름 변경 요청을 보낼 수 있다.
- 409 충돌(이름 중복) 응답을 err.conflict로 처리한다.

## Checks
- `pnpm -C packages/ui test`
  - nodes.renameNode API 스펙 테스트 통과
