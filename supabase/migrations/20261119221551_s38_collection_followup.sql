-- PL19.11.22:55 / B27: the physical handover survives a failed monthly attach.
-- Same immutable events, same TaskWriter, same attach writer. No new table.
CREATE FUNCTION private.collection_followup_marker_valid(marker public.events)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' AS $function$
DECLARE r jsonb:=marker.payload->'receipt';
BEGIN
 RETURN coalesce(marker.tenant_id::text=nullif(btrim(current_setting('app.tenant_id',true)),'')
  AND marker.event_type='ORDER_COLLECTION_ATTACH_PENDING_V1' AND marker.event_schema_version=1 AND marker.status='success'
  AND marker.user_id IS NOT NULL AND marker.client_event_id::text=marker.id::text AND marker.correlation_id IS NOT NULL
  AND jsonb_typeof(marker.payload)='object' AND marker.payload ?& ARRAY['receipt','receiptSha256'] AND (SELECT count(*) FROM jsonb_object_keys(marker.payload))=2
  AND marker.payload->>'receiptSha256' ~ '^[a-f0-9]{64}$'
  AND jsonb_typeof(r)='object' AND (SELECT count(*) FROM jsonb_object_keys(r))=15
  AND r ?& ARRAY['eventId','goodsOutEventId','orderId','customerId','actorId','clientEventId','correlationId','expectedVersion','orderVersion','freezeId','agreementId','agreementVersion','targetDays','month','occurredAt']
  AND r->>'eventId'=marker.id::text AND r->>'orderId'=marker.order_id AND r->>'actorId'=marker.user_id::text AND r->>'correlationId'=marker.correlation_id::text
  AND r->>'goodsOutEventId' ~ '^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$'
  AND r->>'clientEventId' ~ '^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$'
  AND jsonb_typeof(r->'expectedVersion')='number' AND (r->>'expectedVersion')::numeric=(r->>'expectedVersion')::integer AND (r->>'expectedVersion')::integer>=0
  AND jsonb_typeof(r->'orderVersion')='number' AND (r->>'orderVersion')::numeric=(r->>'expectedVersion')::integer+1 AND marker.aggregate_version=(r->>'orderVersion')::integer
  AND jsonb_typeof(r->'agreementVersion')='number' AND (r->>'agreementVersion')::numeric=(r->>'agreementVersion')::integer AND (r->>'agreementVersion')::integer>0
  AND jsonb_typeof(r->'targetDays')='number' AND (r->>'targetDays')::numeric=(r->>'targetDays')::integer AND (r->>'targetDays')::integer>0
  AND (r->>'occurredAt')::timestamptz=marker.created_at AT TIME ZONE 'UTC'
  AND (r->>'month')::date=date_trunc('month',marker.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Berlin')::date
  AND EXISTS(SELECT 1 FROM public.orders o WHERE o.tenant_id=marker.tenant_id::text AND o.id=marker.order_id AND o.customer_id=r->>'customerId')
  AND EXISTS(SELECT 1 FROM public.app_users actor WHERE actor.tenant_id=marker.tenant_id::text AND actor.id=marker.user_id),false);
EXCEPTION WHEN data_exception THEN RETURN false;
END;
$function$;

CREATE FUNCTION private.collection_followup_source_valid(marker public.events,physical public.events)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' AS $function$
DECLARE r jsonb:=marker.payload->'receipt';
BEGIN
 RETURN coalesce(private.collection_followup_marker_valid(marker)
  AND physical.tenant_id=marker.tenant_id AND physical.id=r->>'goodsOutEventId' AND physical.order_id=marker.order_id
  AND physical.event_type='ORDER_PICKED_UP_V3' AND physical.event_schema_version=3 AND physical.status='success'
  AND physical.user_id=marker.user_id AND physical.client_event_id::text=r->>'clientEventId' AND physical.correlation_id=marker.correlation_id
  AND physical.aggregate_version=marker.aggregate_version AND physical.created_at=marker.created_at AND physical.from_station='fertig' AND physical.station='abgeholt'
  AND (SELECT array_agg(key ORDER BY key) FROM jsonb_object_keys(physical.payload) key)=ARRAY['agreementId','agreementType','agreementVersion','gateAllowed','mode','orderId','orderVersion','paymentMode','settlement']::text[]
  AND physical.payload->>'orderId'=marker.order_id AND physical.payload->>'orderVersion'=marker.aggregate_version::text
  AND physical.payload->>'agreementId'=r->>'agreementId' AND physical.payload->'agreementVersion'=r->'agreementVersion'
  AND physical.payload->>'agreementType'='sammelrechnung' AND physical.payload->>'settlement'='collection' AND physical.payload->>'paymentMode'='rechnung'
  AND physical.payload->'gateAllowed'='true'::jsonb AND physical.payload->>'mode' IN ('abholung','versand')
  AND EXISTS(SELECT 1 FROM private.v_order_freeze_state_v1 frozen WHERE frozen.tenant_id=marker.tenant_id::text AND frozen.order_id=marker.order_id AND frozen.freeze_id::text=r->>'freezeId' AND frozen.integrity_ok),false);
EXCEPTION WHEN data_exception THEN RETURN false;
END;
$function$;

CREATE FUNCTION private.collection_followup_pending_for_goods_valid(physical public.events)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $function$
 SELECT count(*)=1 AND coalesce(bool_and(private.collection_followup_source_valid(marker,physical)),false)
 FROM public.events marker WHERE marker.tenant_id=physical.tenant_id AND marker.event_type='ORDER_COLLECTION_ATTACH_PENDING_V1'
 AND marker.payload#>>'{receipt,goodsOutEventId}'=physical.id;
$function$;

CREATE FUNCTION private.guard_collection_followup_pending_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $function$
DECLARE r jsonb:=NEW.payload->'receipt';
BEGIN
 IF NOT private.collection_followup_marker_valid(NEW)
  OR NOT EXISTS(SELECT 1 FROM public.orders o JOIN public.customer_agreements agreement ON agreement.tenant_id=o.tenant_id AND agreement.customer_id=o.customer_id AND (agreement.order_id IS NULL OR agreement.order_id=o.id)
    JOIN private.v_order_freeze_state_v1 frozen ON frozen.tenant_id=o.tenant_id AND frozen.order_id=o.id AND frozen.active AND frozen.integrity_ok
    WHERE o.tenant_id=NEW.tenant_id::text AND o.id=NEW.order_id AND o.version=NEW.aggregate_version
     AND o.station='abgeholt' AND o.current_station='abgeholt' AND o.current_station_id='abgeholt' AND o.status='abgeholt' AND o.payment_mode='rechnung'
     AND frozen.freeze_id::text=r->>'freezeId' AND agreement.id::text=r->>'agreementId' AND agreement.version=(r->>'agreementVersion')::integer
     AND agreement.typ='sammelrechnung' AND agreement.ziel_tage=(r->>'targetDays')::integer AND agreement.geld AND agreement.widerrufen_am IS NULL
     AND (agreement.gueltig_bis IS NULL OR agreement.gueltig_bis>=(NEW.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Berlin')::date))
  OR EXISTS(SELECT 1 FROM public.events physical WHERE physical.tenant_id=NEW.tenant_id AND physical.id=r->>'goodsOutEventId')
 THEN RAISE EXCEPTION 'COLLECTION_FOLLOWUP_PENDING_SOURCE_INVALID' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END;
$function$;

CREATE FUNCTION private.guard_collection_followup_physical_commit()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $function$
DECLARE physical public.events%ROWTYPE;
BEGIN
 SELECT * INTO physical FROM public.events WHERE tenant_id=NEW.tenant_id AND id=NEW.payload#>>'{receipt,goodsOutEventId}';
 IF NOT FOUND OR NOT private.collection_followup_source_valid(NEW,physical) THEN RAISE EXCEPTION 'COLLECTION_FOLLOWUP_PHYSICAL_RECEIPT_MISSING' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END;
$function$;

CREATE FUNCTION private.collection_followup_repair_valid(repair public.events,live_member boolean DEFAULT false)
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
   AND collection.ziel_tage=(r->>'targetDays')::integer AND collection.status='offen' AND collection.invoice_id IS NULL);
EXCEPTION WHEN data_exception THEN RETURN false;
END;
$function$;

CREATE FUNCTION private.guard_collection_followup_repair_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $function$
BEGIN
 IF NOT private.collection_followup_repair_valid(NEW,true) THEN RAISE EXCEPTION 'COLLECTION_FOLLOWUP_REPAIR_SOURCE_INVALID' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END;
$function$;

CREATE UNIQUE INDEX events_collection_attach_pending_physical_uidx ON public.events(tenant_id,(payload#>>'{receipt,goodsOutEventId}')) WHERE event_type='ORDER_COLLECTION_ATTACH_PENDING_V1';
CREATE UNIQUE INDEX events_collection_attach_repair_uidx ON public.events(tenant_id,(payload->>'markerId')) WHERE event_type='ORDER_COLLECTION_ATTACH_REPAIRED_V1';
CREATE TRIGGER events_collection_followup_pending_insert BEFORE INSERT ON public.events FOR EACH ROW WHEN(NEW.event_type='ORDER_COLLECTION_ATTACH_PENDING_V1') EXECUTE FUNCTION private.guard_collection_followup_pending_insert();
CREATE CONSTRAINT TRIGGER events_collection_followup_physical_commit AFTER INSERT ON public.events DEFERRABLE INITIALLY DEFERRED FOR EACH ROW WHEN(NEW.event_type='ORDER_COLLECTION_ATTACH_PENDING_V1') EXECUTE FUNCTION private.guard_collection_followup_physical_commit();
CREATE TRIGGER events_collection_followup_repair_insert BEFORE INSERT ON public.events FOR EACH ROW WHEN(NEW.event_type='ORDER_COLLECTION_ATTACH_REPAIRED_V1') EXECUTE FUNCTION private.guard_collection_followup_repair_insert();
CREATE TRIGGER events_collection_followup_update_immutable BEFORE UPDATE ON public.events FOR EACH ROW WHEN(OLD.event_type IN ('ORDER_COLLECTION_ATTACH_PENDING_V1','ORDER_COLLECTION_ATTACH_REPAIRED_V1')) EXECUTE FUNCTION public.prevent_audit_mutation();
CREATE TRIGGER events_collection_followup_delete_immutable BEFORE DELETE ON public.events FOR EACH ROW WHEN(OLD.event_type IN ('ORDER_COLLECTION_ATTACH_PENDING_V1','ORDER_COLLECTION_ATTACH_REPAIRED_V1')) EXECUTE FUNCTION public.prevent_audit_mutation();
REVOKE ALL ON FUNCTION private.collection_followup_marker_valid(public.events),private.collection_followup_source_valid(public.events,public.events),private.collection_followup_pending_for_goods_valid(public.events),private.collection_followup_repair_valid(public.events,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.collection_followup_marker_valid(public.events),private.collection_followup_source_valid(public.events,public.events),private.collection_followup_pending_for_goods_valid(public.events),private.collection_followup_repair_valid(public.events,boolean) TO service_role;
REVOKE ALL ON FUNCTION private.guard_collection_followup_pending_insert(),private.guard_collection_followup_physical_commit(),private.guard_collection_followup_repair_insert() FROM PUBLIC,anon,authenticated;

-- Existing V3 checks retained; only the qualified pending alternative is added.
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
      AND collection.status = 'offen'
      AND collection.ziel_tage = v_agreement.ziel_tage;
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
$function$
