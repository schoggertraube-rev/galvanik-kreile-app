ALTER TABLE orders ADD COLUMN IF NOT EXISTS kostenstelle_primaer_id uuid;

ALTER TABLE orders ADD COLUMN IF NOT EXISTS db_geplant numeric(12,2);

ALTER TABLE orders ADD COLUMN IF NOT EXISTS db_ist numeric(12,2);

ALTER TABLE orders ADD COLUMN IF NOT EXISTS db_letzte_berechnung timestamptz;
