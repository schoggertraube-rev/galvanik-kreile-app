-- PREPARED ONLY: do not apply remotely without explicit approval.
-- Explicit user feedback for the future operator control plane; separate from usage telemetry and marketing feedback.

CREATE TABLE public.developer_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id varchar(50) NOT NULL,
  client_request_id uuid NOT NULL,
  actor_pseudonym varchar(64) NOT NULL,
  actor_role varchar(50) NOT NULL,
  route varchar(200) NOT NULL,
  message text NOT NULL,
  build_id varchar(100),
  status varchar(20) NOT NULL DEFAULT 'new',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT developer_feedback_actor_request_uidx UNIQUE (tenant_id, actor_pseudonym, client_request_id),
  CONSTRAINT developer_feedback_actor_chk CHECK (actor_pseudonym ~ '^[0-9a-f]{64}$'),
  CONSTRAINT developer_feedback_role_chk CHECK (actor_role IN ('developer', 'admin', 'meister', 'buero', 'werkstatt', 'readonly')),
  CONSTRAINT developer_feedback_route_chk CHECK (route ~ '^/(?:[a-z][a-z-]{0,39}|:id)?(?:/(?:[a-z][a-z-]{0,39}|:id)){0,4}$'),
  CONSTRAINT developer_feedback_message_chk CHECK (char_length(message) BETWEEN 3 AND 2000),
  CONSTRAINT developer_feedback_status_chk CHECK (status = 'new')
);

CREATE INDEX developer_feedback_tenant_created_idx
  ON public.developer_feedback (tenant_id, created_at DESC);
CREATE INDEX developer_feedback_tenant_status_idx
  ON public.developer_feedback (tenant_id, status, created_at DESC);

ALTER TABLE public.developer_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.developer_feedback FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.developer_feedback FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT ON TABLE public.developer_feedback TO service_role;

DO $verification$
DECLARE
  browser_grants integer;
  mutation_grants integer;
BEGIN
  SELECT count(*) INTO browser_grants
  FROM information_schema.role_table_grants
  WHERE table_schema = 'public' AND table_name = 'developer_feedback'
    AND grantee IN ('anon', 'authenticated');
  IF browser_grants <> 0 THEN RAISE EXCEPTION 'Developer feedback exposes browser grants'; END IF;

  SELECT count(*) INTO mutation_grants
  FROM information_schema.role_table_grants
  WHERE table_schema = 'public' AND table_name = 'developer_feedback'
    AND grantee = 'service_role' AND privilege_type IN ('UPDATE', 'DELETE', 'TRUNCATE');
  IF mutation_grants <> 0 THEN RAISE EXCEPTION 'Developer feedback must be append-only'; END IF;
END
$verification$;
