-- Non-destructive contract phase. Apply only after the actor-writing
-- application is deployed. The compatibility bridge and legacy values remain
-- until a separately authorized cleanup migration.

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '5min';

DO $contract_gate$
DECLARE
  canonical_column text;
  legacy_column text;
  has_canonical boolean;
  has_legacy boolean;
  has_conflict boolean;
BEGIN
  IF to_regclass('public.bath_measurements') IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '42P01',
      MESSAGE = 'BATH_MEASUREMENT_RELATION_REQUIRED';
  END IF;

  FOR canonical_column, legacy_column IN
    SELECT *
    FROM (
      VALUES
        ('ph_value', 'ph'),
        ('notes', 'note'),
        ('measured_by_user_id', 'measured_by')
    ) AS column_pairs(canonical_name, legacy_name)
  LOOP
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'bath_measurements'
        AND column_name = canonical_column
    ) INTO has_canonical;

    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'bath_measurements'
        AND column_name = legacy_column
    ) INTO has_legacy;

    IF NOT has_canonical THEN
      RAISE EXCEPTION USING
        ERRCODE = '42703',
        MESSAGE = 'BATH_MEASUREMENT_CANONICAL_COLUMN_REQUIRED',
        DETAIL = canonical_column;
    END IF;

    IF has_canonical AND has_legacy THEN
      EXECUTE format(
        'SELECT EXISTS (
           SELECT 1
           FROM public.bath_measurements
           WHERE %1$I IS DISTINCT FROM %2$I
         )',
        canonical_column,
        legacy_column
      ) INTO has_conflict;

      IF has_conflict THEN
        RAISE EXCEPTION USING
          ERRCODE = '23514',
          MESSAGE = 'BATH_MEASUREMENT_COLUMN_RECONCILIATION_REQUIRED',
          DETAIL = canonical_column || '<->' || legacy_column;
      END IF;
    END IF;
  END LOOP;

  IF EXISTS (
    SELECT 1
    FROM public.bath_measurements
    WHERE measured_by_user_id IS NULL
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23502',
      MESSAGE = 'BATH_MEASUREMENT_ACTOR_RECONCILIATION_REQUIRED';
  END IF;
END
$contract_gate$;

ALTER TABLE public.bath_measurements
  ALTER COLUMN measured_by_user_id SET NOT NULL;

DO $contract_verification$
DECLARE
  canonical_column text;
  legacy_column text;
  has_legacy boolean;
  has_conflict boolean;
BEGIN
  IF (
    SELECT count(*)
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'bath_measurements'
      AND column_name IN (
        'ph_value',
        'notes',
        'measured_by_user_id'
      )
  ) <> 3 OR EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'bath_measurements'
      AND column_name = 'measured_by_user_id'
      AND is_nullable <> 'NO'
  ) OR EXISTS (
    SELECT 1
    FROM public.bath_measurements
    WHERE measured_by_user_id IS NULL
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'BATH_MEASUREMENT_CONTRACT_VERIFICATION_FAILED';
  END IF;

  FOR canonical_column, legacy_column IN
    SELECT *
    FROM (
      VALUES
        ('ph_value', 'ph'),
        ('notes', 'note'),
        ('measured_by_user_id', 'measured_by')
    ) AS column_pairs(canonical_name, legacy_name)
  LOOP
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'bath_measurements'
        AND column_name = legacy_column
    ) INTO has_legacy;

    IF NOT has_legacy THEN
      CONTINUE;
    END IF;

    EXECUTE format(
      'SELECT EXISTS (
         SELECT 1
         FROM public.bath_measurements
         WHERE %1$I IS DISTINCT FROM %2$I
       )',
      canonical_column,
      legacy_column
    ) INTO has_conflict;

    IF has_conflict THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = 'BATH_MEASUREMENT_COLUMN_RECONCILIATION_REQUIRED',
        DETAIL = canonical_column || '<->' || legacy_column;
    END IF;
  END LOOP;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger trigger_record
    WHERE trigger_record.tgrelid = 'public.bath_measurements'::regclass
      AND trigger_record.tgname = 'bath_measurements_dual_write_bridge'
      AND trigger_record.tgfoid = 'public.bridge_bath_measurement_columns()'::regprocedure
      AND NOT trigger_record.tgisinternal
      AND trigger_record.tgenabled = 'O'
  ) OR NOT EXISTS (
    SELECT 1
    FROM pg_proc procedure_record
    JOIN pg_namespace namespace_record ON namespace_record.oid = procedure_record.pronamespace
    WHERE procedure_record.oid = 'public.bridge_bath_measurement_columns()'::regprocedure
      AND namespace_record.nspname = 'public'
      AND NOT procedure_record.prosecdef
      AND procedure_record.proconfig IS NOT DISTINCT FROM ARRAY['search_path=pg_catalog, public']
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'BATH_MEASUREMENT_BRIDGE_VERIFICATION_FAILED';
  END IF;
END
$contract_verification$;
