-- V3 A19/A20: Die Journalzeilen bleiben gleich, eine Zählung speichert ihre Bewegungsrevision.
ALTER TABLE public.inventory_counts ADD COLUMN bewegung_revision text
  CHECK (bewegung_revision ~ '^[0-9a-f]{64}$');

CREATE FUNCTION private.lager_inventur_bewegungsrevision(p_artikel text, p_ort uuid, p_bis timestamptz)
RETURNS text LANGUAGE sql STABLE SET search_path = '' AS $funktion$
 SELECT encode(sha256(convert_to(coalesce(string_agg(b.id::text,',' ORDER BY b.id),''),'UTF8')),'hex')
 FROM public.stock_movements b
 WHERE b.tenant_id = nullif(btrim(current_setting('app.tenant_id',true)),'')
   AND b.inventory_item_id = p_artikel AND b.ort_id = p_ort AND b.eigentum = 'eigen'
   AND b.befehl_id IS NOT NULL AND b.lagerwirksam AND b.fachzeit <= p_bis
$funktion$;

CREATE FUNCTION private.lager_inventur_zaehlrevision_sichern() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $funktion$
DECLARE grenze timestamptz;
BEGIN
  IF NEW.counted_qty IS NULL THEN NEW.bewegung_revision := NULL; RETURN NEW; END IF;
  IF NEW.tenant_id IS DISTINCT FROM nullif(btrim(current_setting('app.tenant_id',true)),'')
    THEN RAISE EXCEPTION 'LAGER_INVENTUR_MANDANT_FEHLT' USING ERRCODE = '22023'; END IF;
  SELECT greatest(NEW.counted_at,(s.stichtag + time '23:59:59') AT TIME ZONE 'Europe/Berlin')
    INTO grenze FROM public.inventory_sessions s WHERE s.tenant_id = NEW.tenant_id AND s.id = NEW.session_id;
  NEW.bewegung_revision := private.lager_inventur_bewegungsrevision(NEW.artikel_id,NEW.ort_id,grenze);
  RETURN NEW;
END;
$funktion$;
CREATE TRIGGER inventory_counts_zaehlrevision
  BEFORE INSERT OR UPDATE ON public.inventory_counts
  FOR EACH ROW EXECUTE FUNCTION private.lager_inventur_zaehlrevision_sichern();

CREATE FUNCTION private.lager_inventur_zaehlung_sichern(
  p_befehl uuid, p_session uuid, p_artikel text, p_ort uuid, p_version integer, p_akteur uuid,
  p_zeit timestamptz, p_einheit text, p_menge numeric, p_qualitaet text,
  p_gebinde uuid, p_anzahl bigint, p_rest numeric, p_bewegung_revision text
) RETURNS jsonb
LANGUAGE plpgsql SET search_path = '' AS $funktion$
DECLARE
  mandant text := nullif(btrim(current_setting('app.tenant_id', true)), '');
  original jsonb;
  receipt jsonb;
  vorgaenger record;
  sitzung record;
  zeile public.inventory_counts%ROWTYPE;
  basis text;
  fuellung numeric;
  menge numeric := p_menge;
  qualitaet text := p_qualitaet;
  aktuell text;
BEGIN
  IF mandant IS NULL OR p_befehl IS NULL OR p_session IS NULL OR p_artikel IS NULL OR p_ort IS NULL
    OR p_version IS NULL OR p_version < 0 OR p_zeit IS NULL OR NOT isfinite(p_zeit)
    OR p_zeit > statement_timestamp()
    OR (p_bewegung_revision IS NOT NULL AND p_bewegung_revision !~ '^[0-9a-f]{64}$')
    OR NOT EXISTS (SELECT 1 FROM public.app_users WHERE tenant_id = mandant AND id = p_akteur AND active)
  THEN RAISE EXCEPTION 'LAGER_INVENTUR_ZAEHLUNG_UNGUELTIG' USING ERRCODE = '22023'; END IF;

  original := jsonb_build_object('sessionId',p_session,'artikelId',p_artikel,'ortId',p_ort,'version',p_version,
    'countedAt',p_zeit,'einheit',p_einheit,'menge',p_menge,'mengenqualitaet',p_qualitaet,
     'gebindeId',p_gebinde,'anzahl',p_anzahl,'rest',p_rest)
    || CASE WHEN p_bewegung_revision IS NULL THEN '{}'::jsonb
      ELSE jsonb_build_object('bewegungRevision',p_bewegung_revision) END;
  PERFORM pg_advisory_xact_lock_shared(hashtextextended('lager-inventur:' || mandant, 0));
  PERFORM pg_advisory_xact_lock(hashtextextended('lager-inventur-zaehlung:' || mandant || ':' || p_befehl, 0));
  SELECT event.user_id, event.payload INTO vorgaenger FROM public.events event
  WHERE event.tenant_id = mandant AND event.client_event_id = p_befehl
    AND event.event_type = 'LAGER_INVENTUR_ZAEHLUNG_V1';
  IF FOUND THEN
    IF vorgaenger.user_id IS DISTINCT FROM p_akteur OR vorgaenger.payload->'original' IS DISTINCT FROM original
    THEN RAISE EXCEPTION 'LAGER_INVENTUR_ZAEHLBEFEHL_KONFLIKT' USING ERRCODE = '23505'; END IF;
    RETURN vorgaenger.payload->'quittung';
  END IF;

  SELECT s.status INTO sitzung FROM public.inventory_sessions s
  WHERE s.tenant_id = mandant AND s.id = p_session FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'LAGER_INVENTUR_SITZUNG_FEHLT' USING ERRCODE = '22023'; END IF;
  SELECT z.* INTO zeile FROM public.inventory_counts z
  WHERE z.tenant_id = mandant AND z.session_id = p_session AND z.artikel_id = p_artikel AND z.ort_id = p_ort;

  IF sitzung.status <> 'offen' THEN
    receipt := jsonb_build_object('code','ABGESCHLOSSEN');
  ELSIF coalesce(zeile.version,0) <> p_version THEN
    receipt := jsonb_build_object('code','VERSION_KONFLIKT','version',coalesce(zeile.version,0),
      'menge',zeile.counted_qty::text,'einheit',zeile.einheit,'mengenqualitaet',zeile.mengenqualitaet,
        'countedBy',zeile.counted_by::text,'bewegungRevision',zeile.bewegung_revision);
  ELSE
    SELECT artikel.basiseinheit INTO basis FROM public.inventory_items artikel
    WHERE artikel.tenant_id = mandant AND artikel.id = p_artikel FOR NO KEY UPDATE;
    IF NOT FOUND OR NOT EXISTS (SELECT 1 FROM public.stock_locations ort
      WHERE ort.tenant_id = mandant AND ort.id = p_ort AND ort.aktiv)
    THEN RAISE EXCEPTION 'LAGER_INVENTUR_ARTIKEL_ODER_ORT_FEHLT' USING ERRCODE = '22023'; END IF;

    aktuell := private.lager_inventur_bewegungsrevision(p_artikel,p_ort,statement_timestamp());
    IF p_bewegung_revision IS NOT NULL AND p_bewegung_revision <> aktuell THEN
      receipt := jsonb_build_object('code','BEWEGUNG_KONFLIKT','bewegungRevision',aktuell,
        'version',coalesce(zeile.version,0),'menge',zeile.counted_qty::text,
        'einheit',zeile.einheit,'mengenqualitaet',zeile.mengenqualitaet);
    ELSE
      IF (p_menge IS NOT NULL OR p_gebinde IS NOT NULL) AND (p_einheit IS NULL
        OR (basis IS NOT NULL AND p_einheit <> basis)
        OR EXISTS (SELECT 1 FROM public.stock_movements bewegung
          WHERE bewegung.tenant_id = mandant AND bewegung.inventory_item_id = p_artikel
            AND bewegung.lagerwirksam AND bewegung.befehl_id IS NOT NULL AND bewegung.quantity <> 0
            AND bewegung.mengeneinheit IS DISTINCT FROM p_einheit))
      THEN RAISE EXCEPTION 'LAGER_INVENTUR_EINHEIT_KONFLIKT' USING ERRCODE = '22023'; END IF;

      IF p_gebinde IS NOT NULL THEN
        IF p_menge IS NOT NULL OR p_anzahl IS NULL OR p_anzahl < 0 OR p_rest IS NULL OR p_rest < 0
        THEN RAISE EXCEPTION 'LAGER_INVENTUR_GEBINDE_UNGUELTIG' USING ERRCODE = '22023'; END IF;
        WITH faktor (einheit, dimension, groesse) AS (
          VALUES ('stk','stueck',1), ('paar','paar',1), ('ml','volumen',1), ('l','volumen',1000),
            ('g','masse',1), ('kg','masse',1000), ('mm','laenge',1), ('cm','laenge',10), ('m','laenge',1000)
        )
        SELECT CASE WHEN g.umrechnung_basiseinheit = p_einheit THEN g.umrechnung_basismenge
          WHEN von.dimension = nach.dimension THEN g.inhalt_menge * von.groesse / nach.groesse END INTO fuellung
        FROM public.packaging_definitions g
        JOIN faktor von ON von.einheit = g.inhalt_einheit
        JOIN faktor nach ON nach.einheit = p_einheit
        WHERE g.tenant_id = mandant AND g.artikel_id = p_artikel
          AND g.id = p_gebinde AND g.gueltig_ab <= p_zeit;
        IF fuellung IS NULL OR p_rest >= fuellung
        THEN RAISE EXCEPTION 'LAGER_INVENTUR_GEBINDE_UNGUELTIG' USING ERRCODE = '22023'; END IF;
        menge := trim_scale(p_anzahl * fuellung + p_rest);
      ELSIF p_anzahl IS NOT NULL OR p_rest IS NOT NULL THEN
        RAISE EXCEPTION 'LAGER_INVENTUR_GEBINDE_UNGUELTIG' USING ERRCODE = '22023';
      END IF;
      IF menge IS NULL AND qualitaet IS NOT NULL OR menge IS NOT NULL AND qualitaet IS NULL
      THEN RAISE EXCEPTION 'LAGER_INVENTUR_MENGENQUALITAET_FEHLT' USING ERRCODE = '22023'; END IF;

      INSERT INTO public.inventory_counts AS z (
        tenant_id, session_id, artikel_id, ort_id, counted_qty, einheit, mengenqualitaet, gebinde_id,
        gebinde_anzahl, rest_menge, counted_by, counted_at, version
      ) VALUES (
        mandant, p_session, p_artikel, p_ort, menge, coalesce(p_einheit,basis), qualitaet, p_gebinde,
        p_anzahl, p_rest, p_akteur, p_zeit, p_version+1
      )
      ON CONFLICT (tenant_id, session_id, artikel_id, ort_id) DO UPDATE
        SET counted_qty = excluded.counted_qty, einheit = excluded.einheit, mengenqualitaet = excluded.mengenqualitaet,
          gebinde_id = excluded.gebinde_id, gebinde_anzahl = excluded.gebinde_anzahl, rest_menge = excluded.rest_menge,
          counted_by = excluded.counted_by, counted_at = excluded.counted_at, version = excluded.version
      RETURNING z.* INTO zeile;
      receipt := jsonb_build_object('code','OK','id',zeile.id,'version',zeile.version,
        'menge',zeile.counted_qty::text,'einheit',zeile.einheit,'mengenqualitaet',zeile.mengenqualitaet,
        'bewegungRevision',aktuell);
    END IF;
  END IF;

  INSERT INTO public.events (id,tenant_id,event_type,description,user_id,client_event_id,
    status,payload,event_schema_version,aggregate_version,correlation_id)
  VALUES (gen_random_uuid()::text,mandant,'LAGER_INVENTUR_ZAEHLUNG_V1','Inventurzählung',p_akteur,p_befehl,
    'success',jsonb_build_object('original',original,'quittung',receipt),1,greatest(1,coalesce(zeile.version,0)),p_session);
  RETURN receipt;
END;
$funktion$;

-- Der bisherige Port bleibt in Paket-Proben und bei bereits erfassten Originalen gültig.
CREATE OR REPLACE FUNCTION private.lager_inventur_zaehlung_sichern(
  p_befehl uuid, p_session uuid, p_artikel text, p_ort uuid, p_version integer, p_akteur uuid,
  p_zeit timestamptz, p_einheit text, p_menge numeric, p_qualitaet text,
  p_gebinde uuid DEFAULT NULL, p_anzahl bigint DEFAULT NULL, p_rest numeric DEFAULT NULL
) RETURNS jsonb LANGUAGE sql SET search_path = '' AS $funktion$
  SELECT private.lager_inventur_zaehlung_sichern(p_befehl,p_session,p_artikel,p_ort,p_version,p_akteur,
    p_zeit,p_einheit,p_menge,p_qualitaet,p_gebinde,p_anzahl,p_rest,NULL::text)
$funktion$;
REVOKE ALL ON FUNCTION private.lager_inventur_bewegungsrevision(text,uuid,timestamptz),
  private.lager_inventur_zaehlrevision_sichern(),
  private.lager_inventur_zaehlung_sichern(uuid,uuid,text,uuid,integer,uuid,timestamptz,text,numeric,text,uuid,bigint,numeric,text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.lager_inventur_bewegungsrevision(text,uuid,timestamptz),
  private.lager_inventur_zaehlrevision_sichern(),
  private.lager_inventur_zaehlung_sichern(uuid,uuid,text,uuid,integer,uuid,timestamptz,text,numeric,text,uuid,bigint,numeric,text)
  TO service_role;

CREATE OR REPLACE FUNCTION private.lager_inventur_abschluss_vorbereiten(p_session uuid, p_akteur uuid, p_methode text)
RETURNS integer LANGUAGE plpgsql SET search_path = '' AS $funktion$
DECLARE
  mandant text := nullif(btrim(current_setting('app.tenant_id', true)), '');
  sitzung record;
  anzahl integer;
  zeile record;
  kuerzel text;
BEGIN
  IF mandant IS NULL OR NOT EXISTS (SELECT 1 FROM public.app_users
    WHERE tenant_id = mandant AND id = p_akteur AND active AND role = 'admin')
  THEN RAISE EXCEPTION 'LAGER_INVENTUR_ABSCHLUSS_RECHT_FEHLT' USING ERRCODE = '42501'; END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('lager-inventur:' || mandant,0));
  SELECT s.status, s.stichtag INTO sitzung FROM public.inventory_sessions s
    WHERE s.tenant_id = mandant AND s.id = p_session FOR UPDATE;
  IF NOT FOUND OR sitzung.status <> 'offen'
    OR ((sitzung.stichtag + time '23:59:59') AT TIME ZONE 'Europe/Berlin') > statement_timestamp()
  THEN RAISE EXCEPTION 'LAGER_INVENTUR_ABSCHLUSS_KONFLIKT' USING ERRCODE = '23505'; END IF;

  IF EXISTS (SELECT 1 FROM public.inventory_counts z
    WHERE z.tenant_id = mandant AND z.session_id = p_session AND z.counted_qty IS NOT NULL
      AND z.bewegung_revision IS DISTINCT FROM private.lager_inventur_bewegungsrevision(z.artikel_id,z.ort_id,
        greatest(z.counted_at,(sitzung.stichtag + time '23:59:59') AT TIME ZONE 'Europe/Berlin'))
  ) THEN RAISE EXCEPTION 'LAGER_INVENTUR_ZAEHLUNG_VERALTET' USING ERRCODE = '23505'; END IF;
  UPDATE public.inventory_sessions SET status = 'abschliessend'  WHERE tenant_id = mandant AND id = p_session;

  INSERT INTO public.inventory_lines (tenant_id, session_id, position, artikel_id, ort_id, snapshot)
  SELECT mandant, p_session,
    row_number() OVER (ORDER BY z.stockwerk NULLS LAST,z.bereich NULLS LAST,z.kurznummer NULLS LAST,z.artikel_id,z.ort_id),
    z.artikel_id, z.ort_id, jsonb_build_object(
      'artikelId',z.artikel_id,'kurznummer',z.kurznummer,'artikelName',z.artikel_name,
      'rubrikName',z.rubrik_name,'ortId',z.ort_id,
      'stockwerk',z.stockwerk,'bereich',z.bereich,'orttyp',z.orttyp,'einheit',z.einheit,'stichtagAm',z.stichtag_am,
      'soll',z.soll::text,'rohIst',z.roh_ist::text,'ist',z.ist::text,'differenz',z.differenz::text,
      'zwischenmenge',z.zwischenmenge::text,'sollQualitaet',z.soll_qualitaet,'istQualitaet',z.ist_qualitaet,
      'countedBy',z.counted_by,'countedAt',z.counted_at,'ek',z.ek::text,'preisquelleId',z.preisquelle_id,
      'preisquelle',z.preisquelle,'wertEur',z.wert_eur::text,'differenzEur',z.differenz_eur::text,
      'bewertung',z.bewertung,'bewertungsmethode',p_methode,'grund',z.grund,'klaerstatus',z.klaerstatus)
  FROM private.lager_inventur_zeilen(p_session, p_methode) z;
  GET DIAGNOSTICS anzahl = ROW_COUNT;

  FOR zeile IN
    SELECT zeilen.id, zeilen.artikel_id, zeilen.ort_id, zeilen.snapshot, artikel.stamm_version, ort.bad_id
    FROM public.inventory_lines zeilen
    JOIN public.inventory_items artikel ON artikel.tenant_id = zeilen.tenant_id AND artikel.id = zeilen.artikel_id
    JOIN public.stock_locations ort ON ort.tenant_id = zeilen.tenant_id AND ort.id = zeilen.ort_id
    WHERE zeilen.tenant_id = mandant AND zeilen.session_id = p_session
      AND zeilen.snapshot->>'klaerstatus' = 'abweichung'
      AND (zeilen.snapshot->>'differenz')::numeric <> 0
    ORDER BY zeilen.position
  LOOP
    kuerzel := encode(sha256(convert_to(p_session::text || ':' || zeile.id::text || ':' || zeile.snapshot::text, 'UTF8')), 'hex');
    PERFORM private.lager_journal_anhaengen(zeile.id, kuerzel, p_akteur,
      jsonb_build_array(jsonb_build_object(
        'artikel_id',zeile.artikel_id,'art','count_correction','menge',trim_scale((zeile.snapshot->>'differenz')::numeric),
        'ort_id',zeile.ort_id,'einheit',zeile.snapshot->>'einheit','fachzeit',zeile.snapshot->>'stichtagAm',
        'revision',zeile.stamm_version,'mengenqualitaet',zeile.snapshot->>'istQualitaet','geschaeftsgrund','inventur',
        'eigentum','eigen','bad_id',zeile.bad_id,
        'bestandsart',CASE WHEN zeile.snapshot->>'orttyp' IN ('werkstatt','bad_prozess')
          THEN 'werkstatt_prozess' ELSE 'verfuegbar' END,
        'notiz','Inventur ' || to_char(sitzung.stichtag,'DD.MM.YYYY')
      )));
  END LOOP;
  RETURN anzahl;
END;
$funktion$;
