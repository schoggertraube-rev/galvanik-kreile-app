-- PREPARED ONLY: do not apply remotely without explicit approval.
-- Server-side Meta publishing ledger and approved storage reference.

ALTER TABLE public.marketing_asset
  ADD COLUMN storage_bucket text;

ALTER TABLE public.marketing_asset
  ADD CONSTRAINT marketing_asset_storage_bucket_format_chk
  CHECK (
    storage_bucket IS NULL OR
    storage_bucket ~ '^[a-z0-9][a-z0-9._-]{1,62}$'
  );

DO $preflight$
BEGIN
  IF EXISTS (
    SELECT externe_ref
    FROM public.touchpoint
    WHERE externe_ref IS NOT NULL
    GROUP BY externe_ref
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate touchpoint.externe_ref values must be resolved before connector hardening';
  END IF;
END
$preflight$;

CREATE UNIQUE INDEX touchpoint_externe_ref_uidx
  ON public.touchpoint (externe_ref);

CREATE TABLE public.marketing_publish_job (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aktion_id uuid NOT NULL REFERENCES public.aktion(id),
  asset_id uuid NOT NULL REFERENCES public.marketing_asset(id),
  kanal_id uuid NOT NULL REFERENCES public.kanal(id),
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
  CONSTRAINT marketing_publish_job_action_uidx UNIQUE (aktion_id),
  CONSTRAINT marketing_publish_job_succeeded_external_refs_chk CHECK (
    status <> 'succeeded' OR (external_container_id IS NOT NULL AND external_media_id IS NOT NULL)
  )
);

CREATE INDEX marketing_publish_job_status_idx
  ON public.marketing_publish_job (status, claimed_at);

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
