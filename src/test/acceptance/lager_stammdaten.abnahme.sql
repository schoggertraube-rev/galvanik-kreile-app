-- Abnahme nach der P1-Migration an einer isolierten Kopie. App-Nachweis beim Einbau.
-- Ausschließlich TEST-Zeilen, vollständig zurückgerollt.
BEGIN;
DO $abnahme$
DECLARE
  mandant text := 'TEST-p1-' || gen_random_uuid()::text;
  fremd text := 'TEST-p1-' || gen_random_uuid()::text;
  artikel text := 'TEST-p1-' || gen_random_uuid()::text;
  anderer_artikel text := 'TEST-p1-' || gen_random_uuid()::text;
  ausgabe_v1 uuid;
  ausgabe_v2 uuid;
  ausgabe_zum_stichtag uuid;
  rubrik uuid;
  erste_nummer integer;
  zweite_nummer integer;
  tabelle text;
BEGIN
  PERFORM set_config('app.tenant_id', mandant, true);
  erste_nummer := private.lager_naechste_kurznummer();
  zweite_nummer := private.lager_naechste_kurznummer();
  IF erste_nummer <> 1 OR zweite_nummer <> 2 THEN
    RAISE EXCEPTION 'TEST Kurznummer: falsche Folge';
  END IF;
  PERFORM set_config('app.tenant_id', fremd, true);
  IF private.lager_naechste_kurznummer() <> 1 THEN
    RAISE EXCEPTION 'TEST Kurznummer: fremde Folge';
  END IF;
  PERFORM set_config('app.tenant_id', mandant, true);

  INSERT INTO public.inventory_items (id, tenant_id, name, variante, basiseinheit, current_stock)
  VALUES (artikel, mandant, 'TEST Kanister', 'A', 'l', NULL),
         (anderer_artikel, fremd, 'TEST Kanister', 'B', 'l', NULL);
  INSERT INTO public.stock_locations (tenant_id, stockwerk, bereich)
  VALUES (mandant, 'TEST EG', 'TEST Reserve'), (mandant, 'TEST OG', 'TEST Werkstatt');

  INSERT INTO public.categories (tenant_id, name) VALUES (mandant, 'TEST Chemie') RETURNING id INTO rubrik;
  UPDATE public.inventory_items SET rubrik_id = rubrik WHERE id = artikel;
  BEGIN
    UPDATE public.inventory_items SET rubrik_id = rubrik WHERE id = anderer_artikel;
    RAISE EXCEPTION 'TEST A45: fremde Rubrik zugeordnet';
  EXCEPTION WHEN foreign_key_violation THEN NULL;
  END;

  INSERT INTO public.packaging_definitions
    (tenant_id, artikel_id, gebinde_schluessel, version, art, name, inhalt_menge, inhalt_einheit, gueltig_ab)
  VALUES (mandant, artikel, 'TEST-a', 1, 'Kanister', 'TEST 20 l', 20, 'l', '2026-11-01 08:00:00+01')
  RETURNING id INTO ausgabe_v1;
  INSERT INTO public.packaging_definitions
    (tenant_id, artikel_id, gebinde_schluessel, version, art, name, inhalt_menge, inhalt_einheit, gueltig_ab)
  VALUES (mandant, artikel, 'TEST-a', 2, 'Kanister', 'TEST 18 l', 18, 'l', '2026-11-19 08:00:00+01')
  RETURNING id INTO ausgabe_v2;
  INSERT INTO public.packaging_definitions
    (tenant_id, artikel_id, gebinde_schluessel, version, art, name, inhalt_menge, inhalt_einheit, gueltig_ab)
  VALUES (mandant, artikel, 'TEST-b', 1, 'Kanister', 'TEST 5 l', 5, 'l', '2026-11-01 08:00:00+01');

  SELECT id INTO ausgabe_zum_stichtag FROM public.packaging_definitions
  WHERE tenant_id = mandant AND artikel_id = artikel AND gebinde_schluessel = 'TEST-a'
    AND gueltig_ab <= '2026-11-18 23:59:59+01'::timestamptz
  ORDER BY gueltig_ab DESC LIMIT 1;
  IF ausgabe_zum_stichtag IS DISTINCT FROM ausgabe_v1 OR ausgabe_v1 IS NOT DISTINCT FROM ausgabe_v2 THEN
    RAISE EXCEPTION 'TEST A08: die historische Gebindeversion fehlt';
  END IF;
  BEGIN
    UPDATE public.packaging_definitions SET inhalt_menge = 7 WHERE id = ausgabe_v1;
    RAISE EXCEPTION 'TEST A08: historische Gebindeversion geändert';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    DELETE FROM public.packaging_definitions WHERE id = ausgabe_v1;
    RAISE EXCEPTION 'TEST A08: historische Gebindeversion gelöscht';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO public.handling_units (tenant_id, artikel_id, gebinde_version_id)
    VALUES (fremd, anderer_artikel, ausgabe_v1);
    RAISE EXCEPTION 'TEST A45: fremde Gebindeversion übernommen';
  EXCEPTION WHEN foreign_key_violation THEN NULL;
  END;

  INSERT INTO public.metallkurse (tenant_id, metall, kursdatum, eur_pro_gramm, quelle, manuell)
  VALUES (mandant, 'TEST Metall', '2026-11-20', 10, 'TEST Quelle', false),
         (mandant, 'TEST Metall', '2026-11-20', 12, 'TEST Quelle', true),
         (fremd, 'TEST Metall', '2026-11-20', 20, 'TEST Quelle', false);
  IF (SELECT eur_pro_gramm FROM public.metallkurse
      WHERE tenant_id = mandant AND metall = 'TEST Metall' AND kursdatum = '2026-11-20'
        AND quelle = 'TEST Quelle' AND manuell IS FALSE) IS DISTINCT FROM 10::numeric THEN
    RAISE EXCEPTION 'TEST M3: manuelle und externe Kurse werden vermischt';
  END IF;

  IF (SELECT array_agg(attname::text || ':' || format_type(atttypid, atttypmod) ORDER BY attnum)
      FROM pg_attribute WHERE attrelid = 'private.v_task_contexts_v1'::regclass
        AND attnum > 0 AND NOT attisdropped) IS DISTINCT FROM ARRAY[
      'tenant_id:text', 'kind:text', 'id:text', 'label:text', 'customer_id:text',
      'customer_type:character varying(50)', 'order_id:text', 'channel:text', 'phone:text',
      'source_version:integer'] THEN
    RAISE EXCEPTION 'TEST A45: Spaltenvertrag der bestehenden Aufgabensicht geändert';
  END IF;

  -- Der Artikelentwurf behält seine Identität und ist nur im eigenen
  -- Transaktionsmandanten im bestehenden Aufgaben-Kontext sichtbar.
  UPDATE public.inventory_items SET stamm_status = 'entwurf' WHERE id = artikel;
  IF NOT EXISTS (SELECT 1 FROM private.v_task_contexts_v1 WHERE kind = 'lagerartikel'
    AND id = artikel AND tenant_id = mandant AND source_version = 1)
    OR EXISTS (SELECT 1 FROM public.v_lager_artikel_status_v1 WHERE id = anderer_artikel) THEN
    RAISE EXCEPTION 'TEST A45: Kontext Mandant oder Artikelentwurf falsch';
  END IF;
  UPDATE public.inventory_items SET stamm_status = 'aktiv', stamm_version = 2 WHERE id = artikel;
  IF NOT EXISTS (SELECT 1 FROM public.v_lager_artikel_status_v1
    WHERE id = artikel AND stamm_status = 'aktiv' AND stamm_version = 2) THEN
    RAISE EXCEPTION 'TEST: Artikelübernahme hat die Identität verloren';
  END IF;

  BEGIN
    PERFORM private.lager_stammereignis_anlegen(
      fremd, gen_random_uuid(), gen_random_uuid(), 'LAGER_STAMMBEFEHL_V1', 1, '{}'::jsonb
    );
    RAISE EXCEPTION 'TEST A45: fremder Mandant schreibt ein Ereignis';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  FOREACH tabelle IN ARRAY ARRAY['v_lager_eingangsoriginale_v1', 'v_lager_stammereignisse_v1',
    'v_lager_artikel_status_v1', 'v_lager_entwurf_aufgaben_v1', 'v_lager_lieferanten_v1'] LOOP
    IF has_table_privilege('anon', 'public.' || tabelle, 'SELECT')
      OR has_table_privilege('authenticated', 'public.' || tabelle, 'SELECT') THEN
      RAISE EXCEPTION 'TEST A45: Browserrechte an %', tabelle;
    END IF;
  END LOOP;

  FOREACH tabelle IN ARRAY ARRAY['categories', 'material_short_no_counter', 'stock_locations',
    'packaging_definitions', 'handling_units', 'lager_artikel_kennungen', 'lager_artikel_dateien',
    'material_prices', 'metallkurse'] LOOP
    IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = ('public.' || tabelle)::regclass)
      OR has_table_privilege('anon', 'public.' || tabelle, 'SELECT')
      OR has_table_privilege('authenticated', 'public.' || tabelle, 'SELECT') THEN
      RAISE EXCEPTION 'TEST A45: RLS/Browserrechte für %', tabelle;
    END IF;
  END LOOP;
END;
$abnahme$;
ROLLBACK;
