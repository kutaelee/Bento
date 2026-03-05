# P23-T0 Evidence

## Goal
- /admin 하위 모든 페이지가 동일한 `SettingsShell` 레이아웃을 사용
- `/admin`, `/admin/users`, `/admin/storage`, `/admin/migration`, `/admin/performance`, `/admin/jobs`, `/admin/audit`, `/admin/security`, `/admin/appearance`의 공통 탐색 + 헤더를 통일

## Checks
- `AdminShell` 컴포넌트 및 공통 레이아웃 존재
- `/admin` 라우트가 `AdminShell`으로 감싸져 있는지 정적 확인
- 라우트 번들 린트 통과
