-- PREPARED ONLY: do not apply remotely without explicit approval.
-- Canonical append-only operational event ledger. The preceding 01150 source
-- migration reconciles the validated 13-column remote source without deleting
-- or fabricating legacy history.

BEGIN;

SET LOCAL search_path = pg_catalog, pg_temp;

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
  ADD CONSTRAINT events_tenant_required_chk CHECK (
    tenant_id IS NOT NULL AND order_id IS NOT NULL AND status IS NOT NULL
  ) NOT VALID,
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
    'STATION_COST_BOOKED',
    'QUOTE_CREATED',
    'CUSTOMER_BEHAVIOR_NOTE_ADDED',
    'ORDER_UPDATED',
    'ORDER_CANCELLED',
    'PAYMENT_FAILED',
    'PAYMENT_REVIEW_REQUIRED',
    'PAYMENT_PAID'
  )) NOT VALID,
  DROP CONSTRAINT IF EXISTS events_status_allowlist_chk,
  ADD CONSTRAINT events_status_allowlist_chk CHECK (
    status IN ('success', 'warning')
  ) NOT VALID,
  DROP CONSTRAINT IF EXISTS events_payload_size_chk,
  ADD CONSTRAINT events_payload_size_chk CHECK (
    payload IS NULL OR (
      jsonb_typeof(payload) = 'object'
      AND octet_length(payload::text) <= 8192
    )
  ) NOT VALID,
  DROP CONSTRAINT IF EXISTS events_tenant_order_fk,
  ADD CONSTRAINT events_tenant_order_fk
    FOREIGN KEY (tenant_id, order_id) REFERENCES public.orders (tenant_id, id) NOT VALID,
  DROP CONSTRAINT IF EXISTS events_tenant_item_fk,
  ADD CONSTRAINT events_tenant_item_fk
    FOREIGN KEY (tenant_id, order_id, item_id) REFERENCES public.items (tenant_id, order_id, id) NOT VALID;

ALTER TABLE public.events
  VALIDATE CONSTRAINT events_tenant_required_chk,
  VALIDATE CONSTRAINT events_type_allowlist_chk,
  VALIDATE CONSTRAINT events_status_allowlist_chk,
  VALIDATE CONSTRAINT events_payload_size_chk,
  VALIDATE CONSTRAINT events_tenant_order_fk,
  VALIDATE CONSTRAINT events_tenant_item_fk;

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

-- Preserve the historical station-duration projection without preserving its
-- former cross-tenant/definer behavior. It remains a legacy compatibility view;
-- the active performance adapter does not claim it as a live KPI source.
CREATE OR REPLACE VIEW public.v_analyse_station_durchlauf
WITH (security_invoker = true, security_barrier = true) AS
WITH eingang AS (
  SELECT event_record.order_id, event_record.station, min(event_record.created_at) AS ts_ein
  FROM public.events event_record
  WHERE event_record.tenant_id = 'galvanik-kreile'
    AND event_record.event_type = 'STATION_EINGANG'
    AND event_record.station IS NOT NULL
  GROUP BY event_record.order_id, event_record.station
),
ausgang AS (
  SELECT event_record.order_id, event_record.station, max(event_record.created_at) AS ts_aus
  FROM public.events event_record
  WHERE event_record.tenant_id = 'galvanik-kreile'
    AND event_record.event_type = 'STATION_AUSGANG'
    AND event_record.station IS NOT NULL
  GROUP BY event_record.order_id, event_record.station
)
SELECT
  eingang.station,
  round(avg(extract(epoch FROM (ausgang.ts_aus - eingang.ts_ein)) / 86400.0)::numeric, 1) AS avg_tage,
  count(*) AS n,
  (
    SELECT count(*)
    FROM public.items item_record
    WHERE item_record.tenant_id = 'galvanik-kreile'
      AND item_record.current_station_id = eingang.station
  ) AS teile_aktuell
FROM eingang
JOIN ausgang
  ON ausgang.order_id = eingang.order_id
 AND ausgang.station = eingang.station
WHERE eingang.ts_ein >= now() - interval '30 days'
  AND ausgang.ts_aus >= eingang.ts_ein
GROUP BY eingang.station;

REVOKE ALL ON TABLE public.v_analyse_station_durchlauf
  FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.v_analyse_station_durchlauf TO service_role;

DO $realtime$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'events'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.events;
  END IF;
END
$realtime$;

DO $verification$
DECLARE
  mutation_grants integer;
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

  IF EXISTS (
    SELECT 1
    FROM pg_constraint constraint_record
    WHERE constraint_record.conrelid = 'public.events'::regclass
      AND constraint_record.conname IN (
        'events_tenant_required_chk',
        'events_type_allowlist_chk',
        'events_status_allowlist_chk',
        'events_payload_size_chk',
        'events_tenant_order_fk',
        'events_tenant_item_fk'
      )
      AND NOT constraint_record.convalidated
  ) OR 6 <> (
    SELECT count(*)
    FROM pg_constraint constraint_record
    WHERE constraint_record.conrelid = 'public.events'::regclass
      AND constraint_record.conname IN (
        'events_tenant_required_chk',
        'events_type_allowlist_chk',
        'events_status_allowlist_chk',
        'events_payload_size_chk',
        'events_tenant_order_fk',
        'events_tenant_item_fk'
      )
  ) THEN
    RAISE EXCEPTION 'Operational events constraints are missing or unvalidated';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_class view_record
    WHERE view_record.oid = 'public.v_analyse_station_durchlauf'::regclass
      AND view_record.reloptions @> ARRAY['security_invoker=true', 'security_barrier=true']
  ) OR has_table_privilege('anon', 'public.v_analyse_station_durchlauf', 'SELECT')
     OR has_table_privilege('authenticated', 'public.v_analyse_station_durchlauf', 'SELECT')
     OR NOT has_table_privilege('service_role', 'public.v_analyse_station_durchlauf', 'SELECT') THEN
    RAISE EXCEPTION 'Operational station compatibility view boundary drifted';
  END IF;
END
$verification$;

COMMIT;
