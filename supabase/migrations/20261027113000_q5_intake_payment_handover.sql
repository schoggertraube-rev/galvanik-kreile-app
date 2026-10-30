-- Q5: persist the order-specific payment and handover choices made at intake.
-- Existing orders stay nullable for handover because no historic choice can be
-- inferred honestly. New F1 intake rows always provide both values.

ALTER TABLE public.orders
  ADD COLUMN handover_mode text;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_q5_handover_mode_chk
    CHECK (handover_mode IS NULL OR handover_mode IN ('pickup', 'shipping'));

COMMENT ON COLUMN public.orders.handover_mode IS
  'Q5 handover choice captured at order intake: pickup or shipping; NULL only for historic orders.';

CREATE OR REPLACE FUNCTION private.guard_f1_5_order_payment_mode_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF NEW.payment_mode_version = 0
     AND (
       NEW.payment_mode = 'vorkasse'
       OR (
         NEW.source = 'F1_ORDER_INTAKE'
         AND NEW.payment_mode IN ('vorkasse', 'abholung', 'rechnung')
         AND NEW.handover_mode IN ('pickup', 'shipping')
       )
     ) THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'ORDER_PAYMENT_MODE_INTAKE_VALUE_REQUIRED' USING ERRCODE = '23514';
END;
$$;

REVOKE ALL ON FUNCTION private.guard_f1_5_order_payment_mode_insert()
  FROM PUBLIC, anon, authenticated;

ALTER TABLE public.events
  DROP CONSTRAINT events_order_intake_created_v1_contract_chk;

ALTER TABLE public.events
  ADD CONSTRAINT events_order_intake_created_v1_contract_chk
  CHECK (
    event_type <> 'ORDER_INTAKE_CREATED_V1'
    OR coalesce((
      tenant_id IS NOT NULL
      AND order_id IS NOT NULL
      AND item_id IS NULL
      AND user_id IS NOT NULL
      AND client_event_id IS NOT NULL
      AND event_schema_version = 1
      AND correlation_id IS NOT NULL
      AND aggregate_version = 1
      AND from_station IS NULL
      AND station = 'wareneingang'
      AND status = 'success'
      AND jsonb_typeof(payload) = 'object'
      AND payload->>'intentSha256' ~ '^[0-9a-f]{64}$'
      AND (
        payload = jsonb_build_object('intentSha256', payload->>'intentSha256')
        OR payload = jsonb_build_object(
          'intentSha256', payload->>'intentSha256',
          'handoverMode', payload->>'handoverMode',
          'paymentMode', payload->>'paymentMode'
        )
      )
      AND (
        NOT (payload ? 'handoverMode')
        OR (
          payload->>'handoverMode' IN ('pickup', 'shipping')
          AND payload->>'paymentMode' IN ('vorkasse', 'abholung', 'rechnung')
        )
      )
    ), false)
  ) NOT VALID;

ALTER TABLE public.events
  DROP CONSTRAINT events_order_picked_up_v1_contract_chk;

ALTER TABLE public.events
  ADD CONSTRAINT events_order_picked_up_v1_contract_chk
  CHECK (
    event_type <> 'ORDER_PICKED_UP_V1'
    OR coalesce((
      tenant_id IS NOT NULL
      AND order_id IS NOT NULL
      AND user_id IS NOT NULL
      AND client_event_id IS NOT NULL
      AND correlation_id IS NOT NULL
      AND event_schema_version = 1
      AND aggregate_version > 0
      AND item_id IS NULL
      AND status = 'success'
      AND from_station = 'fertig'
      AND station = 'abgeholt'
      AND jsonb_typeof(payload) = 'object'
      AND payload = jsonb_build_object(
        'orderId', payload->'orderId',
        'mode', payload->'mode',
        'orderVersion', payload->'orderVersion',
        'paymentMode', payload->'paymentMode',
        'paymentStatus', payload->'paymentStatus',
        'openAmountCents', payload->'openAmountCents',
        'gateAllowed', payload->'gateAllowed'
      )
      AND jsonb_typeof(payload->'orderId') = 'string'
      AND payload->>'orderId' = order_id
      AND payload->>'mode' IN ('versand', 'abholung')
      AND payload->>'paymentMode' IN ('vorkasse', 'abholung', 'rechnung')
      AND payload->>'paymentStatus' IN ('offen', 'teilbezahlt', 'bezahlt')
      AND jsonb_typeof(payload->'gateAllowed') = 'boolean'
      AND payload->>'gateAllowed' = 'true'
      AND CASE
        WHEN jsonb_typeof(payload->'orderVersion') = 'number'
         AND jsonb_typeof(payload->'openAmountCents') = 'number'
        THEN CASE
          WHEN (payload->>'orderVersion') ~ '^[0-9]+$'
           AND (payload->>'openAmountCents') ~ '^[0-9]+$'
          THEN (payload->>'orderVersion')::numeric = aggregate_version
            AND (payload->>'orderVersion')::numeric > 0
            AND (payload->>'openAmountCents')::numeric >= 0
            AND CASE
              WHEN payload->>'paymentMode' IN ('rechnung', 'abholung') THEN true
              ELSE payload->>'paymentStatus' = 'bezahlt'
                AND (payload->>'openAmountCents')::numeric = 0
            END
          ELSE false
        END
        ELSE false
      END
    ), false)
  ) NOT VALID;

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
                  ON price_actor.id = price_event.user_id
                 AND price_actor.tenant_id = price_event.tenant_id
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
  orders.payment_mode
FROM private.order_intake_receipts receipt
LEFT JOIN public.events event ON event.id = receipt.event_id AND event.tenant_id = receipt.tenant_id
LEFT JOIN public.orders orders ON orders.id = receipt.order_id AND orders.tenant_id = receipt.tenant_id
LEFT JOIN public.customers customer ON customer.id = receipt.customer_id AND customer.tenant_id = receipt.tenant_id
LEFT JOIN public.app_users actor ON actor.id = receipt.actor_id AND actor.tenant_id = receipt.tenant_id
WHERE receipt.tenant_id = nullif(btrim(current_setting('app.tenant_id', true)), '');

COMMENT ON VIEW private.v_order_intake_receipts_v1 IS
  'Tenant-bound Q5 intake receipts including the persisted payment and handover choice.';

CREATE OR REPLACE VIEW private.v_payment_summary_v1
WITH (security_invoker = true)
AS
SELECT
  invoice.id AS invoice_id,
  invoice.tenant_id,
  invoice.order_id,
  orders.order_number,
  invoice.invoice_number,
  invoice.gross_amount_cents AS total_amount_cents,
  invoice.payment_contract_version,
  orders.payment_mode,
  invoice.payment_status,
  invoice.payment_open_amount_cents,
  invoice.payment_paid_amount_cents,
  invoice.payment_currency,
  invoice.payment_method,
  invoice.payment_paid_at,
  invoice.payment_receipt_id,
  invoice.payment_event_id,
  invoice.payment_correlation_id,
  invoice.payment_version,
  (
    orders.payment_mode IN ('rechnung', 'abholung')
    OR invoice.payment_status = 'bezahlt'
  ) AS goods_out_allowed,
  coalesce(
    invoice.payment_contract_version = 1
    AND invoice.tenant_id = current_setting('app.tenant_id', true)
    AND orders.id IS NOT NULL
    AND orders.tenant_id = invoice.tenant_id
    AND orders.payment_mode IN ('vorkasse', 'abholung', 'rechnung')
    AND orders.payment_mode_version >= 0
    AND invoice.gross_amount_cents IS NOT NULL
    AND invoice.payment_mode IN ('vorkasse', 'abholung', 'rechnung')
    AND invoice.payment_status IN ('offen', 'teilbezahlt', 'bezahlt')
    AND invoice.payment_currency = 'EUR'
    AND invoice.payment_open_amount_cents >= 0
    AND invoice.payment_paid_amount_cents >= 0
    AND invoice.payment_paid_amount_cents + invoice.payment_open_amount_cents = invoice.gross_amount_cents
    AND invoice.payment_version >= 0
    AND (
      (
        invoice.payment_status = 'offen'
        AND invoice.payment_paid_amount_cents = 0
        AND invoice.payment_open_amount_cents = invoice.gross_amount_cents
        AND invoice.payment_version = 0
        AND invoice.payment_method IS NULL
        AND invoice.payment_paid_at IS NULL
        AND invoice.payment_receipt_id IS NULL
        AND invoice.payment_event_id IS NULL
        AND invoice.payment_correlation_id IS NULL
      )
      OR (
        invoice.payment_status IN ('teilbezahlt', 'bezahlt')
        AND invoice.payment_version > 0
        AND invoice.payment_method IN ('bar', 'ueberweisung', 'karte')
        AND invoice.payment_paid_at IS NOT NULL
        AND invoice.payment_receipt_id IS NOT NULL
        AND invoice.payment_event_id IS NOT NULL
        AND invoice.payment_correlation_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM public.events event
          WHERE event.event_type = 'PAYMENT_CONFIRMED_V1'
            AND event.id = invoice.payment_event_id
            AND event.tenant_id = invoice.tenant_id
            AND event.order_id = invoice.order_id
            AND event.payload->>'invoiceId' = invoice.id::text
            AND event.payload->>'receiptId' = invoice.payment_receipt_id
            AND event.payload->>'paymentMode' = invoice.payment_mode
            AND event.payload->>'paymentVersion' = invoice.payment_version::text
            AND event.payload->>'paidAmountCents' = invoice.payment_paid_amount_cents::text
            AND event.payload->>'openAmountCents' = invoice.payment_open_amount_cents::text
            AND event.payload->>'grossAmountCents' = invoice.gross_amount_cents::text
            AND event.payload->>'currency' = invoice.payment_currency
            AND event.correlation_id = invoice.payment_correlation_id
        )
      )
    )
  , false) AS integrity_ok,
  orders.payment_mode_version
FROM public.invoices invoice
JOIN public.orders orders ON orders.id = invoice.order_id AND orders.tenant_id = invoice.tenant_id
WHERE invoice.payment_contract_version = 1
  AND invoice.tenant_id = current_setting('app.tenant_id', true);

COMMENT ON VIEW private.v_payment_summary_v1 IS
  'Q5 payment truth: invoice payment, Rechnung, or Bar/Karte bei Abholung permits goods out.';

CREATE OR REPLACE VIEW private.v_goods_out_ui_state_v1
WITH (security_invoker = true)
AS
SELECT
  orders.id AS order_id,
  orders.tenant_id,
  orders.order_number,
  orders.version AS order_version,
  orders.station,
  orders.current_station,
  orders.current_station_id,
  orders.status AS order_status,
  orders.payment_mode,
  orders.payment_mode_version,
  CASE WHEN invoice_state.active_invoice_count = 0 THEN 'not_issued' ELSE 'issued' END AS invoice_state,
  invoice_state.active_invoice_count,
  payment.invoice_id,
  payment.invoice_number,
  payment.total_amount_cents,
  payment.payment_contract_version,
  payment.payment_status,
  payment.payment_open_amount_cents,
  payment.payment_paid_amount_cents,
  payment.payment_currency,
  payment.payment_method,
  payment.payment_paid_at,
  payment.payment_receipt_id,
  payment.payment_event_id,
  payment.payment_correlation_id,
  payment.payment_version,
  payment.goods_out_allowed AS payment_goods_out_allowed,
  payment.integrity_ok AS payment_integrity_ok,
  payment_actor.user_id AS payment_actor_id,
  coalesce(goods_out.event_count, 0) AS goods_out_event_count,
  goods_out.event_id AS goods_out_event_id,
  goods_out.client_event_id AS goods_out_client_event_id,
  goods_out.correlation_id AS goods_out_correlation_id,
  goods_out.event_schema_version AS goods_out_event_schema_version,
  goods_out.aggregate_version AS goods_out_order_version,
  goods_out.user_id AS goods_out_actor_id,
  to_char(goods_out.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS goods_out_occurred_at,
  goods_out.payload->>'mode' AS goods_out_mode,
  (
    orders.station = 'fertig'
    AND orders.current_station = 'fertig'
    AND orders.current_station_id = 'fertig'
    AND orders.status = 'fertig'
    AND (
      (invoice_state.active_invoice_count = 0 AND orders.payment_mode = 'rechnung')
      OR (invoice_state.active_invoice_count = 1 AND payment.goods_out_allowed = true)
    )
  ) AS goods_out_allowed,
  coalesce(
    orders.tenant_id = nullif(btrim(current_setting('app.tenant_id', true)), '')
    AND orders.payment_mode IN ('vorkasse', 'abholung', 'rechnung')
    AND orders.payment_mode_version >= 0
    AND orders.station = orders.current_station
    AND orders.station = orders.current_station_id
    AND orders.station = orders.status
    AND invoice_state.active_invoice_count IN (0, 1)
    AND (
      (invoice_state.active_invoice_count = 0 AND payment.invoice_id IS NULL)
      OR (
        invoice_state.active_invoice_count = 1
        AND payment.invoice_id IS NOT NULL
        AND payment.integrity_ok = true
        AND payment.payment_mode = orders.payment_mode
        AND payment.payment_mode_version = orders.payment_mode_version
        AND (payment_actor.user_id IS NOT NULL OR payment.payment_event_id IS NULL)
      )
    )
    AND (
      coalesce(goods_out.event_count, 0) = 0
      OR (
        goods_out.event_count = 1
        AND goods_out.event_id IS NOT NULL
        AND goods_out.user_id IS NOT NULL
        AND goods_out.aggregate_version = orders.version
        AND goods_out.payload->>'orderId' = orders.id
        AND goods_out.payload->>'paymentMode' = orders.payment_mode
        AND goods_out.payload->>'orderVersion' = orders.version::text
        AND goods_out.payload->>'mode' IN ('versand', 'abholung')
      )
    )
  , false) AS integrity_ok
FROM public.orders orders
LEFT JOIN LATERAL (
  SELECT count(*)::integer AS active_invoice_count
  FROM public.invoices invoice
  WHERE invoice.tenant_id = orders.tenant_id
    AND invoice.order_id = orders.id
    AND invoice.status = 'issued'
) invoice_state ON true
LEFT JOIN private.v_payment_summary_v1 payment
  ON payment.tenant_id = orders.tenant_id AND payment.order_id = orders.id
LEFT JOIN public.events payment_actor
  ON payment_actor.tenant_id = orders.tenant_id
 AND payment_actor.order_id = orders.id
 AND payment_actor.id = payment.payment_event_id
 AND payment_actor.event_type = 'PAYMENT_CONFIRMED_V1'
LEFT JOIN LATERAL (
  SELECT count(*) OVER ()::integer AS event_count,
    event.id AS event_id, event.client_event_id, event.correlation_id,
    event.event_schema_version, event.aggregate_version, event.user_id,
    event.created_at, event.payload
  FROM public.events event
  WHERE event.tenant_id = orders.tenant_id
    AND event.order_id = orders.id
    AND event.event_type IN ('ORDER_PICKED_UP_V1', 'ORDER_PICKED_UP_V2')
    AND event.status = 'success'
  ORDER BY event.created_at DESC, event.id DESC
  LIMIT 1
) goods_out ON true
WHERE nullif(btrim(current_setting('app.tenant_id', true)), '') IS NOT NULL
  AND orders.tenant_id = nullif(btrim(current_setting('app.tenant_id', true)), '');

COMMENT ON VIEW private.v_goods_out_ui_state_v1 IS
  'Q5 tenant-bound goods-out state; Bar/Karte bei Abholung permits handover before payment confirmation.';
