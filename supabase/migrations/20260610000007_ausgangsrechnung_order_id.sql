ALTER TABLE ausgangsrechnung ADD COLUMN IF NOT EXISTS order_id text;
CREATE INDEX IF NOT EXISTS idx_ausgangsrechnung_order ON ausgangsrechnung(order_id);
