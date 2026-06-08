ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS tenant_id text;
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS einkaufspreis_eur numeric(10,4);
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS einheit_normiert text;
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS kostenstelle_default_kuerzel text;
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS letzter_preis_aktualisiert_am timestamptz;
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS letzter_preis_quelle_beleg_id uuid;
