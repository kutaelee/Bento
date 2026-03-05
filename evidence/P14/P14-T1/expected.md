# P14-T1 Token Absorption(SSOT 기반 토큰 흡수)

## 목표
- `design/stitch/ko-kr_final/ui-kit_tokens/`에서 `ui-kit`가 사용할 핵심 토큰을 흡수한다.
- 하드코딩 숫자/색상 대신 토큰과 CSS 변수로 읽을 수 있어야 한다.

## 검증 방식
- 커맨드:
  - `pnpm -C packages/ui-kit storybook:build`
  - `pnpm -C packages/ui-kit test`
- 기대 결과:
  - Storybook build PASS
  - 토큰 테스트 PASS
  - `summary.json`의 `pass=true`, `result="PASS"`
