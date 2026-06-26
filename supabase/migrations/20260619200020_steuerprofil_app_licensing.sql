ALTER TABLE public.steuerprofil ADD COLUMN IF NOT EXISTS app_lizenz_monat NUMERIC(10, 2) DEFAULT '149.00';
ALTER TABLE public.steuerprofil ADD COLUMN IF NOT EXISTS app_einrichtung_einmalig NUMERIC(10, 2) DEFAULT '0.00';
ALTER TABLE public.steuerprofil ADD COLUMN IF NOT EXISTS app_startdatum DATE DEFAULT NOW();
