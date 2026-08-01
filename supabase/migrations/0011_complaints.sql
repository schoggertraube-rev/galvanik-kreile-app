CREATE TABLE IF NOT EXISTS complaints (
  id text PRIMARY KEY DEFAULT (gen_random_uuid()::text),
  tenant_id text NOT NULL,
  order_id text REFERENCES orders(id) ON DELETE SET NULL,
  customer_id text REFERENCES customers(id) ON DELETE SET NULL,
  item_id text,
  reason text NOT NULL,
  station_id text,
  description text NOT NULL,
  photo_ids jsonb DEFAULT '[]'::jsonb,
  status text DEFAULT 'open',
  resolved_at timestamptz,
  resolution text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
)

ALTER TABLE complaints ADD COLUMN IF NOT EXISTS tenant_id text DEFAULT 'galvanik-kreile'

ALTER TABLE complaints ADD COLUMN IF NOT EXISTS item_id text

ALTER TABLE complaints ADD COLUMN IF NOT EXISTS station_id text

ALTER TABLE complaints ADD COLUMN IF NOT EXISTS description text DEFAULT ''

ALTER TABLE complaints ADD COLUMN IF NOT EXISTS photo_ids jsonb DEFAULT '[]'::jsonb

ALTER TABLE complaints ADD COLUMN IF NOT EXISTS resolved_at timestamptz

ALTER TABLE complaints ADD COLUMN IF NOT EXISTS resolution text

ALTER TABLE complaints ENABLE ROW LEVEL SECURITY

DROP POLICY IF EXISTS "tenant_isolation_complaints" ON complaints

CREATE POLICY "tenant_isolation_complaints"
  ON complaints
  FOR ALL
  TO public
  USING (tenant_id = current_setting('app.tenant_id', true))

CREATE INDEX IF NOT EXISTS complaints_tenant_created_idx ON complaints (tenant_id, created_at DESC)
