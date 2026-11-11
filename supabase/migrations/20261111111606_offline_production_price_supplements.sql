-- PL12:01: only a qualified offline, initially unvalued completion may
-- receive an actual historical pricing receipt after its device time.
CREATE FUNCTION private.offline_production_supplement_v1(source public.events,target private.order_production_snapshots) RETURNS boolean
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=pg_catalog,public,private AS $$
 SELECT EXISTS(SELECT 1 FROM private.order_production_snapshots base JOIN public.events original ON original.id=base.event_id AND original.tenant_id=base.tenant_id AND original.order_id=base.order_id
 WHERE base.event_id=(target).origin_event_id AND base.item_id=(target).item_id AND base.tenant_id=(target).tenant_id AND base.order_id=(target).order_id
  AND base.component='base' AND base.direction=1 AND base.valuation='captured' AND base.net_cents IS NULL AND NOT base.rework
  AND (target).component='pricing' AND (target).direction=1 AND (source).tenant_id=base.tenant_id AND (source).status='success' AND (source).user_id IS NOT NULL
  AND original.event_type='ORDER_ITEM_FINISHED_CHANGED_V1' AND original.item_id=base.item_id AND original.payload->>'finished'='true'
  AND private.valid_offline_original_event_v1(original.payload->'offlineOriginal',original.user_id,original.client_event_id)
  AND (source).created_at>base.occurred_at AND (source).created_at<=original.created_at
  AND NOT EXISTS(SELECT 1 FROM private.order_production_snapshots negative WHERE negative.reverses_event_id=base.event_id AND negative.item_id=base.item_id AND negative.component='base')
  AND (
   (source).event_type='ORDER_INTAKE_CREATED_V1' AND (source).order_id=base.order_id AND EXISTS(SELECT 1 FROM private.order_intake_receipts receipt CROSS JOIN LATERAL jsonb_array_elements(receipt.items_snapshot) item(value) WHERE receipt.tenant_id=base.tenant_id AND receipt.order_id=base.order_id AND receipt.event_id=(source).id AND item.value->>'id'=base.item_id)
   OR (source).event_type='ORDER_CONTENT_CHANGED_V1' AND (source).order_id=base.order_id AND EXISTS(SELECT 1 FROM jsonb_array_elements((source).payload->'items') item(value) WHERE item.value->>'id'=base.item_id)
   OR (source).event_type='ORDER_INVOICE_PRICES_SET_V1' AND (source).order_id=base.order_id AND EXISTS(SELECT 1 FROM jsonb_array_elements((source).payload->'prices') item(value) WHERE item.value->>'itemId'=base.item_id)
   OR (source).event_type='QUOTE_AWARDED_V1' AND EXISTS(SELECT 1 FROM private.quote_conversion_receipts receipt JOIN private.order_intake_receipts intake ON intake.tenant_id=receipt.tenant_id AND intake.order_id=receipt.order_id AND intake.event_id=receipt.order_intake_event_id CROSS JOIN LATERAL jsonb_array_elements(intake.items_snapshot) item(value) WHERE receipt.tenant_id=base.tenant_id AND receipt.order_id=base.order_id AND receipt.event_id=(source).id AND item.value->>'id'=base.item_id)
  ));
$$;
REVOKE ALL ON FUNCTION private.offline_production_supplement_v1(public.events,private.order_production_snapshots) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.offline_production_supplement_v1(public.events,private.order_production_snapshots) TO service_role;
DO $$ DECLARE body text; BEGIN
 SELECT pg_get_functiondef('private.guard_order_production_snapshot()'::regprocedure) INTO body;
 IF position('source.order_id IS DISTINCT FROM NEW.order_id' IN body)=0 OR position('source.event_type IN (''ORDER_CONTENT_CHANGED_V1'',''ORDER_INVOICE_PRICES_SET_V1'')' IN body)=0
  OR position('(SELECT created_at FROM public.events WHERE id=base.event_id)>source.created_at' IN body)=0 THEN RAISE EXCEPTION 'OFFLINE_SUPPLEMENT_PREVIOUS_CONTRACT_CHANGED'; END IF;
 body:=replace(body,'source.order_id IS DISTINCT FROM NEW.order_id','(source.order_id IS DISTINCT FROM NEW.order_id AND NOT private.offline_production_supplement_v1(source,NEW))');
 body:=replace(body,'source.event_type IN (''ORDER_CONTENT_CHANGED_V1'',''ORDER_INVOICE_PRICES_SET_V1'')','(source.event_type IN (''ORDER_CONTENT_CHANGED_V1'',''ORDER_INVOICE_PRICES_SET_V1'') OR private.offline_production_supplement_v1(source,NEW))');
 body:=replace(body,'(SELECT created_at FROM public.events WHERE id=base.event_id)>source.created_at','((SELECT created_at FROM public.events WHERE id=base.event_id)>source.created_at AND NOT private.offline_production_supplement_v1(source,NEW))');
 EXECUTE body;
END $$;
