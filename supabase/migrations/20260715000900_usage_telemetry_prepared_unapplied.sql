-- PREPARED ONLY: do not apply remotely without explicit approval.
-- Data-minimized, append-only product usage telemetry. No raw text or arbitrary JSON.

CREATE TABLE public.app_usage_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  client_event_id uuid NOT NULL,
  actor_pseudonym varchar(64) NOT NULL,
  actor_role varchar(50) NOT NULL,
  session_id uuid NOT NULL,
  event_type varchar(50) NOT NULL,
  route varchar(200) NOT NULL,
  target varchar(100),
  device_class varchar(20) NOT NULL,
  outcome varchar(20),
  duration_ms integer,
  result_count integer,
  query_length integer,
  click_count integer,
  build_id varchar(100),
  occurred_at timestamptz NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT app_usage_events_tenant_client_uidx UNIQUE (tenant_id, client_event_id),
  CONSTRAINT app_usage_events_actor_pseudonym_chk CHECK (actor_pseudonym ~ '^[0-9a-f]{64}$'),
  CONSTRAINT app_usage_events_actor_role_chk CHECK (actor_role IN ('developer', 'admin', 'meister', 'buero', 'werkstatt', 'readonly')),
  CONSTRAINT app_usage_events_type_chk CHECK (event_type IN (
    'nav_click', 'overlay_open', 'overlay_close_backdrop', 'overlay_close_esc',
    'page_view', 'detail_open', 'search', 'action', 'tool_usage',
    'workflow_started', 'workflow_step', 'workflow_completed', 'workflow_abandoned', 'error'
  )),
  CONSTRAINT app_usage_events_route_chk CHECK (route ~ '^/(?:[a-z][a-z-]{0,39}|:id)?(?:/(?:[a-z][a-z-]{0,39}|:id)){0,4}$'),
  CONSTRAINT app_usage_events_target_chk CHECK (
    target IS NULL OR target ~ '^(?:[a-z][a-z0-9._:-]{0,79}|/(?:[a-z][a-z-]{0,39})(?:/[a-z][a-z-]{0,39})?)$'
  ),
  CONSTRAINT app_usage_events_device_chk CHECK (device_class IN ('desktop', 'tablet', 'mobile', 'unknown')),
  CONSTRAINT app_usage_events_outcome_chk CHECK (outcome IS NULL OR outcome IN ('success', 'failure', 'cancelled', 'empty', 'unknown')),
  CONSTRAINT app_usage_events_duration_chk CHECK (duration_ms IS NULL OR duration_ms BETWEEN 0 AND 3600000),
  CONSTRAINT app_usage_events_result_count_chk CHECK (result_count IS NULL OR result_count BETWEEN 0 AND 100000),
  CONSTRAINT app_usage_events_query_length_chk CHECK (query_length IS NULL OR query_length BETWEEN 0 AND 500),
  CONSTRAINT app_usage_events_click_count_chk CHECK (click_count IS NULL OR click_count BETWEEN 0 AND 10000),
  CONSTRAINT app_usage_events_time_window_chk CHECK (
    occurred_at >= received_at - interval '7 days' AND occurred_at <= received_at + interval '5 minutes'
  )
);

CREATE INDEX app_usage_events_tenant_occurred_idx
  ON public.app_usage_events (tenant_id, occurred_at DESC);
CREATE INDEX app_usage_events_tenant_type_idx
  ON public.app_usage_events (tenant_id, event_type, occurred_at DESC);

ALTER TABLE public.app_usage_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_usage_events FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.app_usage_events FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT ON TABLE public.app_usage_events TO service_role;

-- Legacy arbitrary JSON events are not trusted or backfilled. Seal the old sink.
DO $legacy$
DECLARE
  policy_name text;
BEGIN
  IF to_regclass('public.ui_events') IS NOT NULL THEN
    ALTER TABLE public.ui_events ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.ui_events FORCE ROW LEVEL SECURITY;
    FOR policy_name IN
      SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'ui_events'
    LOOP
      EXECUTE format('DROP POLICY %I ON public.ui_events', policy_name);
    END LOOP;
    REVOKE ALL ON TABLE public.ui_events FROM PUBLIC, anon, authenticated, service_role;
  END IF;
END
$legacy$;

DO $verification$
DECLARE
  browser_grants integer;
  mutation_grants integer;
BEGIN
  SELECT count(*) INTO browser_grants
  FROM information_schema.role_table_grants
  WHERE table_schema = 'public' AND table_name = 'app_usage_events'
    AND grantee IN ('anon', 'authenticated');
  IF browser_grants <> 0 THEN RAISE EXCEPTION 'Usage telemetry exposes % browser grants', browser_grants; END IF;

  SELECT count(*) INTO mutation_grants
  FROM information_schema.role_table_grants
  WHERE table_schema = 'public' AND table_name = 'app_usage_events'
    AND grantee = 'service_role' AND privilege_type IN ('UPDATE', 'DELETE', 'TRUNCATE');
  IF mutation_grants <> 0 THEN RAISE EXCEPTION 'Usage telemetry must be append-only'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'app_usage_events'
      AND c.relrowsecurity AND c.relforcerowsecurity
  ) THEN RAISE EXCEPTION 'Usage telemetry must use forced RLS'; END IF;
END
$verification$;
