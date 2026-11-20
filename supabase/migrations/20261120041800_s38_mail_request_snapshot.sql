-- KORR S38a K3: the initial user request retains its complete immutable ID set.
-- Same event ledger, actor, invoice originals and transport. No new table/grant.
CREATE FUNCTION private.guard_invoice_mail_request_snapshot()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $function$
DECLARE p jsonb:=NEW.payload; expected integer; actual integer;
BEGIN
 IF NOT coalesce(NEW.status='success' AND NEW.event_schema_version=1
  AND NEW.tenant_id::text=nullif(current_setting('app.tenant_id',true),'')
  AND NEW.user_id IS NOT NULL AND NEW.client_event_id IS NOT NULL AND NEW.correlation_id IS NOT NULL
  AND NEW.id=NEW.client_event_id::text||':snapshot'
  AND jsonb_typeof(p)='object' AND (SELECT count(*) FROM jsonb_object_keys(p))=5
  AND p ?& ARRAY['customerId','handover','native','invoiceIds','anchorId']
  AND jsonb_typeof(p->'native')='boolean' AND jsonb_typeof(p->'invoiceIds')='array'
  AND jsonb_array_length(p->'invoiceIds')>0
  AND (p->'invoiceIds') ? (p->>'anchorId')
  AND EXISTS(SELECT 1 FROM public.app_users a WHERE a.tenant_id=NEW.tenant_id::text AND a.id=NEW.user_id),false)
 THEN RAISE EXCEPTION 'INVOICE_MAIL_REQUEST_SNAPSHOT_INVALID' USING ERRCODE='23514'; END IF;
 SELECT count(*),count(DISTINCT value) INTO expected,actual FROM jsonb_array_elements_text(p->'invoiceIds');
 IF expected<>actual THEN RAISE EXCEPTION 'INVOICE_MAIL_REQUEST_SNAPSHOT_DUPLICATE' USING ERRCODE='23514'; END IF;
 SELECT count(*) INTO actual FROM jsonb_array_elements_text(p->'invoiceIds') member
 JOIN public.invoices invoice ON invoice.id::text=member.value AND invoice.tenant_id=NEW.tenant_id::text
 WHERE invoice.customer_id=p->>'customerId' AND invoice.status='issued' AND invoice.contract_version=1
  AND (invoice.order_id IS NULL)=(p->>'native')::boolean;
 IF actual<>expected THEN RAISE EXCEPTION 'INVOICE_MAIL_REQUEST_SNAPSHOT_SOURCE_INVALID' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION private.guard_invoice_mail_request_snapshot() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.guard_invoice_mail_request_snapshot() TO service_role;
CREATE TRIGGER events_invoice_mail_request_snapshot_insert
BEFORE INSERT ON public.events FOR EACH ROW WHEN(NEW.event_type='INVOICE_MAIL_REQUEST_SNAPSHOT_V1')
EXECUTE FUNCTION private.guard_invoice_mail_request_snapshot();
CREATE TRIGGER events_invoice_mail_request_snapshot_update
BEFORE UPDATE ON public.events FOR EACH ROW
WHEN(OLD.event_type='INVOICE_MAIL_REQUEST_SNAPSHOT_V1' OR NEW.event_type='INVOICE_MAIL_REQUEST_SNAPSHOT_V1')
EXECUTE FUNCTION public.prevent_audit_mutation();
CREATE TRIGGER events_invoice_mail_request_snapshot_delete
BEFORE DELETE ON public.events FOR EACH ROW WHEN(OLD.event_type='INVOICE_MAIL_REQUEST_SNAPSHOT_V1')
EXECUTE FUNCTION public.prevent_audit_mutation();
