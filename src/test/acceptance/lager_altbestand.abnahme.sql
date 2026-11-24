BEGIN;
DO $abnahme$
DECLARE
  mandant text := 'TEST-lager-alt';
  artikel text := 'TEST-alt-neuer-artikel';
  akteur uuid := gen_random_uuid();
  ort uuid;
  eroeffnung timestamptz := statement_timestamp() - interval '1 hour';
  quelle jsonb := jsonb_build_object('tabelle', 'inventory_items', 'feld', 'current_stock',
    'artikel_id', artikel, 'menge', 7, 'einheit', 'l', 'einheit_normiert', NULL, 'basiseinheit', 'l');
BEGIN
  PERFORM set_config('app.tenant_id', mandant, true);
  INSERT INTO public.inventory_items (id, tenant_id, name)
    VALUES (artikel, mandant, 'TEST neuer Artikel');
  IF (SELECT current_stock FROM public.inventory_items WHERE id = artikel) IS NOT NULL
    OR EXISTS (SELECT 1 FROM private.material_stock WHERE artikel_id = artikel) THEN
    RAISE EXCEPTION 'TEST künstlicher Bestand nach Artikelanlage';
  END IF;

  BEGIN
    INSERT INTO public.inventory_items (id, tenant_id, name, current_stock)
      VALUES ('TEST-alt-kuenstlich', mandant, 'TEST künstlicher Artikel', 0);
    RAISE EXCEPTION 'TEST Insert erzeugt künstliches Nullinventar';
  EXCEPTION WHEN check_violation THEN
    IF SQLERRM <> 'LAGER_ALTBESTAND_UNVERAENDERLICH' THEN RAISE; END IF;
  END;
  BEGIN
    UPDATE public.inventory_items SET current_stock = 99 WHERE id = artikel;
    RAISE EXCEPTION 'TEST Altbestand überschreibbar';
  EXCEPTION WHEN check_violation THEN
    IF SQLERRM <> 'LAGER_ALTBESTAND_UNVERAENDERLICH' THEN RAISE; END IF;
  END;

  INSERT INTO public.stock_movements (
    tenant_id, inventory_item_id, movement_type, quantity, mengeneinheit,
    fachzeit, revision, befehl_id, befehl_inhalt_sha256, befehl_zeile, geschaeftsgrund, mengenqualitaet, altquelle
  ) VALUES (
    mandant, artikel, 'opening', 7, 'l', eroeffnung, 1, gen_random_uuid(), repeat('c', 64), 1,
    'altbestand', 'unbestaetigt', quelle
  );
  BEGIN
    INSERT INTO public.stock_movements (
      tenant_id, inventory_item_id, movement_type, quantity, mengeneinheit,
      fachzeit, revision, befehl_id, befehl_inhalt_sha256, befehl_zeile, geschaeftsgrund, mengenqualitaet, altquelle
    ) VALUES (
      mandant, artikel, 'opening', 0, 'l', eroeffnung, 1, gen_random_uuid(), repeat('d', 64), 1,
      'altbestand', 'unbestaetigt', quelle || jsonb_build_object('menge', 0)
    );
    RAISE EXCEPTION 'TEST zweite Eröffnung erlaubt';
  EXCEPTION WHEN unique_violation THEN
    NULL;
  END;

  INSERT INTO public.app_users (id, tenant_id, email, full_name, role)
    VALUES (akteur, mandant, akteur::text || '@test.invalid', 'TEST Lager', 'buero');
  INSERT INTO public.stock_locations (tenant_id, stockwerk, bereich)
    VALUES (mandant, 'TEST EG', 'TEST Regal') RETURNING id INTO ort;
  PERFORM private.lager_journal_anhaengen(gen_random_uuid(), repeat('e', 64), akteur,
    jsonb_build_array(jsonb_build_object('artikel_id', artikel, 'art', 'stock_in', 'menge', 2,
      'ort_id', ort, 'einheit', 'l', 'fachzeit', statement_timestamp(), 'revision', 1,
      'mengenqualitaet', 'exakt', 'geschaeftsgrund', 'wareneingang')));
  IF (SELECT menge FROM private.material_stock_at(eroeffnung) WHERE artikel_id = artikel) IS DISTINCT FROM 7::numeric
    OR (SELECT sum(menge) FROM private.material_stock WHERE artikel_id = artikel) IS DISTINCT FROM 9::numeric THEN
    RAISE EXCEPTION 'TEST Eröffnung und Zugang fehlen im Bestand';
  END IF;
END;
$abnahme$;
ROLLBACK;
