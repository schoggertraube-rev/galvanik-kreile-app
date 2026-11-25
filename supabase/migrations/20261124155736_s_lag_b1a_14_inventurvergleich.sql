-- LC3: reine Lesesicht. Der Buchbestand kommt ausschließlich aus material_stock.
CREATE FUNCTION private.lager_inventur_vergleich()
RETURNS TABLE (
  artikel_id text, kurznummer integer, artikel_name text, einheit text,
  soll numeric, zuletzt_gezaehlt numeric, gezaehlt_am timestamptz, abweichung numeric, zaehlung_vollstaendig boolean
)
LANGUAGE sql STABLE SET search_path = '' AS $funktion$
WITH kontext AS (
  SELECT nullif(btrim(current_setting('app.tenant_id', true)), '') AS mandant
), bestand AS (
  SELECT b.artikel_id, b.ort_id, b.menge FROM private.material_stock b WHERE b.eigentum = 'eigen'
), artikelbestand AS (
  SELECT b.artikel_id, CASE WHEN NOT bool_or(b.menge IS NULL) THEN sum(b.menge) END AS soll
  FROM bestand b GROUP BY b.artikel_id
), zaehlungen AS (
  SELECT z.session_id, z.artikel_id,
    CASE WHEN count(DISTINCT z.einheit) FILTER (WHERE z.counted_qty IS NOT NULL) = 1
      THEN sum(z.counted_qty) END AS menge,
    max(z.counted_at) FILTER (WHERE z.counted_qty IS NOT NULL) AS zuletzt,
    bool_and(z.counted_qty IS NOT NULL) AS vollstaendig,
    CASE WHEN count(DISTINCT z.einheit) FILTER (WHERE z.counted_qty IS NOT NULL) = 1
      THEN min(z.einheit) FILTER (WHERE z.counted_qty IS NOT NULL) END AS einheit
  FROM kontext k JOIN public.inventory_counts z ON z.tenant_id = k.mandant
  GROUP BY z.session_id,z.artikel_id HAVING count(z.counted_qty) > 0
), letzte AS (
  SELECT DISTINCT ON (z.artikel_id) z.*
  FROM zaehlungen z ORDER BY z.artikel_id,z.zuletzt DESC,z.session_id
), vergleich AS (
  SELECT artikel.id, artikel.kurznummer, artikel.name, coalesce(artikel.basiseinheit,z.einheit) AS einheit,
    b.soll, CASE WHEN z.einheit = coalesce(artikel.basiseinheit,z.einheit) THEN z.menge END AS menge, z.zuletzt,
    coalesce(z.vollstaendig AND z.einheit = coalesce(artikel.basiseinheit,z.einheit) AND NOT EXISTS (
      SELECT 1 FROM bestand ort
      WHERE ort.artikel_id = artikel.id AND NOT EXISTS (
        SELECT 1 FROM public.inventory_counts zaehlung
        WHERE zaehlung.tenant_id = artikel.tenant_id AND zaehlung.session_id = z.session_id
          AND zaehlung.artikel_id = artikel.id AND zaehlung.ort_id = ort.ort_id AND zaehlung.counted_qty IS NOT NULL
      )
    ),false) AS vollstaendig
  FROM kontext k JOIN public.inventory_items artikel ON artikel.tenant_id = k.mandant
  LEFT JOIN artikelbestand b ON b.artikel_id = artikel.id
  LEFT JOIN letzte z ON z.artikel_id = artikel.id
)
SELECT v.id,v.kurznummer,v.name,v.einheit,v.soll,v.menge,v.zuletzt,
  CASE WHEN v.vollstaendig THEN v.menge-v.soll END,v.vollstaendig
FROM vergleich v ORDER BY v.kurznummer NULLS LAST,v.name,v.id
$funktion$;
REVOKE ALL ON FUNCTION private.lager_inventur_vergleich() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.lager_inventur_vergleich() TO service_role;

CREATE TABLE public.inventory_count_reasons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL, session_id uuid NOT NULL, artikel_id text NOT NULL, ort_id uuid NOT NULL,
  zaehl_version integer NOT NULL CHECK (zaehl_version > 0),
  grund text NOT NULL CHECK (grund IN ('missed-issue','missed-receipt','count-correction','pack-unit','loss','unknown')),
  grund_von uuid NOT NULL, grund_am timestamptz NOT NULL DEFAULT statement_timestamp(),
  befehl_id uuid NOT NULL,
  UNIQUE (tenant_id, session_id, artikel_id, ort_id), UNIQUE (tenant_id, befehl_id),
  FOREIGN KEY (tenant_id, session_id, artikel_id, ort_id)
    REFERENCES public.inventory_counts (tenant_id, session_id, artikel_id, ort_id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, grund_von) REFERENCES public.app_users (tenant_id, id) ON DELETE RESTRICT
);
ALTER TABLE public.inventory_count_reasons ENABLE ROW LEVEL SECURITY;
CREATE POLICY inventory_count_reasons_mandant ON public.inventory_count_reasons
  USING (tenant_id = nullif(btrim(current_setting('app.tenant_id', true)), ''))
  WITH CHECK (tenant_id = nullif(btrim(current_setting('app.tenant_id', true)), ''));
REVOKE ALL ON TABLE public.inventory_count_reasons FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.inventory_count_reasons TO service_role;
