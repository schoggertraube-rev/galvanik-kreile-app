-- K13K-6: these existing columns deliberately contain UTC calendar labels
-- without a timezone. Keep their type and existing values unchanged.
-- An implicit cast from now() uses the connection zone and breaks event order.
DO $clock$
BEGIN
  IF (SELECT count(*) FROM information_schema.columns
      WHERE table_schema='public' AND table_name IN ('events','items','orders')
      AND column_name='created_at' AND data_type='timestamp without time zone')<>3
  THEN RAISE EXCEPTION 'S13K_UTC_CREATED_COLUMN_TYPE_CHANGED'; END IF;
END;
$clock$;
ALTER TABLE public.events ALTER COLUMN created_at SET DEFAULT (statement_timestamp() AT TIME ZONE 'UTC');
ALTER TABLE public.items ALTER COLUMN created_at SET DEFAULT (statement_timestamp() AT TIME ZONE 'UTC');
ALTER TABLE public.orders ALTER COLUMN created_at SET DEFAULT (statement_timestamp() AT TIME ZONE 'UTC');
