-- V6/KP7: Dauer und Überschreibungen am vorhandenen Firmendatensatz.
CREATE FUNCTION private.s16d_inaktivitaet_standard() RETURNS integer
LANGUAGE sql IMMUTABLE SET search_path = pg_catalog AS $$ SELECT 60 $$;

ALTER TABLE public.company_settings
  ADD COLUMN inaktivitaet_abmelden_minuten integer NOT NULL DEFAULT private.s16d_inaktivitaet_standard(),
  ADD COLUMN inaktivitaet_abmelden_geraete jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN inaktivitaet_abmelden_rollen jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD CONSTRAINT s16d_inaktivitaet_gueltig CHECK (
    inaktivitaet_abmelden_minuten >= 0
    AND jsonb_typeof(inaktivitaet_abmelden_geraete) = 'object'
    AND jsonb_typeof(inaktivitaet_abmelden_rollen) = 'object'
    AND NOT jsonb_path_exists(inaktivitaet_abmelden_geraete, 'strict $.* ? (@.type() != "number")')
    AND NOT jsonb_path_exists(inaktivitaet_abmelden_rollen, 'strict $.* ? (@.type() != "number")')
  );
