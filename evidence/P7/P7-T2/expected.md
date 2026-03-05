# P7-T2 Restore (POST /trash/{node_id}/restore)

## Goal
- Restore a deleted node (and its subtree) from trash back to the normal tree.

## SSOT
- OpenAPI: `paths./trash/{node_id}/restore.post`

## Pass Criteria
1) Create a folder under root.
2) DELETE `/nodes/{id}` returns `200` with `{ ok: true }`.
3) POST `/trash/{id}/restore` returns `200` and a `Node` JSON whose `id == {id}`.
4) GET `/trash` does **not** include the restored node id.
5) GET `/nodes/{id}` returns `200` (node is fetchable again).
