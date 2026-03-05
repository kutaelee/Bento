# P23-T3 Evidence

- Scope: /admin/storage 페이지를 SettingsShell 내부로 통일하고, 목록/폼 패턴을 정돈한 뒤 `ui lint`, `typecheck`로 유효성 검증한다.
- Evidence checks:
  - `src/app/AdminStoragePage.tsx` and `src/app/AdminStoragePage.css` exist.
  - `/admin/storage` route exists in `src/app/AdminRoutes.tsx`.
  - 페이지는 inline style 사용 없이 클래스 기반 레이아웃으로 정돈.
  - `pnpm -C packages/ui exec eslint src/app/AdminStoragePage.tsx src/app/AdminRoutes.tsx`
  - `pnpm -C packages/ui typecheck`
