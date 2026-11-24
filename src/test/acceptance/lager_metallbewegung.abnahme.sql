BEGIN;
DO $abnahme$
DECLARE
  mandant text := 'TEST-METALL-' || gen_random_uuid()::text;
  artikel text := 'TEST-' || gen_random_uuid()::text;
  ort uuid;
  prozess uuid;
  akteur uuid := gen_random_uuid();
  beleg1 uuid;
  beleg2 uuid;
  preis2 uuid;
  buchung uuid;
  umzug uuid := gen_random_uuid();
  fachzeit timestamptz := statement_timestamp() - interval '2 hours';
  basis jsonb;
BEGIN
  PERFORM set_config('app.tenant_id', mandant, true);
  INSERT INTO public.inventory_items (tenant_id,id,name,basiseinheit,metall,feingehalt_pct)
    VALUES (mandant,artikel,'TEST Metall','g','TEST Metall',25);
  INSERT INTO public.app_users (id,tenant_id,email,full_name) VALUES
    (akteur,mandant,akteur::text || '@test.invalid','TEST Werkstatt');
  INSERT INTO public.stock_locations (tenant_id,stockwerk,bereich)
    VALUES (mandant,'TEST EG','TEST Material') RETURNING id INTO ort;
  INSERT INTO public.stock_locations (tenant_id,stockwerk,bereich)
    VALUES (mandant,'TEST OG','TEST Werkstatt') RETURNING id INTO prozess;
  INSERT INTO public.intake_item (tenant_id,client_key,kanal,quelle,erstellt_von)
    VALUES (mandant,'TEST-BELEG-1','datei','app',akteur) RETURNING id INTO beleg1;
  INSERT INTO public.intake_item (tenant_id,client_key,kanal,quelle,erstellt_von)
    VALUES (mandant,'TEST-BELEG-2','datei','app',akteur) RETURNING id INTO beleg2;
  INSERT INTO public.material_prices
    (tenant_id,artikel_id,einzelpreis,waehrung,quelle,beleg_id,gueltig_ab,bestaetigt_am)
  VALUES (mandant,artikel,3,'EUR','gepruefte_rechnung',beleg1,fachzeit,fachzeit);
  INSERT INTO public.material_prices
    (tenant_id,artikel_id,einzelpreis,waehrung,quelle,beleg_id,gueltig_ab,bestaetigt_am)
  VALUES (mandant,artikel,4,'EUR','gepruefte_rechnung',beleg2,fachzeit,fachzeit) RETURNING id INTO preis2;

  basis := jsonb_build_object('artikel_id',artikel,'ort_id',ort,'einheit','g',
    'fachzeit',fachzeit,'revision',1,'mengenqualitaet','exakt');
  PERFORM private.lager_journal_anhaengen(gen_random_uuid(), repeat('1',64), akteur,
    jsonb_build_array(basis || jsonb_build_object('art','stock_in','menge',200,
      'geschaeftsgrund','wareneingang','beleg_id',beleg1)));
  SELECT bewegung_id INTO buchung FROM private.lager_journal_anhaengen(gen_random_uuid(), repeat('2',64), akteur,
    jsonb_build_array(basis || jsonb_build_object('art','stock_in','menge',300,
      'geschaeftsgrund','wareneingang','beleg_id',beleg2)));
  IF NOT EXISTS (
    SELECT 1 FROM public.stock_movements WHERE id = buchung AND metall_fein_g = 75
      AND metall_einstand_eur = 1200 AND metall_preisquelle_id = preis2
  ) OR private.lager_metall_einstand_je_g(artikel,'TEST Metall',fachzeit) IS DISTINCT FROM 14.4
  THEN RAISE EXCEPTION 'TEST M2 Einkaeufe und Mittelwert'; END IF;

  SELECT bewegung_id INTO buchung FROM private.lager_journal_anhaengen(gen_random_uuid(), repeat('3',64), akteur,
    jsonb_build_array(basis || jsonb_build_object('art','consumption','menge',-50,'geschaeftsgrund','verbrauch')));
  IF NOT EXISTS (SELECT 1 FROM public.stock_movements WHERE id = buchung
      AND metall_fein_g = -12.5 AND metall_einstand_eur = -180)
  THEN RAISE EXCEPTION 'TEST M2 Verbrauchswert'; END IF;

  PERFORM private.lager_journal_anhaengen(umzug,repeat('4',64),akteur,
    jsonb_build_array(
      basis || jsonb_build_object('art','move','menge',-450,'geschaeftsgrund','umlagerung'),
      basis || jsonb_build_object('art','move','menge',450,'geschaeftsgrund','umlagerung','ort_id',prozess)
    ));
  IF (SELECT count(*) FROM public.stock_movements WHERE befehl_id = umzug AND abs(metall_einstand_eur) = 1620) <> 2
    OR private.lager_metall_einstand_je_g(artikel,'TEST Metall',fachzeit) IS DISTINCT FROM 14.4
  THEN RAISE EXCEPTION 'TEST M2 Umlagerung aendert Wert'; END IF;

  PERFORM private.lager_journal_anhaengen(gen_random_uuid(), repeat('5',64), akteur,
    jsonb_build_array(basis || jsonb_build_object('art','stock_in','menge',1,'geschaeftsgrund','wareneingang')));
  IF private.lager_metall_einstand_je_g(artikel,'TEST Metall',fachzeit) IS NOT NULL
    THEN RAISE EXCEPTION 'TEST M2 Unbelegter Einkauf wurde bewertet'; END IF;
  PERFORM set_config('app.tenant_id','TEST-FREMD',true);
  IF private.lager_metall_einstand_je_g(artikel,'TEST Metall',fachzeit) IS NOT NULL
    THEN RAISE EXCEPTION 'TEST M2 Fremder Einstand'; END IF;
END;
$abnahme$;
ROLLBACK;
