\set ON_ERROR_STOP on

BEGIN;

DO $assertions$
DECLARE
  protected_count integer;
  browser_grants integer;
  forbidden_grants integer;
BEGIN
  SELECT count(*) INTO protected_count
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname IN ('tenant_operator_controls', 'operator_control_events')
    AND c.relrowsecurity
    AND c.relforcerowsecurity;
  IF protected_count <> 2 THEN RAISE EXCEPTION 'expected two forced-RLS tables, got %', protected_count; END IF;

  SELECT count(*) INTO browser_grants
  FROM information_schema.role_table_grants
  WHERE table_schema = 'public'
    AND table_name IN ('tenant_operator_controls', 'operator_control_events')
    AND grantee IN ('anon', 'authenticated');
  IF browser_grants <> 0 THEN RAISE EXCEPTION 'unexpected browser grants: %', browser_grants; END IF;

  SELECT count(*) INTO forbidden_grants
  FROM information_schema.role_table_grants
  WHERE table_schema = 'public'
    AND table_name IN ('tenant_operator_controls', 'operator_control_events')
    AND grantee = 'service_role'
    AND privilege_type IN ('DELETE', 'TRUNCATE');
  IF forbidden_grants <> 0 THEN RAISE EXCEPTION 'unexpected delete/truncate grants: %', forbidden_grants; END IF;
END
$assertions$;

INSERT INTO public.operator_control_events (
  tenant_id, policy_version, plan, mode, reason, notice,
  effective_at, expires_at, issued_at, canonical_payload, signature, request_digest
) VALUES (
  'galvanik-kreile', 1, 'pro', 'active', 'restored', NULL,
  '2026-07-15T12:00:00Z', NULL, '2026-07-15T11:59:00Z', '{}',
  repeat('A', 86), repeat('a', 64)
);

INSERT INTO public.tenant_operator_controls (
  tenant_id, policy_version, plan, mode, reason, notice,
  effective_at, expires_at, issued_at, canonical_payload, signature, request_digest
) VALUES (
  'galvanik-kreile', 1, 'pro', 'active', 'restored', NULL,
  '2026-07-15T12:00:00Z', NULL, '2026-07-15T11:59:00Z', '{}',
  repeat('A', 86), repeat('a', 64)
);

DO $constraint_checks$
BEGIN
  BEGIN
    INSERT INTO public.operator_control_events (
      tenant_id, policy_version, plan, mode, reason, notice,
      effective_at, expires_at, issued_at, canonical_payload, signature, request_digest
    ) VALUES (
      'galvanik-kreile', 2, 'pro', 'grace', 'payment_overdue', NULL,
      now(), now() + interval '1 day', now(), '{}', repeat('A', 86), repeat('b', 64)
    );
    RAISE EXCEPTION 'missing notice was accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  BEGIN
    UPDATE public.tenant_operator_controls
    SET plan = 'basis'
    WHERE tenant_id = 'galvanik-kreile';
    RAISE EXCEPTION 'same-version mutation was accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
END
$constraint_checks$;

SET LOCAL ROLE service_role;

UPDATE public.tenant_operator_controls
SET policy_version = 2,
    plan = 'basis',
    mode = 'grace',
    reason = 'payment_overdue',
    notice = 'Zahlungsfrist überschritten; transparenter Übergangszeitraum.',
    effective_at = now(),
    expires_at = now() + interval '7 days',
    issued_at = now(),
    canonical_payload = '{"version":2}',
    signature = repeat('B', 86),
    request_digest = repeat('b', 64),
    updated_at = now()
WHERE tenant_id = 'galvanik-kreile';

DO $grant_checks$
BEGIN
  BEGIN
    UPDATE public.operator_control_events SET plan = 'basis' WHERE tenant_id = 'galvanik-kreile';
    RAISE EXCEPTION 'append-only event update was accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  BEGIN
    DELETE FROM public.tenant_operator_controls WHERE tenant_id = 'galvanik-kreile';
    RAISE EXCEPTION 'control deletion was accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END
$grant_checks$;

RESET ROLE;

DO $final_state$
DECLARE
  current_version bigint;
  event_count integer;
BEGIN
  SELECT policy_version INTO current_version
  FROM public.tenant_operator_controls
  WHERE tenant_id = 'galvanik-kreile';
  IF current_version <> 2 THEN RAISE EXCEPTION 'unexpected current version: %', current_version; END IF;

  SELECT count(*) INTO event_count
  FROM public.operator_control_events
  WHERE tenant_id = 'galvanik-kreile';
  IF event_count <> 1 THEN RAISE EXCEPTION 'unexpected audit count: %', event_count; END IF;
END
$final_state$;

SELECT 'operator_control_validation_ok' AS result;

ROLLBACK;
