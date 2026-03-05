-- P2-T4: invites table (SSOT: openapi/openapi.yaml x-db.tables.invites)
CREATE TABLE IF NOT EXISTS invites (
  id uuid PRIMARY KEY,
  token_hash bytea UNIQUE NOT NULL,
  role text NOT NULL DEFAULT 'USER' CHECK (role in ('ADMIN','USER')),
  locale text NOT NULL DEFAULT 'ko-KR',
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  used_at timestamptz NULL,
  used_by uuid NULL REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_invites_expires ON invites (expires_at);
