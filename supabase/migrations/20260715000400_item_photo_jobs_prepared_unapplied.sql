-- APPROVAL REQUIRED - PREPARED, NOT APPLIED BY THIS MISSION.
-- Durable item-photo allocation and exactly-once analysis jobs.
-- Creates a new service-only table and RPCs; no existing policy is modified.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.item_photo_jobs (
  id uuid PRIMARY KEY,
  tenant_id text NOT NULL,
  user_id text NOT NULL,
  order_id text NOT NULL,
  item_id text NOT NULL,
  request_key_hash text NOT NULL,
  content_sha256 text NOT NULL,
  storage_path text NOT NULL,
  mime_type text NOT NULL,
  file_bytes integer NOT NULL,
  status text NOT NULL DEFAULT 'reserved',
  provider_status text,
  actual_units integer,
  analysis_result jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  uploaded_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT item_photo_tenant_fixed CHECK (tenant_id = 'galvanik-kreile'),
  CONSTRAINT item_photo_request_hash CHECK (request_key_hash ~ '^[a-f0-9]{64}$'),
  CONSTRAINT item_photo_content_hash CHECK (content_sha256 ~ '^[a-f0-9]{64}$'),
  CONSTRAINT item_photo_mime_known CHECK (mime_type IN ('image/jpeg', 'image/png', 'image/webp')),
  CONSTRAINT item_photo_file_bytes_bounded CHECK (file_bytes BETWEEN 1 AND 12582912),
  CONSTRAINT item_photo_actual_units_nonnegative CHECK (actual_units IS NULL OR actual_units >= 0),
  CONSTRAINT item_photo_status_known CHECK (
    status IN ('reserved', 'uploaded', 'in_flight', 'succeeded', 'failed', 'uncertain')
  )
);

ALTER TABLE public.item_photo_jobs ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX IF NOT EXISTS uq_item_photo_request
  ON public.item_photo_jobs(tenant_id, user_id, request_key_hash);

CREATE UNIQUE INDEX IF NOT EXISTS uq_item_photo_content
  ON public.item_photo_jobs(tenant_id, item_id, content_sha256);

CREATE INDEX IF NOT EXISTS idx_item_photo_item_created
  ON public.item_photo_jobs(tenant_id, item_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_item_photo_user_created
  ON public.item_photo_jobs(tenant_id, user_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.reserve_item_photo_job(
  p_job_id uuid,
  p_tenant_id text,
  p_user_id text,
  p_order_id text,
  p_item_id text,
  p_request_key_hash text,
  p_content_sha256 text,
  p_storage_path text,
  p_mime_type text,
  p_file_bytes integer,
  p_window_seconds integer,
  p_user_window_limit integer,
  p_item_limit integer,
  p_tenant_daily_bytes_limit bigint,
  p_user_daily_analysis_limit integer,
  p_tenant_daily_analysis_limit integer,
  p_user_concurrent_limit integer,
  p_tenant_concurrent_limit integer
)
RETURNS TABLE(
  allowed boolean,
  job_id uuid,
  replay boolean,
  upload_required boolean,
  job_status text,
  reserved_storage_path text,
  replay_result jsonb,
  retry_after_seconds integer,
  decision_reason text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_now timestamptz := clock_timestamp();
  v_day_start timestamptz;
  v_window_start timestamptz;
  v_existing public.item_photo_jobs%ROWTYPE;
  v_inserted public.item_photo_jobs%ROWTYPE;
  v_item_count bigint;
  v_user_window_count bigint;
  v_tenant_bytes bigint;
  v_user_daily_count bigint;
  v_tenant_daily_count bigint;
  v_user_concurrent bigint;
  v_tenant_concurrent bigint;
  v_reason text;
  v_retry integer := 60;
BEGIN
  IF p_job_id IS NULL
     OR p_tenant_id <> 'galvanik-kreile'
     OR p_user_id IS NULL OR p_user_id !~ '^[A-Za-z0-9_-]{1,128}$'
     OR p_order_id IS NULL OR p_order_id !~ '^[A-Za-z0-9_-]{1,128}$'
     OR p_item_id IS NULL OR p_item_id !~ '^[A-Za-z0-9_-]{1,128}$'
     OR p_request_key_hash IS NULL OR p_request_key_hash !~ '^[a-f0-9]{64}$'
     OR p_content_sha256 IS NULL OR p_content_sha256 !~ '^[a-f0-9]{64}$'
     OR p_storage_path IS NULL OR length(p_storage_path) NOT BETWEEN 20 AND 600
     OR p_storage_path NOT LIKE p_tenant_id || '/' || p_order_id || '/' || p_item_id || '/%'
     OR position(p_job_id::text IN p_storage_path) = 0
     OR p_mime_type IS NULL OR p_mime_type NOT IN ('image/jpeg', 'image/png', 'image/webp')
     OR p_file_bytes IS NULL OR p_file_bytes NOT BETWEEN 1 AND 12582912
     OR p_window_seconds IS NULL OR p_window_seconds NOT BETWEEN 10 AND 3600
     OR p_user_window_limit IS NULL OR p_user_window_limit NOT BETWEEN 1 AND 1000
     OR p_item_limit IS NULL OR p_item_limit NOT BETWEEN 1 AND 100
     OR p_tenant_daily_bytes_limit IS NULL OR p_tenant_daily_bytes_limit NOT BETWEEN 1048576 AND 1099511627776
     OR p_user_daily_analysis_limit IS NULL OR p_user_daily_analysis_limit NOT BETWEEN 1 AND 100000
     OR p_tenant_daily_analysis_limit IS NULL OR p_tenant_daily_analysis_limit NOT BETWEEN 1 AND 1000000
     OR p_user_concurrent_limit IS NULL OR p_user_concurrent_limit NOT BETWEEN 1 AND 100
     OR p_tenant_concurrent_limit IS NULL OR p_tenant_concurrent_limit NOT BETWEEN 1 AND 1000 THEN
    RAISE EXCEPTION 'INVALID_ITEM_PHOTO_POLICY';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('photo:tenant:' || p_tenant_id, 0));
  PERFORM pg_advisory_xact_lock(hashtextextended('photo:item:' || p_tenant_id || ':' || p_item_id, 0));
  PERFORM pg_advisory_xact_lock(hashtextextended('photo:user:' || p_tenant_id || ':' || p_user_id, 0));

  SELECT j.* INTO v_existing
  FROM public.item_photo_jobs j
  WHERE (j.tenant_id = p_tenant_id AND j.user_id = p_user_id AND j.request_key_hash = p_request_key_hash)
     OR (j.tenant_id = p_tenant_id AND j.item_id = p_item_id AND j.content_sha256 = p_content_sha256)
  ORDER BY CASE WHEN j.request_key_hash = p_request_key_hash AND j.user_id = p_user_id THEN 0 ELSE 1 END
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    IF v_existing.user_id <> p_user_id THEN
      RETURN QUERY SELECT false, NULL::uuid, false, false, 'duplicate'::text,
        NULL::text, NULL::jsonb, 0, 'duplicate_content'::text;
    ELSIF v_existing.status = 'succeeded' AND v_existing.analysis_result IS NOT NULL THEN
      RETURN QUERY SELECT true, v_existing.id, true, false, v_existing.status,
        v_existing.storage_path, v_existing.analysis_result, 0, 'replay_result'::text;
    ELSIF v_existing.status = 'reserved' THEN
      RETURN QUERY SELECT true, v_existing.id, true, true, v_existing.status,
        v_existing.storage_path, NULL::jsonb, 0, 'resume_upload'::text;
    ELSIF v_existing.status = 'uploaded' THEN
      RETURN QUERY SELECT true, v_existing.id, true, false, v_existing.status,
        v_existing.storage_path, NULL::jsonb, 0, 'resume_analysis'::text;
    ELSE
      RETURN QUERY SELECT false, v_existing.id, true, false, v_existing.status,
        NULL::text, NULL::jsonb,
        CASE WHEN v_existing.status = 'in_flight' THEN 2 ELSE 0 END,
        CASE WHEN v_existing.status = 'in_flight' THEN 'in_progress' ELSE 'prior_attempt_terminal' END;
    END IF;
    RETURN;
  END IF;

  v_window_start := v_now - make_interval(secs => p_window_seconds);
  v_day_start := date_trunc('day', v_now AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';

  SELECT count(*) INTO v_item_count
  FROM public.item_photo_jobs j
  WHERE j.tenant_id = p_tenant_id AND j.item_id = p_item_id
    AND (j.status <> 'reserved' OR j.created_at >= v_now - interval '15 minutes');

  SELECT count(*) INTO v_user_window_count
  FROM public.item_photo_jobs j
  WHERE j.tenant_id = p_tenant_id AND j.user_id = p_user_id AND j.created_at >= v_window_start;

  SELECT coalesce(sum(j.file_bytes), 0)::bigint INTO v_tenant_bytes
  FROM public.item_photo_jobs j
  WHERE j.tenant_id = p_tenant_id AND j.created_at >= v_day_start;

  SELECT count(*) INTO v_user_daily_count
  FROM public.item_photo_jobs j
  WHERE j.tenant_id = p_tenant_id AND j.user_id = p_user_id AND j.created_at >= v_day_start;

  SELECT count(*) INTO v_tenant_daily_count
  FROM public.item_photo_jobs j
  WHERE j.tenant_id = p_tenant_id AND j.created_at >= v_day_start;

  SELECT count(*) INTO v_user_concurrent
  FROM public.item_photo_jobs j
  WHERE j.tenant_id = p_tenant_id AND j.user_id = p_user_id
    AND (j.status IN ('uploaded', 'in_flight') OR (j.status = 'reserved' AND j.created_at >= v_now - interval '15 minutes'));

  SELECT count(*) INTO v_tenant_concurrent
  FROM public.item_photo_jobs j
  WHERE j.tenant_id = p_tenant_id
    AND (j.status IN ('uploaded', 'in_flight') OR (j.status = 'reserved' AND j.created_at >= v_now - interval '15 minutes'));

  IF v_item_count >= p_item_limit THEN
    v_reason := 'item_limit';
    v_retry := 0;
  ELSIF v_user_window_count >= p_user_window_limit THEN
    v_reason := 'user_window';
    v_retry := p_window_seconds;
  ELSIF v_tenant_bytes + p_file_bytes > p_tenant_daily_bytes_limit THEN
    v_reason := 'tenant_daily_bytes';
    v_retry := greatest(1, ceil(extract(epoch FROM (v_day_start + interval '1 day' - v_now)))::integer);
  ELSIF v_user_daily_count >= p_user_daily_analysis_limit THEN
    v_reason := 'user_daily_analyses';
    v_retry := greatest(1, ceil(extract(epoch FROM (v_day_start + interval '1 day' - v_now)))::integer);
  ELSIF v_tenant_daily_count >= p_tenant_daily_analysis_limit THEN
    v_reason := 'tenant_daily_analyses';
    v_retry := greatest(1, ceil(extract(epoch FROM (v_day_start + interval '1 day' - v_now)))::integer);
  ELSIF v_user_concurrent >= p_user_concurrent_limit THEN
    v_reason := 'user_concurrent';
    v_retry := 2;
  ELSIF v_tenant_concurrent >= p_tenant_concurrent_limit THEN
    v_reason := 'tenant_concurrent';
    v_retry := 2;
  END IF;

  IF v_reason IS NOT NULL THEN
    RETURN QUERY SELECT false, NULL::uuid, false, false, 'rejected'::text,
      NULL::text, NULL::jsonb, v_retry, v_reason;
    RETURN;
  END IF;

  INSERT INTO public.item_photo_jobs (
    id, tenant_id, user_id, order_id, item_id, request_key_hash,
    content_sha256, storage_path, mime_type, file_bytes, status,
    created_at, updated_at
  ) VALUES (
    p_job_id, p_tenant_id, p_user_id, p_order_id, p_item_id, p_request_key_hash,
    p_content_sha256, p_storage_path, p_mime_type, p_file_bytes, 'reserved',
    v_now, v_now
  ) RETURNING * INTO v_inserted;

  RETURN QUERY SELECT true, v_inserted.id, false, true, v_inserted.status,
    v_inserted.storage_path, NULL::jsonb, 0, 'reserved'::text;
END;
$$;

CREATE OR REPLACE FUNCTION public.bind_item_photo_upload(
  p_job_id uuid,
  p_tenant_id text,
  p_user_id text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_status text;
BEGIN
  SELECT j.status INTO v_status
  FROM public.item_photo_jobs j
  WHERE j.id = p_job_id AND j.tenant_id = p_tenant_id AND j.user_id = p_user_id
  FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  IF v_status IN ('uploaded', 'in_flight', 'succeeded') THEN RETURN true; END IF;
  IF v_status <> 'reserved' THEN RETURN false; END IF;
  UPDATE public.item_photo_jobs
  SET status = 'uploaded', uploaded_at = now(), updated_at = now()
  WHERE id = p_job_id;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_item_photo_analysis(p_job_id uuid)
RETURNS TABLE(
  claimed boolean,
  replay boolean,
  job_status text,
  storage_path text,
  mime_type text,
  replay_result jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_job public.item_photo_jobs%ROWTYPE;
BEGIN
  SELECT j.* INTO v_job FROM public.item_photo_jobs j WHERE j.id = p_job_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, false, 'missing'::text, NULL::text, NULL::text, NULL::jsonb;
    RETURN;
  END IF;
  IF v_job.status = 'succeeded' AND v_job.analysis_result IS NOT NULL THEN
    RETURN QUERY SELECT false, true, v_job.status, v_job.storage_path, v_job.mime_type, v_job.analysis_result;
    RETURN;
  END IF;
  IF v_job.status <> 'uploaded' THEN
    RETURN QUERY SELECT false, false, v_job.status, NULL::text, NULL::text, NULL::jsonb;
    RETURN;
  END IF;
  UPDATE public.item_photo_jobs
  SET status = 'in_flight', started_at = now(), updated_at = now()
  WHERE id = v_job.id;
  RETURN QUERY SELECT true, false, 'in_flight'::text, v_job.storage_path, v_job.mime_type, NULL::jsonb;
END;
$$;

CREATE OR REPLACE FUNCTION public.settle_item_photo_analysis(
  p_job_id uuid,
  p_outcome text,
  p_actual_units integer,
  p_provider_status text,
  p_result jsonb
)
RETURNS TABLE(changed boolean, job_status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_job public.item_photo_jobs%ROWTYPE;
BEGIN
  IF p_outcome IS NULL OR p_outcome NOT IN ('succeeded', 'failed', 'uncertain')
     OR (p_actual_units IS NOT NULL AND p_actual_units < 0)
     OR p_provider_status IS NULL OR length(p_provider_status) NOT BETWEEN 1 AND 80
     OR (p_result IS NOT NULL AND octet_length(p_result::text) > 262144)
     OR (p_outcome = 'succeeded' AND p_result IS NULL)
     OR (p_outcome <> 'succeeded' AND p_result IS NOT NULL) THEN
    RAISE EXCEPTION 'INVALID_ITEM_PHOTO_SETTLEMENT';
  END IF;
  SELECT j.* INTO v_job FROM public.item_photo_jobs j WHERE j.id = p_job_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ITEM_PHOTO_JOB_NOT_FOUND'; END IF;
  IF v_job.status IN ('succeeded', 'failed', 'uncertain') THEN
    RETURN QUERY SELECT false, v_job.status;
    RETURN;
  END IF;
  IF v_job.status <> 'in_flight' THEN RAISE EXCEPTION 'ITEM_PHOTO_JOB_NOT_CLAIMED'; END IF;
  UPDATE public.item_photo_jobs
  SET status = p_outcome,
      actual_units = p_actual_units,
      provider_status = p_provider_status,
      analysis_result = p_result,
      completed_at = now(),
      updated_at = now()
  WHERE id = v_job.id;
  RETURN QUERY SELECT true, p_outcome;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_item_photo_uncertain(
  p_job_id uuid,
  p_tenant_id text,
  p_user_id text,
  p_reason text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_reason IS NULL OR length(p_reason) NOT BETWEEN 1 AND 80 THEN
    RAISE EXCEPTION 'INVALID_ITEM_PHOTO_REASON';
  END IF;
  UPDATE public.item_photo_jobs
  SET status = 'uncertain', provider_status = p_reason, completed_at = now(), updated_at = now()
  WHERE id = p_job_id AND tenant_id = p_tenant_id AND user_id = p_user_id
    AND status IN ('reserved', 'uploaded');
  RETURN FOUND;
END;
$$;

REVOKE ALL ON TABLE public.item_photo_jobs FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.reserve_item_photo_job(uuid,text,text,text,text,text,text,text,text,integer,integer,integer,integer,bigint,integer,integer,integer,integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.bind_item_photo_upload(uuid,text,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_item_photo_analysis(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.settle_item_photo_analysis(uuid,text,integer,text,jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mark_item_photo_uncertain(uuid,text,text,text) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.reserve_item_photo_job(uuid,text,text,text,text,text,text,text,text,integer,integer,integer,integer,bigint,integer,integer,integer,integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.bind_item_photo_upload(uuid,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_item_photo_analysis(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.settle_item_photo_analysis(uuid,text,integer,text,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_item_photo_uncertain(uuid,text,text,text) TO service_role;

COMMIT;
