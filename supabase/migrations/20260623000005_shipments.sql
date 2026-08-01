-- Migration: shipments + orders.delivery_method
-- Versand-Tracking pro Auftrag

CREATE TABLE IF NOT EXISTS shipments (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         text NOT NULL DEFAULT 'galvanik-kreile',
  order_id          text NOT NULL REFERENCES orders(id) ON DELETE CASCADE,

  carrier           text,              -- 'dhl', 'dpd', 'spedition', 'selbstabholung'
  tracking_number   text,
  label_url         text,
  weight_kg         numeric(8,2),
  kolli_count       integer DEFAULT 1,
  insurance_eur     numeric(10,2),
  shipping_cost_eur numeric(10,2),

  status            text NOT NULL DEFAULT 'pending',  -- 'pending', 'shipped', 'delivered', 'picked_up'
  shipped_at        timestamptz,
  delivered_at      timestamptz,

  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
)

CREATE INDEX idx_shipments_order ON shipments(order_id)

ALTER TABLE shipments ENABLE ROW LEVEL SECURITY

CREATE POLICY "service_role_all_shipments" ON shipments
  AS PERMISSIVE FOR ALL TO service_role
  USING (true) WITH CHECK (true)

-- Neue Spalte an orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_method text
