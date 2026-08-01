ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS kostenstelle_kuerzel text;

ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS station_kuerzel text;

ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS erfasst_von uuid;

-- FK app_users(id)
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS war_aus_vorlage boolean DEFAULT false;

ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS vorlage_id uuid;

ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS snapshot_einkaufspreis_eur numeric(10,4);

ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS notiz text;

DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename  = 'app_users') THEN
        ALTER TABLE stock_movements ADD CONSTRAINT fk_stock_movements_erfasst_von FOREIGN KEY (erfasst_von) REFERENCES app_users(id);
    END IF;
EXCEPTION WHEN duplicate_object THEN
    -- Ignore
END $$;
