-- REMOTE WAVE 1: explicitly approved 2026-07-26; use only the reviewed atomic runner.
-- Durable, atomic and fail-closed AI usage admission for paid provider calls.
-- Creates a new service-only table and RPCs; no existing policy is modified.

SET lock_timeout = '5s'

SET statement_timeout = '5min'

CREATE TABLE public.ai_usage_reservations (
  id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  tenant_id text NOT NULL,
  user_id text NOT NULL,
  feature text NOT NULL,
  request_key_hash text NOT NULL,
  estimated_units integer NOT NULL,
  actual_units integer,
  status text NOT NULL DEFAULT 'reserved',
  reason text,
  provider_status text,
  result_json jsonb,
  result_expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_usage_feature_format CHECK (feature ~ '^[a-z][a-z0-9-]{1,63}$'),
  CONSTRAINT ai_usage_request_hash_format CHECK (request_key_hash ~ '^[a-f0-9]{64}$'),
  CONSTRAINT ai_usage_estimated_units_positive CHECK (estimated_units > 0),
  CONSTRAINT ai_usage_actual_units_nonnegative CHECK (actual_units IS NULL OR actual_units >= 0),
  CONSTRAINT ai_usage_status_known CHECK (
    status IN ('reserved', 'in_flight', 'succeeded', 'failed', 'uncertain')
  )
)

ALTER TABLE public.ai_usage_reservations ENABLE ROW LEVEL SECURITY

ALTER TABLE public.ai_usage_reservations FORCE ROW LEVEL SECURITY

CREATE UNIQUE INDEX uq_ai_usage_request
  ON public.ai_usage_reservations(tenant_id, user_id, feature, request_key_hash)

CREATE INDEX idx_ai_usage_user_window
  ON public.ai_usage_reservations(tenant_id, user_id, feature, created_at DESC)

CREATE INDEX idx_ai_usage_tenant_window
  ON public.ai_usage_reservations(tenant_id, created_at DESC)

CREATE FUNCTION public.reserve_ai_usage(
  p_tenant_id text,
  p_user_id text,
  p_feature text,
  p_request_key_hash text,
  p_estimated_units integer,
  p_window_seconds integer,
  p_user_window_limit integer,
  p_tenant_window_limit integer,
  p_user_daily_unit_limit bigint,
  p_tenant_daily_unit_limit bigint
)
RETURNS TABLE(
  allowed boolean,
  reservation_id uuid,
  replay boolean,
  usage_status text,
  replay_result jsonb,
  retry_after_seconds integer,
  decision_reason text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_existing public.ai_usage_reservations%ROWTYPE;
  v_inserted public.ai_usage_reservations%ROWTYPE;
  v_now timestamptz := clock_timestamp();
  v_window_start timestamptz;
  v_day_start timestamptz;
  v_user_count bigint;
  v_tenant_count bigint;
  v_user_units bigint;
  v_tenant_units bigint;
  v_reason text;
  v_retry integer;
  v_reclaim boolean := false;
  v_reclaim_id uuid;
BEGIN
  IF p_tenant_id IS NULL OR length(p_tenant_id) NOT BETWEEN 1 AND 80
     OR p_user_id IS NULL OR length(p_user_id) NOT BETWEEN 1 AND 128
     OR p_feature IS NULL OR p_feature !~ '^[a-z][a-z0-9-]{1,63}$'
     OR p_request_key_hash IS NULL OR p_request_key_hash !~ '^[a-f0-9]{64}$'
     OR p_estimated_units IS NULL OR p_estimated_units <= 0 OR p_estimated_units > 100000
     OR p_window_seconds IS NULL OR p_window_seconds NOT BETWEEN 10 AND 3600
     OR p_user_window_limit IS NULL OR p_user_window_limit NOT BETWEEN 1 AND 1000
     OR p_tenant_window_limit IS NULL OR p_tenant_window_limit NOT BETWEEN 1 AND 10000
     OR p_user_daily_unit_limit IS NULL OR p_user_daily_unit_limit NOT BETWEEN 1 AND 100000000
     OR p_tenant_daily_unit_limit IS NULL OR p_tenant_daily_unit_limit NOT BETWEEN 1 AND 1000000000 THEN
    RAISE EXCEPTION 'INVALID_AI_USAGE_POLICY';
  END IF;

  -- Stable lock order prevents concurrent user/tenant overdraw across regions.
  PERFORM pg_advisory_xact_lock(hashtextextended('ai:tenant:' || p_tenant_id, 0));
  PERFORM pg_advisory_xact_lock(hashtextextended(
    'ai:user:' || p_tenant_id || ':' || p_user_id || ':' || p_feature,
    0
  ));

  SELECT r.* INTO v_existing
  FROM public.ai_usage_reservations r
  WHERE r.tenant_id = p_tenant_id
    AND r.user_id = p_user_id
    AND r.feature = p_feature
    AND r.request_key_hash = p_request_key_hash
  FOR UPDATE;

  IF FOUND THEN
    IF v_existing.status = 'reserved'
       AND v_existing.updated_at <= v_now - interval '5 minutes' THEN
      -- Re-admit below against the current window/day. Excluding this row from
      -- all counters and moving its admission timestamp prevents old leases
      -- from borrowing quota from a previous day.
      v_reclaim := true;
      v_reclaim_id := v_existing.id;
    ELSE
      IF v_existing.status = 'in_flight'
         AND v_existing.updated_at <= v_now - interval '5 minutes' THEN
        UPDATE public.ai_usage_reservations
        SET status = 'uncertain',
            reason = 'stale_in_flight',
            provider_status = coalesce(provider_status, 'stale-in-flight'),
            completed_at = v_now,
            updated_at = v_now
        WHERE id = v_existing.id;
        v_existing.status := 'uncertain';
      END IF;

      IF v_existing.status = 'succeeded'
         AND v_existing.result_json IS NOT NULL
         AND v_existing.result_expires_at > v_now THEN
        RETURN QUERY SELECT
          true, v_existing.id, true, v_existing.status,
          v_existing.result_json, 0, 'replay_result'::text;
      ELSE
        RETURN QUERY SELECT
          false, v_existing.id, true, v_existing.status, NULL::jsonb,
          CASE WHEN v_existing.status IN ('reserved', 'in_flight') THEN
            greatest(1, ceil(extract(epoch FROM (
              v_existing.updated_at + interval '5 minutes' - v_now
            )))::integer)
          ELSE 0 END,
          CASE
            WHEN v_existing.status IN ('reserved', 'in_flight') THEN 'in_progress'
            WHEN v_existing.status = 'succeeded' THEN 'result_expired'
            ELSE 'prior_attempt_terminal'
          END;
      END IF;
      RETURN;
    END IF;
  END IF;

  v_window_start := v_now - make_interval(secs => p_window_seconds);
  v_day_start := date_trunc('day', v_now AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';

  SELECT count(*) INTO v_user_count
  FROM public.ai_usage_reservations r
  WHERE r.tenant_id = p_tenant_id
    AND r.user_id = p_user_id
    AND r.feature = p_feature
    AND r.created_at >= v_window_start
    AND (v_reclaim_id IS NULL OR r.id <> v_reclaim_id);

  SELECT count(*) INTO v_tenant_count
  FROM public.ai_usage_reservations r
  WHERE r.tenant_id = p_tenant_id
    AND r.created_at >= v_window_start
    AND (v_reclaim_id IS NULL OR r.id <> v_reclaim_id);

  SELECT coalesce(sum(coalesce(r.actual_units, r.estimated_units)), 0)::bigint
  INTO v_user_units
  FROM public.ai_usage_reservations r
  WHERE r.tenant_id = p_tenant_id
    AND r.user_id = p_user_id
    AND r.created_at >= v_day_start
    AND (v_reclaim_id IS NULL OR r.id <> v_reclaim_id);

  SELECT coalesce(sum(coalesce(r.actual_units, r.estimated_units)), 0)::bigint
  INTO v_tenant_units
  FROM public.ai_usage_reservations r
  WHERE r.tenant_id = p_tenant_id
    AND r.created_at >= v_day_start
    AND (v_reclaim_id IS NULL OR r.id <> v_reclaim_id);

  IF v_user_count >= p_user_window_limit THEN
    v_reason := 'user_window';
    v_retry := p_window_seconds;
  ELSIF v_tenant_count >= p_tenant_window_limit THEN
    v_reason := 'tenant_window';
    v_retry := p_window_seconds;
  ELSIF v_user_units + p_estimated_units > p_user_daily_unit_limit THEN
    v_reason := 'user_daily_units';
    v_retry := greatest(1, ceil(extract(epoch FROM (v_day_start + interval '1 day' - v_now)))::integer);
  ELSIF v_tenant_units + p_estimated_units > p_tenant_daily_unit_limit THEN
    v_reason := 'tenant_daily_units';
    v_retry := greatest(1, ceil(extract(epoch FROM (v_day_start + interval '1 day' - v_now)))::integer);
  END IF;

  IF v_reason IS NOT NULL THEN
    RETURN QUERY SELECT
      false,
      CASE WHEN v_reclaim THEN v_reclaim_id ELSE NULL::uuid END,
      v_reclaim,
      CASE WHEN v_reclaim THEN 'reserved'::text ELSE 'rejected'::text END,
      NULL::jsonb, v_retry, v_reason;
    RETURN;
  END IF;

  IF v_reclaim THEN
    UPDATE public.ai_usage_reservations
    SET estimated_units = p_estimated_units,
        actual_units = NULL,
        status = 'reserved',
        reason = 'reclaimed_reserved',
        provider_status = NULL,
        result_json = NULL,
        result_expires_at = NULL,
        created_at = v_now,
        started_at = NULL,
        completed_at = NULL,
        updated_at = v_now
    WHERE id = v_reclaim_id;
    RETURN QUERY SELECT
      true, v_reclaim_id, false, 'reserved'::text,
      NULL::jsonb, 0, 'reclaimed_reserved'::text;
    RETURN;
  END IF;

  BEGIN
    INSERT INTO public.ai_usage_reservations (
      tenant_id, user_id, feature, request_key_hash, estimated_units,
      status, created_at, updated_at
    ) VALUES (
      p_tenant_id, p_user_id, p_feature, p_request_key_hash, p_estimated_units,
      'reserved', v_now, v_now
    ) RETURNING * INTO v_inserted;
  EXCEPTION WHEN unique_violation THEN
    SELECT r.* INTO v_existing
    FROM public.ai_usage_reservations r
    WHERE r.tenant_id = p_tenant_id
      AND r.user_id = p_user_id
      AND r.feature = p_feature
      AND r.request_key_hash = p_request_key_hash
    FOR UPDATE;
    IF NOT FOUND THEN RAISE; END IF;
    RETURN QUERY SELECT
      false, v_existing.id, true, v_existing.status, NULL::jsonb, 2, 'in_progress'::text;
    RETURN;
  END;

  RETURN QUERY SELECT
    true, v_inserted.id, false, v_inserted.status,
    NULL::jsonb, 0, 'reserved'::text;
END;
$$

CREATE FUNCTION public.claim_ai_usage_reservation(
  p_reservation_id uuid,
  p_tenant_id text,
  p_user_id text,
  p_feature text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  UPDATE public.ai_usage_reservations AS r
  SET status = 'in_flight', started_at = clock_timestamp(), updated_at = clock_timestamp()
  WHERE id = p_reservation_id
    AND r.tenant_id = p_tenant_id
    AND r.user_id = p_user_id
    AND r.feature = p_feature
    AND r.status = 'reserved'
    AND r.updated_at > clock_timestamp() - interval '5 minutes';
  IF NOT FOUND THEN RETURN false; END IF;
  RETURN true;
END;
$$

CREATE FUNCTION public.settle_ai_usage_reservation(
  p_reservation_id uuid,
  p_tenant_id text,
  p_user_id text,
  p_feature text,
  p_outcome text,
  p_actual_units integer,
  p_provider_status text,
  p_result jsonb
)
RETURNS TABLE(changed boolean, usage_status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_reservation public.ai_usage_reservations%ROWTYPE;
BEGIN
  IF p_outcome IS NULL OR p_outcome NOT IN ('succeeded', 'failed', 'uncertain')
     OR (p_actual_units IS NOT NULL AND p_actual_units < 0)
     OR p_provider_status IS NULL OR length(p_provider_status) NOT BETWEEN 1 AND 80
     OR (p_result IS NOT NULL AND octet_length(p_result::text) > 262144)
     OR (p_outcome = 'succeeded' AND p_result IS NULL)
     OR (p_outcome <> 'succeeded' AND p_result IS NOT NULL) THEN
    RAISE EXCEPTION 'INVALID_AI_USAGE_SETTLEMENT';
  END IF;

  SELECT r.* INTO v_reservation
  FROM public.ai_usage_reservations r
  WHERE r.id = p_reservation_id
    AND r.tenant_id = p_tenant_id
    AND r.user_id = p_user_id
    AND r.feature = p_feature
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'AI_USAGE_RESERVATION_NOT_FOUND'; END IF;

  IF v_reservation.status IN ('succeeded', 'failed', 'uncertain') THEN
    RETURN QUERY SELECT false, v_reservation.status;
    RETURN;
  END IF;
  IF v_reservation.status <> 'in_flight' THEN
    RAISE EXCEPTION 'AI_USAGE_RESERVATION_NOT_CLAIMED';
  END IF;

  UPDATE public.ai_usage_reservations
  SET status = p_outcome,
      actual_units = p_actual_units,
      provider_status = p_provider_status,
      result_json = p_result,
      result_expires_at = CASE WHEN p_outcome = 'succeeded' THEN now() + interval '24 hours' ELSE NULL END,
      completed_at = now(),
      updated_at = now()
  WHERE id = v_reservation.id;

  RETURN QUERY SELECT true, p_outcome;
END;
$$

REVOKE ALL ON TABLE public.ai_usage_reservations FROM PUBLIC, anon, authenticated, service_role

REVOKE ALL ON FUNCTION public.reserve_ai_usage(text,text,text,text,integer,integer,integer,integer,bigint,bigint) FROM PUBLIC, anon, authenticated, service_role

REVOKE ALL ON FUNCTION public.claim_ai_usage_reservation(uuid,text,text,text) FROM PUBLIC, anon, authenticated, service_role

REVOKE ALL ON FUNCTION public.settle_ai_usage_reservation(uuid,text,text,text,text,integer,text,jsonb) FROM PUBLIC, anon, authenticated, service_role

GRANT EXECUTE ON FUNCTION public.reserve_ai_usage(text,text,text,text,integer,integer,integer,integer,bigint,bigint) TO service_role

GRANT EXECUTE ON FUNCTION public.claim_ai_usage_reservation(uuid,text,text,text) TO service_role

GRANT EXECUTE ON FUNCTION public.settle_ai_usage_reservation(uuid,text,text,text,text,integer,text,jsonb) TO service_role

DO $verification$
DECLARE
  v_table oid := to_regclass('public.ai_usage_reservations');
  v_owner oid;
  v_service_role oid := (SELECT oid FROM pg_roles WHERE rolname = 'service_role');
  v_function oid;
  v_expected record;
BEGIN
  IF v_table IS NULL OR (
    SELECT relkind <> 'r' OR relpersistence <> 'p'
    FROM pg_class
    WHERE oid = v_table
  ) THEN
    RAISE EXCEPTION 'AI_USAGE_VERIFICATION_FAILED: table is not a permanent ordinary relation';
  END IF;

  SELECT relowner INTO v_owner FROM pg_class WHERE oid = v_table;

  IF (SELECT count(*) FROM pg_attribute WHERE attrelid = v_table AND attnum > 0 AND NOT attisdropped) <> 16
     OR EXISTS (
       SELECT 1
       FROM (VALUES
         (1,  'id',                'uuid',                     true,  'gen_random_uuid()'),
         (2,  'tenant_id',         'text',                     true,  NULL),
         (3,  'user_id',           'text',                     true,  NULL),
         (4,  'feature',           'text',                     true,  NULL),
         (5,  'request_key_hash',  'text',                     true,  NULL),
         (6,  'estimated_units',   'integer',                  true,  NULL),
         (7,  'actual_units',      'integer',                  false, NULL),
         (8,  'status',            'text',                     true,  '''reserved''::text'),
         (9,  'reason',            'text',                     false, NULL),
         (10, 'provider_status',   'text',                     false, NULL),
         (11, 'result_json',       'jsonb',                    false, NULL),
         (12, 'result_expires_at', 'timestamp with time zone', false, NULL),
         (13, 'created_at',        'timestamp with time zone', true,  'now()'),
         (14, 'started_at',        'timestamp with time zone', false, NULL),
         (15, 'completed_at',      'timestamp with time zone', false, NULL),
         (16, 'updated_at',        'timestamp with time zone', true,  'now()')
       ) AS expected(attnum, attname, type_name, not_null, default_expression)
       LEFT JOIN pg_attribute attribute
         ON attribute.attrelid = v_table
        AND attribute.attnum = expected.attnum
        AND NOT attribute.attisdropped
       LEFT JOIN pg_attrdef attribute_default
         ON attribute_default.adrelid = attribute.attrelid
        AND attribute_default.adnum = attribute.attnum
       WHERE attribute.attname IS DISTINCT FROM expected.attname
          OR format_type(attribute.atttypid, attribute.atttypmod) IS DISTINCT FROM expected.type_name
          OR attribute.attnotnull IS DISTINCT FROM expected.not_null
          OR pg_get_expr(attribute_default.adbin, attribute_default.adrelid) IS DISTINCT FROM expected.default_expression
     ) THEN
    RAISE EXCEPTION 'AI_USAGE_VERIFICATION_FAILED: column contract drift';
  END IF;

  IF (
    SELECT array_agg(constraint_record.conname::text ORDER BY constraint_record.conname)
    FROM pg_constraint constraint_record
    WHERE constraint_record.conrelid = v_table
  ) IS DISTINCT FROM ARRAY[
    'ai_usage_actual_units_nonnegative',
    'ai_usage_estimated_units_positive',
    'ai_usage_feature_format',
    'ai_usage_request_hash_format',
    'ai_usage_reservations_pkey',
    'ai_usage_status_known'
  ]::text[] OR EXISTS (
    SELECT 1
    FROM pg_constraint constraint_record
    WHERE constraint_record.conrelid = v_table
      AND (
        NOT constraint_record.convalidated
        OR constraint_record.contype NOT IN ('p', 'c')
        OR (constraint_record.contype = 'p' AND constraint_record.conname <> 'ai_usage_reservations_pkey')
        OR (constraint_record.contype = 'c' AND constraint_record.conname = 'ai_usage_reservations_pkey')
      )
  ) THEN
    RAISE EXCEPTION 'AI_USAGE_VERIFICATION_FAILED: constraint contract drift';
  END IF;

  IF (SELECT count(*) FROM pg_index WHERE indrelid = v_table) <> 4 OR EXISTS (
    SELECT 1
    FROM (VALUES
      ('uq_ai_usage_request', true, ARRAY['tenant_id', 'user_id', 'feature', 'request_key_hash']::text[], ARRAY[0, 0, 0, 0]::smallint[]),
      ('idx_ai_usage_user_window', false, ARRAY['tenant_id', 'user_id', 'feature', 'created_at']::text[], ARRAY[0, 0, 0, 1]::smallint[]),
      ('idx_ai_usage_tenant_window', false, ARRAY['tenant_id', 'created_at']::text[], ARRAY[0, 1]::smallint[])
    ) AS expected(index_name, is_unique, key_expressions, descending_keys)
    LEFT JOIN pg_class index_relation
      ON index_relation.relnamespace = 'public'::regnamespace
     AND index_relation.relname = expected.index_name
    LEFT JOIN pg_index index_record
      ON index_record.indexrelid = index_relation.oid
     AND index_record.indrelid = v_table
    LEFT JOIN pg_class access_relation ON access_relation.oid = index_record.indexrelid
    LEFT JOIN pg_am access_method ON access_method.oid = access_relation.relam
    WHERE index_record.indexrelid IS NULL
       OR NOT index_record.indisvalid
       OR NOT index_record.indisready
       OR index_record.indisunique IS DISTINCT FROM expected.is_unique
       OR index_record.indnkeyatts <> cardinality(expected.key_expressions)
       OR index_record.indnatts <> cardinality(expected.key_expressions)
       OR index_record.indpred IS NOT NULL
       OR index_record.indexprs IS NOT NULL
       OR access_method.amname IS DISTINCT FROM 'btree'
       OR ARRAY(
         SELECT pg_get_indexdef(index_record.indexrelid, position, true)
         FROM generate_series(1, index_record.indnkeyatts) AS position
         ORDER BY position
       ) IS DISTINCT FROM expected.key_expressions
       OR ARRAY(
         SELECT ((option_value & 1)::smallint)
         FROM unnest(string_to_array(btrim(index_record.indoption::text), ' ')::smallint[])
           WITH ORDINALITY AS option_record(option_value, position)
         ORDER BY position
       ) IS DISTINCT FROM expected.descending_keys
  ) THEN
    RAISE EXCEPTION 'AI_USAGE_VERIFICATION_FAILED: index contract drift';
  END IF;

  IF NOT (SELECT relrowsecurity AND relforcerowsecurity FROM pg_class WHERE oid = v_table)
     OR EXISTS (SELECT 1 FROM pg_policy WHERE polrelid = v_table) THEN
    RAISE EXCEPTION 'AI_USAGE_VERIFICATION_FAILED: RLS contract drift';
  END IF;

  IF v_service_role IS NULL OR EXISTS (
    SELECT 1 FROM pg_roles
    WHERE oid = v_service_role
      AND (
        rolsuper
        OR NOT rolbypassrls
        OR rolcanlogin
        OR rolcreaterole
        OR rolcreatedb
        OR rolreplication
      )
  ) THEN
    RAISE EXCEPTION 'AI_USAGE_VERIFICATION_FAILED: service_role must be a non-superuser with BYPASSRLS';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_roles role_record
    WHERE role_record.oid <> v_owner
      AND NOT role_record.rolsuper
      AND role_record.rolname NOT IN ('pg_read_all_data', 'pg_write_all_data', 'pg_maintain')
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
      AND (
        has_table_privilege(role_record.oid, v_table, 'SELECT')
        OR has_table_privilege(role_record.oid, v_table, 'INSERT')
        OR has_table_privilege(role_record.oid, v_table, 'UPDATE')
        OR has_table_privilege(role_record.oid, v_table, 'DELETE')
        OR has_table_privilege(role_record.oid, v_table, 'TRUNCATE')
        OR has_table_privilege(role_record.oid, v_table, 'REFERENCES')
        OR has_table_privilege(role_record.oid, v_table, 'TRIGGER')
        OR has_table_privilege(role_record.oid, v_table, 'MAINTAIN')
        OR has_any_column_privilege(role_record.oid, v_table, 'SELECT')
        OR has_any_column_privilege(role_record.oid, v_table, 'INSERT')
        OR has_any_column_privilege(role_record.oid, v_table, 'UPDATE')
        OR has_any_column_privilege(role_record.oid, v_table, 'REFERENCES')
      )
  ) OR EXISTS (
    SELECT 1
    FROM pg_class relation_record,
         LATERAL aclexplode(coalesce(relation_record.relacl, acldefault('r', relation_record.relowner))) acl_entry
    WHERE relation_record.oid = v_table
      AND acl_entry.grantee <> v_owner
  ) OR EXISTS (
    SELECT 1
    FROM pg_attribute attribute,
         LATERAL aclexplode(attribute.attacl) acl_entry
    WHERE attribute.attrelid = v_table
      AND attribute.attnum > 0
      AND NOT attribute.attisdropped
      AND acl_entry.grantee <> v_owner
  ) THEN
    RAISE EXCEPTION 'AI_USAGE_VERIFICATION_FAILED: direct or inherited table access detected';
  END IF;

  IF (
    SELECT count(*)
    FROM pg_proc procedure_record
    WHERE procedure_record.pronamespace = 'public'::regnamespace
      AND procedure_record.proname IN (
        'reserve_ai_usage',
        'claim_ai_usage_reservation',
        'settle_ai_usage_reservation'
      )
  ) <> 3 THEN
    RAISE EXCEPTION 'AI_USAGE_VERIFICATION_FAILED: missing or overloaded RPC';
  END IF;

  FOR v_expected IN
    SELECT * FROM (VALUES
      ('public.reserve_ai_usage(text,text,text,text,integer,integer,integer,integer,bigint,bigint)', 'record', true),
      ('public.claim_ai_usage_reservation(uuid,text,text,text)', 'boolean', false),
      ('public.settle_ai_usage_reservation(uuid,text,text,text,text,integer,text,jsonb)', 'record', true)
    ) AS expected(signature, result_type, returns_set)
  LOOP
    v_function := to_regprocedure(v_expected.signature);
    IF v_function IS NULL OR EXISTS (
      SELECT 1
      FROM pg_proc procedure_record
      JOIN pg_language language_record ON language_record.oid = procedure_record.prolang
      WHERE procedure_record.oid = v_function
        AND (
          language_record.lanname <> 'plpgsql'
          OR NOT procedure_record.prosecdef
          OR procedure_record.prorettype <> v_expected.result_type::regtype
          OR procedure_record.proretset IS DISTINCT FROM v_expected.returns_set
          OR procedure_record.proowner <> v_owner
          OR procedure_record.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog, public, pg_temp']::text[]
        )
    ) OR NOT EXISTS (
      SELECT 1
      FROM pg_proc procedure_record
      JOIN pg_roles owner_role ON owner_role.oid = procedure_record.proowner
      WHERE procedure_record.oid = v_function
        AND (owner_role.rolsuper OR owner_role.rolbypassrls)
    ) THEN
      RAISE EXCEPTION 'AI_USAGE_VERIFICATION_FAILED: RPC contract drift for %', v_expected.signature;
    END IF;

    IF NOT has_function_privilege(v_service_role, v_function, 'EXECUTE') OR EXISTS (
      SELECT 1
      FROM pg_roles role_record
      WHERE role_record.oid NOT IN (v_owner, v_service_role)
        AND NOT role_record.rolsuper
        AND has_function_privilege(role_record.oid, v_function, 'EXECUTE')
    ) OR EXISTS (
      SELECT 1
      FROM pg_proc procedure_record,
           LATERAL aclexplode(coalesce(procedure_record.proacl, acldefault('f', procedure_record.proowner))) acl_entry
      WHERE procedure_record.oid = v_function
        AND acl_entry.grantee NOT IN (v_owner, v_service_role)
    ) THEN
      RAISE EXCEPTION 'AI_USAGE_VERIFICATION_FAILED: RPC execute ACL drift for %', v_expected.signature;
    END IF;
  END LOOP;
END;
$verification$
