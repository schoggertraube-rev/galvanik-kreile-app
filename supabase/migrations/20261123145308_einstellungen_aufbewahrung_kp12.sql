-- KP12: Frist je Dokumentart und Sperrgrund am belegten Original.
CREATE TABLE public.dokument_aufbewahrung (
  tenant_id text NOT NULL,
  dokumentart text NOT NULL CHECK (dokumentart ~ '^[a-z][a-z0-9_]{0,79}$'),
  frist_jahre integer NOT NULL CHECK (frist_jahre > 0),
  PRIMARY KEY (tenant_id,dokumentart)
);
CREATE TABLE public.dokument_ablaufhemmung (
  tenant_id text NOT NULL,
  id uuid NOT NULL,
  original_typ text NOT NULL CHECK (original_typ ~ '^[a-z][a-z0-9_]{0,79}$'),
  original_id text NOT NULL CHECK (char_length(btrim(original_id)) BETWEEN 1 AND 160),
  grund text NOT NULL CHECK (grund IN ('laufende_pruefung','streit','offene_forderung')),
  gesetzt_am timestamptz NOT NULL DEFAULT statement_timestamp(),
  gesetzt_von uuid NOT NULL,
  PRIMARY KEY (tenant_id,id),
  FOREIGN KEY (tenant_id,gesetzt_von) REFERENCES public.app_users(tenant_id,id) ON DELETE RESTRICT
);
CREATE UNIQUE INDEX dokument_ablaufhemmung_ursprung
  ON public.dokument_ablaufhemmung(tenant_id,original_typ,original_id,grund);
ALTER TABLE public.dokument_aufbewahrung ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dokument_ablaufhemmung ENABLE ROW LEVEL SECURITY;
CREATE POLICY dokument_aufbewahrung_mandant ON public.dokument_aufbewahrung
  USING (tenant_id=nullif(btrim(current_setting('app.tenant_id',true)),''))
  WITH CHECK (tenant_id=nullif(btrim(current_setting('app.tenant_id',true)),''));
CREATE POLICY dokument_ablaufhemmung_mandant ON public.dokument_ablaufhemmung
  USING (tenant_id=nullif(btrim(current_setting('app.tenant_id',true)),''))
  WITH CHECK (tenant_id=nullif(btrim(current_setting('app.tenant_id',true)),''));
REVOKE ALL ON public.dokument_aufbewahrung, public.dokument_ablaufhemmung FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT,INSERT,UPDATE ON public.dokument_aufbewahrung TO service_role;
GRANT SELECT,INSERT ON public.dokument_ablaufhemmung TO service_role;

CREATE FUNCTION private.kp12_startfristen(mandant text) RETURNS void
LANGUAGE sql SET search_path=pg_catalog AS $$
  INSERT INTO public.dokument_aufbewahrung(tenant_id,dokumentart,frist_jahre)
  SELECT mandant,dokumentart,jahre
  FROM (VALUES ('rechnung',8),('buchungsbeleg',8),('abschluss',10),('geschaeftsbrief',6),
    ('kv_mail',6),('auftragsmail',6),('telefonnotiz',3),('sonstige_mail',3)) AS start(dokumentart,jahre)
  WHERE btrim(mandant)<>''
  ON CONFLICT (tenant_id,dokumentart) DO NOTHING
$$;
REVOKE ALL ON FUNCTION private.kp12_startfristen(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.kp12_startfristen(text) TO service_role;

CREATE FUNCTION private.kp12_nach_firmendaten() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
  PERFORM private.kp12_startfristen(NEW.tenant_id);
  RETURN NEW;
END
$$;
REVOKE ALL ON FUNCTION private.kp12_nach_firmendaten() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.kp12_nach_firmendaten() TO service_role;
CREATE TRIGGER kp12_nach_firmendaten AFTER INSERT ON public.company_settings
  FOR EACH ROW EXECUTE FUNCTION private.kp12_nach_firmendaten();

SELECT private.kp12_startfristen(firma.tenant_id)
FROM (SELECT DISTINCT tenant_id FROM public.company_settings WHERE tenant_id IS NOT NULL) AS firma;
