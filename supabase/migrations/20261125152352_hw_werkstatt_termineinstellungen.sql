-- H-W, lokaler Entwurf für den freigegebenen Migrationsplatz.
ALTER TABLE public.company_settings
  ADD COLUMN termin_knapp_arbeitstage integer NOT NULL DEFAULT 2,
  ADD CONSTRAINT company_settings_termin_knapp_arbeitstage_chk
    CHECK (termin_knapp_arbeitstage >= 0);

DO $migration$
DECLARE abweichung record;
BEGIN
  FOR abweichung IN
    SELECT id, uebergabepuffer_tage, versandpuffer_arbeitstage
    FROM public.company_settings
    WHERE versandpuffer_arbeitstage IS DISTINCT FROM uebergabepuffer_tage
    ORDER BY id
  LOOP
    RAISE NOTICE 'H-W Firma %: Übergabepuffer % Arbeitstage übernommen, vorheriger Versandpuffer % Arbeitstage.',
      abweichung.id, abweichung.uebergabepuffer_tage, abweichung.versandpuffer_arbeitstage;
  END LOOP;
END
$migration$;

UPDATE public.company_settings
   SET versandpuffer_arbeitstage = uebergabepuffer_tage
 WHERE versandpuffer_arbeitstage IS DISTINCT FROM uebergabepuffer_tage;

ALTER TABLE public.company_settings DROP COLUMN uebergabepuffer_tage;
