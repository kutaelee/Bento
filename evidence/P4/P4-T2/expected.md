# P4-T2 expected

- GET /nodes/{node_id}
  - returns `Node` metadata with 200 for existing node
  - returns 404 when node doesn't exist
- GET /nodes/{node_id}/children
  - returns `ListChildrenResponse` with `items` array and `next_cursor`
  - default `include_deleted=false` behavior should hide removed items (checked indirectly through active dataset)
  - cursor-based pagination works
