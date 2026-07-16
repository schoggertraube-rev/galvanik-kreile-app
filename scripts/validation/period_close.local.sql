\set ON_ERROR_STOP on

DO $validation$
DECLARE
  clean_period uuid := gen_random_uuid();
  blocked_period uuid := gen_random_uuid();
  actor uuid := gen_random_uuid();
  preliminary_request uuid := gen_random_uuid();
  final_request uuid := gen_random_uuid();
  first_status text;
  first_replayed boolean;
  audit_count integer;
BEGIN
  INSERT INTO public.periode (id, tenant_id, jahr, monat, status)
  VALUES
    (clean_period, 'galvanik-kreile', 2026, 6, 'offen'),
    (blocked_period, 'galvanik-kreile', 2026, 7, 'offen');
  INSERT INTO public.beleg (periode_id, konto_id, kostenstelle_id, status)
  VALUES (blocked_period, NULL, NULL, 'erfasst');

  BEGIN
    PERFORM * FROM public.finance_close_period(blocked_period, 'vorlaeufig_geschlossen', actor, gen_random_uuid());
    RAISE EXCEPTION 'Expected blocker rejection';
  EXCEPTION WHEN object_not_in_prerequisite_state THEN
    IF SQLERRM NOT LIKE 'PERIOD_CLOSE_BLOCKED:%' THEN RAISE; END IF;
  END;

  SELECT status, replayed INTO first_status, first_replayed
  FROM public.finance_close_period(clean_period, 'vorlaeufig_geschlossen', actor, preliminary_request);
  IF first_status <> 'vorlaeufig_geschlossen' OR first_replayed THEN
    RAISE EXCEPTION 'Preliminary close was not confirmed';
  END IF;

  SELECT status, replayed INTO first_status, first_replayed
  FROM public.finance_close_period(clean_period, 'vorlaeufig_geschlossen', actor, preliminary_request);
  IF first_status <> 'vorlaeufig_geschlossen' OR NOT first_replayed THEN
    RAISE EXCEPTION 'Idempotent replay was not recognized';
  END IF;

  PERFORM * FROM public.finance_close_period(clean_period, 'final_geschlossen', actor, final_request);
  SELECT count(*) INTO audit_count FROM public.bh_audit_log WHERE entitaet_id = clean_period;
  IF audit_count <> 2 THEN RAISE EXCEPTION 'Expected exactly two period audit receipts, got %', audit_count; END IF;

  BEGIN
    INSERT INTO public.beleg (periode_id, konto_id, kostenstelle_id, status)
    VALUES (clean_period, gen_random_uuid(), gen_random_uuid(), 'erfasst');
    RAISE EXCEPTION 'Expected immutable final period';
  EXCEPTION WHEN object_not_in_prerequisite_state THEN
    IF SQLERRM <> 'FINAL_PERIOD_IMMUTABLE' THEN RAISE; END IF;
  END;

  IF has_table_privilege('authenticated', 'public.periode', 'SELECT') OR
     has_table_privilege('service_role', 'public.periode', 'UPDATE') THEN
    RAISE EXCEPTION 'Period permissions are too broad';
  END IF;
END
$validation$;

SELECT 'period_close_ok' AS result;
