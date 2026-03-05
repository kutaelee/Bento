CREATE TABLE IF NOT EXISTS share_links (
  id uuid PRIMARY KEY,
  node_id uuid NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  token_hash bytea NOT NULL UNIQUE,
  password_hash text NULL,
  permission text NOT NULL DEFAULT 'READ' CHECK (permission in ('READ','READ_WRITE')),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz NULL
);

CREATE INDEX IF NOT EXISTS idx_share_links_node
  ON share_links (node_id);

CREATE INDEX IF NOT EXISTS idx_share_links_expires
  ON share_links (expires_at);
