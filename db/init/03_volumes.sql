-- P3-T2: volumes table (SSOT: openapi/openapi.yaml x-db.tables.volumes)
CREATE TABLE IF NOT EXISTS volumes (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  base_path text NOT NULL,
  is_active boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'OK' CHECK (status in ('OK','DEGRADED','OFFLINE')),
  scan_state text NOT NULL DEFAULT 'queued' CHECK (scan_state in ('queued','running','succeeded','failed')),
  scan_job_id uuid NULL,
  scan_progress numeric NULL,
  scan_error text NULL,
  scan_updated_at timestamptz NULL,
  fs_type text NULL,
  free_bytes bigint NULL,
  total_bytes bigint NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Only one active volume at a time.
CREATE UNIQUE INDEX IF NOT EXISTS idx_volumes_active_unique ON volumes (is_active)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_volumes_scan_state
  ON volumes (scan_state);
