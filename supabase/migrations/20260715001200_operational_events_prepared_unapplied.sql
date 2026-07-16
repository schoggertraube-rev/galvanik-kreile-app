-- PREPARED ONLY: do not apply remotely without explicit approval.
-- Canonical append-only operational event ledger. Existing legacy rows remain untrusted.

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS client_event_id uuid;

CREATE UNIQUE INDEX IF NOT EXISTS events_tenant_client_event_uidx
  ON public.events (tenant_id, client_event_id)
  WHERE client_event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS events_tenant_order_created_idx
  ON public.events (tenant_id, order_id, created_at DESC);
CREATE INDEX IF NOT EXISTS events_tenant_item_created_idx
  ON public.events (tenant_id, item_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS orders_tenant_id_uidx
  ON public.orders (tenant_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS items_tenant_order_id_uidx
  ON public.items (tenant_id, order_id, id);

ALTER TABLE public.events
  DROP CONSTRAINT IF EXISTS events_tenant_required_chk,
  ADD CONSTRAINT events_tenant_required_chk CHECK (tenant_id IS NOT NULL) NOT VALID,
  DROP CONSTRAINT IF EXISTS events_type_allowlist_chk,
  ADD CONSTRAINT events_type_allowlist_chk CHECK (event_type IN (
    'ORDER_CREATED_FROM_SCAN',
    'ORDER_CREATED_MANUAL',
    'ITEM_COUNT_CONFIRMED',
    'PHOTO_CAPTURED',
    'LABEL_PREPARED',
    'WARENEINGANG_COMPLETED',
    'STATION_STARTED',
    'STATION_COMPLETED',
    'STATION_READY',
    'QUALITY_CHECK_PASSED',
    'QUALITY_CHECK_FAILED',
    'REWORK_STARTED',
    'SHIPMENT_PREPARED',
    'SHIPMENT_SENT',
    'CUSTOMER_PICKUP',
    'COMPLAINT_OPENED',
    'COMPLAINT_RESOLVED',
    'BATH_MEASUREMENT_TAKEN',
    'BATH_BLOCKED',
    'BATH_RELEASED',
    'STOCK_LOW',
    'STOCK_REPLENISHED',
    'NOTE_ADDED',
    'COSTS_BOOKED',
    'ORDER_CREATED',
    'STATION_AUSGANG',
    'STATION_EINGANG',
    'STATION_CHANGED',
    'PROCESSING_STARTED',
    'PHOTO_ADDED',
    'STATION_COST_BOOKED'
  )) NOT VALID,
  DROP CONSTRAINT IF EXISTS events_payload_size_chk,
  ADD CONSTRAINT events_payload_size_chk CHECK (
    payload IS NULL OR octet_length(payload::text) <= 2048
  ) NOT VALID,
  DROP CONSTRAINT IF EXISTS events_tenant_order_fk,
  ADD CONSTRAINT events_tenant_order_fk
    FOREIGN KEY (tenant_id, order_id) REFERENCES public.orders (tenant_id, id) NOT VALID,
  DROP CONSTRAINT IF EXISTS events_tenant_item_fk,
  ADD CONSTRAINT events_tenant_item_fk
    FOREIGN KEY (tenant_id, order_id, item_id) REFERENCES public.items (tenant_id, order_id, id) NOT VALID;

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events FORCE ROW LEVEL SECURITY;
DO $policies$
DECLARE policy_name text;
BEGIN
  FOR policy_name IN
    SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'events'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.events', policy_name);
  END LOOP;
END
$policies$;
REVOKE ALL ON TABLE public.events FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT ON TABLE public.events TO service_role;

DO $verification$
DECLARE mutation_grants integer;
BEGIN
  IF has_table_privilege('anon', 'public.events', 'SELECT') OR
     has_table_privilege('authenticated', 'public.events', 'INSERT') THEN
    RAISE EXCEPTION 'Operational events expose browser access';
  END IF;
  SELECT count(*) INTO mutation_grants
  FROM information_schema.role_table_grants
  WHERE table_schema = 'public' AND table_name = 'events'
    AND grantee = 'service_role' AND privilege_type IN ('UPDATE', 'DELETE', 'TRUNCATE');
  IF mutation_grants <> 0 THEN RAISE EXCEPTION 'Operational events must be append-only'; END IF;
END
$verification$;
