-- S09 / PL13Nov22:20: existing row/order remains the shipment truth.
ALTER TABLE public.shipments ADD COLUMN sendung_id uuid;
CREATE INDEX shipments_tenant_sendung_idx ON public.shipments(tenant_id,sendung_id) WHERE sendung_id IS NOT NULL;

-- Acquire before order rows in both the existing shipment and invoice writers.
-- This serializes regrouping and the first real fee invoice for one customer.
CREATE FUNCTION private.lock_shipping_customer_v1(p_tenant text,p_customer text)
RETURNS void LANGUAGE sql STRICT SECURITY INVOKER SET search_path='' AS $$
 SELECT pg_advisory_xact_lock(hashtextextended('shipping-customer:'||p_tenant||':'||p_customer,0))
$$;
REVOKE ALL ON FUNCTION private.lock_shipping_customer_v1(text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.lock_shipping_customer_v1(text,text) TO service_role;

CREATE TRIGGER events_manual_tracking_update_immutable
 BEFORE UPDATE ON public.events FOR EACH ROW
 WHEN (OLD.event_type='SHIPMENT_MANUAL_TRACKING_SET_V1' OR NEW.event_type='SHIPMENT_MANUAL_TRACKING_SET_V1')
 EXECUTE FUNCTION public.prevent_audit_mutation();
CREATE TRIGGER events_manual_tracking_delete_immutable
 BEFORE DELETE ON public.events FOR EACH ROW
 WHEN (OLD.event_type='SHIPMENT_MANUAL_TRACKING_SET_V1')
 EXECUTE FUNCTION public.prevent_audit_mutation();
