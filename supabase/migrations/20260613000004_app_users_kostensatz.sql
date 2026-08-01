ALTER TABLE app_users ADD COLUMN IF NOT EXISTS kostensatz_eur_pro_stunde numeric(8,2);

ALTER TABLE app_users ADD COLUMN IF NOT EXISTS ist_produktiv boolean DEFAULT true;

ALTER TABLE app_users ADD COLUMN IF NOT EXISTS wochenstunden numeric(5,2);

ALTER TABLE app_users ADD COLUMN IF NOT EXISTS urlaubstage_pro_jahr integer;
