CREATE TABLE IF NOT EXISTS items (
  id text PRIMARY KEY DEFAULT (gen_random_uuid()::text),
  tenant_id text NOT NULL,
  order_id text REFERENCES orders(id) ON DELETE CASCADE,
  customer_id text REFERENCES customers(id),
  name text NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  current_station_id text DEFAULT 'wareneingang',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
)

ALTER TABLE items ADD COLUMN IF NOT EXISTS material text

ALTER TABLE items ADD COLUMN IF NOT EXISTS surface_requested text

ALTER TABLE items ADD COLUMN IF NOT EXISTS photo_ids jsonb DEFAULT '[]'::jsonb

ALTER TABLE items ADD COLUMN IF NOT EXISTS photo text

ALTER TABLE items ENABLE ROW LEVEL SECURITY

DROP POLICY IF EXISTS "tenant_isolation_items" ON items

CREATE POLICY "tenant_isolation_items"
  ON items
  FOR ALL
  TO public
  USING (tenant_id = current_setting('app.tenant_id', true))

CREATE INDEX IF NOT EXISTS items_tenant_order_idx ON items (tenant_id, order_id)
