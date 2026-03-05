# P16-T1 Folder View (Read-only)

## Goal
- Render folder view for `/files` and `/files/:nodeId` using `GET /nodes/{node_id}` and `GET /nodes/{node_id}/children`.
- Show cursor-based pagination with a "load more" action when `next_cursor` is present.

## Evidence
- `pnpm -C packages/ui test`
