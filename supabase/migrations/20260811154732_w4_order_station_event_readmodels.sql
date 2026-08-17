-- W4-01: append-only receipt and private read-model contract for the single
-- wareneingang -> galvanik command. This is a local-only candidate migration.

ALTER TABLE public.events
  ADD COLUMN event_schema_version integer,
  ADD COLUMN correlation_id uuid,
  ADD COLUMN aggregate_version integer,
  ADD COLUMN from_station text;

ALTER TABLE public.events
  ADD CONSTRAINT events_order_station_moved_v1_contract_chk
  CHECK (
    event_type <> 'ORDER_STATION_MOVED_V1'
    OR coalesce((
      tenant_id IS NOT NULL
      AND order_id IS NOT NULL
      AND item_id IS NULL
      AND user_id IS NOT NULL
      AND client_event_id IS NOT NULL
      AND event_schema_version = 1
      AND correlation_id IS NOT NULL
      AND aggregate_version > 0
      AND from_station = 'wareneingang'
      AND station = 'galvanik'
      AND status = 'success'
    ), false)
  ) NOT VALID;

ALTER TABLE public.events
  ADD CONSTRAINT events_order_station_tenant_order_fkey
  FOREIGN KEY (tenant_id, order_id)
  REFERENCES public.orders (tenant_id, id)
  ON DELETE RESTRICT
  NOT VALID;

CREATE UNIQUE INDEX events_order_station_aggregate_version_uidx
  ON public.events (tenant_id, order_id, aggregate_version)
  WHERE event_type = 'ORDER_STATION_MOVED_V1';

CREATE UNIQUE INDEX events_order_station_correlation_uidx
  ON public.events (tenant_id, correlation_id)
  WHERE event_type = 'ORDER_STATION_MOVED_V1';

CREATE TRIGGER events_order_station_moved_v1_update_immutable
  BEFORE UPDATE ON public.events
  FOR EACH ROW
  WHEN (
    OLD.event_type = 'ORDER_STATION_MOVED_V1'
    OR NEW.event_type = 'ORDER_STATION_MOVED_V1'
  )
  EXECUTE FUNCTION public.prevent_audit_mutation();

CREATE TRIGGER events_order_station_moved_v1_delete_immutable
  BEFORE DELETE ON public.events
  FOR EACH ROW
  WHEN (OLD.event_type = 'ORDER_STATION_MOVED_V1')
  EXECUTE FUNCTION public.prevent_audit_mutation();

CREATE TRIGGER events_order_station_moved_v1_truncate_immutable
  BEFORE TRUNCATE ON public.events
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.prevent_audit_mutation();

CREATE VIEW private.v_order_station_receipts_v1
WITH (security_invoker = true)
AS
SELECT
  e.id AS event_id,
  e.tenant_id,
  e.order_id,
  e.client_event_id,
  e.correlation_id,
  e.event_schema_version,
  e.aggregate_version,
  e.from_station,
  e.station AS to_station,
  e.user_id AS actor_id,
  e.created_at AS occurred_at
FROM public.events e
JOIN public.orders o
  ON o.id = e.order_id
 AND o.tenant_id = e.tenant_id
JOIN public.customers c
  ON c.id = o.customer_id
 AND c.tenant_id = o.tenant_id
JOIN public.app_users actor
  ON actor.id = e.user_id
 AND actor.tenant_id = e.tenant_id
WHERE nullif(btrim(current_setting('app.tenant_id', true)), '') IS NOT NULL
  AND e.tenant_id = nullif(btrim(current_setting('app.tenant_id', true)), '')
  AND e.event_type = 'ORDER_STATION_MOVED_V1'
  AND e.status = 'success'
  AND e.event_schema_version = 1
  AND e.client_event_id IS NOT NULL
  AND e.correlation_id IS NOT NULL
  AND e.aggregate_version > 0
  AND e.from_station = 'wareneingang'
  AND e.station = 'galvanik'
  AND e.user_id IS NOT NULL
  AND e.item_id IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.items corrupt_item
    WHERE corrupt_item.order_id = o.id
      AND (
        corrupt_item.tenant_id IS DISTINCT FROM o.tenant_id
        OR corrupt_item.customer_id IS DISTINCT FROM o.customer_id
      )
  );

CREATE VIEW private.v_operational_station_queue_v1
WITH (security_invoker = true)
AS
SELECT
  o.id,
  o.tenant_id,
  o.version,
  o.order_number,
  o.customer_id,
  c.name AS customer_name,
  o.title,
  o.task,
  o.station,
  o.current_station,
  o.current_station_id,
  o.status,
  o.priority_computed AS risk,
  o.intake_date,
  o.due_date,
  o.created_at,
  (
    c.id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.items corrupt_item
      WHERE corrupt_item.order_id = o.id
        AND (
          corrupt_item.tenant_id IS DISTINCT FROM o.tenant_id
          OR corrupt_item.customer_id IS DISTINCT FROM o.customer_id
        )
    )
  ) AS tenant_integrity_ok,
  COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', i.id,
        'tenantId', i.tenant_id,
        'orderId', i.order_id,
        'customerId', i.customer_id,
        'name', i.name,
        'quantity', i.quantity,
        'currentStationId', i.current_station_id,
        'material', i.material,
        'surfaceRequested', i.surface_requested,
        'photoIds', i.photo_ids,
        'photo', i.photo,
        'repairTypes', i.repair_types,
        'stationSequence', i.station_sequence,
        'currentStep', i.current_step,
        'internalNotes', i.internal_notes,
        'createdAt', i.created_at
      )
      ORDER BY i.created_at, i.id
    ) FILTER (WHERE i.id IS NOT NULL),
    '[]'::jsonb
  ) AS parts
FROM public.orders o
LEFT JOIN public.customers c
  ON c.id = o.customer_id
 AND c.tenant_id = o.tenant_id
LEFT JOIN public.items i
  ON i.order_id = o.id
 AND i.tenant_id = o.tenant_id
 AND i.customer_id = o.customer_id
WHERE nullif(btrim(current_setting('app.tenant_id', true)), '') IS NOT NULL
  AND o.tenant_id = nullif(btrim(current_setting('app.tenant_id', true)), '')
  AND coalesce(o.source, 'manual') NOT IN ('seed', 'test', 'demo', 'integration-test')
  AND coalesce(o.order_number, '') NOT ILIKE 'A-SEED-%'
  AND coalesce(o.order_number, '') NOT ILIKE '%TEST%'
GROUP BY
  o.id,
  o.tenant_id,
  o.version,
  o.order_number,
  o.customer_id,
  c.id,
  c.name,
  o.title,
  o.task,
  o.station,
  o.current_station,
  o.current_station_id,
  o.status,
  o.priority_computed,
  o.intake_date,
  o.due_date,
  o.created_at;

COMMENT ON VIEW private.v_order_station_receipts_v1 IS
  'W4 v1 tenant-bound persisted receipt read port for order station transitions.';

COMMENT ON VIEW private.v_operational_station_queue_v1 IS
  'W4 v1 tenant-bound operational queue read port; corrupt ownership is flagged without projecting foreign child data.';
