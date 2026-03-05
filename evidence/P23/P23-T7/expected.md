# P23-T7 Evidence Expectations

- `/admin/audit` route is wired into admin routes with AdminShellSuspense wrapper
- `AdminAuditPage` exists and uses PageHeader + Toolbar + DataTable
- Standardized states (loading/empty/error) exist in component
- i18n keys for admin audit table and messages exist in both ko-KR/en-US
- `pnpm -C packages/ui run lint` and `pnpm -C packages/ui run typecheck` pass
