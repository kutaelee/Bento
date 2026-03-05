# P21-T7 Evidence Expected

Task: /media 페이지 통일

Checks:
- Route "media" is wired through `FilesPage` with `routeMode="media"` in `AppRouter.tsx`.
- `FilesPage` supports `routeMode` "media" with media-specific title/behavior.
- Route-related tokens and states are standardized via i18n and FolderView patterns.
- `pnpm -C packages/ui test -- --run src/app/FilesPage.spec.tsx` passes.
