# P13-T3 라우팅/내비 SSOT 스캐폴딩(IA_NAV 고정)

## 목표
- IA_NAV_SSOT에 정의된 라우팅 경로와 내비 구조를 코드로 고정한다.
- nav/routes 테스트로 순서/경로 불일치를 차단한다.

## 검증 방식
- 커맨드:
  - `pnpm -C packages/ui test`
- 기대 결과:
  - 테스트 PASS
  - `summary.json`의 `pass=true`, `result="PASS"`
