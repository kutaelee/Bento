# DB Connection Runtime Note (2026-03-15)

## Decision

Bento runtime DB access moved from `docker exec ... psql` to a direct PostgreSQL client path using `pg`.

## Why

- Volume activation was not reliably switching the active volume under load.
- `docker exec` blocked the API event loop and could stall `/health`, `/auth/login`, and upload completion.
- On shared hosts, Bento must prefer its own PostgreSQL container mapping instead of accidentally binding to another project's `15432`.

## Runtime Rules

- Prefer `DATABASE_URL` when provided.
- Otherwise connect to `127.0.0.1` with Bento credentials and auto-detect the host port from:
  - `POSTGRES_CONTAINER`
  - `bento-postgres`
  - `bento-postgres-1`
  - `nimbus-postgres`
- Fallback host port: `15432`

## Validation Slice

- `/admin/volumes/{id}/activate` returns `200`
- Active volume changes in subsequent `/admin/volumes`
- Upload after activation writes new blob data into the newly active volume base path
- `/health` remains responsive during auth and volume operations

## Rollback

- Revert commits `76bfba2` and `5776b64` descendants if the worker-based `pg` bridge causes regressions.
- Restore `POSTGRES_CONTAINER`-driven runtime only as an emergency fallback, not as the preferred steady state.
