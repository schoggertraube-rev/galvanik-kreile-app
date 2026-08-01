-- 1. Add missing address columns to customers
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS street text,
  ADD COLUMN IF NOT EXISTS country text

-- 2. Create calendar_events table
CREATE TABLE IF NOT EXISTS calendar_events (
  id text PRIMARY KEY,
  tenant_id text NOT NULL,
  order_id text,
  customer_id text,
  title text NOT NULL,
  event_type text NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz,
  time_slot text,
  status text NOT NULL DEFAULT 'planned',
  source text,
  source_ref text,
  created_at timestamptz DEFAULT now()
)

-- RLS for calendar_events (stub for prototype)
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY

CREATE POLICY "service_role_all_calendar_events" ON calendar_events FOR ALL TO service_role USING (true) WITH CHECK (true)

CREATE POLICY "allow_all_calendar_events" ON calendar_events FOR ALL TO public USING (true) WITH CHECK (true)

-- 3. PostgREST reload
NOTIFY pgrst, 'reload schema'
