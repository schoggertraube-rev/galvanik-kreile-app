-- Bekannte Altbestände gehen als unbestätigte Eröffnung in dasselbe Journal.
-- Die ursprünglichen Felder bleiben erhalten. Nullmenge und unbekannt sind getrennt.
ALTER TABLE public.stock_movements
  ADD COLUMN altquelle jsonb,
  ADD CONSTRAINT stock_movements_lager_altquelle_chk CHECK (
    altquelle IS NULL OR jsonb_typeof(altquelle) = 'object'
  ),
  ADD CONSTRAINT stock_movements_lager_eroeffnung_quelle_chk CHECK (
    befehl_id IS NULL OR movement_type <> 'opening' OR altquelle IS NOT NULL
  );

CREATE UNIQUE INDEX stock_movements_lager_eroeffnung_key
  ON public.stock_movements (tenant_id, inventory_item_id)
  WHERE movement_type = 'opening' AND befehl_id IS NOT NULL;

WITH vorhandene_bestaende AS (
  SELECT artikel.id, artikel.tenant_id, artikel.current_stock,
    coalesce(artikel.basiseinheit, CASE lower(btrim(coalesce(artikel.einheit_normiert, artikel.unit)))
      WHEN 'stück' THEN 'stk' WHEN 'stk.' THEN 'stk' WHEN 'stk' THEN 'stk'
      WHEN 'paar' THEN 'paar' WHEN 'ml' THEN 'ml' WHEN 'l' THEN 'l'
      WHEN 'g' THEN 'g' WHEN 'kg' THEN 'kg' WHEN 'mm' THEN 'mm' WHEN 'cm' THEN 'cm' WHEN 'm' THEN 'm'
      ELSE NULL END) AS einheit,
    jsonb_build_object('tabelle', 'inventory_items', 'feld', 'current_stock',
      'artikel_id', artikel.id, 'menge', artikel.current_stock,
      'einheit', artikel.unit, 'einheit_normiert', artikel.einheit_normiert,
      'basiseinheit', artikel.basiseinheit) AS altwert,
    statement_timestamp() AS stichtag
  FROM public.inventory_items artikel
  WHERE artikel.current_stock IS NOT NULL AND artikel.tenant_id IS NOT NULL
    AND btrim(artikel.tenant_id) = artikel.tenant_id AND artikel.tenant_id <> ''
)
INSERT INTO public.stock_movements (
  tenant_id, inventory_item_id, quantity, movement_type, geschaeftsgrund, mengenqualitaet,
  befehl_id, befehl_inhalt_sha256, befehl_zeile, fachzeit, created_at, revision, altquelle, mengeneinheit
)
SELECT tenant_id, id, current_stock, 'opening', 'altbestand', 'unbestaetigt',
  gen_random_uuid(), encode(sha256(convert_to(altwert::text, 'UTF8')), 'hex'), 1, stichtag, stichtag, 1, altwert, einheit
FROM vorhandene_bestaende
ON CONFLICT (tenant_id, inventory_item_id) WHERE movement_type = 'opening' AND befehl_id IS NOT NULL DO NOTHING;

-- Die alte Spalte konserviert den Ausgangsstand. Neue Artikel erhalten kein künstliches Nullinventar.
ALTER TABLE public.inventory_items ALTER COLUMN current_stock DROP DEFAULT;
CREATE FUNCTION private.lager_altbestand_schuetzen() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $funktion$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.current_stock IS NULL THEN RETURN NEW; END IF;
  ELSIF NEW.current_stock IS NOT DISTINCT FROM OLD.current_stock THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'LAGER_ALTBESTAND_UNVERAENDERLICH' USING ERRCODE = '23514';
END;
$funktion$;
REVOKE ALL ON FUNCTION private.lager_altbestand_schuetzen() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.lager_altbestand_schuetzen() TO service_role;
CREATE TRIGGER inventory_items_lager_altbestand_schuetzen
  BEFORE INSERT OR UPDATE OF current_stock ON public.inventory_items
  FOR EACH ROW EXECUTE FUNCTION private.lager_altbestand_schuetzen();

CREATE FUNCTION private.material_stock_at(p_fachzeit timestamptz)
RETURNS TABLE (
  artikel_id text, ort_id uuid, bestandsart text, eigentum text,
  menge numeric, mengenqualitaet text
)
LANGUAGE sql STABLE SET search_path = '' AS $funktion$
  SELECT bewegung.inventory_item_id, bewegung.ort_id, bewegung.bestandsart, bewegung.eigentum,
    sum(bewegung.quantity),
    CASE
      WHEN count(bewegung.quantity) = 0 THEN 'unbekannt'
      WHEN bool_or(bewegung.mengenqualitaet IN ('unbestaetigt','unbekannt')) THEN 'unbestaetigt'
      WHEN bool_or(bewegung.mengenqualitaet = 'geschaetzt') THEN 'geschaetzt'
      ELSE 'exakt'
    END
  FROM public.stock_movements bewegung
  WHERE bewegung.tenant_id = nullif(btrim(current_setting('app.tenant_id', true)), '')
    AND bewegung.befehl_id IS NOT NULL AND bewegung.lagerwirksam
    AND bewegung.fachzeit <= p_fachzeit
  GROUP BY bewegung.inventory_item_id, bewegung.ort_id, bewegung.bestandsart, bewegung.eigentum
$funktion$;
REVOKE ALL ON FUNCTION private.material_stock_at(timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.material_stock_at(timestamptz) TO service_role;

CREATE VIEW private.material_stock WITH (security_invoker = true) AS
  SELECT artikel_id, ort_id, bestandsart, eigentum, menge, mengenqualitaet,
    CASE WHEN menge < 0 THEN 'negativ' WHEN menge IS NULL THEN 'unbekannt' ELSE 'bestand' END AS status
  FROM private.material_stock_at(statement_timestamp());
REVOKE ALL ON TABLE private.material_stock FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE private.material_stock TO service_role;
