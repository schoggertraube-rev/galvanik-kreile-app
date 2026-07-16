\set ON_ERROR_STOP on

DO $validation$
DECLARE
  unexpected integer;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'marketing_asset'
      AND column_name = 'storage_bucket'
  ) THEN RAISE EXCEPTION 'marketing_asset.storage_bucket is missing'; END IF;

  SELECT count(*) INTO unexpected
  FROM information_schema.role_table_grants
  WHERE table_schema = 'public'
    AND table_name = 'marketing_publish_job'
    AND grantee IN ('anon', 'authenticated');
  IF unexpected <> 0 THEN RAISE EXCEPTION 'Expected zero browser publish-job grants, found %', unexpected; END IF;

  SELECT count(*) INTO unexpected
  FROM information_schema.role_table_grants
  WHERE table_schema = 'public'
    AND table_name = 'marketing_publish_job'
    AND grantee = 'service_role'
    AND privilege_type IN ('SELECT', 'INSERT', 'UPDATE');
  IF unexpected <> 3 THEN RAISE EXCEPTION 'Expected three service-role grants, found %', unexpected; END IF;

  IF has_table_privilege('service_role', 'public.marketing_publish_job', 'DELETE') THEN
    RAISE EXCEPTION 'Service role unexpectedly has DELETE';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'touchpoint_externe_ref_uidx'
  ) THEN RAISE EXCEPTION 'External reference uniqueness is missing'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'marketing_publish_job'
      AND c.relrowsecurity AND c.relforcerowsecurity
  ) THEN RAISE EXCEPTION 'Expected forced RLS on publish ledger'; END IF;
END
$validation$;

INSERT INTO public.aktion DEFAULT VALUES;
INSERT INTO public.kanal DEFAULT VALUES;
INSERT INTO public.marketing_asset (storage_pfad, storage_bucket) VALUES ('asset/image.jpg', 'marketing-assets');

INSERT INTO public.marketing_publish_job (aktion_id, asset_id, kanal_id, status, external_container_id, external_media_id)
SELECT a.id, m.id, k.id, 'succeeded', '123456789', '987654321'
FROM public.aktion a CROSS JOIN public.marketing_asset m CROSS JOIN public.kanal k;

WITH new_action AS (INSERT INTO public.aktion DEFAULT VALUES RETURNING id),
     new_channel AS (INSERT INTO public.kanal DEFAULT VALUES RETURNING id),
     new_asset AS (
       INSERT INTO public.marketing_asset (storage_pfad, storage_bucket)
       VALUES ('asset/uncertain.jpg', 'marketing-assets')
       RETURNING id
     )
INSERT INTO public.marketing_publish_job (aktion_id, asset_id, kanal_id, status, error_code)
SELECT new_action.id, new_asset.id, new_channel.id, 'uncertain', 'STALE_PUBLISHING_JOB'
FROM new_action CROSS JOIN new_asset CROSS JOIN new_channel;

DO $state_constraints$
BEGIN
  BEGIN
    UPDATE public.marketing_publish_job SET status = 'succeeded', external_media_id = NULL;
    RAISE EXCEPTION 'Expected succeeded-media constraint to reject incomplete settlement';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;
END
$state_constraints$;

SELECT 'marketing_connector_ok' AS result;
