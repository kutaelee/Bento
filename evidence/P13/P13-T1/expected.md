# P13-T1 FE/Storybook Workspace (Hello Shell)

## 목표
- FE 워크스페이스(패키지) 추가로 lint/typecheck/test 및 ui-kit storybook build가 CLI로 동작한다.
- 초기 UI는 최소 "Hello Shell" 수준으로만 구성한다.

## 검증 방식
- 커맨드:
  - `pnpm -r lint`
  - `pnpm -r typecheck`
  - `pnpm -r test`
  - `pnpm -C packages/ui-kit storybook:build`
- 기대 결과:
  - 모든 커맨드 exit 0
  - `summary.json`의 `pass=true`, `result="PASS"`
