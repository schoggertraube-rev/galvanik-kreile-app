-- H18.8d: P1b made "angenommen" the canonical intake station. Align the
-- correction write contract while preserving historical wareneingang receipts.

ALTER TABLE public.events
  DROP CONSTRAINT events_order_station_corrected_v1_contract_chk;

ALTER TABLE public.events
  ADD CONSTRAINT events_order_station_corrected_v1_contract_chk
  CHECK (
    event_type <> 'ORDER_STATION_CORRECTED_V1'
    OR coalesce((
      tenant_id IS NOT NULL
      AND order_id IS NOT NULL
      AND item_id IS NULL
      AND user_id IS NOT NULL
      AND client_event_id IS NOT NULL
      AND event_schema_version = 1
      AND correlation_id IS NOT NULL
      AND aggregate_version > 0
      AND from_station = 'galvanik'
      AND station = 'angenommen'
      AND status = 'success'
      AND description IS NOT NULL
      AND description = btrim(description)
      AND char_length(description) BETWEEN 5 AND 500
    ), false)
  ) NOT VALID;

CREATE OR REPLACE VIEW private.v_order_station_correction_receipts_v1
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
  e.created_at AS occurred_at,
  e.description AS reason
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
  AND e.event_type = 'ORDER_STATION_CORRECTED_V1'
  AND e.status = 'success'
  AND e.event_schema_version = 1
  AND e.client_event_id IS NOT NULL
  AND e.correlation_id IS NOT NULL
  AND e.aggregate_version > 0
  AND e.from_station = 'galvanik'
  AND e.station IN ('wareneingang', 'angenommen')
  AND e.user_id IS NOT NULL
  AND e.item_id IS NULL
  AND nullif(btrim(e.description), '') IS NOT NULL
  AND char_length(btrim(e.description)) BETWEEN 5 AND 500
  AND NOT EXISTS (
    SELECT 1
    FROM public.items corrupt_item
    WHERE corrupt_item.order_id = o.id
      AND (
        corrupt_item.tenant_id IS DISTINCT FROM o.tenant_id
        OR corrupt_item.customer_id IS DISTINCT FROM o.customer_id
      )
  );

COMMENT ON CONSTRAINT events_order_station_corrected_v1_contract_chk ON public.events IS
  'New correction receipts move from galvanik to the canonical angenommen station.';

COMMENT ON VIEW private.v_order_station_correction_receipts_v1 IS
  'Tenant-bound correction receipts; preserves historical wareneingang and accepts canonical angenommen.';
