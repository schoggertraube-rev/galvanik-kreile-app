-- PREPARED ONLY: do not apply remotely without explicit approval.
-- Finance data is authorized by the database-backed app session in Server Actions.
-- Browser roles must not bypass that boundary through the Supabase Data API.

DO $migration$
DECLARE
  table_name text;
  policy_name text;
  finance_tables constant text[] := ARRAY[
    'beleg',
    'beleg_position',
    'kraftstoff_detail',
    'ausgangsrechnung',
    'ausgangsrechnung_position',
    'zahlung',
    'kategorie',
    'lieferant',
    'steuerprofil',
    'ustva_periode',
    'export_lauf',
    'bh_audit_log',
    'bh_einstellungen',
    'kostenposten'
  ];
BEGIN
  FOREACH table_name IN ARRAY finance_tables LOOP
    IF to_regclass(format('public.%I', table_name)) IS NULL THEN
      CONTINUE;
    END IF;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', table_name);

    FOR policy_name IN
      SELECT policyname
      FROM pg_policies
      WHERE schemaname = 'public' AND tablename = table_name
    LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', policy_name, table_name);
    END LOOP;

    EXECUTE format(
      'REVOKE ALL ON TABLE public.%I FROM PUBLIC, anon, authenticated, service_role',
      table_name
    );
  END LOOP;
END
$migration$;

-- The service role is only used after requireFinanceRead() has validated the
-- current app user, role, active state and fixed tenant. No DELETE permission
-- is granted for GoBD-relevant finance records.
GRANT SELECT, INSERT, UPDATE ON TABLE public.beleg TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.beleg_position TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.kraftstoff_detail TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.ausgangsrechnung TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.ausgangsrechnung_position TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.zahlung TO service_role;
GRANT SELECT ON TABLE public.kategorie TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.lieferant TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.steuerprofil TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.ustva_periode TO service_role;
GRANT SELECT, INSERT ON TABLE public.export_lauf TO service_role;
GRANT SELECT, INSERT ON TABLE public.bh_audit_log TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.bh_einstellungen TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.kostenposten TO service_role;

DO $verification$
DECLARE
  exposed_count integer;
BEGIN
  SELECT count(*)
  INTO exposed_count
  FROM information_schema.role_table_grants
  WHERE table_schema = 'public'
    AND table_name = ANY (ARRAY[
      'beleg', 'beleg_position', 'kraftstoff_detail', 'ausgangsrechnung',
      'ausgangsrechnung_position', 'zahlung', 'kategorie', 'lieferant',
      'steuerprofil', 'ustva_periode', 'export_lauf', 'bh_audit_log',
      'bh_einstellungen', 'kostenposten'
    ])
    AND grantee IN ('anon', 'authenticated');

  IF exposed_count <> 0 THEN
    RAISE EXCEPTION 'Finance Data API boundary still exposes % grants', exposed_count;
  END IF;
END
$verification$;
