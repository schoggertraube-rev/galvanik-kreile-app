\set ON_ERROR_STOP on

DO $validation$
DECLARE
  unexpected integer;
BEGIN
  SELECT count(*) INTO unexpected
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = ANY (ARRAY[
      'beleg', 'beleg_position', 'kraftstoff_detail', 'ausgangsrechnung',
      'ausgangsrechnung_position', 'zahlung', 'kategorie', 'lieferant',
      'steuerprofil', 'ustva_periode', 'export_lauf', 'bh_audit_log',
      'bh_einstellungen', 'kostenposten'
    ]);
  IF unexpected <> 0 THEN RAISE EXCEPTION 'Expected zero finance policies, found %', unexpected; END IF;

  SELECT count(*) INTO unexpected
  FROM information_schema.role_table_grants
  WHERE table_schema = 'public'
    AND table_name = ANY (ARRAY[
      'beleg', 'beleg_position', 'kraftstoff_detail', 'ausgangsrechnung',
      'ausgangsrechnung_position', 'zahlung', 'kategorie', 'lieferant',
      'steuerprofil', 'ustva_periode', 'export_lauf', 'bh_audit_log',
      'bh_einstellungen', 'kostenposten'
    ])
    AND grantee IN ('anon', 'authenticated');
  IF unexpected <> 0 THEN RAISE EXCEPTION 'Expected zero browser grants, found %', unexpected; END IF;

  SELECT count(*) INTO unexpected
  FROM information_schema.role_table_grants
  WHERE table_schema = 'public' AND grantee = 'service_role' AND privilege_type = 'DELETE';
  IF unexpected <> 0 THEN RAISE EXCEPTION 'Service role unexpectedly has DELETE on % finance tables', unexpected; END IF;

  SELECT count(*) INTO unexpected
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname = ANY (ARRAY[
      'beleg', 'beleg_position', 'kraftstoff_detail', 'ausgangsrechnung',
      'ausgangsrechnung_position', 'zahlung', 'kategorie', 'lieferant',
      'steuerprofil', 'ustva_periode', 'export_lauf', 'bh_audit_log',
      'bh_einstellungen', 'kostenposten'
    ])
    AND c.relrowsecurity AND c.relforcerowsecurity;
  IF unexpected <> 14 THEN RAISE EXCEPTION 'Expected 14 forced-RLS finance tables, found %', unexpected; END IF;
END
$validation$;

SELECT 'finance_server_boundary_ok' AS result;
