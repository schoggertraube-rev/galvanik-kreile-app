-- PL11.11.11:01: device occurrence time is distinct from server booking order.
CREATE FUNCTION private.order_production_time_v1(source public.events) RETURNS timestamp without time zone
LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path=pg_catalog,public,private AS $$
BEGIN
 IF source.event_type='ORDER_ITEM_FINISHED_CHANGED_V1' AND source.payload->>'finished'='true' AND source.payload ? 'offlineOriginal' THEN
  IF NOT private.valid_offline_original_event_v1(source.payload->'offlineOriginal',source.user_id,source.client_event_id)
   THEN RAISE EXCEPTION 'ORDER_PRODUCTION_OFFLINE_ORIGINAL_INVALID'; END IF;
  RETURN (source.payload->'offlineOriginal'->>'deviceCapturedAt')::timestamptz AT TIME ZONE 'UTC';
 END IF;
 RETURN source.created_at;
END $$;
REVOKE ALL ON FUNCTION private.order_production_time_v1(public.events) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.order_production_time_v1(public.events) TO service_role;
DO $$ DECLARE body text; BEGIN
 SELECT pg_get_functiondef('private.guard_order_production_snapshot()'::regprocedure) INTO body;
 IF position('source.created_at IS DISTINCT FROM NEW.occurred_at' IN body)=0
  OR position('base.occurred_at>NEW.occurred_at' IN body)=0 THEN RAISE EXCEPTION 'ORDER_PRODUCTION_PREVIOUS_CONTRACT_CHANGED'; END IF;
 body:=replace(body,'source.created_at IS DISTINCT FROM NEW.occurred_at','private.order_production_time_v1(source) IS DISTINCT FROM NEW.occurred_at');
 body:=replace(body,'base.occurred_at>NEW.occurred_at','(SELECT created_at FROM public.events WHERE id=base.event_id)>source.created_at');
 body:=replace(body,'negative.occurred_at<=NEW.occurred_at','(SELECT created_at FROM public.events WHERE id=negative.event_id)<=source.created_at');
 -- Only an existing immutable historical source may value an offline completion.
 body:=replace(body,'IF NEW.direction=-1 THEN',$guard$
 IF NEW.direction=1 AND NEW.component='base' AND source.payload ? 'offlineOriginal' AND NOT NEW.rework AND NEW.net_cents IS NOT NULL THEN
  IF NOT EXISTS(SELECT 1 FROM public.events proof WHERE proof.id=NEW.price_source->>'historicalPriceEventId'
   AND proof.tenant_id=NEW.tenant_id AND proof.status='success' AND proof.user_id IS NOT NULL AND proof.created_at<=NEW.occurred_at
   AND (proof.order_id=NEW.order_id AND proof.event_type IN ('ORDER_INTAKE_CREATED_V1','ORDER_CONTENT_CHANGED_V1','ORDER_INVOICE_PRICES_SET_V1')
    OR EXISTS(SELECT 1 FROM private.quote_conversion_receipts receipt WHERE receipt.tenant_id=NEW.tenant_id AND receipt.order_id=NEW.order_id AND receipt.event_id=proof.id AND receipt.created_at<=NEW.occurred_at)))
   OR NOT EXISTS(SELECT 1 FROM public.events proof WHERE proof.id=NEW.price_source->>'historicalQuantityEventId'
    AND proof.tenant_id=NEW.tenant_id AND proof.order_id=NEW.order_id AND proof.status='success' AND proof.user_id IS NOT NULL
    AND proof.event_type IN ('ORDER_INTAKE_CREATED_V1','ORDER_CONTENT_CHANGED_V1') AND proof.created_at<=NEW.occurred_at)
  THEN RAISE EXCEPTION 'ORDER_PRODUCTION_OFFLINE_PRICE_SOURCE_INVALID'; END IF;
 END IF;
 IF NEW.direction=-1 THEN$guard$);
 EXECUTE body;
END $$;
