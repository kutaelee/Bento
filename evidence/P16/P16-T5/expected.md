# P16-T5 Search Page Evidence

## Goal
- /search?q= 라우팅에서 검색 결과를 읽기 전용으로 표시한다.
- query param 변경 시 검색 요청은 디바운스되어 호출된다.

## Checks
- `pnpm -C packages/ui test`
  - SearchPage/디바운스 관련 스펙 통과
  - i18n 키/로케일 동기화 테스트 통과
