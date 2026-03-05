# P17-T5 Trash Evidence

## Goal
- 휴지통 목록이 비어 있을 때 빈 상태 문구를 표시한다.
- 휴지통 항목을 복원/영구삭제 요청할 수 있다.

## Checks
- `pnpm -C packages/ui test`
  - FolderView 빈 상태에서 msg.emptyTrash 표시
  - nodes.trash API: list/restore/delete 요청 성공
