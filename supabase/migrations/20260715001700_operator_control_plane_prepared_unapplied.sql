-- PREPARED ONLY: do not apply remotely without explicit approval.
-- Signed, transparent tenant control state. No remote code execution and no covert slowdown mode.

BEGIN;

CREATE TABLE public.tenant_operator_controls (
  tenant_id text PRIMARY KEY,
  plan varchar(20) NOT NULL,
  mode varchar(20) NOT NULL,
  reason varchar(40) NOT NULL,
  notice varchar(500),
  effective_at timestamptz NOT NULL,
  expires_at timestamptz,
  issued_at timestamptz NOT NULL,
  policy_version bigint NOT NULL,
  canonical_payload text NOT NULL,
  signature varchar(100) NOT NULL,
  request_digest varchar(64) NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tenant_operator_controls_tenant_chk CHECK (tenant_id = 'galvanik-kreile'),
  CONSTRAINT tenant_operator_controls_plan_chk CHECK (plan IN ('basis', 'pro', 'premium', 'enterprise')),
  CONSTRAINT tenant_operator_controls_mode_chk CHECK (mode IN ('active', 'grace', 'suspended', 'maintenance')),
  CONSTRAINT tenant_operator_controls_reason_chk CHECK (reason IN (
    'payment_overdue', 'contract_ended', 'maintenance', 'security_incident', 'manual_review', 'restored'
  )),
  CONSTRAINT tenant_operator_controls_semantics_chk CHECK (
    (mode = 'active' AND reason = 'restored') OR
    (mode = 'grace' AND reason IN ('payment_overdue', 'manual_review')) OR
    (mode = 'suspended' AND reason IN ('payment_overdue', 'contract_ended', 'security_incident', 'manual_review')) OR
    (mode = 'maintenance' AND reason IN ('maintenance', 'security_incident'))
  ),
  CONSTRAINT tenant_operator_controls_notice_chk CHECK (mode = 'active' OR notice IS NOT NULL),
  CONSTRAINT tenant_operator_controls_window_chk CHECK (expires_at IS NULL OR expires_at > effective_at),
  CONSTRAINT tenant_operator_controls_grace_expiry_chk CHECK (mode <> 'grace' OR expires_at IS NOT NULL),
  CONSTRAINT tenant_operator_controls_version_chk CHECK (policy_version > 0),
  CONSTRAINT tenant_operator_controls_signature_chk CHECK (signature ~ '^[A-Za-z0-9_-]{86}$'),
  CONSTRAINT tenant_operator_controls_digest_chk CHECK (request_digest ~ '^[0-9a-f]{64}$')
);

CREATE INDEX tenant_operator_controls_mode_idx
  ON public.tenant_operator_controls (mode, effective_at);

CREATE TABLE public.operator_control_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  policy_version bigint NOT NULL,
  plan varchar(20) NOT NULL,
  mode varchar(20) NOT NULL,
  reason varchar(40) NOT NULL,
  notice varchar(500),
  effective_at timestamptz NOT NULL,
  expires_at timestamptz,
  issued_at timestamptz NOT NULL,
  canonical_payload text NOT NULL,
  signature varchar(100) NOT NULL,
  request_digest varchar(64) NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT operator_control_events_tenant_version_uidx UNIQUE (tenant_id, policy_version),
  CONSTRAINT operator_control_events_tenant_chk CHECK (tenant_id = 'galvanik-kreile'),
  CONSTRAINT operator_control_events_plan_chk CHECK (plan IN ('basis', 'pro', 'premium', 'enterprise')),
  CONSTRAINT operator_control_events_mode_chk CHECK (mode IN ('active', 'grace', 'suspended', 'maintenance')),
  CONSTRAINT operator_control_events_reason_chk CHECK (reason IN (
    'payment_overdue', 'contract_ended', 'maintenance', 'security_incident', 'manual_review', 'restored'
  )),
  CONSTRAINT operator_control_events_semantics_chk CHECK (
    (mode = 'active' AND reason = 'restored') OR
    (mode = 'grace' AND reason IN ('payment_overdue', 'manual_review')) OR
    (mode = 'suspended' AND reason IN ('payment_overdue', 'contract_ended', 'security_incident', 'manual_review')) OR
    (mode = 'maintenance' AND reason IN ('maintenance', 'security_incident'))
  ),
  CONSTRAINT operator_control_events_notice_chk CHECK (mode = 'active' OR notice IS NOT NULL),
  CONSTRAINT operator_control_events_window_chk CHECK (expires_at IS NULL OR expires_at > effective_at),
  CONSTRAINT operator_control_events_grace_expiry_chk CHECK (mode <> 'grace' OR expires_at IS NOT NULL),
  CONSTRAINT operator_control_events_version_chk CHECK (policy_version > 0),
  CONSTRAINT operator_control_events_signature_chk CHECK (signature ~ '^[A-Za-z0-9_-]{86}$'),
  CONSTRAINT operator_control_events_digest_chk CHECK (request_digest ~ '^[0-9a-f]{64}$')
);

CREATE INDEX operator_control_events_tenant_received_idx
  ON public.operator_control_events (tenant_id, received_at DESC);

CREATE FUNCTION public.enforce_operator_control_monotonic_version()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $function$
BEGIN
  IF NEW.policy_version <= OLD.policy_version THEN
    RAISE EXCEPTION 'operator control policy_version must increase (% <= %)', NEW.policy_version, OLD.policy_version
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END
$function$;

CREATE TRIGGER tenant_operator_controls_monotonic_version_trg
BEFORE UPDATE ON public.tenant_operator_controls
FOR EACH ROW EXECUTE FUNCTION public.enforce_operator_control_monotonic_version();

REVOKE ALL ON FUNCTION public.enforce_operator_control_monotonic_version() FROM PUBLIC, anon, authenticated, service_role;

ALTER TABLE public.tenant_operator_controls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_operator_controls FORCE ROW LEVEL SECURITY;
ALTER TABLE public.operator_control_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operator_control_events FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.tenant_operator_controls FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.operator_control_events FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.tenant_operator_controls TO service_role;
GRANT SELECT, INSERT ON TABLE public.operator_control_events TO service_role;

DO $verification$
DECLARE
  browser_grants integer;
  forbidden_grants integer;
BEGIN
  SELECT count(*) INTO browser_grants
  FROM information_schema.role_table_grants
  WHERE table_schema = 'public'
    AND table_name IN ('tenant_operator_controls', 'operator_control_events')
    AND grantee IN ('anon', 'authenticated');
  IF browser_grants <> 0 THEN RAISE EXCEPTION 'Operator control tables expose % browser grants', browser_grants; END IF;

  SELECT count(*) INTO forbidden_grants
  FROM information_schema.role_table_grants
  WHERE table_schema = 'public'
    AND table_name IN ('tenant_operator_controls', 'operator_control_events')
    AND grantee = 'service_role'
    AND privilege_type IN ('DELETE', 'TRUNCATE');
  IF forbidden_grants <> 0 THEN RAISE EXCEPTION 'Operator control state must not be deletable'; END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.role_table_grants
    WHERE table_schema = 'public' AND table_name = 'operator_control_events'
      AND grantee = 'service_role' AND privilege_type = 'UPDATE'
  ) THEN RAISE EXCEPTION 'Operator control event history must be append-only'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.tenant_operator_controls'::regclass
      AND tgname = 'tenant_operator_controls_monotonic_version_trg'
      AND NOT tgisinternal
  ) THEN RAISE EXCEPTION 'Operator control current state must reject version regressions'; END IF;

  IF (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname IN ('tenant_operator_controls', 'operator_control_events')
        AND c.relrowsecurity AND c.relforcerowsecurity) <> 2
  THEN RAISE EXCEPTION 'Operator control tables must use forced RLS'; END IF;
END
$verification$;

COMMIT;
