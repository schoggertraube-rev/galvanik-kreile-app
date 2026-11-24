BEGIN;
GRANT UPDATE, DELETE, TRUNCATE ON public.stock_movements TO service_role;
SET LOCAL ROLE service_role;
DO $abnahme$
DECLARE
  mandant text := 'TEST-p2-' || gen_random_uuid()::text;
  fremd text := 'TEST-p2-' || gen_random_uuid()::text;
  artikel text := 'TEST-p2-' || gen_random_uuid()::text;
  akteur uuid := gen_random_uuid();
  fremder_akteur uuid := gen_random_uuid();
  ort_a uuid;
  ort_b uuid;
  fremder_ort uuid;
  befehl uuid := gen_random_uuid();
  umlagerung uuid := gen_random_uuid();
  unveraendert text := repeat('a', 64);
  geaendert text := repeat('b', 64);
  zeile jsonb;
  original uuid;
  gegen_befehl uuid := gen_random_uuid();
  weg uuid;
  an uuid;
  quittung uuid;
  ist_wiederholt boolean;
  fachdatum timestamptz := '2026-11-20 11:00:00+01';
BEGIN
  PERFORM set_config('app.tenant_id', mandant, true);
  INSERT INTO public.app_users (id, tenant_id, email, full_name, role)
  VALUES (akteur, mandant, akteur::text || '@test.invalid', 'TEST Lager', 'buero'),
         (fremder_akteur, fremd, fremder_akteur::text || '@test.invalid', 'TEST Fremd', 'buero');
  INSERT INTO public.inventory_items (id, tenant_id, name, current_stock)
    VALUES (artikel, mandant, 'TEST P2 Artikel', NULL);
  INSERT INTO public.stock_locations (tenant_id, stockwerk, bereich)
    VALUES (mandant, 'TEST EG', 'TEST A') RETURNING id INTO ort_a;
  INSERT INTO public.stock_locations (tenant_id, stockwerk, bereich)
    VALUES (mandant, 'TEST EG', 'TEST B') RETURNING id INTO ort_b;
  INSERT INTO public.stock_locations (tenant_id, stockwerk, bereich)
    VALUES (fremd, 'TEST EG', 'TEST Fremd') RETURNING id INTO fremder_ort;

  zeile := jsonb_build_object('artikel_id', artikel, 'art', 'stock_in', 'menge', 7.125,
    'ort_id', ort_a, 'einheit', 'l', 'fachzeit', fachdatum, 'revision', 1, 'mengenqualitaet', 'exakt',
    'geschaeftsgrund', 'wareneingang');
  SELECT bewegung_id, wiederholt INTO original, ist_wiederholt
    FROM private.lager_journal_anhaengen(befehl, unveraendert, akteur, jsonb_build_array(zeile));
  IF original IS NULL OR ist_wiederholt THEN
    RAISE EXCEPTION 'TEST erste Buchung ohne Beleg';
  END IF;
  SELECT bewegung_id, wiederholt INTO quittung, ist_wiederholt
    FROM private.lager_journal_anhaengen(befehl, unveraendert, akteur, jsonb_build_array(zeile));
  IF quittung IS DISTINCT FROM original OR NOT ist_wiederholt
    OR (SELECT count(*) FROM public.stock_movements WHERE tenant_id = mandant AND befehl_id = befehl) <> 1 THEN
    RAISE EXCEPTION 'TEST Buchung doppelt';
  END IF;
  BEGIN
    PERFORM private.lager_journal_anhaengen(befehl, geaendert, akteur, jsonb_build_array(zeile));
    RAISE EXCEPTION 'TEST Inhaltskonflikt fehlt';
  EXCEPTION WHEN unique_violation THEN
    IF SQLERRM <> 'LAGER_JOURNAL_BEFEHLSKONFLIKT' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM private.lager_journal_anhaengen(gen_random_uuid(), unveraendert, fremder_akteur, jsonb_build_array(zeile));
    RAISE EXCEPTION 'TEST fremder Akteur konnte buchen';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  BEGIN
    PERFORM private.lager_journal_anhaengen(gen_random_uuid(), unveraendert, akteur,
      jsonb_build_array(zeile || jsonb_build_object('ort_id', fremder_ort)));
    RAISE EXCEPTION 'TEST fremder Ort konnte bebucht werden';
  EXCEPTION WHEN foreign_key_violation THEN NULL;
  END;

  zeile := zeile || '{"art":"move","geschaeftsgrund":"umlagerung"}'::jsonb;
  PERFORM private.lager_journal_anhaengen(umlagerung, unveraendert, akteur, jsonb_build_array(
    zeile || '{"menge":-2.125}'::jsonb, zeile || jsonb_build_object('ort_id', ort_b, 'menge', 2.125)));
  IF (SELECT count(*) FROM public.stock_movements WHERE tenant_id = mandant AND befehl_id = umlagerung) <> 2
    OR (SELECT sum(quantity) FROM public.stock_movements WHERE tenant_id = mandant AND befehl_id = umlagerung) <> 0 THEN
    RAISE EXCEPTION 'TEST Umlagerung ist kein ausgeglichenes Paar';
  END IF;
  BEGIN
    PERFORM private.lager_journal_anhaengen(gen_random_uuid(), unveraendert, akteur, jsonb_build_array(
      zeile || '{"menge":-2.125}'::jsonb, zeile || jsonb_build_object('ort_id', ort_b, 'menge', 2)));
    RAISE EXCEPTION 'TEST einseitige Umlagerung wurde geschrieben';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;

  SELECT id INTO weg FROM public.stock_movements WHERE tenant_id = mandant AND befehl_id = umlagerung AND ort_id = ort_a;
  SELECT id INTO an FROM public.stock_movements WHERE tenant_id = mandant AND befehl_id = umlagerung AND ort_id = ort_b;
  zeile := zeile || '{"art":"reversal","geschaeftsgrund":"gegenbuchung"}'::jsonb;
  PERFORM private.lager_journal_anhaengen(gegen_befehl, unveraendert, akteur, jsonb_build_array(
    zeile || jsonb_build_object('menge', 2.125, 'gegenbuchung_id', weg),
    zeile || jsonb_build_object('ort_id', ort_b, 'menge', -2.125, 'gegenbuchung_id', an)));
  IF (SELECT count(*) FROM public.stock_movements WHERE tenant_id = mandant AND befehl_id = gegen_befehl) <> 2 THEN
    RAISE EXCEPTION 'TEST Gegenbuchung hat nicht beide Seiten';
  END IF;

  zeile := zeile || '{"art":"observation","geschaeftsgrund":"fund","mengenqualitaet":"unbekannt","menge":null}'::jsonb;
  SELECT bewegung_id INTO quittung FROM private.lager_journal_anhaengen(
    gen_random_uuid(), unveraendert, akteur, jsonb_build_array(zeile));
  IF NOT EXISTS (SELECT 1 FROM public.stock_movements WHERE id = quittung AND quantity IS NULL) THEN
    RAISE EXCEPTION 'TEST unbekannte Fundmenge als Nullmenge gespeichert';
  END IF;

  BEGIN
    UPDATE public.stock_movements SET quantity = 8 WHERE id = original;
    RAISE EXCEPTION 'TEST UPDATE als service_role zugelassen';
  EXCEPTION WHEN check_violation THEN
    IF SQLERRM <> 'LAGER_JOURNAL_UNVERAENDERLICH' THEN RAISE; END IF;
  END;
  BEGIN
    DELETE FROM public.stock_movements WHERE id = original;
    RAISE EXCEPTION 'TEST DELETE als service_role zugelassen';
  EXCEPTION WHEN check_violation THEN
    IF SQLERRM <> 'LAGER_JOURNAL_UNVERAENDERLICH' THEN RAISE; END IF;
  END;
  BEGIN
    TRUNCATE public.stock_movements;
    RAISE EXCEPTION 'TEST TRUNCATE als service_role zugelassen';
  EXCEPTION WHEN check_violation THEN
    IF SQLERRM <> 'LAGER_JOURNAL_UNVERAENDERLICH' THEN RAISE; END IF;
  END;
END;
$abnahme$;
ROLLBACK;
