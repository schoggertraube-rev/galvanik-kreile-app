ALTER TABLE beleg ADD COLUMN IF NOT EXISTS konto_id uuid;
ALTER TABLE beleg ADD COLUMN IF NOT EXISTS kostenstelle_id uuid;
ALTER TABLE beleg ADD COLUMN IF NOT EXISTS periode_id uuid;
ALTER TABLE beleg ADD COLUMN IF NOT EXISTS ist_auf_auftrag_zugeordnet boolean DEFAULT false;
ALTER TABLE beleg ADD COLUMN IF NOT EXISTS zugeordneter_order_id text;
