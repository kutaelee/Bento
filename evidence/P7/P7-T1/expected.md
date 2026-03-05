# P7-T1 expected

- `DELETE /nodes/{node_id}`
  - returns `200` and `{ ok: true }`
  - deleted node must not appear in normal `GET /nodes/{id}`
- `GET /trash`
  - returns `200`
  - deleted node id is included in `items`
