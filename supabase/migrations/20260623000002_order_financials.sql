-- Migration: order_financials
-- Auftragswert-Tracking: erwartet, freigegeben, fakturiert

CREATE TABLE IF NOT EXISTS order_financials (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                   text NOT NULL DEFAULT 'galvanik-kreile',
  order_id                    text NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,

  expected_revenue_net_eur    numeric(12,2),
  approved_revenue_net_eur    numeric(12,2),
  invoiced_revenue_net_eur    numeric(12,2),

  price_status                text NOT NULL DEFAULT 'unpriced',
  source                      text NOT NULL DEFAULT 'manual',

  created_at                  timestamptz DEFAULT now(),
  updated_at                  timestamptz DEFAULT now()
);

CREATE INDEX idx_order_financials_order ON order_financials(order_id);

ALTER TABLE order_financials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all_order_financials" ON order_financials
  AS PERMISSIVE FOR ALL TO service_role
  USING (true) WITH CHECK (true);
