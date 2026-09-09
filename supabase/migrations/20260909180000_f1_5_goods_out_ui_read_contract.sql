-- F1.5-D: one tenant-bound read contract for the order-overlay payment and
-- goods-out state. No new business truth is introduced: orders, invoices and
-- immutable events remain authoritative.

CREATE VIEW private.v_goods_out_ui_state_v1
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
      (
        invoice_state.active_invoice_count = 0
        AND payment.invoice_id IS NULL
      )
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
  ON payment.tenant_id = orders.tenant_id
 AND payment.order_id = orders.id
LEFT JOIN public.events payment_actor
  ON payment_actor.tenant_id = orders.tenant_id
 AND payment_actor.order_id = orders.id
 AND payment_actor.id = payment.payment_event_id
 AND payment_actor.event_type = 'PAYMENT_CONFIRMED_V1'
LEFT JOIN LATERAL (
  SELECT
    count(*) OVER ()::integer AS event_count,
    event.id AS event_id,
    event.client_event_id,
    event.correlation_id,
    event.event_schema_version,
    event.aggregate_version,
    event.user_id,
    event.created_at,
    event.payload
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
  'F1.5-D tenant-bound fail-closed overlay read state; payment values exist only with one canonical issued invoice.';

REVOKE ALL ON TABLE private.v_goods_out_ui_state_v1 FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE private.v_goods_out_ui_state_v1 TO service_role;
