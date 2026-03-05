# P17-T6 Upload Queue Evidence

## Goal
- 업로드 요청을 큐에 추가하고, 세션 생성 → 청크 업로드 → 완료 흐름을 수행한다.
- 업로드 진행 상태(진행률/상태/실패)를 UI에서 확인할 수 있다.

## Checks
- `pnpm -C packages/ui test`
  - uploadQueue: mock 파일 업로드 플로우(세션 생성/청크 업로드/완료) 검증
