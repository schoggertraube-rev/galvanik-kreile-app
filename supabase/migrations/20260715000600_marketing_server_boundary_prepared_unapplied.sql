-- PREPARED ONLY: do not apply remotely without explicit approval.
-- Marketing/CRM data is exposed only through database-backed, permission-checked Server Actions.

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '5min';

DO $migration$
DECLARE
  table_name text;
  policy_name text;
  marketing_tables constant text[] := ARRAY[
    'kampagne', 'kanal', 'segment', 'aktion', 'touchpoint', 'attribution',
    'lern_metrik', 'einwilligung', 'telemetrie_event', 'marketing_asset',
    'feedback_mail', 'feedback_eingang', 'statistik_kennzahl'
  ];
BEGIN
  FOREACH table_name IN ARRAY marketing_tables LOOP
    IF to_regclass(format('public.%I', table_name)) IS NULL THEN
      RAISE EXCEPTION 'Required marketing table public.% is missing', table_name;
    END IF;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', table_name);
    FOR policy_name IN
      SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = table_name
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

GRANT SELECT, INSERT, UPDATE ON TABLE public.kampagne TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.kanal TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.segment TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.aktion TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.touchpoint TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.attribution TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.lern_metrik TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.einwilligung TO service_role;
GRANT SELECT, INSERT ON TABLE public.telemetrie_event TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.marketing_asset TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.feedback_mail TO service_role;
GRANT SELECT, INSERT ON TABLE public.feedback_eingang TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.statistik_kennzahl TO service_role;

DO $verification$
DECLARE
  exposed_count integer;
BEGIN
  SELECT count(*) INTO exposed_count
  FROM information_schema.role_table_grants
  WHERE table_schema = 'public'
    AND table_name = ANY (ARRAY[
      'kampagne', 'kanal', 'segment', 'aktion', 'touchpoint', 'attribution',
      'lern_metrik', 'einwilligung', 'telemetrie_event', 'marketing_asset',
      'feedback_mail', 'feedback_eingang', 'statistik_kennzahl'
    ])
    AND grantee IN ('anon', 'authenticated');
  IF exposed_count <> 0 THEN
    RAISE EXCEPTION 'Marketing Data API boundary still exposes % grants', exposed_count;
  END IF;
END
$verification$;
