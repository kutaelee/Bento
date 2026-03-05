CREATE TABLE IF NOT EXISTS upload_sessions (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  parent_id uuid NOT NULL REFERENCES nodes(id) ON DELETE RESTRICT,
  filename text NOT NULL,
  size_bytes bigint NOT NULL CHECK (size_bytes >= 0),
  sha256 char(64) NULL,
  mime_type text NULL,
  status text NOT NULL CHECK (status in ('INIT','UPLOADING','MERGING','COMPLETED','ABORTED','FAILED')),
  chunk_size_bytes integer NOT NULL CHECK (chunk_size_bytes >= 1048576 AND chunk_size_bytes <= 33554432),
  total_chunks integer NOT NULL CHECK (total_chunks >= 1),
  received_chunks integer[] NOT NULL DEFAULT '{}'::int[],
  temp_dir text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_upload_sessions_user
  ON upload_sessions (user_id);

CREATE INDEX IF NOT EXISTS idx_upload_sessions_status
  ON upload_sessions (status);

CREATE INDEX IF NOT EXISTS idx_upload_sessions_expires
  ON upload_sessions (expires_at);

CREATE TABLE IF NOT EXISTS upload_chunks (
  upload_id uuid NOT NULL REFERENCES upload_sessions(id) ON DELETE CASCADE,
  chunk_index integer NOT NULL,
  checksum_sha256 char(64) NOT NULL,
  size_bytes integer NOT NULL CHECK (size_bytes >= 0),
  stored_path text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (upload_id, chunk_index)
);

CREATE INDEX IF NOT EXISTS idx_upload_chunks_upload
  ON upload_chunks (upload_id);
