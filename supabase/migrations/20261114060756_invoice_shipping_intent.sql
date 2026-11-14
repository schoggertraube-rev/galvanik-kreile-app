-- S09 / PL14Nov05:45: same immutable invoice event, explicit additional-cost intent.
-- Preserve every old field/type/value predicate. Only the exact additional key
-- is admitted, with a strict shape and a binding back to the actual invoice.
DO $$
DECLARE name text; original text; extended text;
BEGIN
 FOREACH name IN ARRAY ARRAY['events_invoice_created_v1_contract_chk','events_invoice_created_v2_contract_chk'] LOOP
  SELECT pg_get_expr(conbin,conrelid) INTO STRICT original FROM pg_constraint
   WHERE conrelid='public.events'::regclass AND conname=name;
  IF strpos(original,'(payload = jsonb_build_object(')=0 THEN RAISE EXCEPTION 'S09_EVENT_SHAPE_SOURCE_CHANGED'; END IF;
  extended:=replace(original,'(payload = jsonb_build_object(','((payload - ''shippingCosts'') = jsonb_build_object(');
  EXECUTE format('ALTER TABLE public.events DROP CONSTRAINT %I',name);
  EXECUTE format('ALTER TABLE public.events ADD CONSTRAINT %I CHECK (%s) NOT VALID',name,extended);
 END LOOP;
END $$;

ALTER TABLE public.events ADD CONSTRAINT events_s09_shipping_intent_chk CHECK (
 event_type NOT IN ('INVOICE_CREATED_V1','INVOICE_CREATED_V2') OR NOT (payload ? 'shippingCosts') OR
 COALESCE(CASE WHEN jsonb_typeof(payload->'shippingCosts')='object' THEN
  payload->'shippingCosts'=jsonb_build_object(
   'invoiceId',payload#>'{shippingCosts,invoiceId}',
   'expectedVersion',payload#>'{shippingCosts,expectedVersion}',
   'scope',payload#>'{shippingCosts,scope}',
   'expectedFeeCents',payload#>'{shippingCosts,expectedFeeCents}')
  AND jsonb_typeof(payload#>'{shippingCosts,invoiceId}')='string'
  AND (payload#>>'{shippingCosts,invoiceId}') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  AND payload#>'{shippingCosts,expectedVersion}'='1'::jsonb
  AND jsonb_typeof(payload#>'{shippingCosts,scope}')='string'
  AND ((payload#>>'{shippingCosts,scope}')='order:'||order_id
    OR (payload#>>'{shippingCosts,scope}') ~ '^sendung:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$')
  AND jsonb_typeof(payload#>'{shippingCosts,expectedFeeCents}')='number'
  AND payload#>'{shippingCosts,expectedFeeCents}'=payload->'netAmountCents'
 ELSE false END,false)
) NOT VALID;

CREATE FUNCTION private.guard_s09_shipping_invoice_intent()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE intent jsonb; line jsonb;
BEGIN
 SELECT event.payload->'shippingCosts' INTO intent FROM public.events event
 WHERE event.tenant_id=NEW.tenant_id AND event.id=NEW.issue_event_id
  AND event.event_type IN ('INVOICE_CREATED_V1','INVOICE_CREATED_V2');
 IF NEW.belegart='auftrag' THEN
  IF intent IS NOT NULL THEN RAISE EXCEPTION 'INVOICE_MAIN_HAS_SHIPPING_INTENT' USING ERRCODE='23514'; END IF;
  RETURN NEW;
 END IF;
 IF intent IS NULL OR intent->>'invoiceId' IS DISTINCT FROM NEW.ursprung_rechnung_id::text
  OR intent->'expectedFeeCents' IS DISTINCT FROM to_jsonb(NEW.net_amount_cents) THEN
  RAISE EXCEPTION 'INVOICE_SHIPPING_INTENT_SOURCE_INVALID' USING ERRCODE='23514';
 END IF;
 FOR line IN SELECT value FROM jsonb_array_elements(NEW.snapshot->'lines') LOOP
  IF left(intent->>'scope',8)='sendung:' THEN
   IF line->>'shipmentGroupId' IS DISTINCT FROM intent->>'scope' THEN
    RAISE EXCEPTION 'INVOICE_SHIPPING_INTENT_GROUP_INVALID' USING ERRCODE='23514';
   END IF;
  ELSIF intent->>'scope' IS DISTINCT FROM 'order:'||NEW.order_id
    OR left(line->>'shipmentGroupId',8)='sendung:' THEN
   RAISE EXCEPTION 'INVOICE_SHIPPING_INTENT_ORDER_INVALID' USING ERRCODE='23514';
  END IF;
 END LOOP;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.guard_s09_shipping_invoice_intent() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.guard_s09_shipping_invoice_intent() TO service_role;
CREATE TRIGGER invoices_s09_intent_guard BEFORE INSERT ON public.invoices
 FOR EACH ROW WHEN (NEW.contract_version=1) EXECUTE FUNCTION private.guard_s09_shipping_invoice_intent();
