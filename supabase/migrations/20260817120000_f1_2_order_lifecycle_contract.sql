-- F1.2 (D-ARCH-002): normalize the naming contract for the operational order
-- station lifecycle. The lifecycle names are angenommen -> galvanik -> fertig
-- -> abgeholt (+ bezahlt as a separate accounting axis); F1.2 itself only
-- builds the wareneingang(angenommen) -> galvanik transition and its D-F12-004
-- correction command.
--
-- This is a minimal, idempotent, local-only data normalization: it rewrites
-- only rows whose full station triple (station, current_station,
-- current_station_id) is already internally consistent for wareneingang or
-- galvanik, and whose status still carries a pre-F1.2 legacy label
-- ('in_progress' or 'ready'). Rows are mapped 1:1 onto the new station-truth
-- names, never the other way, and the statement is a no-op on re-run because
-- the WHERE clause excludes rows that already carry the new names. No other
-- rows, columns, or objects are touched; no remote/production mutation.

UPDATE public.orders
SET status = CASE station
  WHEN 'wareneingang' THEN 'angenommen'
  WHEN 'galvanik' THEN 'galvanik'
END
WHERE status IN ('in_progress', 'ready')
  AND station IN ('wareneingang', 'galvanik')
  AND current_station = station
  AND current_station_id = station;

-- D-F12-004: DB-level contract for the correction event, mirroring the shape
-- of the existing forward ORDER_STATION_MOVED_V1 contract (W4-01) exactly,
-- but for the galvanik -> wareneingang reversal and its mandatory, trimmed
-- reason. NOT VALID so it applies only to new rows going forward.
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
      AND station = 'wareneingang'
      AND status = 'success'
      AND description IS NOT NULL
      AND description = btrim(description)
      AND char_length(description) BETWEEN 5 AND 500
    ), false)
  ) NOT VALID;

-- Correction events are immutable append-only receipts, exactly like the
-- forward MOVED events (W4-01). TRUNCATE on public.events is already
-- fail-closed via the existing statement-level guard; no redundant trigger.
CREATE TRIGGER events_order_station_corrected_v1_update_immutable
  BEFORE UPDATE ON public.events
  FOR EACH ROW
  WHEN (
    OLD.event_type = 'ORDER_STATION_CORRECTED_V1'
    OR NEW.event_type = 'ORDER_STATION_CORRECTED_V1'
  )
  EXECUTE FUNCTION public.prevent_audit_mutation();

CREATE TRIGGER events_order_station_corrected_v1_delete_immutable
  BEFORE DELETE ON public.events
  FOR EACH ROW
  WHEN (OLD.event_type = 'ORDER_STATION_CORRECTED_V1')
  EXECUTE FUNCTION public.prevent_audit_mutation();

-- Widen the two forward-only partial unique indexes (W4-01) so the
-- aggregate-version and correlation uniqueness contracts cover both the
-- forward MOVED event and its CORRECTED reversal on the same aggregate.
DROP INDEX public.events_order_station_aggregate_version_uidx;
DROP INDEX public.events_order_station_correlation_uidx;

CREATE UNIQUE INDEX events_order_station_aggregate_version_uidx
  ON public.events (tenant_id, order_id, aggregate_version)
  WHERE event_type IN ('ORDER_STATION_MOVED_V1', 'ORDER_STATION_CORRECTED_V1');

CREATE UNIQUE INDEX events_order_station_correlation_uidx
  ON public.events (tenant_id, correlation_id)
  WHERE event_type IN ('ORDER_STATION_MOVED_V1', 'ORDER_STATION_CORRECTED_V1');

-- Tenant-bound persisted receipt read port for the correction command,
-- mirroring private.v_order_station_receipts_v1 (W4-01) exactly, but for the
-- reverse galvanik -> wareneingang correction and its mandatory reason.
CREATE VIEW private.v_order_station_correction_receipts_v1
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
  AND e.station = 'wareneingang'
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

COMMENT ON VIEW private.v_order_station_correction_receipts_v1 IS
  'F1.2 v1 tenant-bound persisted receipt read port for order station correction reversals.';
