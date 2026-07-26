ALTER TABLE orders ADD COLUMN IF NOT EXISTS kostenstelle_primaer_id uuid;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS db_geplant numeric(12,2);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS db_ist numeric(12,2);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS db_letzte_berechnung timestamptz;
-- Controlling views are created before the later Phase-2 migration that
-- historically introduced these timestamps. Establish their source contract
-- before any view reads it.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS intake_date timestamptz DEFAULT now();
ALTER TABLE orders ADD COLUMN IF NOT EXISTS promised_due_date timestamptz;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS completed_date timestamptz;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS task text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS station text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS current_station_id text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS priority text DEFAULT 'normal';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS priority_computed text DEFAULT 'green';

UPDATE orders
SET station = COALESCE(NULLIF(btrim(station), ''), current_station, 'wareneingang');

ALTER TABLE orders
  ALTER COLUMN station SET DEFAULT 'wareneingang',
  ALTER COLUMN station SET NOT NULL;
