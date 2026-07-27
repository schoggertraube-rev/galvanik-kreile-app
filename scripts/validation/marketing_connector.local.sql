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

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'marketing_asset'
      AND column_name = 'source_item_photo_job_id'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'marketing_asset'
      AND column_name = 'source_item_photo_uploaded_at'
  ) THEN RAISE EXCEPTION 'marketing_asset source receipt is missing'; END IF;

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

  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc function_record
    JOIN pg_namespace namespace_record
      ON namespace_record.oid = function_record.pronamespace
    WHERE namespace_record.nspname = 'public'
      AND function_record.proname = 'guard_marketing_asset_source_immutable'
      AND NOT function_record.prosecdef
  ) THEN RAISE EXCEPTION 'Expected invoker source immutability function'; END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.marketing_asset
    WHERE id = '30000000-0000-4000-8000-000000000091'
      AND storage_bucket = 'item-photos'
      AND source_item_photo_job_id = '30000000-0000-4000-8000-000000000090'
      AND source_item_photo_uploaded_at = '2097-12-31T08:00:00Z'
  ) THEN RAISE EXCEPTION 'Expected exact preexisting asset source reconciliation'; END IF;
END
$validation$;

INSERT INTO public.aktion (id, tenant_id)
VALUES ('30000000-0000-4000-8000-000000000001', 'galvanik-kreile');
INSERT INTO public.kanal (id, tenant_id)
VALUES ('30000000-0000-4000-8000-000000000002', 'galvanik-kreile');
INSERT INTO public.item_photo_jobs (
  id,
  tenant_id,
  order_id,
  storage_path,
  uploaded_at
) VALUES (
  '30000000-0000-4000-8000-000000000003',
  'galvanik-kreile',
  'marketing-order-1',
  'galvanik-kreile/marketing-order-1/photo-1.jpg',
  '2098-01-01T08:00:00Z'
);
INSERT INTO public.marketing_asset (
  id,
  tenant_id,
  quelle,
  auftrag_id,
  storage_pfad,
  storage_bucket,
  source_item_photo_job_id,
  source_item_photo_uploaded_at,
  typ,
  freigabe_marketing
) VALUES (
  '30000000-0000-4000-8000-000000000004',
  'galvanik-kreile',
  'auftragsfoto',
  'marketing-order-1',
  'galvanik-kreile/marketing-order-1/photo-1.jpg',
  'item-photos',
  '30000000-0000-4000-8000-000000000003',
  '2098-01-01T08:00:00Z',
  'image',
  true
);

INSERT INTO public.marketing_publish_job (aktion_id, asset_id, kanal_id, status, external_container_id, external_media_id)
VALUES (
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000004',
  '30000000-0000-4000-8000-000000000002',
  'succeeded',
  '123456789',
  '987654321'
);

DO $state_constraints$
BEGIN
  BEGIN
    UPDATE public.marketing_publish_job SET status = 'succeeded', external_media_id = NULL;
    RAISE EXCEPTION 'Expected succeeded-media constraint to reject incomplete settlement';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;

  BEGIN
    INSERT INTO public.marketing_asset (
      tenant_id,
      quelle,
      auftrag_id,
      storage_pfad,
      storage_bucket,
      typ,
      freigabe_marketing
    ) VALUES (
      'galvanik-kreile',
      'auftragsfoto',
      'marketing-order-1',
      'galvanik-kreile/marketing-order-1/missing-source.jpg',
      NULL,
      'image',
      true
    );
    RAISE EXCEPTION 'Expected approved asset without source to fail';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;

  BEGIN
    INSERT INTO public.marketing_asset (
      tenant_id,
      quelle,
      auftrag_id,
      storage_pfad,
      storage_bucket,
      source_item_photo_job_id,
      typ,
      freigabe_marketing
    ) VALUES (
      'galvanik-kreile',
      'auftragsfoto',
      'marketing-order-1',
      'galvanik-kreile/marketing-order-1/half-source.jpg',
      'item-photos',
      '30000000-0000-4000-8000-000000000003',
      'image',
      false
    );
    RAISE EXCEPTION 'Expected half-bound source to fail';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;

  BEGIN
    INSERT INTO public.marketing_asset (
      tenant_id,
      quelle,
      auftrag_id,
      storage_pfad,
      storage_bucket,
      source_item_photo_job_id,
      source_item_photo_uploaded_at,
      typ,
      freigabe_marketing
    ) VALUES (
      'galvanik-kreile',
      'auftragsfoto',
      'marketing-order-1',
      'galvanik-kreile/marketing-order-1/photo-1.jpg',
      'item-photos',
      '30000000-0000-4000-8000-000000000003',
      '2098-01-01T08:00:01Z',
      'image',
      false
    );
    RAISE EXCEPTION 'Expected wrong upload time to fail';
  EXCEPTION WHEN foreign_key_violation THEN
    NULL;
  END;

  BEGIN
    UPDATE public.marketing_asset
    SET storage_pfad = 'galvanik-kreile/marketing-order-1/changed.jpg'
    WHERE id = '30000000-0000-4000-8000-000000000004';
    RAISE EXCEPTION 'Expected source mutation to fail';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;

  BEGIN
    UPDATE public.marketing_publish_job SET attempt_count = -1;
    RAISE EXCEPTION 'Expected negative attempt count to fail';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;

  BEGIN
    UPDATE public.marketing_publish_job SET error_code = repeat('X', 121);
    RAISE EXCEPTION 'Expected long error code to fail';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;
END
$state_constraints$;

SELECT 'marketing_connector_ok' AS result;
