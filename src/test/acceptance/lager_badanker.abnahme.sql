BEGIN;
SELECT set_config('app.tenant_id','TEST-BAD-MANDANT-A',true);

DO $abnahme$
DECLARE
  mandant text := 'TEST-BAD-MANDANT-A';
  artikel text := 'TEST-BAD-MATERIAL';
  akteur uuid := gen_random_uuid();
  lager uuid;
  prozess uuid;
  fremd uuid;
  befehl uuid := gen_random_uuid();
  fachzeit timestamptz := statement_timestamp();
  zeilen jsonb;
BEGIN
  INSERT INTO public.baths (id, tenant_id, name) VALUES
    ('TEST-BAD-A', mandant, 'TEST Bad A'),
    ('TEST-BAD-B', 'TEST-BAD-MANDANT-B', 'TEST Bad B'),
    ('TEST-BAD-C', mandant, 'TEST Bad C');

  INSERT INTO public.inventory_items (id,tenant_id,name,basiseinheit) VALUES (artikel,mandant,'TEST Material','l');
  INSERT INTO public.app_users (id,tenant_id,email,full_name)
    VALUES (akteur,mandant,akteur::text || '@test.invalid','TEST Badakteur');
  INSERT INTO public.stock_locations (tenant_id,stockwerk,bereich)
    VALUES (mandant,'TEST EG','TEST Lager') RETURNING id INTO lager;
  INSERT INTO public.stock_locations (tenant_id,stockwerk,bereich,orttyp,bad_id)
    VALUES (mandant,'TEST EG','TEST Bad','bad_prozess','TEST-BAD-A') RETURNING id INTO prozess;
  INSERT INTO public.stock_locations (tenant_id,stockwerk,bereich,orttyp,bad_id)
    VALUES ('TEST-BAD-MANDANT-B','TEST EG','TEST Bad','bad_prozess','TEST-BAD-B') RETURNING id INTO fremd;
  BEGIN
    INSERT INTO public.stock_locations (tenant_id,stockwerk,bereich,orttyp,bad_id)
      VALUES (mandant,'TEST OG','TEST Fremdbad','bad_prozess','TEST-BAD-B');
    RAISE EXCEPTION 'TEST Fremdbad als Ort gebunden';
  EXCEPTION WHEN foreign_key_violation THEN NULL;
  END;

  zeilen := jsonb_build_array(
    jsonb_build_object('artikel_id',artikel,'art','move','menge',-1.25,'ort_id',lager,
      'einheit','l','fachzeit',fachzeit,'revision',1,'geschaeftsgrund','badzugabe','mengenqualitaet','exakt'),
    jsonb_build_object('artikel_id',artikel,'art','move','menge',1.25,'ort_id',prozess,'bad_id','TEST-BAD-A',
      'einheit','l','fachzeit',fachzeit,'revision',1,'geschaeftsgrund','badzugabe','mengenqualitaet','exakt',
      'bestandsart','werkstatt_prozess')
  );
  PERFORM private.lager_journal_anhaengen(befehl, repeat('7',64), akteur, zeilen);
  PERFORM private.lager_journal_anhaengen(befehl, repeat('7',64), akteur, zeilen);
  IF (SELECT count(*) FROM public.stock_movements WHERE befehl_id = befehl) <> 2
    OR NOT EXISTS (
      SELECT 1 FROM private.material_stock WHERE artikel_id = artikel AND ort_id = prozess
        AND menge = 1.25 AND bestandsart = 'werkstatt_prozess'
    )
  THEN RAISE EXCEPTION 'TEST Badzugabe nicht ausgeglichen'; END IF;

  BEGIN
    PERFORM private.lager_journal_anhaengen(gen_random_uuid(), repeat('8',64), akteur,
      jsonb_set(zeilen, '{1,ort_id}', to_jsonb(fremd)));
    RAISE EXCEPTION 'TEST Fremder Badort im Journal';
  EXCEPTION WHEN foreign_key_violation THEN NULL;
  END;
END;
$abnahme$;

-- Temporäre Prüfrolle zeigt die RLS-Wirkung ohne Umgehungsprivileg.
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT ON TABLE public.baths, public.bath_measurements TO authenticated;
SET LOCAL ROLE authenticated;
DO $rls$
BEGIN
  IF (SELECT count(*) FROM public.baths WHERE id LIKE 'TEST-BAD-%') <> 2
    OR EXISTS (SELECT 1 FROM public.bath_measurements WHERE bath_id = 'TEST-BAD-B')
  THEN RAISE EXCEPTION 'TEST Bad-RLS'; END IF;
END;
$rls$;
RESET ROLE;
ROLLBACK;
