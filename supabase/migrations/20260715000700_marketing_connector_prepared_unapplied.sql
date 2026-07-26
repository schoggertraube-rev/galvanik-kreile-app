-- PREPARED ONLY: do not apply remotely without explicit approval.
-- Server-side Meta publishing ledger and approved storage reference.

ALTER TABLE public.marketing_asset
  ADD COLUMN IF NOT EXISTS storage_bucket text;

DO $asset_contract$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.marketing_asset
    WHERE freigabe_marketing
      AND (
        storage_bucket IS DISTINCT FROM 'item-photos'
        OR auftrag_id IS NULL
        OR length(storage_pfad) NOT BETWEEN 20 AND 1024
        OR left(
          storage_pfad,
          length(tenant_id || '/' || auftrag_id || '/')
        ) <> tenant_id || '/' || auftrag_id || '/'
        OR left(storage_pfad, 1) = '/'
        OR position(E'\\' IN storage_pfad) > 0
        OR position('/../' IN '/' || storage_pfad || '/') > 0
        OR storage_pfad ~ '[[:cntrl:]]'
      )
  ) THEN
    RAISE EXCEPTION
      'MARKETING_ASSET_RECONCILIATION_REQUIRED: approved asset lacks a tenant/order-bound item-photo source';
  END IF;

  ALTER TABLE public.marketing_asset
    DROP CONSTRAINT IF EXISTS marketing_asset_storage_bucket_format_chk,
    DROP CONSTRAINT IF EXISTS marketing_asset_storage_publish_path_chk,
    ADD CONSTRAINT marketing_asset_storage_bucket_format_chk
      CHECK (storage_bucket IS NULL OR storage_bucket = 'item-photos'),
    ADD CONSTRAINT marketing_asset_storage_publish_path_chk
      CHECK (
        freigabe_marketing IS NOT TRUE OR (
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
        )
      );
END
$asset_contract$;

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
  status text NOT NULL DEFAULT 'reserved'
    CHECK (status IN ('reserved', 'publishing', 'succeeded', 'failed', 'uncertain')),
  external_container_id text,
  external_media_id text,
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  claimed_at timestamp without time zone,
  completed_at timestamp without time zone,
  error_code text CHECK (error_code IS NULL OR length(error_code) <= 120),
  erstellt_am timestamp without time zone NOT NULL DEFAULT now(),
  aktualisiert_am timestamp without time zone NOT NULL DEFAULT now(),
  CONSTRAINT marketing_publish_job_action_uidx UNIQUE (tenant_id, aktion_id),
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
END
$verification$;
