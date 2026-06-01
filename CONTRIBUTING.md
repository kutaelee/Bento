# Contributing to Bento

Thanks for helping make private self-hosted storage easier to run and maintain.

## Development Model

Bento uses a contract-first workflow:

1. Read the relevant source-of-truth document before changing behavior.
2. If an API contract changes, update `openapi/openapi.yaml` first.
3. Keep each PR small: one task, one behavior change, or one focused documentation improvement.
4. Add or update CLI evidence when behavior changes.
5. Do not mix feature work with refactoring in the same PR.

## Source of Truth

The main source-of-truth files are:

- `openapi/openapi.yaml` for API paths, schemas, error codes, state machines, and DB expectations.
- `docs/NAS_SelfHosted_DDD_Spec_FINAL.md` for domain model and policy rationale.
- `docs/NAS_OpenClaw_TDD_Addendum_FINAL.md` for evidence and pass/fail rules.
- `docs/ui/IA_NAV_SSOT.md` and `docs/ui/COPY_KEYS_SSOT.md` for UI routes and copy keys.

## Validation

Run the smallest validation that proves your change, then mention it in the PR.

```bash
pnpm install --frozen-lockfile
pnpm --filter @nimbus/ui-kit --filter @nimbus/ui run typecheck
pnpm -C packages/ui lint
node scripts/check-i18n-sync.js
bash scripts/enforce-tokens.sh
```

For UI or behavior changes, also run the relevant package tests or evidence script.

## PR Expectations

PRs should include:

- problem statement;
- source-of-truth files checked;
- implementation summary;
- validation commands and results;
- risks and rollback notes.

Generated code or Codex-assisted changes are welcome when they are reviewed, scoped, and validated like human-written changes.
