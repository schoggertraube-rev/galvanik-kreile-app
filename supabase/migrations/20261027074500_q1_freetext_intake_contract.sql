-- Q1: A current intake item may deliberately be free text. In that case the
-- catalog fields are present in the immutable snapshot but all are null.
-- Keep catalog-backed validation strict and validate free-text rows against
-- the nullable item columns without rewriting any existing data.
CREATE OR REPLACE VIEW private.v_order_intake_receipts_v1
WITH (security_invoker = true) AS
SELECT receipt.id AS receipt_id, receipt.event_id, receipt.tenant_id, receipt.order_id,
  receipt.customer_id, receipt.actor_id, actor.full_name AS actor_display_name,
  receipt.client_event_id, receipt.correlation_id, receipt.intent_sha256, receipt.customer_mode,
  receipt.order_number, receipt.customer_display_name, receipt.due_date, receipt.note,
  receipt.items_snapshot, receipt.created_at AS recorded_at, orders.version AS current_order_version,
  orders.station AS current_station, orders.status AS current_status,
  (event.id IS NOT NULL AND orders.id IS NOT NULL AND customer.id IS NOT NULL AND actor.id IS NOT NULL
    AND event.user_id = receipt.actor_id AND event.client_event_id = receipt.client_event_id
    AND event.correlation_id = receipt.correlation_id AND event.event_type = 'ORDER_INTAKE_CREATED_V1'
    AND event.status = 'success' AND orders.customer_id = receipt.customer_id
    AND CASE
      WHEN EXISTS (SELECT 1 FROM jsonb_array_elements(receipt.items_snapshot) item WHERE item ? 'catalogServiceId')
      THEN orders.promised_due_date::date = receipt.due_date
      ELSE orders.promised_due_date IS NULL AND orders.due_date::date = receipt.due_date
    END
    AND jsonb_typeof(receipt.items_snapshot) = 'array' AND jsonb_array_length(receipt.items_snapshot) BETWEEN 1 AND 20
    AND NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(receipt.items_snapshot) snapshot(item)
      LEFT JOIN public.items line ON line.id = snapshot.item->>'id' AND line.order_id = receipt.order_id
        AND line.tenant_id = receipt.tenant_id AND line.customer_id = receipt.customer_id
      LEFT JOIN public.catalog_services service ON service.id = CASE
        WHEN snapshot.item->>'catalogServiceId' IS NOT NULL THEN (snapshot.item->>'catalogServiceId')::uuid
        ELSE NULL
      END AND service.tenant_id = receipt.tenant_id
      WHERE line.id IS NULL
        OR line.name IS DISTINCT FROM snapshot.item->>'name'
        OR line.quantity IS DISTINCT FROM (snapshot.item->>'quantity')::integer
        OR line.material IS DISTINCT FROM nullif(snapshot.item->>'material', '')
        OR line.surface_requested IS DISTINCT FROM snapshot.item->>'surfaceRequested'
        OR CASE
          WHEN snapshot.item->>'catalogServiceId' IS NOT NULL THEN
            service.id IS NULL
            OR line.catalog_service_id IS DISTINCT FROM service.id
            OR line.unit IS DISTINCT FROM snapshot.item->>'unit'
            OR round(line.preis_netto * 100)::integer IS DISTINCT FROM (snapshot.item->>'unitPriceCents')::integer
            OR line.vat_rate_basis_points IS DISTINCT FROM (snapshot.item->>'vatRateBasisPoints')::integer
          ELSE
            line.catalog_service_id IS NOT NULL
            OR line.unit IS NOT NULL
            OR line.preis_netto IS NOT NULL
            OR line.vat_rate_basis_points IS NOT NULL
        END
    )) AS integrity_ok
FROM private.order_intake_receipts receipt
LEFT JOIN public.events event ON event.id = receipt.event_id AND event.tenant_id = receipt.tenant_id
LEFT JOIN public.orders orders ON orders.id = receipt.order_id AND orders.tenant_id = receipt.tenant_id
LEFT JOIN public.customers customer ON customer.id = receipt.customer_id AND customer.tenant_id = receipt.tenant_id
LEFT JOIN public.app_users actor ON actor.id = receipt.actor_id AND actor.tenant_id = receipt.tenant_id
WHERE receipt.tenant_id = nullif(btrim(current_setting('app.tenant_id', true)), '');

COMMENT ON VIEW private.v_order_intake_receipts_v1 IS
  'Tenant-bound intake receipts; validates catalog-backed and current free-text item snapshots without rewriting data.';
