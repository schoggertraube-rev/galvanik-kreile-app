-- S09 / PL14Nov05:45: one order row, main-document fields, every real invoice payment.
-- Preserve genuine prior callback-only order-version advances without rewriting history.
-- Every intervening version requires the existing immutable MIME/intake/actor lineage and its actual callback task.
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
      (
        orders.payment_mode = 'keiner'
        AND orders.nacharbeit_zu IS NOT NULL
        AND invoice_state.active_invoice_count = 0
      )
      OR (invoice_state.active_invoice_count = 0 AND orders.payment_mode = 'rechnung')
      OR (invoice_state.active_invoice_count >= 1 AND payment.goods_out_allowed = true AND all_payment.goods_out_allowed IS TRUE)
    )
  ) AS goods_out_allowed,
  coalesce(
    orders.tenant_id = nullif(btrim(current_setting('app.tenant_id', true)), '')
    AND orders.payment_mode_version >= 0
    AND orders.station = orders.current_station
    AND orders.station = orders.current_station_id
    AND orders.station = orders.status
    AND (invoice_state.active_invoice_count=0 OR invoice_state.main_invoice_count=1)
    AND (invoice_state.active_invoice_count=0 OR (all_payment.invoice_count=invoice_state.active_invoice_count AND all_payment.integrity_ok IS TRUE))
    AND (
      (
        orders.payment_mode = 'keiner'
        AND orders.nacharbeit_zu IS NOT NULL
        AND invoice_state.active_invoice_count = 0
        AND payment.invoice_id IS NULL
      )
      OR (
        orders.payment_mode IN ('vorkasse', 'abholung', 'rechnung')
        AND (
          (invoice_state.active_invoice_count = 0 AND payment.invoice_id IS NULL)
          OR (
            invoice_state.active_invoice_count >= 1
            AND payment.invoice_id IS NOT NULL
            AND payment.integrity_ok = true
            AND payment.payment_mode = orders.payment_mode
            AND payment.payment_mode_version = orders.payment_mode_version
            AND (payment_actor.user_id IS NOT NULL OR payment.payment_event_id IS NULL)
          )
        )
      )
    )
    AND (
      coalesce(goods_out.event_count, 0) = 0
      OR (
        goods_out.event_count = 1
        AND goods_out.event_id IS NOT NULL
        AND goods_out.user_id IS NOT NULL
        AND goods_out.aggregate_version <= orders.version
        AND (goods_out.aggregate_version = orders.version OR (
 SELECT count(DISTINCT handover.aggregate_version)
 FROM public.events handover
 JOIN public.app_users handover_actor ON handover_actor.tenant_id=handover.tenant_id AND handover_actor.id=handover.user_id
 JOIN public.intake_item original ON original.tenant_id=handover.tenant_id AND original.id::text=handover.payload->'receipt'->'mailActor'->>'originalItemId'
 JOIN public.intake_event applied ON applied.tenant_id=handover.tenant_id AND applied.item_id=original.id AND applied.befehl_id=handover.client_event_id AND applied.von=handover.user_id::text
 JOIN public.tasks callback_task ON callback_task.tenant_id=handover.tenant_id AND callback_task.id::text=handover.payload->'receipt'->>'taskId' AND callback_task.bezug_id=orders.id AND callback_task.art='rueckruf'
 WHERE handover.tenant_id=orders.tenant_id AND handover.order_id=orders.id
 AND handover.event_type='ORDER_HANDOVER_MAIL_V1' AND handover.event_schema_version=1 AND handover.status='success'
 AND handover.client_event_id IS NOT NULL AND handover.correlation_id IS NOT NULL
 AND handover.aggregate_version>goods_out.aggregate_version AND handover.aggregate_version<=orders.version AND handover.payload->>'requestHash' ~ '^[0-9a-f]{64}$'
 AND handover.payload->'receipt'->>'orderId'=orders.id
 AND handover.payload->'receipt'->>'customerId'=orders.customer_id
 AND handover.payload->'receipt'->>'orderVersion'=handover.aggregate_version::text
 AND handover.payload->'receipt'->>'handoverMode' IN ('pickup','shipping')
 AND handover.payload->'receipt'->>'outcome'='call_customer' AND handover.payload->'receipt'->>'handoverMode'=orders.handover_mode
 AND handover.payload->'receipt'->'mailActor'->>'kind'='mail'
 AND handover.payload->'receipt'->'mailActor'->>'sender'=original.absender_adresse
 AND original.kanal='mail'
 AND applied.vorher->>'kunde_id'=orders.customer_id AND applied.nachher->>'customerId'=orders.customer_id
 AND applied.art='anliegen' AND applied.vorher->>'version'=handover.payload->'receipt'->'mailActor'->>'originalVersion'
 AND applied.nachher->>'orderId'=orders.id
 AND applied.nachher->>'handoverMode'=handover.payload->'receipt'->>'handoverMode'
 AND applied.nachher->>'action' IN ('auftrag.uebergabe_geaendert','auftrag.uebergabe_klaeren')
 AND EXISTS(SELECT 1 FROM public.intake_file mime JOIN public.intake_event secured ON secured.tenant_id=mime.tenant_id AND secured.item_id=mime.item_id AND secured.art='original_gespeichert' AND secured.nachher->>'fileId'=mime.id::text AND secured.nachher->>'sha256'=mime.sha256 WHERE mime.tenant_id=handover.tenant_id AND mime.item_id=original.id AND mime.art='mime' AND mime.sha256=handover.payload->'receipt'->'mailActor'->>'originalSha256')

        ) = orders.version - goods_out.aggregate_version)
        AND goods_out.payload->>'orderId' = orders.id
        AND goods_out.payload->>'orderVersion' = goods_out.aggregate_version::text
        AND goods_out.payload->>'mode' IN ('versand', 'abholung')
        AND (
          (goods_out.event_type IN ('ORDER_PICKED_UP_V1', 'ORDER_PICKED_UP_V2', 'ORDER_PICKED_UP_V3') AND goods_out.payload->>'paymentMode' = orders.payment_mode)
          OR (
            goods_out.event_type = 'ORDER_PICKED_UP_V4'
            AND orders.payment_mode = 'keiner'
            AND goods_out.payload->>'paymentMode' = 'keiner'
            AND goods_out.payload->>'reworkComplaintId' = orders.nacharbeit_zu
          )
        )
      )
    )
  , false) AS integrity_ok,
  orders.nacharbeit_zu AS rework_complaint_id,
  all_payment.goods_out_allowed AS all_invoice_payments_allowed
FROM public.orders orders
LEFT JOIN LATERAL (
  SELECT count(*)::integer AS active_invoice_count,count(*) FILTER (WHERE invoice.belegart='auftrag')::integer AS main_invoice_count
  FROM public.invoices invoice
  WHERE invoice.tenant_id = orders.tenant_id
    AND invoice.order_id = orders.id
    AND invoice.status = 'issued'
) invoice_state ON true
LEFT JOIN private.v_payment_summary_v1 payment
  ON payment.tenant_id = orders.tenant_id AND payment.order_id = orders.id
 AND EXISTS(SELECT 1 FROM public.invoices main_invoice WHERE main_invoice.tenant_id=orders.tenant_id AND main_invoice.id=payment.invoice_id AND main_invoice.belegart='auftrag')
LEFT JOIN LATERAL (
 SELECT count(*)::integer AS invoice_count,
  bool_and(summary.goods_out_allowed IS TRUE) AS goods_out_allowed,
  bool_and(summary.integrity_ok IS TRUE AND summary.payment_mode=orders.payment_mode
    AND summary.payment_mode_version=orders.payment_mode_version
    AND (summary.payment_event_id IS NULL OR EXISTS(SELECT 1 FROM public.events actor_event
      WHERE actor_event.tenant_id=orders.tenant_id AND actor_event.order_id=orders.id
        AND actor_event.id=summary.payment_event_id AND actor_event.event_type='PAYMENT_CONFIRMED_V1' AND actor_event.user_id IS NOT NULL))) AS integrity_ok
 FROM private.v_payment_summary_v1 summary
 WHERE summary.tenant_id=orders.tenant_id AND summary.order_id=orders.id
) all_payment ON true
LEFT JOIN public.events payment_actor
  ON payment_actor.tenant_id = orders.tenant_id
 AND payment_actor.order_id = orders.id
 AND payment_actor.id = payment.payment_event_id
 AND payment_actor.event_type = 'PAYMENT_CONFIRMED_V1'
LEFT JOIN LATERAL (
  SELECT count(*) OVER ()::integer AS event_count,
    event.id AS event_id, event.client_event_id, event.correlation_id,
    event.event_schema_version, event.aggregate_version, event.user_id,
    event.created_at, event.payload, event.event_type
  FROM public.events event
  WHERE event.tenant_id = orders.tenant_id
    AND event.order_id = orders.id
    AND event.event_type IN ('ORDER_PICKED_UP_V1', 'ORDER_PICKED_UP_V2', 'ORDER_PICKED_UP_V3', 'ORDER_PICKED_UP_V4')
    AND event.status = 'success'
  ORDER BY event.created_at DESC, event.id DESC
  LIMIT 1
) goods_out ON true
WHERE nullif(btrim(current_setting('app.tenant_id', true)), '') IS NOT NULL
  AND orders.tenant_id = nullif(btrim(current_setting('app.tenant_id', true)), '');

REVOKE ALL ON TABLE private.v_goods_out_ui_state_v1 FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE private.v_goods_out_ui_state_v1 TO service_role;
