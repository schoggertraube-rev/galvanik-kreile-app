BEGIN;
DO $abnahme$
DECLARE
  mandant text := 'TEST-l8-' || gen_random_uuid()::text;
  anderer text := 'TEST-l8-' || gen_random_uuid()::text;
  artikel text := 'TEST-' || gen_random_uuid()::text;
  durchschnitt_artikel text := 'TEST-' || gen_random_uuid()::text;
  variante text := 'TEST-' || gen_random_uuid()::text;
  leer text := 'TEST-' || gen_random_uuid()::text;
  kunde text := 'TEST-' || gen_random_uuid()::text;
  auftrag text := 'TEST-' || gen_random_uuid()::text;
  preis uuid;
  beleg_teuer uuid := gen_random_uuid();
  beleg_letzter uuid := gen_random_uuid();
  letzter_preis uuid;
  gewichteter_preis numeric;
  erster_zugang uuid;
  ort uuid;
  akteur uuid := gen_random_uuid();
  zeitpunkt timestamptz := '2026-11-20 12:00:00+01';
  buchung uuid;
  unbewertet uuid;
  grosser_ek uuid;
  zeile jsonb;
BEGIN
  PERFORM set_config('app.tenant_id', mandant, true);
  INSERT INTO public.inventory_items (id,tenant_id,name,basiseinheit) VALUES
    (artikel,mandant,'TEST Eisen','kg'),(variante,mandant,'TEST Eisen B','kg'),(leer,mandant,'TEST ohne EK','kg'),
    (durchschnitt_artikel,mandant,'TEST Gegenbuchung EK','kg');
  INSERT INTO public.customers (id,tenant_id,name,type) VALUES (kunde,mandant,'TEST Kunde','business');
  INSERT INTO public.orders (id,tenant_id,customer_id,order_number,title,station,current_station_id,status)
    VALUES (auftrag,mandant,kunde,auftrag,'TEST Verbrauch','angenommen','angenommen','angenommen');
  INSERT INTO public.app_users (id,tenant_id,email,full_name,role)
    VALUES (akteur,mandant,akteur::text || '@test.invalid','TEST Werkstatt','werkstatt');
  INSERT INTO public.stock_locations (tenant_id,stockwerk,bereich)
    VALUES (mandant,'TEST EG','TEST Werkstatt') RETURNING id INTO ort;

  INSERT INTO public.intake_item (id, tenant_id, client_key, kanal, quelle, erstellt_von) VALUES
    (beleg_teuer, mandant, beleg_teuer::text, 'foto', 'app', akteur),
    (beleg_letzter, mandant, beleg_letzter::text, 'foto', 'app', akteur);
  INSERT INTO public.material_prices
      (tenant_id,artikel_id,einzelpreis,waehrung,quelle,gueltig_ab,bestaetigt_am,beleg_id)
    VALUES (mandant,artikel,8.25,'EUR','manuell',zeitpunkt - interval '4 days',zeitpunkt - interval '4 days',beleg_teuer)
    RETURNING id INTO preis;
  INSERT INTO public.material_prices
      (tenant_id,artikel_id,einzelpreis,waehrung,quelle,gueltig_ab,bestaetigt_am,beleg_id)
    VALUES (mandant,artikel,5,'EUR','manuell',zeitpunkt - interval '1 day',zeitpunkt - interval '1 day',beleg_letzter)
    RETURNING id INTO letzter_preis;
  INSERT INTO public.material_prices (tenant_id,artikel_id,einzelpreis,waehrung,quelle,gueltig_ab,bestaetigt_am,storniert_am,fehlpreis_am)
    VALUES (mandant,artikel,100,'EUR','manuell',zeitpunkt - interval '3 days',zeitpunkt - interval '3 days',zeitpunkt - interval '2 days',NULL),
           (mandant,artikel,150,'EUR','manuell',zeitpunkt - interval '3 days',zeitpunkt - interval '3 days',NULL,zeitpunkt - interval '2 days'),
           (mandant,artikel,170,'EUR','import',zeitpunkt - interval '3 days',NULL,NULL,NULL),
           (mandant,artikel,180,'CHF','manuell',zeitpunkt - interval '3 days',zeitpunkt - interval '3 days',NULL,NULL),
           (mandant,artikel,190,'EUR','manuell',zeitpunkt + interval '1 day',zeitpunkt + interval '1 day',NULL,NULL),
           (mandant,variante,200,'EUR','manuell',zeitpunkt - interval '3 days',zeitpunkt - interval '3 days',NULL,NULL);
  zeile := jsonb_build_object('artikel_id',artikel,'art','consumption','menge',-2,
    'ort_id',ort,'einheit','kg','fachzeit',zeitpunkt,'revision',1,'geschaeftsgrund','verbrauch',
    'mengenqualitaet','exakt','order_id',auftrag);
  BEGIN
    PERFORM private.lager_journal_anhaengen(gen_random_uuid(), repeat('6',64), akteur, jsonb_build_array(zeile));
    RAISE EXCEPTION 'TEST L8: Buchung ohne Kalkulationsregel zugelassen';
  EXCEPTION WHEN invalid_parameter_value THEN
    IF SQLERRM <> 'LAGER_KALKULATIONSREGEL_FEHLT' THEN RAISE; END IF;
  END;
  IF NOT EXISTS (
    SELECT 1 FROM private.lager_kalkulationsbasis(artikel, zeitpunkt, 'letzter_ek')
    WHERE preisquelle_id = letzter_preis AND einzelpreis = 5
  ) OR NOT EXISTS (
    SELECT 1 FROM private.lager_kalkulationsbasis(artikel, zeitpunkt, 'gleitender_durchschnitt')
    WHERE preisquelle_id = letzter_preis AND einzelpreis = 6.625
  ) THEN
    RAISE EXCEPTION 'TEST L8: letzter Preis oder Durchschnitt ohne Eingangsmenge falsch';
  END IF;
  PERFORM private.lager_journal_anhaengen(gen_random_uuid(), repeat('4',64), akteur, jsonb_build_array(
    jsonb_build_object('artikel_id',artikel,'art','stock_in','menge',2,'beleg_id',beleg_teuer,
      'ort_id',ort,'einheit','kg','fachzeit',zeitpunkt - interval '3 days','revision',1,
      'mengenqualitaet','exakt','geschaeftsgrund','wareneingang')));
  PERFORM private.lager_journal_anhaengen(gen_random_uuid(), repeat('5',64), akteur, jsonb_build_array(
    jsonb_build_object('artikel_id',artikel,'art','stock_in','menge',6,'beleg_id',beleg_letzter,
      'ort_id',ort,'einheit','kg','fachzeit',zeitpunkt - interval '1 day','revision',1,
      'mengenqualitaet','exakt','geschaeftsgrund','wareneingang')));
  SELECT einzelpreis INTO gewichteter_preis
    FROM private.lager_kalkulationsbasis(artikel, zeitpunkt, 'gleitender_durchschnitt')
    WHERE preisquelle_id = letzter_preis;
  IF gewichteter_preis IS DISTINCT FROM 5.8125::numeric THEN
    RAISE EXCEPTION 'TEST L8: Durchschnitt der Eingangsgewichte falsch';
  END IF;

  INSERT INTO public.material_prices
      (tenant_id,artikel_id,einzelpreis,waehrung,quelle,gueltig_ab,bestaetigt_am,beleg_id)
    VALUES
      (mandant,durchschnitt_artikel,0.0250,'EUR','manuell',
       zeitpunkt - interval '4 days',zeitpunkt - interval '4 days',beleg_teuer),
      (mandant,durchschnitt_artikel,0.0280,'EUR','manuell',
       zeitpunkt - interval '1 day',zeitpunkt - interval '1 day',beleg_letzter);
  SELECT bewegung_id INTO STRICT erster_zugang
    FROM private.lager_journal_anhaengen(gen_random_uuid(), repeat('a',64), akteur, jsonb_build_array(
      jsonb_build_object('artikel_id',durchschnitt_artikel,'art','stock_in','menge',2000,'beleg_id',beleg_teuer,
        'ort_id',ort,'einheit','kg','fachzeit',zeitpunkt - interval '3 days','revision',1,
        'mengenqualitaet','exakt','geschaeftsgrund','wareneingang')));
  PERFORM private.lager_journal_anhaengen(gen_random_uuid(), repeat('b',64), akteur, jsonb_build_array(
    jsonb_build_object('artikel_id',durchschnitt_artikel,'art','stock_in','menge',1000,'beleg_id',beleg_letzter,
      'ort_id',ort,'einheit','kg','fachzeit',zeitpunkt - interval '1 day','revision',1,
      'mengenqualitaet','exakt','geschaeftsgrund','wareneingang')));
  SELECT einzelpreis INTO STRICT gewichteter_preis
    FROM private.lager_kalkulationsbasis(durchschnitt_artikel, zeitpunkt, 'gleitender_durchschnitt');
  IF gewichteter_preis IS DISTINCT FROM 0.026000::numeric OR scale(gewichteter_preis) <> 6 THEN
    RAISE EXCEPTION 'TEST L8: Durchschnitt vor Gegenbuchung falsch';
  END IF;

  PERFORM private.lager_journal_anhaengen(gen_random_uuid(), repeat('c',64), akteur, jsonb_build_array(
    jsonb_build_object('artikel_id',durchschnitt_artikel,'art','reversal','menge',-2000,
      'gegenbuchung_id',erster_zugang,'ort_id',ort,'einheit','kg','fachzeit',zeitpunkt,'revision',1,
      'mengenqualitaet','exakt','geschaeftsgrund','gegenbuchung')));
  SELECT einzelpreis INTO STRICT gewichteter_preis
    FROM private.lager_kalkulationsbasis(durchschnitt_artikel, zeitpunkt, 'gleitender_durchschnitt');
  IF gewichteter_preis IS DISTINCT FROM 0.028000::numeric OR scale(gewichteter_preis) <> 6 THEN
    RAISE EXCEPTION 'TEST L8: gegengebuchter Zugang zählt im Durchschnitt';
  END IF;

  PERFORM set_config('app.lager_kalkulationsregel',
    '{"aufschlag":12.5,"version":"TEST-v1","vorlaeufig":false,"methode":"hoechster_ek"}', true);
  SELECT bewegung_id INTO buchung FROM private.lager_journal_anhaengen(
    gen_random_uuid(), repeat('7',64), akteur, jsonb_build_array(zeile));
  IF NOT EXISTS (SELECT 1 FROM public.stock_movements WHERE id = buchung AND preisquelle_id = preis
    AND kalk_ek = 8.25 AND snapshot_einkaufspreis_eur = 8.25 AND aufschlag_pct = 12.5 AND regel_version = 'TEST-v1' AND NOT kalk_vorlaeufig) THEN
    RAISE EXCEPTION 'TEST L8: eingefrorene Preisquelle oder Kalkulationsregel falsch';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM private.lager_w1_auftragskosten WHERE journal_id = buchung
      AND order_id = auftrag AND menge = 2 AND wert_eur = 18.56) THEN
    RAISE EXCEPTION 'TEST L8: Verbrauch fehlt in den Auftragskosten';
  END IF;
  PERFORM private.lager_journal_anhaengen(gen_random_uuid(), repeat('d',64), akteur,
    jsonb_build_array(zeile || jsonb_build_object('art','reversal','menge',2,
      'geschaeftsgrund','gegenbuchung','gegenbuchung_id',buchung)));
  IF (SELECT coalesce(sum(wert_eur), 0) FROM private.lager_w1_auftragskosten
      WHERE order_id = auftrag) <> 0 THEN
    RAISE EXCEPTION 'TEST L8: gegengebuchter Verbrauch bleibt in den Auftragskosten';
  END IF;
  SELECT bewegung_id INTO unbewertet FROM private.lager_journal_anhaengen(
    gen_random_uuid(), repeat('8',64), akteur, jsonb_build_array(zeile || jsonb_build_object('artikel_id',leer)));
  IF NOT EXISTS (SELECT 1 FROM public.stock_movements WHERE id = unbewertet
    AND preisquelle_id IS NULL AND kalk_ek IS NULL AND regel_version IS NULL
    AND aufschlag_pct IS NULL AND kalk_vorlaeufig IS NULL AND snapshot_einkaufspreis_eur IS NULL) THEN
    RAISE EXCEPTION 'TEST L8: fehlender EK wurde bewertet';
  END IF;
  INSERT INTO public.material_prices (tenant_id,artikel_id,einzelpreis,waehrung,quelle,gueltig_ab,bestaetigt_am)
    VALUES (mandant,variante,1500000.1234,'EUR','manuell',zeitpunkt,zeitpunkt);
  SELECT bewegung_id INTO grosser_ek FROM private.lager_journal_anhaengen(
    gen_random_uuid(), repeat('9',64), akteur, jsonb_build_array(zeile || jsonb_build_object('artikel_id',variante)));
  IF NOT EXISTS (SELECT 1 FROM public.stock_movements WHERE id = grosser_ek
      AND kalk_ek = 1500000.1234 AND snapshot_einkaufspreis_eur IS NULL) THEN
    RAISE EXCEPTION 'TEST L8: grosser EK wurde gerundet oder verloren';
  END IF;
  PERFORM set_config('app.tenant_id', anderer, true);
  IF EXISTS (SELECT 1 FROM private.lager_kalkulationsbasis(artikel, zeitpunkt, 'hoechster_ek')) THEN
    RAISE EXCEPTION 'TEST L8: fremde Preisquelle lesbar';
  END IF;
END;
$abnahme$;
ROLLBACK;
