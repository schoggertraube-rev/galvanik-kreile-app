-- PREPARED ONLY: do not apply remotely without explicit approval.
-- Adds durable bath audit fields and removes direct client privileges from
-- foundation tables now served exclusively through authorized server paths.

BEGIN;

DO $bath_columns$
BEGIN
  IF to_regclass('public.baths') IS NOT NULL THEN
    ALTER TABLE public.baths
      ADD COLUMN IF NOT EXISTS tenant_id varchar(50),
      ADD COLUMN IF NOT EXISTS notes text;

    UPDATE public.baths
    SET tenant_id = 'galvanik-kreile'
    WHERE tenant_id IS NULL;

    ALTER TABLE public.baths
      ALTER COLUMN tenant_id SET DEFAULT 'galvanik-kreile',
      ALTER COLUMN tenant_id SET NOT NULL,
      ALTER COLUMN status SET DEFAULT 'not_evaluated';
  END IF;

  IF to_regclass('public.bath_measurements') IS NOT NULL THEN
    ALTER TABLE public.bath_measurements
      ADD COLUMN IF NOT EXISTS status_after_measurement varchar(50),
      ADD COLUMN IF NOT EXISTS measured_by_user_id text;

    UPDATE public.bath_measurements
    SET status_after_measurement = 'not_evaluated'
    WHERE status_after_measurement IS NULL OR btrim(status_after_measurement) = '';

    ALTER TABLE public.bath_measurements
      ALTER COLUMN status_after_measurement SET DEFAULT 'not_evaluated',
      ALTER COLUMN status_after_measurement SET NOT NULL;
  END IF;
END
$bath_columns$;

DO $migration$
BEGIN
  IF to_regclass('public.bath_measurements') IS NOT NULL
     AND to_regclass('public.app_users') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM pg_constraint
       WHERE conname = 'bath_measurements_measured_by_user_id_fkey'
         AND conrelid = to_regclass('public.bath_measurements')
     ) THEN
    ALTER TABLE public.bath_measurements
      ADD CONSTRAINT bath_measurements_measured_by_user_id_fkey
      FOREIGN KEY (measured_by_user_id)
      REFERENCES public.app_users(id)
      ON DELETE RESTRICT;
  END IF;
END
$migration$;

DO $bath_indexes$
BEGIN
  IF to_regclass('public.baths') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS baths_tenant_status_idx
      ON public.baths (tenant_id, status);
  END IF;

  IF to_regclass('public.bath_measurements') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS bath_measurements_tenant_bath_measured_idx
      ON public.bath_measurements (tenant_id, bath_id, measured_at DESC);
    CREATE INDEX IF NOT EXISTS bath_measurements_actor_idx
      ON public.bath_measurements (measured_by_user_id)
      WHERE measured_by_user_id IS NOT NULL;
  END IF;
END
$bath_indexes$;

DO $boundary$
DECLARE
  relation_name text;
  client_role text;
  protected_relations constant text[] := ARRAY[
    'baths',
    'bath_measurements',
    'inquiries',
    'kvp_items',
    'price_agreements',
    'complaints',
    'lager_artikel',
    'inventory_items',
    'stock_movements',
    'company_settings',
    'customer_marketing_profiles',
    'marketing_campaigns',
    'marketing_activities',
    'email_deliveries',
    'usage_telemetry',
    'developer_feedback',
    'operational_events',
    'period_closes'
  ];
  client_roles constant text[] := ARRAY['anon', 'authenticated'];
BEGIN
  FOREACH relation_name IN ARRAY protected_relations LOOP
    IF to_regclass(format('public.%I', relation_name)) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', relation_name);
      EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE public.%I FROM PUBLIC', relation_name);

      FOREACH client_role IN ARRAY client_roles LOOP
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = client_role) THEN
          EXECUTE format(
            'REVOKE ALL PRIVILEGES ON TABLE public.%I FROM %I',
            relation_name,
            client_role
          );
        END IF;
      END LOOP;
    END IF;
  END LOOP;
END
$boundary$;

COMMIT;
