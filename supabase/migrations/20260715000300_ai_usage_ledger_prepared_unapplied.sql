-- APPROVAL REQUIRED - PREPARED, NOT APPLIED BY THIS MISSION.
-- Durable, atomic and fail-closed AI usage admission for paid provider calls.
-- Creates a new service-only table and RPCs; no existing policy is modified.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.ai_usage_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
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
);

ALTER TABLE public.ai_usage_reservations ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX IF NOT EXISTS uq_ai_usage_request
  ON public.ai_usage_reservations(tenant_id, user_id, feature, request_key_hash);

CREATE INDEX IF NOT EXISTS idx_ai_usage_user_window
  ON public.ai_usage_reservations(tenant_id, user_id, feature, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_usage_tenant_window
  ON public.ai_usage_reservations(tenant_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.reserve_ai_usage(
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
SET search_path = public, pg_temp
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
    IF v_existing.status = 'succeeded'
       AND v_existing.result_json IS NOT NULL
       AND v_existing.result_expires_at > v_now THEN
      RETURN QUERY SELECT
        true, v_existing.id, true, v_existing.status,
        v_existing.result_json, 0, 'replay_result'::text;
    ELSE
      RETURN QUERY SELECT
        false, v_existing.id, true, v_existing.status, NULL::jsonb,
        CASE WHEN v_existing.status IN ('reserved', 'in_flight') THEN 2 ELSE 0 END,
        CASE
          WHEN v_existing.status IN ('reserved', 'in_flight') THEN 'in_progress'
          WHEN v_existing.status = 'succeeded' THEN 'result_expired'
          ELSE 'prior_attempt_terminal'
        END;
    END IF;
    RETURN;
  END IF;

  v_window_start := v_now - make_interval(secs => p_window_seconds);
  v_day_start := date_trunc('day', v_now AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';

  SELECT count(*) INTO v_user_count
  FROM public.ai_usage_reservations r
  WHERE r.tenant_id = p_tenant_id
    AND r.user_id = p_user_id
    AND r.feature = p_feature
    AND r.created_at >= v_window_start;

  SELECT count(*) INTO v_tenant_count
  FROM public.ai_usage_reservations r
  WHERE r.tenant_id = p_tenant_id
    AND r.created_at >= v_window_start;

  SELECT coalesce(sum(coalesce(r.actual_units, r.estimated_units)), 0)::bigint
  INTO v_user_units
  FROM public.ai_usage_reservations r
  WHERE r.tenant_id = p_tenant_id
    AND r.user_id = p_user_id
    AND r.created_at >= v_day_start;

  SELECT coalesce(sum(coalesce(r.actual_units, r.estimated_units)), 0)::bigint
  INTO v_tenant_units
  FROM public.ai_usage_reservations r
  WHERE r.tenant_id = p_tenant_id
    AND r.created_at >= v_day_start;

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
    RETURN QUERY SELECT false, NULL::uuid, false, 'rejected'::text, NULL::jsonb, v_retry, v_reason;
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
$$;

CREATE OR REPLACE FUNCTION public.claim_ai_usage_reservation(
  p_reservation_id uuid,
  p_tenant_id text,
  p_user_id text,
  p_feature text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_status text;
BEGIN
  SELECT r.status INTO v_status
  FROM public.ai_usage_reservations r
  WHERE r.id = p_reservation_id
    AND r.tenant_id = p_tenant_id
    AND r.user_id = p_user_id
    AND r.feature = p_feature
  FOR UPDATE;
  IF NOT FOUND OR v_status <> 'reserved' THEN RETURN false; END IF;

  UPDATE public.ai_usage_reservations
  SET status = 'in_flight', started_at = now(), updated_at = now()
  WHERE id = p_reservation_id;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.settle_ai_usage_reservation(
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
SET search_path = public, pg_temp
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
$$;

REVOKE ALL ON TABLE public.ai_usage_reservations FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.reserve_ai_usage(text,text,text,text,integer,integer,integer,integer,bigint,bigint) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_ai_usage_reservation(uuid,text,text,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.settle_ai_usage_reservation(uuid,text,text,text,text,integer,text,jsonb) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.reserve_ai_usage(text,text,text,text,integer,integer,integer,integer,bigint,bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_ai_usage_reservation(uuid,text,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.settle_ai_usage_reservation(uuid,text,text,text,text,integer,text,jsonb) TO service_role;

COMMIT;
