-- Korrektur Eingang/A10: one stored tenant value for every delivery proposal.
-- The value is server-only master data; no new public write path is introduced.
ALTER TABLE public.company_settings
  ADD COLUMN tagesleistung_eur integer NOT NULL DEFAULT 800;

ALTER TABLE public.company_settings
  ADD CONSTRAINT company_settings_tagesleistung_eur_chk
    CHECK (tagesleistung_eur BETWEEN 1 AND 99999);

COMMENT ON COLUMN public.company_settings.tagesleistung_eur IS
  'Stufe 1 daily net output used by the shared delivery proposal calculation.';
