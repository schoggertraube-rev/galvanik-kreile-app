-- PREPARED ONLY: do not apply remotely without explicit approval.
-- Removes the legacy public USING(true) policies from Phase 2 installations.

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '5min';

DO $policy_cleanup$
DECLARE
  target_table text;
  policy_name text;
BEGIN
  FOREACH target_table IN ARRAY ARRAY['payments', 'price_lines', 'email_templates']
  LOOP
    IF to_regclass(format('public.%I', target_table)) IS NULL THEN
      RAISE EXCEPTION 'PHASE2_RLS_RECONCILIATION_REQUIRED: missing table %', target_table;
    END IF;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', target_table);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', target_table);

    FOR policy_name IN
      SELECT policyname
      FROM pg_policies
      WHERE schemaname = 'public' AND tablename = target_table
    LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', policy_name, target_table);
    END LOOP;
  END LOOP;
END
$policy_cleanup$;

REVOKE ALL ON TABLE public.payments
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.price_lines
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.email_templates
  FROM PUBLIC, anon, authenticated, service_role;

GRANT SELECT ON TABLE public.payments TO service_role;
GRANT SELECT ON TABLE public.price_lines TO service_role;
GRANT SELECT ON TABLE public.email_templates TO service_role;

DO $verification$
DECLARE
  browser_grants integer;
  unsafe_policies integer;
  forced_tables integer;
BEGIN
  SELECT count(*) INTO browser_grants
  FROM information_schema.role_table_grants
  WHERE table_schema = 'public'
    AND table_name IN ('payments', 'price_lines', 'email_templates')
    AND grantee IN ('PUBLIC', 'anon', 'authenticated');
  IF browser_grants <> 0 THEN
    RAISE EXCEPTION 'PHASE2_RLS_BROWSER_GRANTS_REMAIN: %', browser_grants;
  END IF;

  SELECT count(*) INTO unsafe_policies
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename IN ('payments', 'price_lines', 'email_templates');
  IF unsafe_policies <> 0 THEN
    RAISE EXCEPTION 'PHASE2_RLS_POLICIES_REMAIN: %', unsafe_policies;
  END IF;

  SELECT count(*) INTO forced_tables
  FROM pg_class relation_record
  JOIN pg_namespace namespace_record
    ON namespace_record.oid = relation_record.relnamespace
  WHERE namespace_record.nspname = 'public'
    AND relation_record.relname IN ('payments', 'price_lines', 'email_templates')
    AND relation_record.relrowsecurity
    AND relation_record.relforcerowsecurity;
  IF forced_tables <> 3 THEN
    RAISE EXCEPTION 'PHASE2_RLS_FORCE_INCOMPLETE: %/3', forced_tables;
  END IF;

  IF NOT has_table_privilege('service_role', 'public.payments', 'SELECT')
     OR has_table_privilege(
       'service_role',
       'public.payments',
       'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'
     )
     OR NOT has_table_privilege('service_role', 'public.price_lines', 'SELECT')
     OR has_table_privilege(
       'service_role',
       'public.price_lines',
       'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'
     )
     OR NOT has_table_privilege('service_role', 'public.email_templates', 'SELECT')
     OR has_table_privilege(
       'service_role',
       'public.email_templates',
       'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'
     ) THEN
    RAISE EXCEPTION 'PHASE2_RLS_SERVICE_ROLE_GRANTS_INVALID';
  END IF;
END
$verification$;
