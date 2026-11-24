-- L8: Preisquelle und Rechenregel für den Auftragsverbrauch am Journal einfrieren.
ALTER TABLE public.stock_movements
  ADD COLUMN kalk_ek numeric CHECK (kalk_ek >= 0 AND kalk_ek < 1000000000000),
  ADD COLUMN preisquelle_id uuid,
  ADD COLUMN kalk_vorlaeufig boolean,
  ADD COLUMN aufschlag_pct numeric CHECK (aufschlag_pct >= 0 AND aufschlag_pct < 10000),
  ADD COLUMN regel_version text CHECK (regel_version IS NULL OR btrim(regel_version) <> ''),
  ADD CONSTRAINT stock_movements_lager_preis_enthalten_chk CHECK (
    im_preis_enthalten IS NULL OR (befehl_id IS NOT NULL AND order_id IS NOT NULL
      AND lagerwirksam AND quantity < 0 AND movement_type IN ('consumption','waste','move'))
  ),
  ADD CONSTRAINT stock_movements_lager_preisquelle_fk FOREIGN KEY (tenant_id, inventory_item_id, preisquelle_id)
    REFERENCES public.material_prices (tenant_id, artikel_id, id) ON DELETE RESTRICT,
  ADD CONSTRAINT stock_movements_lager_preisbezug_chk CHECK (
    (kalk_ek IS NULL AND preisquelle_id IS NULL) OR (kalk_ek IS NOT NULL AND preisquelle_id IS NOT NULL
      AND aufschlag_pct IS NOT NULL AND regel_version IS NOT NULL)
  );

CREATE FUNCTION private.lager_kalkulationsbasis(p_artikel text, p_fachzeit timestamptz, p_methode text)
RETURNS TABLE (preisquelle_id uuid, einzelpreis numeric)
LANGUAGE plpgsql STABLE SET search_path = '' AS $funktion$
BEGIN
  IF p_methode IS NULL OR p_methode NOT IN ('letzter_ek','gleitender_durchschnitt','hoechster_ek') THEN
    RAISE EXCEPTION 'LAGER_KALKULATIONSREGEL_FEHLT' USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  WITH gueltige_preise AS (
    SELECT preis.id, preis.einzelpreis, preis.gueltig_ab, preis.bestaetigt_am,
      preis.erfasst_am, preis.beleg_id, preis.tenant_id
    FROM public.material_prices preis
    WHERE preis.tenant_id = nullif(btrim(current_setting('app.tenant_id', true)), '')
      AND preis.artikel_id = p_artikel AND preis.waehrung = 'EUR'
      AND preis.bestaetigt_am <= p_fachzeit AND preis.gueltig_ab <= p_fachzeit
      AND preis.storniert_am IS NULL AND preis.fehlpreis_am IS NULL
  ), preisquelle AS (
    SELECT preis.id, preis.einzelpreis
    FROM gueltige_preise preis
    ORDER BY
      CASE WHEN p_methode = 'hoechster_ek' THEN preis.einzelpreis END DESC,
      preis.gueltig_ab DESC,
      CASE WHEN p_methode <> 'hoechster_ek' THEN preis.bestaetigt_am END DESC,
      preis.erfasst_am DESC,
      CASE WHEN p_methode = 'hoechster_ek' THEN preis.id END,
      CASE WHEN p_methode <> 'hoechster_ek' THEN preis.id END DESC
    LIMIT 1
  )
  SELECT quelle.id,
    CASE WHEN p_methode = 'gleitender_durchschnitt' THEN (
      SELECT round(coalesce(
        sum(preis.einzelpreis * gewicht.menge) / nullif(sum(gewicht.menge), 0),
        avg(preis.einzelpreis)
      ), 4)
      FROM gueltige_preise preis
      CROSS JOIN LATERAL (
        SELECT sum(bewegung.quantity) AS menge
        FROM public.stock_movements bewegung
        WHERE bewegung.tenant_id = preis.tenant_id
          AND bewegung.inventory_item_id = p_artikel
          AND bewegung.beleg_id = preis.beleg_id
          AND bewegung.movement_type = 'stock_in'
          AND bewegung.geschaeftsgrund = 'wareneingang'
          AND bewegung.fachzeit <= p_fachzeit
      ) gewicht
    ) ELSE quelle.einzelpreis END
  FROM preisquelle quelle;
END;
$funktion$;
REVOKE ALL ON FUNCTION private.lager_kalkulationsbasis(text, timestamptz, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.lager_kalkulationsbasis(text, timestamptz, text) TO service_role;

CREATE FUNCTION private.lager_kalkulationsbasis_sichern() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $funktion$
DECLARE
  basis record;
  regel jsonb := coalesce(nullif(current_setting('app.lager_kalkulationsregel',true),''),'{}')::jsonb;
BEGIN
  IF NEW.befehl_id IS NULL OR NEW.order_id IS NULL OR NOT NEW.lagerwirksam
    OR NOT (NEW.movement_type IN ('stock_out','consumption','waste')
      OR (NEW.movement_type = 'move' AND NEW.quantity < 0 AND NEW.geschaeftsgrund = 'umlagerung')) THEN
    RETURN NEW;
  END IF;
  IF NEW.tenant_id IS DISTINCT FROM nullif(btrim(current_setting('app.tenant_id', true)), '') THEN
    RAISE EXCEPTION 'LAGER_KALKULATION_MANDANT_FEHLT' USING ERRCODE = '22023';
  END IF;
  IF NOT (regel ? 'aufschlag') OR nullif(regel->>'version','') IS NULL OR NOT (regel ? 'vorlaeufig')
    OR regel->>'methode' IS NULL
    OR regel->>'methode' NOT IN ('letzter_ek','gleitender_durchschnitt','hoechster_ek') THEN
    RAISE EXCEPTION 'LAGER_KALKULATIONSREGEL_FEHLT' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO basis FROM private.lager_kalkulationsbasis(NEW.inventory_item_id, NEW.fachzeit, regel->>'methode');
  IF basis.einzelpreis IS NULL THEN
    NEW.kalk_ek := NULL; NEW.preisquelle_id := NULL; NEW.snapshot_einkaufspreis_eur := NULL;
    NEW.aufschlag_pct := NULL; NEW.regel_version := NULL; NEW.kalk_vorlaeufig := NULL;
    RETURN NEW;
  END IF;
  NEW.preisquelle_id := basis.preisquelle_id;
  NEW.snapshot_einkaufspreis_eur := CASE WHEN basis.einzelpreis < 1000000 THEN basis.einzelpreis END;
  NEW.aufschlag_pct := (regel->>'aufschlag')::numeric;
  NEW.regel_version := regel->>'version';
  NEW.kalk_vorlaeufig := (regel->>'vorlaeufig')::boolean;
  NEW.kalk_ek := basis.einzelpreis;
  RETURN NEW;
END;
$funktion$;
REVOKE ALL ON FUNCTION private.lager_kalkulationsbasis_sichern() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.lager_kalkulationsbasis_sichern() TO service_role;
CREATE TRIGGER stock_movements_lager_kalkulationsbasis
  BEFORE INSERT ON public.stock_movements
  FOR EACH ROW EXECUTE FUNCTION private.lager_kalkulationsbasis_sichern();
