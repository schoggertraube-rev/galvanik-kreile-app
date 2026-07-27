-- Expand-safe operational boundary. The later 20260720000500 contract must
-- only be applied after the actor-writing application is deployed and every
-- older writer has drained.

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '5min';

DO $required_relations$
BEGIN
  IF to_regclass('public.baths') IS NULL
     OR to_regclass('public.bath_measurements') IS NULL
     OR to_regclass('public.app_users') IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '42P01',
      MESSAGE = 'OPERATIONAL_BATH_RELATIONS_REQUIRED';
  END IF;
END
$required_relations$;

ALTER TABLE public.baths
  ADD COLUMN IF NOT EXISTS tenant_id text,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS last_measured_at timestamptz;

ALTER TABLE public.bath_measurements
  ADD COLUMN IF NOT EXISTS tenant_id text,
  ADD COLUMN IF NOT EXISTS bath_id text,
  ADD COLUMN IF NOT EXISTS temperature numeric,
  ADD COLUMN IF NOT EXISTS status_after_measurement varchar(50),
  ADD COLUMN IF NOT EXISTS ph_value numeric,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS measured_by_user_id uuid,
  ADD COLUMN IF NOT EXISTS measured_at timestamptz,
  ADD COLUMN IF NOT EXISTS created_at timestamptz;

ALTER TABLE public.baths
  ALTER COLUMN tenant_id TYPE text USING tenant_id::text;

ALTER TABLE public.bath_measurements
  ALTER COLUMN tenant_id TYPE text USING tenant_id::text,
  ALTER COLUMN bath_id TYPE text USING bath_id::text,
  ALTER COLUMN temperature TYPE numeric USING temperature::numeric,
  ALTER COLUMN ph_value TYPE numeric USING ph_value::numeric;

DO $measurement_id_contract$
DECLARE
  id_attribute_number smallint;
  id_type text;
  dependent_relation text;
BEGIN
  SELECT attribute.attnum, type_record.typname
  INTO id_attribute_number, id_type
  FROM pg_attribute attribute
  JOIN pg_type type_record ON type_record.oid = attribute.atttypid
  WHERE attribute.attrelid = 'public.bath_measurements'::regclass
    AND attribute.attname = 'id'
    AND NOT attribute.attisdropped;

  IF id_attribute_number IS NULL OR id_type NOT IN ('uuid', 'text') THEN
    RAISE EXCEPTION USING
      ERRCODE = '42804',
      MESSAGE = 'BATH_MEASUREMENT_ID_TYPE_RECONCILIATION_REQUIRED';
  END IF;

  SELECT foreign_constraint.conrelid::regclass::text
  INTO dependent_relation
  FROM pg_constraint foreign_constraint
  WHERE foreign_constraint.contype = 'f'
    AND foreign_constraint.confrelid = 'public.bath_measurements'::regclass
    AND id_attribute_number = ANY (foreign_constraint.confkey)
  LIMIT 1;

  IF dependent_relation IS NOT NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '2BP01',
      MESSAGE = 'BATH_MEASUREMENT_ID_FOREIGN_KEY_RECONCILIATION_REQUIRED',
      DETAIL = dependent_relation;
  END IF;

  SELECT format('%I.%I', namespace_record.nspname, view_record.relname)
  INTO dependent_relation
  FROM pg_depend dependency
  JOIN pg_rewrite rewrite_record ON rewrite_record.oid = dependency.objid
  JOIN pg_class view_record ON view_record.oid = rewrite_record.ev_class
  JOIN pg_namespace namespace_record ON namespace_record.oid = view_record.relnamespace
  WHERE dependency.refobjid = 'public.bath_measurements'::regclass
    AND dependency.refobjsubid = id_attribute_number
    AND view_record.relkind IN ('v', 'm')
  LIMIT 1;

  IF dependent_relation IS NOT NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '2BP01',
      MESSAGE = 'BATH_MEASUREMENT_ID_VIEW_RECONCILIATION_REQUIRED',
      DETAIL = dependent_relation;
  END IF;

  IF id_type = 'uuid' THEN
    ALTER TABLE public.bath_measurements
      ALTER COLUMN id DROP DEFAULT,
      ALTER COLUMN id TYPE text USING id::text;
  END IF;

  ALTER TABLE public.bath_measurements
    ALTER COLUMN id SET DEFAULT (pg_catalog.gen_random_uuid()::text);
END
$measurement_id_contract$;

DO $timestamp_contract$
DECLARE
  current_type text;
BEGIN
  SELECT data_type
  INTO current_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'baths'
    AND column_name = 'last_measured_at';

  IF current_type = 'timestamp without time zone' THEN
    IF EXISTS (
      SELECT 1
      FROM public.baths
      WHERE last_measured_at IS NOT NULL
    ) THEN
      RAISE EXCEPTION USING
        ERRCODE = '22007',
        MESSAGE = 'BATH_TIMESTAMP_TIMEZONE_RECONCILIATION_REQUIRED';
    END IF;

    ALTER TABLE public.baths
      ALTER COLUMN last_measured_at TYPE timestamptz
      USING last_measured_at AT TIME ZONE 'Europe/Berlin';
  ELSIF current_type <> 'timestamp with time zone' THEN
    RAISE EXCEPTION USING
      ERRCODE = '42804',
      MESSAGE = 'BATH_TIMESTAMP_TYPE_RECONCILIATION_REQUIRED';
  END IF;
END
$timestamp_contract$;

DO $legacy_measurement_reconciliation$
DECLARE
  canonical_column text;
  legacy_column text;
  has_canonical boolean;
  has_legacy boolean;
  has_conflict boolean;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'bath_measurements'
      AND column_name = 'ph'
  ) THEN
    ALTER TABLE public.bath_measurements
      ALTER COLUMN ph TYPE numeric USING ph::numeric;
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

    IF has_canonical AND has_legacy THEN
      EXECUTE format(
        'SELECT EXISTS (
           SELECT 1
           FROM public.bath_measurements
           WHERE %1$I IS NOT NULL
             AND %2$I IS NOT NULL
             AND %1$I IS DISTINCT FROM %2$I
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

      EXECUTE format(
        'UPDATE public.bath_measurements
         SET %1$I = COALESCE(%1$I, %2$I),
             %2$I = COALESCE(%1$I, %2$I)',
        canonical_column,
        legacy_column
      );
    END IF;
  END LOOP;
END
$legacy_measurement_reconciliation$;

UPDATE public.baths
SET tenant_id = 'galvanik-kreile'
WHERE tenant_id IS NULL OR btrim(tenant_id) = '';

UPDATE public.baths
SET status = 'not_evaluated'
WHERE status IS NULL OR btrim(status) = '';

UPDATE public.bath_measurements
SET tenant_id = 'galvanik-kreile'
WHERE tenant_id IS NULL OR btrim(tenant_id) = '';

UPDATE public.bath_measurements
SET status_after_measurement = 'not_evaluated'
WHERE status_after_measurement IS NULL
   OR btrim(status_after_measurement) = '';

DO $bath_truth_preflight$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.bath_measurements measurement
    LEFT JOIN public.baths bath
      ON bath.tenant_id = measurement.tenant_id
     AND bath.id = measurement.bath_id
    WHERE measurement.bath_id IS NULL
       OR bath.id IS NULL
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23503',
      MESSAGE = 'BATH_MEASUREMENT_BATH_RECONCILIATION_REQUIRED';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.bath_measurements
    WHERE measured_at IS NULL OR created_at IS NULL
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23502',
      MESSAGE = 'BATH_MEASUREMENT_TIMESTAMP_RECONCILIATION_REQUIRED';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.bath_measurements measurement
    LEFT JOIN public.app_users actor
      ON actor.tenant_id = measurement.tenant_id
     AND actor.id = measurement.measured_by_user_id
    WHERE measurement.measured_by_user_id IS NOT NULL
      AND actor.id IS NULL
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23503',
      MESSAGE = 'BATH_MEASUREMENT_ACTOR_RECONCILIATION_REQUIRED';
  END IF;
END
$bath_truth_preflight$;

ALTER TABLE public.baths
  ALTER COLUMN tenant_id SET DEFAULT 'galvanik-kreile',
  ALTER COLUMN tenant_id SET NOT NULL,
  ALTER COLUMN status SET DEFAULT 'not_evaluated',
  ALTER COLUMN status SET NOT NULL;

ALTER TABLE public.bath_measurements
  ALTER COLUMN tenant_id SET DEFAULT 'galvanik-kreile',
  ALTER COLUMN tenant_id SET NOT NULL,
  ALTER COLUMN bath_id SET NOT NULL,
  ALTER COLUMN status_after_measurement SET DEFAULT 'not_evaluated',
  ALTER COLUMN status_after_measurement SET NOT NULL,
  ALTER COLUMN measured_at SET DEFAULT now(),
  ALTER COLUMN measured_at SET NOT NULL,
  ALTER COLUMN created_at SET DEFAULT now(),
  ALTER COLUMN created_at SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS baths_tenant_id_uidx
  ON public.baths (tenant_id, id);

CREATE UNIQUE INDEX IF NOT EXISTS app_users_tenant_id_uidx
  ON public.app_users (tenant_id, id);

DO $drop_single_column_bath_fks$
DECLARE
  existing_constraint text;
BEGIN
  FOR existing_constraint IN
    SELECT constraint_record.conname
    FROM pg_constraint constraint_record
    JOIN pg_attribute source_attribute
      ON source_attribute.attrelid = constraint_record.conrelid
     AND source_attribute.attnum = constraint_record.conkey[1]
    WHERE constraint_record.conrelid = 'public.bath_measurements'::regclass
      AND constraint_record.contype = 'f'
      AND cardinality(constraint_record.conkey) = 1
      AND source_attribute.attname IN ('bath_id', 'measured_by', 'measured_by_user_id')
  LOOP
    EXECUTE format(
      'ALTER TABLE public.bath_measurements DROP CONSTRAINT %I',
      existing_constraint
    );
  END LOOP;
END
$drop_single_column_bath_fks$;

DO $tenant_bound_bath_fks$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.bath_measurements'::regclass
      AND conname = 'bath_measurements_tenant_bath_fkey'
  ) THEN
    ALTER TABLE public.bath_measurements
      ADD CONSTRAINT bath_measurements_tenant_bath_fkey
      FOREIGN KEY (tenant_id, bath_id)
      REFERENCES public.baths (tenant_id, id)
      ON DELETE CASCADE
      NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.bath_measurements'::regclass
      AND conname = 'bath_measurements_tenant_actor_fkey'
  ) THEN
    ALTER TABLE public.bath_measurements
      ADD CONSTRAINT bath_measurements_tenant_actor_fkey
      FOREIGN KEY (tenant_id, measured_by_user_id)
      REFERENCES public.app_users (tenant_id, id)
      ON DELETE RESTRICT
      NOT VALID;
  END IF;

  ALTER TABLE public.bath_measurements
    VALIDATE CONSTRAINT bath_measurements_tenant_bath_fkey;

  ALTER TABLE public.bath_measurements
    VALIDATE CONSTRAINT bath_measurements_tenant_actor_fkey;
END
$tenant_bound_bath_fks$;

CREATE INDEX IF NOT EXISTS baths_tenant_status_idx
  ON public.baths (tenant_id, status);

CREATE INDEX IF NOT EXISTS bath_measurements_tenant_bath_measured_idx
  ON public.bath_measurements (tenant_id, bath_id, measured_at DESC);

CREATE INDEX IF NOT EXISTS bath_measurements_tenant_actor_measured_idx
  ON public.bath_measurements (tenant_id, measured_by_user_id, measured_at DESC)
  WHERE measured_by_user_id IS NOT NULL;

CREATE FUNCTION public.bridge_bath_measurement_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $bridge$
DECLARE
  canonical_column text;
  legacy_column text;
  new_record jsonb := to_jsonb(NEW);
  old_record jsonb := CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE '{}'::jsonb END;
  canonical_value jsonb;
  legacy_value jsonb;
  canonical_changed boolean;
  legacy_changed boolean;
BEGIN
  FOR canonical_column, legacy_column IN
    SELECT *
    FROM (
      VALUES
        ('ph_value', 'ph'),
        ('notes', 'note'),
        ('measured_by_user_id', 'measured_by')
    ) AS column_pairs(canonical_name, legacy_name)
  LOOP
    CONTINUE WHEN NOT (
      new_record ? canonical_column
      AND new_record ? legacy_column
    );

    canonical_value := new_record -> canonical_column;
    legacy_value := new_record -> legacy_column;

    IF TG_OP = 'INSERT' THEN
      IF canonical_value IS DISTINCT FROM 'null'::jsonb
         AND legacy_value IS DISTINCT FROM 'null'::jsonb
         AND canonical_value IS DISTINCT FROM legacy_value THEN
        RAISE EXCEPTION USING
          ERRCODE = '23514',
          MESSAGE = 'BATH_MEASUREMENT_DUAL_WRITE_CONFLICT',
          DETAIL = canonical_column || '<->' || legacy_column;
      END IF;

      IF canonical_value = 'null'::jsonb
         AND legacy_value IS DISTINCT FROM 'null'::jsonb THEN
        new_record := jsonb_set(
          new_record,
          ARRAY[canonical_column],
          legacy_value,
          false
        );
      ELSE
        new_record := jsonb_set(
          new_record,
          ARRAY[legacy_column],
          canonical_value,
          false
        );
      END IF;
    ELSE
      canonical_changed :=
        canonical_value IS DISTINCT FROM (old_record -> canonical_column);
      legacy_changed :=
        legacy_value IS DISTINCT FROM (old_record -> legacy_column);

      IF canonical_changed
         AND legacy_changed
         AND canonical_value IS DISTINCT FROM legacy_value THEN
        RAISE EXCEPTION USING
          ERRCODE = '23514',
          MESSAGE = 'BATH_MEASUREMENT_DUAL_WRITE_CONFLICT',
          DETAIL = canonical_column || '<->' || legacy_column;
      ELSIF canonical_changed THEN
        new_record := jsonb_set(
          new_record,
          ARRAY[legacy_column],
          canonical_value,
          false
        );
      ELSIF legacy_changed THEN
        new_record := jsonb_set(
          new_record,
          ARRAY[canonical_column],
          legacy_value,
          false
        );
      ELSIF canonical_value IS DISTINCT FROM legacy_value THEN
        RAISE EXCEPTION USING
          ERRCODE = '23514',
          MESSAGE = 'BATH_MEASUREMENT_DUAL_WRITE_CONFLICT',
          DETAIL = canonical_column || '<->' || legacy_column;
      END IF;
    END IF;
  END LOOP;

  RETURN jsonb_populate_record(NEW, new_record);
END
$bridge$;

CREATE TRIGGER bath_measurements_dual_write_bridge
BEFORE INSERT OR UPDATE ON public.bath_measurements
FOR EACH ROW
EXECUTE FUNCTION public.bridge_bath_measurement_columns();

DO $bath_catalog_verification$
BEGIN
  IF (
    SELECT data_type <> 'text'
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'bath_measurements'
      AND column_name = 'id'
  ) OR NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.bath_measurements'::regclass
      AND conname = 'bath_measurements_tenant_bath_fkey'
      AND contype = 'f'
      AND convalidated
  ) OR NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.bath_measurements'::regclass
      AND conname = 'bath_measurements_tenant_actor_fkey'
      AND contype = 'f'
      AND convalidated
  ) OR NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgrelid = 'public.bath_measurements'::regclass
      AND tgname = 'bath_measurements_dual_write_bridge'
      AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'OPERATIONAL_BATH_CATALOG_VERIFICATION_FAILED';
  END IF;
END
$bath_catalog_verification$;

-- Cross-domain grants and RLS are intentionally absent from this expand-only
-- migration. They are sealed by the dedicated, post-cutover boundary contracts
-- after the final relation inventory is known.
