-- S38a: same cancellation event/credit ledger; exact native original identity.
CREATE OR REPLACE FUNCTION private.invoice_collection_cancellation_source_valid(tenant text,invoice_key uuid,collection jsonb)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $function$
 SELECT coalesce(EXISTS(SELECT 1 FROM public.invoices invoice
 WHERE invoice.tenant_id=tenant AND tenant=nullif(btrim(current_setting('app.tenant_id',true)),'')
 AND invoice.id=invoice_key AND invoice.order_id IS NULL AND invoice.snapshot->'collection'=collection
 AND private.invoice_original_source_valid(invoice.tenant_id,invoice.customer_id,invoice.order_id,invoice.order_version,invoice.freeze_id,invoice.service_date,invoice.snapshot,invoice.issued_at)),false);
$function$;
REVOKE ALL ON FUNCTION private.invoice_collection_cancellation_source_valid(text,uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.invoice_collection_cancellation_source_valid(text,uuid,jsonb) TO service_role;
ALTER TABLE public.events DROP CONSTRAINT events_invoice_cancelled_v1_contract_chk;
ALTER TABLE public.events ADD CONSTRAINT events_invoice_cancelled_v1_contract_chk CHECK ((((event_type)::text <> 'INVOICE_CANCELLED_V1'::text) OR COALESCE(((tenant_id IS NOT NULL) AND ((order_id IS NOT NULL AND NOT(payload ? 'collection')) OR (order_id IS NULL AND NOT(payload ? 'reissue') AND private.invoice_collection_cancellation_source_valid(tenant_id::text,(payload->>'invoiceId')::uuid,payload->'collection'))) AND (item_id IS NULL) AND (user_id IS NOT NULL) AND (client_event_id IS NOT NULL) AND (event_schema_version = 1) AND (correlation_id IS NOT NULL) AND (aggregate_version = 2) AND (from_station = 'fertig'::text) AND (station = 'fertig'::text) AND ((status)::text = 'success'::text) AND (description = btrim(description)) AND ((length(description) >= 5) AND (length(description) <= 500)) AND (jsonb_typeof(payload) = 'object'::text) AND (((CASE WHEN order_id IS NULL THEN payload-'collection' ELSE payload END) - 'reissue'::text) = jsonb_build_object('invoiceId', (payload -> 'invoiceId'::text), 'invoiceNumber', (payload -> 'invoiceNumber'::text), 'expectedVersion', (payload -> 'expectedVersion'::text), 'cancelReason', (payload -> 'cancelReason'::text), 'cancellationPdfSha256', (payload -> 'cancellationPdfSha256'::text), 'invoiceVersion', (payload -> 'invoiceVersion'::text))) AND (COALESCE((payload ->> 'invoiceId'::text), ''::text) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'::text) AND (COALESCE((payload ->> 'invoiceNumber'::text), ''::text) ~ '^R-[0-9]{4}-[0-9]{4,}$'::text) AND ((payload ->> 'cancelReason'::text) = description) AND (COALESCE((payload ->> 'cancellationPdfSha256'::text), ''::text) ~ '^[a-f0-9]{64}$'::text) AND (jsonb_typeof((payload -> 'expectedVersion'::text)) = 'number'::text) AND (((payload ->> 'expectedVersion'::text))::numeric = trunc(((payload ->> 'expectedVersion'::text))::numeric)) AND (((payload ->> 'expectedVersion'::text))::integer = 1) AND (jsonb_typeof((payload -> 'invoiceVersion'::text)) = 'number'::text) AND (((payload ->> 'invoiceVersion'::text))::integer = 2)), false))) NOT VALID;

-- DELETE is solely the native cancellation release, proven by the original
-- cancellation receipt. Open collections and issued originals stay protected.
CREATE OR REPLACE FUNCTION private.guard_invoice_collection_member_release_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $function$
BEGIN
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
REVOKE ALL ON FUNCTION private.guard_invoice_collection_member_release_v1() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER invoice_collection_member_release_only BEFORE DELETE ON public.invoice_collection_orders FOR EACH ROW EXECUTE FUNCTION private.guard_invoice_collection_member_release_v1();
GRANT DELETE ON TABLE public.invoice_collection_orders TO service_role;
