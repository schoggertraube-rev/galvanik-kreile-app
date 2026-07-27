-- Server-side Meta publishing ledger with exact item-photo provenance.

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '5min';

DO $required_relations$
BEGIN
  IF to_regclass('public.item_photo_jobs') IS NULL
     OR to_regclass('public.marketing_asset') IS NULL
     OR to_regclass('public.aktion') IS NULL
     OR to_regclass('public.kanal') IS NULL
     OR to_regclass('public.touchpoint') IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '42P01',
      MESSAGE = 'MARKETING_CONNECTOR_RELATIONS_REQUIRED';
  END IF;
END
$required_relations$;

ALTER TABLE public.marketing_asset
  ADD COLUMN IF NOT EXISTS storage_bucket text,
  ADD COLUMN IF NOT EXISTS source_item_photo_job_id uuid,
  ADD COLUMN IF NOT EXISTS source_item_photo_uploaded_at timestamptz;

UPDATE public.marketing_asset
SET freigabe_marketing = false
WHERE freigabe_marketing IS NULL;

ALTER TABLE public.marketing_asset
  ALTER COLUMN freigabe_marketing SET DEFAULT false,
  ALTER COLUMN freigabe_marketing SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS item_photo_jobs_marketing_source_uidx
  ON public.item_photo_jobs (
    tenant_id,
    order_id,
    storage_path,
    id,
    uploaded_at
  );

DO $asset_contract$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.marketing_asset asset
    WHERE asset.storage_bucket IS NOT NULL
      AND asset.storage_bucket <> 'item-photos'
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'MARKETING_ASSET_BUCKET_RECONCILIATION_REQUIRED';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.marketing_asset asset
    WHERE asset.freigabe_marketing IS TRUE
      AND (
        (
          SELECT count(*)
          FROM public.item_photo_jobs source_job
          WHERE source_job.tenant_id = asset.tenant_id
            AND source_job.order_id = asset.auftrag_id
            AND source_job.storage_path = asset.storage_pfad
            AND source_job.uploaded_at IS NOT NULL
        ) <> 1
        OR (
          (asset.source_item_photo_job_id IS NULL)
          <> (asset.source_item_photo_uploaded_at IS NULL)
        )
        OR (
          asset.source_item_photo_job_id IS NOT NULL
          AND NOT EXISTS (
            SELECT 1
            FROM public.item_photo_jobs bound_source
            WHERE bound_source.tenant_id = asset.tenant_id
              AND bound_source.order_id = asset.auftrag_id
              AND bound_source.storage_path = asset.storage_pfad
              AND bound_source.id = asset.source_item_photo_job_id
              AND bound_source.uploaded_at = asset.source_item_photo_uploaded_at
          )
        )
      )
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'MARKETING_ASSET_SOURCE_RECONCILIATION_REQUIRED';
  END IF;

  UPDATE public.marketing_asset asset
  SET storage_bucket = 'item-photos',
      source_item_photo_job_id = source_job.id,
      source_item_photo_uploaded_at = source_job.uploaded_at
  FROM public.item_photo_jobs source_job
  WHERE asset.freigabe_marketing IS TRUE
    AND source_job.tenant_id = asset.tenant_id
    AND source_job.order_id = asset.auftrag_id
    AND source_job.storage_path = asset.storage_pfad
    AND source_job.uploaded_at IS NOT NULL;

  IF EXISTS (
    SELECT 1
    FROM public.marketing_asset asset
    WHERE asset.freigabe_marketing IS TRUE
      AND ((
        asset.storage_bucket = 'item-photos'
        AND asset.auftrag_id IS NOT NULL
        AND length(asset.storage_pfad) BETWEEN 20 AND 1024
        AND left(
          asset.storage_pfad,
          length(asset.tenant_id || '/' || asset.auftrag_id || '/')
        ) = asset.tenant_id || '/' || asset.auftrag_id || '/'
        AND left(asset.storage_pfad, 1) <> '/'
        AND position(E'\\' IN asset.storage_pfad) = 0
        AND position('/../' IN '/' || asset.storage_pfad || '/') = 0
        AND asset.storage_pfad !~ '[[:cntrl:]]'
        AND asset.source_item_photo_job_id IS NOT NULL
        AND asset.source_item_photo_uploaded_at IS NOT NULL
      ) IS NOT TRUE)
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'MARKETING_ASSET_PUBLISH_RECONCILIATION_REQUIRED';
  END IF;

  ALTER TABLE public.marketing_asset
    DROP CONSTRAINT IF EXISTS marketing_asset_storage_bucket_format_chk,
    DROP CONSTRAINT IF EXISTS marketing_asset_storage_publish_path_chk,
    DROP CONSTRAINT IF EXISTS marketing_asset_source_pair_chk,
    DROP CONSTRAINT IF EXISTS marketing_asset_item_photo_source_fkey,
    ADD CONSTRAINT marketing_asset_storage_bucket_format_chk
      CHECK (storage_bucket IS NULL OR storage_bucket = 'item-photos'),
    ADD CONSTRAINT marketing_asset_source_pair_chk CHECK (
      (source_item_photo_job_id IS NULL)
      = (source_item_photo_uploaded_at IS NULL)
    ),
    ADD CONSTRAINT marketing_asset_storage_publish_path_chk
      CHECK (
        freigabe_marketing IS NOT TRUE OR ((
          storage_bucket = 'item-photos'
          AND auftrag_id IS NOT NULL
          AND length(storage_pfad) BETWEEN 20 AND 1024
          AND left(
            storage_pfad,
            length(tenant_id || '/' || auftrag_id || '/')
          ) = tenant_id || '/' || auftrag_id || '/'
          AND left(storage_pfad, 1) <> '/'
          AND position(E'\\' IN storage_pfad) = 0
          AND position('/../' IN '/' || storage_pfad || '/') = 0
          AND storage_pfad !~ '[[:cntrl:]]'
          AND source_item_photo_job_id IS NOT NULL
          AND source_item_photo_uploaded_at IS NOT NULL
        ) IS TRUE)
      ),
    ADD CONSTRAINT marketing_asset_item_photo_source_fkey
      FOREIGN KEY (
        tenant_id,
        auftrag_id,
        storage_pfad,
        source_item_photo_job_id,
        source_item_photo_uploaded_at
      )
      REFERENCES public.item_photo_jobs (
        tenant_id,
        order_id,
        storage_path,
        id,
        uploaded_at
      )
      ON UPDATE RESTRICT
      ON DELETE RESTRICT;
END
$asset_contract$;

CREATE OR REPLACE FUNCTION public.guard_marketing_asset_source_immutable()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $guard$
BEGIN
  IF (
    OLD.freigabe_marketing IS TRUE
    OR OLD.source_item_photo_job_id IS NOT NULL
    OR OLD.source_item_photo_uploaded_at IS NOT NULL
  ) AND ROW(
    NEW.tenant_id,
    NEW.auftrag_id,
    NEW.storage_bucket,
    NEW.storage_pfad,
    NEW.source_item_photo_job_id,
    NEW.source_item_photo_uploaded_at
  ) IS DISTINCT FROM ROW(
    OLD.tenant_id,
    OLD.auftrag_id,
    OLD.storage_bucket,
    OLD.storage_pfad,
    OLD.source_item_photo_job_id,
    OLD.source_item_photo_uploaded_at
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'MARKETING_ASSET_SOURCE_IMMUTABLE';
  END IF;
  RETURN NEW;
END
$guard$;

DROP TRIGGER IF EXISTS marketing_asset_source_immutable
  ON public.marketing_asset;

CREATE TRIGGER marketing_asset_source_immutable
BEFORE UPDATE ON public.marketing_asset
FOR EACH ROW
EXECUTE FUNCTION public.guard_marketing_asset_source_immutable();

DO $preflight$
BEGIN
  IF EXISTS (
    SELECT tenant_id, externe_ref
    FROM public.touchpoint
    WHERE externe_ref IS NOT NULL
    GROUP BY tenant_id, externe_ref
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate touchpoint.externe_ref values must be resolved before connector hardening';
  END IF;
END
$preflight$;

DROP INDEX IF EXISTS public.touchpoint_externe_ref_uidx;
CREATE UNIQUE INDEX touchpoint_externe_ref_uidx
  ON public.touchpoint (tenant_id, externe_ref);

CREATE TABLE IF NOT EXISTS public.marketing_publish_job (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL DEFAULT 'galvanik-kreile',
  aktion_id uuid NOT NULL,
  asset_id uuid NOT NULL,
  kanal_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'reserved',
  external_container_id text,
  external_media_id text,
  attempt_count integer NOT NULL DEFAULT 0,
  claimed_at timestamp without time zone,
  completed_at timestamp without time zone,
  error_code text,
  erstellt_am timestamp without time zone NOT NULL DEFAULT now(),
  aktualisiert_am timestamp without time zone NOT NULL DEFAULT now(),
  CONSTRAINT marketing_publish_job_action_uidx UNIQUE (tenant_id, aktion_id),
  CONSTRAINT marketing_publish_job_status_chk CHECK (
    status IN ('reserved', 'publishing', 'succeeded', 'failed', 'uncertain')
  ),
  CONSTRAINT marketing_publish_job_attempt_count_chk CHECK (attempt_count >= 0),
  CONSTRAINT marketing_publish_job_error_code_chk CHECK (
    error_code IS NULL OR length(error_code) <= 120
  ),
  CONSTRAINT marketing_publish_job_tenant_aktion_fkey
    FOREIGN KEY (tenant_id, aktion_id)
    REFERENCES public.aktion (tenant_id, id) ON DELETE RESTRICT,
  CONSTRAINT marketing_publish_job_tenant_asset_fkey
    FOREIGN KEY (tenant_id, asset_id)
    REFERENCES public.marketing_asset (tenant_id, id) ON DELETE RESTRICT,
  CONSTRAINT marketing_publish_job_tenant_kanal_fkey
    FOREIGN KEY (tenant_id, kanal_id)
    REFERENCES public.kanal (tenant_id, id) ON DELETE RESTRICT,
  CONSTRAINT marketing_publish_job_succeeded_external_refs_chk CHECK (
    status <> 'succeeded' OR (external_container_id IS NOT NULL AND external_media_id IS NOT NULL)
  )
);

ALTER TABLE public.marketing_publish_job
  ADD COLUMN IF NOT EXISTS tenant_id text NOT NULL DEFAULT 'galvanik-kreile';

UPDATE public.marketing_publish_job job
SET tenant_id = action.tenant_id
FROM public.aktion action
WHERE action.id = job.aktion_id
  AND job.tenant_id IS DISTINCT FROM action.tenant_id;

DO $publish_job_state_contract$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.marketing_publish_job
    WHERE status NOT IN ('reserved', 'publishing', 'succeeded', 'failed', 'uncertain')
       OR attempt_count < 0
       OR length(error_code) > 120
       OR (
         status = 'succeeded'
         AND (external_container_id IS NULL OR external_media_id IS NULL)
       )
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'MARKETING_PUBLISH_JOB_STATE_RECONCILIATION_REQUIRED';
  END IF;

  ALTER TABLE public.marketing_publish_job
    DROP CONSTRAINT IF EXISTS marketing_publish_job_status_check,
    DROP CONSTRAINT IF EXISTS marketing_publish_job_attempt_count_check,
    DROP CONSTRAINT IF EXISTS marketing_publish_job_error_code_check,
    DROP CONSTRAINT IF EXISTS marketing_publish_job_status_chk,
    DROP CONSTRAINT IF EXISTS marketing_publish_job_attempt_count_chk,
    DROP CONSTRAINT IF EXISTS marketing_publish_job_error_code_chk,
    DROP CONSTRAINT IF EXISTS marketing_publish_job_succeeded_external_refs_chk,
    ADD CONSTRAINT marketing_publish_job_status_chk CHECK (
      status IN ('reserved', 'publishing', 'succeeded', 'failed', 'uncertain')
    ),
    ADD CONSTRAINT marketing_publish_job_attempt_count_chk CHECK (
      attempt_count >= 0
    ),
    ADD CONSTRAINT marketing_publish_job_error_code_chk CHECK (
      error_code IS NULL OR length(error_code) <= 120
    ),
    ADD CONSTRAINT marketing_publish_job_succeeded_external_refs_chk CHECK (
      status <> 'succeeded'
      OR (external_container_id IS NOT NULL AND external_media_id IS NOT NULL)
    );
END
$publish_job_state_contract$;

DO $publish_job_tenant_preflight$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.marketing_publish_job job
    LEFT JOIN public.aktion action
      ON action.tenant_id = job.tenant_id AND action.id = job.aktion_id
    LEFT JOIN public.marketing_asset asset
      ON asset.tenant_id = job.tenant_id AND asset.id = job.asset_id
    LEFT JOIN public.kanal channel
      ON channel.tenant_id = job.tenant_id AND channel.id = job.kanal_id
    WHERE action.id IS NULL OR asset.id IS NULL OR channel.id IS NULL
  ) THEN
    RAISE EXCEPTION
      'MARKETING_PUBLISH_JOB_TENANT_RECONCILIATION_REQUIRED: invalid or cross-tenant relation';
  END IF;

  ALTER TABLE public.marketing_publish_job
    DROP CONSTRAINT IF EXISTS marketing_publish_job_aktion_id_fkey,
    DROP CONSTRAINT IF EXISTS marketing_publish_job_asset_id_fkey,
    DROP CONSTRAINT IF EXISTS marketing_publish_job_kanal_id_fkey,
    DROP CONSTRAINT IF EXISTS marketing_publish_job_action_uidx,
    DROP CONSTRAINT IF EXISTS marketing_publish_job_tenant_aktion_fkey,
    DROP CONSTRAINT IF EXISTS marketing_publish_job_tenant_asset_fkey,
    DROP CONSTRAINT IF EXISTS marketing_publish_job_tenant_kanal_fkey,
    ADD CONSTRAINT marketing_publish_job_action_uidx
      UNIQUE (tenant_id, aktion_id),
    ADD CONSTRAINT marketing_publish_job_tenant_aktion_fkey
      FOREIGN KEY (tenant_id, aktion_id)
      REFERENCES public.aktion (tenant_id, id) ON DELETE RESTRICT,
    ADD CONSTRAINT marketing_publish_job_tenant_asset_fkey
      FOREIGN KEY (tenant_id, asset_id)
      REFERENCES public.marketing_asset (tenant_id, id) ON DELETE RESTRICT,
    ADD CONSTRAINT marketing_publish_job_tenant_kanal_fkey
      FOREIGN KEY (tenant_id, kanal_id)
      REFERENCES public.kanal (tenant_id, id) ON DELETE RESTRICT;
END
$publish_job_tenant_preflight$;

DROP INDEX IF EXISTS public.marketing_publish_job_status_idx;

CREATE INDEX IF NOT EXISTS marketing_publish_job_tenant_status_idx
  ON public.marketing_publish_job (tenant_id, status, claimed_at);

ALTER TABLE public.marketing_publish_job ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_publish_job FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.marketing_publish_job FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.marketing_publish_job TO service_role;

DO $verification$
DECLARE
  browser_grants integer;
  delete_grants integer;
BEGIN
  SELECT count(*) INTO browser_grants
  FROM information_schema.role_table_grants
  WHERE table_schema = 'public'
    AND table_name = 'marketing_publish_job'
    AND grantee IN ('anon', 'authenticated');
  IF browser_grants <> 0 THEN
    RAISE EXCEPTION 'Marketing publish ledger still exposes % browser grants', browser_grants;
  END IF;

  SELECT count(*) INTO delete_grants
  FROM information_schema.role_table_grants
  WHERE table_schema = 'public'
    AND table_name = 'marketing_publish_job'
    AND grantee = 'service_role'
    AND privilege_type = 'DELETE';
  IF delete_grants <> 0 THEN
    RAISE EXCEPTION 'Marketing publish ledger unexpectedly grants DELETE';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'marketing_publish_job'
      AND c.relrowsecurity
      AND c.relforcerowsecurity
  ) THEN
    RAISE EXCEPTION 'Marketing publish ledger must use forced RLS';
  END IF;

  IF (
    SELECT count(*) <> 6
    FROM pg_constraint
    WHERE conrelid IN (
      'public.marketing_asset'::regclass,
      'public.marketing_publish_job'::regclass
    )
      AND conname IN (
        'marketing_asset_source_pair_chk',
        'marketing_asset_storage_publish_path_chk',
        'marketing_asset_item_photo_source_fkey',
        'marketing_publish_job_status_chk',
        'marketing_publish_job_attempt_count_chk',
        'marketing_publish_job_error_code_chk'
      )
  ) OR NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgrelid = 'public.marketing_asset'::regclass
      AND tgname = 'marketing_asset_source_immutable'
      AND NOT tgisinternal
  ) OR EXISTS (
    SELECT 1
    FROM pg_proc function_record
    JOIN pg_namespace namespace_record
      ON namespace_record.oid = function_record.pronamespace
    WHERE namespace_record.nspname = 'public'
      AND function_record.proname = 'guard_marketing_asset_source_immutable'
      AND function_record.prosecdef
  ) OR NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'item_photo_jobs_marketing_source_uidx'
  ) THEN
    RAISE EXCEPTION 'Marketing source provenance catalog verification failed';
  END IF;
END
$verification$;
