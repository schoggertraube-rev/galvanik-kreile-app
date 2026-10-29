-- H18.6: an immutable intake receipt remains valid after a later, receipted
-- promised-date change. The current due date must equal either the intake
-- date or the newest valid ORDER_PROMISED_DUE_DATE_CHANGED_V1 event.

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
    AND (orders.promised_due_date IS NULL OR orders.due_date::date = orders.promised_due_date::date)
    AND (
      coalesce(orders.promised_due_date, orders.due_date)::date = receipt.due_date
      OR coalesce(orders.promised_due_date, orders.due_date)::date::text = (
        SELECT due_event.payload->>'promisedDueDate'
        FROM public.events due_event
        JOIN public.app_users due_actor
          ON due_actor.tenant_id = due_event.tenant_id
         AND due_actor.id = due_event.user_id
        WHERE due_event.tenant_id = receipt.tenant_id
          AND due_event.order_id = receipt.order_id
          AND due_event.event_type = 'ORDER_PROMISED_DUE_DATE_CHANGED_V1'
          AND due_event.event_schema_version = 1
          AND due_event.status = 'success'
          AND due_event.client_event_id IS NOT NULL
          AND due_event.correlation_id IS NOT NULL
          AND due_event.aggregate_version <= orders.version
          AND due_event.payload ? 'promisedDueDate'
          AND due_event.payload->>'promisedDueDate' ~ '^\d{4}-\d{2}-\d{2}$'
          AND due_event.notes = btrim(due_event.notes)
          AND length(due_event.notes) BETWEEN 3 AND 500
        ORDER BY due_event.aggregate_version DESC, due_event.created_at DESC, due_event.id DESC
        LIMIT 1
      )
    )
    AND (receipt.intake_term_status IS NULL OR receipt.intake_term_status = orders.intake_term_status)
    AND (receipt.intake_source IS NULL OR receipt.intake_source = orders.intake_source)
    AND (
      NOT (event.payload ? 'handoverMode')
      OR (
        event.payload->>'handoverMode' = orders.handover_mode
        AND event.payload->>'paymentMode' = orders.payment_mode
      )
    )
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
        OR line.execution_requested IS DISTINCT FROM coalesce(snapshot.item->>'executionRequested', 'offen')
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
            OR line.vat_rate_basis_points IS NOT NULL
            OR NOT (
              line.preis_netto IS NULL
              OR EXISTS (
                SELECT 1
                FROM public.events price_event
                CROSS JOIN LATERAL jsonb_array_elements(price_event.payload->'prices') price(entry)
                JOIN public.app_users price_actor
                  ON price_actor.id = price_event.user_id AND price_actor.tenant_id = price_event.tenant_id
                WHERE price_event.tenant_id = receipt.tenant_id
                  AND price_event.order_id = receipt.order_id
                  AND price_event.event_type = 'ORDER_INVOICE_PRICES_SET_V1'
                  AND price_event.event_schema_version = 1
                  AND price_event.status = 'success'
                  AND price_event.aggregate_version <= orders.version
                  AND price_event.payload ? 'requestHash'
                  AND jsonb_typeof(price_event.payload->'prices') = 'array'
                  AND price.entry->>'itemId' = line.id
                  AND coalesce(price.entry->>'unitPriceCents', '') ~ '^[1-9][0-9]{0,8}$'
                  AND (price.entry->>'unitPriceCents')::integer = round(line.preis_netto * 100)::integer
              )
            )
        END
    )) AS integrity_ok,
  orders.handover_mode,
  orders.payment_mode,
  receipt.intake_term_status,
  receipt.intake_source
FROM private.order_intake_receipts receipt
LEFT JOIN public.events event ON event.id = receipt.event_id AND event.tenant_id = receipt.tenant_id
LEFT JOIN public.orders orders ON orders.id = receipt.order_id AND orders.tenant_id = receipt.tenant_id
LEFT JOIN public.customers customer ON customer.id = receipt.customer_id AND customer.tenant_id = receipt.tenant_id
LEFT JOIN public.app_users actor ON actor.id = receipt.actor_id AND actor.tenant_id = receipt.tenant_id
WHERE receipt.tenant_id = nullif(btrim(current_setting('app.tenant_id', true)), '');

COMMENT ON VIEW private.v_order_intake_receipts_v1 IS
  'Tenant-bound intake receipts; later promised-date changes remain valid only through the newest matching immutable event.';
