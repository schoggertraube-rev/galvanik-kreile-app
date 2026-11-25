BEGIN;
DO $abnahme$
DECLARE
  mandant text := 'TEST-ZAEHLUNG-' || gen_random_uuid()::text;
  artikel text := 'TEST-' || gen_random_uuid()::text;
  akteur uuid := gen_random_uuid();
  zweitakteur uuid := gen_random_uuid();
  ort uuid;
  session uuid := gen_random_uuid();
  gebinde uuid;
  befehl uuid := gen_random_uuid();
  zeit timestamptz := statement_timestamp() - interval '10 minutes';
  stichtag date := (zeit AT TIME ZONE 'Europe/Berlin')::date;
  quittung jsonb;
  replik jsonb;
BEGIN
  PERFORM set_config('app.tenant_id',mandant,true);
  INSERT INTO public.inventory_items (id,tenant_id,name,basiseinheit) VALUES (artikel,mandant,'TEST Kanister','l');
  INSERT INTO public.app_users (id,tenant_id,email,full_name) VALUES
    (akteur,mandant,akteur::text || '@test.invalid','TEST Zähler'),
    (zweitakteur,mandant,zweitakteur::text || '@test.invalid','TEST Zweitzähler');
  INSERT INTO public.stock_locations (tenant_id,stockwerk,bereich)
    VALUES (mandant,'TEST EG','TEST Inventur') RETURNING id INTO ort;
  INSERT INTO public.packaging_definitions (tenant_id,artikel_id,gebinde_schluessel,version,art,name,
    inhalt_menge,inhalt_einheit,gueltig_ab)
    VALUES (mandant,artikel,'TEST Kanister',1,'kanister','TEST Kanister 20 l',20,'l',zeit - interval '1 hour')
    RETURNING id INTO gebinde;
  PERFORM private.lager_journal_anhaengen(gen_random_uuid(),repeat('1',64),akteur,
    jsonb_build_array(jsonb_build_object('artikel_id',artikel,'art','stock_in','menge',10,
      'ort_id',ort,'einheit','l','fachzeit',zeit,'revision',1,'mengenqualitaet','exakt',
      'geschaeftsgrund','wareneingang')));

  PERFORM private.lager_inventur_starten(session,stichtag,akteur);
  PERFORM private.lager_inventur_starten(session,stichtag,akteur);
  IF NOT EXISTS (SELECT 1 FROM private.lager_inventur_zaehlzeilen(session,ort) z
      WHERE z.artikel_id = artikel AND z.counted_qty IS NULL AND z.counted_by IS NULL AND z.version = 0
        AND NOT (to_jsonb(z) ?| array['soll','book_qty','kalk_ek','preisquelle_id']))
  THEN RAISE EXCEPTION 'TEST blinde leere Zeile fehlt'; END IF;

  quittung := private.lager_inventur_zaehlung_sichern(befehl,session,artikel,ort,0,akteur,zeit,'l',NULL,NULL);
  replik := private.lager_inventur_zaehlung_sichern(befehl,session,artikel,ort,0,akteur,zeit,'l',NULL,NULL);
  IF quittung IS DISTINCT FROM replik OR quittung->>'code' <> 'OK'
    OR quittung->>'menge' IS NOT NULL OR (quittung->>'version')::integer <> 1
  THEN RAISE EXCEPTION 'TEST leer und Wiederholung'; END IF;
  quittung := private.lager_inventur_zaehlung_sichern(gen_random_uuid(),session,artikel,ort,1,akteur,zeit,'l',0,'exakt');
  IF (quittung->>'menge')::numeric IS DISTINCT FROM 0 OR quittung->>'mengenqualitaet' <> 'exakt'
  THEN RAISE EXCEPTION 'TEST echte Nullmenge'; END IF;
  quittung := private.lager_inventur_zaehlung_sichern(gen_random_uuid(),session,artikel,ort,1,zweitakteur,zeit,'l',6,'exakt');
  IF quittung->>'code' <> 'VERSION_KONFLIKT' OR quittung->>'version' <> '2' OR quittung->>'menge' <> '0'
  THEN RAISE EXCEPTION 'TEST Versionskonflikt'; END IF;

  quittung := private.lager_inventur_zaehlung_sichern(gen_random_uuid(),session,artikel,ort,2,zweitakteur,
    zeit,'l',NULL,'geschaetzt',gebinde,2,7.5);
  IF (quittung->>'menge')::numeric IS DISTINCT FROM 47.5 OR quittung->>'mengenqualitaet' <> 'geschaetzt'
    OR NOT EXISTS (SELECT 1 FROM private.lager_inventur_zaehlzeilen(session,ort) z
      WHERE z.counted_qty = 47.5 AND z.gebinde_id = gebinde AND z.gebinde_anzahl = 2 AND z.rest_menge = 7.5
        AND z.counted_by = zweitakteur AND z.counted_at = zeit AND z.version = 3)
  THEN RAISE EXCEPTION 'TEST Gebinde, Rest oder Zähler fehlen'; END IF;

  UPDATE public.inventory_sessions SET status = 'abgeschlossen', abgeschlossen_von = akteur,
    abgeschlossen_am = statement_timestamp() WHERE id = session;
  quittung := private.lager_inventur_zaehlung_sichern(gen_random_uuid(),session,artikel,ort,3,akteur,zeit,'l',5,'exakt');
  IF quittung->>'code' <> 'ABGESCHLOSSEN'
    OR (SELECT count(*) FROM public.stock_movements WHERE inventory_item_id = artikel) <> 1
  THEN RAISE EXCEPTION 'TEST Zählen nach Abschluss oder Mengenwirkung'; END IF;
  BEGIN
    UPDATE public.inventory_counts SET counted_qty = 4 WHERE session_id = session;
    RAISE EXCEPTION 'TEST Zählzeile nach Abschluss änderbar';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  PERFORM set_config('app.tenant_id','TEST-FREMD',true);
  IF EXISTS (SELECT 1 FROM private.lager_inventur_zaehlzeilen(session,ort))
  THEN RAISE EXCEPTION 'TEST fremder Zählleser'; END IF;
END;
$abnahme$;
ROLLBACK;
