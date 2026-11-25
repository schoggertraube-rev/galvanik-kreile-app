-- S-LAG/L11: Auswertung am Stichtag ist ein eigener Server-Leseport.
CREATE FUNCTION private.lager_inventur_zeilen(p_session uuid, p_methode text)
RETURNS TABLE (
  artikel_id text, kurznummer integer, artikel_name text, ort_id uuid, stockwerk text, bereich text, orttyp text,
  einheit text, stichtag_am timestamptz, soll numeric, roh_ist numeric, ist numeric, differenz numeric,
  zwischenmenge numeric, soll_qualitaet text, ist_qualitaet text, counted_by uuid, counted_at timestamptz,
  ek numeric, preisquelle_id uuid, preisquelle text, wert_eur numeric, differenz_eur numeric,
  bewertung text, grund text, klaerstatus text
)
LANGUAGE sql STABLE SET search_path = '' AS $funktion$
WITH sitzung AS (
  SELECT s.id, s.tenant_id, s.art, (s.stichtag + time '23:59:59') AT TIME ZONE 'Europe/Berlin' AS stichtag_am
  FROM public.inventory_sessions s
  WHERE s.tenant_id = nullif(btrim(current_setting('app.tenant_id', true)), '') AND s.id = p_session
    AND s.status IN ('offen','abschliessend')
), buchbestand AS (
  SELECT bestand.artikel_id, bestand.ort_id,
    CASE WHEN NOT bool_or(bestand.menge IS NULL) THEN sum(bestand.menge) END AS soll,
    CASE WHEN bool_or(bestand.menge IS NULL) THEN 'unbekannt'
      WHEN bool_or(bestand.mengenqualitaet = 'unbestaetigt') THEN 'unbestaetigt'
      WHEN bool_or(bestand.mengenqualitaet = 'geschaetzt') THEN 'geschaetzt' ELSE 'exakt' END AS qualitaet
  FROM sitzung s CROSS JOIN LATERAL private.material_stock_at(s.stichtag_am) bestand
  WHERE bestand.eigentum = 'eigen'
  GROUP BY bestand.artikel_id, bestand.ort_id
), zaehlung AS (
  SELECT z.* FROM sitzung s JOIN public.inventory_counts z ON z.tenant_id = s.tenant_id AND z.session_id = s.id
), identitaeten AS (
  SELECT bestand.artikel_id, bestand.ort_id FROM buchbestand bestand
  WHERE (SELECT art FROM sitzung) = 'stichtag'
  UNION
  SELECT z.artikel_id, z.ort_id FROM zaehlung z
), mengen AS (
  SELECT artikel.id AS artikel_id, artikel.kurznummer, artikel.name AS artikel_name, ort.id AS ort_id,
    ort.stockwerk, ort.bereich, ort.orttyp, coalesce(z.einheit,artikel.basiseinheit) AS einheit, s.stichtag_am,
    bestand.soll, z.counted_qty AS roh_ist, bestand.qualitaet AS soll_qualitaet,
    z.mengenqualitaet AS ist_qualitaet, z.counted_by, z.counted_at,
    CASE WHEN z.counted_at IS NULL THEN NULL
      WHEN z.counted_at > s.stichtag_am THEN zwischen.summe ELSE -zwischen.summe END AS zwischenmenge,
    CASE WHEN z.counted_qty IS NOT NULL AND zwischen.summe IS NOT NULL
      THEN z.counted_qty + CASE WHEN z.counted_at > s.stichtag_am THEN -zwischen.summe ELSE zwischen.summe END END AS ist,
    preis.id AS preisquelle_id, preis.quelle AS preisquelle, preis.einzelpreis AS ek
  FROM identitaeten ids
  CROSS JOIN sitzung s
  JOIN public.inventory_items artikel ON artikel.tenant_id = s.tenant_id AND artikel.id = ids.artikel_id
  LEFT JOIN public.stock_locations ort ON ort.tenant_id = s.tenant_id AND ort.id = ids.ort_id
  LEFT JOIN buchbestand bestand ON bestand.artikel_id = ids.artikel_id AND bestand.ort_id IS NOT DISTINCT FROM ids.ort_id
  LEFT JOIN zaehlung z ON z.artikel_id = ids.artikel_id AND z.ort_id = ids.ort_id
  LEFT JOIN LATERAL (
    SELECT CASE WHEN NOT coalesce(bool_or(b.quantity IS NULL OR b.mengeneinheit IS DISTINCT FROM z.einheit), false)
      THEN coalesce(sum(b.quantity),0) END AS summe
    FROM public.stock_movements b
    WHERE b.tenant_id = s.tenant_id AND b.inventory_item_id = artikel.id AND b.ort_id = z.ort_id
      AND b.eigentum = 'eigen' AND b.befehl_id IS NOT NULL AND b.lagerwirksam AND z.counted_at IS NOT NULL
      AND b.fachzeit > least(s.stichtag_am,z.counted_at) AND b.fachzeit <= greatest(s.stichtag_am,z.counted_at)
  ) zwischen ON true
  LEFT JOIN LATERAL (
    SELECT basis.preisquelle_id AS id, quelle.quelle, basis.einzelpreis
    FROM private.lager_kalkulationsbasis(artikel.id, s.stichtag_am, p_methode) basis
    JOIN public.material_prices quelle
      ON quelle.tenant_id = s.tenant_id AND quelle.artikel_id = artikel.id AND quelle.id = basis.preisquelle_id
    WHERE ort.orttyp IS DISTINCT FROM 'bad_prozess' AND coalesce(z.einheit,artikel.basiseinheit) IS NOT NULL
  ) preis ON true
)
SELECT z.artikel_id, z.kurznummer, z.artikel_name, z.ort_id, z.stockwerk, z.bereich, z.orttyp, z.einheit, z.stichtag_am,
  z.soll, z.roh_ist, z.ist, z.ist - z.soll AS differenz, z.zwischenmenge, z.soll_qualitaet, z.ist_qualitaet,
  z.counted_by, z.counted_at, z.ek, z.preisquelle_id, z.preisquelle,
  CASE WHEN z.ist >= 0 AND round(z.ist*z.ek,2) < 1000000000000 THEN round(z.ist*z.ek,2) END AS wert_eur,
  CASE WHEN abs(round((z.ist-z.soll)*z.ek,2)) < 1000000000000 THEN round((z.ist-z.soll)*z.ek,2) END AS differenz_eur,
  CASE WHEN z.ek IS NULL OR z.ist IS NULL OR z.ist < 0 OR round(z.ist*z.ek,2) >= 1000000000000
    THEN 'unbewertet' ELSE 'vorlaeufig' END AS bewertung,
  CASE WHEN z.roh_ist IS NOT NULL THEN 'inventur' END AS grund,
  CASE WHEN z.ort_id IS NULL THEN 'ort_offen'
    WHEN z.roh_ist IS NULL THEN 'nicht_gezaehlt'
    WHEN z.ist IS NULL OR z.ist < 0 THEN 'zwischenbuchung_offen'
    WHEN z.soll IS NULL THEN 'soll_offen'
    WHEN z.soll IS DISTINCT FROM z.ist THEN 'abweichung' ELSE 'ok' END AS klaerstatus
FROM mengen z
ORDER BY z.stockwerk NULLS LAST, z.bereich NULLS LAST, z.kurznummer NULLS LAST, z.artikel_name, z.artikel_id
$funktion$;
REVOKE ALL ON FUNCTION private.lager_inventur_zeilen(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.lager_inventur_zeilen(uuid, text) TO service_role;
