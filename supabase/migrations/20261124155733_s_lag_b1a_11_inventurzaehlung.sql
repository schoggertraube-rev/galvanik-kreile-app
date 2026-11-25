-- S-LAG P2 Nr. 4a. Zähloriginal und Buchbestand haben getrennte Lesepfade.
CREATE TABLE public.inventory_counts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  session_id uuid NOT NULL,
  artikel_id text NOT NULL,
  ort_id uuid NOT NULL,
  counted_qty numeric,
  einheit text CHECK (einheit IN ('stk','paar','ml','l','g','kg','mm','cm','m')),
  mengenqualitaet text CHECK (mengenqualitaet IN ('exakt','geschaetzt')),
  gebinde_id uuid,
  gebinde_anzahl bigint,
  rest_menge numeric,
  counted_by uuid,
  counted_at timestamptz,
  version integer NOT NULL DEFAULT 0 CHECK (version >= 0),
  UNIQUE (tenant_id, session_id, artikel_id, ort_id),
  FOREIGN KEY (tenant_id, session_id) REFERENCES public.inventory_sessions (tenant_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, artikel_id) REFERENCES public.inventory_items (tenant_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, ort_id) REFERENCES public.stock_locations (tenant_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, artikel_id, gebinde_id)
    REFERENCES public.packaging_definitions (tenant_id, artikel_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, counted_by) REFERENCES public.app_users (tenant_id, id) ON DELETE RESTRICT,
  CHECK ((counted_qty IS NULL AND mengenqualitaet IS NULL)
    OR (counted_qty IS NOT NULL AND mengenqualitaet IS NOT NULL AND einheit IS NOT NULL
      AND counted_qty >= 0 AND counted_qty < 100000000000 AND scale(counted_qty) <= 3
      AND (einheit NOT IN ('stk','paar') OR counted_qty = trunc(counted_qty)))),
  CHECK ((gebinde_id IS NULL AND gebinde_anzahl IS NULL AND rest_menge IS NULL)
    OR (gebinde_id IS NOT NULL AND gebinde_anzahl IS NOT NULL AND gebinde_anzahl >= 0 AND counted_qty IS NOT NULL
      AND rest_menge IS NOT NULL AND rest_menge >= 0 AND rest_menge < 100000000000 AND scale(rest_menge) <= 3)),
  CHECK ((version = 0 AND num_nonnulls(counted_qty, counted_by, counted_at) = 0)
    OR (version > 0 AND counted_by IS NOT NULL AND counted_at IS NOT NULL AND isfinite(counted_at)))
);
ALTER TABLE public.inventory_counts ENABLE ROW LEVEL SECURITY;
CREATE POLICY inventory_counts_mandant ON public.inventory_counts
  USING (tenant_id = nullif(btrim(current_setting('app.tenant_id', true)), ''))
  WITH CHECK (tenant_id = nullif(btrim(current_setting('app.tenant_id', true)), ''));
REVOKE ALL ON TABLE public.inventory_counts FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.inventory_counts TO service_role;
CREATE UNIQUE INDEX events_lager_inventur_zaehlbefehl_idx ON public.events (tenant_id, client_event_id)
  WHERE event_type = 'LAGER_INVENTUR_ZAEHLUNG_V1' AND client_event_id IS NOT NULL;

CREATE FUNCTION private.lager_inventur_zaehlzeile_schuetzen() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $funktion$
BEGIN
  IF TG_OP = 'DELETE' OR (TG_OP = 'UPDATE' AND
    ROW(NEW.id, NEW.tenant_id, NEW.session_id, NEW.artikel_id, NEW.ort_id)
      IS DISTINCT FROM ROW(OLD.id, OLD.tenant_id, OLD.session_id, OLD.artikel_id, OLD.ort_id)) THEN
    RAISE EXCEPTION 'LAGER_INVENTUR_ZAEHLZEILE_GESCHUETZT' USING ERRCODE = '23514';
  END IF;
  PERFORM 1 FROM public.inventory_sessions sitzung
  WHERE sitzung.tenant_id = NEW.tenant_id AND sitzung.id = NEW.session_id AND sitzung.status = 'offen'
  FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'LAGER_INVENTUR_GESCHLOSSEN' USING ERRCODE = '23514'; END IF;
  RETURN NEW;
END;
$funktion$;
REVOKE ALL ON FUNCTION private.lager_inventur_zaehlzeile_schuetzen() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.lager_inventur_zaehlzeile_schuetzen() TO service_role;
CREATE TRIGGER inventory_counts_schuetzen BEFORE INSERT OR UPDATE OR DELETE ON public.inventory_counts
  FOR EACH ROW EXECUTE FUNCTION private.lager_inventur_zaehlzeile_schuetzen();

CREATE FUNCTION private.lager_inventur_starten(p_session uuid, p_stichtag date, p_akteur uuid)
RETURNS uuid
LANGUAGE plpgsql SET search_path = '' AS $funktion$
DECLARE
  mandant text := nullif(btrim(current_setting('app.tenant_id', true)), '');
  session_neu uuid;
BEGIN
  IF mandant IS NULL OR p_session IS NULL OR p_stichtag IS NULL OR NOT isfinite(p_stichtag)
    OR NOT EXISTS (SELECT 1 FROM public.app_users WHERE tenant_id = mandant AND id = p_akteur AND active)
  THEN RAISE EXCEPTION 'LAGER_INVENTUR_START_UNGUELTIG' USING ERRCODE = '22023'; END IF;

  PERFORM pg_advisory_xact_lock_shared(hashtextextended('lager-inventur:' || mandant, 0));
  INSERT INTO public.inventory_sessions (id, tenant_id, stichtag, art, erstellt_von)
  VALUES (p_session, mandant, p_stichtag, 'stichtag', p_akteur)
  ON CONFLICT DO NOTHING RETURNING id INTO session_neu;
  IF session_neu IS NULL THEN
    IF EXISTS (SELECT 1 FROM public.inventory_sessions s WHERE s.tenant_id = mandant
        AND s.id = p_session AND s.stichtag = p_stichtag AND s.art = 'stichtag' AND s.erstellt_von = p_akteur)
    THEN RETURN p_session; END IF;
    RAISE EXCEPTION 'LAGER_INVENTUR_STICHTAG_BELEGT' USING ERRCODE = '23505';
  END IF;

  INSERT INTO public.inventory_counts (tenant_id, session_id, artikel_id, ort_id, einheit)
  SELECT DISTINCT mandant, p_session, bestand.artikel_id, ort.id, artikel.basiseinheit
  FROM private.material_stock_at((p_stichtag + time '23:59:59') AT TIME ZONE 'Europe/Berlin') bestand
  JOIN public.inventory_items artikel ON artikel.tenant_id = mandant AND artikel.id = bestand.artikel_id
  JOIN public.stock_locations ort ON ort.tenant_id = mandant AND ort.id = bestand.ort_id
  WHERE bestand.eigentum = 'eigen' AND ort.aktiv;
  RETURN session_neu;
END;
$funktion$;

CREATE FUNCTION private.lager_inventur_zaehlzeilen(p_session uuid, p_ort uuid DEFAULT NULL)
RETURNS TABLE (id uuid, artikel_id text, kurznummer integer, artikel_name text, ort_id uuid,
  stockwerk text, bereich text, counted_qty numeric, einheit text, mengenqualitaet text, gebinde_id uuid,
  gebinde_anzahl bigint, rest_menge numeric, counted_by uuid, counted_at timestamptz, version integer)
LANGUAGE sql STABLE SET search_path = '' AS $funktion$
  SELECT zaehlung.id, zaehlung.artikel_id, artikel.kurznummer, artikel.name, ort.id, ort.stockwerk, ort.bereich,
    zaehlung.counted_qty, zaehlung.einheit, zaehlung.mengenqualitaet, zaehlung.gebinde_id, zaehlung.gebinde_anzahl,
    zaehlung.rest_menge, zaehlung.counted_by, zaehlung.counted_at, zaehlung.version
  FROM public.inventory_counts zaehlung
  JOIN public.inventory_items artikel ON artikel.tenant_id = zaehlung.tenant_id AND artikel.id = zaehlung.artikel_id
  JOIN public.stock_locations ort ON ort.tenant_id = zaehlung.tenant_id AND ort.id = zaehlung.ort_id
  WHERE zaehlung.tenant_id = nullif(btrim(current_setting('app.tenant_id', true)), '')
    AND zaehlung.session_id = p_session AND (p_ort IS NULL OR ort.id = p_ort)
  ORDER BY ort.stockwerk, ort.bereich, artikel.kurznummer NULLS LAST, artikel.name, artikel.id
$funktion$;

CREATE FUNCTION private.lager_inventur_zaehlung_sichern(
  p_befehl uuid, p_session uuid, p_artikel text, p_ort uuid, p_version integer, p_akteur uuid,
  p_zeit timestamptz, p_einheit text, p_menge numeric, p_qualitaet text,
  p_gebinde uuid DEFAULT NULL, p_anzahl bigint DEFAULT NULL, p_rest numeric DEFAULT NULL
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
BEGIN
  IF mandant IS NULL OR p_befehl IS NULL OR p_session IS NULL OR p_artikel IS NULL OR p_ort IS NULL
    OR p_version IS NULL OR p_version < 0 OR p_zeit IS NULL OR NOT isfinite(p_zeit)
    OR p_zeit > statement_timestamp()
    OR NOT EXISTS (SELECT 1 FROM public.app_users WHERE tenant_id = mandant AND id = p_akteur AND active)
  THEN RAISE EXCEPTION 'LAGER_INVENTUR_ZAEHLUNG_UNGUELTIG' USING ERRCODE = '22023'; END IF;

  original := jsonb_build_object('sessionId',p_session,'artikelId',p_artikel,'ortId',p_ort,'version',p_version,
    'countedAt',p_zeit,'einheit',p_einheit,'menge',p_menge,'mengenqualitaet',p_qualitaet,
    'gebindeId',p_gebinde,'anzahl',p_anzahl,'rest',p_rest);
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
      'countedBy',zeile.counted_by::text);
  ELSE
    SELECT artikel.basiseinheit INTO basis FROM public.inventory_items artikel
    WHERE artikel.tenant_id = mandant AND artikel.id = p_artikel FOR NO KEY UPDATE;
    IF NOT FOUND OR NOT EXISTS (SELECT 1 FROM public.stock_locations ort
      WHERE ort.tenant_id = mandant AND ort.id = p_ort AND ort.aktiv)
    THEN RAISE EXCEPTION 'LAGER_INVENTUR_ARTIKEL_ODER_ORT_FEHLT' USING ERRCODE = '22023'; END IF;

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
      'menge',zeile.counted_qty::text,'einheit',zeile.einheit,'mengenqualitaet',zeile.mengenqualitaet);
  END IF;

  INSERT INTO public.events (id,tenant_id,event_type,description,user_id,client_event_id,
    status,payload,event_schema_version,aggregate_version,correlation_id)
  VALUES (gen_random_uuid()::text,mandant,'LAGER_INVENTUR_ZAEHLUNG_V1','Inventurzählung',p_akteur,p_befehl,
    'success',jsonb_build_object('original',original,'quittung',receipt),1,greatest(1,coalesce(zeile.version,0)),p_session);
  RETURN receipt;
END;
$funktion$;

REVOKE ALL ON FUNCTION private.lager_inventur_starten(uuid,date,uuid),
  private.lager_inventur_zaehlzeilen(uuid,uuid),
  private.lager_inventur_zaehlung_sichern(uuid,uuid,text,uuid,integer,uuid,timestamptz,text,numeric,text,uuid,bigint,numeric)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.lager_inventur_starten(uuid,date,uuid),
  private.lager_inventur_zaehlzeilen(uuid,uuid),
  private.lager_inventur_zaehlung_sichern(uuid,uuid,text,uuid,integer,uuid,timestamptz,text,numeric,text,uuid,bigint,numeric)
  TO service_role;
