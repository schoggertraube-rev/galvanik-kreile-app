BEGIN;
DO $abnahme$
DECLARE
  mandant text := 'TEST-BADWERT-' || gen_random_uuid()::text;
  artikel text := 'TEST-' || gen_random_uuid()::text;
  bad text := 'TEST-' || gen_random_uuid()::text;
  akteur uuid := gen_random_uuid();
  sitzung uuid := gen_random_uuid();
  lager_ort uuid;
  bad_ort uuid;
  preis_id uuid;
  lagerzeile record;
  badzeile record;
  wareneingang jsonb;
BEGIN
  PERFORM set_config('app.tenant_id',mandant,true);
  INSERT INTO public.app_users (id,tenant_id,email,full_name)
    VALUES (akteur,mandant,akteur::text || '@test.invalid','TEST Inventur');
  INSERT INTO public.inventory_items (id,tenant_id,name,basiseinheit)
    VALUES (artikel,mandant,'TEST Badmaterial','l');
  INSERT INTO public.baths (id,tenant_id,name) VALUES (bad,mandant,'TEST Bad');
  INSERT INTO public.stock_locations (tenant_id,stockwerk,bereich)
    VALUES (mandant,'TEST EG','TEST Lager') RETURNING id INTO lager_ort;
  INSERT INTO public.stock_locations (tenant_id,stockwerk,bereich,orttyp,bad_id)
    VALUES (mandant,'TEST EG','TEST Prozess','bad_prozess',bad) RETURNING id INTO bad_ort;
  INSERT INTO public.material_prices (tenant_id,artikel_id,einzelpreis,waehrung,quelle,gueltig_ab,bestaetigt_am)
    VALUES (mandant,artikel,7.50,'EUR','manuell','2026-11-08T10:00:00Z','2026-11-08T10:00:00Z')
    RETURNING id INTO preis_id;

  wareneingang := jsonb_build_object('artikel_id',artikel,'art','stock_in','menge',5,'ort_id',lager_ort,
    'einheit','l','fachzeit','2026-11-09T10:00:00Z','revision',1,
    'mengenqualitaet','exakt','geschaeftsgrund','wareneingang');
  PERFORM private.lager_journal_anhaengen(gen_random_uuid(),repeat('1',64),akteur,jsonb_build_array(wareneingang));
  PERFORM private.lager_journal_anhaengen(gen_random_uuid(),repeat('2',64),akteur,jsonb_build_array(
    wareneingang || jsonb_build_object('art','move','menge',-2,'geschaeftsgrund','badzugabe'),
    wareneingang || jsonb_build_object('art','move','menge',2,'geschaeftsgrund','badzugabe',
      'ort_id',bad_ort,'bad_id',bad,'bestandsart','werkstatt_prozess')
  ));
  PERFORM private.lager_inventur_starten(sitzung,'2026-11-10',akteur);
  PERFORM private.lager_inventur_zaehlung_sichern(
    gen_random_uuid(),sitzung,artikel,lager_ort,0,akteur,'2026-11-11T07:00:00Z','l',3,'exakt');
  PERFORM private.lager_inventur_zaehlung_sichern(
    gen_random_uuid(),sitzung,artikel,bad_ort,0,akteur,'2026-11-11T07:05:00Z','l',1.5,'exakt');
  INSERT INTO public.inventory_count_reasons (tenant_id,session_id,artikel_id,ort_id,zaehl_version,grund,grund_von,befehl_id)
    VALUES (mandant,sitzung,artikel,bad_ort,1,'loss',akteur,gen_random_uuid());

  SELECT * INTO STRICT lagerzeile FROM private.lager_inventur_zeilen(sitzung, 'letzter_ek') WHERE ort_id = lager_ort;
  IF lagerzeile.soll IS DISTINCT FROM 3 OR lagerzeile.ist IS DISTINCT FROM 3
    OR lagerzeile.ek IS DISTINCT FROM 7.50 OR lagerzeile.wert_eur IS DISTINCT FROM 22.50
    OR lagerzeile.preisquelle_id IS DISTINCT FROM preis_id OR lagerzeile.bewertung IS DISTINCT FROM 'vorlaeufig'
  THEN RAISE EXCEPTION 'TEST LUECKEN §5: Lagerwert und Preisquelle sind nicht vorlaeufig ausgewiesen'; END IF;

  SELECT * INTO STRICT badzeile FROM private.lager_inventur_zeilen(sitzung, 'letzter_ek') WHERE ort_id = bad_ort;
  IF badzeile.orttyp IS DISTINCT FROM 'bad_prozess' OR badzeile.einheit IS DISTINCT FROM 'l'
    OR badzeile.soll IS DISTINCT FROM 2 OR badzeile.ist IS DISTINCT FROM 1.5
    OR badzeile.differenz IS DISTINCT FROM -0.5 OR badzeile.klaerstatus IS DISTINCT FROM 'abweichung'
    OR badzeile.ek IS NOT NULL OR badzeile.preisquelle_id IS NOT NULL OR badzeile.preisquelle IS NOT NULL
    OR badzeile.wert_eur IS NOT NULL OR badzeile.differenz_eur IS NOT NULL
    OR badzeile.bewertung IS DISTINCT FROM 'unbewertet'
  THEN RAISE EXCEPTION 'TEST LUECKEN §5: Prozessmenge fehlt oder Badwert wurde aus dem Lagerpreis abgeleitet'; END IF;

  IF badzeile.grund IS DISTINCT FROM 'loss' THEN
    RAISE EXCEPTION 'TEST Grund der aktuellen Zählversion fehlt';
  END IF;
  PERFORM private.lager_inventur_zaehlung_sichern(
    gen_random_uuid(),sitzung,artikel,bad_ort,1,akteur,'2026-11-11T07:10:00Z','l',1.5,'exakt');
  IF (SELECT grund FROM private.lager_inventur_zeilen(sitzung, 'letzter_ek') WHERE ort_id = bad_ort)
      IS DISTINCT FROM 'inventur' THEN
    RAISE EXCEPTION 'TEST Grund der vorigen Zählversion wird weiter angezeigt';
  END IF;
END;
$abnahme$;
ROLLBACK;
