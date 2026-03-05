# P17-T1 Create Folder Evidence

## Goal
- 파일 탐색기에서 새 폴더 생성을 요청할 수 있다.
- 409 충돌(이름 중복) 응답을 err.conflict로 처리한다.

## Checks
- `pnpm -C packages/ui test`
  - nodes.createFolder API 스펙 테스트 통과
