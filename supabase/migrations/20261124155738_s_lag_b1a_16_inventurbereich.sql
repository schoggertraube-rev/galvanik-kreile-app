-- V3 A16: dieselbe Inventursitzung, begrenzt auf gewählte Lagerorte.
ALTER TABLE public.inventory_sessions ADD COLUMN bereich_orte uuid[];

-- Die Kalenderreservierung verhindert überlappende Bereiche auch bei zwei Geräten.
DROP INDEX public.inventory_sessions_stichtag_key;
DROP INDEX public.inventory_sessions_offen_key;
CREATE UNIQUE INDEX inventory_sessions_stichtag_key ON public.inventory_sessions (tenant_id, stichtag)
  WHERE art = 'stichtag' AND bereich_orte IS NULL;
CREATE UNIQUE INDEX inventory_sessions_offen_key ON public.inventory_sessions (tenant_id, stichtag)
  WHERE status IN ('offen','abschliessend') AND bereich_orte IS NULL;

CREATE FUNCTION private.lager_inventur_bereich_pruefen() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $funktion$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF ROW(NEW.bereich_orte,NEW.tenant_id,NEW.stichtag,NEW.art,NEW.ursprung_id)
      IS DISTINCT FROM ROW(OLD.bereich_orte,OLD.tenant_id,OLD.stichtag,OLD.art,OLD.ursprung_id)
    THEN RAISE EXCEPTION 'LAGER_INVENTUR_BEREICH_UNVERAENDERLICH' USING ERRCODE = '23514'; END IF;
    RETURN NEW;
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('lager-inventur-kalender:' || NEW.tenant_id || ':' || NEW.stichtag::text,0));
  IF NEW.art = 'nachtrag' THEN
    SELECT ursprung.bereich_orte INTO NEW.bereich_orte FROM public.inventory_sessions ursprung
    WHERE ursprung.tenant_id = NEW.tenant_id AND ursprung.id = NEW.ursprung_id AND ursprung.stichtag = NEW.stichtag;
  ELSIF NEW.bereich_orte IS NOT NULL THEN
    IF cardinality(NEW.bereich_orte) = 0
      OR cardinality(NEW.bereich_orte) <> (
        SELECT count(*) FROM public.stock_locations o
        WHERE o.tenant_id = NEW.tenant_id AND o.aktiv AND o.id = ANY(NEW.bereich_orte)
      )
    THEN RAISE EXCEPTION 'LAGER_INVENTUR_BEREICH_UNGUELTIG' USING ERRCODE = '22023'; END IF;
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.inventory_sessions s WHERE s.tenant_id = NEW.tenant_id AND s.stichtag = NEW.stichtag
      AND s.id <> NEW.id
      AND (s.bereich_orte IS NULL OR NEW.bereich_orte IS NULL OR s.bereich_orte && NEW.bereich_orte)
      AND ((s.art = 'stichtag' AND NEW.art = 'stichtag')
        OR (s.status IN ('offen','abschliessend') AND NEW.status IN ('offen','abschliessend')))
  ) THEN RAISE EXCEPTION 'LAGER_INVENTUR_BEREICH_BELEGT' USING ERRCODE = '23505'; END IF;
  RETURN NEW;
END;
$funktion$;
CREATE TRIGGER inventory_sessions_lager_bereich_pruefen
  BEFORE INSERT OR UPDATE ON public.inventory_sessions FOR EACH ROW EXECUTE FUNCTION private.lager_inventur_bereich_pruefen();

CREATE FUNCTION private.lager_inventur_starten(p_session uuid, p_stichtag date, p_akteur uuid, p_orte uuid[])
RETURNS uuid
LANGUAGE plpgsql SET search_path = '' AS $funktion$
DECLARE
  mandant text := nullif(btrim(current_setting('app.tenant_id', true)), '');
  session_neu uuid;
  auswahl uuid[];
BEGIN
  IF mandant IS NULL OR p_session IS NULL OR p_stichtag IS NULL OR NOT isfinite(p_stichtag)
    OR NOT EXISTS (SELECT 1 FROM public.app_users WHERE tenant_id = mandant AND id = p_akteur AND active)
  THEN RAISE EXCEPTION 'LAGER_INVENTUR_START_UNGUELTIG' USING ERRCODE = '22023'; END IF;

  IF p_orte IS NOT NULL THEN
    SELECT array_agg(id ORDER BY id) INTO auswahl FROM unnest(p_orte) ort(id);
    IF auswahl IS NULL THEN RAISE EXCEPTION 'LAGER_INVENTUR_BEREICH_LEER' USING ERRCODE = '22023'; END IF;
  END IF;
  PERFORM pg_advisory_xact_lock_shared(hashtextextended('lager-inventur:' || mandant, 0));
  INSERT INTO public.inventory_sessions (id, tenant_id, stichtag, art, erstellt_von, bereich_orte)
  VALUES (p_session, mandant, p_stichtag, 'stichtag', p_akteur, auswahl)
  ON CONFLICT DO NOTHING RETURNING id INTO session_neu;
  IF session_neu IS NULL THEN
    IF EXISTS (SELECT 1 FROM public.inventory_sessions s WHERE s.tenant_id = mandant
        AND s.id = p_session AND s.stichtag = p_stichtag AND s.art = 'stichtag' AND s.erstellt_von = p_akteur
        AND s.bereich_orte IS NOT DISTINCT FROM auswahl)
    THEN RETURN p_session; END IF;
    RAISE EXCEPTION 'LAGER_INVENTUR_STICHTAG_BELEGT' USING ERRCODE = '23505';
  END IF;

  INSERT INTO public.inventory_counts (tenant_id, session_id, artikel_id, ort_id, einheit)
  SELECT DISTINCT mandant, p_session, bestand.artikel_id, ort.id, artikel.basiseinheit
  FROM private.material_stock_at((p_stichtag + time '23:59:59') AT TIME ZONE 'Europe/Berlin') bestand
  JOIN public.inventory_items artikel ON artikel.tenant_id = mandant AND artikel.id = bestand.artikel_id
  JOIN public.stock_locations ort ON ort.tenant_id = mandant AND ort.id = bestand.ort_id
  WHERE bestand.eigentum = 'eigen' AND ort.aktiv AND (auswahl IS NULL OR ort.id = ANY(auswahl));
  RETURN session_neu;
END;
$funktion$;

CREATE OR REPLACE FUNCTION private.lager_inventur_starten(p_session uuid, p_stichtag date, p_akteur uuid)
RETURNS uuid LANGUAGE sql SET search_path = '' AS $funktion$
  SELECT private.lager_inventur_starten(p_session,p_stichtag,p_akteur,NULL::uuid[])
$funktion$;
REVOKE ALL ON FUNCTION private.lager_inventur_starten(uuid,date,uuid,uuid[]),
  private.lager_inventur_bereich_pruefen() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.lager_inventur_starten(uuid,date,uuid,uuid[]),
  private.lager_inventur_bereich_pruefen() TO service_role;

CREATE OR REPLACE FUNCTION private.lager_inventur_zaehlzeile_schuetzen() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $funktion$
BEGIN
  IF TG_OP = 'DELETE' OR (TG_OP = 'UPDATE' AND
    ROW(NEW.id, NEW.tenant_id, NEW.session_id, NEW.artikel_id, NEW.ort_id)
      IS DISTINCT FROM ROW(OLD.id, OLD.tenant_id, OLD.session_id, OLD.artikel_id, OLD.ort_id)) THEN
    RAISE EXCEPTION 'LAGER_INVENTUR_ZAEHLZEILE_GESCHUETZT' USING ERRCODE = '23514';
  END IF;
  PERFORM 1 FROM public.inventory_sessions sitzung
  WHERE sitzung.tenant_id = NEW.tenant_id AND sitzung.id = NEW.session_id AND sitzung.status = 'offen'
    AND (sitzung.bereich_orte IS NULL OR NEW.ort_id = ANY(sitzung.bereich_orte))
  FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'LAGER_INVENTUR_GESCHLOSSEN' USING ERRCODE = '23514'; END IF;
  RETURN NEW;
END;
$funktion$;

DROP FUNCTION private.lager_inventur_zeilen(uuid, text);

CREATE OR REPLACE FUNCTION private.lager_inventur_zeilen(p_session uuid, p_methode text)
RETURNS TABLE (
  artikel_id text, kurznummer integer, artikel_name text, rubrik_name text, ort_id uuid, stockwerk text, bereich text, orttyp text,
  einheit text, stichtag_am timestamptz, soll numeric, roh_ist numeric, ist numeric, differenz numeric,
  zwischenmenge numeric, soll_qualitaet text, ist_qualitaet text, counted_by uuid, counted_at timestamptz,
  ek numeric, preisquelle_id uuid, preisquelle text, wert_eur numeric, differenz_eur numeric,
  bewertung text, grund text, klaerstatus text
)
LANGUAGE sql STABLE SET search_path = '' AS $funktion$
WITH sitzung AS (
  SELECT s.id, s.tenant_id, s.art, s.bereich_orte, (s.stichtag + time '23:59:59') AT TIME ZONE 'Europe/Berlin' AS stichtag_am
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
  WHERE bestand.eigentum = 'eigen' AND (s.bereich_orte IS NULL OR bestand.ort_id = ANY(s.bereich_orte))
  GROUP BY bestand.artikel_id, bestand.ort_id
), zaehlung AS (
  SELECT z.* FROM sitzung s JOIN public.inventory_counts z ON z.tenant_id = s.tenant_id AND z.session_id = s.id
), identitaeten AS (
  SELECT bestand.artikel_id, bestand.ort_id FROM buchbestand bestand
  WHERE (SELECT art FROM sitzung) = 'stichtag'
  UNION
  SELECT z.artikel_id, z.ort_id FROM zaehlung z
), mengen AS (
  SELECT s.tenant_id, artikel.id AS artikel_id, artikel.kurznummer, artikel.name AS artikel_name, rubrik.name AS rubrik_name, ort.id AS ort_id,
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
  LEFT JOIN public.categories rubrik ON rubrik.tenant_id = artikel.tenant_id AND rubrik.id = artikel.rubrik_id
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
SELECT z.artikel_id, z.kurznummer, z.artikel_name, z.rubrik_name, z.ort_id, z.stockwerk, z.bereich, z.orttyp, z.einheit, z.stichtag_am,
  z.soll, z.roh_ist, z.ist, z.ist - z.soll AS differenz, z.zwischenmenge, z.soll_qualitaet, z.ist_qualitaet,
  z.counted_by, z.counted_at, z.ek, z.preisquelle_id, z.preisquelle,
  CASE WHEN z.ist >= 0 AND round(z.ist*z.ek,2) < 1000000000000 THEN round(z.ist*z.ek,2) END AS wert_eur,
  CASE WHEN abs(round((z.ist-z.soll)*z.ek,2)) < 1000000000000 THEN round((z.ist-z.soll)*z.ek,2) END AS differenz_eur,
  CASE WHEN z.ek IS NULL OR z.ist IS NULL OR z.ist < 0 OR round(z.ist*z.ek,2) >= 1000000000000
    THEN 'unbewertet' ELSE 'vorlaeufig' END AS bewertung,
  coalesce(g.grund, CASE WHEN z.roh_ist IS NOT NULL THEN 'inventur' END) AS grund,
  CASE WHEN z.ort_id IS NULL THEN 'ort_offen'
    WHEN z.roh_ist IS NULL THEN 'nicht_gezaehlt'
    WHEN z.ist IS NULL OR z.ist < 0 THEN 'zwischenbuchung_offen'
    WHEN z.soll IS NULL THEN 'soll_offen'
    WHEN z.soll IS DISTINCT FROM z.ist THEN 'abweichung' ELSE 'ok' END AS klaerstatus
FROM mengen z
LEFT JOIN public.inventory_count_reasons g
  ON g.tenant_id = z.tenant_id AND g.session_id = p_session
  AND g.artikel_id = z.artikel_id AND g.ort_id = z.ort_id
  AND g.zaehl_version = (
    SELECT c.version FROM public.inventory_counts c
    WHERE c.tenant_id = g.tenant_id AND c.session_id = g.session_id
      AND c.artikel_id = g.artikel_id AND c.ort_id = g.ort_id
  )
ORDER BY z.stockwerk NULLS LAST, z.bereich NULLS LAST, z.kurznummer NULLS LAST, z.artikel_name, z.artikel_id
$funktion$;
REVOKE ALL ON FUNCTION private.lager_inventur_zeilen(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.lager_inventur_zeilen(uuid, text) TO service_role;
