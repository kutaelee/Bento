# P5-T2 — PUT /uploads/{upload_id}/chunks/{chunk_index}

## Goal
- Implement SSOT endpoint: `PUT /uploads/{upload_id}/chunks/{chunk_index}`
- Chunk upload MUST be idempotent per `(upload_id, chunk_index, sha256)`.

## SSOT
- OpenAPI: `paths./uploads/{upload_id}/chunks/{chunk_index}.put`
- Header: `X-Chunk-SHA256` (64 hex)

## Required Evidence
- Case: upload chunk #0 success (200) and returns `UploadSession` JSON
- Case: re-upload same chunk with same sha256 => 200 (idempotent)
- Case: re-upload same chunk_index with different sha256 => 409

(Implementation + evidence to be filled.)
