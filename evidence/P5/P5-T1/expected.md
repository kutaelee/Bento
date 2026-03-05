# P5-T1 expected

- POST /uploads (Create upload session) returns 201.
- Response matches `CreateUploadResponse` contract fields:
  - `upload_id` (UUID)
  - `status` (UploadStatus)
  - `chunk_size_bytes >= 1048576`
  - `total_chunks >= 1`
  - `dedup_hit` (boolean)
