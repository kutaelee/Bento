# P13-T4 API Client Skeleton(SSOT 기반 최소 래퍼)

## 목표
- API 호출을 단일 fetch 래퍼로 통일한다.
- 공통 헤더(Authorization, Accept-Language) 처리와 에러 키 매핑을 제공한다.

## 검증 방식
- 커맨드:
  - `pnpm -C packages/ui test`
- 기대 결과:
  - 테스트 PASS
  - `summary.json`의 `pass=true`, `result="PASS"`
