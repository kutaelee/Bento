# P23-T9 Evidence Expectations

- `/admin/appearance` route is wired into `adminRoutes` through `AdminShellSuspense` and renders `AdminAppearancePage`.
- `AdminAppearancePage` uses Settings-style sections with `PageHeader`, `LoadingSkeleton`, `ErrorState`, and `PageHeader` toolbar action.
- Language preference is loaded from `/me` and persisted via `/me/preferences` patch API with reset support.
- Theme setting options are shown as a non-inline, form-style UI section (local preview + local storage persistence).
- Required i18n keys are added to both `ko-KR` and `en-US` locales for title/labels/messages.
- `pnpm -C packages/ui run lint` and `pnpm -C packages/ui run typecheck` pass.
