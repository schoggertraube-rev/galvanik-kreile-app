BEGIN;
DO $abnahme$
DECLARE
  mandant text := 'TEST-lager-orte';
  stockwerk_id uuid;
  raum_a uuid;
  raum_b uuid;
  artikel text := 'TEST-lager-orte-artikel';
  akteur uuid := gen_random_uuid();
  sitzung uuid := gen_random_uuid();
BEGIN
  PERFORM set_config('app.tenant_id', mandant, true);
  INSERT INTO public.stock_locations (tenant_id, stockwerk)
    VALUES (mandant, 'TEST EG') RETURNING id INTO stockwerk_id;
  IF NOT EXISTS (SELECT 1 FROM public.stock_locations
    WHERE id = stockwerk_id AND bereich IS NULL AND parent_id IS NULL) THEN
    RAISE EXCEPTION 'TEST Stockwerk ohne Raum fehlt';
  END IF;
  BEGIN
    INSERT INTO public.stock_locations (tenant_id, stockwerk) VALUES (mandant, 'TEST EG');
    RAISE EXCEPTION 'TEST zweites gleiches Stockwerk erlaubt';
  EXCEPTION WHEN unique_violation THEN
    NULL;
  END;

  INSERT INTO public.stock_locations (tenant_id, stockwerk, bereich, parent_id)
    VALUES (mandant, 'TEST EG', 'TEST Raum A', stockwerk_id) RETURNING id INTO raum_a;
  INSERT INTO public.stock_locations (tenant_id, stockwerk, bereich, parent_id)
    VALUES (mandant, 'TEST EG', 'TEST Raum B', stockwerk_id) RETURNING id INTO raum_b;
  INSERT INTO public.stock_locations (tenant_id, stockwerk, bereich, parent_id)
    VALUES (mandant, 'TEST EG', 'TEST Regal', raum_a), (mandant, 'TEST EG', 'TEST Regal', raum_b);
  IF (SELECT count(*) FROM public.stock_locations
    WHERE tenant_id = mandant AND bereich = 'TEST Regal' AND parent_id IN (raum_a, raum_b)) <> 2 THEN
    RAISE EXCEPTION 'TEST getrennte Regale fehlen';
  END IF;
  BEGIN
    INSERT INTO public.stock_locations (tenant_id, stockwerk, bereich, parent_id)
      VALUES (mandant, 'TEST EG', 'TEST Regal', raum_a);
    RAISE EXCEPTION 'TEST gleicher Platzname unter demselben Elternort erlaubt';
  EXCEPTION WHEN unique_violation THEN
    NULL;
  END;
  BEGIN
    INSERT INTO public.stock_locations (tenant_id, stockwerk, parent_id)
      VALUES (mandant, 'TEST OG', raum_a);
    RAISE EXCEPTION 'TEST Stockwerk hat einen Elternort';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;

  INSERT INTO public.app_users (id, tenant_id, email, full_name, role)
    VALUES (akteur, mandant, akteur::text || '@test.invalid', 'TEST Lager', 'admin');
  INSERT INTO public.inventory_items (id, tenant_id, name, basiseinheit)
    VALUES (artikel, mandant, 'TEST Lagerartikel', 'l');
  INSERT INTO public.inventory_sessions (id, tenant_id, stichtag, art, erstellt_von)
    VALUES (sitzung, mandant, DATE '2026-11-19', 'stichtag', akteur);
  BEGIN
    PERFORM private.lager_journal_anhaengen(gen_random_uuid(), repeat('f',64), akteur, jsonb_build_array(
      jsonb_build_object('artikel_id', artikel, 'art', 'stock_in', 'menge', 1,
        'ort_id', stockwerk_id, 'einheit', 'l', 'fachzeit', statement_timestamp(), 'revision', 1,
        'mengenqualitaet', 'exakt', 'geschaeftsgrund', 'wareneingang')));
    RAISE EXCEPTION 'TEST Bewegung auf Stockwerk zugelassen';
  EXCEPTION WHEN check_violation THEN
    IF SQLERRM <> 'LAGER_ORT_IST_STOCKWERK' THEN RAISE; END IF;
  END;
  BEGIN
    INSERT INTO public.inventory_counts (tenant_id, session_id, artikel_id, ort_id, einheit)
      VALUES (mandant, sitzung, artikel, stockwerk_id, 'l');
    RAISE EXCEPTION 'TEST Zählzeile auf Stockwerk zugelassen';
  EXCEPTION WHEN check_violation THEN
    IF SQLERRM <> 'LAGER_ORT_IST_STOCKWERK' THEN RAISE; END IF;
  END;
END;
$abnahme$;
ROLLBACK;
