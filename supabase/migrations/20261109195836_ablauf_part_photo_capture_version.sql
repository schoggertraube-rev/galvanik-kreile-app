-- Existing handoff photo port: reservation order_version is the capture snapshot.
-- The immutable latest handoff event may precede part-finished edits; no event is rewritten.
CREATE OR REPLACE VIEW private.v_order_station_evidence_receipts_v1
WITH (security_invoker = true)
AS
SELECT
  r.id AS reservation_id,
  evidence.id AS receipt_id,
  r.tenant_id,
  r.customer_id,
  r.order_id,
  r.item_id,
  r.transition_event_id,
  r.order_version,
  r.actor_id,
  reservation_actor.full_name AS actor_display_name,
  r.client_request_id,
  r.purpose,
  r.station,
  r.mime_type,
  r.file_bytes,
  r.content_sha256,
  r.upload_expires_at,
  r.created_at AS reserved_at,
  evidence.storage_object_id,
  evidence.storage_object_version,
  evidence.storage_created_at,
  evidence.verified_at,
  CASE
    WHEN validity.integrity_ok IS NOT TRUE THEN 'INVALID'
    WHEN evidence.id IS NULL THEN 'PENDING'
    ELSE 'FINALIZED'
  END AS receipt_state,
  validity.integrity_ok
FROM private.order_station_evidence_reservations r
LEFT JOIN public.orders orders
  ON orders.id = r.order_id
 AND orders.tenant_id = r.tenant_id
LEFT JOIN public.customers customers
  ON customers.id = r.customer_id
 AND customers.tenant_id = r.tenant_id
LEFT JOIN public.items items
  ON items.id = r.item_id
 AND items.order_id = r.order_id
 AND items.tenant_id = r.tenant_id
LEFT JOIN public.app_users reservation_actor
  ON reservation_actor.id = r.actor_id
 AND reservation_actor.tenant_id = r.tenant_id
LEFT JOIN public.events transition_event
  ON transition_event.id = r.transition_event_id
 AND transition_event.tenant_id = r.tenant_id
LEFT JOIN public.app_users transition_actor
  ON transition_actor.id = transition_event.user_id
 AND transition_actor.tenant_id = r.tenant_id
LEFT JOIN private.order_station_evidence evidence
  ON evidence.reservation_id = r.id
CROSS JOIN LATERAL (
  SELECT (
    orders.id IS NOT NULL
    AND customers.id IS NOT NULL
    AND items.id IS NOT NULL
    AND reservation_actor.id IS NOT NULL
    AND transition_event.id IS NOT NULL
    AND r.transition_event_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    AND transition_actor.id IS NOT NULL
    AND orders.customer_id = r.customer_id
    AND items.customer_id = r.customer_id
    AND NOT EXISTS (
      SELECT 1
      FROM public.items corrupt_item
      WHERE corrupt_item.order_id = r.order_id
        AND (
          corrupt_item.tenant_id IS DISTINCT FROM r.tenant_id
          OR corrupt_item.customer_id IS DISTINCT FROM r.customer_id
        )
    )
    AND transition_event.tenant_id = r.tenant_id
    AND transition_event.order_id = r.order_id
    AND transition_event.item_id IS NULL
    AND transition_event.event_type = 'ORDER_STATION_MOVED_V1'
    AND transition_event.client_event_id IS NOT NULL
    AND transition_event.correlation_id IS NOT NULL
    AND transition_event.event_schema_version = 1
    AND transition_event.aggregate_version > 0
    AND transition_event.aggregate_version <= r.order_version
    AND transition_event.from_station IN ('wareneingang', 'angenommen')
    AND transition_event.station = 'galvanik'
    AND transition_event.status = 'success'
    AND (
      evidence.id IS NULL
      OR (
        evidence.tenant_id = r.tenant_id
        AND evidence.actor_id = r.actor_id
        AND evidence.verified_mime_type = r.mime_type
        AND evidence.verified_file_bytes = r.file_bytes
        AND evidence.verified_content_sha256 = r.content_sha256
        AND evidence.storage_object_id IS NOT NULL
        AND nullif(btrim(evidence.storage_object_version), '') IS NOT NULL
        AND evidence.storage_created_at >= r.created_at
        AND evidence.storage_created_at <= r.upload_expires_at
        AND evidence.storage_created_at <= evidence.verified_at
      )
    )
  ) AS integrity_ok
) validity
WHERE nullif(btrim(current_setting('app.tenant_id', true)), '') IS NOT NULL
  AND r.tenant_id = nullif(btrim(current_setting('app.tenant_id', true)), '');

COMMENT ON CONSTRAINT events_order_station_moved_v1_contract_chk ON public.events IS
  'New order-station receipts move from the canonical angenommen station to galvanik.';
