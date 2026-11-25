-- The inventory close owns the immutable document original, as in S38a.
ALTER TABLE public.inventory_sessions
  ADD COLUMN csv_inhalt bytea,
  ADD COLUMN pdf_inhalt bytea,
  ADD COLUMN xlsx_dokument_id uuid,
  ADD COLUMN xlsx_sha256 text CHECK (xlsx_sha256 ~ '^[a-f0-9]{64}$'),
  ADD COLUMN xlsx_inhalt bytea,
  ADD COLUMN fehlende_auftragsorte text[] NOT NULL DEFAULT ARRAY[]::text[],
  ADD CONSTRAINT inventory_sessions_lager_originale_chk CHECK (
    abschluss_befehl_id IS NULL OR (
      csv_inhalt IS NOT NULL AND octet_length(csv_inhalt) BETWEEN 1 AND 20971520
      AND encode(sha256(csv_inhalt),'hex') IS NOT DISTINCT FROM csv_sha256
      AND ((pdf_dokument_id IS NULL) = (pdf_inhalt IS NULL))
      AND (pdf_inhalt IS NULL OR (octet_length(pdf_inhalt) BETWEEN 1 AND 20971520
        AND encode(sha256(pdf_inhalt),'hex') IS NOT DISTINCT FROM pdf_sha256))
      AND ((xlsx_dokument_id IS NULL) = (xlsx_inhalt IS NULL))
      AND ((xlsx_dokument_id IS NULL) = (xlsx_sha256 IS NULL))
      AND (xlsx_inhalt IS NULL OR (octet_length(xlsx_inhalt) BETWEEN 1 AND 20971520
        AND encode(sha256(xlsx_inhalt),'hex') IS NOT DISTINCT FROM xlsx_sha256))
    )
  ) NOT VALID;

DROP FUNCTION private.lager_inventur_abschluss_bestaetigen(uuid,uuid,uuid,uuid,text,uuid,text);

CREATE FUNCTION private.lager_inventur_abschluss_bestaetigen(
  p_session uuid, p_befehl uuid, p_akteur uuid, p_csv uuid, p_csv_sha text, p_csv_bytes bytea,
  p_pdf uuid DEFAULT NULL, p_pdf_sha text DEFAULT NULL, p_pdf_bytes bytea DEFAULT NULL,
  p_xlsx uuid DEFAULT NULL, p_xlsx_sha text DEFAULT NULL, p_xlsx_bytes bytea DEFAULT NULL,
  p_fehlende_orte text[] DEFAULT ARRAY[]::text[]
) RETURNS uuid LANGUAGE plpgsql SET search_path = '' AS $funktion$
DECLARE mandant text := nullif(btrim(current_setting('app.tenant_id', true)), '');
BEGIN
  IF mandant IS NULL OR p_befehl IS NULL OR p_csv IS NULL OR p_csv_sha IS NULL
    OR (p_pdf IS NULL) <> (p_pdf_sha IS NULL) OR (p_pdf IS NOT NULL AND p_pdf = p_csv)
    OR (p_xlsx IS NULL) <> (p_xlsx_sha IS NULL) OR (p_xlsx IS NOT NULL AND (p_xlsx = p_csv OR p_xlsx = p_pdf))
    OR NOT EXISTS (SELECT 1 FROM public.app_users
      WHERE tenant_id = mandant AND id = p_akteur AND active AND role = 'admin')
  THEN RAISE EXCEPTION 'LAGER_INVENTUR_ARCHIVBELEG_UNGUELTIG' USING ERRCODE = '22023'; END IF;
  IF p_fehlende_orte IS NULL OR (SELECT count(DISTINCT id) FROM unnest(p_fehlende_orte) AS x(id))<>cardinality(p_fehlende_orte)
    THEN RAISE EXCEPTION 'LAGER_INVENTUR_FEHLSTELLEN_UNGUELTIG' USING ERRCODE='22023'; END IF;
  IF cardinality(p_fehlende_orte)>0 AND EXISTS (SELECT 1 FROM unnest(p_fehlende_orte) AS x(id)
    LEFT JOIN public.orders o ON o.tenant_id=mandant AND o.id=x.id WHERE o.id IS NULL)
    THEN RAISE EXCEPTION 'LAGER_INVENTUR_FEHLSTELLE_FREMD' USING ERRCODE='42501'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('lager-inventur:' || mandant,0));
  UPDATE public.inventory_sessions SET
    status = 'abgeschlossen', abgeschlossen_von = p_akteur, abgeschlossen_am = statement_timestamp(),
    abschluss_befehl_id = p_befehl, csv_dokument_id = p_csv, csv_sha256 = p_csv_sha, csv_inhalt = p_csv_bytes,
    pdf_dokument_id = p_pdf, pdf_sha256 = p_pdf_sha, pdf_inhalt = p_pdf_bytes,
    xlsx_dokument_id = p_xlsx, xlsx_sha256 = p_xlsx_sha, xlsx_inhalt = p_xlsx_bytes,
    fehlende_auftragsorte = p_fehlende_orte
  WHERE tenant_id = mandant AND id = p_session AND status = 'abschliessend';
  IF NOT FOUND THEN RAISE EXCEPTION 'LAGER_INVENTUR_ABSCHLUSS_KONFLIKT' USING ERRCODE = '23505'; END IF;
  INSERT INTO public.events (id,tenant_id,event_type,description,payload,status,user_id,client_event_id,
    event_schema_version,aggregate_version,correlation_id)
  VALUES (gen_random_uuid()::text,mandant,'LAGER_INVENTUR_ABSCHLUSS_V1','Inventur abgeschlossen',
    jsonb_build_object('sessionId',p_session,'csvDokumentId',p_csv,'csvSha256',p_csv_sha,
      'pdfDokumentId',p_pdf,'pdfSha256',p_pdf_sha,'xlsxDokumentId',p_xlsx,'xlsxSha256',p_xlsx_sha),
    'success',p_akteur,p_befehl,1,1,p_session);
  RETURN p_session;
END;
$funktion$;

REVOKE ALL ON FUNCTION private.lager_inventur_abschluss_bestaetigen(uuid,uuid,uuid,uuid,text,bytea,uuid,text,bytea,uuid,text,bytea,text[])
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.lager_inventur_abschluss_bestaetigen(uuid,uuid,uuid,uuid,text,bytea,uuid,text,bytea,uuid,text,bytea,text[])
  TO service_role;
