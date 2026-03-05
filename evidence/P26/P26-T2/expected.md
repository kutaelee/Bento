# P26-T2 (Pixel Diff Gate /files)

## Goal
- `/files` route is pixel-diffed against the locked reference `screen.png`.
- Reference baseline assets (`design/stitch/**/screen.png`) cannot be modified in PRs unless an explicit approval flag is set.
- This gate is retained as `legacy gate (pre-new-UI SSOT), non-blocking` in CI; failures are reported for tracking, not merge-blocking.

## PASS criteria
- `pnpm -C packages/ui test:visual` succeeds in CI default (pixel mode).
- If a PR modifies `screen.png` without `VISUAL_ALLOW_BASELINE_UPDATE=1`, the visual check fails with `baseline-update-blocked:`.
