\set ON_ERROR_STOP on

BEGIN;

ALTER TABLE public.bath_measurements
  ADD COLUMN IF NOT EXISTS ph numeric,
  ADD COLUMN IF NOT EXISTS note text,
  ADD COLUMN IF NOT EXISTS measured_by uuid;

INSERT INTO public.app_users (
  id,
  tenant_id,
  email,
  full_name,
  role,
  active
) VALUES
  (
    '10000000-0000-4000-8000-000000000001',
    'galvanik-kreile',
    'operational-foundation-primary@example.invalid',
    'Operational Foundation Primary',
    'developer',
    true
  ),
  (
    '10000000-0000-4000-8000-000000000002',
    'other-tenant',
    'operational-foundation-other@example.invalid',
    'Operational Foundation Other',
    'developer',
    true
  );

INSERT INTO public.baths (
  id,
  tenant_id,
  name,
  status
) VALUES
  (
    'operational-foundation-bath-primary',
    'galvanik-kreile',
    'Operational Foundation Primary',
    'stable'
  ),
  (
    'operational-foundation-bath-other',
    'other-tenant',
    'Operational Foundation Other',
    'stable'
  );

INSERT INTO public.bath_measurements (
  id,
  tenant_id,
  bath_id,
  temperature,
  ph_value,
  notes,
  status_after_measurement,
  measured_by_user_id,
  measured_at,
  created_at
) VALUES (
  'operational-foundation-canonical',
  'galvanik-kreile',
  'operational-foundation-bath-primary',
  62.34567,
  7.12345,
  'canonical',
  'stable',
  '10000000-0000-4000-8000-000000000001',
  '2098-01-01T08:00:00Z',
  '2098-01-01T08:00:01Z'
);

DO $canonical_insert$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.bath_measurements
    WHERE id = 'operational-foundation-canonical'
      AND ph_value = 7.12345
      AND ph = 7.12345
      AND notes = 'canonical'
      AND note = 'canonical'
      AND measured_by_user_id = '10000000-0000-4000-8000-000000000001'
      AND measured_by = '10000000-0000-4000-8000-000000000001'
  ) THEN
    RAISE EXCEPTION 'CANONICAL_BATH_BRIDGE_FAILED';
  END IF;
END
$canonical_insert$;

INSERT INTO public.bath_measurements (
  id,
  tenant_id,
  bath_id,
  temperature,
  ph,
  note,
  status_after_measurement,
  measured_by,
  measured_at,
  created_at
) VALUES (
  'operational-foundation-legacy',
  'galvanik-kreile',
  'operational-foundation-bath-primary',
  61.98765,
  6.54321,
  'legacy',
  'watch',
  '10000000-0000-4000-8000-000000000001',
  '2098-01-02T08:00:00Z',
  '2098-01-02T08:00:01Z'
);

DO $legacy_insert$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.bath_measurements
    WHERE id = 'operational-foundation-legacy'
      AND ph_value = 6.54321
      AND ph = 6.54321
      AND notes = 'legacy'
      AND note = 'legacy'
      AND measured_by_user_id = '10000000-0000-4000-8000-000000000001'
      AND measured_by = '10000000-0000-4000-8000-000000000001'
  ) THEN
    RAISE EXCEPTION 'LEGACY_BATH_BRIDGE_FAILED';
  END IF;
END
$legacy_insert$;

UPDATE public.bath_measurements
SET ph = 6.11111
WHERE id = 'operational-foundation-legacy';

UPDATE public.bath_measurements
SET notes = NULL
WHERE id = 'operational-foundation-legacy';

DO $bidirectional_update$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.bath_measurements
    WHERE id = 'operational-foundation-legacy'
      AND ph = 6.11111
      AND ph_value = 6.11111
      AND note IS NULL
      AND notes IS NULL
  ) THEN
    RAISE EXCEPTION 'BIDIRECTIONAL_BATH_BRIDGE_FAILED';
  END IF;
END
$bidirectional_update$;

DO $conflict_and_tenant_gates$
BEGIN
  BEGIN
    INSERT INTO public.bath_measurements (
      id,
      tenant_id,
      bath_id,
      ph,
      ph_value,
      status_after_measurement,
      measured_at,
      created_at
    ) VALUES (
      'operational-foundation-conflict',
      'galvanik-kreile',
      'operational-foundation-bath-primary',
      6.1,
      6.2,
      'watch',
      '2098-01-03T08:00:00Z',
      '2098-01-03T08:00:01Z'
    );
    RAISE EXCEPTION 'CONFLICTING_BATH_INSERT_WAS_ACCEPTED';
  EXCEPTION
    WHEN check_violation THEN NULL;
  END;

  BEGIN
    UPDATE public.bath_measurements
    SET ph = 6.2,
        ph_value = 6.3
    WHERE id = 'operational-foundation-legacy';
    RAISE EXCEPTION 'CONFLICTING_BATH_UPDATE_WAS_ACCEPTED';
  EXCEPTION
    WHEN check_violation THEN NULL;
  END;

  BEGIN
    INSERT INTO public.bath_measurements (
      id,
      tenant_id,
      bath_id,
      status_after_measurement,
      measured_by_user_id,
      measured_at,
      created_at
    ) VALUES (
      'operational-foundation-cross-tenant-actor',
      'galvanik-kreile',
      'operational-foundation-bath-primary',
      'not_evaluated',
      '10000000-0000-4000-8000-000000000002',
      '2098-01-04T08:00:00Z',
      '2098-01-04T08:00:01Z'
    );
    RAISE EXCEPTION 'CROSS_TENANT_BATH_ACTOR_WAS_ACCEPTED';
  EXCEPTION
    WHEN foreign_key_violation THEN NULL;
  END;

  BEGIN
    INSERT INTO public.bath_measurements (
      id,
      tenant_id,
      bath_id,
      status_after_measurement,
      measured_by_user_id,
      measured_at,
      created_at
    ) VALUES (
      'operational-foundation-cross-tenant-bath',
      'galvanik-kreile',
      'operational-foundation-bath-other',
      'not_evaluated',
      '10000000-0000-4000-8000-000000000001',
      '2098-01-05T08:00:00Z',
      '2098-01-05T08:00:01Z'
    );
    RAISE EXCEPTION 'CROSS_TENANT_BATH_WAS_ACCEPTED';
  EXCEPTION
    WHEN foreign_key_violation THEN NULL;
  END;

  BEGIN
    INSERT INTO public.bath_measurements (
      id,
      tenant_id,
      bath_id,
      status_after_measurement,
      measured_at,
      created_at
    ) VALUES (
      'operational-foundation-missing-actor',
      'galvanik-kreile',
      'operational-foundation-bath-primary',
      'not_evaluated',
      '2098-01-06T08:00:00Z',
      '2098-01-06T08:00:01Z'
    );
    RAISE EXCEPTION 'MISSING_BATH_ACTOR_WAS_ACCEPTED';
  EXCEPTION
    WHEN not_null_violation THEN NULL;
  END;
END
$conflict_and_tenant_gates$;

DO $catalog_truth$
BEGIN
  IF (
    SELECT data_type <> 'text'
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'bath_measurements'
      AND column_name = 'id'
  ) OR (
    SELECT numeric_scale IS NOT NULL
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'bath_measurements'
      AND column_name = 'ph_value'
  ) OR NOT EXISTS (
    SELECT 1
    FROM pg_proc function_record
    JOIN pg_namespace namespace_record
      ON namespace_record.oid = function_record.pronamespace
    WHERE namespace_record.nspname = 'public'
      AND function_record.proname = 'bridge_bath_measurement_columns'
      AND NOT function_record.prosecdef
  ) THEN
    RAISE EXCEPTION 'OPERATIONAL_BATH_CATALOG_TRUTH_FAILED';
  END IF;
END
$catalog_truth$;

SELECT 'operational_baths_foundation_ok' AS result;

ROLLBACK;
