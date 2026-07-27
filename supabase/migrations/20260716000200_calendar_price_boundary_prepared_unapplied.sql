-- PREPARED ONLY: do not apply remotely without explicit approval.
-- Closes legacy public Data API policies for calendar_events and price_lines.
-- App authorization and tenant ownership remain enforced in Server Actions.

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '5min';

DO $boundary$
DECLARE
  relation_name text;
  policy_name text;
  protected_relations constant text[] := ARRAY['calendar_events', 'price_lines'];
BEGIN
  FOREACH relation_name IN ARRAY protected_relations LOOP
    IF to_regclass(format('public.%I', relation_name)) IS NULL THEN
      CONTINUE;
    END IF;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', relation_name);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', relation_name);

    FOR policy_name IN
      SELECT policyname
      FROM pg_policies
      WHERE schemaname = 'public' AND tablename = relation_name
    LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', policy_name, relation_name);
    END LOOP;

    EXECUTE format(
      'REVOKE ALL PRIVILEGES ON TABLE public.%I FROM PUBLIC, anon, authenticated, service_role',
      relation_name
    );
  END LOOP;
END
$boundary$;

-- Calendar events are created atomically by the operational order service.
-- No browser role and no DELETE privilege is granted.
GRANT SELECT, INSERT, UPDATE ON TABLE public.calendar_events TO service_role;

-- Price mutations stay quarantined until their versioned approval,
-- idempotency and audit contract exists.
GRANT SELECT ON TABLE public.price_lines TO service_role;

CREATE INDEX IF NOT EXISTS calendar_events_tenant_starts_idx
  ON public.calendar_events (tenant_id, starts_at);
CREATE INDEX IF NOT EXISTS calendar_events_tenant_order_idx
  ON public.calendar_events (tenant_id, order_id);
CREATE INDEX IF NOT EXISTS price_lines_tenant_order_sort_idx
  ON public.price_lines (tenant_id, order_id, sort_order);

DO $verification$
DECLARE
  exposed_count integer;
  delete_count integer;
BEGIN
  SELECT count(*) INTO exposed_count
  FROM information_schema.role_table_grants
  WHERE table_schema = 'public'
    AND table_name = ANY (ARRAY['calendar_events', 'price_lines'])
    AND grantee IN ('PUBLIC', 'anon', 'authenticated');

  IF exposed_count <> 0 THEN
    RAISE EXCEPTION 'Calendar/price Data API boundary still exposes % client grants', exposed_count;
  END IF;

  SELECT count(*) INTO delete_count
  FROM information_schema.role_table_grants
  WHERE table_schema = 'public'
    AND table_name = ANY (ARRAY['calendar_events', 'price_lines'])
    AND grantee = 'service_role'
    AND privilege_type = 'DELETE';

  IF delete_count <> 0 THEN
    RAISE EXCEPTION 'Calendar/price boundary unexpectedly grants DELETE';
  END IF;
END
$verification$;
