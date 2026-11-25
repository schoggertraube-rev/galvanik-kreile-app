-- M4: die bestehende Badmessung trägt auch eingegangene Laborwerte.
ALTER TABLE public.bath_measurements
  ADD COLUMN analyse_metall text,
  ADD COLUMN analyse_g_pro_l numeric,
  ADD COLUMN analyse_volumen_l numeric,
  ADD COLUMN analyse_fein_g numeric GENERATED ALWAYS AS (analyse_g_pro_l * analyse_volumen_l) STORED,
  ADD COLUMN analyse_beleg_id uuid,
  ADD COLUMN analyse_datei_id uuid,
  ADD CONSTRAINT bath_measurements_lager_analyse_chk CHECK (
    num_nonnulls(analyse_metall, analyse_g_pro_l, analyse_volumen_l, analyse_beleg_id, analyse_datei_id) = 0
    OR (num_nonnulls(analyse_metall, analyse_g_pro_l, analyse_volumen_l, analyse_beleg_id, analyse_datei_id) = 5
      AND bath_id IS NOT NULL AND measured_at IS NOT NULL AND isfinite(measured_at)
      AND analyse_metall <> '' AND analyse_metall = btrim(analyse_metall) AND length(analyse_metall) <= 128
      AND analyse_g_pro_l >= 0 AND analyse_g_pro_l < 1000000000 AND scale(analyse_g_pro_l) <= 9
      AND analyse_volumen_l > 0 AND analyse_volumen_l < 1000000000 AND scale(analyse_volumen_l) <= 9)
  ),
  ADD CONSTRAINT bath_measurements_lager_analyse_beleg_fk FOREIGN KEY (tenant_id, analyse_beleg_id)
    REFERENCES public.intake_item (tenant_id, id) ON DELETE RESTRICT,
  ADD CONSTRAINT bath_measurements_lager_analyse_datei_fk FOREIGN KEY (tenant_id, analyse_datei_id)
    REFERENCES public.intake_file (tenant_id, id) ON DELETE RESTRICT;

CREATE UNIQUE INDEX bath_measurements_lager_analyse_original_key
  ON public.bath_measurements (tenant_id, bath_id, analyse_beleg_id, analyse_datei_id, analyse_metall)
  WHERE analyse_beleg_id IS NOT NULL;
CREATE INDEX bath_measurements_lager_analyse_stichtag_idx
  ON public.bath_measurements (tenant_id, bath_id, analyse_metall, measured_at DESC)
  WHERE analyse_beleg_id IS NOT NULL;

CREATE FUNCTION private.lager_badanalyse_speichern(
  p_bad text, p_metall text, p_zeit timestamptz, p_g_pro_l numeric, p_volumen_l numeric,
  p_beleg uuid, p_datei uuid
) RETURNS uuid
LANGUAGE plpgsql SET search_path = '' AS $funktion$
DECLARE
  mandant text := nullif(btrim(current_setting('app.tenant_id', true)), '');
  ergebnis uuid;
  original record;
BEGIN
  IF mandant IS NULL OR p_bad IS NULL OR p_metall IS NULL OR p_zeit IS NULL
    OR p_g_pro_l IS NULL OR p_volumen_l IS NULL OR p_beleg IS NULL OR p_datei IS NULL
    OR NOT EXISTS (
        SELECT 1 FROM public.baths bad WHERE bad.tenant_id = mandant AND bad.id = p_bad
    ) OR NOT EXISTS (
        SELECT 1 FROM public.v_lager_eingangsoriginale_v1 datei
        WHERE datei.tenant_id = mandant AND datei.id = p_datei AND datei.item_id = p_beleg AND datei.gespeichert
    ) THEN
    RAISE EXCEPTION 'LAGER_BADANALYSE_ORIGINAL_NICHT_BELEGT' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.bath_measurements (
    tenant_id, bath_id, measured_at, analyse_metall, analyse_g_pro_l, analyse_volumen_l,
    analyse_beleg_id, analyse_datei_id
  ) VALUES (mandant, p_bad, p_zeit, p_metall, p_g_pro_l, p_volumen_l, p_beleg, p_datei)
  ON CONFLICT (tenant_id, bath_id, analyse_beleg_id, analyse_datei_id, analyse_metall)
    WHERE analyse_beleg_id IS NOT NULL DO NOTHING
  RETURNING id INTO ergebnis;
  IF ergebnis IS NOT NULL THEN RETURN ergebnis; END IF;

  SELECT messung.id, messung.measured_at AS zeit, messung.analyse_g_pro_l AS g_pro_l, messung.analyse_volumen_l AS volumen_l
  INTO original FROM public.bath_measurements messung
  WHERE messung.tenant_id = mandant AND messung.bath_id = p_bad AND messung.analyse_beleg_id = p_beleg
    AND messung.analyse_datei_id = p_datei AND messung.analyse_metall = p_metall;
  IF original.id IS NULL OR original.zeit IS DISTINCT FROM p_zeit
    OR original.g_pro_l IS DISTINCT FROM p_g_pro_l OR original.volumen_l IS DISTINCT FROM p_volumen_l
  THEN RAISE EXCEPTION 'LAGER_BADANALYSE_ORIGINAL_KONFLIKT' USING ERRCODE = '23505'; END IF;
  RETURN original.id;
END;
$funktion$;

CREATE FUNCTION private.lager_badprozessbestand_am(p_stichtag timestamptz)
RETURNS TABLE (bad_id text, metall text, analyse_am timestamptz, g_pro_l numeric, volumen_l numeric,
  fein_g numeric, beleg_id uuid, datei_id uuid)
LANGUAGE sql STABLE SET search_path = '' AS $funktion$
  SELECT DISTINCT ON (messung.bath_id, messung.analyse_metall)
    messung.bath_id, messung.analyse_metall, messung.measured_at, messung.analyse_g_pro_l,
    messung.analyse_volumen_l, messung.analyse_fein_g, messung.analyse_beleg_id, messung.analyse_datei_id
  FROM public.bath_measurements messung
  WHERE messung.tenant_id = nullif(btrim(current_setting('app.tenant_id', true)), '')
    AND messung.analyse_beleg_id IS NOT NULL AND messung.measured_at <= p_stichtag
  ORDER BY messung.bath_id, messung.analyse_metall, messung.measured_at DESC,
    messung.created_at DESC NULLS LAST, messung.id DESC
$funktion$;

REVOKE ALL ON FUNCTION private.lager_badanalyse_speichern(text,text,timestamptz,numeric,numeric,uuid,uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.lager_badprozessbestand_am(timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.lager_badanalyse_speichern(text,text,timestamptz,numeric,numeric,uuid,uuid),
  private.lager_badprozessbestand_am(timestamptz) TO service_role;
