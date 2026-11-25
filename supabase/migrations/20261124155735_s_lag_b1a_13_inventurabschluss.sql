-- P2 Nr. 4c: eingefrorene Inventurzeilen, Nachtrag und unveränderlicher Abschluss.
ALTER TABLE public.inventory_sessions
  ADD COLUMN abschluss_befehl_id uuid,
  ADD COLUMN csv_dokument_id uuid,
  ADD COLUMN csv_sha256 text CHECK (csv_sha256 ~ '^[0-9a-f]{64}$'),
  ADD COLUMN pdf_dokument_id uuid,
  ADD COLUMN pdf_sha256 text CHECK (pdf_sha256 ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT inventory_sessions_lager_archivpaar_chk CHECK (
    (csv_dokument_id IS NULL) = (csv_sha256 IS NULL) AND (pdf_dokument_id IS NULL) = (pdf_sha256 IS NULL)
    AND (abschluss_befehl_id IS NULL OR (status = 'abgeschlossen' AND csv_dokument_id IS NOT NULL))
  );
CREATE UNIQUE INDEX inventory_sessions_lager_abschluss_befehl_key
  ON public.inventory_sessions (tenant_id, abschluss_befehl_id) WHERE abschluss_befehl_id IS NOT NULL;

CREATE TABLE public.inventory_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  session_id uuid NOT NULL,
  position integer NOT NULL CHECK (position > 0),
  artikel_id text NOT NULL,
  ort_id uuid,
  snapshot jsonb NOT NULL CHECK (jsonb_typeof(snapshot) = 'object'),
  UNIQUE (tenant_id, session_id, position),
  UNIQUE NULLS NOT DISTINCT (tenant_id, session_id, artikel_id, ort_id),
  FOREIGN KEY (tenant_id, session_id) REFERENCES public.inventory_sessions (tenant_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, artikel_id) REFERENCES public.inventory_items (tenant_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, ort_id) REFERENCES public.stock_locations (tenant_id, id) ON DELETE RESTRICT
);
ALTER TABLE public.inventory_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY inventory_lines_mandant ON public.inventory_lines
  USING (tenant_id = nullif(btrim(current_setting('app.tenant_id', true)), ''))
  WITH CHECK (tenant_id = nullif(btrim(current_setting('app.tenant_id', true)), ''));
REVOKE ALL ON TABLE public.inventory_lines FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.inventory_lines TO service_role;
CREATE TRIGGER inventory_lines_lager_unveraenderlich
  BEFORE UPDATE OR DELETE OR TRUNCATE ON public.inventory_lines
  FOR EACH STATEMENT EXECUTE FUNCTION private.lager_journal_unveraenderlich();

CREATE FUNCTION private.lager_inventur_abschluss_schuetzen() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $funktion$
BEGIN
  IF OLD.status = 'abgeschlossen' THEN
    RAISE EXCEPTION 'LAGER_INVENTUR_ABSCHLUSS_UNVERAENDERLICH' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$funktion$;
CREATE TRIGGER inventory_sessions_lager_abschluss_schutz
  BEFORE UPDATE OR DELETE ON public.inventory_sessions
  FOR EACH ROW EXECUTE FUNCTION private.lager_inventur_abschluss_schuetzen();

CREATE FUNCTION private.lager_inventur_abschluss_vollstaendig() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $funktion$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.inventory_sessions s WHERE s.tenant_id = NEW.tenant_id AND s.id = NEW.id
    AND s.status = 'abgeschlossen' AND s.abschluss_befehl_id IS NOT NULL AND s.csv_sha256 IS NOT NULL)
  THEN RAISE EXCEPTION 'LAGER_INVENTUR_ABSCHLUSS_UNVOLLSTAENDIG' USING ERRCODE = '23514'; END IF;
  RETURN NULL;
END;
$funktion$;
CREATE CONSTRAINT TRIGGER inventory_sessions_lager_abschluss_vollstaendig
  AFTER UPDATE ON public.inventory_sessions DEFERRABLE INITIALLY DEFERRED FOR EACH ROW
  WHEN (NEW.status = 'abschliessend') EXECUTE FUNCTION private.lager_inventur_abschluss_vollstaendig();

CREATE FUNCTION private.lager_inventur_snapshot_schuetzen() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $funktion$
BEGIN
  PERFORM 1 FROM public.inventory_sessions s WHERE s.tenant_id = NEW.tenant_id
    AND s.id = NEW.session_id AND s.status = 'abschliessend' FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'LAGER_INVENTUR_SNAPSHOT_AUSSERHALB_ABSCHLUSS' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$funktion$;
CREATE TRIGGER inventory_lines_lager_snapshot_schutz
  BEFORE INSERT ON public.inventory_lines FOR EACH ROW EXECUTE FUNCTION private.lager_inventur_snapshot_schuetzen();

CREATE FUNCTION private.lager_inventur_abschluss_vorbereiten(p_session uuid, p_akteur uuid, p_methode text)
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

  UPDATE public.inventory_sessions SET status = 'abschliessend' WHERE tenant_id = mandant AND id = p_session;

  INSERT INTO public.inventory_lines (tenant_id, session_id, position, artikel_id, ort_id, snapshot)
  SELECT mandant, p_session,
    row_number() OVER (ORDER BY z.stockwerk NULLS LAST,z.bereich NULLS LAST,z.kurznummer NULLS LAST,z.artikel_id,z.ort_id),
    z.artikel_id, z.ort_id, jsonb_build_object(
      'artikelId',z.artikel_id,'kurznummer',z.kurznummer,'artikelName',z.artikel_name,'ortId',z.ort_id,
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

CREATE FUNCTION private.lager_inventur_abschluss_bestaetigen(
  p_session uuid, p_befehl uuid, p_akteur uuid, p_csv uuid, p_csv_sha text,
  p_pdf uuid DEFAULT NULL, p_pdf_sha text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SET search_path = '' AS $funktion$
DECLARE mandant text := nullif(btrim(current_setting('app.tenant_id', true)), '');
BEGIN
  IF mandant IS NULL OR p_befehl IS NULL OR p_csv IS NULL OR p_csv_sha IS NULL OR p_csv_sha !~ '^[0-9a-f]{64}$'
    OR (p_pdf IS NULL) <> (p_pdf_sha IS NULL) OR (p_pdf IS NOT NULL AND (p_pdf = p_csv OR p_pdf_sha !~ '^[0-9a-f]{64}$'))
    OR NOT EXISTS (SELECT 1 FROM public.app_users
      WHERE tenant_id = mandant AND id = p_akteur AND active AND role = 'admin')
  THEN RAISE EXCEPTION 'LAGER_INVENTUR_ARCHIVBELEG_UNGUELTIG' USING ERRCODE = '22023'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('lager-inventur:' || mandant,0));
  UPDATE public.inventory_sessions SET
    status = 'abgeschlossen', abgeschlossen_von = p_akteur, abgeschlossen_am = statement_timestamp(),
    abschluss_befehl_id = p_befehl, csv_dokument_id = p_csv, csv_sha256 = p_csv_sha,
    pdf_dokument_id = p_pdf, pdf_sha256 = p_pdf_sha
  WHERE tenant_id = mandant AND id = p_session AND status = 'abschliessend';
  IF NOT FOUND THEN RAISE EXCEPTION 'LAGER_INVENTUR_ABSCHLUSS_KONFLIKT' USING ERRCODE = '23505'; END IF;
  INSERT INTO public.events (id,tenant_id,event_type,description,payload,status,user_id,client_event_id,
    event_schema_version,aggregate_version,correlation_id)
  VALUES (gen_random_uuid()::text,mandant,'LAGER_INVENTUR_ABSCHLUSS_V1','Inventur abgeschlossen',
    jsonb_build_object('sessionId',p_session,'csvDokumentId',p_csv,'csvSha256',p_csv_sha,
      'pdfDokumentId',p_pdf,'pdfSha256',p_pdf_sha),'success',p_akteur,p_befehl,1,1,p_session);
  RETURN p_session;
END;
$funktion$;

CREATE FUNCTION private.lager_inventur_nachtrag_starten(
  p_neu uuid,p_ursprung uuid,p_akteur uuid,p_grund text
) RETURNS uuid LANGUAGE plpgsql SET search_path = '' AS $funktion$
DECLARE
  mandant text := nullif(btrim(current_setting('app.tenant_id', true)), '');
  kalender date;
BEGIN
  IF mandant IS NULL OR p_neu IS NULL OR p_ursprung IS NULL OR p_grund IS NULL
    OR btrim(p_grund) = '' OR length(p_grund) > 2000
    OR NOT EXISTS (SELECT 1 FROM public.app_users WHERE tenant_id = mandant AND id = p_akteur
      AND active AND role = 'admin')
  THEN RAISE EXCEPTION 'LAGER_INVENTUR_NACHTRAG_UNGUELTIG' USING ERRCODE = '22023'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('lager-inventur:' || mandant,0));
  SELECT stichtag INTO kalender FROM public.inventory_sessions
  WHERE tenant_id = mandant AND id = p_ursprung AND art = 'stichtag' AND status = 'abgeschlossen';
  IF NOT FOUND THEN RAISE EXCEPTION 'LAGER_INVENTUR_URSPRUNG_FEHLT' USING ERRCODE = '22023'; END IF;
  INSERT INTO public.inventory_sessions (id,tenant_id,stichtag,art,ursprung_id,nachtrag_grund,erstellt_von)
  VALUES (p_neu,mandant,kalender,'nachtrag',p_ursprung,p_grund,p_akteur) ON CONFLICT DO NOTHING;
  IF NOT EXISTS (
    SELECT 1 FROM public.inventory_sessions
    WHERE tenant_id = mandant AND id = p_neu AND art = 'nachtrag' AND ursprung_id = p_ursprung
      AND nachtrag_grund = p_grund AND erstellt_von = p_akteur
  ) THEN RAISE EXCEPTION 'LAGER_INVENTUR_NACHTRAG_KONFLIKT' USING ERRCODE = '23505'; END IF;
  RETURN p_neu;
END;
$funktion$;

REVOKE ALL ON FUNCTION private.lager_inventur_abschluss_vorbereiten(uuid,uuid,text),
  private.lager_inventur_abschluss_bestaetigen(uuid,uuid,uuid,uuid,text,uuid,text),
  private.lager_inventur_nachtrag_starten(uuid,uuid,uuid,text),
  private.lager_inventur_abschluss_schuetzen(), private.lager_inventur_snapshot_schuetzen(),
  private.lager_inventur_abschluss_vollstaendig()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.lager_inventur_abschluss_vorbereiten(uuid,uuid,text),
  private.lager_inventur_abschluss_bestaetigen(uuid,uuid,uuid,uuid,text,uuid,text),
  private.lager_inventur_nachtrag_starten(uuid,uuid,uuid,text),
  private.lager_inventur_abschluss_schuetzen(), private.lager_inventur_snapshot_schuetzen(),
  private.lager_inventur_abschluss_vollstaendig()
  TO service_role;
