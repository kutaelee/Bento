# P23-T6 Evidence Expectations

- `/admin/jobs` is wired into admin routes and rendered under `AdminShell`.
- `AdminJobsPage` shows a job list via `DataTable` and displays job status / type / progress.
- `/jobs` list API is consumed and basic loading/error states are handled.
- Changes pass `pnpm -C packages/ui exec eslint` and `pnpm -C packages/ui typecheck` for the touched files.
- Summary and evidence path remain updated after `run.sh` executes successfully.
