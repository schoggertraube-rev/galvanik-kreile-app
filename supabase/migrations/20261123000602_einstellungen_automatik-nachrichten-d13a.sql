-- A-18/D13a: der bestehende Mandantendatensatz hält die Regeln des gemeinsamen Lesers.
CREATE FUNCTION private.s16d_automatik_nachrichten_standardwerte() RETURNS jsonb
LANGUAGE sql IMMUTABLE SET search_path = pg_catalog
AS $$
  SELECT jsonb_object_agg(
    art, jsonb_build_object(
      'aktiv', aktiv,
      'takt', jsonb_strip_nulls(jsonb_build_object('art', takt, 'tage', tage)),
      'textschluessel', art,
      'kanal', kanal,
      'versandfenster', jsonb_build_object('von', '00:00', 'bis', '23:59')
    )
  )
  FROM (VALUES
    ('auftragsbestaetigung', 'ereignis', 'email', NULL, true),
    ('status', 'ereignis', 'email', NULL, false),
    ('kv_erinnerung', 'fachfrist', 'email', NULL, false),
    ('abholung', 'fachfrist', 'email', NULL, false),
    ('zahlungserinnerung', 'fachfrist', 'email', NULL, false),
    ('bewertung', 'tage', 'email', 14, false),
    ('sdb_anforderung', 'ereignis', 'email', NULL, false),
    ('antwort_erinnerung', 'fachfrist', 'email', NULL, false),
    ('versandhinweis', 'ereignis', 'email', NULL, false),
    ('lagergeld_brief', 'fachfrist', 'brief', NULL, false)
  ) AS regel(art, takt, kanal, tage, aktiv)
$$;

ALTER TABLE public.company_settings
  ADD COLUMN automatik_nachrichten jsonb NOT NULL DEFAULT private.s16d_automatik_nachrichten_standardwerte(),
  ADD CONSTRAINT s16d_automatik_nachrichten_objekt CHECK (jsonb_typeof(automatik_nachrichten) = 'object');
