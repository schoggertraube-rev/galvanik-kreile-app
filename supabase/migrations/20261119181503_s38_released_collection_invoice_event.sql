-- Native candidate must predate its actual cancelled original; no later same-version event qualifies.
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
    AND event.created_at AT TIME ZONE 'UTC'<=original.issued_at
    AND private.invoice_original_source_valid(original.tenant_id,original.customer_id,original.order_id,original.order_version,original.freeze_id,original.service_date,original.snapshot,original.issued_at)
    AND EXISTS(SELECT 1 FROM jsonb_array_elements(original.snapshot#>'{collection,members}') frozen
     WHERE frozen->>'orderId'=event.order_id AND (frozen->>'orderVersion')::integer>=event.aggregate_version)),false) AS integrity_ok
FROM public.events event
JOIN public.app_users actor ON actor.id=event.user_id AND actor.tenant_id=event.tenant_id::text
JOIN public.orders orders ON orders.id=event.order_id AND orders.tenant_id::text=event.tenant_id::text
WHERE event.event_type='ORDER_PICKED_UP_V3' AND event.event_schema_version=3 AND event.status='success'
 AND event.tenant_id::text=nullif(btrim(current_setting('app.tenant_id',true)),'');

-- S38a: preserve the entire old V2 branch, qualify released V3 through the same existing source view.
CREATE OR REPLACE FUNCTION private.validate_f15_v2_event_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  matching_goods_out_count integer;
BEGIN
  IF NEW.event_type NOT IN ('ORDER_PICKED_UP_V2', 'INVOICE_CREATED_V2') THEN
    RETURN NEW;
  END IF;

  PERFORM 1
  FROM public.orders orders
  WHERE orders.tenant_id = NEW.tenant_id
    AND orders.id = NEW.order_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'F15_V2_ORDER_MISSING' USING ERRCODE = '23514';
  END IF;

  IF NEW.event_type = 'ORDER_PICKED_UP_V2' THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.orders orders
      WHERE orders.tenant_id = NEW.tenant_id
        AND orders.id = NEW.order_id
        AND orders.payment_mode = 'rechnung'
        AND orders.version = NEW.aggregate_version
        AND orders.station = 'abgeholt'
        AND orders.current_station = 'abgeholt'
        AND orders.current_station_id = 'abgeholt'
        AND orders.status = 'abgeholt'
    ) OR EXISTS (
      SELECT 1
      FROM public.invoices invoice
      WHERE invoice.tenant_id = NEW.tenant_id
        AND invoice.order_id = NEW.order_id
        AND invoice.status = 'issued'
        AND invoice.issued_at <= NEW.created_at
    ) THEN
      RAISE EXCEPTION 'F15_GOODS_OUT_V2_SOURCE_INVALID' USING ERRCODE = '23514';
    END IF;
  ELSE
    SELECT count(*)::integer
    INTO matching_goods_out_count
    FROM public.events goods_out
    WHERE goods_out.tenant_id = NEW.tenant_id
      AND goods_out.order_id = NEW.order_id
      AND (goods_out.event_type = 'ORDER_PICKED_UP_V2'
      AND goods_out.event_schema_version = 2
      AND goods_out.status = 'success'
      AND goods_out.from_station = 'fertig'
      AND goods_out.station = 'abgeholt'
      AND goods_out.aggregate_version = (NEW.payload->>'orderVersion')::integer
      AND goods_out.payload->>'orderId' = NEW.order_id
      AND goods_out.payload->>'paymentMode' = 'rechnung'
      AND goods_out.payload->>'invoiceState' = 'not_issued'
      AND goods_out.created_at <= NEW.created_at
      AND NOT EXISTS (
        SELECT 1
        FROM public.invoices prior_invoice
        WHERE prior_invoice.tenant_id = goods_out.tenant_id
          AND prior_invoice.order_id = goods_out.order_id
          AND prior_invoice.status = 'issued'
          AND prior_invoice.issued_at <= goods_out.created_at
      ) OR (goods_out.event_type='ORDER_PICKED_UP_V3'
       AND goods_out.created_at<=NEW.created_at
       AND EXISTS(SELECT 1 FROM private.v_goods_out_receipt_v2 qualified
        WHERE qualified.tenant_id=NEW.tenant_id AND qualified.order_id=NEW.order_id
         AND qualified.event_id=goods_out.id AND qualified.integrity_ok
         AND qualified.order_version=(NEW.payload->>'orderVersion')::integer)));
    IF matching_goods_out_count <> 1 THEN
      RAISE EXCEPTION 'F15_INVOICE_CREATED_V2_SOURCE_INVALID' USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$
;
