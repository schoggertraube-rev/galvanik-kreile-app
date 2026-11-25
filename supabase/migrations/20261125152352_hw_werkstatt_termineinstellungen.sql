-- H-W, lokaler Entwurf für den freigegebenen Migrationsplatz.
ALTER TABLE public.company_settings
  ADD COLUMN termin_knapp_arbeitstage integer NOT NULL DEFAULT 2,
  ADD CONSTRAINT company_settings_termin_knapp_arbeitstage_chk
    CHECK (termin_knapp_arbeitstage >= 0);

UPDATE public.company_settings
   SET versandpuffer_arbeitstage = uebergabepuffer_tage
 WHERE versandpuffer_arbeitstage IS DISTINCT FROM uebergabepuffer_tage;

ALTER TABLE public.company_settings DROP COLUMN uebergabepuffer_tage;
