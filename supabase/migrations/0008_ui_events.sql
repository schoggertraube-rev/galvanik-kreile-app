CREATE TABLE IF NOT EXISTS ui_events (
  id          text PRIMARY KEY DEFAULT (gen_random_uuid()::text),
  tenant_id   text NOT NULL,
  event_type  text NOT NULL,
  payload     jsonb,
  session_id  text,
  created_at  timestamptz NOT NULL DEFAULT now()
)

CREATE INDEX IF NOT EXISTS ui_events_tenant_created
  ON ui_events (tenant_id, created_at DESC)

ALTER TABLE ui_events ENABLE ROW LEVEL SECURITY

CREATE POLICY "ui_events tenant isolation"
  ON ui_events
  FOR ALL
  TO public
  USING (tenant_id = current_setting('app.tenant_id', true))
