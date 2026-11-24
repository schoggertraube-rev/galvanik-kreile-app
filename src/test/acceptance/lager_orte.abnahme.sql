BEGIN;
DO $abnahme$
DECLARE
  mandant text := 'TEST-lager-orte';
  stockwerk_id uuid;
  raum_a uuid;
  raum_b uuid;
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
END;
$abnahme$;
ROLLBACK;
