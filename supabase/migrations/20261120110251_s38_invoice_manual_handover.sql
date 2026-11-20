-- PL20.11.10:10 H4: actual paper invoice handover, in the existing event ledger.
-- This is neither a mail ACK nor a goods-handover preference.
CREATE FUNCTION private.invoice_manual_handover_state(p_tenant text,p_invoice uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $function$
 SELECT CASE WHEN count(*)=0 THEN false
  WHEN count(*)=1 AND bool_and(coalesce(
   event.status='success' AND event.event_schema_version=1
   AND event.client_event_id IS NOT NULL AND event.correlation_id=event.client_event_id
   AND event.payload->>'source'='manual_handover'
   AND event.payload->>'actorId'=event.user_id::text
   AND event.payload->>'originalSha256'=invoice.pdf_sha256
   AND event.payload->>'customerId'=invoice.customer_id
   AND event.order_id IS NOT DISTINCT FROM invoice.order_id
   AND event.payload->>'handedAt'=to_char(event.created_at,'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
   AND EXISTS(SELECT 1 FROM public.app_users actor WHERE actor.tenant_id=p_tenant AND actor.id=event.user_id),false))
  THEN true ELSE NULL END
 FROM public.events event LEFT JOIN public.invoices invoice ON invoice.tenant_id=p_tenant AND invoice.id=p_invoice
 WHERE event.tenant_id=p_tenant AND event.event_type='COMMUNICATION_INVOICE_HANDED_OVER_V1'
  AND event.payload->>'invoiceId'=p_invoice::text;
$function$;
REVOKE ALL ON FUNCTION private.invoice_manual_handover_state(text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.invoice_manual_handover_state(text,uuid) TO service_role;

CREATE FUNCTION private.guard_invoice_manual_handover()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $function$
DECLARE p jsonb:=NEW.payload;
BEGIN
 IF NOT coalesce(NEW.tenant_id::text=nullif(current_setting('app.tenant_id',true),'')
  AND NEW.status='success' AND NEW.event_schema_version=1
  AND NEW.client_event_id IS NOT NULL AND NEW.correlation_id=NEW.client_event_id
  AND NEW.created_at=(statement_timestamp() AT TIME ZONE 'UTC')
  AND jsonb_typeof(p)='object' AND (SELECT count(*) FROM jsonb_object_keys(p))=6
  AND p ?& ARRAY['invoiceId','customerId','originalSha256','actorId','handedAt','source']
  AND p->>'source'='manual_handover' AND p->>'actorId'=NEW.user_id::text
  AND p->>'originalSha256' ~ '^[a-f0-9]{64}$'
  AND p->>'handedAt'=to_char(NEW.created_at,'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
  AND EXISTS(SELECT 1 FROM public.app_users actor WHERE actor.tenant_id=NEW.tenant_id::text AND actor.id=NEW.user_id)
  AND EXISTS(SELECT 1 FROM public.invoices invoice WHERE invoice.tenant_id=NEW.tenant_id::text
   AND invoice.id::text=p->>'invoiceId' AND invoice.customer_id=p->>'customerId'
   AND invoice.pdf_sha256=p->>'originalSha256' AND invoice.status='issued' AND invoice.contract_version=1
   AND invoice.order_id IS NOT DISTINCT FROM NEW.order_id),false)
 THEN RAISE EXCEPTION 'INVOICE_MANUAL_HANDOVER_SOURCE_INVALID' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION private.guard_invoice_manual_handover() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.guard_invoice_manual_handover() TO service_role;
CREATE UNIQUE INDEX events_invoice_manual_handover_original ON public.events(tenant_id,(payload->>'invoiceId'))
 WHERE event_type='COMMUNICATION_INVOICE_HANDED_OVER_V1';
CREATE UNIQUE INDEX events_invoice_manual_handover_request ON public.events(tenant_id,client_event_id)
 WHERE event_type='COMMUNICATION_INVOICE_HANDED_OVER_V1';
CREATE TRIGGER events_invoice_manual_handover_insert BEFORE INSERT ON public.events FOR EACH ROW
 WHEN(NEW.event_type='COMMUNICATION_INVOICE_HANDED_OVER_V1') EXECUTE FUNCTION private.guard_invoice_manual_handover();
CREATE TRIGGER events_invoice_manual_handover_update BEFORE UPDATE ON public.events FOR EACH ROW
 WHEN(OLD.event_type='COMMUNICATION_INVOICE_HANDED_OVER_V1' OR NEW.event_type='COMMUNICATION_INVOICE_HANDED_OVER_V1') EXECUTE FUNCTION public.prevent_audit_mutation();
CREATE TRIGGER events_invoice_manual_handover_delete BEFORE DELETE ON public.events FOR EACH ROW
 WHEN(OLD.event_type='COMMUNICATION_INVOICE_HANDED_OVER_V1') EXECUTE FUNCTION public.prevent_audit_mutation();
