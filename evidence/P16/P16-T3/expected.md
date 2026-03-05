# P16-T3 Sidebar Folder Tree

## Goal
- Render sidebar folder tree (read-only) using `GET /nodes/{node_id}/children`.
- Expand fetches children once per node, collapse does not refetch.

## Evidence
- `pnpm -C packages/ui test`
