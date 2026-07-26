ALTER TABLE ausgangsrechnung ADD COLUMN IF NOT EXISTS periode_id uuid;
ALTER TABLE ausgangsrechnung ADD COLUMN IF NOT EXISTS erloes_konto_id uuid;
ALTER TABLE ausgangsrechnung ADD COLUMN IF NOT EXISTS forderung_konto_id uuid;
ALTER TABLE ausgangsrechnung ADD COLUMN IF NOT EXISTS aging_status text;
ALTER TABLE ausgangsrechnung ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
