-- S38a A14/E14: qualified removal from an OPEN collection only.
-- Original physical events and issued originals are never edited.
CREATE OR REPLACE FUNCTION private.invoice_collection_removal_source_valid(removal public.events,before_removal boolean DEFAULT false)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' AS $function$
DECLARE r jsonb:=removal.payload->'receipt'; c public.invoice_collections%ROWTYPE; goods public.events%ROWTYPE; o public.orders%ROWTYPE;
BEGIN
 IF NOT coalesce(removal.tenant_id::text=nullif(btrim(current_setting('app.tenant_id',true)),'')
  AND removal.event_type='ORDER_COLLECTION_MEMBER_REMOVED_V1' AND removal.status='success' AND removal.event_schema_version=1
  AND removal.user_id IS NOT NULL AND removal.client_event_id IS NOT NULL AND removal.correlation_id=removal.client_event_id
  AND jsonb_typeof(removal.payload)='object' AND removal.payload ?& ARRAY['intent','receipt','receiptSha256']
  AND (SELECT count(*) FROM jsonb_object_keys(removal.payload))=3
  AND removal.payload->>'intent' ~ '^[a-f0-9]{64}$' AND removal.payload->>'receiptSha256' ~ '^[a-f0-9]{64}$'
  AND jsonb_typeof(r)='object' AND r ?& ARRAY['eventId','orderId','orderVersion','customerId','collectionId','collectionVersion','collectionVersionAfter','goodsOutEventId','memberCreatedAt','actorId','clientEventId','recordedAt']
  AND (SELECT count(*) FROM jsonb_object_keys(r))=12
  AND r->>'eventId'=removal.id::text AND r->>'orderId'=removal.order_id AND r->>'actorId'=removal.user_id::text
  AND r->>'clientEventId'=removal.client_event_id::text AND (r->>'recordedAt')::timestamptz=removal.created_at AT TIME ZONE 'UTC'
  AND jsonb_typeof(r->'orderVersion')='number' AND (r->>'orderVersion')::numeric=removal.aggregate_version AND removal.aggregate_version>0
  AND jsonb_typeof(r->'collectionVersion')='number' AND (r->>'collectionVersion')::numeric=(r->>'collectionVersion')::integer AND (r->>'collectionVersion')::integer>0
  AND jsonb_typeof(r->'collectionVersionAfter')='number' AND (r->>'collectionVersionAfter')::numeric=(r->>'collectionVersion')::integer+1
  AND EXISTS(SELECT 1 FROM public.app_users actor WHERE actor.tenant_id=removal.tenant_id::text AND actor.id=removal.user_id),false) THEN RETURN false; END IF;
 SELECT * INTO c FROM public.invoice_collections WHERE tenant_id=removal.tenant_id::text AND id=(r->>'collectionId')::uuid;
 IF NOT FOUND OR c.customer_id IS DISTINCT FROM r->>'customerId' THEN RETURN false; END IF;
 SELECT * INTO o FROM public.orders WHERE tenant_id=removal.tenant_id::text AND id=removal.order_id;
 IF NOT FOUND OR o.customer_id IS DISTINCT FROM c.customer_id OR o.version IS DISTINCT FROM removal.aggregate_version
  OR o.payment_mode IS DISTINCT FROM 'rechnung' OR o.station IS DISTINCT FROM 'abgeholt' OR o.current_station IS DISTINCT FROM 'abgeholt' OR o.current_station_id IS DISTINCT FROM 'abgeholt' OR o.status IS DISTINCT FROM 'abgeholt' THEN RETURN false; END IF;
 SELECT * INTO goods FROM public.events WHERE tenant_id=removal.tenant_id AND id=r->>'goodsOutEventId' AND order_id=removal.order_id;
 IF NOT FOUND OR goods.event_type IS DISTINCT FROM 'ORDER_PICKED_UP_V3' OR goods.event_schema_version IS DISTINCT FROM 3 OR goods.status IS DISTINCT FROM 'success'
  OR goods.aggregate_version IS DISTINCT FROM removal.aggregate_version OR goods.payload->>'settlement' IS DISTINCT FROM 'collection'
  OR goods.payload->>'orderId' IS DISTINCT FROM removal.order_id OR goods.payload->>'orderVersion' IS DISTINCT FROM removal.aggregate_version::text
  OR goods.payload->'gateAllowed' IS DISTINCT FROM 'true'::jsonb OR goods.payload->>'agreementType' IS DISTINCT FROM 'sammelrechnung'
  OR goods.payload->>'paymentMode' IS DISTINCT FROM 'rechnung' OR goods.payload->>'mode' NOT IN ('abholung','versand')
  OR goods.client_event_id IS NULL OR goods.correlation_id IS NULL OR goods.user_id IS NULL
  OR NOT EXISTS(SELECT 1 FROM public.app_users actor WHERE actor.tenant_id=removal.tenant_id::text AND actor.id=goods.user_id)
  OR (SELECT array_agg(key ORDER BY key) FROM jsonb_object_keys(goods.payload) key) IS DISTINCT FROM ARRAY['agreementId','agreementType','agreementVersion','gateAllowed','mode','orderId','orderVersion','paymentMode','settlement']::text[]
  OR coalesce(goods.payload->>'agreementId','') !~ '^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$'
  OR jsonb_typeof(goods.payload->'agreementVersion') IS DISTINCT FROM 'number' OR coalesce(goods.payload->>'agreementVersion','') !~ '^[1-9][0-9]*$'
  OR goods.created_at>removal.created_at OR c.monat IS DISTINCT FROM date_trunc('month',goods.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Berlin')::date THEN RETURN false; END IF;
 IF before_removal THEN
  RETURN coalesce(c.status='offen' AND c.invoice_id IS NULL AND c.version=(r->>'collectionVersion')::integer
   AND EXISTS(SELECT 1 FROM public.invoice_collection_orders member WHERE member.tenant_id=c.tenant_id AND member.collection_id=c.id AND member.order_id=o.id AND member.created_at=(r->>'memberCreatedAt')::timestamptz),false);
 END IF;
 RETURN coalesce(c.version>=(r->>'collectionVersionAfter')::integer
  AND NOT EXISTS(SELECT 1 FROM public.invoice_collection_orders member WHERE member.tenant_id=c.tenant_id AND member.order_id=o.id),false);
EXCEPTION WHEN data_exception THEN RETURN false;
END;
$function$;
REVOKE ALL ON FUNCTION private.invoice_collection_removal_source_valid(public.events,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.invoice_collection_removal_source_valid(public.events,boolean) TO service_role;

CREATE OR REPLACE FUNCTION private.guard_collection_removal_insert_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $function$
BEGIN
 IF NOT private.invoice_collection_removal_source_valid(NEW,true) THEN RAISE EXCEPTION 'COLLECTION_REMOVAL_SOURCE_INVALID' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION private.guard_collection_removal_insert_v1() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER events_collection_removal_insert_guard BEFORE INSERT ON public.events FOR EACH ROW
WHEN (NEW.event_type='ORDER_COLLECTION_MEMBER_REMOVED_V1') EXECUTE FUNCTION private.guard_collection_removal_insert_v1();
CREATE TRIGGER events_collection_removal_update_immutable BEFORE UPDATE ON public.events FOR EACH ROW
WHEN (OLD.event_type='ORDER_COLLECTION_MEMBER_REMOVED_V1') EXECUTE FUNCTION public.prevent_audit_mutation();
CREATE TRIGGER events_collection_removal_delete_immutable BEFORE DELETE ON public.events FOR EACH ROW
WHEN (OLD.event_type='ORDER_COLLECTION_MEMBER_REMOVED_V1') EXECUTE FUNCTION public.prevent_audit_mutation();

CREATE OR REPLACE FUNCTION private.guard_invoice_collection_member_release_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $function$
BEGIN
 IF coalesce(current_setting('app.collection_member_command',true)='remove-v1',false)
  AND EXISTS(SELECT 1 FROM public.events removal WHERE removal.tenant_id=OLD.tenant_id AND removal.order_id=OLD.order_id
   AND removal.event_type='ORDER_COLLECTION_MEMBER_REMOVED_V1' AND removal.payload#>>'{receipt,collectionId}'=OLD.collection_id::text
   AND (removal.payload#>>'{receipt,memberCreatedAt}')::timestamptz=OLD.created_at
   AND private.invoice_collection_removal_source_valid(removal,true)) THEN RETURN OLD; END IF;
 IF NOT coalesce(OLD.tenant_id=nullif(btrim(current_setting('app.tenant_id',true)),'')
  AND current_setting('app.invoice_cancel_command',true)='v1'
  AND EXISTS(SELECT 1 FROM public.invoice_collections collection
   JOIN public.invoices invoice ON invoice.tenant_id=collection.tenant_id AND invoice.id=collection.invoice_id
   JOIN private.v_invoice_receipt_v1 receipt ON receipt.tenant_id=invoice.tenant_id AND receipt.invoice_id=invoice.id
    AND receipt.event_id=invoice.cancel_event_id AND receipt.client_event_id=invoice.cancel_client_event_id
   WHERE collection.id=OLD.collection_id AND collection.tenant_id=OLD.tenant_id
    AND invoice.status='cancelled' AND invoice.order_id IS NULL
    AND receipt.event_type='INVOICE_CANCELLED_V1' AND receipt.integrity_ok
    AND invoice.snapshot#>>'{collection,collectionId}'=collection.id::text
    AND EXISTS(SELECT 1 FROM jsonb_array_elements(invoice.snapshot#>'{collection,members}') member WHERE member->>'orderId'=OLD.order_id)),false)
 THEN RAISE EXCEPTION 'INVOICE_COLLECTION_MEMBERS_CHANGED' USING ERRCODE='23514'; END IF;
 RETURN OLD;
END;
$function$;

-- Same canonical handover view; old V2 and cancelled-original predicates are retained.
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

-- events.created_at is UTC timestamp WITHOUT time zone: the existing guard must use the actual Berlin month.
CREATE OR REPLACE FUNCTION private.validate_abs_goods_out_v3_event_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
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
      AND collection.status = 'offen'
      AND collection.ziel_tage = v_agreement.ziel_tage;
    IF v_collection_count <> 1 OR EXISTS (
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
$$;
