-- REMOTE WAVE 1: explicitly approved 2026-07-26; use only the reviewed atomic runner.
-- Durable item-photo allocation and exactly-once analysis jobs.
-- Creates a new service-only table and RPCs; no existing policy is modified.

SET lock_timeout = '5s';
SET statement_timeout = '5min';

CREATE UNIQUE INDEX IF NOT EXISTS orders_tenant_id_uidx
  ON public.orders (tenant_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS items_tenant_order_id_uidx
  ON public.items (tenant_id, order_id, id);

CREATE TABLE public.item_photo_jobs (
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
  ),
  CONSTRAINT item_photo_tenant_order_fkey
    FOREIGN KEY (tenant_id, order_id)
    REFERENCES public.orders (tenant_id, id)
    ON DELETE RESTRICT,
  CONSTRAINT item_photo_tenant_order_item_fkey
    FOREIGN KEY (tenant_id, order_id, item_id)
    REFERENCES public.items (tenant_id, order_id, id)
    ON DELETE RESTRICT
);

ALTER TABLE public.item_photo_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.item_photo_jobs FORCE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX uq_item_photo_request
  ON public.item_photo_jobs(tenant_id, user_id, request_key_hash);

CREATE UNIQUE INDEX uq_item_photo_content
  ON public.item_photo_jobs(tenant_id, item_id, content_sha256);

CREATE INDEX idx_item_photo_item_created
  ON public.item_photo_jobs(tenant_id, item_id, created_at DESC);

CREATE INDEX idx_item_photo_user_created
  ON public.item_photo_jobs(tenant_id, user_id, created_at DESC);

CREATE FUNCTION public.reserve_item_photo_job(
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
SET search_path = pg_catalog, public, pg_temp
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

  PERFORM 1
  FROM public.orders order_record
  JOIN public.items item_record
    ON item_record.tenant_id = order_record.tenant_id
   AND item_record.order_id = order_record.id
  JOIN public.app_users user_record
    ON user_record.tenant_id = order_record.tenant_id
   AND user_record.id::text = p_user_id
  WHERE order_record.tenant_id = p_tenant_id
    AND order_record.id = p_order_id
    AND item_record.id = p_item_id
    AND user_record.active
  FOR SHARE OF order_record, item_record, user_record;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ITEM_PHOTO_CONTEXT_NOT_FOUND';
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

CREATE FUNCTION public.bind_item_photo_upload(
  p_job_id uuid,
  p_tenant_id text,
  p_user_id text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
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

CREATE FUNCTION public.claim_item_photo_analysis(p_job_id uuid)
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
SET search_path = pg_catalog, public, pg_temp
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

CREATE FUNCTION public.settle_item_photo_analysis(
  p_job_id uuid,
  p_outcome text,
  p_actual_units integer,
  p_provider_status text,
  p_result jsonb
)
RETURNS TABLE(changed boolean, job_status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
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

CREATE FUNCTION public.mark_item_photo_uncertain(
  p_job_id uuid,
  p_tenant_id text,
  p_user_id text,
  p_reason text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
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
REVOKE ALL ON FUNCTION public.reserve_item_photo_job(uuid,text,text,text,text,text,text,text,text,integer,integer,integer,integer,bigint,integer,integer,integer,integer) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.bind_item_photo_upload(uuid,text,text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.claim_item_photo_analysis(uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.settle_item_photo_analysis(uuid,text,integer,text,jsonb) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.mark_item_photo_uncertain(uuid,text,text,text) FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.reserve_item_photo_job(uuid,text,text,text,text,text,text,text,text,integer,integer,integer,integer,bigint,integer,integer,integer,integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.bind_item_photo_upload(uuid,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_item_photo_analysis(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.settle_item_photo_analysis(uuid,text,integer,text,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_item_photo_uncertain(uuid,text,text,text) TO service_role;

DO $verification$
DECLARE
  table_oid oid := to_regclass('public.item_photo_jobs');
  database_owner oid;
  service_role_oid oid := to_regrole('service_role');
  index_name text;
  relation_name text;
  expected_unique boolean;
  expected_keys text[];
  expected_options smallint[];
  index_record record;
BEGIN
  SELECT datdba
  INTO database_owner
  FROM pg_database
  WHERE datname = current_database();

  IF table_oid IS NULL OR database_owner IS NULL OR service_role_oid IS NULL THEN
    RAISE EXCEPTION 'ITEM_PHOTO_VERIFICATION_FAILED: required identity missing';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_roles
    WHERE oid = service_role_oid
      AND (
        rolsuper
        OR NOT rolbypassrls
        OR rolcanlogin
        OR rolcreaterole
        OR rolcreatedb
        OR rolreplication
      )
  ) OR has_table_privilege(service_role_oid, table_oid, 'SELECT')
     OR has_table_privilege(service_role_oid, table_oid, 'INSERT')
     OR has_table_privilege(service_role_oid, table_oid, 'UPDATE')
     OR has_table_privilege(service_role_oid, table_oid, 'DELETE')
     OR has_table_privilege(service_role_oid, table_oid, 'TRUNCATE')
     OR has_table_privilege(service_role_oid, table_oid, 'REFERENCES')
     OR has_table_privilege(service_role_oid, table_oid, 'TRIGGER')
     OR has_table_privilege(service_role_oid, table_oid, 'MAINTAIN')
     OR has_any_column_privilege(service_role_oid, table_oid, 'SELECT')
     OR has_any_column_privilege(service_role_oid, table_oid, 'INSERT')
     OR has_any_column_privilege(service_role_oid, table_oid, 'UPDATE')
     OR has_any_column_privilege(service_role_oid, table_oid, 'REFERENCES') THEN
    RAISE EXCEPTION 'ITEM_PHOTO_VERIFICATION_FAILED: service role contract drift';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_class relation_record
    WHERE relation_record.oid = table_oid
      AND relation_record.relkind = 'r'
      AND relation_record.relowner = database_owner
      AND relation_record.relrowsecurity
      AND relation_record.relforcerowsecurity
  ) OR EXISTS (
    SELECT 1
    FROM pg_policy
    WHERE polrelid = table_oid
  ) THEN
    RAISE EXCEPTION 'ITEM_PHOTO_VERIFICATION_FAILED: relation or RLS drift';
  END IF;

  IF EXISTS (
    WITH expected(
      ordinal_position,
      column_name,
      formatted_type,
      is_not_null,
      default_expression
    ) AS (
      VALUES
        (1,  'id',                       'uuid',                     true,  '<none>'),
        (2,  'tenant_id',                'text',                     true,  '<none>'),
        (3,  'user_id',                  'text',                     true,  '<none>'),
        (4,  'order_id',                 'text',                     true,  '<none>'),
        (5,  'item_id',                  'text',                     true,  '<none>'),
        (6,  'request_key_hash',         'text',                     true,  '<none>'),
        (7,  'content_sha256',           'text',                     true,  '<none>'),
        (8,  'storage_path',             'text',                     true,  '<none>'),
        (9,  'mime_type',                'text',                     true,  '<none>'),
        (10, 'file_bytes',               'integer',                  true,  '<none>'),
        (11, 'status',                   'text',                     true,  '''reserved''::text'),
        (12, 'provider_status',          'text',                     false, '<none>'),
        (13, 'actual_units',             'integer',                  false, '<none>'),
        (14, 'analysis_result',          'jsonb',                    false, '<none>'),
        (15, 'created_at',               'timestamp with time zone', true,  'now()'),
        (16, 'uploaded_at',              'timestamp with time zone', false, '<none>'),
        (17, 'started_at',               'timestamp with time zone', false, '<none>'),
        (18, 'completed_at',             'timestamp with time zone', false, '<none>'),
        (19, 'updated_at',               'timestamp with time zone', true,  'now()')
    ),
    actual AS (
      SELECT
        attribute.attnum::integer AS ordinal_position,
        attribute.attname::text AS column_name,
        format_type(attribute.atttypid, attribute.atttypmod) AS formatted_type,
        attribute.attnotnull AS is_not_null,
        coalesce(pg_get_expr(default_record.adbin, default_record.adrelid), '<none>') AS default_expression
      FROM pg_attribute attribute
      LEFT JOIN pg_attrdef default_record
        ON default_record.adrelid = attribute.attrelid
       AND default_record.adnum = attribute.attnum
      WHERE attribute.attrelid = table_oid
        AND attribute.attnum > 0
        AND NOT attribute.attisdropped
    ),
    drift AS (
      (SELECT * FROM actual EXCEPT SELECT * FROM expected)
      UNION ALL
      (SELECT * FROM expected EXCEPT SELECT * FROM actual)
    )
    SELECT 1 FROM drift
  ) THEN
    RAISE EXCEPTION 'ITEM_PHOTO_VERIFICATION_FAILED: column contract drift';
  END IF;

  IF (
    SELECT count(*)
    FROM pg_constraint
    WHERE conrelid = table_oid
  ) <> 10 OR EXISTS (
    SELECT 1
    FROM (
      VALUES
        ('item_photo_jobs_pkey', 'p'),
        ('item_photo_tenant_fixed', 'c'),
        ('item_photo_request_hash', 'c'),
        ('item_photo_content_hash', 'c'),
        ('item_photo_mime_known', 'c'),
        ('item_photo_file_bytes_bounded', 'c'),
        ('item_photo_actual_units_nonnegative', 'c'),
        ('item_photo_status_known', 'c'),
        ('item_photo_tenant_order_fkey', 'f'),
        ('item_photo_tenant_order_item_fkey', 'f')
    ) AS expected(constraint_name, constraint_type)
    WHERE NOT EXISTS (
      SELECT 1
      FROM pg_constraint constraint_record
      WHERE constraint_record.conrelid = table_oid
        AND constraint_record.conname = expected.constraint_name
        AND constraint_record.contype::text = expected.constraint_type
        AND constraint_record.convalidated
        AND NOT constraint_record.condeferrable
        AND NOT constraint_record.condeferred
    )
  ) THEN
    RAISE EXCEPTION 'ITEM_PHOTO_VERIFICATION_FAILED: constraint contract drift';
  END IF;

  FOR relation_name, index_name, expected_unique, expected_keys, expected_options IN
    SELECT *
    FROM (
      VALUES
        ('orders',          'orders_tenant_id_uidx',            true,  ARRAY['tenant_id', 'id']::text[],                         ARRAY[0, 0]::smallint[]),
        ('items',           'items_tenant_order_id_uidx',       true,  ARRAY['tenant_id', 'order_id', 'id']::text[],             ARRAY[0, 0, 0]::smallint[]),
        ('item_photo_jobs', 'item_photo_jobs_pkey',             true,  ARRAY['id']::text[],                                      ARRAY[0]::smallint[]),
        ('item_photo_jobs', 'uq_item_photo_request',            true,  ARRAY['tenant_id', 'user_id', 'request_key_hash']::text[], ARRAY[0, 0, 0]::smallint[]),
        ('item_photo_jobs', 'uq_item_photo_content',            true,  ARRAY['tenant_id', 'item_id', 'content_sha256']::text[],   ARRAY[0, 0, 0]::smallint[]),
        ('item_photo_jobs', 'idx_item_photo_item_created',      false, ARRAY['tenant_id', 'item_id', 'created_at']::text[],       ARRAY[0, 0, 3]::smallint[]),
        ('item_photo_jobs', 'idx_item_photo_user_created',      false, ARRAY['tenant_id', 'user_id', 'created_at']::text[],       ARRAY[0, 0, 3]::smallint[])
    ) AS expected(relation_name, index_name, is_unique, key_names, key_options)
  LOOP
    SELECT
      index_catalog.*,
      access_method.amname,
      ARRAY(
        SELECT attribute.attname::text
        FROM unnest(index_catalog.indkey) WITH ORDINALITY AS key(attnum, ordinality)
        JOIN pg_attribute attribute
          ON attribute.attrelid = index_catalog.indrelid
         AND attribute.attnum = key.attnum
        ORDER BY key.ordinality
      ) AS key_names,
      ARRAY(
        SELECT option_value
        FROM unnest(index_catalog.indoption) AS option_value
      ) AS key_options
    INTO index_record
    FROM pg_index index_catalog
    JOIN pg_class index_relation ON index_relation.oid = index_catalog.indexrelid
    JOIN pg_class table_relation ON table_relation.oid = index_catalog.indrelid
    JOIN pg_namespace namespace_record ON namespace_record.oid = table_relation.relnamespace
    JOIN pg_am access_method ON access_method.oid = index_relation.relam
    WHERE namespace_record.nspname = 'public'
      AND table_relation.relname = relation_name
      AND index_relation.relname = index_name;

    IF NOT FOUND
       OR index_record.amname <> 'btree'
       OR index_record.indisunique IS DISTINCT FROM expected_unique
       OR NOT index_record.indisvalid
       OR NOT index_record.indisready
       OR NOT index_record.indislive
       OR index_record.indpred IS NOT NULL
       OR index_record.indexprs IS NOT NULL
       OR index_record.indnkeyatts <> cardinality(expected_keys)
       OR index_record.indnatts <> cardinality(expected_keys)
       OR index_record.indnullsnotdistinct
       OR index_record.key_names IS DISTINCT FROM expected_keys
       OR index_record.key_options IS DISTINCT FROM expected_options THEN
      RAISE EXCEPTION 'ITEM_PHOTO_VERIFICATION_FAILED: index contract drift for %', index_name;
    END IF;
  END LOOP;

  IF EXISTS (
    SELECT 1
    FROM pg_class relation_record
    CROSS JOIN LATERAL aclexplode(
      coalesce(relation_record.relacl, acldefault('r', relation_record.relowner))
    ) acl_entry
    WHERE relation_record.oid = table_oid
      AND acl_entry.grantee <> database_owner
  ) OR EXISTS (
    SELECT 1
    FROM pg_attribute attribute
    CROSS JOIN LATERAL aclexplode(attribute.attacl) acl_entry
    WHERE attribute.attrelid = table_oid
      AND attribute.attnum > 0
      AND NOT attribute.attisdropped
      AND attribute.attacl IS NOT NULL
      AND acl_entry.grantee <> database_owner
  ) THEN
    RAISE EXCEPTION 'ITEM_PHOTO_VERIFICATION_FAILED: table or column ACL drift';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_roles role_record
    WHERE role_record.oid NOT IN (database_owner, service_role_oid)
      AND NOT role_record.rolsuper
      AND (
        (
          role_record.rolname NOT IN ('pg_write_all_data', 'pg_maintain')
          AND (
            has_table_privilege(role_record.oid, table_oid, 'INSERT')
            OR has_table_privilege(role_record.oid, table_oid, 'UPDATE')
            OR has_table_privilege(role_record.oid, table_oid, 'DELETE')
            OR has_table_privilege(role_record.oid, table_oid, 'TRUNCATE')
            OR has_table_privilege(role_record.oid, table_oid, 'REFERENCES')
            OR has_table_privilege(role_record.oid, table_oid, 'TRIGGER')
            OR has_table_privilege(role_record.oid, table_oid, 'MAINTAIN')
            OR has_any_column_privilege(role_record.oid, table_oid, 'INSERT')
            OR has_any_column_privilege(role_record.oid, table_oid, 'UPDATE')
            OR has_any_column_privilege(role_record.oid, table_oid, 'REFERENCES')
          )
        )
        OR (
          role_record.rolname <> 'pg_read_all_data'
          AND (
            has_table_privilege(role_record.oid, table_oid, 'SELECT')
            OR has_any_column_privilege(role_record.oid, table_oid, 'SELECT')
          )
          AND NOT (
            pg_has_role(role_record.oid, 'pg_read_all_data', 'USAGE')
            AND NOT pg_has_role(role_record.oid, 'pg_write_all_data', 'USAGE')
            AND (
              (
                role_record.rolname = 'supabase_etl_admin'
                AND role_record.rolcanlogin
                AND role_record.rolinherit
                AND role_record.rolbypassrls
                AND role_record.rolreplication
                AND NOT role_record.rolcreaterole
                AND NOT role_record.rolcreatedb
                AND role_record.rolconfig IS NULL
              )
              OR (
                role_record.rolname = 'supabase_read_only_user'
                AND role_record.rolcanlogin
                AND role_record.rolinherit
                AND role_record.rolbypassrls
                AND NOT role_record.rolreplication
                AND NOT role_record.rolcreaterole
                AND NOT role_record.rolcreatedb
                AND role_record.rolconfig = ARRAY['default_transaction_read_only=on']
              )
            )
          )
        )
      )
  ) THEN
    RAISE EXCEPTION 'ITEM_PHOTO_VERIFICATION_FAILED: unexpected effective role access detected';
  END IF;

  IF EXISTS (
    WITH expected(signature, result_contract, returns_set) AS (
      VALUES
        (
          'reserve_item_photo_job(uuid,text,text,text,text,text,text,text,text,integer,integer,integer,integer,bigint,integer,integer,integer,integer)',
          'TABLE(allowed boolean, job_id uuid, replay boolean, upload_required boolean, job_status text, reserved_storage_path text, replay_result jsonb, retry_after_seconds integer, decision_reason text)',
          true
        ),
        ('bind_item_photo_upload(uuid,text,text)', 'boolean', false),
        (
          'claim_item_photo_analysis(uuid)',
          'TABLE(claimed boolean, replay boolean, job_status text, storage_path text, mime_type text, replay_result jsonb)',
          true
        ),
        ('settle_item_photo_analysis(uuid,text,integer,text,jsonb)', 'TABLE(changed boolean, job_status text)', true),
        ('mark_item_photo_uncertain(uuid,text,text,text)', 'boolean', false)
    ),
    actual AS (
      SELECT
        procedure_record.oid,
        procedure_record.oid::regprocedure::text AS signature,
        pg_get_function_result(procedure_record.oid) AS result_contract,
        procedure_record.proowner,
        procedure_record.prosecdef,
        procedure_record.prokind,
        procedure_record.provolatile,
        procedure_record.proparallel,
        procedure_record.proleakproof,
        procedure_record.proisstrict,
        procedure_record.proretset,
        procedure_record.pronargdefaults,
        procedure_record.provariadic,
        procedure_record.proconfig,
        language_record.lanname
      FROM pg_proc procedure_record
      JOIN pg_namespace namespace_record ON namespace_record.oid = procedure_record.pronamespace
      JOIN pg_language language_record ON language_record.oid = procedure_record.prolang
      WHERE namespace_record.nspname = 'public'
        AND procedure_record.proname IN (
          'reserve_item_photo_job',
          'bind_item_photo_upload',
          'claim_item_photo_analysis',
          'settle_item_photo_analysis',
          'mark_item_photo_uncertain'
        )
    ),
    drift AS (
      SELECT actual.oid
      FROM actual
      LEFT JOIN expected
        ON expected.signature = actual.signature
       AND expected.result_contract = actual.result_contract
       AND expected.returns_set = actual.proretset
      WHERE expected.signature IS NULL
         OR actual.proowner <> database_owner
         OR NOT actual.prosecdef
         OR actual.prokind <> 'f'
         OR actual.provolatile <> 'v'
         OR actual.proparallel <> 'u'
         OR actual.proleakproof
         OR actual.proisstrict
         OR actual.pronargdefaults <> 0
         OR actual.provariadic <> 0
         OR actual.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog, public, pg_temp']
         OR actual.lanname <> 'plpgsql'
      UNION ALL
      SELECT NULL::oid
      FROM expected
      WHERE NOT EXISTS (
        SELECT 1
        FROM actual
        WHERE actual.signature = expected.signature
          AND actual.result_contract = expected.result_contract
          AND actual.proretset = expected.returns_set
      )
    )
    SELECT 1 FROM drift
  ) THEN
    RAISE EXCEPTION 'ITEM_PHOTO_VERIFICATION_FAILED: function contract drift';
  END IF;

  IF (
    SELECT count(*)
    FROM pg_proc procedure_record
    JOIN pg_namespace namespace_record ON namespace_record.oid = procedure_record.pronamespace
    CROSS JOIN LATERAL aclexplode(
      coalesce(procedure_record.proacl, acldefault('f', procedure_record.proowner))
    ) acl_entry
    WHERE namespace_record.nspname = 'public'
      AND procedure_record.proname IN (
        'reserve_item_photo_job',
        'bind_item_photo_upload',
        'claim_item_photo_analysis',
        'settle_item_photo_analysis',
        'mark_item_photo_uncertain'
      )
  ) <> 10 OR EXISTS (
    SELECT 1
    FROM pg_proc procedure_record
    JOIN pg_namespace namespace_record ON namespace_record.oid = procedure_record.pronamespace
    CROSS JOIN LATERAL aclexplode(
      coalesce(procedure_record.proacl, acldefault('f', procedure_record.proowner))
    ) acl_entry
    WHERE namespace_record.nspname = 'public'
      AND procedure_record.proname IN (
        'reserve_item_photo_job',
        'bind_item_photo_upload',
        'claim_item_photo_analysis',
        'settle_item_photo_analysis',
        'mark_item_photo_uncertain'
      )
      AND NOT (
        acl_entry.privilege_type = 'EXECUTE'
        AND NOT acl_entry.is_grantable
        AND acl_entry.grantor = database_owner
        AND acl_entry.grantee IN (database_owner, service_role_oid)
      )
  ) OR EXISTS (
    SELECT 1
    FROM pg_proc procedure_record
    JOIN pg_namespace namespace_record ON namespace_record.oid = procedure_record.pronamespace
    WHERE namespace_record.nspname = 'public'
      AND procedure_record.proname IN (
        'reserve_item_photo_job',
        'bind_item_photo_upload',
        'claim_item_photo_analysis',
        'settle_item_photo_analysis',
        'mark_item_photo_uncertain'
      )
      AND NOT has_function_privilege(service_role_oid, procedure_record.oid, 'EXECUTE')
  ) THEN
    RAISE EXCEPTION 'ITEM_PHOTO_VERIFICATION_FAILED: function ACL drift';
  END IF;
END
$verification$;
