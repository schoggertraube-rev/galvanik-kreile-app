-- KORR S38a K5: collections are customer/month, never a second payment-target source.
CREATE OR REPLACE FUNCTION private.collection_followup_repair_valid(repair public.events,live_member boolean DEFAULT false)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' AS $function$
DECLARE marker public.events%ROWTYPE; physical public.events%ROWTYPE; r jsonb;
BEGIN
 SELECT * INTO marker FROM public.events WHERE tenant_id=repair.tenant_id AND id=repair.payload->>'markerId' AND event_type='ORDER_COLLECTION_ATTACH_PENDING_V1';
 IF NOT FOUND THEN RETURN false; END IF;
 r:=marker.payload->'receipt';
 SELECT * INTO physical FROM public.events WHERE tenant_id=marker.tenant_id AND id=r->>'goodsOutEventId';
 IF NOT FOUND OR NOT private.collection_followup_source_valid(marker,physical) THEN RETURN false; END IF;
 IF NOT coalesce(repair.event_type='ORDER_COLLECTION_ATTACH_REPAIRED_V1' AND repair.event_schema_version=1 AND repair.status='success'
  AND repair.order_id=marker.order_id AND repair.aggregate_version=marker.aggregate_version AND repair.correlation_id=marker.correlation_id
  AND repair.client_event_id::text=repair.id::text AND repair.created_at>=marker.created_at
  AND jsonb_typeof(repair.payload)='object' AND (SELECT count(*) FROM jsonb_object_keys(repair.payload))=6
  AND repair.payload ?& ARRAY['markerId','goodsOutEventId','collectionId','collectionVersion','originalActorId','actorId']
  AND repair.payload->>'goodsOutEventId'=physical.id AND repair.payload->>'originalActorId'=marker.user_id::text AND repair.payload->>'actorId'=repair.user_id::text
  AND repair.payload->>'collectionId' ~ '^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$'
  AND jsonb_typeof(repair.payload->'collectionVersion')='number' AND (repair.payload->>'collectionVersion')::numeric=(repair.payload->>'collectionVersion')::integer AND (repair.payload->>'collectionVersion')::integer>0
  AND EXISTS(SELECT 1 FROM public.app_users actor WHERE actor.tenant_id=repair.tenant_id::text AND actor.id=repair.user_id),false) THEN RETURN false; END IF;
 IF NOT live_member THEN RETURN true; END IF;
 RETURN EXISTS(SELECT 1 FROM public.invoice_collection_orders member JOIN public.invoice_collections collection ON collection.tenant_id=member.tenant_id AND collection.id=member.collection_id
  WHERE member.tenant_id=repair.tenant_id::text AND member.order_id=marker.order_id AND collection.id::text=repair.payload->>'collectionId'
   AND collection.version=(repair.payload->>'collectionVersion')::integer AND collection.customer_id=r->>'customerId' AND collection.monat=(r->>'month')::date
   AND collection.status='offen' AND collection.invoice_id IS NULL);
EXCEPTION WHEN data_exception THEN RETURN false;
END;
$function$;

CREATE OR REPLACE FUNCTION private.validate_abs_goods_out_v3_event_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_order public.orders%ROWTYPE;
  v_agreement public.customer_agreements%ROWTYPE;
  v_collection_count integer;
BEGIN
  IF NEW.event_type <> 'ORDER_PICKED_UP_V3' THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_order
  FROM public.orders orders
  WHERE orders.tenant_id = NEW.tenant_id
    AND orders.id = NEW.order_id
  FOR UPDATE;
  IF NOT FOUND
    OR v_order.version <> NEW.aggregate_version
    OR v_order.station <> 'abgeholt'
    OR v_order.current_station <> 'abgeholt'
    OR v_order.current_station_id <> 'abgeholt'
    OR v_order.status <> 'abgeholt'
    OR v_order.payment_mode <> NEW.payload->>'paymentMode'
  THEN
    RAISE EXCEPTION 'ABS_GOODS_OUT_ORDER_INVALID' USING ERRCODE = '23514';
  END IF;

  SELECT * INTO v_agreement
  FROM public.customer_agreements agreement
  WHERE agreement.tenant_id = NEW.tenant_id
    AND agreement.id::text = NEW.payload->>'agreementId'
    AND agreement.customer_id = v_order.customer_id
    AND (agreement.order_id IS NULL OR agreement.order_id = NEW.order_id)
  FOR UPDATE;
  IF NOT FOUND
    OR v_agreement.typ <> NEW.payload->>'agreementType'
    OR v_agreement.version <> (NEW.payload->>'agreementVersion')::integer
    OR v_agreement.geld IS DISTINCT FROM true
    OR v_agreement.widerrufen_am IS NOT NULL
    OR (v_agreement.gueltig_bis IS NOT NULL AND v_agreement.gueltig_bis < timezone('Europe/Berlin', NEW.created_at)::date)
  THEN
    RAISE EXCEPTION 'ABS_GOODS_OUT_AGREEMENT_INVALID' USING ERRCODE = '23514';
  END IF;

  IF v_agreement.typ = 'sammelrechnung' THEN
    SELECT count(*)::integer INTO v_collection_count
    FROM public.invoice_collection_orders collection_order
    JOIN public.invoice_collections collection
      ON collection.tenant_id = collection_order.tenant_id
     AND collection.id = collection_order.collection_id
    WHERE collection_order.tenant_id = NEW.tenant_id
      AND collection_order.order_id = NEW.order_id
      AND collection.customer_id = v_order.customer_id
      AND collection.monat = date_trunc('month', NEW.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Berlin')::date
      AND collection.status = 'offen';
    IF (v_collection_count <> 1 AND NOT private.collection_followup_pending_for_goods_valid(NEW)) OR EXISTS (
      SELECT 1
      FROM public.invoices invoice
      WHERE invoice.tenant_id = NEW.tenant_id
        AND invoice.order_id = NEW.order_id
        AND invoice.status = 'issued'
    ) THEN
      RAISE EXCEPTION 'ABS_GOODS_OUT_COLLECTION_INVALID' USING ERRCODE = '23514';
    END IF;
  ELSIF NOT EXISTS (
    SELECT 1
    FROM public.invoices invoice
    WHERE invoice.tenant_id = NEW.tenant_id
      AND invoice.order_id = NEW.order_id
      AND invoice.status = 'issued'
  ) THEN
    RAISE EXCEPTION 'ABS_GOODS_OUT_INVOICE_MISSING' USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$function$;

ALTER TABLE public.invoice_collections DROP COLUMN ziel_tage;

-- K4: the same proven physical original remains valid in its new same-customer/month collection.
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
  AND NOT EXISTS(SELECT 1 FROM public.invoice_collection_orders live_member JOIN public.invoice_collections live_collection ON live_collection.tenant_id=live_member.tenant_id AND live_collection.id=live_member.collection_id WHERE live_member.tenant_id=event.tenant_id::text AND live_member.order_id=event.order_id AND (live_collection.customer_id<>orders.customer_id OR live_collection.monat<>date_trunc('month',event.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Berlin')::date))
  AND (EXISTS(SELECT 1 FROM private.v_invoice_order_members_v1 member
   JOIN public.invoices original ON original.tenant_id=member.tenant_id AND original.id=member.invoice_id
   JOIN private.v_invoice_receipt_v1 cancelled ON cancelled.tenant_id=original.tenant_id AND cancelled.invoice_id=original.id
    AND cancelled.event_id=original.cancel_event_id AND cancelled.client_event_id=original.cancel_client_event_id
   WHERE member.tenant_id=event.tenant_id::text AND member.order_id=event.order_id AND member.collection_id IS NOT NULL
    AND original.status='cancelled' AND original.order_id IS NULL AND cancelled.event_type='INVOICE_CANCELLED_V1' AND cancelled.integrity_ok
    AND event.created_at AT TIME ZONE 'UTC'<=original.issued_at
    AND private.invoice_original_source_valid(original.tenant_id,original.customer_id,original.order_id,original.order_version,original.freeze_id,original.service_date,original.snapshot,original.issued_at)
    AND EXISTS(SELECT 1 FROM jsonb_array_elements(original.snapshot#>'{collection,members}') frozen
     WHERE frozen->>'orderId'=event.order_id AND (frozen->>'orderVersion')::integer>=event.aggregate_version)) OR EXISTS(SELECT 1 FROM public.events removal
   WHERE removal.tenant_id=event.tenant_id AND removal.order_id=event.order_id
    AND removal.event_type='ORDER_COLLECTION_MEMBER_REMOVED_V1'
    AND removal.payload#>>'{receipt,goodsOutEventId}'=event.id::text
    AND private.invoice_collection_removal_source_valid(removal,false))),false) AS integrity_ok
FROM public.events event
JOIN public.app_users actor ON actor.id=event.user_id AND actor.tenant_id=event.tenant_id::text
JOIN public.orders orders ON orders.id=event.order_id AND orders.tenant_id::text=event.tenant_id::text
WHERE event.event_type='ORDER_PICKED_UP_V3' AND event.event_schema_version=3 AND event.status='success'
 AND event.tenant_id::text=nullif(btrim(current_setting('app.tenant_id',true)),'');
