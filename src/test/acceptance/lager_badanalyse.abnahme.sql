BEGIN;
DO $abnahme$
DECLARE
  mandant text := 'TEST-ANALYSE-' || gen_random_uuid()::text;
  bad text := 'TEST-' || gen_random_uuid()::text;
  akteur uuid := gen_random_uuid();
  beleg1 uuid;
  beleg2 uuid;
  datei1 uuid := gen_random_uuid();
  datei2 uuid := gen_random_uuid();
  messung1 uuid;
  wiederholt uuid;
  erste_zeit timestamptz := '2026-11-01T10:00:00Z';
  zweite_zeit timestamptz := '2026-11-03T10:00:00Z';
  bestand record;
BEGIN
  PERFORM set_config('app.tenant_id',mandant,true);
  INSERT INTO public.baths (id,tenant_id,name) VALUES (bad,mandant,'TEST Analysebad');
  INSERT INTO public.app_users (id,tenant_id,email,full_name)
    VALUES (akteur,mandant,akteur::text || '@test.invalid','TEST Eingang');
  INSERT INTO public.intake_item (tenant_id,client_key,kanal,quelle,erstellt_von)
    VALUES (mandant,'TEST-Labor-1','datei','app',akteur) RETURNING id INTO beleg1;
  INSERT INTO public.intake_item (tenant_id,client_key,kanal,quelle,erstellt_von)
    VALUES (mandant,'TEST-Labor-2','datei','app',akteur) RETURNING id INTO beleg2;
  INSERT INTO public.intake_file (
      id,tenant_id,item_id,client_key,art,dateiname,mime,bytes,sha256,speicherpfad,
      aufgenommen_am,aufgenommen_von,reihenfolge,lesbar,erkennung_status,geoeffnet
  ) VALUES
    (datei1,mandant,beleg1,'TEST-Datei-1','pdf','TEST1.pdf','application/pdf',10,repeat('a',64),
      mandant || '/' || repeat('a',64),statement_timestamp(),akteur,1,true,'fertig',true),
    (datei2,mandant,beleg2,'TEST-Datei-2','pdf','TEST2.pdf','application/pdf',12,repeat('b',64),
      mandant || '/' || repeat('b',64),statement_timestamp(),akteur,1,true,'fertig',true);
  INSERT INTO public.intake_event (tenant_id,item_id,art,befehl_id,von,nachher)
    VALUES (mandant,beleg1,'original_gespeichert',gen_random_uuid(),akteur::text,jsonb_build_object('fileId',datei1));
  BEGIN
    PERFORM private.lager_badanalyse_speichern(bad,'TEST Metall',zweite_zeit,1.25,40,beleg2,datei2);
    RAISE EXCEPTION 'TEST M4 ungesichertes Original akzeptiert';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  INSERT INTO public.intake_event (tenant_id,item_id,art,befehl_id,von,nachher)
    VALUES (mandant,beleg2,'original_gespeichert',gen_random_uuid(),akteur::text,jsonb_build_object('fileId',datei2));
  messung1 := private.lager_badanalyse_speichern(bad,'TEST Metall',erste_zeit,2.5,40,beleg1,datei1);
  wiederholt := private.lager_badanalyse_speichern(bad,'TEST Metall',erste_zeit,2.50,40.00,beleg1,datei1);
  IF wiederholt IS DISTINCT FROM messung1 THEN RAISE EXCEPTION 'TEST M4 Doppelbeleg'; END IF;
  BEGIN
    PERFORM private.lager_badanalyse_speichern(bad,'TEST Metall',erste_zeit,2.65,40,beleg1,datei1);
    RAISE EXCEPTION 'TEST M4 Original geaendert';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
  PERFORM private.lager_badanalyse_speichern(bad,'TEST Metall',zweite_zeit,1.25,40,beleg2,datei2);
  IF EXISTS (SELECT 1 FROM private.lager_badprozessbestand_am(erste_zeit - interval '1 second'))
    THEN RAISE EXCEPTION 'TEST M4 Zukunft'; END IF;

  SELECT * INTO bestand FROM private.lager_badprozessbestand_am(zweite_zeit - interval '1 second');
  IF bestand.fein_g IS DISTINCT FROM 100 OR bestand.analyse_am IS DISTINCT FROM erste_zeit
    OR bestand.beleg_id IS DISTINCT FROM beleg1 OR bestand.datei_id IS DISTINCT FROM datei1
    THEN RAISE EXCEPTION 'TEST M4 erster Stichtag'; END IF;
  SELECT * INTO bestand FROM private.lager_badprozessbestand_am(zweite_zeit);
  IF bestand.fein_g IS DISTINCT FROM 50 OR bestand.analyse_am IS DISTINCT FROM zweite_zeit
    OR bestand.beleg_id IS DISTINCT FROM beleg2 OR bestand.datei_id IS DISTINCT FROM datei2
    THEN RAISE EXCEPTION 'TEST M4 zweiter Stichtag'; END IF;
  PERFORM set_config('app.tenant_id','TEST-FREMD',true);
  IF EXISTS (SELECT 1 FROM private.lager_badprozessbestand_am(zweite_zeit))
    THEN RAISE EXCEPTION 'TEST M4 Fremdmandant'; END IF;
END;
$abnahme$;
ROLLBACK;
