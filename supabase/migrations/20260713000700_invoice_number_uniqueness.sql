-- REMOTE WAVE 1: explicitly approved 2026-07-26; use only the reviewed atomic runner.
-- Productive invoice numbers are business identities and must be unique inside
-- the tenant. Historical is_demo fixtures are not accounting identities.

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '5min';

DO $validation$
BEGIN
  IF to_regclass('public.ausgangsrechnung') IS NULL THEN
    RAISE EXCEPTION 'Required table public.ausgangsrechnung is missing';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'ausgangsrechnung'
      AND column_name = 'is_demo'
      AND data_type = 'boolean'
  ) THEN
    RAISE EXCEPTION 'Required boolean column public.ausgangsrechnung.is_demo is missing';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM public.ausgangsrechnung
    WHERE is_demo IS DISTINCT FROM TRUE
    GROUP BY tenant_id, nummer
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate productive invoice numbers must be resolved before applying this migration';
  END IF;
END
$validation$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_ausgangsrechnung_tenant_nummer
  ON public.ausgangsrechnung (tenant_id, nummer)
  WHERE is_demo IS DISTINCT FROM TRUE;

DO $verification$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_index index_row
    JOIN pg_class index_relation ON index_relation.oid = index_row.indexrelid
    JOIN pg_am access_method ON access_method.oid = index_relation.relam
    WHERE index_row.indrelid = 'public.ausgangsrechnung'::regclass
      AND index_relation.relname = 'uq_ausgangsrechnung_tenant_nummer'
      AND access_method.amname = 'btree'
      AND index_row.indisunique
      AND index_row.indisvalid
      AND index_row.indisready
      AND index_row.indnkeyatts = 2
      AND index_row.indnatts = 2
      AND index_row.indexprs IS NULL
      AND NOT index_row.indnullsnotdistinct
      AND NOT EXISTS (
        SELECT 1
        FROM unnest(index_row.indoption) AS option_value
        WHERE option_value <> 0
      )
      AND (
        SELECT array_agg(attribute.attname::text ORDER BY key.ordinality)
        FROM unnest(index_row.indkey) WITH ORDINALITY AS key(attnum, ordinality)
        JOIN pg_attribute attribute
          ON attribute.attrelid = index_row.indrelid
         AND attribute.attnum = key.attnum
      ) = ARRAY['tenant_id', 'nummer']::text[]
      AND index_row.indpred IS NOT NULL
      AND pg_get_expr(index_row.indpred, index_row.indrelid)
        = '(is_demo IS DISTINCT FROM true)'
  ) THEN
    RAISE EXCEPTION 'Productive invoice number uniqueness index verification failed';
  END IF;
END
$verification$;
