-- M2: Feinmetall und belegten Einstand im unveränderlichen Bewegungsjournal einfrieren.
ALTER TABLE public.material_prices
  ADD CONSTRAINT material_prices_lager_artikel_id_key UNIQUE (tenant_id, artikel_id, id);

ALTER TABLE public.stock_movements
  ADD COLUMN metall_code text,
  ADD COLUMN metall_fein_g numeric,
  ADD COLUMN metall_einstand_eur numeric,
  ADD COLUMN metall_preisquelle_id uuid,
  ADD CONSTRAINT stock_movements_metall_wert_chk CHECK (
    metall_code IS NOT NULL OR num_nonnulls(metall_fein_g, metall_einstand_eur, metall_preisquelle_id) = 0
  ),
  ADD CONSTRAINT stock_movements_metall_mengenwert_chk CHECK (
    metall_einstand_eur IS NULL OR (metall_fein_g IS NOT NULL AND metall_fein_g <> 0)
  ),
  ADD CONSTRAINT stock_movements_metall_preisquelle_fk FOREIGN KEY (tenant_id, inventory_item_id, metall_preisquelle_id)
    REFERENCES public.material_prices (tenant_id, artikel_id, id) ON DELETE RESTRICT;

CREATE INDEX stock_movements_metall_fachzeit_idx
  ON public.stock_movements (tenant_id, inventory_item_id, metall_code, fachzeit)
  WHERE befehl_id IS NOT NULL AND lagerwirksam AND eigentum = 'eigen' AND metall_code IS NOT NULL;

CREATE FUNCTION private.lager_metall_einstand_je_g(p_artikel text, p_metall text, p_fachzeit timestamptz)
RETURNS numeric
LANGUAGE sql STABLE SET search_path = '' AS $funktion$
  SELECT CASE WHEN sum(journal.metall_fein_g) > 0 AND sum(journal.metall_einstand_eur) >= 0
      AND count(*) FILTER (WHERE journal.quantity <> 0 AND journal.movement_type NOT IN ('move','reversal')
        AND (journal.metall_fein_g IS NULL
          OR journal.metall_fein_g <> 0 AND journal.metall_einstand_eur IS NULL)) = 0
    THEN sum(journal.metall_einstand_eur) / sum(journal.metall_fein_g) END
  FROM public.stock_movements journal
  WHERE journal.tenant_id = nullif(btrim(current_setting('app.tenant_id', true)), '')
    AND journal.inventory_item_id = p_artikel AND journal.metall_code = p_metall
    AND journal.befehl_id IS NOT NULL AND journal.lagerwirksam AND journal.eigentum = 'eigen'
    AND journal.fachzeit <= p_fachzeit
$funktion$;
REVOKE ALL ON FUNCTION private.lager_metall_einstand_je_g(text, text, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.lager_metall_einstand_je_g(text, text, timestamptz) TO service_role;

CREATE FUNCTION private.lager_metallbewegung_sichern() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $funktion$
DECLARE
  anteil numeric;
  quelle record;
  original record;
BEGIN
  IF NEW.befehl_id IS NULL OR NOT NEW.lagerwirksam THEN RETURN NEW; END IF;
  IF NEW.movement_type <> 'opening'
    AND NEW.tenant_id IS DISTINCT FROM nullif(btrim(current_setting('app.tenant_id', true)), '')
  THEN RAISE EXCEPTION 'LAGER_METALL_MANDANT_FEHLT' USING ERRCODE = '22023'; END IF;

  SELECT artikel.metall, artikel.feingehalt_pct INTO NEW.metall_code, anteil
    FROM public.inventory_items artikel
    WHERE artikel.tenant_id = NEW.tenant_id AND artikel.id = NEW.inventory_item_id
    FOR NO KEY UPDATE;
  NEW.metall_fein_g := NULL;
  NEW.metall_einstand_eur := NULL;
  NEW.metall_preisquelle_id := NULL;

  IF NEW.movement_type = 'reversal' THEN
    SELECT b.metall_code, b.metall_fein_g, b.metall_einstand_eur, b.metall_preisquelle_id INTO original
    FROM public.stock_movements b WHERE b.tenant_id = NEW.tenant_id AND b.id = NEW.gegenbuchung_id;
    NEW.metall_code := original.metall_code;
    NEW.metall_fein_g := -original.metall_fein_g;
    NEW.metall_einstand_eur := -original.metall_einstand_eur;
    NEW.metall_preisquelle_id := original.metall_preisquelle_id;
    RETURN NEW;
  END IF;

  IF NEW.metall_code IS NULL THEN RETURN NEW; END IF;
  NEW.metall_fein_g := CASE NEW.mengeneinheit
    WHEN 'g' THEN NEW.quantity * anteil / 100
    WHEN 'kg' THEN NEW.quantity * 1000 * anteil / 100
  END;
  IF NEW.metall_fein_g IS NULL OR NEW.metall_fein_g = 0 OR NEW.eigentum <> 'eigen'
    OR NEW.movement_type = 'opening' THEN RETURN NEW; END IF;

  IF NEW.movement_type = 'move' AND NEW.befehl_zeile = 2 THEN
    SELECT b.metall_fein_g, b.metall_einstand_eur INTO original FROM public.stock_movements b
    WHERE b.tenant_id = NEW.tenant_id AND b.befehl_id = NEW.befehl_id AND b.befehl_zeile = 1;
    NEW.metall_fein_g := -original.metall_fein_g;
    NEW.metall_einstand_eur := -original.metall_einstand_eur;
    RETURN NEW;
  END IF;

  IF NEW.movement_type = 'stock_in' AND NEW.geschaeftsgrund = 'wareneingang' THEN
    SELECT preis.id, preis.einzelpreis INTO quelle
    FROM public.material_prices preis
    WHERE preis.tenant_id = NEW.tenant_id AND preis.artikel_id = NEW.inventory_item_id
      AND preis.beleg_id = NEW.beleg_id AND preis.waehrung = 'EUR'
      AND preis.quelle IN ('gepruefte_rechnung','bestellung','manuell')
      AND preis.bestaetigt_am IS NOT NULL AND preis.gueltig_ab <= NEW.fachzeit
      AND preis.storniert_am IS NULL AND preis.fehlpreis_am IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.material_prices andere
        WHERE andere.tenant_id = preis.tenant_id AND andere.artikel_id = preis.artikel_id
          AND andere.beleg_id = preis.beleg_id AND andere.waehrung = 'EUR'
          AND andere.id <> preis.id AND andere.einzelpreis <> preis.einzelpreis
          AND andere.quelle IN ('gepruefte_rechnung','bestellung','manuell')
          AND andere.bestaetigt_am IS NOT NULL AND andere.gueltig_ab <= NEW.fachzeit
          AND andere.storniert_am IS NULL AND andere.fehlpreis_am IS NULL
      )
    ORDER BY preis.bestaetigt_am DESC, preis.id LIMIT 1;
    NEW.metall_preisquelle_id := quelle.id;
    NEW.metall_einstand_eur := NEW.quantity * quelle.einzelpreis;
  ELSE
    NEW.metall_einstand_eur := round(NEW.metall_fein_g *
      private.lager_metall_einstand_je_g(NEW.inventory_item_id, NEW.metall_code, NEW.fachzeit), 12);
  END IF;
  RETURN NEW;
END;
$funktion$;
REVOKE ALL ON FUNCTION private.lager_metallbewegung_sichern() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.lager_metallbewegung_sichern() TO service_role;
CREATE TRIGGER stock_movements_lager_metallbewegung BEFORE INSERT ON public.stock_movements
  FOR EACH ROW EXECUTE FUNCTION private.lager_metallbewegung_sichern();
