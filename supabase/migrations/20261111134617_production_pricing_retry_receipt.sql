-- R2 provenance stays in the existing append-only event store.
CREATE UNIQUE INDEX production_pricing_retry_one_source ON public.events(tenant_id,(payload->>'productionEventId'),(payload->>'itemId'),(payload->>'pricingEventId')) WHERE event_type='ORDER_PRODUCTION_PRICING_RETRY_REQUIRED_V1';
CREATE FUNCTION private.guard_production_pricing_retry_receipt() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public,private AS $$
BEGIN
 IF NEW.status IS DISTINCT FROM 'success' OR NEW.event_schema_version IS DISTINCT FROM 1 OR NEW.user_id IS NULL OR NEW.client_event_id::text IS DISTINCT FROM NEW.id
 OR jsonb_typeof(NEW.payload) IS DISTINCT FROM 'object' OR (SELECT array_agg(key ORDER BY key) FROM jsonb_object_keys(NEW.payload) key) IS DISTINCT FROM ARRAY['itemId','orderId','pricingEventId','pricingOccurredAt','productionEventId']::text[]
 OR NOT EXISTS(SELECT 1 FROM private.order_production_snapshots base JOIN public.events original ON original.tenant_id=base.tenant_id AND original.id=base.event_id AND original.order_id=base.order_id JOIN public.events price ON price.tenant_id=base.tenant_id AND price.id=NEW.payload->>'pricingEventId'
 WHERE base.tenant_id=NEW.tenant_id AND base.order_id=NEW.order_id AND base.item_id=NEW.item_id AND base.order_id=NEW.payload->>'orderId' AND base.item_id=NEW.payload->>'itemId' AND base.event_id=NEW.payload->>'productionEventId' AND base.component='base' AND base.direction=1 AND base.valuation='captured'
 AND original.user_id=NEW.user_id AND original.status='success' AND original.event_type='ORDER_ITEM_FINISHED_CHANGED_V1' AND original.payload->>'finished'='true' AND NEW.created_at>=original.created_at
 AND to_char(price.created_at,'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')=NEW.payload->>'pricingOccurredAt'
 AND private.offline_production_supplement_v1(price,jsonb_populate_record(NULL::private.order_production_snapshots,to_jsonb(base)||jsonb_build_object('component','pricing','origin_event_id',base.event_id,'direction',1)))) THEN RAISE EXCEPTION 'PRODUCTION_PRICING_RETRY_SOURCE_INVALID'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.guard_production_pricing_retry_receipt() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER production_pricing_retry_insert_guard BEFORE INSERT ON public.events FOR EACH ROW WHEN(NEW.event_type='ORDER_PRODUCTION_PRICING_RETRY_REQUIRED_V1') EXECUTE FUNCTION private.guard_production_pricing_retry_receipt();
CREATE TRIGGER production_pricing_retry_update_immutable BEFORE UPDATE ON public.events FOR EACH ROW WHEN(OLD.event_type='ORDER_PRODUCTION_PRICING_RETRY_REQUIRED_V1' OR NEW.event_type='ORDER_PRODUCTION_PRICING_RETRY_REQUIRED_V1') EXECUTE FUNCTION public.prevent_audit_mutation();
CREATE TRIGGER production_pricing_retry_delete_immutable BEFORE DELETE ON public.events FOR EACH ROW WHEN(OLD.event_type='ORDER_PRODUCTION_PRICING_RETRY_REQUIRED_V1') EXECUTE FUNCTION public.prevent_audit_mutation();
