-- P4-T1: blobs table for node->blob FK and dedup references.
CREATE TABLE IF NOT EXISTS blobs (
  id uuid PRIMARY KEY,
  volume_id uuid NOT NULL REFERENCES volumes(id) ON DELETE RESTRICT,
  storage_key text NOT NULL,
  sha256 char(64) NOT NULL,
  size_bytes bigint NOT NULL CHECK (size_bytes >= 0),
  content_type text NULL,
  ref_count integer NOT NULL DEFAULT 0 CHECK (ref_count >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz NULL,
  UNIQUE (volume_id, storage_key),
  UNIQUE (sha256)
);

CREATE INDEX IF NOT EXISTS idx_blobs_volume
  ON blobs (volume_id);

CREATE INDEX IF NOT EXISTS idx_blobs_deleted_at
  ON blobs (deleted_at);
