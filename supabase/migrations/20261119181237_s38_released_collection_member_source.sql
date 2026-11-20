CREATE OR REPLACE VIEW private.v_goods_out_receipt_v2 WITH(security_invoker=true) AS
 SELECT event.id AS event_id,
    event.tenant_id,
    event.order_id,
    event.client_event_id,
    event.correlation_id,
    event.aggregate_version AS order_version,
    event.user_id AS actor_id,
    to_char(event.created_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'::text) AS occurred_at,
    event.payload ->> 'mode'::text AS mode,
    event.payload ->> 'invoiceState'::text AS invoice_state,
    actor.id IS NOT NULL AND orders.id IS NOT NULL AND orders.payment_mode = 'rechnung'::text AND orders.version = event.aggregate_version AND orders.station::text = 'abgeholt'::text AND orders.current_station = 'abgeholt'::text AND orders.current_station_id::text = 'abgeholt'::text AND orders.status::text = 'abgeholt'::text AND (event.payload ->> 'orderId'::text) = event.order_id AND (event.payload ->> 'paymentMode'::text) = orders.payment_mode AND (event.payload ->> 'invoiceState'::text) = 'not_issued'::text AND ((event.payload ->> 'orderVersion'::text)::integer) = orders.version AND NOT (EXISTS ( SELECT 1
           FROM invoices invoice_at_goods_out
          WHERE invoice_at_goods_out.tenant_id = event.tenant_id::text AND invoice_at_goods_out.order_id = event.order_id AND invoice_at_goods_out.status = 'issued'::text AND invoice_at_goods_out.issued_at <= event.created_at)) AS integrity_ok
   FROM events event
     JOIN app_users actor ON actor.id = event.user_id AND actor.tenant_id = event.tenant_id::text
     JOIN orders orders ON orders.id = event.order_id AND orders.tenant_id::text = event.tenant_id::text
  WHERE event.event_type::text = 'ORDER_PICKED_UP_V2'::text AND event.event_schema_version = 2 AND event.status::text = 'success'::text AND NULLIF(btrim(current_setting('app.tenant_id'::text, true)), ''::text) IS NOT NULL AND event.tenant_id::text = NULLIF(btrim(current_setting('app.tenant_id'::text, true)), ''::text)

UNION ALL
-- Native historical V3 output is eligible only after its actual collection
-- original has a qualified cancellation and every live collection link is gone.
-- EXISTS retains one physical source even after several real cancelled originals.
SELECT event.id AS event_id,event.tenant_id,event.order_id,event.client_event_id,event.correlation_id,
 event.aggregate_version AS order_version,event.user_id AS actor_id,
 to_char(event.created_at,'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS occurred_at,
 event.payload->>'mode' AS mode,NULL::text AS invoice_state,
 coalesce(actor.id IS NOT NULL AND orders.payment_mode='rechnung' AND orders.version=event.aggregate_version
  AND orders.station='abgeholt' AND orders.current_station='abgeholt' AND orders.current_station_id='abgeholt' AND orders.status='abgeholt'
  AND event.payload->>'orderId'=orders.id AND event.payload->>'orderVersion'=orders.version::text
  AND event.payload->>'settlement'='collection' AND event.payload->>'paymentMode'='rechnung'
  AND NOT EXISTS(SELECT 1 FROM public.invoice_collection_orders live_member WHERE live_member.tenant_id=event.tenant_id::text AND live_member.order_id=event.order_id)
  AND EXISTS(SELECT 1 FROM private.v_invoice_order_members_v1 member
   JOIN public.invoices original ON original.tenant_id=member.tenant_id AND original.id=member.invoice_id
   JOIN private.v_invoice_receipt_v1 cancelled ON cancelled.tenant_id=original.tenant_id AND cancelled.invoice_id=original.id
    AND cancelled.event_id=original.cancel_event_id AND cancelled.client_event_id=original.cancel_client_event_id
   WHERE member.tenant_id=event.tenant_id::text AND member.order_id=event.order_id AND member.collection_id IS NOT NULL
    AND original.status='cancelled' AND original.order_id IS NULL AND cancelled.event_type='INVOICE_CANCELLED_V1' AND cancelled.integrity_ok
    AND private.invoice_original_source_valid(original.tenant_id,original.customer_id,original.order_id,original.order_version,original.freeze_id,original.service_date,original.snapshot,original.issued_at)
    AND EXISTS(SELECT 1 FROM jsonb_array_elements(original.snapshot#>'{collection,members}') frozen
     WHERE frozen->>'orderId'=event.order_id AND (frozen->>'orderVersion')::integer>=event.aggregate_version)),false) AS integrity_ok
FROM public.events event
JOIN public.app_users actor ON actor.id=event.user_id AND actor.tenant_id=event.tenant_id::text
JOIN public.orders orders ON orders.id=event.order_id AND orders.tenant_id::text=event.tenant_id::text
WHERE event.event_type='ORDER_PICKED_UP_V3' AND event.event_schema_version=3 AND event.status='success'
 AND event.tenant_id::text=nullif(btrim(current_setting('app.tenant_id',true)),'');
