-- P3-T3: system_settings table (SSOT: openapi/openapi.yaml x-db.tables.system_settings)
CREATE TABLE IF NOT EXISTS system_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Seed READ_ONLY_MODE as false by default.
INSERT INTO system_settings (key, value, updated_at)
VALUES ('READ_ONLY_MODE', jsonb_build_object('read_only', false), now())
ON CONFLICT (key) DO NOTHING;
