# P10-T1 — GET /search

## Goal
Search nodes by name (ILIKE + pg_trgm) with pagination.

## SSOT
- OpenAPI: `paths./search.get`
- Schema: `components.schemas.SearchResponse`, `components.schemas.Node`
- DB: `x-db.extensions_required (pg_trgm)`, `x-db.tables.nodes.indexes.idx_nodes_name_trgm`

## Required Evidence
1) Search with q returns items and `next_cursor` when paginated.
2) Cursor advances to the next page.

## Commands
- `bash evidence/P10/P10-T1/run.sh`
