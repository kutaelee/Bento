# P5-T3 expected

- POST /uploads/{upload_id}/complete returns 200.
- Response matches `CompleteUploadResponse` contract fields:
  - `node_id` (UUID)
  - `blob_id` (UUID)
  - `sha256` (64-hex)
  - `size_bytes` (integer)
- Downloading the created node returns content whose sha256 matches the expected sha256.
