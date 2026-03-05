-- P4-T1: node catalog for folders/files metadata.
CREATE TABLE IF NOT EXISTS nodes (
  id uuid PRIMARY KEY,
  type text NOT NULL CHECK (type in ('FOLDER', 'FILE')),
  parent_id uuid NULL REFERENCES nodes(id) ON DELETE RESTRICT,
  name text NOT NULL,
  path ltree NOT NULL,
  owner_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  blob_id uuid NULL REFERENCES blobs(id) ON DELETE RESTRICT,
  size_bytes bigint NOT NULL DEFAULT 0 CHECK (size_bytes >= 0),
  mime_type text NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  nearest_acl_node_id uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz NULL,
  CHECK (type <> 'FILE' OR blob_id IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_nodes_parent_name_active_unique
  ON nodes (parent_id, name)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_nodes_parent
  ON nodes (parent_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_nodes_path_gist
  ON nodes USING gist (path);

CREATE INDEX IF NOT EXISTS idx_nodes_name_trgm
  ON nodes USING gin (name gin_trgm_ops)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_nodes_metadata_gin
  ON nodes USING gin (metadata);

CREATE INDEX IF NOT EXISTS idx_nodes_deleted_at
  ON nodes (deleted_at);
