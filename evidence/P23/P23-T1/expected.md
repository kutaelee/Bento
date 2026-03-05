# P23-T1 Evidence

## Goal
`/admin` 설정 홈(대시보드) 페이지를 기존 단일 SimplePage에서 SettingsShell 기반으로 통일된 레이아웃과 ui-kit 조합 컴포넌트로 구성한다.

## Checks
- `packages/ui/src/app/AdminRoutes.tsx` has `/admin` route rendering the new `AdminHomePage` component.
- `packages/ui/src/app/AdminHomePage.tsx` exists and uses `@nimbus/ui-kit` components.
- `packages/ui/src/app/AdminHomePage.tsx` avoids inline `style=` usage.
- Evidence script passes lint/typecheck/tests.
