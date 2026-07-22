-- APPROVAL REQUIRED - PREPARED, NOT APPLIED BY THIS MISSION.
-- Durable atomic security counters. Apply before deploying code that calls the
-- functions below. No data deletion, RLS, policy, or remote change is executed
-- by this prepared file.

BEGIN;

CREATE TABLE IF NOT EXISTS public.security_rate_limit_counters (
  namespace text NOT NULL,
  subject_hash text NOT NULL,
  window_started_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (namespace, subject_hash),
  CHECK (namespace ~ '^[a-z0-9._-]{1,80}$'),
  CHECK (length(subject_hash) = 64)
);

REVOKE ALL ON TABLE public.security_rate_limit_counters
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.consume_security_rate_limit(
  p_namespace text,
  p_subject_hash text,
  p_limit integer,
  p_window_seconds integer
)
RETURNS TABLE(allowed boolean, remaining integer, retry_after_seconds integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_counter public.security_rate_limit_counters%ROWTYPE;
  v_now timestamptz := clock_timestamp();
BEGIN
  IF p_namespace !~ '^[a-z0-9._-]{1,80}$'
     OR length(p_subject_hash) <> 64
     OR p_limit < 1 OR p_limit > 100000
     OR p_window_seconds < 1 OR p_window_seconds > 2592000 THEN
    RAISE EXCEPTION 'INVALID_SECURITY_RATE_LIMIT_POLICY';
  END IF;

  INSERT INTO public.security_rate_limit_counters (
    namespace, subject_hash, window_started_at, attempt_count, updated_at
  ) VALUES (
    p_namespace, p_subject_hash, v_now, 0, v_now
  ) ON CONFLICT (namespace, subject_hash) DO NOTHING;

  SELECT * INTO v_counter
  FROM public.security_rate_limit_counters
  WHERE namespace = p_namespace AND subject_hash = p_subject_hash
  FOR UPDATE;

  IF v_counter.window_started_at <= v_now - make_interval(secs => p_window_seconds) THEN
    v_counter.window_started_at := v_now;
    v_counter.attempt_count := 0;
  END IF;

  IF v_counter.attempt_count >= p_limit THEN
    UPDATE public.security_rate_limit_counters
    SET updated_at = v_now
    WHERE namespace = p_namespace AND subject_hash = p_subject_hash;

    RETURN QUERY SELECT
      false,
      0,
      greatest(
        1,
        ceil(extract(epoch FROM (
          v_counter.window_started_at + make_interval(secs => p_window_seconds) - v_now
        )))::integer
      );
    RETURN;
  END IF;

  v_counter.attempt_count := v_counter.attempt_count + 1;
  UPDATE public.security_rate_limit_counters
  SET window_started_at = v_counter.window_started_at,
      attempt_count = v_counter.attempt_count,
      updated_at = v_now
  WHERE namespace = p_namespace AND subject_hash = p_subject_hash;

  RETURN QUERY SELECT true, greatest(0, p_limit - v_counter.attempt_count), 0;
END;
$$;

CREATE OR REPLACE FUNCTION public.reset_security_rate_limit(
  p_namespace text,
  p_subject_hash text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_now timestamptz := clock_timestamp();
BEGIN
  IF p_namespace !~ '^[a-z0-9._-]{1,80}$' OR length(p_subject_hash) <> 64 THEN
    RAISE EXCEPTION 'INVALID_SECURITY_RATE_LIMIT_RESET';
  END IF;

  INSERT INTO public.security_rate_limit_counters (
    namespace, subject_hash, window_started_at, attempt_count, updated_at
  ) VALUES (
    p_namespace, p_subject_hash, v_now, 0, v_now
  )
  ON CONFLICT (namespace, subject_hash) DO UPDATE
  SET window_started_at = EXCLUDED.window_started_at,
      attempt_count = 0,
      updated_at = EXCLUDED.updated_at;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_security_rate_limit(text,text,integer,integer)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.reset_security_rate_limit(text,text)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.consume_security_rate_limit(text,text,integer,integer)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.reset_security_rate_limit(text,text)
  TO service_role;

COMMIT;
