-- P0-T2: users table skeleton (SSOT: openapi/openapi.yaml x-db.tables.users)
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY,
  username citext UNIQUE NOT NULL,
  display_name text,
  role text NOT NULL CHECK (role in ('ADMIN','USER')),
  password_hash text NOT NULL,
  locale text NOT NULL DEFAULT 'ko-KR',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_login_at timestamptz NULL
);

CREATE INDEX IF NOT EXISTS idx_users_created_at ON users (created_at);
