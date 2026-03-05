# P18-T1 Typed API Types Evidence

## Goal
- OpenAPI 스키마 기반 타입을 생성하고 UI API 레이어가 이를 참조하도록 한다.

## Checks
- `pnpm -C packages/ui typecheck`
  - OpenAPI 타입 참조 후 타입 오류가 없는지 확인
