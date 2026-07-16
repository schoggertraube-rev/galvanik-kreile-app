\set ON_ERROR_STOP on

DO $validation$
DECLARE
  unexpected integer;
BEGIN
  SELECT count(*) INTO unexpected
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = ANY (ARRAY[
      'kampagne', 'kanal', 'segment', 'aktion', 'touchpoint', 'attribution',
      'lern_metrik', 'einwilligung', 'telemetrie_event', 'marketing_asset',
      'feedback_mail', 'feedback_eingang', 'statistik_kennzahl'
    ]);
  IF unexpected <> 0 THEN RAISE EXCEPTION 'Expected zero marketing policies, found %', unexpected; END IF;

  SELECT count(*) INTO unexpected
  FROM information_schema.role_table_grants
  WHERE table_schema = 'public'
    AND table_name = ANY (ARRAY[
      'kampagne', 'kanal', 'segment', 'aktion', 'touchpoint', 'attribution',
      'lern_metrik', 'einwilligung', 'telemetrie_event', 'marketing_asset',
      'feedback_mail', 'feedback_eingang', 'statistik_kennzahl'
    ])
    AND grantee IN ('anon', 'authenticated');
  IF unexpected <> 0 THEN RAISE EXCEPTION 'Expected zero browser grants, found %', unexpected; END IF;

  SELECT count(*) INTO unexpected
  FROM information_schema.role_table_grants
  WHERE table_schema = 'public' AND grantee = 'service_role' AND privilege_type = 'DELETE';
  IF unexpected <> 0 THEN RAISE EXCEPTION 'Service role unexpectedly has DELETE on % marketing tables', unexpected; END IF;

  SELECT count(*) INTO unexpected
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname = ANY (ARRAY[
      'kampagne', 'kanal', 'segment', 'aktion', 'touchpoint', 'attribution',
      'lern_metrik', 'einwilligung', 'telemetrie_event', 'marketing_asset',
      'feedback_mail', 'feedback_eingang', 'statistik_kennzahl'
    ])
    AND c.relrowsecurity AND c.relforcerowsecurity;
  IF unexpected <> 13 THEN RAISE EXCEPTION 'Expected 13 forced-RLS marketing tables, found %', unexpected; END IF;
END
$validation$;

SELECT 'marketing_server_boundary_ok' AS result;
