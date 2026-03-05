CREATE TABLE IF NOT EXISTS acl_entries (
  id uuid PRIMARY KEY,
  node_id uuid NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  principal_type text NOT NULL CHECK (principal_type in ('USER', 'GROUP', 'SHARE_LINK')),
  principal_id text NOT NULL,
  effect text NOT NULL CHECK (effect in ('ALLOW', 'DENY')),
  permissions text[] NOT NULL DEFAULT '{}'::text[],
  inheritable boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_acl_node
  ON acl_entries (node_id);

CREATE INDEX IF NOT EXISTS idx_acl_principal
  ON acl_entries (principal_type, principal_id);
