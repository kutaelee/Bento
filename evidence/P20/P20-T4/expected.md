# P20-T4. Visual Regression Harness (라우트 스냅샷)

Acceptance check implemented by this task:
- Required visual snapshot targets are declared in `packages/ui/visual-regression.config.json`.
- At least these routes are covered: `/files`, `/login`, `/admin`.
- Each route entry declares snapshot states and deterministic seeds.
- `pnpm -C packages/ui test:visual` is wired and passes via `scripts/run_route_snapshot_harness.sh`.
