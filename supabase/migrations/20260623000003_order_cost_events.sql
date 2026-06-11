-- Migration: order_cost_events
-- Belegte Sonderkosten pro Auftrag (Verzögerung, Kulanz, Terminrettung etc.)

CREATE TABLE IF NOT EXISTS order_cost_events (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     text NOT NULL DEFAULT 'galvanik-kreile',
  order_id      text NOT NULL REFERENCES orders(id) ON DELETE CASCADE,

  event_type    text NOT NULL,        -- 'delay_cost', 'express_surcharge', 'quality_rework', 'kulanz', 'other'
  amount_eur    numeric(12,2) NOT NULL,
  reason        text,
  caused_by     text NOT NULL DEFAULT 'unknown',  -- 'delay', 'engpass', 'terminrettung', 'quality_issue', 'customer_change', 'shipping', 'other'

  source        text NOT NULL DEFAULT 'manual',
  created_at    timestamptz DEFAULT now()
);

CREATE INDEX idx_order_cost_events_order ON order_cost_events(order_id);
CREATE INDEX idx_order_cost_events_caused ON order_cost_events(caused_by);

ALTER TABLE order_cost_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all_order_cost_events" ON order_cost_events
  AS PERMISSIVE FOR ALL TO service_role
  USING (true) WITH CHECK (true);
