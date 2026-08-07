CREATE TABLE IF NOT EXISTS pin_rate_limits (
  operator_id uuid PRIMARY KEY REFERENCES app_users(id) ON DELETE CASCADE,
  failed_attempts integer NOT NULL DEFAULT 0,
  last_failed_at timestamptz NOT NULL DEFAULT now(),
  tenant_id text NOT NULL DEFAULT 'galvanik-kreile'
);

ALTER TABLE pin_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_pin_rate_limits_tenant ON pin_rate_limits(tenant_id);

COMMENT ON TABLE pin_rate_limits IS 'Rate-Limiting fuer PIN-Login-Versuche (M4: SEC-PIN-002B)';
